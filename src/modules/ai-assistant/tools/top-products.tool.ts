import { Injectable } from '@nestjs/common';
import { SalesReportsService } from '../../reports/services/sales-reports.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { DateRangeArgsDto } from './dto/date-range-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/** Wraps SalesReportsService.byProduct() — same real query GET /reports/sales/by-product uses, top 5 by revenue. */
@Injectable()
export class TopProductsTool implements AiTool {
  readonly name = 'get_top_products';
  readonly description =
    'Get the top 5 best-selling products ranked by revenue for a date range (CONFIRMED sales only). ' +
    'Use this for "best sellers / top products / what sells the most". Not for a single product\'s current stock — use get_inventory_stock_summary for that. ' +
    'Omitting fromDate/toDate returns an ALL-TIME ranking, not just today — always pass explicit dates for "this week"/"this month" style questions.';
  readonly parameters = {
    type: 'object',
    properties: {
      fromDate: {
        type: 'string',
        format: 'date',
        description: 'Start date (inclusive), ISO 8601. Omit together with toDate only for an all-time ranking.',
      },
      toDate: {
        type: 'string',
        format: 'date',
        description: 'End date (inclusive), ISO 8601. Omit together with fromDate only for an all-time ranking.',
      },
    },
  };
  readonly requiredPermission = 'reports.sales.read';

  constructor(private readonly salesReportsService: SalesReportsService) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(DateRangeArgsDto, rawArguments);
    return this.salesReportsService.byProduct(context.companyId, {
      fromDate: args.fromDate,
      toDate: args.toDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
