import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { ReportsModule } from '../reports/reports.module';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiKnowledgeDocument } from './entities/ai-knowledge-document.entity';
import { AiKnowledgeChunk } from './entities/ai-knowledge-chunk.entity';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { OllamaCompatibleProvider } from './providers/ollama-compatible.provider';
import { LocalFallbackProvider } from './providers/local-fallback.provider';
import { HybridLlmProvider } from './providers/hybrid-llm.provider';
import { LLM_PROVIDER } from './providers/llm-provider.interface';
import { AiChatService } from './services/ai-chat.service';
import { AiConversationService } from './services/ai-conversation.service';
import { AiRagService } from './services/ai-rag.service';
import { AiToolExecutorService } from './services/ai-tool-executor.service';
import { AiKnowledgeService } from './services/ai-knowledge.service';
import { AiChatController } from './controllers/ai-chat.controller';
import { AiConversationsController } from './controllers/ai-conversations.controller';
import { AiKnowledgeController } from './controllers/ai-knowledge.controller';
import { KnowledgeIngestionWorker } from './workers/knowledge-ingestion.worker';
import { AI_TOOLS, AiTool } from './tools/ai-tool.interface';
import { SalesSummaryTool } from './tools/sales-summary.tool';
import { TopProductsTool } from './tools/top-products.tool';
import { InventoryStockSummaryTool } from './tools/inventory-stock-summary.tool';
import { ArApAgingTool } from './tools/ar-ap-aging.tool';
import { ProfitLossTool } from './tools/profit-loss.tool';
import { BalanceSheetTool } from './tools/balance-sheet.tool';

const AI_TOOL_PROVIDERS = [
  SalesSummaryTool,
  TopProductsTool,
  InventoryStockSummaryTool,
  ArApAgingTool,
  ProfitLossTool,
  BalanceSheetTool,
];

/**
 * Phase 19 — AI Assistant/RAG. Depends on ReportsModule since every AI
 * "tool" is a thin, authorization-checked wrapper around a real, existing
 * reporting service (SalesReportsService/InventoryReportsService/
 * ArApAgingService/ProfitLossService/BalanceSheetService) — no parallel
 * query logic. QueueModule/RedisModule are @Global (same as
 * NotificationsModule/WebhooksModule rely on), so no explicit import is
 * needed for QueueService.
 *
 * LLM_PROVIDER resolves to HybridLlmProvider (Phase 19.1), a per-request
 * router trying remote LLM -> optional local LLM -> deterministic
 * fallback in priority order on every call — not a single provider picked
 * once at startup. Every consumer (AiChatService/AiRagService/
 * KnowledgeIngestionWorker) still depends on the LlmProvider interface
 * only, never a concrete provider class, so this swap is fully transparent
 * to them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiConversation,
      AiMessage,
      AiKnowledgeDocument,
      AiKnowledgeChunk,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    ReportsModule,
  ],
  providers: [
    OpenAiCompatibleProvider,
    OllamaCompatibleProvider,
    LocalFallbackProvider,
    HybridLlmProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: HybridLlmProvider,
    },
    AiChatService,
    AiConversationService,
    AiRagService,
    AiToolExecutorService,
    AiKnowledgeService,
    KnowledgeIngestionWorker,
    ...AI_TOOL_PROVIDERS,
    {
      provide: AI_TOOLS,
      useFactory: (...tools: AiTool[]): AiTool[] => tools,
      inject: AI_TOOL_PROVIDERS,
    },
  ],
  controllers: [
    AiChatController,
    AiConversationsController,
    AiKnowledgeController,
  ],
  exports: [AiChatService],
})
export class AiAssistantModule {}
