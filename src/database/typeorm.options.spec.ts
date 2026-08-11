import { buildDataSourceOptions } from './typeorm.options';
import { DatabaseConfig } from '../config/database.config';

describe('buildDataSourceOptions', () => {
  const config: DatabaseConfig = {
    host: 'mysql',
    port: 3306,
    username: 'fashion_erp',
    password: 'secret',
    database: 'fashion_erp',
    poolSize: 10,
    logging: false,
  };

  it('never enables synchronize', () => {
    const options = buildDataSourceOptions(config);

    expect(options.synchronize).toBe(false);
  });

  it('uses mysql with utf8mb4 charset', () => {
    const options = buildDataSourceOptions(config) as {
      type?: string;
      charset?: string;
    };

    expect(options.type).toBe('mysql');
    expect(options.charset).toBe('utf8mb4_unicode_ci');
  });

  it('maps connection fields from config', () => {
    const options = buildDataSourceOptions(config) as {
      host: string;
      port: number;
      username: string;
      database: string;
    };

    expect(options.host).toBe('mysql');
    expect(options.port).toBe(3306);
    expect(options.username).toBe('fashion_erp');
    expect(options.database).toBe('fashion_erp');
  });
});
