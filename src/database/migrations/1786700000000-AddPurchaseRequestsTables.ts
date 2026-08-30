import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseRequestsTables1786700000000
  implements MigrationInterface
{
  name = 'AddPurchaseRequestsTables1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`company_purchase_request_counters\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cprc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_requests\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`request_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`department\` varchar(120) NOT NULL, \`requester_name\` varchar(120) NOT NULL, \`required_date\` timestamp NOT NULL, \`status\` enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT', \`notes\` varchar(1000) NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, INDEX \`IDX_pr_company_id\` (\`company_id\`), INDEX \`IDX_pr_branch_id\` (\`branch_id\`), INDEX \`IDX_pr_required_date\` (\`required_date\`), INDEX \`IDX_pr_status\` (\`status\`), UNIQUE INDEX \`IDX_pr_company_number\` (\`company_id\`, \`request_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_request_items\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`purchase_request_id\` char(36) NOT NULL, \`product_variant_id\` char(36) NOT NULL, \`quantity\` int NOT NULL, \`reason\` varchar(255) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, INDEX \`IDX_pri_purchase_request_id\` (\`purchase_request_id\`), INDEX \`IDX_pri_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_purchase_request_counters\` ADD CONSTRAINT \`FK_cprc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` ADD CONSTRAINT \`FK_pr_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` ADD CONSTRAINT \`FK_pr_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` ADD CONSTRAINT \`FK_pr_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` ADD CONSTRAINT \`FK_pr_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_request_items\` ADD CONSTRAINT \`FK_pri_request\` FOREIGN KEY (\`purchase_request_id\`) REFERENCES \`purchase_requests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_request_items\` ADD CONSTRAINT \`FK_pri_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_request_items\` DROP FOREIGN KEY \`FK_pri_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_request_items\` DROP FOREIGN KEY \`FK_pri_request\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` DROP FOREIGN KEY \`FK_pr_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` DROP FOREIGN KEY \`FK_pr_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` DROP FOREIGN KEY \`FK_pr_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_requests\` DROP FOREIGN KEY \`FK_pr_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_request_counters\` DROP FOREIGN KEY \`FK_cprc_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_pri_product_variant_id\` ON \`purchase_request_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pri_purchase_request_id\` ON \`purchase_request_items\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_request_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pr_company_number\` ON \`purchase_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pr_status\` ON \`purchase_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pr_required_date\` ON \`purchase_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pr_branch_id\` ON \`purchase_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pr_company_id\` ON \`purchase_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_requests\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cprc_company_year\` ON \`company_purchase_request_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_purchase_request_counters\``);
  }
}
