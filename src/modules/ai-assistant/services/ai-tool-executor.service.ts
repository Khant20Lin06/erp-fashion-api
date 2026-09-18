import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../../core/errors/app.exception';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { AI_TOOLS } from '../tools/ai-tool.interface';
import type { AiTool } from '../tools/ai-tool.interface';
import type { LlmToolDefinition } from '../providers/llm-provider.interface';
import { AiGuardrailsService } from './ai-guardrails.service';
import { AiApprovalService } from './ai-approval.service';
import {
  AiToolAuditLog,
  AiToolExecutionStatus,
} from '../entities/ai-tool-audit-log.entity';
import { MetricsRegistryService } from '../../../observability/metrics/metrics-registry.service';

export interface AiToolExecutionOptions {
  conversationId?: string | null;
  approvalToken?: string;
}

export interface AiToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  approvalRequired?: boolean;
  approvalToken?: string;
  actionSummary?: string;
}

/**
 * Enterprise Agent Harness & Execution Engine (Phase 1 Harness).
 * 
 * Pipeline order:
 * 1. Tool resolution & Input Guardrails check (prevent injection / dangerous parameters)
 * 2. RBAC Permission Gate (AuthorizationService.can)
 * 3. Multi-tenant DataScope Resolution (Company/Branch scoping)
 * 4. Action Classification & HITL Approval Gate (Human-in-the-Loop for write/high-risk actions)
 * 5. Timed Execution against underlying ERP service
 * 6. Output Guardrails inspection
 * 7. Immutable Audit Trail Persistence (ai_tool_audit_logs) & Prometheus Metrics
 */
@Injectable()
export class AiToolExecutorService {
  private readonly logger = new Logger(AiToolExecutorService.name);
  private readonly toolsByName: Map<string, AiTool>;
  private readonly guardrailsService: AiGuardrailsService;
  private readonly approvalService: AiApprovalService;

  constructor(
    @Inject(AI_TOOLS) tools: AiTool[],
    private readonly authorizationService: AuthorizationService,
    private readonly dataScopeService: DataScopeService,
    @Optional() guardrailsService?: AiGuardrailsService,
    @Optional() approvalService?: AiApprovalService,
    @Optional()
    @InjectRepository(AiToolAuditLog)
    private readonly auditLogRepository?: Repository<AiToolAuditLog>,
    @Optional()
    private readonly metricsRegistry?: MetricsRegistryService,
  ) {
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    this.guardrailsService = guardrailsService ?? new AiGuardrailsService();
    this.approvalService = approvalService ?? new AiApprovalService();
  }

  /** Only permission-eligible tools are surfaced to the LLM at all — an AI cannot discover a capability it isn't authorized for. */
  async listAvailableTools(
    user: AuthenticatedUser,
    allowedToolNames?: string[],
  ): Promise<LlmToolDefinition[]> {
    const permissionCodes =
      await this.authorizationService.getEffectivePermissionCodes(user.id);
    const available: LlmToolDefinition[] = [];
    for (const tool of this.toolsByName.values()) {
      if (allowedToolNames && !allowedToolNames.includes(tool.name)) {
        continue;
      }
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
    options?: AiToolExecutionOptions,
  ): Promise<AiToolExecutionResult> {
    const startTime = performance.now();
    const tool = this.toolsByName.get(toolName);
    if (!tool) {
      return {
        toolName,
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    const toolType = tool.toolType || 'read';
    const riskLevel = tool.riskLevel || 'low';

    // 1. Guardrail Argument Validation
    const guardrailCheck = this.guardrailsService.validateArguments(
      toolName,
      rawArguments,
    );
    if (!guardrailCheck.safe) {
      this.metricsRegistry?.recordAiGuardrailBlock('argument_injection');
      await this.logAudit({
        userId: user.id,
        companyId: requestedCompanyId || 'unknown',
        branchId: requestedBranchId,
        conversationId: options?.conversationId,
        toolName,
        toolType,
        riskLevel,
        arguments: rawArguments,
        status: AiToolExecutionStatus.DeniedGuardrails,
        errorMessage: guardrailCheck.reason,
        durationMs: Math.round(performance.now() - startTime),
      });
      return {
        toolName,
        success: false,
        error: guardrailCheck.reason || 'Input validation failed.',
      };
    }

    // 2. RBAC Permission Gate
    const allowed = await this.authorizationService.can(
      user.id,
      tool.requiredPermission,
    );
    if (!allowed) {
      this.logger.warn(
        `User ${user.id} attempted AI tool ${toolName} without permission ${tool.requiredPermission}`,
      );
      this.metricsRegistry?.recordAiToolExecution(
        toolName,
        toolType,
        'denied_permission',
        0,
      );
      await this.logAudit({
        userId: user.id,
        companyId: requestedCompanyId || 'unknown',
        branchId: requestedBranchId,
        conversationId: options?.conversationId,
        toolName,
        toolType,
        riskLevel,
        arguments: rawArguments,
        status: AiToolExecutionStatus.DeniedPermission,
        errorMessage: `Missing permission: ${tool.requiredPermission}`,
        durationMs: Math.round(performance.now() - startTime),
      });
      return {
        toolName,
        success: false,
        error: 'You do not have permission to access this data.',
      };
    }

    try {
      // 3. Multi-tenant DataScope Resolution
      const scope = await resolveRequestCompanyBranchScope(
        this.dataScopeService,
        user.id,
        tool.dataScopeResource,
        requestedCompanyId,
        requestedBranchId,
      );

      // 4. Action Classification & HITL Approval Gate
      let approvedBy: string | null = null;
      if (tool.requiresApproval || toolType === 'write') {
        if (options?.approvalToken) {
          const approvalResult = this.approvalService.verifyAndConsume(
            options.approvalToken,
            user.id,
            scope.companyId,
            toolName,
            rawArguments,
          );
          if (!approvalResult.approved) {
            this.metricsRegistry?.recordAiApproval(toolName, 'rejected');
            await this.logAudit({
              userId: user.id,
              companyId: scope.companyId,
              branchId: scope.branchId,
              conversationId: options?.conversationId,
              toolName,
              toolType,
              riskLevel,
              arguments: rawArguments,
              status: AiToolExecutionStatus.Failed,
              errorMessage: approvalResult.error,
              durationMs: Math.round(performance.now() - startTime),
            });
            return {
              toolName,
              success: false,
              error: approvalResult.error || 'Approval verification failed.',
            };
          }
          approvedBy = user.id;
          this.metricsRegistry?.recordAiApproval(toolName, 'approved');
        } else {
          // Action requires approval but token was not supplied: generate pending request
          const pending = this.approvalService.requestApproval(
            user.id,
            scope.companyId,
            toolName,
            rawArguments,
            `Human approval required for action '${toolName}' with parameters ${JSON.stringify(rawArguments)}`,
          );
          this.metricsRegistry?.recordAiApproval(toolName, 'requested');
          await this.logAudit({
            userId: user.id,
            companyId: scope.companyId,
            branchId: scope.branchId,
            conversationId: options?.conversationId,
            toolName,
            toolType,
            riskLevel,
            arguments: rawArguments,
            status: AiToolExecutionStatus.ApprovalRequired,
            errorMessage: 'Pending human confirmation',
            durationMs: Math.round(performance.now() - startTime),
          });
          return {
            toolName,
            success: false,
            approvalRequired: true,
            approvalToken: pending.token,
            actionSummary: pending.summary,
            error: 'This action modifies ERP records and requires human approval before execution.',
          };
        }
      }

      // 5. Timed Tool Execution
      const executionStartTime = performance.now();
      const rawResult = await tool.execute(
        {
          user,
          companyId: scope.companyId,
          branchId: scope.branchId,
          allowedBranchIds: scope.allowedBranchIds,
        },
        rawArguments,
      );
      const durationMs = Math.round(performance.now() - executionStartTime);

      // 6. Output Guardrail Check
      let finalResult = rawResult;
      if (typeof rawResult === 'string') {
        const outCheck = this.guardrailsService.validateOutput(rawResult);
        finalResult = outCheck.sanitized;
      }

      // 7. Audit Logging & Metrics
      this.metricsRegistry?.recordAiToolExecution(
        toolName,
        toolType,
        'success',
        durationMs,
      );
      await this.logAudit({
        userId: user.id,
        companyId: scope.companyId,
        branchId: scope.branchId,
        conversationId: options?.conversationId,
        toolName,
        toolType,
        riskLevel,
        arguments: rawArguments,
        status: AiToolExecutionStatus.Success,
        approvedBy,
        durationMs,
      });

      return { toolName, success: true, result: finalResult };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const isAppEx = error instanceof AppException;
      const errorMsg = isAppEx ? error.message : (error as Error).message;

      this.metricsRegistry?.recordAiToolExecution(
        toolName,
        toolType,
        'error',
        durationMs,
      );
      await this.logAudit({
        userId: user.id,
        companyId: requestedCompanyId || 'unknown',
        branchId: requestedBranchId,
        conversationId: options?.conversationId,
        toolName,
        toolType,
        riskLevel,
        arguments: rawArguments,
        status: AiToolExecutionStatus.Failed,
        errorMessage: errorMsg,
        durationMs,
      });

      if (isAppEx) {
        return { toolName, success: false, error: error.message };
      }
      this.logger.error(
        `AI tool ${toolName} failed unexpectedly: ${errorMsg}`,
      );
      return {
        toolName,
        success: false,
        error: 'Data could not be retrieved.',
      };
    }
  }

  private async logAudit(params: {
    userId: string;
    companyId: string;
    branchId?: string | null;
    conversationId?: string | null;
    toolName: string;
    toolType: string;
    riskLevel: string;
    arguments: unknown;
    status: AiToolExecutionStatus;
    errorMessage?: string | null;
    durationMs: number;
    approvedBy?: string | null;
  }): Promise<void> {
    if (!this.auditLogRepository) return;
    try {
      const maskedArgs = this.guardrailsService.maskSensitiveData(
        params.arguments,
      );
      const auditEntry = this.auditLogRepository.create({
        userId: params.userId,
        companyId: params.companyId,
        branchId: params.branchId ?? null,
        conversationId: params.conversationId ?? null,
        toolName: params.toolName,
        toolType: params.toolType,
        riskLevel: params.riskLevel,
        arguments: maskedArgs,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
        durationMs: params.durationMs,
        approvedBy: params.approvedBy ?? null,
      });
      await this.auditLogRepository.save(auditEntry);
    } catch (auditErr) {
      // Audit log write failure must never crash the main transaction
      this.logger.error(
        `Failed to record AI tool audit log: ${(auditErr as Error).message}`,
      );
    }
  }
}
