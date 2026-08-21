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
    'Get total sales count, grand total, subtotal, discount, and tax for a date range (CONFIRMED sales only).';
  readonly parameters = {
    type: 'object',
    properties: {
      fromDate: {
        type: 'string',
        format: 'date',
        description: 'Start date (inclusive), ISO 8601',
      },
      toDate: {
        type: 'string',
        format: 'date',
        description: 'End date (inclusive), ISO 8601',
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
    return this.salesReportsService.summary(context.companyId, {
      fromDate: args.fromDate,
      toDate: args.toDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
