import { Injectable, Logger } from '@nestjs/common';
import {
  LlmChatOptions,
  LlmChatResult,
  LlmEmbeddingResult,
  LlmProvider,
  LlmToolCall,
} from './llm-provider.interface';

// Exact real result shapes returned by the 6 AI tools (see
// src/modules/ai-assistant/tools/*.tool.ts and the report services they
// wrap) — used only to format a real, already-fetched result into prose,
// never to re-derive or invent a field that isn't actually there.
interface SalesSummaryResult {
  saleCount: number;
  grandTotal: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
}
interface TopProductRow {
  productName: string;
  unitsSold: number;
  revenue: string;
}
interface InventoryStockRow {
  warehouseId: string;
  warehouseName: string;
  productVariantId: string;
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
}
interface ArApAgingResult {
  asOfDate: string;
  receivables: unknown[];
  payables: unknown[];
  totalReceivables: string;
  totalPayables: string;
}
interface AccountAmountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount?: string;
  balance?: string;
}
interface ProfitLossResult {
  fromDate: string | null;
  toDate: string | null;
  revenue: { rows: AccountAmountRow[]; total: string };
  expense: { rows: AccountAmountRow[]; total: string };
  netIncome: string;
}
interface BalanceSheetResult {
  asOfDate: string;
  assets: { rows: AccountAmountRow[]; total: string };
  liabilities: { rows: AccountAmountRow[]; total: string };
  equity: { rows: AccountAmountRow[]; total: string };
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
}

/**
 * Deterministic, API-key-free provider used when no remote or local LLM is
 * reachable (Phase 19.1). This is NOT a language model — it never generates
 * free-form text from scratch. It only does two things:
 *
 *   1. chat(): keyword-matches the latest user message against the real,
 *      already-permission-filtered tool list it was given and, if matched,
 *      returns a synthetic `toolCalls` response shaped exactly like a real
 *      LLM's tool-call turn. This is not a shortcut around
 *      AiToolExecutorService — the SAME execute() path (permission
 *      re-check, DataScope resolution, real report service call) still
 *      runs; runChatWithTools() in AiChatService cannot tell the
 *      difference between this and a real provider requesting a tool.
 *      On the round AFTER a tool result comes back (a `tool`-role message
 *      is present in the conversation), it formats that real,
 *      already-fetched JSON result into a short deterministic sentence —
 *      it never re-derives or embellishes the numbers.
 *
 *   2. embed(): a deterministic, non-semantic hash-based vector (same
 *      technique as the e2e test's FakeLlmProvider). This intentionally
 *      does NOT provide real semantic search — it exists only so
 *      AiRagService's cosine-similarity retrieval and the ingestion
 *      pipeline keep functioning end-to-end without an external embedding
 *      API. Every vector produced here is tagged with a distinct model
 *      name ("local-fallback-hash-v1", a fixed 32 dimensions) specifically
 *      so it is never silently compared against a real provider's
 *      differently-dimensioned vectors (see cosineSimilarity's
 *      Math.min(a.length,b.length) truncation behavior in AiRagService —
 *      mixing dimensions there would silently degrade rather than error).
 *
 * If neither the keyword router nor RAG can answer, it returns an honest
 * "I don't have enough information" reply — it never fabricates a number.
 */
@Injectable()
export class LocalFallbackProvider implements LlmProvider {
  private readonly logger = new Logger(LocalFallbackProvider.name);

  private static readonly EMBEDDING_DIMENSIONS = 32;
  private static readonly EMBEDDING_MODEL_NAME = 'local-fallback-hash-v1';

  /**
   * Keyword -> tool name. Matched against the lowercased latest user
   * message. Order matters only in that the first matching entry wins;
   * entries are ordered from most specific to least specific to avoid a
   * generic word ("sales") shadowing a more specific phrase
   * ("top selling products") that should route elsewhere.
   */
  private static readonly KEYWORD_ROUTES: Array<{
    toolName: string;
    keywords: string[];
  }> = [
    {
      toolName: 'get_top_products',
      keywords: ['top product', 'top selling', 'best seller', 'best selling'],
    },
    {
      toolName: 'get_sales_summary',
      keywords: ['sale', 'sales', 'revenue', 'today sale', 'today revenue'],
    },
    {
      toolName: 'get_inventory_stock_summary',
      keywords: ['stock', 'inventory', 'warehouse'],
    },
    {
      toolName: 'get_ar_ap_aging',
      keywords: [
        'ar aging',
        'ap aging',
        'aging',
        'receivable',
        'payable',
        'ar/ap',
      ],
    },
    {
      toolName: 'get_profit_loss',
      keywords: [
        'profit and loss',
        'profit & loss',
        'p&l',
        'p and l',
        'income statement',
      ],
    },
    {
      toolName: 'get_balance_sheet',
      keywords: ['balance sheet', 'assets and liabilities', 'equity'],
    },
  ];

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return false;
  }

  // interface requires Promise<LlmChatResult>; this implementation is
  // genuinely synchronous (deterministic keyword routing, no network/DB
  // calls).
  // eslint-disable-next-line @typescript-eslint/require-await
  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    const pendingToolResults = this.extractPendingToolResults(options);
    if (pendingToolResults.length > 0) {
      return {
        content: this.formatToolResults(pendingToolResults),
        toolCalls: null,
        model: LocalFallbackProvider.name,
        usage: null,
      };
    }

    const lastUserMessage = [...options.messages]
      .reverse()
      .find((message) => message.role === 'user');
    const question = lastUserMessage?.content ?? '';
    const availableToolNames = new Set(
      (options.tools ?? []).map((tool) => tool.name),
    );

    const matchedTool = this.matchTool(question, availableToolNames);
    if (matchedTool) {
      const toolCall: LlmToolCall = {
        id: `local-fallback-${Date.now()}`,
        name: matchedTool,
        arguments: '{}',
      };
      return {
        content: null,
        toolCalls: [toolCall],
        model: LocalFallbackProvider.name,
        usage: null,
      };
    }

    return {
      content: this.buildUnavailableReply(availableToolNames),
      toolCalls: null,
      model: LocalFallbackProvider.name,
      usage: null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async embed(texts: string[]): Promise<LlmEmbeddingResult> {
    this.logger.warn(
      `Generating ${texts.length} embedding(s) via the local deterministic fallback — this is NOT semantic search and must never be treated as production-quality retrieval.`,
    );
    return {
      embeddings: texts.map((text) => this.hashEmbed(text)),
      model: LocalFallbackProvider.EMBEDDING_MODEL_NAME,
      usage: null,
    };
  }

  /** Finds the most recent unbroken run of `tool`-role messages at the end
   * of the conversation (i.e. results just returned this round) — mirrors
   * how a real LLM would look at the latest tool outputs before replying. */
  private extractPendingToolResults(
    options: LlmChatOptions,
  ): Array<{ name?: string; content: string }> {
    const results: Array<{ name?: string; content: string }> = [];
    for (let i = options.messages.length - 1; i >= 0; i -= 1) {
      const message = options.messages[i];
      if (message.role !== 'tool') break;
      results.unshift({ name: message.name, content: message.content });
    }
    return results;
  }

  private matchTool(
    question: string,
    availableToolNames: Set<string>,
  ): string | undefined {
    const normalized = question.toLowerCase();
    for (const route of LocalFallbackProvider.KEYWORD_ROUTES) {
      if (!availableToolNames.has(route.toolName)) continue;
      if (route.keywords.some((keyword) => normalized.includes(keyword))) {
        return route.toolName;
      }
    }
    return undefined;
  }

  private formatToolResults(
    pendingToolResults: Array<{ name?: string; content: string }>,
  ): string {
    const sentences = pendingToolResults.map((toolResult) =>
      this.formatSingleToolResult(toolResult),
    );
    return sentences.join('\n\n');
  }

  // AiMessage.content is a MySQL TEXT column (64KB limit) — a tool result
  // like inventory stock summary can return one row per (warehouse, SKU)
  // and blow well past that if dumped as pretty-printed JSON. Truncating
  // an array here is an honest disclosure (an explicit "showing first N
  // of M" note), never a silent data loss or a fabricated summary of
  // rows that were cut.
  private static readonly MAX_ARRAY_ROWS = 25;
  private static readonly MAX_CONTENT_CHARS = 8000;

  private formatSingleToolResult(toolResult: {
    name?: string;
    content: string;
  }): string {
    let parsed: {
      toolName?: string;
      success?: boolean;
      error?: string;
      result?: unknown;
    };
    try {
      parsed = JSON.parse(toolResult.content) as typeof parsed;
    } catch {
      return "I retrieved data but couldn't format it — please check the AI Assistant's tool integration.";
    }

    if (!parsed.success) {
      return `I couldn't retrieve that: ${parsed.error ?? 'the data is unavailable.'}`;
    }

    const toolName = parsed.toolName ?? toolResult.name;
    let formatted = this.formatResultAsProse(toolName, parsed.result);

    if (formatted.length > LocalFallbackProvider.MAX_CONTENT_CHARS) {
      // Last-resort safety net if even the row-capped result is still too
      // large (e.g. very many accounts on a statement) — never let this
      // exceed the DB column limit, but say so explicitly.
      formatted =
        formatted.slice(0, LocalFallbackProvider.MAX_CONTENT_CHARS) +
        '\n... (truncated — the full result was too large to display)';
    }

    return formatted;
  }

  /**
   * Real numbers, plain sentences — never a raw JSON dump in the chat
   * reply (that's for developers, not the person asking "what were
   * today's sales"). Every value read here comes straight from the real
   * tool result with no re-derivation: this only chooses which fields to
   * mention and how to lay them out, never computes a new figure. An
   * unrecognized tool name (future tool added without a formatter here)
   * falls back to a labeled JSON block rather than silently dropping the
   * data.
   */
  private formatResultAsProse(
    toolName: string | undefined,
    result: unknown,
  ): string {
    switch (toolName) {
      case 'get_sales_summary':
        return this.formatSalesSummary(result as SalesSummaryResult);
      case 'get_top_products':
        return this.formatTopProducts(result as TopProductRow[]);
      case 'get_inventory_stock_summary':
        return this.formatInventorySummary(result as InventoryStockRow[]);
      case 'get_ar_ap_aging':
        return this.formatArApAging(result as ArApAgingResult);
      case 'get_profit_loss':
        return this.formatProfitLoss(result as ProfitLossResult);
      case 'get_balance_sheet':
        return this.formatBalanceSheet(result as BalanceSheetResult);
      default:
        return this.formatAsJsonFallback(toolName, result);
    }
  }

  private formatSalesSummary(result: SalesSummaryResult): string {
    if (!result || typeof result !== 'object')
      return this.formatAsJsonFallback('get_sales_summary', result);
    return [
      `You had ${this.plural(result.saleCount, 'sale')} totaling ${this.money(result.grandTotal)}.`,
      `Subtotal: ${this.money(result.subtotal)} · Discounts: ${this.money(result.discountAmount)} · Tax: ${this.money(result.taxAmount)}`,
    ].join('\n');
  }

  private formatTopProducts(rows: TopProductRow[]): string {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 'No product sales found for that period.';
    }
    const capped = rows.slice(0, LocalFallbackProvider.MAX_ARRAY_ROWS);
    const lines = capped.map(
      (row, index) =>
        `${index + 1}. ${row.productName} — ${this.plural(row.unitsSold, 'unit')} sold, ${this.money(row.revenue)} revenue`,
    );
    const header = 'Top products by revenue:';
    const note =
      rows.length > capped.length
        ? `\n\n(Showing the top ${capped.length} of ${rows.length}.)`
        : '';
    return `${header}\n${lines.join('\n')}${note}`;
  }

  private formatInventorySummary(rows: InventoryStockRow[]): string {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 'No inventory records found.';
    }
    const capped = rows.slice(0, LocalFallbackProvider.MAX_ARRAY_ROWS);
    const lines = capped.map((row) => {
      const available = row.onHandQuantity - row.reservedQuantity;
      return `• ${row.sku} (${row.warehouseName}) — ${row.onHandQuantity} on hand, ${row.reservedQuantity} reserved, ${available} available`;
    });
    const header = `Inventory across ${new Set(rows.map((r) => r.warehouseId)).size} warehouse(s), ${rows.length} SKU record(s):`;
    const note =
      rows.length > capped.length
        ? `\n\n(Showing the first ${capped.length} of ${rows.length} records.)`
        : '';
    return `${header}\n${lines.join('\n')}${note}`;
  }

  private formatArApAging(result: ArApAgingResult): string {
    if (!result || typeof result !== 'object')
      return this.formatAsJsonFallback('get_ar_ap_aging', result);
    const parts = [
      `As of ${result.asOfDate}:`,
      `Total receivables: ${this.money(result.totalReceivables)} (${this.plural(result.receivables?.length ?? 0, 'customer')})`,
      `Total payables: ${this.money(result.totalPayables)} (${this.plural(result.payables?.length ?? 0, 'supplier')})`,
    ];
    return parts.join('\n');
  }

  private formatProfitLoss(result: ProfitLossResult): string {
    if (!result || typeof result !== 'object')
      return this.formatAsJsonFallback('get_profit_loss', result);
    const period =
      result.fromDate && result.toDate
        ? `${result.fromDate} to ${result.toDate}`
        : 'all recorded activity';
    return [
      `Profit & Loss (${period}):`,
      `Revenue: ${this.money(result.revenue?.total)} across ${this.plural(result.revenue?.rows?.length ?? 0, 'account')}`,
      `Expenses: ${this.money(result.expense?.total)} across ${this.plural(result.expense?.rows?.length ?? 0, 'account')}`,
      `Net income: ${this.money(result.netIncome)}`,
    ].join('\n');
  }

  private formatBalanceSheet(result: BalanceSheetResult): string {
    if (!result || typeof result !== 'object')
      return this.formatAsJsonFallback('get_balance_sheet', result);
    return [
      `Balance Sheet as of ${result.asOfDate}:`,
      `Assets: ${this.money(result.assets?.total)}`,
      `Liabilities: ${this.money(result.liabilities?.total)}`,
      `Equity: ${this.money(result.equity?.total)}`,
      result.balanced
        ? 'Books are balanced.'
        : `Books are NOT balanced (total liabilities + equity: ${this.money(result.totalLiabilitiesAndEquity)}).`,
    ].join('\n');
  }

  private formatAsJsonFallback(
    toolName: string | undefined,
    result: unknown,
  ): string {
    const toolLabel = this.humanizeToolName(toolName);
    const { display, truncationNote } = this.boundResultForDisplay(result);
    let formatted = `Here is the data for ${toolLabel}:\n\`\`\`json\n${JSON.stringify(display, null, 2)}\n\`\`\``;
    if (truncationNote) formatted += `\n\n${truncationNote}`;
    return formatted;
  }

  private boundResultForDisplay(result: unknown): {
    display: unknown;
    truncationNote?: string;
  } {
    if (!Array.isArray(result)) {
      return { display: result };
    }
    if (result.length <= LocalFallbackProvider.MAX_ARRAY_ROWS) {
      return { display: result };
    }
    return {
      display: result.slice(0, LocalFallbackProvider.MAX_ARRAY_ROWS),
      truncationNote: `Showing the first ${LocalFallbackProvider.MAX_ARRAY_ROWS} of ${result.length} rows.`,
    };
  }

  private humanizeToolName(toolName: string | undefined): string {
    if (!toolName) return 'your request';
    return toolName.replace(/^get_/, '').replace(/_/g, ' ');
  }

  /** Real backend decimal strings (e.g. "1234.50") formatted as currency
   * for prose — never re-derived from a different source, only
   * reformatted for display. Falls back to the raw string if it isn't a
   * parseable number rather than silently showing $0.00. */
  private money(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private plural(count: number | undefined, noun: string): string {
    const n = count ?? 0;
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }

  private buildUnavailableReply(availableToolNames: Set<string>): string {
    if (availableToolNames.size === 0) {
      return "I don't have access to any business data tools for your account right now — this may be a permissions issue. I couldn't find enough information to answer that from your available ERP data or knowledge base.";
    }
    return "I couldn't find enough information to answer that from your available ERP data or knowledge base. I can help with: today's sales, top products, inventory stock levels, AR/AP aging, profit & loss, and the balance sheet — try asking about one of those.";
  }

  /** Deterministic, non-semantic hash embedding — same normalization
   * technique as the e2e test's FakeLlmProvider, extended to a fixed
   * dimensionality so it is distinguishable from (and never silently
   * mixed with) a real provider's embedding space. */
  private hashEmbed(text: string): number[] {
    const dimensions = LocalFallbackProvider.EMBEDDING_DIMENSIONS;
    const vector = new Array<number>(dimensions).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const bucket = i % dimensions;
      vector[bucket] += text.charCodeAt(i);
    }
    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );
    if (magnitude === 0) return vector;
    return vector.map((value) => value / magnitude);
  }
}
