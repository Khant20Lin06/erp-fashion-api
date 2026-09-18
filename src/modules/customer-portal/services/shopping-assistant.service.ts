import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerMultiAgentService } from '../agents/customer-multi-agent.service';
import { CustomerAssistantDto } from '../dto/customer-assistant.dto';
import { ShoppingEvent } from '../entities/shopping-event.entity';
import { ShoppingSession } from '../entities/shopping-session.entity';
import { CustomerAgentToolsService } from './customer-agent-tools.service';
import { identifyUpdate, normalizeUpdate } from './shopping-session';

// Keep the same validator as deterministic shopping; the model never gains a
// separate action surface that can create orders or set prices.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validate } = require('../shopping/assistant') as {
  validate: (value: unknown) => Record<string, unknown> | null;
};
const digest = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
const LEASE_MS = 60000;
const DEADLINE_MS = 40000;
export interface AssistantResponse {
  status: 'ready';
  action: Record<string, unknown> | null;
  degraded: boolean;
  trace: Record<string, unknown>;
}
interface AssistantRun {
  id: string;
  operationToken: string;
  startedAt: number;
  attempts: number;
  result?: AssistantResponse;
}
const fallback = (code: string): AssistantResponse => ({
  status: 'ready',
  action: null,
  degraded: true,
  trace: { code },
});

@Injectable()
export class ShoppingAssistantService {
  private readonly logger = new Logger(ShoppingAssistantService.name);
  constructor(
    private readonly source: DataSource,
    private readonly team: CustomerMultiAgentService,
    private readonly tools: CustomerAgentToolsService,
  ) {}

  private async operation(
    manager: EntityManager,
    botUserId: string,
    input: CustomerAssistantDto,
  ) {
    const { userId, eventId } = identifyUpdate(input.update);
    const sessionId = digest([input.companyId, botUserId, userId]);
    const session = await manager.findOne(ShoppingSession, {
      where: { id: sessionId },
      lock: { mode: 'pessimistic_write' },
    });
    const event = await manager.findOne(ShoppingEvent, {
      where: { id: digest([sessionId, eventId]) },
    });
    if (
      !session ||
      !event ||
      event.completed ||
      session.activeEventId !== eventId ||
      event.inputHash !== digest(input.update) ||
      event.operationToken !== input.operationToken ||
      event.context?.op !== 'assistant' ||
      Date.now() - Number(event.context.assistantStartedAt || 0) > 180000
    ) {
      throw new ConflictException('Customer assistant operation is stale');
    }
    return event;
  }

  async run(
    botUserId: string,
    rawInput: CustomerAssistantDto,
  ): Promise<AssistantResponse | { status: 'busy'; retryAfterMs: number }> {
    if (Buffer.byteLength(JSON.stringify(rawInput)) > 128 * 1024)
      throw new BadRequestException('Assistant request is too large');
    const input = { ...rawInput, update: normalizeUpdate(rawInput.update) };
    const claim = await this.source.transaction(async (manager) => {
      const event = await this.operation(manager, botUserId, input);
      const previous = event.context!.assistantRun as AssistantRun | undefined;
      const old =
        previous?.operationToken === input.operationToken
          ? previous
          : undefined;
      if (old?.result) return { response: old.result };
      if (old && Date.now() - old.startedAt < LEASE_MS)
        return { response: { status: 'busy' as const, retryAfterMs: 1000 } };
      if (old && old.attempts >= 2) {
        old.result = fallback('ASSISTANT_RECOVERY_LIMIT');
        await manager.save(ShoppingEvent, event);
        return { response: old.result };
      }
      const run: AssistantRun = {
        id: randomUUID(),
        operationToken: input.operationToken,
        startedAt: Date.now(),
        attempts: (old?.attempts || 0) + 1,
      };
      event.context!.assistantRun = run;
      await manager.save(ShoppingEvent, event);
      return {
        id: run.id,
        context: JSON.parse(
          JSON.stringify(event.context!.request?.body || {}),
        ) as Record<string, unknown>,
      };
    });
    if (claim.response) return claim.response;

    // Never hold a database transaction while awaiting model/tool network IO.
    const abort = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let result: AssistantResponse;
    try {
      const invoke = async (
        tool: 'search' | 'detail' | 'popular' | 'policy' | 'orders',
        args: { query?: string; productId?: string },
      ) => {
        if (abort.signal.aborted)
          throw new Error('Assistant deadline exceeded');
        if (
          !['search', 'detail', 'popular', 'policy', 'orders'].includes(tool) ||
          !args ||
          Array.isArray(args) ||
          Object.keys(args).some((k) => !['query', 'productId'].includes(k)) ||
          (args.query !== undefined &&
            (typeof args.query !== 'string' || args.query.length > 100)) ||
          (args.productId !== undefined &&
            (typeof args.productId !== 'string' ||
              !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
                args.productId,
              )))
        ) {
          throw new BadRequestException('Invalid specialist tool arguments');
        }
        const response = await this.tools.call(botUserId, {
          ...input,
          tool,
          ...args,
        });
        if (abort.signal.aborted)
          throw new Error('Assistant deadline exceeded');
        return response;
      };
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          abort.abort();
          reject(new Error('Assistant deadline exceeded'));
        }, DEADLINE_MS);
      });
      const proposed = await Promise.race([
        this.team.run(claim.context, invoke, abort.signal),
        deadline,
      ]);
      const action = validate(proposed.action);
      const trace: Record<string, unknown> = {};
      // Project diagnostics, not model reasoning, prompts, customer text or tool data.
      for (const key of ['modelCalls', 'toolCalls', 'durationMs']) {
        const value = proposed.trace?.[key];
        if (typeof value === 'number' && Number.isFinite(value))
          trace[key] = value;
      }
      for (const key of ['code', 'model', 'route', 'reason']) {
        const value = proposed.trace?.[key];
        if (
          typeof value === 'string' &&
          /^[a-zA-Z0-9_.:/-]{1,120}$/.test(value)
        )
          trace[key] = value;
      }
      const agents = proposed.trace?.agents;
      if (Array.isArray(agents))
        trace.agents = agents
          .filter(
            (x) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(x),
          )
          .slice(0, 3);
      result = {
        status: 'ready',
        action,
        degraded: proposed.degraded === true || !action,
        trace,
      };
    } catch {
      this.logger.warn(
        'Customer multi-agent run unavailable; using deterministic shopping fallback',
      );
      result = fallback(
        abort.signal.aborted ? 'ASSISTANT_TIMEOUT' : 'ASSISTANT_UNAVAILABLE',
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      abort.abort();
    }
    return this.source.transaction(async (manager) => {
      const event = await this.operation(manager, botUserId, input);
      const run = event.context!.assistantRun as AssistantRun | undefined;
      if (!run || run.id !== claim.id)
        throw new ConflictException('Customer assistant lease changed');
      if (run.result) return run.result;
      run.result = result;
      await manager.save(ShoppingEvent, event);
      return result;
    });
  }
}
