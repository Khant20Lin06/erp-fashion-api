/**
 * Only IN_APP is implemented (Phase 21, locked scope) — no credentials or
 * config for a real external email/SMS/push provider exist anywhere in
 * this repo, so this codebase does not fabricate one. "Delivery" for
 * IN_APP is simply the durable `notifications` row itself becoming visible
 * via GET /notifications — a real, working channel, not a stub.
 */
export enum NotificationChannel {
  InApp = 'IN_APP',
}
