import { LocalFallbackProvider } from './local-fallback.provider';
import { LlmChatOptions, LlmToolDefinition } from './llm-provider.interface';

describe('LocalFallbackProvider', () => {
  let provider: LocalFallbackProvider;

  const salesTool: LlmToolDefinition = {
    name: 'get_sales_summary',
    description: 'Get total sales for a date range.',
    parameters: { type: 'object', properties: {} },
  };
  const inventoryTool: LlmToolDefinition = {
    name: 'get_inventory_stock_summary',
    description: 'Get stock levels.',
    parameters: { type: 'object', properties: {} },
  };

  beforeEach(() => {
    provider = new LocalFallbackProvider();
  });

  describe('supportsToolCalling/supportsStreaming', () => {
    it('supports tool calling, never streaming', () => {
      expect(provider.supportsToolCalling()).toBe(true);
      expect(provider.supportsStreaming()).toBe(false);
    });
  });

  describe('chat — keyword routing', () => {
    it('emits a synthetic tool call for a matched, permitted tool rather than answering directly', async () => {
      const options: LlmChatOptions = {
        messages: [{ role: 'user', content: 'what were todays sales' }],
        tools: [salesTool],
      };
      const result = await provider.chat(options);
      expect(result.content).toBeNull();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].name).toBe('get_sales_summary');
      // Real tools always take an object arguments payload — never a
      // fabricated/guessed value beyond an empty object, since the
      // keyword router has no way to extract real date-range/UUID
      // arguments from free text.
      expect(JSON.parse(result.toolCalls?.[0].arguments ?? '')).toEqual({});
    });

    it('never routes to a tool the caller was not given (permission filtering already happened upstream)', async () => {
      const options: LlmChatOptions = {
        messages: [{ role: 'user', content: 'what were todays sales' }],
        tools: [inventoryTool], // sales tool NOT in the available list
      };
      const result = await provider.chat(options);
      expect(result.toolCalls).toBeNull();
      expect(result.content).toContain("couldn't find enough information");
    });

    it('returns an honest "cannot answer" reply for an unmatched question, never a fabricated number', async () => {
      const options: LlmChatOptions = {
        messages: [{ role: 'user', content: 'what is the meaning of life' }],
        tools: [salesTool],
      };
      const result = await provider.chat(options);
      expect(result.toolCalls).toBeNull();
      expect(result.content).toMatch(/couldn't find enough information/i);
    });

    it('mentions no available tools honestly when the caller has none', async () => {
      const options: LlmChatOptions = {
        messages: [{ role: 'user', content: 'what were todays sales' }],
        tools: [],
      };
      const result = await provider.chat(options);
      expect(result.content).toMatch(/permissions issue/i);
    });
  });

  describe('chat — formatting a real tool result', () => {
    function toolResultMessage(
      toolName: string,
      payload: Record<string, unknown>,
    ) {
      return {
        role: 'tool' as const,
        content: JSON.stringify(payload),
        toolCallId: 'call-1',
        name: toolName,
      };
    }

    it('formats a sales summary as human-readable prose, not raw JSON, with every real number present', async () => {
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'todays sales' },
          toolResultMessage('get_sales_summary', {
            toolName: 'get_sales_summary',
            success: true,
            result: {
              saleCount: 3,
              grandTotal: '150.00',
              subtotal: '140.00',
              discountAmount: '5.00',
              taxAmount: '15.00',
            },
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.toolCalls).toBeNull();
      expect(result.content).not.toContain('```json');
      expect(result.content).toContain('3 sales');
      expect(result.content).toContain('$150.00');
      expect(result.content).toContain('$140.00');
      expect(result.content).toContain('$5.00');
      expect(result.content).toContain('$15.00');
    });

    it('formats top products as a numbered, human-readable list', async () => {
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'top selling products' },
          toolResultMessage('get_top_products', {
            toolName: 'get_top_products',
            success: true,
            result: [
              { productName: 'Blue Shirt', unitsSold: 10, revenue: '250.00' },
              { productName: 'Red Hat', unitsSold: 5, revenue: '75.00' },
            ],
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.content).not.toContain('```json');
      expect(result.content).toContain('1. Blue Shirt');
      expect(result.content).toContain('10 units sold');
      expect(result.content).toContain('$250.00');
      expect(result.content).toContain('2. Red Hat');
    });

    it('formats a balance sheet as prose, including the balanced/unbalanced status', async () => {
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'balance sheet' },
          toolResultMessage('get_balance_sheet', {
            toolName: 'get_balance_sheet',
            success: true,
            result: {
              asOfDate: '2026-08-21',
              assets: { rows: [], total: '1000.00' },
              liabilities: { rows: [], total: '400.00' },
              equity: { rows: [], total: '600.00' },
              totalLiabilitiesAndEquity: '1000.00',
              balanced: true,
            },
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.content).not.toContain('```json');
      expect(result.content).toContain('$1,000.00');
      expect(result.content).toContain('$400.00');
      expect(result.content).toContain('$600.00');
      expect(result.content).toMatch(/balanced/i);
    });

    it('surfaces a real tool-denial error honestly rather than hiding or faking success', async () => {
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'todays sales' },
          toolResultMessage('get_sales_summary', {
            toolName: 'get_sales_summary',
            success: false,
            error: 'You do not have permission to access this data.',
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.content).toContain(
        'You do not have permission to access this data.',
      );
    });

    it('formats inventory as a bulleted list, truncated with an honest disclosure rather than exceeding the DB column size', async () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        warehouseId: 'wh-1',
        warehouseName: 'Main Warehouse',
        productVariantId: `pv-${i}`,
        sku: `SKU-${i}`,
        onHandQuantity: i,
        reservedQuantity: 0,
      }));
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'inventory' },
          toolResultMessage('get_inventory_stock_summary', {
            toolName: 'get_inventory_stock_summary',
            success: true,
            result: rows,
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.content).not.toContain('```json');
      expect(result.content).toContain('Showing the first 25 of 100');
      expect((result.content?.match(/SKU-\d+/g) ?? []).length).toBe(25);
      // Never exceed the AiMessage.content TEXT column's realistic bound.
      expect(result.content?.length ?? 0).toBeLessThan(9000);
    });

    it('falls back to a labeled JSON block for a tool with no dedicated formatter, never silently dropping the data', async () => {
      const options: LlmChatOptions = {
        messages: [
          { role: 'user', content: 'something else' },
          toolResultMessage('get_some_future_tool', {
            toolName: 'get_some_future_tool',
            success: true,
            result: { futureField: 'futureValue' },
          }),
        ],
      };
      const result = await provider.chat(options);
      expect(result.content).toContain('```json');
      expect(result.content).toContain('"futureField": "futureValue"');
    });
  });

  describe('embed', () => {
    it('produces a deterministic vector tagged with its own distinct model name', async () => {
      const result = await provider.embed(['hello world']);
      expect(result.model).toBe('local-fallback-hash-v1');
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toHaveLength(32);
      expect(result.usage).toBeNull();
    });

    it('is deterministic — the same text always produces the same vector', async () => {
      const first = await provider.embed(['same input']);
      const second = await provider.embed(['same input']);
      expect(first.embeddings[0]).toEqual(second.embeddings[0]);
    });

    it('produces different vectors for different text (not a constant stub)', async () => {
      const result = await provider.embed(['alpha', 'beta']);
      expect(result.embeddings[0]).not.toEqual(result.embeddings[1]);
    });
  });
});
