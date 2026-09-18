import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ShoppingSession } from '../entities/shopping-session.entity';
import { ShoppingEvent } from '../entities/shopping-event.entity';
import { CustomerAgentToolDto } from '../dto/customer-agent-tool.dto';
import {
  advanceShopping,
  identifyUpdate,
  normalizeUpdate,
  StepInput,
  StepResult,
} from './shopping-session';

const digest = (parts: unknown): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');

@Injectable()
export class ShoppingStateService {
  constructor(private readonly dataSource: DataSource) {}

  async authorizeAgentTool(botUserId: string, input: CustomerAgentToolDto) {
    if (Buffer.byteLength(JSON.stringify(input)) > 128 * 1024)
      throw new BadRequestException('Agent tool request is too large');
    const update = normalizeUpdate(input.update);
    const { userId, eventId } = identifyUpdate(update);
    const sessionId = digest([input.companyId, botUserId, userId]);
    return this.dataSource.transaction(async (manager) => {
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
        event.inputHash !== digest(update) ||
        event.operationToken !== input.operationToken ||
        event.context?.op !== 'assistant' ||
        Date.now() - Number(event.context.assistantStartedAt || 0) > 180000 ||
        Number(event.context.agentToolCalls || 0) >= 8
      ) {
        throw new ConflictException(
          'Customer agent operation is stale or tool limit exceeded',
        );
      }
      event.context.agentToolCalls =
        Number(event.context.agentToolCalls || 0) + 1;
      await manager.save(ShoppingEvent, event);
      const preferences = (event.context.request?.body?.preferences ||
        {}) as Record<string, unknown>;
      return { userId, preferences };
    });
  }

  async step(botUserId: string, input: StepInput): Promise<StepResult> {
    if (Buffer.byteLength(JSON.stringify(input)) > 128 * 1024)
      throw new BadRequestException('Shopping step is too large');
    input = { ...input, update: normalizeUpdate(input.update) };
    const { userId, eventId } = identifyUpdate(input.update);
    const sessionId = digest([input.companyId, botUserId, userId]);
    const receiptId = digest([sessionId, eventId]);
    const inputHash = digest(input.update);
    return this.dataSource.transaction(async (manager) => {
      // Atomic upsert handles simultaneous first messages. The following row
      // lock serializes this customer only, across every API instance.
      await manager.query(
        'INSERT INTO shopping_sessions (id, company_id, bot_user_id, telegram_user_id, state) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
        [sessionId, input.companyId, botUserId, userId, '{}'],
      );
      const session = await manager.findOneOrFail(ShoppingSession, {
        where: { id: sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      // A terminated n8n/model execution must not hold this customer's cart
      // forever. Only expire read-only assistant operations, never order writes.
      if (session.activeEventId) {
        const active = await manager.findOne(ShoppingEvent, {
          where: { id: digest([sessionId, session.activeEventId]) },
        });
        if (
          active?.context?.op === 'assistant' &&
          Date.now() - Number(active.context.assistantStartedAt || 0) > 180000
        ) {
          active.completed = true;
          active.operationToken = null;
          active.context = {
            ...active.context,
            request: null,
            messages: [],
            orderCreated: false,
            handoffRequested: false,
          };
          session.activeEventId = null;
          await manager.save(ShoppingEvent, active);
        }
      }
      let event = await manager.findOne(ShoppingEvent, {
        where: { id: receiptId },
      });
      if (event && event.inputHash !== inputHash)
        throw new ConflictException('Telegram event changed on replay');
      event ??= manager.create(ShoppingEvent, {
        id: receiptId,
        sessionId,
        eventId,
        inputHash,
        updatePayload: input.update,
        context: null,
        operationToken: null,
        consumedToken: null,
        responseHash: null,
        completed: false,
      });
      const result = advanceShopping(session, event, input);
      if (result.status === 'ready') {
        await manager.save(ShoppingSession, session);
        await manager.save(ShoppingEvent, event);
      }
      return result;
    });
  }
}
