import { DomainAgentType } from '../agents/domain-agent.interface';

export interface SupervisorIntent {
  targetAgent: DomainAgentType;
  intent: string;
  confidence: number;
  reasoning: string;
  isCrossDomain?: boolean;
}

export interface SupervisorTrace {
  selectedAgent: DomainAgentType;
  intent: string;
  confidence: number;
  reasoning: string;
  delegationPath: DomainAgentType[];
}

export interface SupervisorRouteDecision {
  targetAgent: DomainAgentType;
  trace: SupervisorTrace;
  unauthorized?: boolean;
  unauthorizedReason?: string;
}
