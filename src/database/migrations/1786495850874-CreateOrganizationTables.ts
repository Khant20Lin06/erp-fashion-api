import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationTables1786495850874 implements MigrationInterface {
  name = 'CreateOrganizationTables1786495850874';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`companies\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`base_currency\` varchar(3) NOT NULL, \`timezone\` varchar(100) NOT NULL, \`country\` varchar(100) NULL, \`phone\` varchar(50) NULL, \`email\` varchar(255) NULL, \`address\` varchar(500) NULL, INDEX \`IDX_org_companies_status\` (\`status\`), UNIQUE INDEX \`IDX_org_companies_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`branches\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`phone\` varchar(50) NULL, \`email\` varchar(255) NULL, \`address\` varchar(500) NULL, \`timezone\` varchar(100) NULL, INDEX \`IDX_org_branches_status\` (\`status\`), INDEX \`IDX_org_branches_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_org_branches_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`warehouses\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`type\` enum ('MAIN', 'STORE', 'DISTRIBUTION', 'TRANSIT', 'RETURN', 'VIRTUAL', 'OTHER') NOT NULL DEFAULT 'MAIN', \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`address\` varchar(500) NULL, INDEX \`IDX_org_warehouses_type\` (\`type\`), INDEX \`IDX_org_warehouses_status\` (\`status\`), INDEX \`IDX_org_warehouses_company_id\` (\`company_id\`), INDEX \`IDX_org_warehouses_branch_id\` (\`branch_id\`), UNIQUE INDEX \`IDX_org_warehouses_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`branches\` ADD CONSTRAINT \`FK_org_branches_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`warehouses\` ADD CONSTRAINT \`FK_org_warehouses_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`warehouses\` ADD CONSTRAINT \`FK_org_warehouses_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`warehouses\` DROP FOREIGN KEY \`FK_org_warehouses_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`warehouses\` DROP FOREIGN KEY \`FK_org_warehouses_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`branches\` DROP FOREIGN KEY \`FK_org_branches_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_warehouses_company_code\` ON \`warehouses\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_warehouses_branch_id\` ON \`warehouses\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_warehouses_company_id\` ON \`warehouses\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_warehouses_status\` ON \`warehouses\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_warehouses_type\` ON \`warehouses\``,
    );
    await queryRunner.query(`DROP TABLE \`warehouses\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_org_branches_company_code\` ON \`branches\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_branches_company_id\` ON \`branches\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_branches_status\` ON \`branches\``,
    );
    await queryRunner.query(`DROP TABLE \`branches\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_org_companies_code\` ON \`companies\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_org_companies_status\` ON \`companies\``,
    );
    await queryRunner.query(`DROP TABLE \`companies\``);
  }
}
