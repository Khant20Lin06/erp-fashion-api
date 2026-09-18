import { Injectable, Logger } from '@nestjs/common';
import { DomainAgentType } from '../agents/domain-agent.interface';
import { SupervisorIntentClassifierService } from '../supervisor/supervisor-intent-classifier.service';
import { AiDomainAgentRegistryService } from './ai-domain-agent-registry.service';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import {
  SupervisorRouteDecision,
  SupervisorTrace,
} from '../supervisor/supervisor.interface';

@Injectable()
export class AiSupervisorService {
  private readonly logger = new Logger(AiSupervisorService.name);

  constructor(
    private readonly classifier: SupervisorIntentClassifierService,
    private readonly agentRegistry: AiDomainAgentRegistryService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async route(
    user: AuthenticatedUser,
    message: string,
    explicitAgent?: DomainAgentType,
  ): Promise<SupervisorRouteDecision> {
    // 1. Explicit Agent Routing
    if (explicitAgent) {
      const isAuthorized = await this.isUserAuthorizedForAgent(
        user,
        explicitAgent,
      );
      if (!isAuthorized) {
        return {
          targetAgent: 'customer_service',
          unauthorized: true,
          unauthorizedReason: `Access restricted: User lacks permissions for domain agent '${explicitAgent}'`,
          trace: {
            selectedAgent: explicitAgent,
            intent: 'explicit_request',
            confidence: 1.0,
            reasoning: `Explicit agent '${explicitAgent}' requested, but user lacks necessary permissions.`,
            delegationPath: [explicitAgent],
          },
        };
      }

      return {
        targetAgent: explicitAgent,
        trace: {
          selectedAgent: explicitAgent,
          intent: 'explicit_request',
          confidence: 1.0,
          reasoning: `Explicit agent '${explicitAgent}' selected by client.`,
          delegationPath: [explicitAgent],
        },
      };
    }

    // 2. Intelligent Natural Language Classification
    const classification = this.classifier.classify(message);
    const targetAgent = classification.targetAgent;

    // 3. Permission Gatekeeper
    const isAuthorized = await this.isUserAuthorizedForAgent(user, targetAgent);
    if (!isAuthorized) {
      this.logger.warn(
        `User ${user.id} requested query routed to ${targetAgent}, but lacks permissions.`,
      );
      return {
        targetAgent: 'customer_service',
        unauthorized: true,
        unauthorizedReason: `သင်မေးမြန်းသော အချက်အလက်သည် '${targetAgent}' ကဏ္ဍဖြစ်ပြီး ကြည့်ရှုခွင့် ခွင့်ပြုချက် မရှိပါခင်ဗျာ။ (Access restricted for domain agent: ${targetAgent})`,
        trace: {
          selectedAgent: targetAgent,
          intent: classification.intent,
          confidence: classification.confidence,
          reasoning: `${classification.reasoning} (Access denied: routed to customer_service advisory)`,
          delegationPath: [targetAgent, 'customer_service'],
        },
      };
    }

    const trace: SupervisorTrace = {
      selectedAgent: targetAgent,
      intent: classification.intent,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      delegationPath: [targetAgent],
    };

    return {
      targetAgent,
      trace,
    };
  }

  private async isUserAuthorizedForAgent(
    user: AuthenticatedUser,
    agentType: DomainAgentType,
  ): Promise<boolean> {
    const agent = this.agentRegistry.getAgent(agentType);
    if (!agent) {
      return false;
    }

    const descriptor = agent.getDescriptor();
    if (
      !descriptor.requiredPermissions ||
      descriptor.requiredPermissions.length === 0
    ) {
      return true;
    }

    const userPermissions =
      await this.authorizationService.getEffectivePermissionCodes(user.id);
    return descriptor.requiredPermissions.some((perm) =>
      userPermissions.has(perm),
    );
  }
}
