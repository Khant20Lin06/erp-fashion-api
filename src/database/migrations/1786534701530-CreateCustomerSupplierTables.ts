import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerSupplierTables1786534701530 implements MigrationInterface {
  name = 'CreateCustomerSupplierTables1786534701530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- customer_groups ----
    await queryRunner.query(
      `CREATE TABLE \`customer_groups\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_cg_status\` (\`status\`), INDEX \`IDX_cg_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_cg_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- supplier_groups ----
    await queryRunner.query(
      `CREATE TABLE \`supplier_groups\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_sg_status\` (\`status\`), INDEX \`IDX_sg_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_sg_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- payment_terms ----
    await queryRunner.query(
      `CREATE TABLE \`payment_terms\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`due_days\` int NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_pt_status\` (\`status\`), INDEX \`IDX_pt_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_pt_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- customers ----
    await queryRunner.query(
      `CREATE TABLE \`customers\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`customer_code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`display_name\` varchar(200) NULL, \`phone\` varchar(50) NULL, \`email\` varchar(255) NULL, \`customer_group_id\` varchar(36) NULL, \`payment_term_id\` varchar(36) NULL, \`credit_limit\` decimal(14,2) NOT NULL DEFAULT '0.00', \`credit_days\` int NOT NULL DEFAULT '0', \`opening_balance_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`receivable_account_id\` varchar(36) NULL, \`status\` enum ('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE', \`notes\` varchar(1000) NULL, INDEX \`IDX_cust_status\` (\`status\`), INDEX \`IDX_cust_company_id\` (\`company_id\`), INDEX \`IDX_cust_phone\` (\`phone\`), INDEX \`IDX_cust_email\` (\`email\`), UNIQUE INDEX \`IDX_cust_company_code\` (\`company_id\`, \`customer_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- suppliers ----
    await queryRunner.query(
      `CREATE TABLE \`suppliers\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`supplier_code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`display_name\` varchar(200) NULL, \`phone\` varchar(50) NULL, \`email\` varchar(255) NULL, \`supplier_group_id\` varchar(36) NULL, \`payment_term_id\` varchar(36) NULL, \`credit_days\` int NOT NULL DEFAULT '0', \`opening_balance_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`payable_account_id\` varchar(36) NULL, \`status\` enum ('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE', \`notes\` varchar(1000) NULL, INDEX \`IDX_supp_status\` (\`status\`), INDEX \`IDX_supp_company_id\` (\`company_id\`), INDEX \`IDX_supp_phone\` (\`phone\`), INDEX \`IDX_supp_email\` (\`email\`), UNIQUE INDEX \`IDX_supp_company_code\` (\`company_id\`, \`supplier_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- customer_addresses ----
    await queryRunner.query(
      `CREATE TABLE \`customer_addresses\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`customer_id\` varchar(36) NOT NULL, \`label\` enum ('BILLING', 'SHIPPING', 'OFFICE', 'HOME', 'WAREHOUSE', 'OTHER') NOT NULL DEFAULT 'OTHER', \`recipient_name\` varchar(200) NULL, \`address_line1\` varchar(255) NOT NULL, \`address_line2\` varchar(255) NULL, \`city\` varchar(100) NULL, \`state\` varchar(100) NULL, \`postal_code\` varchar(20) NULL, \`country\` varchar(100) NULL, \`phone\` varchar(50) NULL, \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_ca_customer_id\` (\`customer_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- supplier_addresses ----
    await queryRunner.query(
      `CREATE TABLE \`supplier_addresses\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`supplier_id\` varchar(36) NOT NULL, \`label\` enum ('BILLING', 'SHIPPING', 'OFFICE', 'HOME', 'WAREHOUSE', 'OTHER') NOT NULL DEFAULT 'OTHER', \`recipient_name\` varchar(200) NULL, \`address_line1\` varchar(255) NOT NULL, \`address_line2\` varchar(255) NULL, \`city\` varchar(100) NULL, \`state\` varchar(100) NULL, \`postal_code\` varchar(20) NULL, \`country\` varchar(100) NULL, \`phone\` varchar(50) NULL, \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_sa_supplier_id\` (\`supplier_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- customer_contacts ----
    await queryRunner.query(
      `CREATE TABLE \`customer_contacts\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`customer_id\` varchar(36) NOT NULL, \`name\` varchar(200) NOT NULL, \`job_title\` varchar(100) NULL, \`email\` varchar(255) NULL, \`phone\` varchar(50) NULL, \`mobile\` varchar(50) NULL, \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_cc_customer_id\` (\`customer_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- supplier_contacts ----
    await queryRunner.query(
      `CREATE TABLE \`supplier_contacts\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`supplier_id\` varchar(36) NOT NULL, \`name\` varchar(200) NOT NULL, \`job_title\` varchar(100) NULL, \`email\` varchar(255) NULL, \`phone\` varchar(50) NULL, \`mobile\` varchar(50) NULL, \`is_primary\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_sc_supplier_id\` (\`supplier_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`customer_groups\` ADD CONSTRAINT \`FK_cg_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_groups\` ADD CONSTRAINT \`FK_sg_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_terms\` ADD CONSTRAINT \`FK_pt_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`customers\` ADD CONSTRAINT \`FK_cust_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` ADD CONSTRAINT \`FK_cust_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` ADD CONSTRAINT \`FK_cust_group\` FOREIGN KEY (\`customer_group_id\`) REFERENCES \`customer_groups\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` ADD CONSTRAINT \`FK_cust_payment_term\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`payment_terms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_supp_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_supp_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_supp_group\` FOREIGN KEY (\`supplier_group_id\`) REFERENCES \`supplier_groups\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_supp_payment_term\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`payment_terms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`customer_addresses\` ADD CONSTRAINT \`FK_ca_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_addresses\` ADD CONSTRAINT \`FK_sa_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_contacts\` ADD CONSTRAINT \`FK_cc_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_contacts\` ADD CONSTRAINT \`FK_sc_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`supplier_contacts\` DROP FOREIGN KEY \`FK_sc_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_contacts\` DROP FOREIGN KEY \`FK_cc_customer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_addresses\` DROP FOREIGN KEY \`FK_sa_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_addresses\` DROP FOREIGN KEY \`FK_ca_customer\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_supp_payment_term\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_supp_group\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_supp_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_supp_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`customers\` DROP FOREIGN KEY \`FK_cust_payment_term\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` DROP FOREIGN KEY \`FK_cust_group\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` DROP FOREIGN KEY \`FK_cust_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customers\` DROP FOREIGN KEY \`FK_cust_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_terms\` DROP FOREIGN KEY \`FK_pt_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_groups\` DROP FOREIGN KEY \`FK_sg_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_groups\` DROP FOREIGN KEY \`FK_cg_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_sc_supplier_id\` ON \`supplier_contacts\``,
    );
    await queryRunner.query(`DROP TABLE \`supplier_contacts\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cc_customer_id\` ON \`customer_contacts\``,
    );
    await queryRunner.query(`DROP TABLE \`customer_contacts\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sa_supplier_id\` ON \`supplier_addresses\``,
    );
    await queryRunner.query(`DROP TABLE \`supplier_addresses\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_ca_customer_id\` ON \`customer_addresses\``,
    );
    await queryRunner.query(`DROP TABLE \`customer_addresses\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_supp_company_code\` ON \`suppliers\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_supp_email\` ON \`suppliers\``);
    await queryRunner.query(`DROP INDEX \`IDX_supp_phone\` ON \`suppliers\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_supp_company_id\` ON \`suppliers\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_supp_status\` ON \`suppliers\``);
    await queryRunner.query(`DROP TABLE \`suppliers\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cust_company_code\` ON \`customers\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_cust_email\` ON \`customers\``);
    await queryRunner.query(`DROP INDEX \`IDX_cust_phone\` ON \`customers\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_cust_company_id\` ON \`customers\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_cust_status\` ON \`customers\``);
    await queryRunner.query(`DROP TABLE \`customers\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pt_company_code\` ON \`payment_terms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pt_company_id\` ON \`payment_terms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pt_status\` ON \`payment_terms\``,
    );
    await queryRunner.query(`DROP TABLE \`payment_terms\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sg_company_code\` ON \`supplier_groups\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sg_company_id\` ON \`supplier_groups\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sg_status\` ON \`supplier_groups\``,
    );
    await queryRunner.query(`DROP TABLE \`supplier_groups\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cg_company_code\` ON \`customer_groups\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cg_company_id\` ON \`customer_groups\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cg_status\` ON \`customer_groups\``,
    );
    await queryRunner.query(`DROP TABLE \`customer_groups\``);
  }
}
