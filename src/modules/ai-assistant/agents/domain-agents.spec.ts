import { InventoryDomainAgent } from './inventory.domain-agent';
import { SalesPosDomainAgent } from './sales-pos.domain-agent';
import { FinanceDomainAgent } from './finance.domain-agent';
import { CustomerServiceDomainAgent } from './customer-service.domain-agent';

describe('Domain Agents Isolation (Phase 2)', () => {
  describe('InventoryDomainAgent', () => {
    const agent = new InventoryDomainAgent();

    it('has id "inventory"', () => {
      expect(agent.id).toBe('inventory');
    });

    it('declares inventory descriptor and tools', () => {
      const desc = agent.getDescriptor();
      expect(desc.id).toBe('inventory');
      expect(desc.allowedTools).toContain('get_inventory_stock_summary');
      expect(desc.allowedTools).toContain('get_slow_moving_stock');
      expect(desc.allowedTools).toContain('get_product_info');
      expect(desc.allowedTools).not.toContain('get_profit_loss');
      expect(desc.allowedTools).not.toContain('get_sales_summary');
    });

    it('enforces isToolAllowed boundary', () => {
      expect(agent.isToolAllowed('get_inventory_stock_summary')).toBe(true);
      expect(agent.isToolAllowed('get_product_info')).toBe(true);
      expect(agent.isToolAllowed('get_profit_loss')).toBe(false);
      expect(agent.isToolAllowed('get_balance_sheet')).toBe(false);
    });

    it('provides specialized inventory system prompt', () => {
      const prompt = agent.getSystemPrompt();
      expect(prompt).toContain('Inventory & Warehouse');
      expect(prompt).toContain('get_inventory_stock_summary');
    });
  });

  describe('SalesPosDomainAgent', () => {
    const agent = new SalesPosDomainAgent();

    it('has id "sales_pos"', () => {
      expect(agent.id).toBe('sales_pos');
    });

    it('declares sales tools and excludes finance tools', () => {
      const desc = agent.getDescriptor();
      expect(desc.allowedTools).toContain('get_sales_summary');
      expect(desc.allowedTools).toContain('get_top_products');
      expect(desc.allowedTools).not.toContain('get_balance_sheet');
      expect(desc.allowedTools).not.toContain('get_ar_ap_aging');
    });

    it('enforces isToolAllowed boundary', () => {
      expect(agent.isToolAllowed('get_sales_summary')).toBe(true);
      expect(agent.isToolAllowed('get_top_products')).toBe(true);
      expect(agent.isToolAllowed('get_profit_loss')).toBe(false);
    });
  });

  describe('FinanceDomainAgent', () => {
    const agent = new FinanceDomainAgent();

    it('has id "finance"', () => {
      expect(agent.id).toBe('finance');
    });

    it('declares finance tools and excludes inventory/sales tools', () => {
      const desc = agent.getDescriptor();
      expect(desc.allowedTools).toContain('get_profit_loss');
      expect(desc.allowedTools).toContain('get_balance_sheet');
      expect(desc.allowedTools).toContain('get_ar_ap_aging');
      expect(desc.allowedTools).not.toContain('get_slow_moving_stock');
      expect(desc.allowedTools).not.toContain('get_sales_summary');
    });

    it('enforces isToolAllowed boundary', () => {
      expect(agent.isToolAllowed('get_profit_loss')).toBe(true);
      expect(agent.isToolAllowed('get_balance_sheet')).toBe(true);
      expect(agent.isToolAllowed('get_ar_ap_aging')).toBe(true);
      expect(agent.isToolAllowed('get_slow_moving_stock')).toBe(false);
    });
  });

  describe('CustomerServiceDomainAgent', () => {
    const agent = new CustomerServiceDomainAgent();

    it('has id "customer_service"', () => {
      expect(agent.id).toBe('customer_service');
    });

    it('allows only catalog discovery tools and hides internal reports', () => {
      const desc = agent.getDescriptor();
      expect(desc.allowedTools).toEqual(['get_product_info']);
      expect(desc.requiredPermissions).toBeUndefined();
    });

    it('enforces isToolAllowed boundary', () => {
      expect(agent.isToolAllowed('get_product_info')).toBe(true);
      expect(agent.isToolAllowed('get_profit_loss')).toBe(false);
      expect(agent.isToolAllowed('get_sales_summary')).toBe(false);
    });
  });
});
