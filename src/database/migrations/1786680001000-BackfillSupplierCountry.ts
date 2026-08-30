import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillSupplierCountry1786680001000
  implements MigrationInterface
{
  name = 'BackfillSupplierCountry1786680001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`suppliers\`
      SET \`country\` = CASE
        WHEN \`email\` LIKE '%.th' THEN 'Thailand'
        WHEN \`email\` LIKE '%.vn' THEN 'Vietnam'
        WHEN \`email\` LIKE '%.bd' THEN 'Bangladesh'
        WHEN \`email\` LIKE '%.id' THEN 'Indonesia'
        WHEN \`email\` LIKE '%.tr' THEN 'Turkey'
        WHEN \`email\` LIKE '%.it' THEN 'Italy'
        WHEN \`email\` LIKE '%.cn' THEN 'China'
        ELSE 'Myanmar'
      END
      WHERE (\`country\` IS NULL OR \`country\` = '')
        AND \`email\` IS NOT NULL
        AND \`email\` <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`suppliers\`
      SET \`country\` = NULL
      WHERE \`country\` IN (
        'Thailand',
        'Vietnam',
        'Bangladesh',
        'Indonesia',
        'Turkey',
        'Italy',
        'China',
        'Myanmar'
      )
        AND \`email\` IS NOT NULL
        AND \`email\` <> ''
    `);
  }
}
