import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUomTablesAndVariantMappings1786750000000
  implements MigrationInterface
{
  name = 'AddUomTablesAndVariantMappings1786750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`uoms\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(20) NOT NULL, \`name\` varchar(100) NOT NULL, \`symbol\` varchar(20) NULL, \`category\` enum ('COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA') NOT NULL, \`decimal_places\` int NOT NULL DEFAULT '0', \`is_active\` tinyint NOT NULL DEFAULT 1, INDEX \`IDX_uom_is_active\` (\`is_active\`), UNIQUE INDEX \`IDX_uom_company_code\` (\`company_id\`, \`code\`), UNIQUE INDEX \`IDX_uom_company_name\` (\`company_id\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`uoms\` ADD CONSTRAINT \`FK_uom_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD \`base_uom_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD INDEX \`IDX_pv_base_uom_id\` (\`base_uom_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD CONSTRAINT \`FK_pv_base_uom\` FOREIGN KEY (\`base_uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE \`product_variant_uoms\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`variant_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`uom_id\` varchar(36) NOT NULL, \`conversion_factor_to_base\` decimal(14,4) NOT NULL, \`usage_type\` enum ('SALES', 'PURCHASE', 'BOTH') NOT NULL DEFAULT 'BOTH', \`barcode\` varchar(100) NULL, \`is_base\` tinyint NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, INDEX \`IDX_pvu_is_base\` (\`is_base\`), INDEX \`IDX_pvu_is_active\` (\`is_active\`), UNIQUE INDEX \`IDX_pvu_variant_uom\` (\`variant_id\`, \`uom_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` ADD CONSTRAINT \`FK_pvu_variant\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` ADD CONSTRAINT \`FK_pvu_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` ADD CONSTRAINT \`FK_pvu_uom\` FOREIGN KEY (\`uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD \`uom_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD INDEX \`IDX_pli_uom_id\` (\`uom_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP INDEX \`IDX_pli_list_variant_from\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD UNIQUE INDEX \`IDX_pli_list_variant_uom_from\` (\`price_list_id\`, \`product_variant_id\`, \`uom_id\`, \`valid_from\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD CONSTRAINT \`FK_pli_uom\` FOREIGN KEY (\`uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP FOREIGN KEY \`FK_pli_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP INDEX \`IDX_pli_list_variant_uom_from\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD UNIQUE INDEX \`IDX_pli_list_variant_from\` (\`price_list_id\`, \`product_variant_id\`, \`valid_from\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP INDEX \`IDX_pli_uom_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP COLUMN \`uom_id\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` DROP FOREIGN KEY \`FK_pvu_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` DROP FOREIGN KEY \`FK_pvu_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_uoms\` DROP FOREIGN KEY \`FK_pvu_variant\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvu_variant_uom\` ON \`product_variant_uoms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvu_is_active\` ON \`product_variant_uoms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvu_is_base\` ON \`product_variant_uoms\``,
    );
    await queryRunner.query(`DROP TABLE \`product_variant_uoms\``);

    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP FOREIGN KEY \`FK_pv_base_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP INDEX \`IDX_pv_base_uom_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP COLUMN \`base_uom_id\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`uoms\` DROP FOREIGN KEY \`FK_uom_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_uom_company_name\` ON \`uoms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_uom_company_code\` ON \`uoms\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_uom_is_active\` ON \`uoms\``,
    );
    await queryRunner.query(`DROP TABLE \`uoms\``);
  }
}
