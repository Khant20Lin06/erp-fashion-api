import {
  DomainAgent,
  DomainAgentDescriptor,
  DomainAgentType,
} from './domain-agent.interface';

export abstract class BaseDomainAgent implements DomainAgent {
  abstract readonly id: DomainAgentType;
  abstract getDescriptor(): DomainAgentDescriptor;
  abstract getSystemPrompt(): string;
  abstract getAllowedTools(): string[];

  isToolAllowed(toolName: string): boolean {
    return this.getAllowedTools().includes(toolName);
  }
}
