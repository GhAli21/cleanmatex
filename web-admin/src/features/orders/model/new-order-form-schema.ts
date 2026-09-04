/**
 * New Order Form Schema
 * Zod validation schemas for order creation
 */

import { z } from 'zod';
import { PAYMENT_METHODS, ORDER_TYPE_ID_VALUES } from '@/lib/constants/order-types';
import { NEW_ORDER_DEFAULT_SOURCE_CODE, ORDER_SOURCE_CODES } from '@/lib/constants/order-sources';
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
  colorCodes: z.array(z.string()).optional(),
  colorCfIds: z.array(z.union([z.string().uuid(), z.null()])).optional(),
  brand: z.string().optional(),
  hasStain: z.boolean().optional(),
  hasDamage: z.boolean().optional(),
  notes: z.string().optional(),
  rackLocation: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  /** Catalog-backed classification that selects the applicable initial workflow path. */
  orderTypeId: z.enum(ORDER_TYPE_ID_VALUES),
  /** Auditable creation channel; defaults to staff counter entry when omitted. */
  orderSourceCode: z.enum(ORDER_SOURCE_CODES).default(NEW_ORDER_DEFAULT_SOURCE_CODE),
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
 * Validated New Order draft shape shared by React Hook Form and submission.
 */
export type NewOrderFormData = z.infer<typeof newOrderFormSchema>;
/** Validated item entry inside a {@link NewOrderFormData} draft. */
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
/** Validated piece metadata collected before the order exists. */
export type PreSubmissionPieceFormData = z.infer<typeof preSubmissionPieceSchema>;

