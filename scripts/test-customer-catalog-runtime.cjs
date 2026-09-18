/* Read-only runtime smoke against the configured ERP database. No orders,
 * customers, sessions, credentials or stock are modified or printed. */
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { buildDataSourceOptions } = require('../src/database/typeorm.options');
const { CustomerCatalogService } = require('../src/modules/customer-portal/services/customer-catalog.service');
const { eligibleVariants } = require('../src/modules/customer-portal/shopping/discovery');
const companyId = process.argv[2];
assert.match(companyId || '', /^[a-f0-9-]{36}$/i, 'Pass the authorized company UUID');
const db = new DataSource(buildDataSourceOptions({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, poolSize: 2, logging: false }));
(async () => {
  await db.initialize();
  try {
    const catalog = new CustomerCatalogService(db);
    for (const query of [{ query: 'pants' }, { query: 'pants', size: 'M' }]) {
      const found = await catalog.discover(companyId, query);
      assert.ok(found.products.length <= 3);
      for (const p of found.products) {
        assert.ok(eligibleVariants(p, query).length > 0);
        assert.equal(JSON.stringify(p).includes('costPrice'), false);
      }
      console.log('PASS: live catalog query', JSON.stringify(query), 'cards', found.products.length);
    }
    for (const filters of [{}, { query: 'pants', size: 'M' }]) {
      const popular = await catalog.popular(companyId, filters);
      assert.ok(popular.products.length <= 3);
      for (const p of popular.products) {
        assert.ok(eligibleVariants(p, filters).length > 0);
        assert.equal(Object.hasOwn(p, 'revenue'), false);
      }
      console.log('PASS: live confirmed-sales ranking SQL', JSON.stringify(filters), 'cards', popular.products.length);
    }
  } finally { await db.destroy(); }
})().catch(error => { console.error('Catalog runtime smoke failed:', error.message); process.exitCode = 1; });
