import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShoppingEventPayload1788830000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE shopping_events ADD update_payload json NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE shopping_events DROP COLUMN update_payload',
    );
  }
}
