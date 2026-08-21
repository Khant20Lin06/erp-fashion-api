import { Injectable } from '@nestjs/common';
import { InventoryReportsService } from '../../reports/services/inventory-reports.service';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { WarehouseArgsDto } from './dto/warehouse-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

/**
 * Wraps InventoryReportsService.stockSummary() — quantity-only (on-hand,
 * reserved), no valuation. There is deliberately NO "low stock" tool: no
 * reorder-level/min-stock field exists anywhere in the schema, so a
 * low-stock threshold would be a fabricated business rule (see final
 * report's BLOCKED items) — the LLM can still reason about "low" from the
 * raw quantities this tool returns, but the tool itself does not invent a
 * threshold.
 */
@Injectable()
export class InventoryStockSummaryTool implements AiTool {
  readonly name = 'get_inventory_stock_summary';
  readonly description =
    'Get current on-hand and reserved stock quantities per warehouse and product variant. Returns raw quantities only — no reorder-level/low-stock threshold exists in this system.';
  readonly parameters = {
    type: 'object',
    properties: {
      warehouseId: {
        type: 'string',
        format: 'uuid',
        description: 'Optional: filter to one warehouse',
      },
    },
  };
  readonly requiredPermission = 'reports.inventory.read';

  constructor(
    private readonly inventoryReportsService: InventoryReportsService,
  ) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<unknown> {
    const args = await validateToolArguments(WarehouseArgsDto, rawArguments);
    return this.inventoryReportsService.stockSummary(context.companyId, {
      warehouseId: args.warehouseId,
      branchId: context.branchId,
      allowedBranchIds: context.allowedBranchIds,
    });
  }
}
