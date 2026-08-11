import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.options';

export const AppDataSource = new DataSource(
  buildDataSourceOptions({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? '',
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
    logging: process.env.DB_LOGGING === 'true',
  }),
);
