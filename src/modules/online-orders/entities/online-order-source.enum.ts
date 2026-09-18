/**
 * Which channel placed this order — the field that keeps Telegram/bot
 * orders visibly distinct from in-store POS sales and any future online
 * channel, without needing a second Sale table or a SaleType branch (see
 * OnlineOrder's own docblock for why this is a separate entity, not a
 * Sale field).
 */
export enum OnlineOrderSource {
  Telegram = 'TELEGRAM',
  Website = 'WEBSITE',
  Facebook = 'FACEBOOK',
}
