import { AiApprovalService } from './ai-approval.service';

describe('AiApprovalService', () => {
  let service: AiApprovalService;

  beforeEach(() => {
    service = new AiApprovalService();
  });

  it('generates a pending approval and verifies with valid token and matching arguments', () => {
    const args = { productId: 'prod-123', quantity: 5 };
    const pending = service.requestApproval('user-1', 'comp-1', 'create_stock_adjustment', args, 'Adjust stock for prod-123');

    expect(pending.token).toBeDefined();
    expect(pending.summary).toBe('Adjust stock for prod-123');

    const result = service.verifyAndConsume(pending.token, 'user-1', 'comp-1', 'create_stock_adjustment', args);
    expect(result.approved).toBe(true);

    // Single-use: cannot reuse
    const reuse = service.verifyAndConsume(pending.token, 'user-1', 'comp-1', 'create_stock_adjustment', args);
    expect(reuse.approved).toBe(false);
    expect(reuse.error).toContain('not found or already used');
  });

  it('rejects verification if arguments are tampered with', () => {
    const args = { productId: 'prod-123', quantity: 5 };
    const pending = service.requestApproval('user-1', 'comp-1', 'create_stock_adjustment', args, 'Adjust stock for prod-123');

    const tamperedArgs = { productId: 'prod-123', quantity: 500 }; // altered!
    const result = service.verifyAndConsume(pending.token, 'user-1', 'comp-1', 'create_stock_adjustment', tamperedArgs);

    expect(result.approved).toBe(false);
    expect(result.error).toContain('do not match');
  });

  it('rejects verification if token is expired', () => {
    const args = { amount: 100 };
    // 1 ms TTL
    const pending = service.requestApproval('user-1', 'comp-1', 'refund_order', args, 'Refund order', -100);

    const result = service.verifyAndConsume(pending.token, 'user-1', 'comp-1', 'refund_order', args);
    expect(result.approved).toBe(false);
    expect(result.error).toContain('expired');
  });
});
