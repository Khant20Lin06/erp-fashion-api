import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMasterDataTables1786503728069 implements MigrationInterface {
  name = 'CreateMasterDataTables1786503728069';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`parent_id\` varchar(36) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`sort_order\` int NOT NULL DEFAULT 0, INDEX \`IDX_cat_status\` (\`status\`), INDEX \`IDX_cat_company_id\` (\`company_id\`), INDEX \`IDX_cat_parent_id\` (\`parent_id\`), UNIQUE INDEX \`IDX_cat_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`brands\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`country\` varchar(100) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_brand_status\` (\`status\`), INDEX \`IDX_brand_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_brand_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`collections\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`description\` varchar(500) NULL, \`season\` enum ('SPRING_SUMMER', 'AUTUMN_WINTER', 'ALL_SEASON') NOT NULL, \`year\` smallint NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_coll_status\` (\`status\`), INDEX \`IDX_coll_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_coll_company_code\` (\`company_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`attribute_options\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` varchar(36) NOT NULL, \`kind\` enum ('COLOR', 'SIZE', 'STYLE', 'MATERIAL') NOT NULL, \`code\` varchar(50) NOT NULL, \`value\` varchar(200) NOT NULL, \`swatch\` varchar(20) NULL, \`sort_order\` int NOT NULL DEFAULT 0, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_attropt_kind\` (\`kind\`), INDEX \`IDX_attropt_status\` (\`status\`), INDEX \`IDX_attropt_company_id\` (\`company_id\`), UNIQUE INDEX \`IDX_attropt_company_kind_code\` (\`company_id\`, \`kind\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_cat_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_cat_parent\` FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`brands\` ADD CONSTRAINT \`FK_brand_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`collections\` ADD CONSTRAINT \`FK_coll_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`attribute_options\` ADD CONSTRAINT \`FK_attropt_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`attribute_options\` DROP FOREIGN KEY \`FK_attropt_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`collections\` DROP FOREIGN KEY \`FK_coll_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`brands\` DROP FOREIGN KEY \`FK_brand_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_cat_parent\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_cat_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_attropt_company_kind_code\` ON \`attribute_options\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_attropt_company_id\` ON \`attribute_options\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_attropt_status\` ON \`attribute_options\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_attropt_kind\` ON \`attribute_options\``,
    );
    await queryRunner.query(`DROP TABLE \`attribute_options\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_coll_company_code\` ON \`collections\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_coll_company_id\` ON \`collections\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_coll_status\` ON \`collections\``,
    );
    await queryRunner.query(`DROP TABLE \`collections\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_brand_company_code\` ON \`brands\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_brand_company_id\` ON \`brands\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_brand_status\` ON \`brands\``);
    await queryRunner.query(`DROP TABLE \`brands\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cat_company_code\` ON \`categories\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cat_parent_id\` ON \`categories\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cat_company_id\` ON \`categories\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_cat_status\` ON \`categories\``);
    await queryRunner.query(`DROP TABLE \`categories\``);
  }
}
