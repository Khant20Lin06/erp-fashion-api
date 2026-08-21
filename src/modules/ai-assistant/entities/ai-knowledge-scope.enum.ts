/**
 * SYSTEM documents are visible to every company (e.g. generic ERP usage
 * docs); COMPANY documents are scoped to exactly one company and never
 * cross-visible. There is no third "shared between some companies" scope —
 * not a real requirement, not invented here.
 */
export enum AiKnowledgeScope {
  System = 'SYSTEM',
  Company = 'COMPANY',
}
