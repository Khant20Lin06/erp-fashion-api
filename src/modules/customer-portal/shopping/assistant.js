'use strict';

// The model proposes only an intent. Identity, prices, callbacks, stock and
// order submission are deliberately absent from this contract.
const schema = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ['search', 'popular', 'buy', 'options', 'pick', 'quantity', 'cart', 'more', 'cheaper', 'reset', 'reply', 'handoff'] },
    query: { type: 'string', maxLength: 100 },
    productId: { type: 'string', maxLength: 36 },
    kind: { type: 'string', enum: ['COLOR', 'SIZE'] },
    value: { type: 'string', maxLength: 40 },
    quantity: { type: 'integer', minimum: 1, maximum: 999 },
    text: { type: 'string', maxLength: 1200 },
  },
};
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !schema.properties.action.enum.includes(value.action)) return null;
  for (const [key, v] of Object.entries(value)) {
    const rule = schema.properties[key];
    if (!rule) return null;
    if (rule.type === 'integer') { if (!Number.isInteger(v) || v < rule.minimum || v > rule.maximum) return null; }
    else if (typeof v !== 'string' || (rule.maxLength && v.length > rule.maxLength) || (rule.enum && !rule.enum.includes(v))) return null;
  }
  const required = { search: 'query', buy: 'productId', options: 'kind', pick: 'value', quantity: 'quantity', reply: 'text', handoff: 'text' }[value.action];
  return required && !value[required] ? null : value;
}
function context(s, text) {
  return {
    message: text.slice(0, 1000),
    stage: s.stage,
    recentProducts: (s.issuedCards || []).slice(-12).map(({ id, name }) => ({ id, name })),
    latestProductIds: s.catalog || [], focusedProductId: s.selection?.productId || s.focused || null,
    preferences: s.preferences || {},
    selection: s.selection ? { productId: s.selection.productId, kind: s.selection.kind, choices: s.selection.choices || [] } : null,
    cart: (s.cart || []).map(({ name, label, quantity, unitPrice }) => ({ name, label, quantity, unitPrice })),
    currency: s.currency || null, history: s.assistantHistory || [],
  };
}
function remember(s, message, action) {
  s.assistantHistory = [...(s.assistantHistory || []), { role: 'user', text: message.slice(0, 500) },
    { role: 'assistant', text: (action.text || action.action).slice(0, 500) }].slice(-12);
}
module.exports = { schema, validate, context, remember };
