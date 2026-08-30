import { createScriptLogger, logScriptFailure } from './script-logger';

describe('script logger helpers', () => {
  it('creates a Nest-compatible logger for script contexts', () => {
    const logger = createScriptLogger('SeedRunner');

    expect(logger).toEqual(
      expect.objectContaining({
        log: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function),
      }),
    );
  });

  it('logs script failures through the structured logger contract', () => {
    const logger = { error: jest.fn() };
    const error = new Error('boom');

    logScriptFailure('Seed failed', error, logger);

    expect(logger.error).toHaveBeenCalledWith('Seed failed', error.stack);
  });

  it('omits stack traces for non-Error throwables', () => {
    const logger = { error: jest.fn() };

    logScriptFailure('Seed failed', 'boom', logger);

    expect(logger.error).toHaveBeenCalledWith('Seed failed', undefined);
  });
});
