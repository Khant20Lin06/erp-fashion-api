import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShoppingState1788820000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE shopping_sessions (
      id char(64) NOT NULL PRIMARY KEY, company_id char(36) NOT NULL,
      bot_user_id char(36) NOT NULL, telegram_user_id varchar(64) NOT NULL,
      state json NOT NULL, active_event_id varchar(64) NULL,
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_shopping_session_scope (company_id, bot_user_id, telegram_user_id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE shopping_events (
      id char(64) NOT NULL PRIMARY KEY, session_id char(64) NOT NULL, event_id varchar(64) NOT NULL,
      input_hash char(64) NOT NULL, context json NULL, operation_token char(36) NULL,
      consumed_token char(36) NULL, response_hash char(64) NULL, completed tinyint NOT NULL DEFAULT 0,
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_shopping_event (session_id, event_id),
      CONSTRAINT fk_shopping_event_session FOREIGN KEY (session_id) REFERENCES shopping_sessions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE shopping_events');
    await queryRunner.query('DROP TABLE shopping_sessions');
  }
}
