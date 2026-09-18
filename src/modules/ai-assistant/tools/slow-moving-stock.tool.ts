import { Injectable } from '@nestjs/common';
import { InventoryReportsService } from '../../reports/services/inventory-reports.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { SlowMovingStockArgsDto } from './dto/slow-moving-stock-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/**
 * Wraps InventoryReportsService.slowMoving() — the real signal a
 * promotion/discount decision needs, as opposed to TopProductsTool's
 * inverse concept. Returns real on-hand quantity, real units sold in the
 * window, and real selling price per variant — never a suggested discount
 * percentage or promotion name, since that is a business judgment call the
 * LLM should make FROM this data, not a number this tool fabricates.
 */
@Injectable()
export class SlowMovingStockTool implements AiTool {
  readonly name = 'get_slow_moving_stock';
  readonly description =
    'Get in-stock products ranked by fewest units sold in a recent window (default: last 30 days) — the real data behind "what should we discount / run a promotion on / clear out". ' +
    'Includes on-hand quantity, units sold in the window, and current selling price per variant. Zero units sold in the window is the strongest signal, and those variants are ranked first. ' +
    'This tool does NOT suggest a discount percentage or promotion — reason about that yourself from the real quantities/prices returned, and never state a specific discount number unless the user already told you what percentage they intend to use. ' +
    'Use this for "what should we put on sale / slow sellers / clear excess stock / promotion ideas". Not for identifying top sellers — use get_top_products for that.';
  readonly parameters = {
    type: 'object',
    properties: {
      warehouseId: {
        type: 'string',
        format: 'uuid',
        description: 'Optional: filter to one warehouse',
      },
      fromDate: {
        type: 'string',
        format: 'date',
        description: 'Start of the sales-activity window (inclusive), ISO 8601. Defaults to 30 days before toDate/today.',
      },
      toDate: {
        type: 'string',
        format: 'date',
        description: 'End of the sales-activity window (inclusive), ISO 8601. Defaults to today.',
      },
    },
  };
  readonly requiredPermission = 'reports.inventory.read';
  readonly dataScopeResource = 'reports';

  constructor(
    private readonly inventoryReportsService: InventoryReportsService,
  ) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(
      SlowMovingStockArgsDto,
      rawArguments,
    );
    return this.inventoryReportsService.slowMoving(context.companyId, {
      warehouseId: args.warehouseId,
      fromDate: args.fromDate,
      toDate: args.toDate,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
