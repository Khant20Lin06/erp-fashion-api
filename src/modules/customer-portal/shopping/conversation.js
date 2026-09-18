'use strict';

// Only resolve explicit names from this customer's recent catalog. Unknown names
// must never fall back to a different focused item.
const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
function intent(text) {
  const value = normalize(text).replace(/[။.!?]+$/u, '').trim();
  if (/^(?:နောက်ထပ်\s*(?:ပြပါ|ကြည့်မယ်|ရွေးချင်တယ်)|more|next|show more)$/i.test(value)) return { action: 'more' };
  if (/^(?:ဈေးသက်သာတာ\s*(?:ပြပါ|ပြမယ်)|cheaper|show cheaper)$/i.test(value)) return { action: 'cheaper' };
  if (/^(?:ရွေးချယ်မှုရှင်းမယ်|reset filters)$/i.test(value)) return { action: 'reset' };
  const buy = value.match(/^(.*?)\s*ယူမယ်$/u) || value.match(/^(?:buy|i(?:'ll| will) take)\s+(.+)$/i);
  if (buy) return { action: 'buy', subject: buy[1].trim() };
  const englishOption = value.match(/^(.*?)\s*\b(colou?rs?|sizes?)\s*(?:available|options)?$/i);
  const englishQuestion = value.match(/^what\s+(colou?rs?|sizes?)\s+(?:are\s+)?available(?:\s+(?:for|in)\s+(.+))?$/i);
  if (englishQuestion || englishOption) return { action: 'inspect_options', subject: englishQuestion ? englishQuestion[2] || '' : englishOption[1], kind: /^size/i.test(englishQuestion ? englishQuestion[1] : englishOption[2]) ? 'SIZE' : 'COLOR' };
  const option = value.match(/^(.*?)\s*(?:ဘာ\s*)?(color|colou?r|အရောင်|size|ဆိုဒ်|အရွယ်အစား)\s*(?:တွေ\s*)?(?:ရှိလဲ|ရှိလား|ရလဲ|ပြပါ|ရှိသလဲ|options|available)?$/iu);
  if (option) return { action: 'inspect_options', subject: option[1].trim().replace(/\s*ဘာ$/u, ''), kind: /^(?:size|ဆိုဒ်|အရွယ်အစား)$/i.test(option[2]) ? 'SIZE' : 'COLOR' };
  return null;
}
function resolve(s, subject, now, ttl) {
  if (!s.discovery || now - s.discovery.started > ttl) return null;
  const name = normalize(subject || '');
  if (!name || /^(?:ဒီဟာ|အဲဒါ|ဒီတစ်ခု|ဒါ|this|it)$/u.test(name)) return s.selection?.productId || s.focused || (s.catalog.length === 1 ? s.catalog[0] : null);
  const matches = (s.issuedCards || s.catalogItems || []).filter(p => normalize(p.name) === name && (!p.shownAt || now - p.shownAt <= ttl));
  return matches.length === 1 ? matches[0].id : null;
}
module.exports = { intent, resolve };
