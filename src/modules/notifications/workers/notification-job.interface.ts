/**
 * Job payload carried on the `notifications` BullMQ queue (LOCKED: only the
 * notification's ID, never its full payload — the worker re-reads current
 * state from MySQL, so an enqueue never goes stale relative to the row).
 */
export interface NotificationJobData extends Record<string, unknown> {
  notificationId: string;
}

export const SEND_NOTIFICATION_JOB = 'send-notification';
