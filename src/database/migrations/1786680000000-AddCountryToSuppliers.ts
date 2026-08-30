import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCountryToSuppliers1786680000000
  implements MigrationInterface
{
  name = 'AddCountryToSuppliers1786680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `suppliers` ADD COLUMN `country` varchar(100) NULL AFTER `email`",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `suppliers` DROP COLUMN `country`',
    );
  }
}
