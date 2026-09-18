import { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * Server-resolved context every tool receives — never client/LLM-supplied.
 * companyId/branchId/allowedBranchIds come from resolveRequestCompanyBranchScope,
 * exactly as every reports controller resolves them (Phase 19 §12: the
 * model may request business filters, but tenant identity stays
 * server-controlled).
 */
export interface AiToolContext {
  user: AuthenticatedUser;
  companyId: string;
  branchId: string | undefined;
  allowedBranchIds: string[] | null;
}

export interface AiTool {
  /** Stable machine name the LLM calls by (e.g. "get_sales_summary"). */
  readonly name: string;
  readonly description: string;
  /** JSON-Schema for the tool's business-filter arguments only — never companyId/branchId. */
  readonly parameters: Record<string, unknown>;
  /** Permission code gating this tool, from the existing RBAC seed. */
  readonly requiredPermission: string;
  /**
   * The DataScopeService resource this tool's data belongs to — used to
   * resolve the caller's allowed company/branch scope before execute()
   * runs (see AiToolExecutorService.execute). Every report-backed tool
   * uses 'reports' (the resource every reports controller itself
   * resolves against); a tool backed by a different domain (e.g.
   * ProductLookupTool) must name its own resource — one every role that
   * can use this tool is expected to have an explicit RoleResourceScope
   * row for, or execution fails with "no data scope configured" even
   * though the tool's own requiredPermission was granted.
   */
  readonly dataScopeResource: string;
  /** Action classification: 'read' (safe queries), 'write' (mutations), 'action' (external effects). Default: 'read'. */
  readonly toolType?: 'read' | 'write' | 'action';
  /** Risk classification: 'low', 'medium', 'high'. Default: 'low'. */
  readonly riskLevel?: 'low' | 'medium' | 'high';
  /** Whether execution requires explicit human confirmation (Human-in-the-loop). Default: false. */
  readonly requiresApproval?: boolean;
  /** Field names in rawArguments that contain sensitive PII or credentials and must be masked in audit trails. */
  readonly sensitiveFields?: string[];
  /** Validates raw LLM-supplied arguments (never trusted) and executes against real ERP services. */
  execute(context: AiToolContext, rawArguments: unknown): Promise<unknown>;
}

export const AI_TOOLS = Symbol('AI_TOOLS');
