import { ConfigService } from '@nestjs/config';
import { CustomerMultiAgentService } from './customer-multi-agent.service';
import {
  CustomerAgentModelAdapter,
  CustomerAgentModelRequest,
} from './customer-agent-model.adapter';

const config = () =>
  new ConfigService({
    CUSTOMER_MULTI_AGENT_ENABLED: true,
    CUSTOMER_MULTI_AGENT_PROVIDER: 'google',
    CUSTOMER_MULTI_AGENT_MODEL: 'test-model',
    GEMINI_API_KEY: 'test-only-key',
  });
type Script = (request: CustomerAgentModelRequest) => Promise<unknown>;
class ScriptedModel extends CustomerAgentModelAdapter {
  constructor(private readonly script: Script) {
    super(config());
  }
  override async generate(request: CustomerAgentModelRequest) {
    request.onStep();
    return this.script(request);
  }
}
const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('CustomerMultiAgentService', () => {
  it.each(['greeting', 'clarify'])(
    'uses Burmese for direct %s responses',
    async (directKind) => {
      const service = new CustomerMultiAgentService(
        new ScriptedModel(async () => ({ route: 'direct', directKind })),
      );
      const result = await service.run(
        { message: 'မင်္ဂလာပါ' },
        async () => ({}),
      );
      expect(result.action?.text).toMatch(/[\u1000-\u109f]/);
    },
  );
  it('routes product requests only to sales and uses real scoped evidence', async () => {
    const seen: string[] = [];
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) => {
        seen.push(r.agent);
        if (r.agent === 'lead') {
          expect(Object.keys(r.tools)).toEqual([]);
          return { route: 'sales' };
        }
        expect(Object.keys(r.tools).sort()).toEqual([
          'detail',
          'popular',
          'search',
        ]);
        await r.tools.search.execute({ query: 'shirt' });
        return { action: 'buy', productId: product };
      }),
    );
    const result = await service.run({ message: 'shirt' }, async () => ({
      products: [{ id: product, name: 'Shirt' }],
    }));
    expect(result.action).toEqual({ action: 'buy', productId: product });
    expect(result.degraded).toBe(false);
    expect(seen).toEqual(['lead', 'sales']);
    expect(result.trace.toolCalls).toBe(1);
  });

  it('exposes support tools only and hands off when approved policy is absent', async () => {
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) => {
        if (r.agent === 'lead') return { route: 'support' };
        expect(Object.keys(r.tools).sort()).toEqual(['orders', 'policy']);
        await r.tools.policy.execute({});
        return { action: 'reply', text: 'Returns are free for 30 days.' };
      }),
    );
    const result = await service.run({ message: 'returns?' }, async () => ({
      available: false,
      policies: [],
    }));
    expect(result.action?.action).toBe('handoff');
    expect(result.action?.text).not.toContain('30 days');
  });

  it.each([
    { action: 'submit' },
    { action: 'buy', productId: product },
    { action: 'reply', text: 'hello', customerId: 'other' },
  ])('rejects unsafe or unknown proposals %j', async (proposal) => {
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) =>
        r.agent === 'lead' ? { route: 'sales' } : proposal,
      ),
    );
    expect(await service.run({}, async () => ({}))).toMatchObject({
      action: null,
      degraded: true,
    });
  });

  it('does not accept customer identity in model tool arguments', async () => {
    let calls = 0;
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) => {
        if (r.agent === 'lead') return { route: 'support' };
        await r.tools.orders.execute({ customerId: 'another-customer' });
        return { action: 'reply', text: 'secret' };
      }),
    );
    expect(
      await service.run({}, async () => {
        calls++;
        return {};
      }),
    ).toMatchObject({ action: null, degraded: true });
    expect(calls).toBe(0);
  });

  it('bounds simultaneous tool execution to eight calls', async () => {
    let calls = 0;
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) => {
        if (r.agent === 'lead') return { route: 'sales' };
        await Promise.all(
          Array.from({ length: 9 }, () =>
            r.tools.search.execute({ query: 'shirt' }),
          ),
        );
        return { action: 'search', query: 'shirt' };
      }),
    );
    expect(
      await service.run({}, async () => {
        calls++;
        return { products: [] };
      }),
    ).toMatchObject({ action: null, degraded: true });
    expect(calls).toBe(8);
  });

  it('degrades missing configuration without invoking the provider', async () => {
    const service = new CustomerMultiAgentService(
      new CustomerAgentModelAdapter(new ConfigService({})),
    );
    expect(service.isConfigured()).toBe(false);
    expect(await service.run({}, async () => ({}))).toMatchObject({
      action: null,
      degraded: true,
      trace: { modelCalls: 0, reason: 'unconfigured' },
    });
  });

  it('uses one deadline even if the model ignores cancellation', async () => {
    jest.useFakeTimers();
    try {
      const service = new CustomerMultiAgentService(
        new ScriptedModel(async () => new Promise(() => {})),
      );
      const pending = service.run({}, async () => ({}));
      await jest.advanceTimersByTimeAsync(35000);
      expect(await pending).toMatchObject({
        action: null,
        degraded: true,
        trace: { reason: 'timeout' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels promptly when the caller aborts', async () => {
    const controller = new AbortController();
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async () => new Promise(() => {})),
    );
    const pending = service.run({}, async () => ({}), controller.signal);
    controller.abort();
    expect(await pending).toMatchObject({
      action: null,
      degraded: true,
      trace: { reason: 'cancelled' },
    });
  });

  it('keeps current-customer context and tool evidence isolated under concurrency', async () => {
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async (r) => {
        expect(r.context).not.toHaveProperty('cookie');
        if (r.agent === 'lead') return { route: 'support' };
        const data = (await r.tools.orders.execute({})) as {
          orders: { orderNumber: string }[];
        };
        return { action: 'reply', text: data.orders[0].orderNumber };
      }),
    );
    const [a, b] = await Promise.all([
      service.run({ message: 'A', cookie: 'secret-a' }, async () => ({
        orders: [{ orderNumber: 'A-1' }],
      })),
      service.run({ message: 'B', cookie: 'secret-b' }, async () => ({
        orders: [{ orderNumber: 'B-2' }],
      })),
    ]);
    expect(a.action?.text).toBe('A-1');
    expect(b.action?.text).toBe('B-2');
    expect(JSON.stringify(a.trace)).not.toMatch(/secret|A-1/);
  });

  it('supports direct greetings without specialist or data access', async () => {
    const service = new CustomerMultiAgentService(
      new ScriptedModel(async () => ({
        route: 'direct',
        directKind: 'greeting',
      })),
    );
    expect(
      await service.run({ message: 'hello' }, async () => {
        throw new Error('unexpected tool');
      }),
    ).toMatchObject({
      action: { action: 'reply' },
      degraded: false,
      trace: { agents: ['lead'], toolCalls: 0 },
    });
  });
});
