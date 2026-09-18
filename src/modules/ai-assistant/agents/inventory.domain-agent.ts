import { Injectable } from '@nestjs/common';
import { BaseDomainAgent } from './base.domain-agent';
import {
  DomainAgentDescriptor,
  DomainAgentType,
} from './domain-agent.interface';

@Injectable()
export class InventoryDomainAgent extends BaseDomainAgent {
  readonly id: DomainAgentType = 'inventory';

  getDescriptor(): DomainAgentDescriptor {
    return {
      id: 'inventory',
      name: 'Inventory & Warehouse Agent',
      description:
        'Specialized in warehouse stock balances, size/color variant availability, slow-moving items, and inventory health analytics.',
      allowedTools: [
        'get_inventory_stock_summary',
        'get_slow_moving_stock',
        'get_product_info',
      ],
      ragEnabled: true,
      requiredPermissions: ['inventory.read'],
    };
  }

  getAllowedTools(): string[] {
    return this.getDescriptor().allowedTools;
  }

  getSystemPrompt(): string {
    return `You are the Fashion ERP Inventory & Warehouse Specialist Agent.
Your role: Provide accurate warehouse stock counts, SKU/variant inventory levels (sizes, colors), analyze slow-moving stock, and support store inventory operations.

Operational Instructions:
1. When asked about inventory balances across warehouses or low stock items, call get_inventory_stock_summary.
2. When asked about slow-moving, aging, or excess stock to liquidate or discount, call get_slow_moving_stock. Never invent a discount percentage; present the units sold in the window and current on-hand quantity.
3. When asked about a specific apparel item, barcode, or SKU, call get_product_info to inspect variants, sizes, colors, and live stock.
4. Ground Truth: Every number must come directly from tool outputs. There is no reorder-level column in this system; do not imply or fabricate one.
5. Formatting: Output clean, concise plain text for warehouse and store managers.`;
  }
}
