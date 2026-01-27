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
          totalPrice: (item.quantity + 1) * item.pricePerUnit,
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
        totalPrice: quantity * item.pricePerUnit,
      }
      : item
  );
}

/**
 * Calculates total price for a single item
 * @param item - Order item
 * @returns Total price
 */
export function calculateItemTotal(item: OrderItem): number {
  return item.quantity * item.pricePerUnit;
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

