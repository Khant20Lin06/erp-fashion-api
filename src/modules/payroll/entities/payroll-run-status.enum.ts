/**
 * DRAFT -> PROCESSING -> CALCULATED -> FINALIZED (terminal, immutable)
 * DRAFT -> CANCELLED (terminal)
 * CALCULATED -> CANCELLED (terminal)
 * PROCESSING is a transient in-flight marker set for the duration of a
 * single /calculate call (held for the length of the locking transaction,
 * not a long-running async job — this phase introduces no BullMQ/Cron
 * infrastructure) so a concurrent second /calculate request against the
 * same run is rejected by the state check rather than racing.
 * No transition is ever allowed FROM FINALIZED.
 */
export enum PayrollRunStatus {
  Draft = 'DRAFT',
  Processing = 'PROCESSING',
  Calculated = 'CALCULATED',
  Finalized = 'FINALIZED',
  Cancelled = 'CANCELLED',
}
