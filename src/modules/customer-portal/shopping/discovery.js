'use strict';

// Shared by the server's read model and durable shopping state. No I/O or AI calls.
const families = {
  tshirt: ['t-shirt', 't shirt', 'tshirt', 'tee', 'တီရှပ်'],
  pants: ['pants', 'pant', 'trousers', 'trouser', 'ဘောင်းဘီ'],
  shirt: ['shirt', 'shirts', 'ရှပ်အင်္ကျီ'],
  dress: ['dress', 'dresses', 'ဂါဝန်'],
  jacket: ['jacket', 'jackets', 'အပေါ်ထပ်'],
  shoes: ['shoes', 'shoe', 'ဖိနပ်'],
};
const colors = {
  black: ['black', 'အနက်', 'အမည်း'], white: ['white', 'အဖြူ'],
  red: ['red', 'အနီ'], blue: ['blue', 'အပြာ'], navy: ['navy', 'နက်ပြာ'],
  green: ['green', 'အစိမ်း'], yellow: ['yellow', 'အဝါ'],
  pink: ['pink', 'ပန်းရောင်'], grey: ['grey', 'gray', 'မီးခိုး'],
};
const digitText = text => String(text).replace(/[၀-၉]/g, c => String(c.charCodeAt(0) - 0x1040));
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function aliasPattern(alias) {
  return new RegExp(/^[a-z]/i.test(alias) ? `\\b${escapeRegex(alias)}s?\\b` : `${escapeRegex(alias)}(?:ရောင်)?`, 'gi');
}
function canonicalColor(value) {
  const text = String(value || '').trim().toLowerCase();
  return Object.keys(colors).find(key => colors[key].some(alias => text === alias || text === alias + 'ရောင်')) || text;
}
function parseQuery(input, previous = {}) {
  let text = digitText(input).toLowerCase().trim();
  if (/^(?:hi|hello|hey|မင်္ဂလာပါ)[.!။\s]*$/i.test(text) || /(?:delivery|shipping|return policy|refund|payment|opening hours|ဆိုင်ဖွင့်ချိန်|ပို့ခ|ပို့ဆောင်|ငွေပေးချေ|ပြန်လဲ)/i.test(text)) {
    return { ...previous, intent: 'chat' };
  }
  const out = { ...previous, intent: 'product' };
  const currency = text.match(/\b(mmk|usd|thb)\b|ကျပ်|\$/i);
  if (currency) out.currency = currency[0] === 'ကျပ်' ? 'MMK' : currency[0] === '$' ? 'USD' : currency[0].toUpperCase();
  const amount = '(\\d[\\d,]{0,12}(?:\\.\\d{1,2})?)';
  const unit = '(?:mmk|usd|thb|ကျပ်|\\$)?';
  const before = new RegExp(`(?:under|below|up to|budget|အများဆုံး)\\s*${unit}\\s*${amount}\\s*${unit}`, 'i');
  const after = new RegExp(`${amount}\\s*${unit}\\s*(?:အောက်|အတွင်း|ထက်မပို)`, 'i');
  const budget = text.match(before) || text.match(after);
  if (budget) {
    const number = Number(budget[1].replace(/,/g, ''));
    if (Number.isFinite(number) && number >= 0 && number < 10000000000) out.maxPrice = number.toFixed(2);
    text = text.replace(budget[0], ' ');
  }
  text = text.replace(/\b(?:mmk|usd|thb)\b|ကျပ်|\$/gi, ' ');
  const size = text.match(/(?:\bsize\s*|ဆိုဒ်\s*)([a-z0-9]+(?:\.[0-9]+)?)(?=\s|$|[?။!])/i)
    || text.match(/\b(xxxl|xxl|xxs|xl|xs|s|m|l)\b/i);
  if (size) { out.size = size[1].toUpperCase(); text = text.replace(size[0], ' '); }
  for (const [key, aliases] of Object.entries(colors)) {
    for (const alias of aliases) {
      const pattern = aliasPattern(alias);
      if (pattern.test(text)) { out.color = key; text = text.replace(aliasPattern(alias), ' '); }
    }
  }
  for (const [key, aliases] of Object.entries(families)) {
    for (const alias of aliases) text = text.replace(aliasPattern(alias), ` ${key} `);
  }
  text = text.replace(/(?:ရှာပေးပါ|ပြပေးပါ|ပြပါ|ရောရှိလား|ရှိပါသလား|ရှိလား|လိုချင်တယ်|ယူချင်တယ်|လိုချင်ပါတယ်|လေးတွေ|လေး|ရှိသလား|အရောင်|ဆိုဒ်)/g, ' ')
    .replace(/\b(?:please|show me|show|find|browse|do you have|have you got|i want|in|color|size)\b/gi, ' ')
    .replace(/[?။!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (text) out.query = text;
  out.query ||= '';
  out.family = Object.keys(families).find(key => out.query.split(' ').includes(key));
  return out;
}
function searchTerms(query) {
  return String(query || '').split(/\s+/).filter(Boolean).slice(0, 10).map(term => families[term] || [term]);
}
function priceCents(value) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
function eligibleVariants(product, filters = {}, relaxColor = false) {
  if (filters.currency && product.currency !== filters.currency) return [];
  const ceiling = filters.maxPrice === undefined ? null : priceCents(filters.maxPrice);
  if (filters.maxPrice !== undefined && ceiling === null) return [];
  return product.variants.filter(variant => {
    const price = priceCents(variant.unitPrice);
    return variant.quantityAvailable > 0 && price !== null && (ceiling === null || price <= ceiling)
      && (!filters.size || variant.attributes.some(a => a.kind === 'SIZE' && a.value.trim().toUpperCase() === filters.size.toUpperCase()))
      && (relaxColor || !filters.color || variant.attributes.some(a => a.kind === 'COLOR' && canonicalColor(a.value) === canonicalColor(filters.color)));
  });
}

module.exports = { parseQuery, searchTerms, eligibleVariants, canonicalColor, priceCents };
