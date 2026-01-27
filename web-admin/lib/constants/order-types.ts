/**
 * Order Types Constants
 * Enums and constants for order-related types
 */

/**
 * Payment Method Types
 */
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  CHECK: 'check',
  GIFT_CARD: 'gift_card',
  PROMO_CODE: 'promo_code',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

/**
 * Order Status Types
 */
export const ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PREPARING: 'preparing',
  INTAKE: 'intake',
  PROCESSING: 'processing',
  READY: 'ready',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

/**
 * Order Type IDs
 */
export const ORDER_TYPE_IDS = {
  POS: 'POS',
  ONLINE: 'ONLINE',
  PHONE: 'PHONE',
} as const;

export type OrderTypeId = typeof ORDER_TYPE_IDS[keyof typeof ORDER_TYPE_IDS];

/**
 * Priority Levels
 */
export const PRIORITY_LEVELS = {
  NORMAL: 'normal',
  EXPRESS: 'express',
  URGENT: 'urgent',
} as const;

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

/**
 * Product Units
 */
export const PRODUCT_UNITS = {
  PIECE: 'piece',
  KG: 'kg',
  ITEM: 'item',
} as const;

export type ProductUnit = typeof PRODUCT_UNITS[keyof typeof PRODUCT_UNITS];

