/**
 * Edit Order Validation Schemas
 * Zod schemas for order update/edit operations
 *
 * PRD: Edit Order Feature
 */

import { z } from 'zod';

const updateOrderPieceServicePrefSchema = z.object({
  preference_code: z.string(),
  source: z.string().optional(),
  extra_price: z.number().nonnegative(),
});

/**
 * Piece data for order update (parity with create-with-payment piece payload)
 */
export const updateOrderPieceSchema = z.object({
  pieceSeq: z.number().int().min(1),
  color: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  hasStain: z.boolean().optional(),
  hasDamage: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  rackLocation: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  conditions: z.array(z.string()).optional(),
  servicePrefs: z.array(updateOrderPieceServicePrefSchema).optional(),
  packingPrefCode: z.string().max(100).optional(),
});

/**
 * Item data for order update
 * Full replacement of items (not incremental)
 */
export const updateOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  pricePerUnit: z.number().min(0),
  totalPrice: z.number().min(0),
  productName: z.string().nullable().optional(),
  productName2: z.string().nullable().optional(),
  serviceCategoryCode: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  hasStain: z.boolean().optional(),
  hasDamage: z.boolean().optional(),
  stainNotes: z.string().max(500).optional(),
  damageNotes: z.string().max(500).optional(),
  pieces: z.array(updateOrderPieceSchema).optional(),
  priceOverride: z.number().nullable().optional(),
  overrideReason: z.string().max(500).nullable().optional(),
  overrideBy: z.string().uuid().nullable().optional(),
});

/**
 * Main update order input schema
 * Used by both server actions and API endpoints
 */
export const updateOrderInputSchema = z.object({
  orderId: z.string().uuid(),

  // Optional fields (only update what's provided)
  customerId: z.string().optional(), // Can be UUID or empty string for default customer
  branchId: z.string().uuid().nullable().optional(),
  /** Internal staff notes */
  notes: z.string().max(1000).optional(),
  /** Customer-provided notes */
  customerNotes: z.string().max(1000).optional(),
  /** Payment-related notes */
  paymentNotes: z.string().max(1000).optional(),
  readyByAt: z.coerce.date().optional(),
  express: z.boolean().optional(),
  isQuickDrop: z.boolean().optional(),
  quickDropQuantity: z.number().int().min(0).optional(),

  // Full item replacement
  items: z.array(updateOrderItemSchema).optional(),

  // Customer snapshot (order-level, not customer master)
  customerName: z.string().max(255).optional(),
  customerMobile: z.string().max(50).optional(),
  customerEmail: z.string().email().max(255).optional(),
  isDefaultCustomer: z.boolean().optional(),
  customerDetails: z.record(z.string(), z.unknown()).optional(),

  // Force recalculation flag
  recalculate: z.boolean().optional(),

  // Optimistic locking (for concurrent edit detection)
  expectedUpdatedAt: z.coerce.date().optional(),
});

/**
 * API request schema (includes orderId from URL params)
 */
export const updateOrderRequestSchema = updateOrderInputSchema;

/**
 * Lock order input schema
 */
export const lockOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string().max(255).optional(),
  sessionId: z.string().max(255).optional(),
});

/**
 * Unlock order input schema
 */
export const unlockOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  force: z.boolean().optional(), // Admin can force unlock
});

/**
 * Check order lock input schema
 */
export const checkOrderLockInputSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Payment adjustment schema (for edited orders with payment changes)
 */
export const paymentAdjustmentSchema = z.object({
  orderId: z.string().uuid(),
  originalTotal: z.number().min(0),
  newTotal: z.number().min(0),
  differenceAmount: z.number(), // Positive = charge, negative = refund
  paymentMethod: z.string().optional(), // For additional charges
  refundMethod: z.enum(['original_method', 'store_credit']).optional(), // For refunds
  reason: z.string().max(500).default('Order edited, total changed'),
  // Payment details (for charges)
  checkNumber: z.string().optional(),
  checkBank: z.string().optional(),
  checkDate: z.coerce.date().optional(),
});

/**
 * Type exports
 */
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type UpdateOrderItem = z.infer<typeof updateOrderItemSchema>;
export type UpdateOrderPiece = z.infer<typeof updateOrderPieceSchema>;
export type LockOrderInput = z.infer<typeof lockOrderInputSchema>;
export type UnlockOrderInput = z.infer<typeof unlockOrderInputSchema>;
export type CheckOrderLockInput = z.infer<typeof checkOrderLockInputSchema>;
export type PaymentAdjustmentInput = z.infer<typeof paymentAdjustmentSchema>;
