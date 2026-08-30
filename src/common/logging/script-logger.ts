import { Logger } from '@nestjs/common';

type ScriptErrorLogger = Pick<Logger, 'error'>;

export type ScriptLogger = Pick<Logger, 'log' | 'warn' | 'error'>;

export function createScriptLogger(context: string): ScriptLogger {
  return new Logger(context);
}

export function logScriptFailure(
  message: string,
  error: unknown,
  logger: ScriptErrorLogger,
): void {
  logger.error(message, error instanceof Error ? error.stack : undefined);
}
