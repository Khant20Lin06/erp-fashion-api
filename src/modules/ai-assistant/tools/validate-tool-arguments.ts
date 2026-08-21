import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * The one place raw LLM-supplied tool arguments are validated (Phase 19
 * §12: "never trust LLM-generated arguments"). Mirrors the global
 * ValidationPipe's `{ whitelist: true, forbidNonWhitelisted: true }`
 * behavior manually, since tool execution happens outside the HTTP
 * pipeline where that pipe would normally run.
 */
export async function validateToolArguments<T extends object>(
  dtoClass: new () => T,
  rawArguments: unknown,
): Promise<T> {
  const candidate =
    rawArguments && typeof rawArguments === 'object' ? rawArguments : {};
  const instance = plainToInstance(dtoClass, candidate, {
    excludeExtraneousValues: false,
  });

  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new AppException(
      ErrorCode.ValidationError,
      `Invalid tool arguments: ${message}`,
    );
  }

  return instance;
}
