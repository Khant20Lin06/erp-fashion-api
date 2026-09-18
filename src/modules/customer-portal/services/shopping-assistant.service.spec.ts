import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ShoppingAssistantService } from './shopping-assistant.service';
import { CustomerMultiAgentService } from '../agents/customer-multi-agent.service';
import { CustomerAgentToolsService } from './customer-agent-tools.service';
import { normalizeUpdate } from './shopping-session';

describe('durable customer assistant execution', () => {
  const update = {
    update_id: 31,
    message: {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      text: 'help choose',
    },
  };
  const input = { companyId: 'company', update, operationToken: 'operation' };
  const hash = (v: unknown) =>
    createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const sessionId = hash(['company', 'bot', '42']);
  let event: any;
  let session: any;
  let service: ShoppingAssistantService;
  const model = { run: jest.fn() };
  const tools = { call: jest.fn() };
  const manager = { findOne: jest.fn(), save: jest.fn() };
  beforeEach(() => {
    session = { activeEventId: '31' };
    event = {
      completed: false,
      inputHash: hash(normalizeUpdate(update)),
      operationToken: 'operation',
      context: {
        op: 'assistant',
        assistantStartedAt: Date.now(),
        request: {
          body: { message: 'help choose', preferences: { size: 'M' } },
        },
      },
    };
    manager.findOne.mockImplementation((_type, opts) =>
      opts.where.id === sessionId
        ? session
        : opts.where.id === hash([sessionId, '31'])
          ? event
          : null,
    );
    manager.save.mockReset();
    model.run.mockReset();
    tools.call.mockReset();
    model.run.mockResolvedValue({
      action: { action: 'search', query: 'pants' },
      degraded: false,
      trace: { agents: ['lead', 'sales'] },
    });
    service = new ShoppingAssistantService(
      {
        transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
      } as unknown as DataSource,
      model as unknown as CustomerMultiAgentService,
      tools as unknown as CustomerAgentToolsService,
    );
  });
  it('uses only persisted context and caches the result for a duplicate', async () => {
    const first = await service.run('bot', input);
    expect(first).toEqual(
      expect.objectContaining({
        status: 'ready',
        action: { action: 'search', query: 'pants' },
      }),
    );
    expect(await service.run('bot', input)).toEqual(first);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(model.run.mock.calls[0][0]).toEqual(event.context.request.body);
    expect(model.run.mock.calls[0][0]).not.toHaveProperty('companyId');
  });
  it('returns busy for a concurrent duplicate rather than running another model', async () => {
    let release!: (v: unknown) => void;
    model.run.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.run('bot', input);
    await new Promise((resolve) => setImmediate(resolve));
    expect(await service.run('bot', input)).toEqual({
      status: 'busy',
      retryAfterMs: 1000,
    });
    expect(model.run).toHaveBeenCalledTimes(1);
    release({
      action: { action: 'reply', text: 'Hello' },
      degraded: false,
      trace: {},
    });
    await first;
  });
  it.each([
    'company',
    'bot',
    'sender',
    'token',
    'payload',
    'completed',
    'expired',
    'wrong-operation',
  ])('rejects %s scope mismatch before model IO', async (field) => {
    const next = structuredClone(input);
    let bot = 'bot';
    if (field === 'company') next.companyId = 'other';
    if (field === 'bot') bot = 'other';
    if (field === 'sender') {
      next.update.message.from.id = 43;
      next.update.message.chat.id = 43;
    }
    if (field === 'token') next.operationToken = 'other';
    if (field === 'payload') next.update.message.text = 'changed';
    if (field === 'completed') event.completed = true;
    if (field === 'expired')
      event.context.assistantStartedAt = Date.now() - 180001;
    if (field === 'wrong-operation') event.context.op = 'create_order';
    await expect(service.run(bot, next)).rejects.toThrow();
    expect(model.run).not.toHaveBeenCalled();
  });
  it('binds specialist tools to server scope and rejects model identity arguments', async () => {
    model.run.mockImplementation(async (_context, call) => {
      await call('search', { query: 'pants' });
      await expect(
        call('orders', { userId: 'someone-else' }),
      ).rejects.toThrow();
      return {
        action: { action: 'search', query: 'pants' },
        degraded: false,
        trace: {},
      };
    });
    await service.run('bot', input);
    expect(tools.call).toHaveBeenCalledTimes(1);
    expect(tools.call).toHaveBeenCalledWith('bot', {
      ...input,
      update: normalizeUpdate(update),
      tool: 'search',
      query: 'pants',
    });
  });
  it('invalid actions produce explicit cached degradation', async () => {
    model.run.mockResolvedValue({
      action: { action: 'submit_order' },
      degraded: false,
      trace: {},
    });
    const r = await service.run('bot', input);
    expect(r).toEqual(
      expect.objectContaining({
        status: 'ready',
        action: null,
        degraded: true,
      }),
    );
  });
  it('caches provider failures without exposing upstream errors', async () => {
    model.run.mockRejectedValue(new Error('secret upstream payload'));
    const result = await service.run('bot', input);
    expect(result).toEqual({
      status: 'ready',
      action: null,
      degraded: true,
      trace: { code: 'ASSISTANT_UNAVAILABLE' },
    });
    expect(await service.run('bot', input)).toEqual(result);
    expect(model.run).toHaveBeenCalledTimes(1);
  });
  it('aborts a stalled model at the deadline and caches fallback', async () => {
    jest.useFakeTimers();
    try {
      model.run.mockImplementation(() => new Promise(() => {}));
      const pending = service.run('bot', input);
      await jest.advanceTimersByTimeAsync(40001);
      expect(await pending).toEqual({
        status: 'ready',
        action: null,
        degraded: true,
        trace: { code: 'ASSISTANT_TIMEOUT' },
      });
      expect(model.run.mock.calls[0][2].aborted).toBe(true);
      expect(await service.run('bot', input)).toEqual(await pending);
    } finally {
      jest.useRealTimers();
    }
  });
  it('persists only bounded diagnostic fields', async () => {
    model.run.mockResolvedValue({
      action: { action: 'reply', text: 'Hello' },
      degraded: false,
      trace: {
        modelCalls: 2,
        toolCalls: 1,
        durationMs: 12,
        model: 'gemini-test',
        route: 'sales',
        agents: ['lead', 'sales', 'bad agent payload'],
        prompt: 'private',
        reasoning: 'private',
        data: { password: 'private' },
      },
    });
    const result = await service.run('bot', input);
    expect(result).toEqual(
      expect.objectContaining({
        trace: {
          modelCalls: 2,
          toolCalls: 1,
          durationMs: 12,
          model: 'gemini-test',
          route: 'sales',
          agents: ['lead', 'sales'],
        },
      }),
    );
  });
  it('does not accept a completion after its operation changes', async () => {
    model.run.mockImplementation(async () => {
      event.operationToken = 'changed';
      return {
        action: { action: 'reply', text: 'Hi' },
        degraded: false,
        trace: {},
      };
    });
    await expect(service.run('bot', input)).rejects.toThrow();
    expect(event.context.assistantRun.result).toBeUndefined();
  });
  it('recovers an expired lease once and rejects the old result owner', async () => {
    event.context.assistantRun = {
      id: 'old',
      operationToken: 'operation',
      startedAt: Date.now() - 60001,
      attempts: 1,
    };
    await service.run('bot', input);
    expect(event.context.assistantRun.id).not.toBe('old');
    expect(event.context.assistantRun.attempts).toBe(2);
  });
  it('caps recovery attempts when workers repeatedly disappear', async () => {
    event.context.assistantRun = {
      id: 'old',
      operationToken: 'operation',
      startedAt: Date.now() - 60001,
      attempts: 2,
    };
    const r = await service.run('bot', input);
    expect(r).toEqual(
      expect.objectContaining({
        status: 'ready',
        action: null,
        degraded: true,
      }),
    );
    expect(model.run).not.toHaveBeenCalled();
  });
});
