import { Injectable } from '@nestjs/common';
import { ArApAgingService } from '../../reports/services/ar-ap-aging.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { AsOfDateArgsDto } from './dto/date-range-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/**
 * Wraps ArApAgingService.query() — real aggregate receivables/payables
 * aging buckets. This is the closest real concept to "customer balance";
 * there is no per-customer live-balance lookup tool because no such
 * service exists (only a static Customer.openingBalanceAmount field, which
 * is explicitly documented elsewhere as configured master data, not a live
 * balance — exposing it via AI would be misleading, so it is not wrapped
 * as a tool).
 */
@Injectable()
export class ArApAgingTool implements AiTool {
  readonly name = 'get_ar_ap_aging';
  readonly description =
    'Get accounts receivable and accounts payable aging (current, 1-30, 31-60, 61-90, 90+ days) as of a date, broken down per customer/supplier. ' +
    'Use this for "who owes us money / what do we owe suppliers / overdue balances / customer aging". ' +
    'This is the only balance-related tool available — there is no separate single-customer live-balance lookup; find that customer\'s row in this tool\'s per-customer breakdown instead of claiming a balance you were not given.';
  readonly parameters = {
    type: 'object',
    properties: {
      asOfDate: {
        type: 'string',
        format: 'date',
        description: 'Defaults to today if omitted',
      },
    },
  };
  readonly requiredPermission = 'reports.ar_ap.read';

  constructor(private readonly arApAgingService: ArApAgingService) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(AsOfDateArgsDto, rawArguments);
    return this.arApAgingService.query(context.companyId, {
      asOfDate: args.asOfDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
