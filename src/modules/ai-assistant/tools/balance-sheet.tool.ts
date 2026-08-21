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
    'Get the balance sheet (assets, liabilities, equity) as of a date, from posted journal entries.';
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
