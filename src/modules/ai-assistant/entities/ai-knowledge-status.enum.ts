/**
 * Real ingestion lifecycle states only — no fabricated "successful" state
 * skipped past actual processing. FAILED is terminal (no automatic retry
 * beyond the ingestion worker's own BullMQ job attempts) but re-ingestion
 * can be triggered explicitly via POST /ai/knowledge/:id/reingest.
 */
export enum AiKnowledgeStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Ready = 'READY',
  Failed = 'FAILED',
}
