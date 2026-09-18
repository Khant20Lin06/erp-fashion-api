import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImageUrl1788800000000 implements MigrationInterface {
  name = 'AddProductImageUrl1788800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `products` ADD `image_url` varchar(2048) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `products` DROP COLUMN `image_url`');
  }
}
