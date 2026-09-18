export type DomainAgentType =
  | 'inventory'
  | 'sales_pos'
  | 'finance'
  | 'customer_service';

export interface DomainAgentDescriptor {
  id: DomainAgentType;
  name: string;
  description: string;
  allowedTools: string[];
  ragEnabled: boolean;
  requiredPermissions?: string[];
}

export interface DomainAgent {
  readonly id: DomainAgentType;
  getDescriptor(): DomainAgentDescriptor;
  getSystemPrompt(): string;
  getAllowedTools(): string[];
  isToolAllowed(toolName: string): boolean;
}
