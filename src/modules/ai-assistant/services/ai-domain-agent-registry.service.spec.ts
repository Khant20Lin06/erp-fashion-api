import { Test, TestingModule } from '@nestjs/testing';
import { AiDomainAgentRegistryService } from './ai-domain-agent-registry.service';
import { InventoryDomainAgent } from '../agents/inventory.domain-agent';
import { SalesPosDomainAgent } from '../agents/sales-pos.domain-agent';
import { FinanceDomainAgent } from '../agents/finance.domain-agent';
import { CustomerServiceDomainAgent } from '../agents/customer-service.domain-agent';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

describe('AiDomainAgentRegistryService', () => {
  let registryService: AiDomainAgentRegistryService;
  let authorizationService: jest.Mocked<AuthorizationService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    roles: [],
    companyIds: ['comp-1'],
    branchIds: ['branch-1'],
  };

  beforeEach(async () => {
    authorizationService = {
      getEffectivePermissionCodes: jest.fn(),
    } as unknown as jest.Mocked<AuthorizationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDomainAgentRegistryService,
        InventoryDomainAgent,
        SalesPosDomainAgent,
        FinanceDomainAgent,
        CustomerServiceDomainAgent,
        {
          provide: AuthorizationService,
          useValue: authorizationService,
        },
      ],
    }).compile();

    registryService = module.get<AiDomainAgentRegistryService>(
      AiDomainAgentRegistryService,
    );
  });

  it('registers all 4 domain agents', () => {
    const agents = registryService.listAgents();
    expect(agents).toHaveLength(4);
    const ids = agents.map((a) => a.id);
    expect(ids).toContain('inventory');
    expect(ids).toContain('sales_pos');
    expect(ids).toContain('finance');
    expect(ids).toContain('customer_service');
  });

  it('retrieves individual agent by type', () => {
    const inv = registryService.getAgent('inventory');
    expect(inv).toBeDefined();
    expect(inv?.id).toBe('inventory');

    const fin = registryService.getAgent('finance');
    expect(fin).toBeDefined();
    expect(fin?.id).toBe('finance');
  });

  describe('listAvailableAgentsForUser', () => {
    it('returns only customer_service for user with no permissions', async () => {
      authorizationService.getEffectivePermissionCodes.mockResolvedValue(
        new Set(),
      );

      const available =
        await registryService.listAvailableAgentsForUser(mockUser);
      expect(available.map((a) => a.id)).toEqual(['customer_service']);
    });

    it('returns customer_service and inventory for user with inventory.read', async () => {
      authorizationService.getEffectivePermissionCodes.mockResolvedValue(
        new Set(['inventory.read']),
      );

      const available =
        await registryService.listAvailableAgentsForUser(mockUser);
      const ids = available.map((a) => a.id);
      expect(ids).toContain('customer_service');
      expect(ids).toContain('inventory');
      expect(ids).not.toContain('finance');
      expect(ids).not.toContain('sales_pos');
    });

    it('returns all agents for admin user with all permissions', async () => {
      authorizationService.getEffectivePermissionCodes.mockResolvedValue(
        new Set(['inventory.read', 'sales.read', 'report.financial']),
      );

      const available =
        await registryService.listAvailableAgentsForUser(mockUser);
      expect(available).toHaveLength(4);
    });
  });
});
