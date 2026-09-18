import { AiToolExecutorService } from './ai-tool-executor.service';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { AiTool } from '../tools/ai-tool.interface';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

jest.mock(
  '../../master-data/utils/resolve-request-company-branch-scope',
  () => ({
    resolveRequestCompanyBranchScope: jest.fn(),
  }),
);
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';

describe('AiToolExecutorService', () => {
  let service: AiToolExecutorService;
  let authorizationService: jest.Mocked<
    Pick<AuthorizationService, 'can' | 'getEffectivePermissionCodes'>
  >;
  let dataScopeService: Pick<DataScopeService, never>;
  let fakeTool: jest.Mocked<AiTool>;

  const user = { id: 'user-1', email: 'u@example.com' } as AuthenticatedUser;

  beforeEach(() => {
    fakeTool = {
      name: 'get_sales_summary',
      description: 'test tool',
      parameters: {},
      requiredPermission: 'reports.sales.read',
      dataScopeResource: 'reports',
      execute: jest.fn().mockResolvedValue({ saleCount: 5 }),
    };

    authorizationService = {
      can: jest.fn(),
      getEffectivePermissionCodes: jest.fn(),
    };
    dataScopeService = {};

    (resolveRequestCompanyBranchScope as jest.Mock).mockResolvedValue({
      companyId: 'company-a',
      branchId: undefined,
      allowedBranchIds: null,
    });

    service = new AiToolExecutorService(
      [fakeTool],
      authorizationService as unknown as AuthorizationService,
      dataScopeService as DataScopeService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listAvailableTools — permission filtering', () => {
    it('only lists tools the user holds the required permission for', async () => {
      authorizationService.getEffectivePermissionCodes.mockResolvedValue(
        new Set(['reports.sales.read']),
      );
      const tools = await service.listAvailableTools(user);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('get_sales_summary');
    });

    it('lists nothing when the user holds no matching permission', async () => {
      authorizationService.getEffectivePermissionCodes.mockResolvedValue(
        new Set(['unrelated.permission']),
      );
      const tools = await service.listAvailableTools(user);
      expect(tools).toHaveLength(0);
    });
  });

  describe('execute — authorization re-check (defense in depth)', () => {
    it('rejects execution when the user lacks the required permission, even if called directly', async () => {
      authorizationService.can.mockResolvedValue(false);
      const result = await service.execute(
        user,
        'get_sales_summary',
        {},
        'company-a',
        undefined,
      );
      expect(result.success).toBe(false);
      expect(fakeTool.execute.mock.calls.length).toBe(0);
    });

    it('rejects an unknown tool name', async () => {
      const result = await service.execute(
        user,
        'get_nonexistent_tool',
        {},
        'company-a',
        undefined,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('execute — tenant context is server-resolved, never LLM-supplied', () => {
    it('passes the server-resolved companyId to the tool, not a client-requested one', async () => {
      authorizationService.can.mockResolvedValue(true);
      (resolveRequestCompanyBranchScope as jest.Mock).mockResolvedValue({
        companyId: 'server-resolved-company',
        branchId: undefined,
        allowedBranchIds: null,
      });

      await service.execute(
        user,
        'get_sales_summary',
        { companyId: 'attacker-supplied-company-id' },
        'requested-company',
        undefined,
      );

      const [context] = fakeTool.execute.mock.calls[0];
      expect(context.companyId).toBe('server-resolved-company');
    });

    it('re-resolves scope via resolveRequestCompanyBranchScope for every call (never trusts a cached scope)', async () => {
      authorizationService.can.mockResolvedValue(true);
      await service.execute(
        user,
        'get_sales_summary',
        {},
        'company-a',
        undefined,
      );
      expect(resolveRequestCompanyBranchScope).toHaveBeenCalledWith(
        dataScopeService,
        user.id,
        'reports',
        'company-a',
        undefined,
      );
    });
  });

  describe('execute — success path', () => {
    it('returns the tool result on success', async () => {
      authorizationService.can.mockResolvedValue(true);
      const result = await service.execute(
        user,
        'get_sales_summary',
        {},
        'company-a',
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ saleCount: 5 });
    });
  });

  describe('execute — failure handling never fabricates data', () => {
    it('returns a failure result (not a fabricated success) when the underlying tool throws', async () => {
      authorizationService.can.mockResolvedValue(true);
      fakeTool.execute.mockRejectedValue(new Error('DB unreachable'));
      const result = await service.execute(
        user,
        'get_sales_summary',
        {},
        'company-a',
        undefined,
      );
      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
    });
  });

  describe('execute — Harness Governance Pipeline', () => {
    it('blocks tool execution when arguments contain injection patterns', async () => {
      authorizationService.can.mockResolvedValue(true);
      const result = await service.execute(
        user,
        'get_sales_summary',
        { query: 'test; DROP TABLE users;' },
        'company-a',
        undefined,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('disallowed');
      expect(fakeTool.execute).not.toHaveBeenCalled();
    });

    it('requires human approval for write tools without an approval token', async () => {
      authorizationService.can.mockResolvedValue(true);
      const writeTool: AiTool = {
        name: 'create_stock_adjustment',
        description: 'write tool',
        parameters: {},
        requiredPermission: 'inventory.write',
        dataScopeResource: 'inventory',
        toolType: 'write',
        requiresApproval: true,
        execute: jest.fn().mockResolvedValue({ adjusted: true }),
      };

      const harnessService = new AiToolExecutorService(
        [writeTool],
        authorizationService as unknown as AuthorizationService,
        dataScopeService as DataScopeService,
      );

      const result = await harnessService.execute(
        user,
        'create_stock_adjustment',
        { sku: 'TEE-BLK-M', diff: -5 },
        'company-a',
        undefined,
      );

      expect(result.success).toBe(false);
      expect(result.approvalRequired).toBe(true);
      expect(result.approvalToken).toBeDefined();
      expect(result.actionSummary).toContain('create_stock_adjustment');
      expect(writeTool.execute).not.toHaveBeenCalled();

      // Now pass the valid approval token
      const approvedResult = await harnessService.execute(
        user,
        'create_stock_adjustment',
        { sku: 'TEE-BLK-M', diff: -5 },
        'company-a',
        undefined,
        { approvalToken: result.approvalToken },
      );

      expect(approvedResult.success).toBe(true);
      expect(approvedResult.result).toEqual({ adjusted: true });
      expect(writeTool.execute).toHaveBeenCalled();
    });

    it('persists audit log and records metrics during tool execution', async () => {
      authorizationService.can.mockResolvedValue(true);
      const auditLogRepo = {
        create: jest.fn().mockImplementation((dto) => ({ id: 'log-1', ...dto })),
        save: jest.fn().mockResolvedValue({ id: 'log-1' }),
      };
      const metrics = {
        recordAiToolExecution: jest.fn(),
        recordAiGuardrailBlock: jest.fn(),
        recordAiApproval: jest.fn(),
      };

      const harnessService = new AiToolExecutorService(
        [fakeTool],
        authorizationService as unknown as AuthorizationService,
        dataScopeService as DataScopeService,
        undefined,
        undefined,
        auditLogRepo as any,
        metrics as any,
      );

      const result = await harnessService.execute(
        user,
        'get_sales_summary',
        { from: '2026-09-01' },
        'company-a',
        undefined,
        { conversationId: 'conv-123' },
      );

      expect(result.success).toBe(true);
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          companyId: 'company-a',
          toolName: 'get_sales_summary',
          status: 'SUCCESS',
          conversationId: 'conv-123',
        }),
      );
      expect(auditLogRepo.save).toHaveBeenCalled();
      expect(metrics.recordAiToolExecution).toHaveBeenCalledWith(
        'get_sales_summary',
        'read',
        'success',
        expect.any(Number),
      );
    });
  });
});

