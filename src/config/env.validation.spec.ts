import { envValidationSchema } from './env.validation';

interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: string;
}

describe('envValidationSchema', () => {
  it('should apply sensible defaults when nothing is provided', () => {
    const { error, value } = envValidationSchema.validate({}) as {
      error: unknown;
      value: ValidatedEnv;
    };

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api');
  });

  it('should reject an invalid NODE_ENV', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'not-a-real-environment',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should reject an invalid PORT', () => {
    const { error } = envValidationSchema.validate({
      PORT: 'not-a-number',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should accept a fully specified valid configuration', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'production',
      PORT: 8080,
      API_PREFIX: 'api',
      API_VERSION: '1',
      APP_NAME: 'Fashion ERP Backend',
      CORS_ORIGINS: 'https://app.example.com',
      LOG_LEVEL: 'warn',
    }) as { error: unknown; value: ValidatedEnv };

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('production');
    expect(value.PORT).toBe(8080);
  });
});
