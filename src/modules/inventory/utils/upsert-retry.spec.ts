import { retryOnDuplicateEntry } from './upsert-retry';

describe('retryOnDuplicateEntry', () => {
  it('warn-logs duplicate-entry retries with structured context before succeeding', async () => {
    const logger = { warn: jest.fn() };
    let attempts = 0;

    const result = await retryOnDuplicateEntry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw { code: 'ER_DUP_ENTRY', errno: 1062 };
        }
        return 'ok';
      },
      5,
      logger,
    );

    expect(result).toBe('ok');
    expect(logger.warn).toHaveBeenCalledWith(
      '[retryOnDuplicateEntry] retrying duplicate-entry upsert attempt=1/5 code=ER_DUP_ENTRY errno=1062',
    );
  });

  it('does not warn-log non-duplicate failures that are rethrown immediately', async () => {
    const logger = { warn: jest.fn() };
    const error = { code: 'ER_LOCK_DEADLOCK', errno: 1213 };

    await expect(
      retryOnDuplicateEntry(
        async () => {
          throw error;
        },
        5,
        logger,
      ),
    ).rejects.toBe(error);

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
