import { logBootstrapFailure } from './bootstrap-error';

describe('logBootstrapFailure', () => {
  it('logs bootstrap failures through the structured logger contract', () => {
    const logger = { error: jest.fn() };
    const error = new Error('boom');

    logBootstrapFailure(error, logger);

    expect(logger.error).toHaveBeenCalledWith(
      'Fatal error during application bootstrap',
      error.stack,
    );
  });

  it('omits stack traces for non-Error throwables', () => {
    const logger = { error: jest.fn() };

    logBootstrapFailure('boom', logger);

    expect(logger.error).toHaveBeenCalledWith(
      'Fatal error during application bootstrap',
      undefined,
    );
  });
});
