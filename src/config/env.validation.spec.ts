import { envValidationSchema } from './env.validation';

interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
}

const requiredDbEnv = {
  DB_USERNAME: 'fashion_erp',
  DB_PASSWORD: 'fashion_erp',
  DB_DATABASE: 'fashion_erp',
  JWT_SECRET: 'a'.repeat(32),
};

describe('envValidationSchema', () => {
  it('should apply sensible defaults when only required fields are provided', () => {
    const { error, value } = envValidationSchema.validate(requiredDbEnv) as {
      error: unknown;
      value: ValidatedEnv;
    };

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api');
    expect(value.DB_HOST).toBe('localhost');
    expect(value.DB_PORT).toBe(3306);
  });

  it('should reject an invalid NODE_ENV', () => {
    const { error } = envValidationSchema.validate({
      ...requiredDbEnv,
      NODE_ENV: 'not-a-real-environment',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should reject an invalid PORT', () => {
    const { error } = envValidationSchema.validate({
      ...requiredDbEnv,
      PORT: 'not-a-number',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should require database credentials', () => {
    const { error } = envValidationSchema.validate({}) as {
      error: unknown;
    };

    expect(error).toBeDefined();
  });

  it('should require a JWT secret', () => {
    const { error } = envValidationSchema.validate({
      DB_USERNAME: 'fashion_erp',
      DB_PASSWORD: 'fashion_erp',
      DB_DATABASE: 'fashion_erp',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should reject a JWT secret shorter than 32 characters', () => {
    const { error } = envValidationSchema.validate({
      ...requiredDbEnv,
      JWT_SECRET: 'too-short',
    }) as { error: unknown };

    expect(error).toBeDefined();
  });

  it('should accept a fully specified valid configuration', () => {
    const { error, value } = envValidationSchema.validate({
      ...requiredDbEnv,
      NODE_ENV: 'production',
      PORT: 8080,
      API_PREFIX: 'api',
      API_VERSION: '1',
      APP_NAME: 'Fashion ERP Backend',
      CORS_ORIGINS: 'https://app.example.com',
      LOG_LEVEL: 'warn',
      DB_HOST: 'mysql',
      DB_PORT: 3306,
    }) as { error: unknown; value: ValidatedEnv };

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('production');
    expect(value.PORT).toBe(8080);
    expect(value.DB_HOST).toBe('mysql');
  });
});
