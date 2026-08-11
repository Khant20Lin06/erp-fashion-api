import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRbacTables1786423236796 implements MigrationInterface {
  name = 'CreateRbacTables1786423236796';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`roles\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(100) NOT NULL, \`description\` varchar(500) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`is_system_role\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_14958a120176d4e1e8be423977\` (\`status\`), UNIQUE INDEX \`IDX_f6d54f95c31b73fb1bdd8e91d0\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`permissions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`resource\` varchar(100) NOT NULL, \`action\` varchar(50) NOT NULL, \`code\` varchar(150) NOT NULL, \`description\` varchar(500) NULL, INDEX \`IDX_89456a09b598ce8915c702c528\` (\`resource\`), UNIQUE INDEX \`IDX_8dad765629e83229da6feda1c1\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`role_permissions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`role_id\` varchar(36) NOT NULL, \`permission_id\` varchar(36) NOT NULL, UNIQUE INDEX \`IDX_25d24010f53bb80b78e412c965\` (\`role_id\`, \`permission_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_roles\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`role_id\` varchar(36) NOT NULL, INDEX \`IDX_b23c65e50a758245a33ee35fda\` (\`role_id\`), UNIQUE INDEX \`IDX_23ed6f04fe43066df08379fd03\` (\`user_id\`, \`role_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`role_resource_scopes\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`role_id\` varchar(36) NOT NULL, \`resource\` varchar(100) NOT NULL, \`scope\` enum ('OWN', 'ACCOUNT', 'TEAM', 'BRANCH', 'WAREHOUSE', 'COMPANY', 'ORGANIZATION', 'ALL') NOT NULL, \`scope_value\` varchar(150) NULL, UNIQUE INDEX \`IDX_680f7048258a12b82ea4bc0813\` (\`role_id\`, \`resource\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_178199805b901ccd220ab7740ec\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_17022daf3f885f7d35423e9971e\` FOREIGN KEY (\`permission_id\`) REFERENCES \`permissions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_87b8888186ca9769c960e926870\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_b23c65e50a758245a33ee35fda1\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_resource_scopes\` ADD CONSTRAINT \`FK_63702245ccbcf6c6175901354c6\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`role_resource_scopes\` DROP FOREIGN KEY \`FK_63702245ccbcf6c6175901354c6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_b23c65e50a758245a33ee35fda1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_87b8888186ca9769c960e926870\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_17022daf3f885f7d35423e9971e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_178199805b901ccd220ab7740ec\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_680f7048258a12b82ea4bc0813\` ON \`role_resource_scopes\``,
    );
    await queryRunner.query(`DROP TABLE \`role_resource_scopes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_23ed6f04fe43066df08379fd03\` ON \`user_roles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_b23c65e50a758245a33ee35fda\` ON \`user_roles\``,
    );
    await queryRunner.query(`DROP TABLE \`user_roles\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_25d24010f53bb80b78e412c965\` ON \`role_permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`role_permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_8dad765629e83229da6feda1c1\` ON \`permissions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_89456a09b598ce8915c702c528\` ON \`permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_f6d54f95c31b73fb1bdd8e91d0\` ON \`roles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_14958a120176d4e1e8be423977\` ON \`roles\``,
    );
    await queryRunner.query(`DROP TABLE \`roles\``);
  }
}
