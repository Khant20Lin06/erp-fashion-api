import { Injectable, Logger } from '@nestjs/common';
import {
  DomainAgent,
  DomainAgentDescriptor,
  DomainAgentType,
} from '../agents/domain-agent.interface';
import { InventoryDomainAgent } from '../agents/inventory.domain-agent';
import { SalesPosDomainAgent } from '../agents/sales-pos.domain-agent';
import { FinanceDomainAgent } from '../agents/finance.domain-agent';
import { CustomerServiceDomainAgent } from '../agents/customer-service.domain-agent';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

@Injectable()
export class AiDomainAgentRegistryService {
  private readonly logger = new Logger(AiDomainAgentRegistryService.name);
  private readonly agentsMap = new Map<DomainAgentType, DomainAgent>();

  constructor(
    private readonly inventoryAgent: InventoryDomainAgent,
    private readonly salesPosAgent: SalesPosDomainAgent,
    private readonly financeAgent: FinanceDomainAgent,
    private readonly customerServiceAgent: CustomerServiceDomainAgent,
    private readonly authorizationService: AuthorizationService,
  ) {
    this.registerAgent(this.inventoryAgent);
    this.registerAgent(this.salesPosAgent);
    this.registerAgent(this.financeAgent);
    this.registerAgent(this.customerServiceAgent);
  }

  private registerAgent(agent: DomainAgent): void {
    this.agentsMap.set(agent.id, agent);
  }

  getAgent(type: DomainAgentType): DomainAgent | undefined {
    return this.agentsMap.get(type);
  }

  listAgents(): DomainAgentDescriptor[] {
    return Array.from(this.agentsMap.values()).map((agent) =>
      agent.getDescriptor(),
    );
  }

  async listAvailableAgentsForUser(
    user: AuthenticatedUser,
  ): Promise<DomainAgentDescriptor[]> {
    const userPermissions =
      await this.authorizationService.getEffectivePermissionCodes(user.id);

    const available: DomainAgentDescriptor[] = [];
    for (const agent of this.agentsMap.values()) {
      const descriptor = agent.getDescriptor();
      if (
        !descriptor.requiredPermissions ||
        descriptor.requiredPermissions.length === 0
      ) {
        available.push(descriptor);
        continue;
      }

      // If user has at least one of the required permissions for this agent
      const hasPermission = descriptor.requiredPermissions.some((perm) =>
        userPermissions.has(perm),
      );
      if (hasPermission) {
        available.push(descriptor);
      }
    }
    return available;
  }
}
