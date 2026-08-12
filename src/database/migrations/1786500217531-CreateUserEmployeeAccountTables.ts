import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserEmployeeAccountTables1786500217531 implements MigrationInterface {
  name = 'CreateUserEmployeeAccountTables1786500217531';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 08 §7/§12 LOCKED: add LOCKED to users.status without contradicting
    // the existing Phase 05 ACTIVE/INACTIVE/SUSPENDED values.
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`status\` enum ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED') NOT NULL DEFAULT 'ACTIVE'`,
    );

    await queryRunner.query(
      `CREATE TABLE \`employees\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_code\` varchar(50) NOT NULL, \`first_name\` varchar(100) NOT NULL, \`last_name\` varchar(100) NOT NULL, \`display_name\` varchar(200) NOT NULL, \`phone\` varchar(50) NULL, \`email\` varchar(255) NULL, \`user_id\` varchar(36) NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE', \`joined_at\` timestamp NULL, \`terminated_at\` timestamp NULL, INDEX \`IDX_emp_status\` (\`status\`), INDEX \`IDX_emp_company_id\` (\`company_id\`), INDEX \`IDX_emp_branch_id\` (\`branch_id\`), UNIQUE INDEX \`IDX_emp_company_code\` (\`company_id\`, \`employee_code\`), UNIQUE INDEX \`IDX_emp_user_id\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`user_companies\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_ucomp_status\` (\`status\`), UNIQUE INDEX \`IDX_ucomp_user_company\` (\`user_id\`, \`company_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`user_branches\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_ubr_status\` (\`status\`), UNIQUE INDEX \`IDX_ubr_user_branch\` (\`user_id\`, \`branch_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`user_warehouses\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`warehouse_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_uwh_status\` (\`status\`), UNIQUE INDEX \`IDX_uwh_user_warehouse\` (\`user_id\`, \`warehouse_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`sales_accounts\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NOT NULL, \`employee_id\` varchar(36) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_sa_status\` (\`status\`), INDEX \`IDX_sa_company_id\` (\`company_id\`), INDEX \`IDX_sa_branch_id\` (\`branch_id\`), INDEX \`IDX_sa_employee_id\` (\`employee_id\`), UNIQUE INDEX \`IDX_sa_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`sales_account_assignments\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`employee_id\` varchar(36) NOT NULL, \`sales_account_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`is_primary\` tinyint NOT NULL DEFAULT 0, \`assigned_at\` timestamp NOT NULL, \`unassigned_at\` timestamp NULL, INDEX \`IDX_saa_status\` (\`status\`), INDEX \`IDX_saa_user_id\` (\`user_id\`), INDEX \`IDX_saa_employee_id\` (\`employee_id\`), INDEX \`IDX_saa_sales_account_id\` (\`sales_account_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD CONSTRAINT \`FK_emp_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD CONSTRAINT \`FK_emp_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD CONSTRAINT \`FK_emp_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_companies\` ADD CONSTRAINT \`FK_ucomp_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_companies\` ADD CONSTRAINT \`FK_ucomp_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_branches\` ADD CONSTRAINT \`FK_ubr_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_branches\` ADD CONSTRAINT \`FK_ubr_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_warehouses\` ADD CONSTRAINT \`FK_uwh_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_warehouses\` ADD CONSTRAINT \`FK_uwh_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` ADD CONSTRAINT \`FK_sa_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` ADD CONSTRAINT \`FK_sa_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` ADD CONSTRAINT \`FK_sa_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` ADD CONSTRAINT \`FK_saa_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` ADD CONSTRAINT \`FK_saa_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` ADD CONSTRAINT \`FK_saa_sales_account\` FOREIGN KEY (\`sales_account_id\`) REFERENCES \`sales_accounts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` DROP FOREIGN KEY \`FK_saa_sales_account\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` DROP FOREIGN KEY \`FK_saa_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_account_assignments\` DROP FOREIGN KEY \`FK_saa_user\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` DROP FOREIGN KEY \`FK_sa_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` DROP FOREIGN KEY \`FK_sa_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales_accounts\` DROP FOREIGN KEY \`FK_sa_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_warehouses\` DROP FOREIGN KEY \`FK_uwh_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_warehouses\` DROP FOREIGN KEY \`FK_uwh_user\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_branches\` DROP FOREIGN KEY \`FK_ubr_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_branches\` DROP FOREIGN KEY \`FK_ubr_user\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`user_companies\` DROP FOREIGN KEY \`FK_ucomp_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_companies\` DROP FOREIGN KEY \`FK_ucomp_user\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP FOREIGN KEY \`FK_emp_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP FOREIGN KEY \`FK_emp_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP FOREIGN KEY \`FK_emp_user\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_saa_sales_account_id\` ON \`sales_account_assignments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_saa_employee_id\` ON \`sales_account_assignments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_saa_user_id\` ON \`sales_account_assignments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_saa_status\` ON \`sales_account_assignments\``,
    );
    await queryRunner.query(`DROP TABLE \`sales_account_assignments\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sa_company_code\` ON \`sales_accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_employee_id\` ON \`sales_accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_branch_id\` ON \`sales_accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_company_id\` ON \`sales_accounts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_status\` ON \`sales_accounts\``,
    );
    await queryRunner.query(`DROP TABLE \`sales_accounts\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_uwh_user_warehouse\` ON \`user_warehouses\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_uwh_status\` ON \`user_warehouses\``,
    );
    await queryRunner.query(`DROP TABLE \`user_warehouses\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_ubr_user_branch\` ON \`user_branches\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ubr_status\` ON \`user_branches\``,
    );
    await queryRunner.query(`DROP TABLE \`user_branches\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_ucomp_user_company\` ON \`user_companies\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ucomp_status\` ON \`user_companies\``,
    );
    await queryRunner.query(`DROP TABLE \`user_companies\``);

    await queryRunner.query(`DROP INDEX \`IDX_emp_user_id\` ON \`employees\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_emp_company_code\` ON \`employees\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_emp_branch_id\` ON \`employees\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_emp_company_id\` ON \`employees\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_emp_status\` ON \`employees\``);
    await queryRunner.query(`DROP TABLE \`employees\``);

    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`status\` enum ('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE'`,
    );
  }
}
