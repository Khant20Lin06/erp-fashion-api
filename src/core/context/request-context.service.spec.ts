import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('returns undefined outside of a run() call', () => {
    expect(service.get()).toBeUndefined();
    expect(service.getRequestId()).toBeUndefined();
  });

  it('exposes the requestId within run()', () => {
    service.run({ requestId: 'req-1' }, () => {
      expect(service.getRequestId()).toBe('req-1');
    });
  });

  it('allows setting userId within an active context', () => {
    service.run({ requestId: 'req-1' }, () => {
      service.setUserId('user-123');
      expect(service.getUserId()).toBe('user-123');
    });
  });

  it('does not leak context between two concurrent async requests', async () => {
    const observedFromA: (string | undefined)[] = [];
    const observedFromB: (string | undefined)[] = [];

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const requestA = service.run({ requestId: 'req-A' }, async () => {
      observedFromA.push(service.getRequestId());
      await delay(20);
      observedFromA.push(service.getRequestId());
    });

    const requestB = service.run({ requestId: 'req-B' }, async () => {
      observedFromB.push(service.getRequestId());
      await delay(5);
      observedFromB.push(service.getRequestId());
    });

    await Promise.all([requestA, requestB]);

    expect(observedFromA).toEqual(['req-A', 'req-A']);
    expect(observedFromB).toEqual(['req-B', 'req-B']);
  });
});
