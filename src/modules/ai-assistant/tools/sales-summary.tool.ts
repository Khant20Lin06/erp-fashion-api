import { Injectable } from '@nestjs/common';
import { SalesReportsService } from '../../reports/services/sales-reports.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { DateRangeArgsDto } from './dto/date-range-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/**
 * Wraps SalesReportsService.summary() — the real service that already
 * powers GET /reports/sales/summary. No parallel query logic; this tool is
 * purely an authorization + argument-validation shim in front of the
 * existing, already-correct report.
 */
@Injectable()
export class SalesSummaryTool implements AiTool {
  readonly name = 'get_sales_summary';
  readonly description =
    'Get POS/sales-order revenue for a date range: sale count, grand total, subtotal, discount, tax (CONFIRMED sales only). ' +
    'This is TOP-LINE REVENUE, not profit — it does not subtract expenses/cost of goods. ' +
    'Use this for "how much did we sell / how many sales / total revenue this week". ' +
    'For net income or "how much profit did we make", use get_profit_loss instead. ' +
    'Omitting fromDate/toDate returns ALL-TIME totals, not just today — always pass explicit dates for "today"/"this week"/"this month" style questions.';
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
  readonly requiredPermission = 'reports.sales.read';
  readonly dataScopeResource = 'reports';

  constructor(private readonly salesReportsService: SalesReportsService) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(DateRangeArgsDto, rawArguments);
    return this.salesReportsService.summary(context.companyId, {
      fromDate: args.fromDate,
      toDate: args.toDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
