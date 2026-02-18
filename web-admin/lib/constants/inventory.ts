/**
 * Inventory Stock Management Constants
 * Single source of truth for inventory-related enums and helpers
 */

// Item categories for inventory consumables
export const ITEM_CATEGORIES = {
  DETERGENT: 'DETERGENT',
  PACKAGING: 'PACKAGING',
  HANGER: 'HANGER',
  BAG: 'BAG',
  TAG: 'TAG',
  CONSUMABLE: 'CONSUMABLE',
  OTHER: 'OTHER',
} as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[keyof typeof ITEM_CATEGORIES];

// Units of measure
export const UNITS_OF_MEASURE = {
  PIECE: 'piece',
  LITER: 'liter',
  KG: 'kg',
  GRAM: 'gram',
  BOX: 'box',
  BOTTLE: 'bottle',
  PACK: 'pack',
  ROLL: 'roll',
} as const;

export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[keyof typeof UNITS_OF_MEASURE];

// Stock transaction types
export const TRANSACTION_TYPES = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

// Computed stock status (not stored in DB)
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  OVERSTOCK: 'overstock',
  NEGATIVE_STOCK: 'negative_stock',
} as const;

export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];

// Reference types for stock transactions
export const REFERENCE_TYPES = {
  ORDER: 'ORDER',
  PURCHASE: 'PURCHASE',
  MANUAL: 'MANUAL',
} as const;

export type ReferenceType = (typeof REFERENCE_TYPES)[keyof typeof REFERENCE_TYPES];

// Adjustment action types (UI-level, mapped to transaction types)
export const ADJUSTMENT_ACTIONS = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
  SET: 'set',
} as const;

export type AdjustmentAction = (typeof ADJUSTMENT_ACTIONS)[keyof typeof ADJUSTMENT_ACTIONS];

/**
 * Compute stock status from quantity and thresholds
 */
export function getStockStatus(
  qtyOnHand: number,
  reorderPoint: number,
  maxStockLevel?: number | null
): StockStatus {
  if (qtyOnHand < 0) return STOCK_STATUS.NEGATIVE_STOCK;
  if (qtyOnHand <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (qtyOnHand <= reorderPoint) return STOCK_STATUS.LOW_STOCK;
  if (maxStockLevel && qtyOnHand > maxStockLevel) return STOCK_STATUS.OVERSTOCK;
  return STOCK_STATUS.IN_STOCK;
}
