/**
 * New Order Form Schema
 * Zod validation schemas for order creation
 */

import { z } from 'zod';
import { PAYMENT_METHODS, ORDER_TYPE_IDS } from '@/lib/constants/order-types';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 * UUID validation
 */
const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Pre-submission piece schema
 */
export const preSubmissionPieceSchema = z.object({
  id: z.string(),
  itemId: z.string().uuid(),
  pieceSeq: z.number().int().positive(),
  color: z.string().optional(),
  brand: z.string().optional(),
  hasStain: z.boolean().optional(),
  hasDamage: z.boolean().optional(),
  notes: z.string().optional(),
  rackLocation: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Order item schema
 */
export const orderItemSchema = z.object({
  productId: uuidSchema,
  productName: z.string().nullable(),
  productName2: z.string().nullable(),
  quantity: z
    .number()
    .int()
    .min(ORDER_DEFAULTS.LIMITS.QUANTITY_MIN)
    .max(ORDER_DEFAULTS.LIMITS.QUANTITY_MAX),
  pricePerUnit: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  defaultSellPrice: z.number().nullable(),
  defaultExpressSellPrice: z.number().nullable(),
  serviceCategoryCode: z.string().optional(),
  notes: z.string().optional(),
  pieces: z.array(preSubmissionPieceSchema).optional(),
});

/**
 * New order form schema
 */
export const newOrderFormSchema = z.object({
  customerId: uuidSchema,
  orderTypeId: z.enum([
    ORDER_TYPE_IDS.POS,
    ORDER_TYPE_IDS.ONLINE,
    ORDER_TYPE_IDS.PHONE,
  ]),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
  isQuickDrop: z.boolean().default(false),
  quickDropQuantity: z
    .number()
    .int()
    .nonnegative()
    .optional(),
  express: z.boolean().default(false),
  priority: z.enum(['normal', 'express', 'urgent']).default('normal'),
  customerNotes: z.string().optional(),
  useOldWfCodeOrNew: z.boolean().default(false),
});

/**
 * Type inference for new order form
 */
export type NewOrderFormData = z.infer<typeof newOrderFormSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
export type PreSubmissionPieceFormData = z.infer<typeof preSubmissionPieceSchema>;

