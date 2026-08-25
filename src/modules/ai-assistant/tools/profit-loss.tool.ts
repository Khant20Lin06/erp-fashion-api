import { Injectable } from '@nestjs/common';
import { ProfitLossService } from '../../reports/services/profit-loss.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { DateRangeArgsDto } from './dto/date-range-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/** Wraps ProfitLossService.query() — real POSTED journal entries only, revenue/expense/netIncome. No COGS/gross-profit line (matches the underlying service's own documented scope). */
@Injectable()
export class ProfitLossTool implements AiTool {
  readonly name = 'get_profit_loss';
  readonly description =
    'Get real accounting profit & loss (revenue, expense, net income) for a date range, from POSTED journal entries only — the accounting-books answer, not the POS-sales answer. ' +
    'Use this for "how much profit did we make / net income / are we profitable". ' +
    'For raw sales/revenue totals without expenses, use get_sales_summary instead — they answer different questions and can legitimately show different numbers. ' +
    'No COGS/gross-profit line exists; this returns revenue, expense, and net income only. ' +
    'Omitting fromDate/toDate returns an ALL-TIME total, not just today — always pass explicit dates for "this month"/"this quarter" style questions.';
  readonly parameters = {
    type: 'object',
    properties: {
      fromDate: {
        type: 'string',
        format: 'date',
        description: 'Start date (inclusive), ISO 8601. Omit together with toDate only for an all-time total.',
      },
      toDate: {
        type: 'string',
        format: 'date',
        description: 'End date (inclusive), ISO 8601. Omit together with fromDate only for an all-time total.',
      },
    },
  };
  readonly requiredPermission = 'reports.profit_loss.read';

  constructor(private readonly profitLossService: ProfitLossService) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(DateRangeArgsDto, rawArguments);
    return this.profitLossService.query(context.companyId, {
      fromDate: args.fromDate,
      toDate: args.toDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
