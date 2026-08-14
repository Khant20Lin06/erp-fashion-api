import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 17 — Accounting / General Ledger (D23, LOCKED). Six new tables in
 * dependency order: accounts -> company_journal_counters -> fiscal_years ->
 * accounting_periods -> journal_entries -> journal_entry_lines. Plus one
 * additive ALTER TABLE on the Phase 16 `payment_methods` table (gl_account_id
 * nullable FK -> accounts), never touching any existing column/index/FK on
 * that table. No general_ledger/opening_balances/cash_accounts/
 * bank_accounts/tax_accounts table (D23) — General Ledger and Trial Balance
 * are pure read-query projections over journal_entry_lines (D5), never
 * physical tables.
 */
export class CreateAccountingTables1786590000000 implements MigrationInterface {
  name = 'CreateAccountingTables1786590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- accounts ----
    await queryRunner.query(
      `CREATE TABLE \`accounts\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`parent_id\` varchar(36) NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`account_type\` enum ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`is_system_account\` tinyint NOT NULL DEFAULT 0, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \`deleted_at\` timestamp NULL, UNIQUE INDEX \`IDX_acct_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_acct_account_type\` (\`account_type\`), INDEX \`IDX_acct_is_active\` (\`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- company_journal_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_journal_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cjc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- fiscal_years ----
    await queryRunner.query(
      `CREATE TABLE \`fiscal_years\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`start_date\` date NOT NULL, \`end_date\` date NOT NULL, \`status\` enum ('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN', \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \`deleted_at\` timestamp NULL, INDEX \`IDX_fy_company_dates\` (\`company_id\`, \`start_date\`, \`end_date\`), INDEX \`IDX_fy_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- accounting_periods ----
    await queryRunner.query(
      `CREATE TABLE \`accounting_periods\` (\`id\` varchar(36) NOT NULL, \`fiscal_year_id\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`start_date\` date NOT NULL, \`end_date\` date NOT NULL, \`status\` enum ('OPEN', 'LOCKED') NOT NULL DEFAULT 'OPEN', \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \`deleted_at\` timestamp NULL, INDEX \`IDX_ap_fiscal_year_dates\` (\`fiscal_year_id\`, \`start_date\`, \`end_date\`), INDEX \`IDX_ap_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- journal_entries ----
    await queryRunner.query(
      `CREATE TABLE \`journal_entries\` (\`id\` varchar(36) NOT NULL, \`journal_number\` varchar(50) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`accounting_period_id\` varchar(36) NOT NULL, \`entry_date\` timestamp NOT NULL, \`status\` enum ('DRAFT', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`source_type\` enum ('MANUAL', 'PAYMENT', 'OPENING_BALANCE') NULL, \`source_id\` varchar(36) NULL, \`description\` varchar(500) NOT NULL, \`total_debit\` decimal(14,2) NOT NULL DEFAULT '0.00', \`total_credit\` decimal(14,2) NOT NULL DEFAULT '0.00', \`created_by\` varchar(36) NOT NULL, \`posted_by\` varchar(36) NULL, \`posted_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp NULL, UNIQUE INDEX \`IDX_je_company_journal_number\` (\`company_id\`, \`journal_number\`), UNIQUE INDEX \`IDX_je_company_source\` (\`company_id\`, \`source_type\`, \`source_id\`), INDEX \`IDX_je_company_id\` (\`company_id\`), INDEX \`IDX_je_branch_id\` (\`branch_id\`), INDEX \`IDX_je_accounting_period_id\` (\`accounting_period_id\`), INDEX \`IDX_je_entry_date\` (\`entry_date\`), INDEX \`IDX_je_status\` (\`status\`), INDEX \`IDX_je_source_type\` (\`source_type\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- journal_entry_lines ----
    await queryRunner.query(
      `CREATE TABLE \`journal_entry_lines\` (\`id\` varchar(36) NOT NULL, \`journal_entry_id\` varchar(36) NOT NULL, \`account_id\` varchar(36) NOT NULL, \`debit_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`credit_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`reference_type\` enum ('PAYMENT', 'SALE', 'PURCHASE_ORDER') NULL, \`reference_id\` varchar(36) NULL, \`description\` varchar(500) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_jel_journal_entry_id\` (\`journal_entry_id\`), INDEX \`IDX_jel_account_id\` (\`account_id\`), INDEX \`IDX_jel_reference_type_reference_id\` (\`reference_type\`, \`reference_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`accounts\` ADD CONSTRAINT \`FK_acct_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`accounts\` ADD CONSTRAINT \`FK_acct_parent\` FOREIGN KEY (\`parent_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_journal_counters\` ADD CONSTRAINT \`FK_cjc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`fiscal_years\` ADD CONSTRAINT \`FK_fy_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`accounting_periods\` ADD CONSTRAINT \`FK_ap_fiscal_year\` FOREIGN KEY (\`fiscal_year_id\`) REFERENCES \`fiscal_years\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` ADD CONSTRAINT \`FK_je_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` ADD CONSTRAINT \`FK_je_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` ADD CONSTRAINT \`FK_je_accounting_period\` FOREIGN KEY (\`accounting_period_id\`) REFERENCES \`accounting_periods\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` ADD CONSTRAINT \`FK_je_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` ADD CONSTRAINT \`FK_je_posted_by\` FOREIGN KEY (\`posted_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`journal_entry_lines\` ADD CONSTRAINT \`FK_jel_journal_entry\` FOREIGN KEY (\`journal_entry_id\`) REFERENCES \`journal_entries\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entry_lines\` ADD CONSTRAINT \`FK_jel_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---- Additive Phase 16 payment_methods column: gl_account_id ----
    // Purely additive ALTER TABLE — one new nullable column + one new FK,
    // no existing column/index/FK on payment_methods is touched (see
    // payment-method.entity.ts's docblock for the full rationale).
    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` ADD \`gl_account_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` ADD CONSTRAINT \`FK_pm_gl_account\` FOREIGN KEY (\`gl_account_id\`) REFERENCES \`accounts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ---- Reverse the payment_methods addition first (depends on accounts) ----
    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` DROP FOREIGN KEY \`FK_pm_gl_account\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` DROP COLUMN \`gl_account_id\``,
    );

    // ---- journal_entry_lines ----
    await queryRunner.query(
      `ALTER TABLE \`journal_entry_lines\` DROP FOREIGN KEY \`FK_jel_account\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entry_lines\` DROP FOREIGN KEY \`FK_jel_journal_entry\``,
    );

    // ---- journal_entries ----
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` DROP FOREIGN KEY \`FK_je_posted_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` DROP FOREIGN KEY \`FK_je_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` DROP FOREIGN KEY \`FK_je_accounting_period\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` DROP FOREIGN KEY \`FK_je_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`journal_entries\` DROP FOREIGN KEY \`FK_je_company\``,
    );

    // ---- accounting_periods ----
    await queryRunner.query(
      `ALTER TABLE \`accounting_periods\` DROP FOREIGN KEY \`FK_ap_fiscal_year\``,
    );

    // ---- fiscal_years ----
    await queryRunner.query(
      `ALTER TABLE \`fiscal_years\` DROP FOREIGN KEY \`FK_fy_company\``,
    );

    // ---- company_journal_counters ----
    await queryRunner.query(
      `ALTER TABLE \`company_journal_counters\` DROP FOREIGN KEY \`FK_cjc_company\``,
    );

    // ---- accounts ----
    await queryRunner.query(
      `ALTER TABLE \`accounts\` DROP FOREIGN KEY \`FK_acct_parent\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`accounts\` DROP FOREIGN KEY \`FK_acct_company\``,
    );

    // ---- Drop tables in reverse dependency order ----
    await queryRunner.query(
      `DROP INDEX \`IDX_jel_reference_type_reference_id\` ON \`journal_entry_lines\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_jel_account_id\` ON \`journal_entry_lines\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_jel_journal_entry_id\` ON \`journal_entry_lines\``,
    );
    await queryRunner.query(`DROP TABLE \`journal_entry_lines\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_je_source_type\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_status\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_entry_date\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_accounting_period_id\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_branch_id\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_company_id\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_company_source\` ON \`journal_entries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_je_company_journal_number\` ON \`journal_entries\``,
    );
    await queryRunner.query(`DROP TABLE \`journal_entries\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_ap_status\` ON \`accounting_periods\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ap_fiscal_year_dates\` ON \`accounting_periods\``,
    );
    await queryRunner.query(`DROP TABLE \`accounting_periods\``);

    await queryRunner.query(`DROP INDEX \`IDX_fy_status\` ON \`fiscal_years\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_fy_company_dates\` ON \`fiscal_years\``,
    );
    await queryRunner.query(`DROP TABLE \`fiscal_years\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cjc_company_year\` ON \`company_journal_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_journal_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_acct_is_active\` ON \`accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_acct_account_type\` ON \`accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_acct_company_code\` ON \`accounts\``,
    );
    await queryRunner.query(`DROP TABLE \`accounts\``);
  }
}
