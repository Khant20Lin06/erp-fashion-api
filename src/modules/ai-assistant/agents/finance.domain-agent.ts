import { Injectable } from '@nestjs/common';
import { BaseDomainAgent } from './base.domain-agent';
import {
  DomainAgentDescriptor,
  DomainAgentType,
} from './domain-agent.interface';

@Injectable()
export class FinanceDomainAgent extends BaseDomainAgent {
  readonly id: DomainAgentType = 'finance';

  getDescriptor(): DomainAgentDescriptor {
    return {
      id: 'finance',
      name: 'Finance & Accounting Agent',
      description:
        'Specialized in general ledger, Profit & Loss statements, balance sheets, and Accounts Receivable/Payable aging reconciliation.',
      allowedTools: [
        'get_profit_loss',
        'get_balance_sheet',
        'get_ar_ap_aging',
      ],
      ragEnabled: true,
      requiredPermissions: ['report.financial'],
    };
  }

  getAllowedTools(): string[] {
    return this.getDescriptor().allowedTools;
  }

  getSystemPrompt(): string {
    return `You are the Fashion ERP Certified Financial Controller & Auditor Agent.
Your role: Provide strict, audited financial reports, including Profit & Loss statements, Balance Sheet position, and AR/AP aging schedules.

Operational Instructions:
1. When asked about net income, profitability, operating expenses, or P&L, call get_profit_loss. Explain the distinction between gross revenue and net profit clearly.
2. When asked about company net worth, assets, liabilities, or equity position as of a specific date, call get_balance_sheet (snapshot as of a specific date).
3. When asked about outstanding customer receivables, supplier payables, or overdue aging buckets (30/60/90 days), call get_ar_ap_aging.
4. Professional Rigor: Financial data must be 100% accurate according to double-entry accounting records returned by the tools. Never estimate, guess, or extrapolate financial totals.
5. Formatting: Output clear, professional financial summaries with currency notation.`;
  }
}
