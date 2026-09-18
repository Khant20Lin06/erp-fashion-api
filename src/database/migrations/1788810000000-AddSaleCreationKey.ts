import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleCreationKey1788810000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE sales ADD creation_key char(64) NULL, ADD creation_hash char(64) NULL, ADD UNIQUE KEY uq_sales_creation_key (company_id, creation_key)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE sales DROP INDEX uq_sales_creation_key, DROP COLUMN creation_hash, DROP COLUMN creation_key',
    );
  }
}
