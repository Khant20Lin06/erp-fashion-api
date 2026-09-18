import { Injectable } from '@nestjs/common';
import { BaseDomainAgent } from './base.domain-agent';
import {
  DomainAgentDescriptor,
  DomainAgentType,
} from './domain-agent.interface';

@Injectable()
export class SalesPosDomainAgent extends BaseDomainAgent {
  readonly id: DomainAgentType = 'sales_pos';

  getDescriptor(): DomainAgentDescriptor {
    return {
      id: 'sales_pos',
      name: 'Sales & POS Agent',
      description:
        'Specialized in retail store performance, POS shift sales, top-selling apparel products, and revenue analysis.',
      allowedTools: [
        'get_sales_summary',
        'get_top_products',
        'get_product_info',
      ],
      ragEnabled: true,
      requiredPermissions: ['sales.read'],
    };
  }

  getAllowedTools(): string[] {
    return this.getDescriptor().allowedTools;
  }

  getSystemPrompt(): string {
    return `You are the Fashion ERP Retail Sales & POS Specialist Agent.
Your role: Analyze store sales volume, top-line POS revenue, best-selling fashion products, and sales performance by date or branch.

Operational Instructions:
1. When asked about store sales, revenue, daily sales totals, or order counts, call get_sales_summary.
2. Note that get_sales_summary reports POS top-line revenue, NOT accounting profit. Do not confuse sales revenue with net profit.
3. When asked about best sellers, top-ranking apparel, or highest-volume items, call get_top_products.
4. When asked about product retail pricing or availability for customers, call get_product_info.
5. Dates: If the user says "today", "yesterday", or "this month", pass explicit ISO date boundaries. Default to all-time only if no timeframe is stated or implied.
6. Ground Truth: Always base revenue numbers and ranking on live tool results. Never invent sales numbers.`;
  }
}
