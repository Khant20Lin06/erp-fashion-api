import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../core/errors/app.exception';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { AI_TOOLS } from '../tools/ai-tool.interface';
import type { AiTool } from '../tools/ai-tool.interface';
import type { LlmToolDefinition } from '../providers/llm-provider.interface';

export interface AiToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * The one place a tool call actually runs (Phase 19 §10). For every call:
 * 1. re-resolve companyId/branchId scope server-side (never trust the
 *    conversation's stored companyId blindly — re-check per call, matching
 *    every report controller's own per-request resolution)
 * 2. check AuthorizationService.can() against the tool's requiredPermission
 * 3. validate the LLM's raw arguments against the tool's own DTO
 * 4. call the real underlying service
 *
 * A tool the user lacks permission for is never even listed to the LLM —
 * see listAvailableTools() — but execute() re-checks anyway as defense in
 * depth against a stale/cached tool list.
 */
@Injectable()
export class AiToolExecutorService {
  private readonly logger = new Logger(AiToolExecutorService.name);
  private readonly toolsByName: Map<string, AiTool>;

  constructor(
    @Inject(AI_TOOLS) tools: AiTool[],
    private readonly authorizationService: AuthorizationService,
    private readonly dataScopeService: DataScopeService,
  ) {
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  }

  /** Only permission-eligible tools are surfaced to the LLM at all — an AI cannot discover a capability it isn't authorized for. */
  async listAvailableTools(
    user: AuthenticatedUser,
  ): Promise<LlmToolDefinition[]> {
    const permissionCodes =
      await this.authorizationService.getEffectivePermissionCodes(user.id);
    const available: LlmToolDefinition[] = [];
    for (const tool of this.toolsByName.values()) {
      if (permissionCodes.has(tool.requiredPermission)) {
        available.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }
    return available;
  }

  async execute(
    user: AuthenticatedUser,
    toolName: string,
    rawArguments: unknown,
    requestedCompanyId: string | undefined,
    requestedBranchId: string | undefined,
  ): Promise<AiToolExecutionResult> {
    const tool = this.toolsByName.get(toolName);
    if (!tool) {
      return {
        toolName,
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    const allowed = await this.authorizationService.can(
      user.id,
      tool.requiredPermission,
    );
    if (!allowed) {
      this.logger.warn(
        `User ${user.id} attempted AI tool ${toolName} without permission ${tool.requiredPermission}`,
      );
      return {
        toolName,
        success: false,
        error: 'You do not have permission to access this data.',
      };
    }

    try {
      // Every AI tool today is backed by a report service; the DataScope
      // resource used is always 'reports', exactly as every reports
      // controller resolves it (see e.g. SalesReportsController's own
      // `const RESOURCE = 'reports'`) — not derived from the permission
      // string, which would be fragile.
      const scope = await resolveRequestCompanyBranchScope(
        this.dataScopeService,
        user.id,
        'reports',
        requestedCompanyId,
        requestedBranchId,
      );

      const result = await tool.execute(
        {
          user,
          companyId: scope.companyId,
          branchId: scope.branchId,
          allowedBranchIds: scope.allowedBranchIds,
        },
        rawArguments,
      );

      return { toolName, success: true, result };
    } catch (error) {
      if (error instanceof AppException) {
        return { toolName, success: false, error: error.message };
      }
      this.logger.error(
        `AI tool ${toolName} failed unexpectedly: ${(error as Error).message}`,
      );
      return {
        toolName,
        success: false,
        error: 'Data could not be retrieved.',
      };
    }
  }
}
