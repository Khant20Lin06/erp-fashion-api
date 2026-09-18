'use strict';

// Pure engine executed by the backend's durable shopping state service.
// n8n transports requests and rendered messages; this module does no I/O.
const discovery = require('./discovery');
const conversation = require('./conversation');
const assistant = require('./assistant');
const SESSION_TTL = 2 * 60 * 60 * 1000;
const SELECTION_TTL = 20 * 60 * 1000;
const MAX_USERS = 500;
const MAX_LINES = 20;
const MAX_QUANTITY = 999;
const kinds = ['COLOR', 'SIZE', 'STYLE', 'MATERIAL'];
const copy = value => JSON.parse(JSON.stringify(value));
const btn = (text, data) => ({ text, data });
const rows = buttons => Array.from({ length: Math.ceil(buttons.length / 3) }, (_, i) => buttons.slice(i * 3, i * 3 + 3));
const digits = text => text.replace(/[၀-၉]/g, c => String(c.charCodeAt(0) - 0x1040));
function quantity(text) {
  const match = digits(text).trim().match(/^(\d{1,3})\s*(?:ထည်|ခု|စုံ|件|pcs?|pieces?)?$/i);
  const n = match ? Number(match[1]) : 0;
  return Number.isInteger(n) && n > 0 && n <= MAX_QUANTITY ? n : null;
}
function cents(value) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))) throw new Error('Invalid catalog price');
  const [whole, fraction = ''] = String(value).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
const money = value => (value / 100).toFixed(2);
const short = (text, limit = 40) => String(text).length > limit ? String(text).slice(0, limit - 1) + '…' : String(text);
function nonce(s, now) { s.seq = (s.seq || 0) + 1; return now.toString(36) + '-' + s.seq.toString(36); }
function say(c, text, buttons = [], photo = null) {
  c.request = null;
  c.messages.push({ text: String(text).slice(0, photo ? 1000 : 3900), buttons, photo });
  return c;
}
function request(c, op, method, path, query = {}, body = {}) {
  c.op = op; c.request = { method, path, query, body }; c.messages = []; return c;
}
function detail(c, id, op) { return request(c, op, 'GET', '/customer-portal/catalog/' + encodeURIComponent(id), { companyId: c.companyId }); }
function current(store, c) { return store.shoppers?.[c.userId]; }
function catalogCard(c, p, detailed = false) {
  const available = p.variants.filter(v => v.quantityAvailable > 0);
  const list = available.length ? available : p.variants;
  const prices = list.map(v => cents(v.unitPrice));
  const price = prices.length ? money(Math.min(...prices)) + (Math.max(...prices) !== Math.min(...prices) ? ' – ' + money(Math.max(...prices)) : '') : '—';
  let text = `${p.name}\n${price} ${p.currency}\n${available.length ? 'လက်ကျန်ရှိပါတယ်' : 'လက်ရှိ stock ကုန်နေပါတယ်'}`;

  const colors = [...new Set(list.flatMap(v => (v.attributes || []).filter(a => a.kind === 'COLOR').map(a => a.value)))];
  const sizes = [...new Set(list.flatMap(v => (v.attributes || []).filter(a => a.kind === 'SIZE').map(a => a.value)))];
  if (colors.length) text += `\nရနိုင်သော အရောင်: ${colors.join(', ')}`;
  if (sizes.length) text += `\nရနိုင်သော Size: ${sizes.join(', ')}`;

  if (p.reason) text += '\n' + p.reason;
  if (detailed) text += '\n' + (p.description || 'အသေးစိတ်ဖော်ပြချက် မထည့်ရသေးပါ။');
  const buttons = [btn('ကြည့်မယ်', `shop:view:${p.id}`)];
  if (available.length) buttons.push(btn('ယူမယ်', `shop:buy:${p.id}`));
  return say(c, text, [buttons], p.imageUrl || null);
}
function renderWelcomeMenu(c) {
  return say(c, '✨ Fashion ERP Store မှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ခင်ဗျာ! ✨\n\nလူကြီးမင်း စိတ်ကြိုက် ဖက်ရှင်အဝတ်အထည်များကို အောက်ပါ ခလုတ်များနှိပ်၍ အလွယ်တကူ ရှာဖွေဝယ်ယူနိုင်ပါသည်ခင်ဗျာ။\n\n💡 လိုချင်သော ပစ္စည်းအမည်၊ အရောင်၊ Size များကိုလည်း စာရိုက်၍ တိုက်ရိုက် ရှာဖွေနိုင်ပါသည် (ဥပမာ — "ဂျင်းဂျာကင်", "အနက်ရောင် တီရှပ်")။', [
    [btn('🛍️ ပစ္စည်းအားလုံး ကြည့်မည်', 'menu:browse'), btn('🏷️ အမျိုးအစားများ', 'menu:categories')],
    [btn('🛒 ဈေးဝယ်ခြင်း (Cart)', 'menu:cart'), btn('📦 အော်ဒါအခြေအနေ', 'menu:orders')],
    [btn('💬 ဆိုင်သို့ မေးမြန်းမည် / အကူအညီ', 'menu:help')]
  ]);
}
function renderCategoriesMenu(c) {
  return say(c, '🏷️ ကြည့်ရှုလိုသော ဖက်ရှင်အမျိုးအစားကို ရွေးချယ်ပေးပါခင်ဗျာ —', [
    [btn('🧥 အပေါ်ထပ် / ဂျာကင်', 'menu:cat:jacket'), btn('👕 တီရှပ် / ရှပ်အင်္ကျီ', 'menu:cat:shirt')],
    [btn('👗 ဂါဝန် / စကတ်', 'menu:cat:dress'), btn('👖 ဘောင်းဘီ', 'menu:cat:pants')],
    [btn('👟 ဖိနပ်နှင့် အသုံးအဆောင်', 'menu:cat:shoes')],
    [btn('🔙 ပင်မမီနူးသို့', 'menu:main')]
  ]);
}
function renderCart(s, c, now, prefix = '') {
  s.stage = 'cart'; s.cartToken = nonce(s, now);
  if (!s.cart.length) return say(c, '🛒 လူကြီးမင်း၏ Cart ထဲတွင် ပစ္စည်းမရှိသေးပါခင်ဗျာ။\n\nအောက်ပါခလုတ်ကို နှိပ်၍ ပစ္စည်းများ ကြည့်ရှုဝယ်ယူနိုင်ပါသည် —', [
    [btn('🛍️ ပစ္စည်းအားလုံး ကြည့်မည်', 'menu:browse'), btn('🏷️ အမျိုးအစားများ', 'menu:categories')],
    [btn('🔙 ပင်မမီနူးသို့', 'menu:main')]
  ]);
  const lines = s.cart.map((v, i) => `${i + 1}. ${short(v.name)} (${short(v.label || v.sku)}) × ${v.quantity} — ${money(cents(v.unitPrice) * v.quantity)}`);
  const total = s.cart.reduce((n, v) => n + cents(v.unitPrice) * v.quantity, 0);
  return say(c, `${prefix}${lines.join('\n')}\nစုစုပေါင်း: ${money(total)} ${s.currency}`, [[
    btn('ထပ်ရွေးမယ်', `cart:more:${s.cartToken}`), btn('အတည်ပြုမယ် / Checkout', `cart:checkout:${s.cartToken}`),
  ], [btn('Cart ဖျက်မယ်', `cart:cancel:${s.cartToken}`)]]);
}
function checkout(s, c, now, prefix = '') {
  s.cartToken = nonce(s, now);
  if (!s.address) { s.stage = 'address'; return say(c, 'ပို့ပေးရမယ့် လိပ်စာအပြည့်အစုံ ရေးပေးပါ။'); }
  s.stage = 'checkout';
  const lines = s.cart.map(v => `${short(v.name)} (${short(v.label || v.sku)}) × ${v.quantity} — ${money(cents(v.unitPrice) * v.quantity)}`);
  const total = s.cart.reduce((n, v) => n + cents(v.unitPrice) * v.quantity, 0);
  return say(c, `${prefix}${lines.join('\n')}\nစုစုပေါင်း: ${money(total)} ${s.currency}\nအမည်: ${s.name}\nဖုန်း: ${s.phone}\nလိပ်စာ: ${s.address}\nအချက်အလက်မှန်ရင် Submit Order နှိပ်ပါ။`, [
    [btn('အမည်ပြင်မယ်', `cart:name:${s.cartToken}`), btn('ဖုန်းပြင်မယ်', `cart:phone:${s.cartToken}`)],
    [btn('လိပ်စာပြင်မယ်', `cart:address:${s.cartToken}`)],
    [btn('Submit Order', `cart:submit:${s.cartToken}`), btn('Cart ဖျက်မယ်', `cart:cancel:${s.cartToken}`)],
  ]);
}
function options(s, c, p, now, inspectKind = null) {
  const selection = s.selection;
  const matches = discovery.eligibleVariants(p, selection.filters, true).filter(v => Object.values(selection.picks).every(id => v.attributes.some(a => a.id === id)));
  if (!matches.length) { s.selection = null; s.stage = null; return say(c, 'ရွေးထားတဲ့ size/ဈေးနှုန်းနဲ့ ကိုက်တဲ့ option က လက်ကျန်မရှိတော့ပါ။ ပစ္စည်းကို ပြန်ရွေးပါ။'); }
  for (const kind of inspectKind ? [inspectKind] : kinds) {
    if (selection.picks[kind]) continue;
    const choices = [...new Map(matches.flatMap(v => v.attributes.filter(a => a.kind === kind)).map(a => [a.id, a])).values()];
    if (!choices.length) continue;
    if (choices.length > 30) return say(c, 'ရွေးချယ်စရာများနေပါသည်။ ဝန်ထမ်းထံ ဆက်သွယ်ပေးပါ။');
    selection.kind = kind; selection.choices = choices; selection.token = nonce(s, now); s.stage = 'option';
    const prompt = { COLOR: 'ဘယ်အရောင်ယူမလဲ?', SIZE: 'ဘယ် size ယူမလဲ?', STYLE: 'ဘယ် style ယူမလဲ?', MATERIAL: 'ဘယ်အသားယူမလဲ?' }[kind];
    const pickedNames = Object.values(selection.picks).map(id => p.variants.flatMap(v => v.attributes).find(a => a.id === id)?.value).filter(Boolean);
    const title = pickedNames.length ? `${p.name} (${pickedNames.join(', ')})` : p.name;
    return say(c, `${title}\n${c.unavailableOption ? c.unavailableOption + ' က ရွေးထားတဲ့ option တွေနဲ့ မရနိုင်ပါ။ ရနိုင်တာတွေက —\n' : ''}${prompt}`, rows(choices.map((a, i) => btn(a.value, `shop:pick:${selection.token}:${i}`))));
  }
  if (inspectKind) return say(c, `${p.name}\nဒီပစ္စည်းမှာ ${inspectKind === 'COLOR' ? 'အရောင်' : 'size'} ရွေးချယ်စရာ မထည့်ထားပါ။`, [[btn('ယူမယ်', `shop:buy:${p.id}`)]]);
  if (matches.length !== 1) return say(c, 'ပစ္စည်း variant ကို တိတိကျကျ မခွဲနိုင်သေးပါ။ ဝန်ထမ်းထံ ဆက်သွယ်ပေးပါ။');
  selection.variantId = matches[0].id; selection.choices = []; selection.token = nonce(s, now); s.stage = 'quantity';
  return say(c, `${p.name} (${matches[0].attributes.map(a => a.value).join(', ')})\n${matches[0].unitPrice} ${p.currency}\nဘယ်နှထည်ယူမလဲ? ဥပမာ — ၂ ထည်`);
}
function addVariant(s, c, p, variant, amount, now) {
  c.itemAdded = false;
  const existing = s.cart.find(v => v.sku === variant.sku);
  const total = (existing?.quantity || 0) + amount;
  if (total > variant.quantityAvailable || total > MAX_QUANTITY) return say(c, `လက်ကျန် ${variant.quantityAvailable} ပဲရှိပါတယ်။ အရေအတွက် လျှော့ပေးပါ။`);
  if (s.currency && s.cart.length && s.currency !== p.currency) return say(c, 'Currency မတူတဲ့ ပစ္စည်းတွေကို order တစ်ခုထဲ ထည့်မရပါ။');
  if (!existing && s.cart.length >= MAX_LINES) return say(c, 'Order တစ်ခုမှာ ပစ္စည်းအမျိုးအစား ၂၀ အထိ ထည့်နိုင်ပါတယ်။');
  s.currency = p.currency;
  if (existing) { existing.quantity = total; existing.unitPrice = variant.unitPrice; }
  else s.cart.push({ productId: p.id, variantId: variant.id, sku: variant.sku, name: p.name, label: variant.attributes.map(a => a.value).join(', '), unitPrice: variant.unitPrice, quantity: amount });
  s.selection = null;
  c.itemAdded = true;
  return renderCart(s, c, now);
}
function stale(c, s) {
  const id = s?.selection?.productId || s?.focused;
  return say(c, 'ရွေးချယ်မှုကို ပြန်ဖွင့်ပေးပါ။ လက်ရှိရနိုင်တဲ့ option တွေကို ပြန်စစ်ပေးပါမယ်။',
    id && s.issuedCards?.some(p => p.id === id) ? [[btn('ပြန်ရွေးမယ်', `shop:buy:${id}`)]] : []);
}
function rememberCards(s, products, now) {
  const cards = new Map((s.issuedCards || []).filter(p => now - p.shownAt <= SESSION_TTL).map(p => [p.id, p]));
  for (const p of products) { cards.delete(p.id); cards.set(p.id, { id: p.id, name: p.name, shownAt: now }); }
  s.issuedCards = [...cards.values()].slice(-60);
}

function discover(s, c, now, page = {}) {
  s.stage = null; s.selection = null; s.focused = null; s.catalog = []; s.catalogItems = [];
  s.discovery ||= { seen: [] };
  s.discovery.token = nonce(s, now); s.discovery.started = now;
  const { query, color, size, maxPrice, currency } = s.preferences || {};
  const filters = Object.fromEntries(Object.entries({ query, color, size, maxPrice, currency }).filter(([, value]) => value !== undefined));
  return request(c, 'search', 'GET', '/customer-portal/catalog/discover', {
    companyId: c.companyId, ...filters, ...page,
    ...(s.discovery.seen.length ? { exclude: s.discovery.seen.join(',') } : {}),
  });
}
function discoveryControls(s, c, body, now) {
  s.discovery.token = nonce(s, now); s.discovery.started = now;
  s.discovery.next = body.next || null;
  const controls = [];
  if (body.next) controls.push(btn('နောက်ထပ်ကြည့်မယ်', `discover:more:${s.discovery.token}`));
  if (s.discovery.lowPrice > 0) controls.push(btn('ဈေးသက်သာတာပြမယ်', `discover:cheaper:${s.discovery.token}`));
  controls.push(btn('ရွေးချယ်မှုရှင်းမယ်', `discover:reset:${s.discovery.token}`));
  const prefs = s.preferences || {};
  const summary = [prefs.size && `Size ${prefs.size}`, prefs.color, prefs.maxPrice && `${prefs.maxPrice} ${prefs.currency || s.discovery.currency || ''} အတွင်း`].filter(Boolean);
  return say(c, summary.length ? `ရွေးထားတာ: ${summary.join(' / ')}\nပြောင်းချင်တာကို စာနဲ့ရေးနိုင်ပါတယ်။` : 'နောက်ထပ် ရွေးချယ်နိုင်ပါတယ်။', rows(controls));
}

function discoveryAction(s, c, action, now) {
  if (!s.discovery || now - s.discovery.started > SELECTION_TTL) return say(c, 'ရှာချင်တဲ့ ပစ္စည်းအမည်ကို ပြန်ရေးပေးပါ။');
  if (action === 'more') return s.discovery.next ? discover(s, c, now, s.discovery.next) : say(c, 'ဒီရွေးချယ်မှုနဲ့ နောက်ထပ်ပစ္စည်း မရှိတော့ပါ။ ပစ္စည်းအမည် သို့မဟုတ် size/ဈေးကန့်သတ်ချက် ပြောင်းရှာနိုင်ပါတယ်။');
  if (action === 'reset') {
    s.preferences = { query: s.preferences?.query || '' }; s.discovery = { seen: [] };
    return discover(s, c, now);
  }
  if (action === 'cheaper' && s.discovery.lowPrice > 0) {
    s.preferences = { ...s.preferences, maxPrice: money(s.discovery.lowPrice - 1), currency: s.discovery.currency };
    s.discovery = { seen: [] }; return discover(s, c, now);
  }
  return say(c, 'ဈေးကန့်သတ်ချက်နဲ့ ပစ္စည်းအမည် ပြန်ရေးပေးပါ။');
}

function askAssistant(s, c) {
  c.assistantStartedAt = s.touched;
  const body = assistant.context(s, c.text);
  body.preferences = { ...body.preferences };
  const explicit = discovery.parseQuery(c.text);
  for (const key of ['size', 'color', 'maxPrice', 'currency']) if (explicit[key] !== undefined) body.preferences[key] = explicit[key];
  if (explicit.family) body.preferences.family = explicit.family;
  return request(c, 'assistant', 'AGENT', '/customer-portal/shopping/assistant', {}, body);
}
function assistantFallback(s, c, now) {
  c.assistantFailed = true;
  if (s.selection) return stale(c, s);
  const parsed = discovery.parseQuery(c.text, s.preferences);
  if (parsed.intent === 'chat') return say(c, 'အခု စကားပြောအကူအညီ ခဏချိတ်မရပါ။ ပစ္စည်းအမည်ရေးပြီး ရှာနိုင်ပါတယ်။');
  s.preferences = parsed; s.discovery = { seen: [] };
  return discover(s, c, now);
}
function applyAssistant(s, c, body, now) {
  const action = assistant.validate(body);
  if (!action) return assistantFallback(s, c, now);
  assistant.remember(s, c.text, action);
  if (action.action === 'search') {
    s.preferences = discovery.parseQuery(action.query, s.preferences); s.discovery = { seen: [] };
    // Known customer constraints are authoritative even when the model omits
    // them while translating a natural-language catalog query.
    const explicit = discovery.parseQuery(c.text);
    for (const key of ['size', 'color', 'maxPrice', 'currency']) if (explicit[key] !== undefined) s.preferences[key] = explicit[key];
    return discover(s, c, now);
  }
  if (action.action === 'cart') return renderCart(s, c, now);
  if (action.action === 'popular') {
    const explicit = discovery.parseQuery(c.text);
    const filters = { ...s.preferences };
    for (const key of ['size', 'color', 'maxPrice', 'currency']) if (explicit[key] !== undefined) filters[key] = explicit[key];
    filters.query = action.query ? discovery.parseQuery(action.query).query : explicit.family || s.preferences?.family || '';
    if (explicit.family && discovery.parseQuery(filters.query).family !== explicit.family) filters.query = explicit.family;
    filters.family = discovery.parseQuery(filters.query).family;
    s.preferences = filters; s.discovery = { seen: [] };
    s.stage = null; s.selection = null; s.focused = null; s.catalog = []; s.catalogItems = [];
    const query = { companyId: c.companyId };
    for (const key of ['query', 'size', 'color', 'maxPrice', 'currency']) if (filters[key] !== undefined) query[key] = filters[key];
    c.popular = true;
    return request(c, 'search', 'GET', '/customer-portal/catalog/popular', query);
  }
  if (['more', 'cheaper', 'reset'].includes(action.action)) return discoveryAction(s, c, action.action, now);
  if (action.action === 'reply') return say(c, action.text);
  if (action.action === 'handoff') {
    s.handoff = { requestedAt: now, reason: action.text, eventId: c.eventId };
    c.handoffRequested = true; c.handoffReason = action.text;
    return say(c, 'ဝန်ထမ်းအကူအညီလိုအပ်တဲ့ တောင်းဆိုချက်ကို မှတ်ထားပါပြီ။ Cart ကိုလည်း သိမ်းထားပါတယ်။');
  }
  if (['buy', 'options'].includes(action.action)) {
    const id = action.productId || conversation.resolve(s, '', now, SELECTION_TTL);
    if (!id || !s.issuedCards.some(p => p.id === id)) return say(c, 'ဘယ်ပစ္စည်းကို ဆိုလိုတာလဲ? ပြထားတဲ့ card ရဲ့ ယူမယ် button ကို နှိပ်နိုင်ပါတယ်။');
    c.optionKind = action.kind;
    return detail(c, id, action.action === 'buy' ? 'buy' : 'inspect_options');
  }
  if (action.action === 'pick' && s.stage === 'option' && s.selection) {
    const chosen = s.selection.choices.find(a => a.kind === 'COLOR' ? discovery.canonicalColor(a.value) === discovery.canonicalColor(action.value) : a.value.toLowerCase() === action.value.toLowerCase());
    if (!chosen) { c.optionKind = s.selection.kind; c.unavailableOption = action.value; return detail(c, s.selection.productId, 'inspect_options'); }
    c.pick = { kind: chosen.kind, id: chosen.id }; c.selectionToken = s.selection.token;
    return detail(c, s.selection.productId, 'pick');
  }
  if (action.action === 'quantity' && s.stage === 'quantity' && s.selection) {
    c.amount = action.quantity; c.selectionToken = s.selection.token;
    return detail(c, s.selection.productId, 'quantity');
  }
  return stale(c, s);
}

function prepare(store, update, config, now = Date.now()) {
  const callback = update.callback_query;
  const message = callback?.message || update.message;
  const from = callback?.from || message?.from;
  const c = { chatId: message?.chat?.id, userId: String(from?.id || ''), username: from?.username || null,
    companyId: config.companyId, eventId: String(update.update_id ?? callback?.id ?? message?.message_id ?? ''),
    callbackId: callback?.id || null, text: String(message?.text || '').trim(), messages: [], request: null, hops: 0 };
  store.shoppers ||= {};
  if (!message || !from || message.chat.type !== 'private' || String(message.chat.id) !== c.userId) return say(c, 'ဝယ်ယူရန် bot ရဲ့ private chat မှာ ဆက်သွယ်ပေးပါ။');
  for (const [id, session] of Object.entries(store.shoppers)) if (now - session.touched > SESSION_TTL && !session.submission) delete store.shoppers[id];
  if (!store.shoppers[c.userId] && Object.keys(store.shoppers).length >= MAX_USERS) return say(c, 'ခဏနေမှ ပြန်စမ်းပေးပါ။ ဆိုင်ဝန်ထမ်းကိုလည်း ဆက်သွယ်နိုင်ပါတယ်။');
  if (store.shoppers[c.userId]?.companyId !== c.companyId) {
    if (store.shoppers[c.userId]?.submission) return say(c, 'အရင် order ကို ဝန်ထမ်းထံ အတည်ပြုပေးပါ။');
    delete store.shoppers[c.userId];
  }
  const s = store.shoppers[c.userId] ||= { companyId: c.companyId, cart: [], seen: [], stage: null, seq: 0, touched: now, catalog: [] };
  // Migrate sessions created before issued-card history was introduced.
  if (!s.issuedCards) rememberCards(s, s.catalogItems || [], s.discovery?.started || now);
  rememberCards(s, [], now);
  s.touched = now;
  if (!c.eventId || s.seen.includes(c.eventId)) return c;
  s.seen.push(c.eventId); s.seen = s.seen.slice(-64);
  if (s.submission) return say(c, 'Order တင်ထားမှုကို စစ်ဆေးနေပါတယ်။ ထပ်မတင်ဘဲ ဝန်ထမ်းထံ အတည်ပြုပေးပါ။');
  if (s.selection && now - s.selection.started > SELECTION_TTL) { s.selection = null; s.stage = null; }
  const data = callback?.data || '';
  if (callback) {
    const parts = data.split(':');
    if (parts[0] === 'menu') {
      const action = parts[1];
      if (action === 'main') return renderWelcomeMenu(c);
      if (action === 'browse') {
        s.preferences = {};
        s.discovery = { seen: [] };
        return discover(s, c, now);
      }
      if (action === 'categories') return renderCategoriesMenu(c);
      if (action === 'cat') {
        const family = parts[2] || '';
        s.preferences = discovery.parseQuery(family);
        s.discovery = { seen: [] };
        return discover(s, c, now);
      }
      if (action === 'cart') return renderCart(s, c, now);
      if (action === 'orders') {
        return request(c, 'check_account', 'GET', '/customer-portal/me', { telegramUserId: c.userId });
      }
      if (action === 'help') {
        return say(c, 'ℹ️ Fashion ERP Store အကူအညီနှင့် ဝန်ဆောင်မှုများ —\n\n🕒 ဆိုင်ဖွင့်ချိန် - မနက် ၉:၀၀ မှ ည ၈:၀၀ ထိ\n🚚 ပို့ဆောင်ရေး - ရန်ကုန်/မန္တလေး မြို့တွင်း အိမ်အရောက်ငွေချေ (Cash on Delivery) ရရှိနိုင်ပြီး အခြားမြို့များသို့ ကားဂိတ်မှတစ်ဆင့် ပို့ဆောင်ပေးပါသည်\n💳 ငွေပေးချေမှု - KBZPay, CB Pay, AYA Pay, WavePay ဖြင့် ပေးချေနိုင်ပါသည်\n🔄 လဲလှယ်ခြင်း - ပစ္စည်းရောက်ရှိပြီး ၃ ရက်အတွင်း မူလအခြေအနေအတိုင်း ဆိုဒ်လဲလှယ်နိုင်ပါသည်\n\n📞 လူကြီးမင်း သိရှိလိုသည်များကို စာတိုပေးပို့၍ တိုက်ရိုက် မေးမြန်းနိုင်ပါသည်ခင်ဗျာ။', [
          [btn('🛍️ ပစ္စည်းများ ကြည့်မည်', 'menu:browse'), btn('🔙 ပင်မမီနူးသို့', 'menu:main')]
        ]);
      }
      return stale(c);
    }
    if (parts[0] === 'discover') {
      if (!s.discovery || parts[2] !== s.discovery.token || now - s.discovery.started > SELECTION_TTL) return stale(c);
      if (['more', 'reset', 'cheaper'].includes(parts[1])) return discoveryAction(s, c, parts[1], now);
      return stale(c);
    }
    if (parts[0] === 'shop' && ['buy', 'view'].includes(parts[1])) {
      if (!s.issuedCards.some(p => p.id === parts[2])) return stale(c, s);
      c.productId = parts[2]; return detail(c, c.productId, parts[1]);
    }
    if (parts[0] === 'shop' && parts[1] === 'budget') {
      if (!s.budgetConfirmation || parts[2] !== s.budgetConfirmation.token || now - s.budgetConfirmation.started > SELECTION_TTL) return stale(c, s);
      c.budgetOverride = s.budgetConfirmation;
      s.budgetConfirmation = null;
      return detail(c, c.budgetOverride.productId, 'buy');
    }
    if (parts[0] === 'shop' && parts[1] === 'pick') {
      if (s.stage !== 'option' || !s.selection || s.selection.token !== parts[2] || !/^\d+$/.test(parts[3])) return stale(c, s);
      const chosen = s.selection.choices[Number(parts[3])]; if (!chosen) return stale(c);
      c.pick = { kind: s.selection.kind, id: chosen.id }; c.selectionToken = s.selection.token;
      return detail(c, s.selection.productId, 'pick');
    }
    if (parts[0] !== 'cart' || parts[2] !== s.cartToken) return stale(c);
    const action = parts[1];
    if (action === 'cancel') { s.cart = []; s.selection = null; s.stage = null; s.cartToken = nonce(s, now); return say(c, 'Cart ကို ဖျက်ပြီးပါပြီ။'); }
    if (action === 'more') { s.stage = null; s.selection = null; return say(c, 'ထပ်ရွေးချင်တဲ့ ပစ္စည်းအမည် ရေးပေးပါ။'); }
    if (!s.cart.length) return renderCart(s, c, now);
    if (action === 'checkout') return request(c, 'checkout', 'GET', '/customer-portal/me', { telegramUserId: c.userId });
    if (['name', 'phone', 'address'].includes(action)) { s.stage = action; return say(c, { name: 'အမည်အသစ် ရေးပေးပါ။', phone: 'ဖုန်းနံပါတ်အသစ် ရေးပေးပါ။', address: 'ပို့ပေးရမယ့် လိပ်စာအပြည့်အစုံ ရေးပေးပါ။' }[action]); }
    if (action === 'submit') {
      if (s.stage !== 'checkout' || !s.address || !s.name || !s.phone) return checkout(s, c, now);
      s.submission = { id: c.eventId, status: 'checking' }; c.submissionId = c.eventId; c.checkIndex = 0;
      return detail(c, s.cart[0].productId, 'validate_cart');
    }
    return stale(c);
  }
  const text = c.text;
  if (/^\/(?:start|menu)\b/i.test(text)) return renderWelcomeMenu(c);
  if (/^\/browse\b/i.test(text)) {
    s.preferences = {};
    s.discovery = { seen: [] };
    return discover(s, c, now);
  }
  if (/^\/categories\b/i.test(text)) return renderCategoriesMenu(c);
  if (/^\/help\b/i.test(text)) {
    return say(c, 'ℹ️ Fashion ERP Store အကူအညီနှင့် ဝန်ဆောင်မှုများ —\n\n🕒 ဆိုင်ဖွင့်ချိန် - မနက် ၉:၀၀ မှ ည ၈:၀၀ ထိ\n🚚 ပို့ဆောင်ရေး - ရန်ကုန်/မန္တလေး မြို့တွင်း အိမ်အရောက်ငွေချေ (Cash on Delivery) ရရှိနိုင်ပြီး အခြားမြို့များသို့ ကားဂိတ်မှတစ်ဆင့် ပို့ဆောင်ပေးပါသည်\n💳 ငွေပေးချေမှု - KBZPay, CB Pay, AYA Pay, WavePay ဖြင့် ပေးချေနိုင်ပါသည်\n🔄 လဲလှယ်ခြင်း - ပစ္စည်းရောက်ရှိပြီး ၃ ရက်အတွင်း မူလအခြေအနေအတိုင်း ဆိုဒ်လဲလှယ်နိုင်ပါသည်\n\n📞 လူကြီးမင်း သိရှိလိုသည်များကို စာတိုပေးပို့၍ တိုက်ရိုက် မေးမြန်းနိုင်ပါသည်ခင်ဗျာ။', [
      [btn('🛍️ ပစ္စည်းများ ကြည့်မည်', 'menu:browse'), btn('🔙 ပင်မမီနူးသို့', 'menu:main')]
    ]);
  }
  if (/^\/cart\b/i.test(text)) {
    const subject = text.replace(/^\/cart\s*/i, '').trim();
    if (!subject) return renderCart(s, c, now);
    const id = conversation.resolve(s, subject, now, SELECTION_TTL);
    return say(c, '/cart က ရွေးထားတဲ့ cart ကို ကြည့်ရန် ဖြစ်ပါတယ်။ ဝယ်ယူရန် ပစ္စည်းရဲ့ ယူမယ် button ကို နှိပ်ပေးပါ။', id ? [[btn('ယူမယ်', `shop:buy:${id}`)]] : []);
  }
  if (/^\/link\b/i.test(text)) return request(c, 'link', 'POST', '/customer-portal/link/request', {}, { telegramUserId: c.userId, companyId: c.companyId, phone: digits(text.replace(/^\/link\s*/i, '')) });
  if (/^\/verify\b/i.test(text)) return request(c, 'verify', 'POST', '/customer-portal/link/verify', {}, { telegramUserId: c.userId, code: digits(text.replace(/^\/verify\s*/i, '')) });
  if (/^\/order\b/i.test(text)) {
    const items = text.replace(/^\/order\s*/i, '').split(',').map(part => part.trim().match(/^(\S+)\s+x(\d{1,3})$/i));
    if (items.length > MAX_LINES || items.some(m => !m || !quantity(m[2]))) return say(c, '/order SKU-001 x2, SKU-002 x1 ပုံစံဖြင့် ရေးပေးပါ။');
    c.legacyItems = items.map(m => ({ sku: m[1], quantity: Number(m[2]) })); c.legacyIndex = 0;
    return request(c, 'legacy', 'GET', '/customer-portal/catalog', { companyId: c.companyId, query: c.legacyItems[0].sku });
  }
  if (['address', 'name', 'phone'].includes(s.stage)) {
    const field = s.stage; const value = field === 'phone' ? digits(text) : text;
    if (!value || value.length > ({ name: 200, phone: 50, address: 500 }[field]) || (field === 'phone' && !/^\+?[\d\s()-]{5,50}$/.test(value))) return say(c, 'အချက်အလက်ကို မှန်ကန်စွာ ပြန်ရေးပေးပါ။');
    s[field] = value; if (field !== 'address') s.profileDirty = true;
    return checkout(s, c, now);
  }
  const followup = conversation.intent(text);
  if (followup) {
    if (['more', 'cheaper', 'reset'].includes(followup.action)) return discoveryAction(s, c, followup.action, now);
    const id = conversation.resolve(s, followup.subject, now, SELECTION_TTL);
    if (!id) return config.assistantEnabled ? askAssistant(s, c) : say(c, 'မေးထားတဲ့ ပစ္စည်းကို တိတိကျကျ မရွေးနိုင်သေးပါ။ ပစ္စည်းအမည်နဲ့ ရှာပြီး card ပေါ်က ယူမယ် button ကို နှိပ်ပေးပါ။');
    c.optionKind = followup.kind;
    return detail(c, id, followup.action);
  }
  if (s.stage === 'quantity' && s.selection) {
    const n = quantity(text); if (!n) return config.assistantEnabled ? askAssistant(s, c) : say(c, 'အရေအတွက် ၁ မှ ၉၉၉ အတွင်း ကိန်းပြည့်ရေးပေးပါ။ ဥပမာ — ၂ ထည်');
    c.amount = n; c.selectionToken = s.selection.token; return detail(c, s.selection.productId, 'quantity');
  }
  if (s.stage === 'option' && s.selection) {
    const optionText = s.selection.kind === 'SIZE' ? digits(text).replace(/^(?:size|ဆိုဒ်)\s*/i, '').trim() : text;
    const chosen = s.selection.choices.find(a => a.kind === 'COLOR' ? discovery.canonicalColor(a.value) === discovery.canonicalColor(optionText) : a.value.toLowerCase() === optionText.toLowerCase());
    if (chosen) { c.pick = { kind: s.selection.kind, id: chosen.id }; c.selectionToken = s.selection.token; return detail(c, s.selection.productId, 'pick'); }
    const shortSize = /^(?:(?:size|ဆိုဒ်)\s*)?(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,3}(?:\.\d)?)$/i.test(digits(text));
    const colorOnly = discovery.parseQuery(text);
    if ((s.selection.kind === 'SIZE' && shortSize) || (s.selection.kind === 'COLOR' && colorOnly.color && !colorOnly.query)) {
      c.optionKind = s.selection.kind; c.unavailableOption = short(text);
      return detail(c, s.selection.productId, 'inspect_options');
    }
  }
  if (!text || text.length > 1000) return say(c, 'ရှာချင်တဲ့ ပစ္စည်းအမည်ကို စာသားနဲ့ ရေးပေးပါ။');
  if (config.assistantEnabled) return askAssistant(s, c);
  const parsed = discovery.parseQuery(text, s.preferences);
  if (parsed.intent === 'chat') return request(c, 'chat', 'POST', '/ai/chat', {}, { companyId: c.companyId, message: c.text, ...(s.conversationId ? { conversationId: s.conversationId } : {}) });
  s.preferences = parsed; s.discovery = { seen: [] };
  return discover(s, c, now);
}

function respond(store, context, response, config, now = Date.now()) {
  const c = copy(context); c.messages = []; c.request = null; c.hops = (c.hops || 0) + 1;
  const s = current(store, c); if (!s) return stale(c);
  if (c.hops > MAX_LINES + 5) { if (s.submission?.status === 'checking') s.submission = null; return say(c, 'အဆင့်များနေပါသည်။ /cart နဲ့ ပြန်စစ်ပေးပါ။'); }
  if (c.submissionId && s.submission?.id !== c.submissionId) return stale(c);
  const status = Number(response?.statusCode || 0); const body = response?.body;
  if (c.op === 'assistant') return status >= 200 && status < 300 ? applyAssistant(s, c, body, now) : assistantFallback(s, c, now);
  if (status < 200 || status >= 300) {
    if (c.op === 'create_order') { s.submission.status = 'uncertain'; return say(c, 'Order အခြေအနေကို အတည်မပြုနိုင်သေးပါ။ ထပ်မတင်ဘဲ ဝန်ထမ်းထံ ဆက်သွယ်ပေးပါ။'); }
    if (s.submission) s.submission = null;
    if (status === 403 && ['checkout', 'profile'].includes(c.op)) return say(c, 'အရင် customer account ချိတ်ပေးပါ — /link ဖုန်းနံပါတ်၊ ပြီးရင် /verify code။ Cart ကို သိမ်းထားပါတယ်။');
    if (c.op === 'check_account') {
      return say(c, '📦 အော်ဒါအခြေအနေ စစ်ဆေးရန် လူကြီးမင်း၏ ဖုန်းနံပါတ်ဖြင့် အကောင့်ချိတ်ဆက်ပေးရန် လိုအပ်ပါသည်ခင်ဗျာ။\n\n👉 ချိတ်ဆက်ရန်: /link <ဖုန်းနံပါတ်>\nဥပမာ — /link 09123456789\n(SMS ကုဒ်ရောက်လာပါက /verify <ကုဒ်> ဖြင့် အတည်ပြုပေးပါ)');
    }
    return say(c, 'အချက်အလက်ရယူရာမှာ အခက်အခဲရှိနေပါတယ်။ /cart သို့မဟုတ် ပစ္စည်းအမည်နဲ့ ပြန်စမ်းပေးပါ။');
  }
  s.touched = now;
  if (c.op === 'search') {
    if (!Array.isArray(body?.products)) return say(c, 'ဆိုင် server အချက်အလက်ရယူရာမှာ အခက်အခဲရှိနေပါတယ်။ ခဏနေမှ ပြန်စမ်းပေးပါ။');
    const products = (body.products || []).slice(0, 3); s.catalog = products.map(p => p.id); s.focused = null; s.selection = null; s.stage = null;
    s.catalogItems = products.map(p => ({ id: p.id, name: p.name }));
    rememberCards(s, products, now);
    s.discovery ||= { seen: [] };
    s.discovery.seen = [...new Set([...s.discovery.seen, ...s.catalog])].slice(-60);
    // Continue a small number of bounded pages automatically, including the similar-family fallback.
    if (!products.length && body.next && (c.discoveryPages || 0) < 2 && body.matchType !== 'currency_mismatch') {
      c.discoveryPages = (c.discoveryPages || 0) + 1;
      return discover(s, c, now, body.next);
    }
    if (!products.length) say(c, c.popular ? 'အရောင်းမှတ်တမ်းအရ ထိပ်ဆုံး ၂၀ မျိုးထဲမှာ ရွေးထားတဲ့ size/ဈေးနှုန်းနဲ့ stock ရှိတဲ့ ပစ္စည်း မတွေ့ပါ။ ပစ္စည်းအမည်နဲ့ ဆက်ရှာနိုင်ပါတယ်။' : body.matchType === 'currency_mismatch'
      ? 'သတ်မှတ်ထားတဲ့ currency နဲ့ မကိုက်ပါ။ ငွေလဲနှုန်းကို မခန့်မှန်းပါဘူး။ ဆိုင်သုံး currency နဲ့ ဈေးကန့်သတ်ချက် ပြန်ရေးပေးပါ။'
      : body.next ? 'စစ်ပြီးသလောက်မှာ ရွေးထားတဲ့ size/ဈေးနှုန်းနဲ့ ကိုက်တဲ့ပစ္စည်း မတွေ့သေးပါ။ နောက်ထပ်စစ်နိုင်ပါတယ်။'
        : 'ရွေးထားတဲ့ အမည်/size/ဈေးနှုန်းနဲ့ ကိုက်ပြီး လက်ကျန်ရှိတဲ့ ပစ္စည်း မတွေ့ပါ။ ရွေးချယ်မှုရှင်းပြီး သို့မဟုတ် ပစ္စည်းအမည်အသစ်နဲ့ ရှာနိုင်ပါတယ်။');
    for (const p of products) catalogCard(c, p);
    const prices = products.flatMap(p => p.variants.filter(v => v.quantityAvailable > 0).map(v => cents(v.unitPrice)));
    s.discovery.lowPrice = prices.length ? Math.min(...prices) : null;
    s.discovery.currency = products[0]?.currency;
    return discoveryControls(s, c, body, now);
  }
  if (c.op === 'chat') { s.conversationId = body.conversation?.id || s.conversationId; return say(c, body.message?.content || 'ခဏနေမှ ပြန်စမ်းပေးပါ။'); }
  if (c.op === 'view') { s.focused = body.id; return catalogCard(c, body, true); }
  if (['buy', 'inspect_options'].includes(c.op)) {
    s.focused = body.id;
    const preserve = c.op === 'inspect_options' && s.selection?.productId === body.id;
    if (!preserve) {
      const budgetFilters = {};
      if (s.preferences?.maxPrice) budgetFilters.maxPrice = s.preferences.maxPrice;
      if (s.preferences?.currency) budgetFilters.currency = s.preferences.currency;
      s.selection = { productId: body.id, picks: {}, filters: budgetFilters, started: now };
    }
    if (!preserve && s.selection.filters.maxPrice) {
      const filters = { ...s.selection.filters }; delete filters.maxPrice;
      const available = discovery.eligibleVariants(body, filters, true);
      const price = available.length ? Math.min(...available.map(v => cents(v.unitPrice))) : null;
      const ceiling = available.length ? Math.max(...available.map(v => cents(v.unitPrice))) : null;
      if (price !== null && price > cents(s.selection.filters.maxPrice)) {
        if (c.budgetOverride?.productId === body.id && c.budgetOverride.price === ceiling && c.budgetOverride.currency === body.currency) {
          s.selection.filters.maxPrice = money(ceiling);
        } else {
          s.budgetConfirmation = { productId: body.id, price: ceiling, currency: body.currency, token: nonce(s, now), started: now };
          s.selection = null; s.stage = null;
          return say(c, `${body.name}\nလက်ရှိဈေး ${money(price)}${ceiling !== price ? ' – ' + money(ceiling) : ''} ${body.currency} က ရှာထားတဲ့ ဈေးကန့်သတ်ချက်ထက် မြင့်ပါတယ်။ ဒီဈေးနဲ့ ဆက်ရွေးမလား?`, [[btn('ဒီဈေးနဲ့ ဆက်ရွေးမယ်', `shop:budget:${s.budgetConfirmation.token}`)]]);
        }
      }
    }
    let variants = discovery.eligibleVariants(body, s.selection.filters, true);
    for (const kind of ['SIZE', 'COLOR']) {
      const preferred = s.preferences?.[kind.toLowerCase()];
      if (!preferred || preserve) continue;
      const option = variants.flatMap(v => v.attributes).find(a => a.kind === kind && (kind === 'COLOR'
        ? discovery.canonicalColor(a.value) === discovery.canonicalColor(preferred)
        : a.value.toUpperCase() === preferred.toUpperCase()));
      if (option) { s.selection.picks[kind] = option.id; variants = variants.filter(v => v.attributes.some(a => a.id === option.id)); }
    }
    if (c.op === 'inspect_options') {
      delete s.selection.picks[c.optionKind];
      delete s.selection.variantId;
    }
    return options(s, c, body, now, c.op === 'inspect_options' ? c.optionKind : null);
  }
  if (['pick', 'quantity'].includes(c.op)) {
    if (!s.selection || s.selection.token !== c.selectionToken || s.selection.productId !== body.id) return stale(c);
    if (c.op === 'pick') {
      s.selection.picks[c.pick.kind] = c.pick.id;
      return options(s, c, body, now);
    }
    const variant = body.variants.find(v => v.id === s.selection.variantId && Object.values(s.selection.picks).every(id => v.attributes.some(a => a.id === id)));
    if (!variant) return say(c, 'ရွေးထားတဲ့ variant မရနိုင်တော့ပါ။ ပစ္စည်းကို ပြန်ရွေးပေးပါ။');
    if (!discovery.eligibleVariants(body, s.selection.filters, true).some(v => v.id === variant.id))
      return say(c, 'ရွေးထားတဲ့ size/ဈေးကန့်သတ်ချက် သို့မဟုတ် လက်ကျန် ပြောင်းသွားပါတယ်။ ပစ္စည်းကို ပြန်ရွေးပေးပါ။');
    return addVariant(s, c, body, variant, c.amount, now);
  }
  if (c.op === 'legacy') {
    const item = c.legacyItems[c.legacyIndex]; let found;
    for (const p of body.products || []) { const v = p.variants.find(v => v.sku.toLowerCase() === item.sku.toLowerCase()); if (v) { found = { p, v }; break; } }
    if (!found) return say(c, `${item.sku} ကို မတွေ့ပါ။ အရင်ထည့်ထားတဲ့ cart ကို /cart နဲ့ ကြည့်နိုင်ပါတယ်။`);
    addVariant(s, c, found.p, found.v, item.quantity, now);
    if (!c.itemAdded) return c;
    c.legacyIndex++;
    if (c.legacyIndex < c.legacyItems.length) return request(c, 'legacy', 'GET', '/customer-portal/catalog', { companyId: c.companyId, query: c.legacyItems[c.legacyIndex].sku });
    return c;
  }
  if (c.op === 'link') return say(c, `Telegram ချိတ်ဆက် code: ${body.code}\n/verify ${body.code} လို့ ပို့ပေးပါ။ ဒီ code က SMS ဖုန်းပိုင်ရှင်စစ်ခြင်း မဟုတ်ပါ။`);
  if (c.op === 'verify') {
    s.customerId = body.customerId; s.name = body.customerName;
    delete s.phone; delete s.address; s.profileDirty = false; s.stage = null; s.cartToken = nonce(s, now);
    return say(c, 'Customer account ချိတ်ပြီးပါပြီ။ /cart ကနေ Checkout ဆက်လုပ်နိုင်ပါတယ်။');
  }
  if (c.op === 'check_account') {
    s.customerId = body.customerId;
    s.name = body.name;
    s.phone = body.phone;
    return say(c, `📦 လူကြီးမင်း၏ ချိတ်ဆက်ထားသော အကောင့် —\n\n👤 အမည်: ${body.name}\n📞 ဖုန်း: ${body.phone}\n\nလူကြီးမင်း၏ အော်ဒါအခြေအနေများကို စစ်ဆေးရန် ဝန်ထမ်းများက အမြဲ အဆင်သင့်ရှိနေပါသည်ခင်ဗျာ။\nအော်ဒါအသစ် ထပ်မံဝယ်ယူလိုပါက အောက်ပါခလုတ်ကို နှိပ်နိုင်ပါသည် —`, [
      [btn('🛍️ ပစ္စည်းများ ကြည့်မည်', 'menu:browse'), btn('🛒 Cart ကြည့်မည်', 'menu:cart')],
      [btn('🔙 ပင်မမီနူးသို့', 'menu:main')]
    ]);
  }
  if (c.op === 'checkout') {
    if (s.customerId && body.customerId && s.customerId !== body.customerId) { delete s.address; s.profileDirty = false; }
    s.customerId = body.customerId;
    if (!s.profileDirty) { s.name = body.name; s.phone = body.phone; }
    return checkout(s, c, now);
  }
  if (c.op === 'validate_cart') {
    const line = s.cart[c.checkIndex]; const variant = body.variants.find(v => v.id === line.variantId && v.sku === line.sku);
    if (!variant || variant.quantityAvailable < line.quantity) { s.submission = null; return renderCart(s, c, now, 'လက်ကျန်ပြောင်းသွားပါတယ်။ Cart ကို ဖျက်ပြီး ပစ္စည်းပြန်ရွေးပေးပါ။\n'); }
    if (cents(variant.unitPrice) !== cents(line.unitPrice)) { line.unitPrice = variant.unitPrice; s.submission = null; return checkout(s, c, now, 'ဈေးနှုန်းပြောင်းသွားပါတယ်။ အသစ်ကို စစ်ပြီး ပြန်အတည်ပြုပေးပါ။\n'); }
    c.checkIndex++;
    if (c.checkIndex < s.cart.length) return detail(c, s.cart[c.checkIndex].productId, 'validate_cart');
    if (s.profileDirty) return request(c, 'profile', 'PATCH', '/customer-portal/me', {}, { telegramUserId: c.userId, name: s.name, phone: s.phone });
    return submitRequest(s, c);
  }
  if (c.op === 'profile') { s.profileDirty = false; return submitRequest(s, c); }
  if (c.op === 'create_order') {
    if (!body.sale?.saleNumber || !body.onlineOrder?.id) { s.submission.status = 'uncertain'; return say(c, 'Order အခြေအနေကို ဝန်ထမ်းထံ အတည်ပြုပေးပါ။ ထပ်မတင်ပါနှင့်။'); }
    c.orderCreated = true; c.sale = body.sale; c.onlineOrder = body.onlineOrder;
    s.cart = []; s.selection = null; s.stage = null; s.submission = null; s.cartToken = nonce(s, now);
    return say(c, `Order လက်ခံရရှိပါပြီ။\nအမှတ်: ${body.sale.saleNumber}\nစုစုပေါင်း: ${body.sale.grandTotal} ${body.sale.currency}\nဝန်ထမ်းဘက်က စစ်ပြီး အတည်ပြုပေးပါမယ်။`);
  }
  return say(c, 'မသိတဲ့လုပ်ဆောင်ချက် ဖြစ်နေပါတယ်။ /cart နဲ့ ပြန်စစ်ပေးပါ။');
}
function submitRequest(s, c) {
  s.submission.status = 'sending';
  return request(c, 'create_order', 'POST', '/customer-portal/orders', {}, {
    telegramUserId: c.userId, ...(c.username ? { telegramUsername: c.username } : {}),
    deliveryAddress: s.address, items: s.cart.map(v => ({ sku: v.sku, quantity: v.quantity })),
  });
}

module.exports = { prepare, respond };
