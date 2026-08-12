import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductVariantPricingTables1786519479223 implements MigrationInterface {
  name = 'CreateProductVariantPricingTables1786519479223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`products\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(1000) NULL, \`category_id\` varchar(36) NOT NULL, \`brand_id\` varchar(36) NOT NULL, \`collection_id\` varchar(36) NULL, \`product_type\` enum ('SIMPLE', 'VARIANT') NOT NULL DEFAULT 'SIMPLE', \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_prod_status\` (\`status\`), INDEX \`IDX_prod_company_id\` (\`company_id\`), INDEX \`IDX_prod_category_id\` (\`category_id\`), INDEX \`IDX_prod_brand_id\` (\`brand_id\`), INDEX \`IDX_prod_collection_id\` (\`collection_id\`), UNIQUE INDEX \`IDX_prod_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`product_variants\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`product_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`sku\` varchar(100) NOT NULL, \`combination_key\` varchar(300) NOT NULL, \`cost_price\` decimal(12,2) NOT NULL, \`selling_price\` decimal(12,2) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_pv_status\` (\`status\`), INDEX \`IDX_pv_product_id\` (\`product_id\`), INDEX \`IDX_pv_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_pv_company_sku\` (\`company_id\`, \`sku\`), UNIQUE INDEX \`IDX_pv_product_combination\` (\`product_id\`, \`combination_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`product_variant_attributes\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`variant_id\` varchar(36) NOT NULL, \`option_id\` varchar(36) NOT NULL, \`kind\` enum ('COLOR', 'SIZE', 'STYLE', 'MATERIAL') NOT NULL, INDEX \`IDX_pva_variant_id\` (\`variant_id\`), INDEX \`IDX_pva_option_id\` (\`option_id\`), UNIQUE INDEX \`IDX_pva_variant_kind\` (\`variant_id\`, \`kind\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`product_variant_barcodes\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`variant_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`barcode\` varchar(100) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_pvb_status\` (\`status\`), INDEX \`IDX_pvb_variant_id\` (\`variant_id\`), INDEX \`IDX_pvb_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_pvb_company_barcode\` (\`company_id\`, \`barcode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`price_lists\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`currency\` char(3) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_pl_status\` (\`status\`), INDEX \`IDX_pl_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_pl_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`price_list_items\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`price_list_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`price\` decimal(12,2) NOT NULL, \`valid_from\` timestamp NOT NULL, \`valid_to\` timestamp NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_pli_status\` (\`status\`), INDEX \`IDX_pli_price_list_id\` (\`price_list_id\`), INDEX \`IDX_pli_product_variant_id\` (\`product_variant_id\`), INDEX \`IDX_pli_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_pli_list_variant_from\` (\`price_list_id\`, \`product_variant_id\`, \`valid_from\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_prod_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_prod_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_prod_brand\` FOREIGN KEY (\`brand_id\`) REFERENCES \`brands\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_prod_collection\` FOREIGN KEY (\`collection_id\`) REFERENCES \`collections\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD CONSTRAINT \`FK_pv_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` ADD CONSTRAINT \`FK_pv_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variant_attributes\` ADD CONSTRAINT \`FK_pva_variant\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_attributes\` ADD CONSTRAINT \`FK_pva_option\` FOREIGN KEY (\`option_id\`) REFERENCES \`attribute_options\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variant_barcodes\` ADD CONSTRAINT \`FK_pvb_variant\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_barcodes\` ADD CONSTRAINT \`FK_pvb_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`price_lists\` ADD CONSTRAINT \`FK_pl_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD CONSTRAINT \`FK_pli_price_list\` FOREIGN KEY (\`price_list_id\`) REFERENCES \`price_lists\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD CONSTRAINT \`FK_pli_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` ADD CONSTRAINT \`FK_pli_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP FOREIGN KEY \`FK_pli_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP FOREIGN KEY \`FK_pli_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`price_list_items\` DROP FOREIGN KEY \`FK_pli_price_list\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`price_lists\` DROP FOREIGN KEY \`FK_pl_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variant_barcodes\` DROP FOREIGN KEY \`FK_pvb_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_barcodes\` DROP FOREIGN KEY \`FK_pvb_variant\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variant_attributes\` DROP FOREIGN KEY \`FK_pva_option\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variant_attributes\` DROP FOREIGN KEY \`FK_pva_variant\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP FOREIGN KEY \`FK_pv_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_variants\` DROP FOREIGN KEY \`FK_pv_product\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_prod_collection\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_prod_brand\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_prod_category\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_prod_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_pli_list_variant_from\` ON \`price_list_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pli_company_id\` ON \`price_list_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pli_product_variant_id\` ON \`price_list_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pli_price_list_id\` ON \`price_list_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pli_status\` ON \`price_list_items\``,
    );
    await queryRunner.query(`DROP TABLE \`price_list_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pl_company_code\` ON \`price_lists\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pl_company_id\` ON \`price_lists\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_pl_status\` ON \`price_lists\``);
    await queryRunner.query(`DROP TABLE \`price_lists\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pvb_company_barcode\` ON \`product_variant_barcodes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvb_company_id\` ON \`product_variant_barcodes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvb_variant_id\` ON \`product_variant_barcodes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pvb_status\` ON \`product_variant_barcodes\``,
    );
    await queryRunner.query(`DROP TABLE \`product_variant_barcodes\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pva_variant_kind\` ON \`product_variant_attributes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pva_option_id\` ON \`product_variant_attributes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pva_variant_id\` ON \`product_variant_attributes\``,
    );
    await queryRunner.query(`DROP TABLE \`product_variant_attributes\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pv_product_combination\` ON \`product_variants\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pv_company_sku\` ON \`product_variants\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pv_company_id\` ON \`product_variants\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pv_product_id\` ON \`product_variants\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pv_status\` ON \`product_variants\``,
    );
    await queryRunner.query(`DROP TABLE \`product_variants\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_prod_company_code\` ON \`products\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prod_collection_id\` ON \`products\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_prod_brand_id\` ON \`products\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_prod_category_id\` ON \`products\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prod_company_id\` ON \`products\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_prod_status\` ON \`products\``);
    await queryRunner.query(`DROP TABLE \`products\``);
  }
}
