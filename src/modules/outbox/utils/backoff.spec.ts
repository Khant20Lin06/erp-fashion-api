import {
  computeBackoffMs,
  sanitizeErrorMessage,
  MAX_BACKOFF_MS,
  BASE_BACKOFF_MS,
} from './backoff';

describe('computeBackoffMs', () => {
  it('returns 0 for a non-positive attempt count', () => {
    expect(computeBackoffMs(0)).toBe(0);
    expect(computeBackoffMs(-1)).toBe(0);
  });

  it('doubles the delay on each successive attempt', () => {
    expect(computeBackoffMs(1)).toBe(BASE_BACKOFF_MS); // 1000
    expect(computeBackoffMs(2)).toBe(2000);
    expect(computeBackoffMs(3)).toBe(4000);
    expect(computeBackoffMs(4)).toBe(8000);
    expect(computeBackoffMs(5)).toBe(16000);
  });

  it('caps the delay at MAX_BACKOFF_MS and never exceeds it for very high attempt counts', () => {
    expect(computeBackoffMs(20)).toBe(MAX_BACKOFF_MS);
    expect(computeBackoffMs(1000)).toBe(MAX_BACKOFF_MS);
  });

  it('never returns a delay above the cap regardless of attempt count (retries continue forever, never abandoned)', () => {
    for (const attempt of [1, 5, 10, 15, 50, 500]) {
      expect(computeBackoffMs(attempt)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    }
  });
});

describe('sanitizeErrorMessage', () => {
  it('redacts user:pass@host credentials embedded in a URL', () => {
    const message = sanitizeErrorMessage(
      new Error('connect ECONNREFUSED mysql://root:supersecret@10.0.0.5:3306'),
    );
    expect(message).not.toContain('supersecret');
    expect(message).toContain('***REDACTED***');
  });

  it('redacts Authorization header values', () => {
    const message = sanitizeErrorMessage(
      new Error(
        'Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def',
      ),
    );
    expect(message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts password/secret/token/api_key key-value pairs', () => {
    const message = sanitizeErrorMessage(
      new Error(
        'bad config: password=hunter2 secret=abc123 token=xyz api_key=k-999',
      ),
    );
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('abc123');
    expect(message).not.toContain('xyz');
    expect(message).not.toContain('k-999');
  });

  it('truncates to at most 1000 characters (matching the last_error column width)', () => {
    const longMessage = 'x'.repeat(5000);
    const message = sanitizeErrorMessage(new Error(longMessage));
    expect(message.length).toBeLessThanOrEqual(1000);
  });

  it('handles non-Error thrown values', () => {
    const message = sanitizeErrorMessage('a plain string error');
    expect(message).toBe('a plain string error');
  });

  it('passes through an ordinary message with nothing secret-shaped unchanged (aside from truncation)', () => {
    const message = sanitizeErrorMessage(
      new Error('topic erp.payment.events not found'),
    );
    expect(message).toBe('topic erp.payment.events not found');
  });
});
