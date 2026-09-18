/* Run: node -r ts-node/register/transpile-only scripts/test-shopping-concurrency.cjs
 * Uses ONLY the explicitly provisioned disposable database below. Catalog and
 * customer lookups are controlled fixtures; transactions, SQL locks, sale/item
 * inserts, unique constraints, state persistence and wrapper recovery are real.
 */
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { DataSource } = require('typeorm');
const { buildDataSourceOptions } = require('../src/database/typeorm.options');
const { CreateShoppingState1788820000000 } = require('../src/database/migrations/1788820000000-CreateShoppingState');
const { AddSaleCreationKey1788810000000 } = require('../src/database/migrations/1788810000000-AddSaleCreationKey');
const { AddShoppingEventPayload1788830000000 } = require('../src/database/migrations/1788830000000-AddShoppingEventPayload');
const { ShoppingStateService } = require('../src/modules/customer-portal/services/shopping-state.service');
const { ShoppingAssistantService } = require('../src/modules/customer-portal/services/shopping-assistant.service');
const { SalesService } = require('../src/modules/sales/services/sales.service');
const { Sale } = require('../src/modules/sales/entities/sale.entity');
const { OnlineOrder } = require('../src/modules/online-orders/entities/online-order.entity');
const { OnlineOrdersService } = require('../src/modules/online-orders/services/online-orders.service');
const { OnlineOrderSource } = require('../src/modules/online-orders/entities/online-order-source.enum');
const { TransactionService } = require('../src/core/transaction/transaction.service');

const TEST_DATABASE = 'fashion_shopping_concurrency_test';
const tables = ['shopping_events', 'shopping_sessions', 'online_orders', 'sale_items', 'sales', 'company_sale_counters'];
const hash = value => createHash('sha256').update(value).digest('hex');
const db = new DataSource(buildDataSourceOptions({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: TEST_DATABASE, poolSize: 12, logging: false }));
const update = (id, user = 42, text = 'shirt') => ({ update_id: id, message: { chat: { id: user, type: 'private' }, from: { id: user }, text } });

(async () => {
  await db.initialize();
  try {
    assert.equal((await db.query('SELECT DATABASE() AS name'))[0].name, TEST_DATABASE);
    // This script owns these disposable tables; never accepts a target name.
    for (const table of tables) await db.query(`DROP TABLE IF EXISTS \`${table}\``);
    const schema = await db.driver.createSchemaBuilder().log();
    for (const table of tables.slice(2)) {
      const sql = schema.upQueries.find(q => q.query.startsWith(`CREATE TABLE \`${table}\``));
      assert.ok(sql, `Missing test schema for ${table}`);
      await db.query(sql.query);
    }
    const runner = db.createQueryRunner();
    try {
      // Exercise actual additive migration from the pre-feature sale schema.
      await new AddSaleCreationKey1788810000000().down(runner);
      await new AddSaleCreationKey1788810000000().up(runner);
      await new CreateShoppingState1788820000000().up(runner);
      await new AddShoppingEventPayload1788830000000().up(runner);
    } finally { await runner.release(); }

    const companyId = randomUUID(), bot = randomUUID();
    const state = new ShoppingStateService(db);
    const initial = { companyId, update: update(1) };
    const same = await Promise.all(Array.from({ length: 20 }, () => state.step(bot, initial)));
    assert.equal(new Set(same.map(v => v.operationToken)).size, 1);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM shopping_events'))[0].n), 1);
    const competing = await Promise.all(Array.from({ length: 20 }, (_, i) => state.step(bot, { companyId, update: update(i + 2) })));
    assert.ok(competing.every(v => v.status === 'busy'));
    const different = await Promise.all(Array.from({ length: 50 }, (_, i) => state.step(bot, { companyId, update: update(100 + i, 1000 + i) })));
    assert.ok(different.every(v => v.status === 'ready'));
    const restart = await new ShoppingStateService(db).step(bot, initial);
    assert.equal(restart.operationToken, same[0].operationToken);
    const continuation = { ...initial, operationToken: restart.operationToken, response: { statusCode: 200, body: { products: [{ id: randomUUID(), name: 'Shirt', currency: 'MMK', variants: [] }] } } };
    const completed = await Promise.all(Array.from({ length: 20 }, () => state.step(bot, continuation)));
    assert.ok(completed.every(v => v.context.messages.length === 2)); // product plus discovery controls
    assert.equal((await state.step(bot, initial)).context.messages.length, 0);
    assert.equal((await state.step(bot, { companyId, update: update(2) })).status, 'ready');
    assert.equal((await state.step(randomUUID(), initial)).status, 'ready');
    assert.equal((await state.step(bot, { ...initial, companyId: randomUUID() })).status, 'ready');
    await assert.rejects(state.step(bot, { companyId, update: update(1, 42, 'changed') }));
    const product = { id: randomUUID(), name: 'Test shirt', currency: 'MMK', variants: [{ id: randomUUID(), sku: 'TEST-SKU', unitPrice: '100.00', quantityAvailable: 10, attributes: [] }] };
    const completeStep = async (u, body) => {
      const start = await state.step(bot, { companyId, update: u });
      return state.step(bot, { companyId, update: u, operationToken: start.operationToken, response: { statusCode: 200, body } });
    };
    await completeStep(update(500, 77), { products: [product] });
    await completeStep({ update_id: 501, callback_query: { id: 'buy-77', from: { id: 77 }, message: { chat: { id: 77, type: 'private' } }, data: `shop:buy:${product.id}` } }, product);
    const quantityUpdate = update(502, 77, '၂');
    const quantityStarts = await Promise.all(Array.from({ length: 20 }, () => state.step(bot, { companyId, update: quantityUpdate })));
    await Promise.all(quantityStarts.map(start => state.step(bot, { companyId, update: quantityUpdate, operationToken: start.operationToken, response: { statusCode: 200, body: product } })));
    const stored = (await db.query('SELECT state FROM shopping_sessions WHERE company_id = ? AND bot_user_id = ? AND telegram_user_id = ?', [companyId, bot, '77']))[0].state;
    const cart = (typeof stored === 'string' ? JSON.parse(stored) : stored).shoppers['77'].cart;
    assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 2); assert.equal(cart[0].sku, 'TEST-SKU');
    console.log('PASS: 50 independent customers; 20 duplicate starts/completions; busy isolation; restart; tenant/bot isolation; changed-event rejection');
    console.log('PASS: actual browse -> buy -> Burmese quantity persists one cart line after 20 duplicate quantity completions');

    const agentInput = { companyId, update: update(900, 88, 'something soft please'), assistantEnabled: true };
    const agentStart = await state.step(bot, agentInput);
    assert.equal(agentStart.context.op, 'assistant');
    const toolInput = { companyId, update: agentInput.update, operationToken: agentStart.operationToken, tool: 'search' };
    const calls = await Promise.allSettled(Array.from({ length: 12 }, () => state.authorizeAgentTool(bot, toolInput)));
    assert.equal(calls.filter(v => v.status === 'fulfilled').length, 8);
    await assert.rejects(state.authorizeAgentTool(randomUUID(), toolInput));
    const expiredContext = { ...agentStart.context, assistantStartedAt: Date.now() - 180001 };
    await db.query('UPDATE shopping_events SET context = ? WHERE session_id = ? AND event_id = ?', [JSON.stringify(expiredContext), hash(JSON.stringify([companyId, bot, '88'])), '900']);
    const agentRecovered = await state.step(bot, { companyId, update: update(901, 88, '/cart') });
    assert.equal(agentRecovered.status, 'ready');
    await assert.rejects(state.step(bot, { ...agentInput, operationToken: agentStart.operationToken, response: { statusCode: 200, body: { action: 'buy', productId: product.id } } }));
    const replay = await state.step(bot, agentInput);
    assert.equal(replay.context.messages.length, 0);
    console.log('PASS: assistant tool limit under 12 concurrent calls; bot isolation; expired model lease recovery; late response rejected');

    const teamInput = { companyId, update: update(910, 89, 'help choose something soft'), assistantEnabled: true };
    const teamStart = await state.step(bot, teamInput);
    const teamRequest = { companyId, update: teamInput.update, operationToken: teamStart.operationToken };
    let releaseTeam, startedTeam;
    const teamStarted = new Promise(resolve => { startedTeam = resolve; });
    let modelCalls = 0;
    const team = { run: async () => {
      modelCalls++; startedTeam();
      return new Promise(resolve => { releaseTeam = resolve; });
    } };
    const assistant = new ShoppingAssistantService(db, team, {});
    const owner = assistant.run(bot, teamRequest);
    await teamStarted;
    const duplicates = await Promise.all(Array.from({length: 20}, () => assistant.run(bot, teamRequest)));
    assert.ok(duplicates.every(result => result.status === 'busy'));
    assert.equal(modelCalls, 1);
    // A different customer's state remains available while model IO is pending.
    assert.equal((await state.step(bot, { companyId, update: update(911, 90) })).status, 'ready');
    releaseTeam({ action: { action: 'reply', text: 'What style do you prefer?' }, degraded: false, trace: { modelCalls: 1 } });
    const teamResult = await owner;
    const replayTeam = new ShoppingAssistantService(db, {run: () => { throw new Error('cached result must survive restart'); }}, {});
    assert.deepEqual(await replayTeam.run(bot, teamRequest), teamResult);
    await assert.rejects(replayTeam.run(randomUUID(), teamRequest));
    await state.step(bot, { ...teamInput, operationToken: teamStart.operationToken, response: {statusCode: 200, body: teamResult.action} });
    await assert.rejects(replayTeam.run(bot, teamRequest));
    console.log('PASS: real SQL assistant claim; 20 duplicate model calls suppressed; unrelated customer progresses; restart cache; bot isolation; completed result rejected');

    const activeCustomer = { id: randomUUID(), companyId, status: 'ACTIVE' };
    const variantId = randomUUID();
    const sales = new SalesService(db.getRepository(Sale), new TransactionService(db),
      { findActiveByIdOrNull: async () => ({ id: companyId, status: 'ACTIVE' }) }, {}, {},
      { findByIdInCompany: async () => activeCustomer },
      { findByIdInCompany: async () => ({ id: variantId, status: 'ACTIVE' }) }, {}, {}, {}, {}, {});
    // Pricing is covered by the regular suite; isolate persistence here.
    sales.resolveDefaultPriceListId = async () => null;
    sales.resolveItemPricing = async item => ({ variant: { product: { name: 'Fixture shirt' }, sku: 'TEST-SKU' }, unitPrice: '100.00', uomId: null, uomCode: null, uomName: null, baseQuantity: item.quantity, conversionFactorToBase: '1.0000' });
    const dto = { customerId: activeCustomer.id, currency: 'MMK', items: [{ productVariantId: variantId, quantity: 2 }] };
    const creation = { key: hash('checkout'), hash: hash('same request') };
    const orders = await Promise.all(Array.from({ length: 20 }, () => sales.create(companyId, bot, dto, creation)));
    assert.equal(new Set(orders.map(v => v.id)).size, 1);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM sales'))[0].n), 1);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM sale_items'))[0].n), 1);
    await assert.rejects(sales.create(companyId, bot, dto, { ...creation, hash: hash('changed') }));
    const wrappers = new OnlineOrdersService(db.getRepository(OnlineOrder));
    const wrapperInput = { companyId, saleId: orders[0].id, customerId: activeCustomer.id, source: OnlineOrderSource.Telegram, telegramUserId: '42', telegramUsername: null, deliveryAddress: 'Test address' };
    const recovered = await Promise.all(Array.from({ length: 20 }, () => wrappers.createForSale(wrapperInput)));
    assert.equal(new Set(recovered.map(v => v.id)).size, 1);
    await assert.rejects(wrappers.createForSale({ ...wrapperInput, deliveryAddress: 'changed' }));
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM online_orders'))[0].n), 1);
    console.log('PASS: 20 concurrent checkout retries => 1 Sale + 1 SaleItem + 1 OnlineOrder; changed payload rejected; actual migrations executed');
  } finally { await db.destroy(); }
})().catch(error => { console.error(error.code === 'ERR_ASSERTION' ? error.stack : error.code || error.message); process.exitCode = 1; });
