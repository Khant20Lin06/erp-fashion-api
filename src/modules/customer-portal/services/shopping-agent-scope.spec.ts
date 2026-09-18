import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ShoppingStateService } from './shopping-state.service';
import { normalizeUpdate } from './shopping-session';

describe('agent operation scope', () => {
  const update = {
    update_id: 1,
    message: {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      text: 'help choose',
    },
  };
  const digest = (v: unknown) =>
    createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const sessionId = digest(['company-1', 'bot-1', '42']);
  const input = {
    companyId: 'company-1',
    update,
    operationToken: 'current-token',
    tool: 'search' as const,
  };
  let event: {
    completed: boolean;
    inputHash: string;
    operationToken: string;
    context: {
      op: string;
      assistantStartedAt: number;
      agentToolCalls?: number;
      request: { body: { preferences: { size: string } } };
    };
  };
  const manager = { findOne: jest.fn(), save: jest.fn() };
  const source = {
    transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
  };
  const service = new ShoppingStateService(source as unknown as DataSource);
  beforeEach(() => {
    event = {
      completed: false,
      inputHash: digest(normalizeUpdate(update)),
      operationToken: 'current-token',
      context: {
        op: 'assistant',
        assistantStartedAt: Date.now(),
        request: { body: { preferences: { size: 'M' } } },
      },
    };
    manager.findOne.mockReset();
    manager.save.mockReset();
    manager.findOne.mockImplementation(
      (_entity: unknown, opts: { where: { id: string } }) =>
        opts.where.id === sessionId
          ? { activeEventId: '1' }
          : opts.where.id === digest([sessionId, '1'])
            ? event
            : null,
    );
  });
  it('resolves sender from the receipt and counts a bounded tool call', async () => {
    expect(await service.authorizeAgentTool('bot-1', input)).toEqual({
      userId: '42',
      preferences: { size: 'M' },
    });
    expect(event.context.agentToolCalls).toBe(1);
  });
  it.each([
    'company',
    'bot',
    'sender',
    'token',
    'payload',
    'completed',
    'limit',
    'operation',
    'expired',
  ])('rejects changed %s before permitting reads', async (field) => {
    const next = structuredClone(input);
    let bot = 'bot-1';
    if (field === 'company') next.companyId = 'other';
    if (field === 'bot') bot = 'other';
    if (field === 'sender') {
      next.update.message.chat.id = 43;
      next.update.message.from.id = 43;
    }
    if (field === 'token') next.operationToken = 'other';
    if (field === 'payload') next.update.message.text = 'changed';
    if (field === 'completed') event.completed = true;
    if (field === 'limit') event.context.agentToolCalls = 8;
    if (field === 'operation') event.context.op = 'create_order';
    if (field === 'expired')
      event.context.assistantStartedAt = Date.now() - 180001;
    await expect(service.authorizeAgentTool(bot, next)).rejects.toThrow();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
