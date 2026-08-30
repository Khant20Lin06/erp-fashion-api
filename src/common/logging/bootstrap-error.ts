import { Logger } from '@nestjs/common';

type BootstrapLogger = Pick<Logger, 'error'>;

export function logBootstrapFailure(
  error: unknown,
  logger: BootstrapLogger = new Logger('Bootstrap'),
): void {
  logger.error(
    'Fatal error during application bootstrap',
    error instanceof Error ? error.stack : undefined,
  );
}
