import { DataSource } from 'typeorm';
import { TransactionService } from './transaction.service';
import { buildDataSourceOptions } from '../../database/typeorm.options';

interface LabelRow {
  label: string;
}

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

describeIfDb('TransactionService (integration)', () => {
  let dataSource: DataSource;
  let service: TransactionService;

  beforeAll(async () => {
    dataSource = new DataSource(
      buildDataSourceOptions({
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '3306', 10),
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_DATABASE!,
        poolSize: 5,
        logging: false,
      }),
    );
    await dataSource.initialize();
    await dataSource.query(
      'CREATE TABLE IF NOT EXISTS transaction_service_test (id INT PRIMARY KEY AUTO_INCREMENT, label VARCHAR(50) NOT NULL)',
    );
    service = new TransactionService(dataSource);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM transaction_service_test');
  });

  afterAll(async () => {
    await dataSource.query('DROP TABLE IF EXISTS transaction_service_test');
    await dataSource.destroy();
  });

  it('commits all operations when the work succeeds', async () => {
    await service.run(async (manager) => {
      await manager.query(
        'INSERT INTO transaction_service_test (label) VALUES (?)',
        ['a'],
      );
      await manager.query(
        'INSERT INTO transaction_service_test (label) VALUES (?)',
        ['b'],
      );
    });

    const rows = await dataSource.query<LabelRow[]>(
      'SELECT label FROM transaction_service_test ORDER BY label',
    );
    expect(rows).toEqual([{ label: 'a' }, { label: 'b' }]);
  });

  it('rolls back all operations when the work throws', async () => {
    await expect(
      service.run(async (manager) => {
        await manager.query(
          'INSERT INTO transaction_service_test (label) VALUES (?)',
          ['should-not-persist'],
        );
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    const rows = await dataSource.query<LabelRow[]>(
      'SELECT label FROM transaction_service_test',
    );
    expect(rows).toEqual([]);
  });
});
