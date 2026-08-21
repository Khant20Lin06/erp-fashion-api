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
    'Get profit & loss (revenue, expense, net income) for a date range, from posted journal entries.';
  readonly parameters = {
    type: 'object',
    properties: {
      fromDate: { type: 'string', format: 'date' },
      toDate: { type: 'string', format: 'date' },
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
