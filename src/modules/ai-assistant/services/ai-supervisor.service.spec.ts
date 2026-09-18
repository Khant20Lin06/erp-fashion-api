import { Test, TestingModule } from '@nestjs/testing';
import { AiSupervisorService } from './ai-supervisor.service';
import { SupervisorIntentClassifierService } from '../supervisor/supervisor-intent-classifier.service';
import { AiDomainAgentRegistryService } from './ai-domain-agent-registry.service';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

describe('AiSupervisorService', () => {
  let supervisor: AiSupervisorService;
  let authorizationService: jest.Mocked<AuthorizationService>;
  let agentRegistry: jest.Mocked<AiDomainAgentRegistryService>;

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

    agentRegistry = {
      getAgent: jest.fn().mockImplementation((type: string) => {
        if (type === 'finance') {
          return {
            id: 'finance',
            getDescriptor: () => ({
              id: 'finance',
              name: 'Finance Agent',
              description: 'Finance',
              allowedTools: ['get_profit_loss'],
              ragEnabled: true,
              requiredPermissions: ['report.financial'],
            }),
          };
        }
        if (type === 'inventory') {
          return {
            id: 'inventory',
            getDescriptor: () => ({
              id: 'inventory',
              name: 'Inventory Agent',
              description: 'Inventory',
              allowedTools: ['get_inventory_stock_summary'],
              ragEnabled: true,
              requiredPermissions: ['inventory.read'],
            }),
          };
        }
        return {
          id: 'customer_service',
          getDescriptor: () => ({
            id: 'customer_service',
            name: 'Customer Service',
            description: 'Customer Service',
            allowedTools: ['get_product_info'],
            ragEnabled: true,
          }),
        };
      }),
    } as unknown as jest.Mocked<AiDomainAgentRegistryService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSupervisorService,
        SupervisorIntentClassifierService,
        {
          provide: AiDomainAgentRegistryService,
          useValue: agentRegistry,
        },
        {
          provide: AuthorizationService,
          useValue: authorizationService,
        },
      ],
    }).compile();

    supervisor = module.get<AiSupervisorService>(AiSupervisorService);
  });

  it('routes query automatically using intent classification when authorized', async () => {
    authorizationService.getEffectivePermissionCodes.mockResolvedValue(
      new Set(['inventory.read']),
    );

    const decision = await supervisor.route(
      mockUser,
      'ဂိုဒေါင်ထဲမှာ စတော့ ဘယ်လောက်ကျန်လဲ',
    );

    expect(decision.targetAgent).toBe('inventory');
    expect(decision.unauthorized).toBeUndefined();
    expect(decision.trace.selectedAgent).toBe('inventory');
    expect(decision.trace.confidence).toBeGreaterThan(0.7);
  });

  it('detects unauthorized access when user lacks permission for classified domain', async () => {
    // User does not have report.financial
    authorizationService.getEffectivePermissionCodes.mockResolvedValue(
      new Set(['sales.read']),
    );

    const decision = await supervisor.route(
      mockUser,
      'ပြီးခဲ့တဲ့လက အရှုံးအမြတ် စာရင်း ဘယ်လိုရှိလဲ',
    );

    expect(decision.unauthorized).toBe(true);
    expect(decision.unauthorizedReason).toContain('finance');
    expect(decision.trace.selectedAgent).toBe('finance');
  });

  it('honors explicit agent selection when user has permission', async () => {
    authorizationService.getEffectivePermissionCodes.mockResolvedValue(
      new Set(['report.financial']),
    );

    const decision = await supervisor.route(
      mockUser,
      'Any generic message',
      'finance',
    );

    expect(decision.targetAgent).toBe('finance');
    expect(decision.trace.confidence).toBe(1.0);
    expect(decision.trace.reasoning).toContain('Explicit');
  });

  it('rejects explicit agent selection when user lacks permission', async () => {
    authorizationService.getEffectivePermissionCodes.mockResolvedValue(
      new Set([]),
    );

    const decision = await supervisor.route(
      mockUser,
      'Any generic message',
      'finance',
    );

    expect(decision.unauthorized).toBe(true);
    expect(decision.unauthorizedReason).toContain('finance');
  });
});
