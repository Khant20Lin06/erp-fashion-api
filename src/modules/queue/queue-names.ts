/**
 * Centralized BullMQ queue name constants (Phase 20, locked scope:
 * evidence-based queue list only — do not add a queue speculatively).
 *
 * NOTIFICATIONS backs Phase 21 (NotificationEventConsumer enqueues,
 * NotificationWorker consumes). REPORT_EXPORTS is reserved for a Phase 22
 * background-export feature — only actually registered/wired if that
 * feature is built; see reports module docs for the final decision.
 */
export const QueueNames = {
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];
