/**
 * Centralized BullMQ queue name constants (Phase 20, locked scope:
 * evidence-based queue list only — do not add a queue speculatively).
 *
 * NOTIFICATIONS backs Phase 21 (NotificationEventConsumer enqueues,
 * NotificationWorker consumes). REPORT_EXPORTS is reserved for a Phase 22
 * background-export feature — only actually registered/wired if that
 * feature is built; see reports module docs for the final decision.
 *
 * WEBHOOK_DELIVERY backs Phase 23 (Integrations/Webhooks):
 * WebhookDispatchConsumer enqueues, WebhookDeliveryWorker consumes.
 *
 * AI_KNOWLEDGE_INGESTION backs Phase 19 (AI Assistant/RAG):
 * AiKnowledgeService.create()/reingest() enqueue, KnowledgeIngestionWorker
 * consumes (chunk + embed + persist).
 */
export const QueueNames = {
  NOTIFICATIONS: 'notifications',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  AI_KNOWLEDGE_INGESTION: 'ai-knowledge-ingestion',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];
