import {
  advanceShopping,
  identifyUpdate,
  normalizeUpdate,
  SessionState,
  EventState,
} from './shopping-session';
import { ServiceUnavailableException } from '@nestjs/common';

const update = (id = 1, text = 'shirt') => ({
  update_id: id,
  message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text },
});
const session = () => ({ state: {}, activeEventId: null as string | null });
const event = () => ({
  context: null,
  operationToken: null,
  consumedToken: null,
  responseHash: null,
  completed: false,
});

describe('durable shopping transitions', () => {
  it('retains a replayable update while dropping arbitrary credentials and webhook fields', () => {
    const raw = update();
    expect(
      normalizeUpdate({
        ...raw,
        cookieHeader: 'secret',
        message: { ...raw.message, token: 'secret' },
      }),
    ).toEqual(raw);
  });
  it('keeps an uncertain order operation resumable after a server failure', () => {
    const s = session();
    const e: EventState = event();
    advanceShopping(s, e, { companyId: 'company', update: update() });
    e.context!.op = 'create_order';
    e.context!.request = {
      path: '/customer-portal/orders',
      method: 'POST',
      body: { idempotencyKey: 'same-checkout' },
    };
    const before = JSON.stringify({ s, e });
    expect(() =>
      advanceShopping(s, e, {
        companyId: 'company',
        update: update(),
        operationToken: e.operationToken!,
        response: { statusCode: 503 },
      }),
    ).toThrow(ServiceUnavailableException);
    expect(JSON.stringify({ s, e })).toBe(before);
    expect(
      advanceShopping(s, e, { companyId: 'company', update: update() }).context
        ?.request?.body?.idempotencyKey,
    ).toBe('same-checkout');
  });
  it('persists a request and resumes it without reapplying the customer event after restart', () => {
    const s = session();
    const e = event();
    const first = advanceShopping(s, e, {
      companyId: 'company',
      update: update(),
    });
    expect(first.context?.request?.path).toBe(
      '/customer-portal/catalog/discover',
    );
    const resumed = advanceShopping(
      JSON.parse(JSON.stringify(s)) as SessionState,
      JSON.parse(JSON.stringify(e)) as EventState,
      { companyId: 'company', update: update() },
    );
    expect(resumed).toEqual(first);
  });
  it('blocks another event for this customer without modifying their cart', () => {
    const s = session();
    advanceShopping(s, event(), { companyId: 'company', update: update() });
    const before = JSON.stringify(s);
    expect(
      advanceShopping(s, event(), { companyId: 'company', update: update(2) })
        .status,
    ).toBe('busy');
    expect(JSON.stringify(s)).toBe(before);
  });
  it('commits a response once, replays lost completion, and suppresses duplicate initial delivery', () => {
    const s = session();
    const e = event();
    const first = advanceShopping(s, e, {
      companyId: 'company',
      update: update(),
    });
    const input = {
      companyId: 'company',
      update: update(),
      operationToken: first.operationToken!,
      response: {
        statusCode: 200,
        body: {
          products: [
            { id: 'p1', name: 'Shirt', currency: 'MMK', variants: [] },
          ],
        },
      },
    };
    const complete = advanceShopping(s, e, input);
    expect(complete.context?.messages).toHaveLength(2); // product plus discovery controls
    expect(s.activeEventId).toBeNull();
    expect(advanceShopping(s, e, input)).toEqual(complete);
    expect(
      advanceShopping(s, e, { companyId: 'company', update: update() }).context
        ?.messages,
    ).toEqual([]);
  });
  it('rejects stale operation tokens and changed replay responses', () => {
    const s = session();
    const e = event();
    const first = advanceShopping(s, e, {
      companyId: 'company',
      update: update(),
    });
    expect(() =>
      advanceShopping(s, e, {
        companyId: 'company',
        update: update(),
        operationToken: 'old',
        response: { statusCode: 500 },
      }),
    ).toThrow();
    advanceShopping(s, e, {
      companyId: 'company',
      update: update(),
      operationToken: first.operationToken!,
      response: { statusCode: 500 },
    });
    expect(() =>
      advanceShopping(s, e, {
        companyId: 'company',
        update: update(),
        operationToken: first.operationToken!,
        response: { statusCode: 200 },
      }),
    ).toThrow();
  });
  it('validates private identity and requires a stable Telegram update id', () => {
    expect(identifyUpdate(update())).toEqual({ userId: '42', eventId: '1' });
    expect(() =>
      identifyUpdate({ ...update(), update_id: undefined }),
    ).toThrow();
    expect(() =>
      identifyUpdate({
        update_id: 1,
        message: { chat: { id: 99, type: 'private' }, from: { id: 42 } },
      }),
    ).toThrow();
  });
});
