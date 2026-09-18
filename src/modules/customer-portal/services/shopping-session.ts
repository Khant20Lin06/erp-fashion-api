import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { prepare, respond } from '../shopping/shopping';

export type JsonObject = Record<string, unknown>;
export interface ShoppingContext extends JsonObject {
  messages: Array<{ text: string; photo?: string; buttons?: unknown[] }>;
  request: {
    method: string;
    path: string;
    query?: JsonObject;
    body?: JsonObject;
  } | null;
}
export interface SessionState {
  state: JsonObject;
  activeEventId: string | null;
}
export interface EventState {
  context: ShoppingContext | null;
  operationToken: string | null;
  consumedToken: string | null;
  responseHash: string | null;
  completed: boolean;
}
export interface StepInput {
  assistantEnabled?: boolean;
  companyId: string;
  update: JsonObject;
  operationToken?: string;
  response?: { statusCode: number; body?: unknown };
}
export interface StepResult {
  status: 'ready' | 'busy';
  retryAfterMs?: number;
  context?: ShoppingContext;
  operationToken?: string;
}
const object = (value: unknown): JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const telegramId = (value: unknown): string => {
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
    return String(value);
  return '';
};
export function identifyUpdate(update: JsonObject): {
  userId: string;
  eventId: string;
} {
  const callback = object(update.callback_query);
  const message = object(callback.message ?? update.message);
  const from = object(callback.from ?? message.from);
  const chat = object(message.chat);
  if (
    !Number.isSafeInteger(update.update_id) ||
    Number(update.update_id) < 0 ||
    !telegramId(from.id) ||
    chat.type !== 'private' ||
    telegramId(chat.id) !== telegramId(from.id)
  ) {
    throw new BadRequestException(
      'A private Telegram update with matching sender and stable update_id is required',
    );
  }
  if (
    typeof message.text !== 'undefined' &&
    (typeof message.text !== 'string' || message.text.length > 4096)
  ) {
    throw new BadRequestException('Invalid Telegram text');
  }
  if (
    callback.data !== undefined &&
    (typeof callback.data !== 'string' || Buffer.byteLength(callback.data) > 64)
  ) {
    throw new BadRequestException('Invalid callback data');
  }
  return { userId: telegramId(from.id), eventId: String(update.update_id) };
}

/** Retain only engine inputs, in stable key order, for operator recovery. */
export function normalizeUpdate(update: JsonObject): JsonObject {
  identifyUpdate(update);
  const callback = object(update.callback_query);
  const message = object(callback.message ?? update.message);
  const from = object(callback.from ?? message.from);
  const chat = object(message.chat);
  const sender = {
    id: from.id,
    ...(typeof from.username === 'string'
      ? { username: from.username.slice(0, 64) }
      : {}),
  };
  const normalizedMessage = {
    chat: { id: chat.id, type: 'private' },
    from: sender,
    ...(typeof message.text === 'string' ? { text: message.text } : {}),
  };
  return {
    update_id: update.update_id,
    ...(update.callback_query
      ? {
          callback_query: {
            id:
              typeof callback.id === 'string' ? callback.id.slice(0, 128) : '',
            from: sender,
            message: normalizedMessage,
            data: callback.data ?? '',
          },
        }
      : { message: normalizedMessage }),
  };
}
export function advanceShopping(
  session: SessionState,
  event: EventState,
  input: StepInput,
): StepResult {
  const { eventId } = identifyUpdate(input.update);
  const result = (): StepResult => ({
    status: 'ready',
    context: event.context!,
    ...(event.operationToken ? { operationToken: event.operationToken } : {}),
  });
  if (input.response) {
    const hash = createHash('sha256')
      .update(JSON.stringify(input.response))
      .digest('hex');
    if (input.operationToken && input.operationToken === event.consumedToken) {
      if (hash !== event.responseHash)
        throw new ConflictException('Operation response changed on replay');
      return result();
    }
    if (
      !event.context ||
      !input.operationToken ||
      input.operationToken !== event.operationToken ||
      event.completed ||
      session.activeEventId !== eventId
    ) {
      throw new ConflictException('Stale shopping operation');
    }
    if (
      event.context.request?.path === '/customer-portal/orders' &&
      (input.response.statusCode === 0 || input.response.statusCode >= 500)
    ) {
      // Roll back this short step transaction. The prior durable request and
      // checkout key remain available when the original update is replayed.
      throw new ServiceUnavailableException(
        'Order outcome is unknown; resume the original Telegram event',
      );
    }
    event.context = respond(session.state, event.context, input.response, {
      companyId: input.companyId,
    });
    event.consumedToken = input.operationToken;
    event.responseHash = hash;
  } else {
    if (input.operationToken)
      throw new BadRequestException('Operation token requires a response');
    if (event.completed)
      return {
        status: 'ready',
        context: {
          ...event.context!,
          messages: [],
          request: null,
          orderCreated: false,
          handoffRequested: false,
        },
      };
    if (session.activeEventId && session.activeEventId !== eventId)
      return { status: 'busy', retryAfterMs: 1000 };
    if (event.context) return result();
    session.activeEventId = eventId;
    event.context = prepare(session.state, input.update, {
      companyId: input.companyId,
      assistantEnabled: input.assistantEnabled === true,
    });
  }
  if (event.context.request?.path === '/customer-portal/orders') {
    event.context.request.body = {
      ...event.context.request.body,
      companyId: input.companyId,
      idempotencyKey: `telegram-update:${eventId}`,
    };
  }
  event.operationToken = event.context.request ? randomUUID() : null;
  event.completed = !event.context.request;
  if (event.completed) session.activeEventId = null;
  return result();
}
