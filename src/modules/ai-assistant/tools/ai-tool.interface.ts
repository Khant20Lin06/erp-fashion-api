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
  /** Validates raw LLM-supplied arguments (never trusted) and executes against real ERP services. */
  execute(context: AiToolContext, rawArguments: unknown): Promise<unknown>;
}

export const AI_TOOLS = Symbol('AI_TOOLS');
