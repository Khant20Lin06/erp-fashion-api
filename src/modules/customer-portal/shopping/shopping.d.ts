import type { JsonObject, ShoppingContext } from '../services/shopping-session';
export function prepare(
  store: JsonObject,
  update: JsonObject,
  config: JsonObject,
  now?: number,
): ShoppingContext;
export function respond(
  store: JsonObject,
  context: ShoppingContext,
  response: unknown,
  config: JsonObject,
  now?: number,
): ShoppingContext;
