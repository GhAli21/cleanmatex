/**
 * Order Item Helpers
 * 
 * Utilities for manipulating order items in the new order flow.
 * Provides type-safe functions for adding, removing, updating, and calculating
 * totals for order items.
 * 
 * @module order-item-helpers
 */

import type { OrderItem } from '@features/orders/model/new-order-types';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { resolveBilledMeasure } from '@/lib/commercial/measure';

/**
 * The quantity a cart line's unit price multiplies: the billed measure of a measured line, else `quantity`.
 * Uses the server's own resolver (`resolveBilledMeasure`), so the estimate cannot drift from the quote.
 * It is only the pre-quote estimate; the server quote stays authoritative.
 * @param item - Cart line
 * @returns the billed quantity, or 0 for a measured line with no valid measure yet
 * @example pricedQty({ ...kgLine, measure: { measuredQty: '3.2', length: '', width: '' } }); // 3.5 with a 0.5 step
 */
export function pricedQty(item: Pick<OrderItem, 'quantity' | 'uom' | 'measure'>): number {
  if (!item.uom) return item.quantity;
  try {
    return resolveBilledMeasure({
      dimension: item.uom.dimension,
      uomCode: item.uom.code,
      qtyDecimals: item.uom.qtyDecimals,
      measuredQty: item.measure?.measuredQty || undefined,
      length: item.measure?.length || undefined,
      width: item.measure?.width || undefined,
      minBillableQty: item.uom.minBillableQty,
      billingIncrement: item.uom.billingIncrement,
    }).billedQty.toNumber();
  } catch {
    return 0; // not measured yet or invalid: the server quote refuses it with MEASURE_REQUIRED / UOM_QTY_SCALE
  }
}

/**
 * Line extras that must survive a qty change (item/piece prefs + packing).
 * Prefer explicit charge fields, then prefs, then extras already in totalPrice.
 */
export function resolveLineExtras(item: OrderItem): number {
  const fromCharges = (item.servicePrefCharge ?? 0) + (item.packingPrefCharge ?? 0);
  if (fromCharges > 0) return fromCharges;

  const itemPrefExtras = (item.servicePrefs ?? []).reduce(
    (sum, pref) => sum + (pref.extra_price ?? 0),
    0
  );
  const piecePrefExtras = (item.pieces ?? []).reduce(
    (sum, piece) =>
      sum + (piece.servicePrefs ?? []).reduce((prefSum, pref) => prefSum + (pref.extra_price ?? 0), 0),
    0
  );
  const fromPrefs = itemPrefExtras + piecePrefExtras;
  if (fromPrefs > 0) return fromPrefs;

  if (item.totalPrice != null) {
    const implied = item.totalPrice - pricedQty(item) * item.pricePerUnit;
    return implied > 0 ? implied : 0;
  }
  return 0;
}

/**
 * Adds an item to the order
 * @param items - Current order items
 * @param newItem - Item to add
 * @returns Updated items array
 */
export function addItemToOrder(
  items: OrderItem[],
  newItem: OrderItem
): OrderItem[] {
  const existingItem = items.find(
    (item) => item.productId === newItem.productId
  );

  if (existingItem) {
    // Update existing item
    return items.map((item) =>
      item.productId === newItem.productId
        ? {
          ...item,
          quantity: item.quantity + 1,
          totalPrice: pricedQty({ ...item, quantity: item.quantity + 1 }) * item.pricePerUnit + resolveLineExtras(item),
        }
        : item
    );
  }

  // Add new item
  return [...items, newItem];
}

/**
 * Removes an item from the order
 * @param items - Current order items
 * @param productId - Product ID to remove
 * @returns Updated items array
 */
export function removeItemFromOrder(
  items: OrderItem[],
  productId: string
): OrderItem[] {
  return items.filter((item) => item.productId !== productId);
}

/**
 * Updates item quantity
 * @param items - Current order items
 * @param productId - Product ID to update
 * @param quantity - New quantity
 * @returns Updated items array
 */
export function updateItemQuantity(
  items: OrderItem[],
  productId: string,
  quantity: number
): OrderItem[] {
  if (quantity <= 0) {
    return removeItemFromOrder(items, productId);
  }

  // Validate quantity
  if (
    quantity < ORDER_DEFAULTS.LIMITS.QUANTITY_MIN ||
    quantity > ORDER_DEFAULTS.LIMITS.QUANTITY_MAX
  ) {
    return items; // Don't update if invalid
  }

  return items.map((item) =>
    item.productId === productId
      ? {
        ...item,
        quantity,
        totalPrice: pricedQty({ ...item, quantity }) * item.pricePerUnit + resolveLineExtras(item),
      }
      : item
  );
}

/**
 * Calculates total price for a single item.
 * `totalPrice` is the stored line total (`qty × unit + service pref surcharge + packing surcharge` from the new-order reducer).
 * When present, we use it as-is. Fall back to base × qty + `servicePrefCharge` only when `totalPrice` is absent.
 * @param item - Order item
 * @returns Total price
 */
export function calculateItemTotal(item: OrderItem): number {
  if (item.totalPrice != null) {
    // totalPrice was stored as (basePrice + servicePrefCharge) — use as-is
    return item.totalPrice;
  }
  return pricedQty(item) * item.pricePerUnit + (item.servicePrefCharge ?? 0);
}

/**
 * Calculates total price for all order items
 * @param items - Order items array
 * @returns Total price
 */
export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((total, item) => total + calculateItemTotal(item), 0);
}

/**
 * Checks if order has duplicate product IDs
 * @param items - Order items array
 * @returns True if duplicates found, false otherwise
 */
export function hasDuplicateProducts(items: OrderItem[]): boolean {
  const productIds = items.map((item) => item.productId);
  return new Set(productIds).size !== productIds.length;
}

/**
 * Gets item count
 * @param items - Order items array
 * @returns Total item count
 */
export function getItemCount(items: OrderItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

