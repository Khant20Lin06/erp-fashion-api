// Applies only the additive shopping migrations, leaving unrelated pending
// migrations untouched. Run with ts-node/register/transpile-only from API root.
require('dotenv/config');
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { buildDataSourceOptions } = require('../src/database/typeorm.options');
const { AddSaleCreationKey1788810000000 } = require('../src/database/migrations/1788810000000-AddSaleCreationKey');
const { CreateShoppingState1788820000000 } = require('../src/database/migrations/1788820000000-CreateShoppingState');
const { AddShoppingEventPayload1788830000000 } = require('../src/database/migrations/1788830000000-AddShoppingEventPayload');
const db = new DataSource({
  ...buildDataSourceOptions({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, poolSize: 2, logging: false }),
  migrations: [AddSaleCreationKey1788810000000, CreateShoppingState1788820000000, AddShoppingEventPayload1788830000000],
});
(async () => {
  await db.initialize();
  try {
    const applied = await db.runMigrations({ transaction: 'each' });
    console.log(JSON.stringify({ database: process.env.DB_DATABASE, applied: applied.map(m => m.name) }));
  } finally { await db.destroy(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
