/**
 * Order Types Constants
 * Enums and constants for order-related types.
 * Payment kinds/methods re-exported from lib/constants/payment.ts (single source of truth).
 */

export {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  getPaymentTypeFromMethod,
  normalizePaymentMethodCode,
  type PaymentKind,
  type PaymentMethodCode,
} from "./payment";

/**
 * Order Status Types (simplified set for UI/filters).
 * For workflow transitions and full lifecycle, use lib/types/workflow.ts (OrderStatus, ORDER_STATUSES) as source of truth.
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

/** Status for retail-only orders at creation (skip workflow, POS completed) */
export const RETAIL_TERMINAL_STATUS = 'closed' as const;

/**
 *
 */
export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

/**
 * Order Type IDs — must mirror sys_order_type_cd.order_type_id (verbatim).
 * Distinct from order_source_code (sys_order_sources_cd = sales/integration channel).
 */
export const ORDER_TYPE_IDS = {
  POS: 'POS',
  WALK_IN: 'WALK_IN',
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
  EXPRESS: 'EXPRESS',
  ONLINE: 'ONLINE',
  PHONE: 'PHONE',
} as const;

/**
 *
 */
export type OrderTypeId = typeof ORDER_TYPE_IDS[keyof typeof ORDER_TYPE_IDS];

/** All catalog codes as a tuple (Zod / UI enums). */
export const ORDER_TYPE_ID_VALUES = Object.values(ORDER_TYPE_IDS) as [
  OrderTypeId,
  ...OrderTypeId[],
];

/**
 * Priority Levels
 */
export const PRIORITY_LEVELS = {
  NORMAL: 'normal',
  EXPRESS: 'express',
  URGENT: 'urgent',
} as const;

/**
 *
 */
export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

/**
 * Product Units
 */
export const PRODUCT_UNITS = {
  PIECE: 'piece',
  KG: 'kg',
  ITEM: 'item',
} as const;

/**
 *
 */
export type ProductUnit = typeof PRODUCT_UNITS[keyof typeof PRODUCT_UNITS];

