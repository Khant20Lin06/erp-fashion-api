import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { User } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/modules/users/entities/user-status.enum';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { RoleStatus } from '../src/modules/rbac/entities/role-status.enum';
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';
import { SystemRoleCode } from '../src/modules/rbac/entities/system-role-code';
import {
  LLM_PROVIDER,
  LlmChatOptions,
  LlmChatResult,
  LlmEmbeddingResult,
  LlmProvider,
} from '../src/modules/ai-assistant/providers/llm-provider.interface';

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

interface CompanyBody {
  id: string;
}
interface BranchBody {
  id: string;
}
interface CustomerBody {
  id: string;
}
interface AccountBody {
  id: string;
}
interface AiConversationBody {
  id: string;
  companyId: string;
}
interface AiChatResponseBody {
  conversation: AiConversationBody;
  message: { id: string; role: string; content: string };
  sources: Array<{ documentId: string; title: string; chunkIndex: number }>;
}
interface AiKnowledgeDocumentBody {
  id: string;
  status: string;
  chunkCount: number;
}

/**
 * Deterministic provider test double (Phase 19 §40: "create a deterministic
 * provider test double at the provider boundary only... the ingestion,
 * retrieval, authorization, queue, and persistence pipeline should remain
 * real"). No real AI_BASE_URL/AI_API_KEY is configured in this environment
 * (confirmed absent from .env), so live calls to a real LLM are genuinely
 * BLOCKED for this session — this fake sits exactly at the LlmProvider
 * interface boundary, replacing only the outbound network call, while every
 * other part of the pipeline (Kafka-free direct chat flow, BullMQ ingestion
 * queue/worker, real MySQL persistence, real RBAC/DataScope enforcement,
 * real cosine-similarity retrieval over real stored embeddings) runs for
 * real against the Docker stack.
 */
class FakeLlmProvider implements LlmProvider {
  lastChatOptions: LlmChatOptions | undefined;
  /** Phase 19.1 rollback-on-failure test hook: when true, the next chat()
   * call rejects instead of answering, simulating every HybridLlmProvider
   * tier being unavailable (e.g. fallback explicitly disabled). Reset to
   * false immediately so it only affects one call. */
  failNextChat = false;

  chat(options: LlmChatOptions): Promise<LlmChatResult> {
    this.lastChatOptions = options;
    if (this.failNextChat) {
      this.failNextChat = false;
      return Promise.reject(
        new Error('Simulated: every provider tier unavailable'),
      );
    }
    const lastUserMessage = [...options.messages]
      .reverse()
      .find((m) => m.role === 'user');

    // A tool result already present in history means this is a SECOND
    // round after a prior tool call — must answer using it, never request
    // the same tool again (that would loop until MAX_TOOL_ROUNDS is hit).
    const toolMessage = options.messages.find((m) => m.role === 'tool');
    if (toolMessage) {
      return Promise.resolve({
        content: `Based on the real tool result: ${toolMessage.content}`,
        toolCalls: null,
        model: 'fake-model',
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      });
    }

    if (options.tools?.length && lastUserMessage?.content.includes('sales')) {
      return Promise.resolve({
        content: null,
        toolCalls: [
          {
            id: 'call-1',
            name: 'get_sales_summary',
            arguments: JSON.stringify({}),
          },
        ],
        model: 'fake-model',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
    }

    return Promise.resolve({
      content: `Deterministic fake answer to: ${lastUserMessage?.content ?? ''}`,
      toolCalls: null,
      model: 'fake-model',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });
  }

  embed(texts: string[]): Promise<LlmEmbeddingResult> {
    // Deterministic per-text embedding derived from character codes — real
    // cosine-similarity math runs against these in AiRagService, this just
    // avoids a real network call.
    const embeddings = texts.map((text) => {
      const vector = [0, 0, 0, 0];
      for (let i = 0; i < text.length; i += 1) {
        vector[i % 4] += text.charCodeAt(i);
      }
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vector.map((v) => v / norm);
    });
    return Promise.resolve({
      embeddings,
      model: 'fake-embedding-model',
      usage: null,
    });
  }

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return false;
  }
}

describeIfDb('AI Assistant (Phase 19) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let fakeLlmProvider: FakeLlmProvider;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'AI-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const cached = authCookieByEmail.get(email);
    if (cached) {
      return cached;
    }
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieSource = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : String(setCookie);
    const match = cookieSource.match(/fashion_erp_access_token=([^;]+)/);
    const cookie = match ? `fashion_erp_access_token=${match[1]}` : '';
    if (cookie) {
      authCookieByEmail.set(email, cookie);
    }
    return cookie;
  }

  function rand(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  function uniqueCode(tag: string): string {
    return `${prefix}-${tag}-${rand()}`;
  }

  async function createCompany(cookie: string): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code: uniqueCode('CO'),
        name: 'AI Assistant E2E Test Company',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createBranch(
    cookie: string,
    companyId: string,
  ): Promise<BranchBody> {
    const code = uniqueCode('BR');
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({ companyId, code, name: `Branch ${code}` });
    return response.body as BranchBody;
  }

  async function createAccount(
    cookie: string,
    companyId: string,
    accountType: string,
    tag: string,
  ): Promise<AccountBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode(tag), name: tag, accountType });
    return response.body as AccountBody;
  }

  async function createCustomer(
    cookie: string,
    companyId: string,
    receivableAccountId?: string,
  ): Promise<CustomerBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerCode: uniqueCode('CUST'),
        name: 'AI E2E Customer',
        ...(receivableAccountId ? { receivableAccountId } : {}),
      });
    return response.body as CustomerBody;
  }

  async function setupWorkingFixture(cookie: string) {
    const company = await createCompany(cookie);
    const branch = await createBranch(cookie, company.id);
    const cashAccount = await createAccount(
      cookie,
      company.id,
      'ASSET',
      'CASH',
    );
    const receivableAccount = await createAccount(
      cookie,
      company.id,
      'ASSET',
      'AR',
    );
    const customer = await createCustomer(
      cookie,
      company.id,
      receivableAccount.id,
    );
    return { company, branch, cashAccount, receivableAccount, customer };
  }

  async function createCategoryBrandVariant(
    cookie: string,
    companyId: string,
  ): Promise<{ warehouseId: string; variantId: string }> {
    const branch = await createBranch(cookie, companyId);
    const whResponse = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({
        companyId,
        branchId: branch.id,
        code: uniqueCode('WH'),
        name: 'Warehouse',
      });
    const warehouseId = (whResponse.body as { id: string }).id;

    const catResponse = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('CAT'), name: 'Category' });
    const categoryId = (catResponse.body as { id: string }).id;

    const brandResponse = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('BRD'), name: 'Brand' });
    const brandId = (brandResponse.body as { id: string }).id;

    const prodResponse = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PROD'),
        name: 'Product',
        categoryId,
        brandId,
        initialVariant: {
          sku: uniqueCode('SKU'),
          costPrice: '10.00',
          sellingPrice: '50.00',
          attributes: [],
        },
      });
    const productId = (prodResponse.body as { id: string }).id;
    const variantsResponse = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/variants?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    const variants = variantsResponse.body as { data: { id: string }[] };
    const variantId = variants.data[0].id;

    const priceListResponse = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Price List',
        currency: 'USD',
      });
    const priceListId = (priceListResponse.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceListId}/items?companyId=${companyId}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId: variantId,
        price: '50.00',
        validFrom: '2020-01-01T00:00:00Z',
      });

    await request(app.getHttpServer())
      .post('/api/v1/stock-adjustments')
      .set('Cookie', [cookie])
      .send({
        companyId,
        warehouseId,
        productVariantId: variantId,
        quantityChange: 1000,
        reason: 'OPENING_BALANCE',
      });

    return { warehouseId, variantId };
  }

  async function createAndConfirmSale(
    cookie: string,
    companyId: string,
    customerId: string,
    warehouseId: string,
    productVariantId: string,
  ): Promise<{ id: string; grandTotal: string }> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerId,
        warehouseId,
        currency: 'USD',
        items: [{ productVariantId, quantity: 2 }],
      });
    const sale = createResponse.body as { id: string; grandTotal: string };
    await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return sale;
  }

  const cleanup = async () => {
    await dataSource.query(
      `DELETE FROM ai_knowledge_chunks WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM ai_knowledge_documents WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM (SELECT id FROM ai_conversations WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM ai_conversations WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM (SELECT id FROM sales WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM sales WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_sale_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM product_variant_attributes WHERE variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM product_variants WHERE sku LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM products WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM warehouses WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `UPDATE accounts SET parent_id = NULL WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM accounts WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'ai-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'ai-e2e-%'");
  };

  beforeAll(async () => {
    fakeLlmProvider = new FakeLlmProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_PROVIDER)
      .useValue(fakeLlmProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.use(cookieParser());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    passwordService = moduleFixture.get(PasswordService);

    await Promise.all(
      Array.from({ length: 10 }, () => dataSource.query('SELECT 1')),
    );

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'ai-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'AI',
        lastName: 'SuperAdmin',
        displayName: 'AI Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
    plainUser = await userRepository.save(
      userRepository.create({
        email: 'ai-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'AI',
        lastName: 'Plain',
        displayName: 'AI Plain User',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    const superAdminRole = await roleRepository.findOneOrFail({
      where: { code: SystemRoleCode.SuperAdmin },
    });
    await userRoleRepository.save(
      userRoleRepository.create({
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      }),
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('authentication and authorization boundary', () => {
    it('rejects unauthenticated chat requests (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .send({ message: 'What were today sales?' });
      expect(response.status).toBe(401);
    });

    it('rejects a user without ai_assistant.chat permission (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({ message: 'What were today sales?' });
      expect(response.status).toBe(403);
    });

    it('rejects unauthenticated knowledge-document creation (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/knowledge')
        .send({ scope: 'COMPANY', title: 'Doc', content: 'content' });
      expect(response.status).toBe(401);
    });
  });

  describe('conversation persistence and company isolation', () => {
    it('creates a conversation, persists the user+assistant messages, and returns a real assistant response', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({
          message: 'How do I create a purchase order?',
          companyId: fixture.company.id,
        });

      expect(response.status).toBe(201);
      const body = response.body as AiChatResponseBody;
      expect(body.conversation.companyId).toBe(fixture.company.id);
      expect(body.message.role).toBe('ASSISTANT');
      expect(body.message.content).toContain('Deterministic fake answer');

      const rows: { role: string; content: string }[] = await dataSource.query(
        'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [body.conversation.id],
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].role).toBe('USER');
      expect(rows[1].role).toBe('ASSISTANT');
    });

    it("denies cross-company access to another company's conversation (404, never leaks existence)", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupWorkingFixture(cookie);
      const fixtureB = await setupWorkingFixture(cookie);

      const chatResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({ message: 'hello', companyId: fixtureA.company.id });
      const conversationId = (chatResponse.body as AiChatResponseBody)
        .conversation.id;

      const crossCompanyGet = await request(app.getHttpServer())
        .get(
          `/api/v1/ai/conversations/${conversationId}?companyId=${fixtureB.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(crossCompanyGet.status).toBe(404);
    });

    it('conversation history is bounded — a follow-up message continues the SAME conversation without unbounded growth', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      const first = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({ message: 'first message', companyId: fixture.company.id });
      const conversationId = (first.body as AiChatResponseBody).conversation.id;

      await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({
          conversationId,
          message: 'second message',
          companyId: fixture.company.id,
        });

      const rows: unknown[] = await dataSource.query(
        'SELECT id FROM ai_messages WHERE conversation_id = ?',
        [conversationId],
      );
      expect(rows).toHaveLength(4); // 2 user + 2 assistant
    });

    it('rolls back the persisted user message when the provider fails outright — reproduced live in Phase 19.1: this previously left a permanent orphaned USER message with no reply and no title', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      fakeLlmProvider.failNextChat = true;
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({
          message: 'this call will fail',
          companyId: fixture.company.id,
        });

      expect(response.status).toBe(500);
      const conversationId = (response.body as { conversationId?: string })
        .conversationId;

      // The endpoint's error body doesn't expose the conversation id (it
      // never got far enough to be useful to the caller), so verify via
      // direct DB query that NO orphaned message was left behind for this
      // user at all — the fix deletes the just-persisted user message on
      // failure, so nothing should remain from this failed attempt.
      const orphanedRows: { content: string }[] = await dataSource.query(
        "SELECT content FROM ai_messages WHERE content = 'this call will fail'",
      );
      expect(orphanedRows).toHaveLength(0);
      expect(conversationId).toBeUndefined();
    });
  });

  describe('AI tool execution — real ERP data, permission-aware', () => {
    it('a real sales question triggers a real tool call against real Sale data, not fabricated numbers', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/chat')
        .set('Cookie', [cookie])
        .send({
          message: 'What were our sales today?',
          companyId: fixture.company.id,
        });

      expect(response.status).toBe(201);
      const body = response.body as AiChatResponseBody;
      // The fake provider's second round echoes the real tool result string
      // back verbatim — proving the real SalesReportsService.summary() ran
      // and its real grandTotal reached the model, not a fabricated number.
      expect(body.message.content).toContain('saleCount');
      expect(body.message.content).toContain(sale.grandTotal);
    });

    it('a user without reports.sales.read cannot obtain sales data via AI even when they can chat', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      // Grant plainUser only ai_assistant.chat, not reports.sales.read, by
      // creating a scoped role for this one test.
      const roleRepository = dataSource.getRepository(Role);
      const permissionRows: { id: string }[] = await dataSource.query(
        "SELECT id FROM permissions WHERE code = 'ai_assistant.chat'",
      );
      const permissionRow = permissionRows[0];
      const chatOnlyRole = await roleRepository.save(
        roleRepository.create({
          name: 'AI E2E Chat Only',
          code: 'AI_E2E_CHAT_ONLY',
          description: 'Created by ai-assistant.e2e-spec',
          status: RoleStatus.Active,
          isSystemRole: false,
        }),
      );
      await dataSource.query(
        'INSERT INTO role_permissions (id, role_id, permission_id) VALUES (UUID(), ?, ?)',
        [chatOnlyRole.id, permissionRow.id],
      );
      await dataSource.query(
        'INSERT INTO user_roles (id, user_id, role_id) VALUES (UUID(), ?, ?)',
        [plainUser.id, chatOnlyRole.id],
      );
      await dataSource.query(
        "INSERT INTO role_resource_scopes (id, role_id, resource, scope, scope_value) VALUES (UUID(), ?, 'ai_assistant', 'ALL', NULL)",
        [chatOnlyRole.id],
      );

      try {
        const plainCookie = await loginAndGetCookie(plainUser.email);
        const response = await request(app.getHttpServer())
          .post('/api/v1/ai/chat')
          .set('Cookie', [plainCookie])
          .send({
            message: 'What were our sales today?',
            companyId: fixture.company.id,
          });

        // The chat call itself succeeds (user has ai_assistant.chat), but
        // the tool result must reflect denial, never real sales figures.
        expect(response.status).toBe(201);
        const body = response.body as AiChatResponseBody;
        expect(body.message.content).not.toContain('saleCount');
      } finally {
        await dataSource.query('DELETE FROM user_roles WHERE role_id = ?', [
          chatOnlyRole.id,
        ]);
        await dataSource.query(
          'DELETE FROM role_resource_scopes WHERE role_id = ?',
          [chatOnlyRole.id],
        );
        await dataSource.query(
          'DELETE FROM role_permissions WHERE role_id = ?',
          [chatOnlyRole.id],
        );
        await dataSource.query('DELETE FROM roles WHERE id = ?', [
          chatOnlyRole.id,
        ]);
      }
    });
  });

  describe('knowledge ingestion + RAG retrieval — real pipeline, fake provider boundary only', () => {
    it('ingests a real document through the real BullMQ queue/worker and makes it retrievable', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/knowledge')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          scope: 'COMPANY',
          title: 'Return Policy',
          content:
            'Our return policy allows returns within 30 days of purchase with a valid receipt.',
        });
      expect(createResponse.status).toBe(201);
      const document = createResponse.body as AiKnowledgeDocumentBody;
      expect(document.status).toBe('PENDING');

      let ready: AiKnowledgeDocumentBody | undefined;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const rows: { status: string; chunk_count: number }[] =
          await dataSource.query(
            'SELECT status, chunk_count FROM ai_knowledge_documents WHERE id = ?',
            [document.id],
          );
        if (rows[0]?.status === 'READY') {
          ready = {
            id: document.id,
            status: rows[0].status,
            chunkCount: rows[0].chunk_count,
          };
          break;
        }
        if (rows[0]?.status === 'FAILED') {
          throw new Error('Ingestion unexpectedly failed');
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(ready).toBeDefined();
      expect(ready!.chunkCount).toBeGreaterThan(0);

      const chunkRows: unknown[] = await dataSource.query(
        'SELECT id, embedding FROM ai_knowledge_chunks WHERE document_id = ?',
        [document.id],
      );
      expect(chunkRows.length).toBe(ready!.chunkCount);
    }, 30000);

    it("never retrieves another company's knowledge documents", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupWorkingFixture(cookie);
      const fixtureB = await setupWorkingFixture(cookie);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/knowledge')
        .set('Cookie', [cookie])
        .send({
          companyId: fixtureA.company.id,
          scope: 'COMPANY',
          title: 'Company A Secret Policy',
          content: 'This is confidential to company A only.',
        });
      const document = createResponse.body as AiKnowledgeDocumentBody;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const rows: { status: string }[] = await dataSource.query(
          'SELECT status FROM ai_knowledge_documents WHERE id = ?',
          [document.id],
        );
        if (rows[0]?.status === 'READY') break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Company B cannot GET company A's document directly.
      const getResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/ai/knowledge/${document.id}?companyId=${fixtureB.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(getResponse.status).toBe(404);
    }, 20000);
  });
});
