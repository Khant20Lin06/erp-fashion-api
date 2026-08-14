/**
 * Input shape OutboxService.create() accepts from a domain service (e.g.
 * PaymentsService). Deliberately narrower than the full EventEnvelope —
 * OutboxService itself derives eventId/occurredAt/source (D7/D8) so no two
 * call sites can accidentally diverge on how those are generated.
 */
export interface CreateOutboxEventInput<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  eventType: string;
  eventVersion?: number;
  aggregateType: string;
  aggregateId: string;
  companyId: string;
  branchId: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload: TPayload;
}
