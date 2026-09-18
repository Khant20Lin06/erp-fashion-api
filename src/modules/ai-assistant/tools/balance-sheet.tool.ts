import { Injectable } from '@nestjs/common';
import { BalanceSheetService } from '../../reports/services/balance-sheet.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { AsOfDateArgsDto } from './dto/date-range-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/** Wraps BalanceSheetService.query() — real posted-journal-entry balance sheet (assets/liabilities/equity), including the real `balanced` invariant check. */
@Injectable()
export class BalanceSheetTool implements AiTool {
  readonly name = 'get_balance_sheet';
  readonly description =
    'Get the balance sheet (assets, liabilities, equity) as of a single point in time, from POSTED journal entries only. ' +
    'Use this for "what are we worth / total assets / total liabilities / financial position as of [date]". ' +
    'This is a snapshot as of one date, not a range — for a period\'s revenue/expense activity use get_profit_loss instead. ' +
    'The result includes a `balanced` boolean confirming assets = liabilities + equity; if it is false, say so explicitly rather than silently ignoring it.';
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
  readonly requiredPermission = 'reports.balance_sheet.read';
  readonly dataScopeResource = 'reports';

  constructor(private readonly balanceSheetService: BalanceSheetService) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(AsOfDateArgsDto, rawArguments);
    return this.balanceSheetService.query(context.companyId, {
      asOfDate: args.asOfDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
