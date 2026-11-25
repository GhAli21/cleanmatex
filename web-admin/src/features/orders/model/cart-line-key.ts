/**
 * Cart line identity (Cart Line Grouping P1, docs/features/Order_Cart_Line_Grouping/DESIGN.md §6).
 * One product can have several lines in an order, so a line is never found by its product id.
 */
import type { LineKey } from './new-order-types';

/**
 * A new key for a line that is not saved yet.
 * @returns a fresh, unique line key
 * @example const item: OrderItem = { lineKey: newCartLineKey(), productId, ... };
 */
export function newCartLineKey(): LineKey {
  // The key never leaves the page, so it only has to be unique here. `randomUUID` exists only on secure
  // pages (https, localhost); a till opened over plain http on the local network falls back to a counter.
  const uuid = globalThis.crypto?.randomUUID?.();
  return (uuid ?? `line-${Date.now().toString(36)}-${++fallbackCount}`) as LineKey;
}

let fallbackCount = 0;

/**
 * The key of a saved line: its database item id, so the same line keeps one key across reloads.
 * @param persistedItemId the `org_order_items_dtl.id`
 * @returns the line key
 */
export function savedLineKey(persistedItemId: string): LineKey {
  return persistedItemId as LineKey;
}
