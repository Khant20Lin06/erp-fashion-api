import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseInvoicesAndInvoiceAllocations1786710000000
  implements MigrationInterface
{
  name = 'CreatePurchaseInvoicesAndInvoiceAllocations1786710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`purchase_invoices\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`invoice_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`supplier_id\` char(36) NOT NULL, \`purchase_order_id\` char(36) NOT NULL, \`invoice_date\` timestamp NOT NULL, \`due_date\` timestamp NOT NULL, \`subtotal\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`grand_total\` decimal(14,2) NOT NULL, \`paid_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`balance_amount\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_pi_company_invoice_number\` (\`company_id\`, \`invoice_number\`), UNIQUE INDEX \`IDX_pi_company_purchase_order\` (\`company_id\`, \`purchase_order_id\`), INDEX \`IDX_pi_company_id\` (\`company_id\`), INDEX \`IDX_pi_supplier_id\` (\`supplier_id\`), INDEX \`IDX_pi_purchase_order_id\` (\`purchase_order_id\`), INDEX \`IDX_pi_invoice_date\` (\`invoice_date\`), INDEX \`IDX_pi_due_date\` (\`due_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD CONSTRAINT \`FK_pi_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD CONSTRAINT \`FK_pi_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD CONSTRAINT \`FK_pi_purchase_order\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD CONSTRAINT \`FK_pi_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD CONSTRAINT \`FK_pi_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` MODIFY COLUMN \`reference_type\` enum ('SALE', 'PURCHASE_ORDER', 'PURCHASE_INVOICE', 'SALE_RETURN') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` MODIFY COLUMN \`reference_type\` enum ('SALE', 'PURCHASE_ORDER', 'SALE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP FOREIGN KEY \`FK_pi_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP FOREIGN KEY \`FK_pi_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP FOREIGN KEY \`FK_pi_purchase_order\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP FOREIGN KEY \`FK_pi_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP FOREIGN KEY \`FK_pi_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_due_date\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_invoice_date\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_purchase_order_id\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_supplier_id\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_company_id\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_company_purchase_order\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_company_invoice_number\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_invoices\``);
  }
}
