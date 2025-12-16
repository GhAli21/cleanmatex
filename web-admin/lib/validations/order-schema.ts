/**
 * Order Validation Schemas
 *
 * Zod schemas for runtime validation of order-related inputs.
 * Used in API routes, server actions, and forms.
 */

import { z } from 'zod';

// ==================================================================
// ENUM SCHEMAS
// ==================================================================

export const orderStatusSchema = z.enum([
  'draft',
  'intake',
  'preparation',
  'processing',
  'washing',
  'drying',
  'finishing',
  'assembly',
  'qa',
  'packing',
  'ready',
  'out_for_delivery',
  'delivered',
  'closed',
  'cancelled',
]);

export const preparationStatusSchema = z.enum(['pending', 'in_progress', 'completed']);

export const prioritySchema = z.enum(['normal', 'urgent', 'express']);

export const orderTypeSchema = z.enum(['quick_drop', 'pickup', 'delivery', 'walk_in']);

export const paymentStatusSchema = z.enum(['pending', 'partial', 'paid', 'refunded', 'failed']);

// ==================================================================
// CREATE ORDER SCHEMAS
// ==================================================================

/**
 * Schema for creating a Quick Drop order
 */
export const createOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  orderType: orderTypeSchema.default('quick_drop'),
  serviceCategory: z.string().min(1, 'Service category is required'),
  bagCount: z.number().int().min(1, 'Bag count must be at least 1').max(100, 'Bag count cannot exceed 100'),
  priority: prioritySchema.default('normal'),
  customerNotes: z.string().max(1000, 'Customer notes too long').optional(),
  internalNotes: z.string().max(1000, 'Internal notes too long').optional(),
  photoUrls: z.array(z.string().url('Invalid photo URL')).max(10, 'Maximum 10 photos allowed').optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ==================================================================
// ADD ITEMS SCHEMAS
// ==================================================================

/**
 * Schema for a single order item
 */
export const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity too large'),
  serviceCategoryCode: z.string().min(1, 'Service category is required'),
  color: z.string().max(50, 'Color name too long').optional(),
  brand: z.string().max(100, 'Brand name too long').optional(),
  hasStain: z.boolean().default(false),
  stainNotes: z.string().max(500, 'Stain notes too long').optional(),
  hasDamage: z.boolean().default(false),
  damageNotes: z.string().max(500, 'Damage notes too long').optional(),
  notes: z.string().max(500, 'Item notes too long').optional(),
}).refine(
  (data) => !data.hasStain || data.stainNotes,
  {
    message: 'Stain notes required when item has stain',
    path: ['stainNotes'],
  }
).refine(
  (data) => !data.hasDamage || data.damageNotes,
  {
    message: 'Damage notes required when item has damage',
    path: ['damageNotes'],
  }
);

/**
 * Schema for adding multiple items to an order
 */
export const addOrderItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(100, 'Maximum 100 items per batch'),
  isExpressService: z.boolean().default(false),
});

export type AddOrderItemsInput = z.infer<typeof addOrderItemsSchema>;

// ==================================================================
// UPDATE ORDER SCHEMAS
// ==================================================================

/**
 * Schema for completing preparation
 */
export const completePreparationSchema = z.object({
  readyByOverride: z.coerce.date().optional(),
  internalNotes: z.string().max(1000, 'Internal notes too long').optional(),
});

export type CompletePreparationInput = z.infer<typeof completePreparationSchema>;

/**
 * Schema for updating order status
 */
export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Schema for updating order notes
 */
export const updateOrderNotesSchema = z.object({
  customerNotes: z.string().max(1000, 'Customer notes too long').optional(),
  internalNotes: z.string().max(1000, 'Internal notes too long').optional(),
});

// ==================================================================
// QUERY/FILTER SCHEMAS
// ==================================================================

/**
 * Schema for order list filters
 */
export const orderFiltersSchema = z.object({
  status: z.union([orderStatusSchema, z.array(orderStatusSchema)]).optional(),
  preparationStatus: z.union([preparationStatusSchema, z.array(preparationStatusSchema)]).optional(),
  priority: z.union([prioritySchema, z.array(prioritySchema)]).optional(),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['received_at', 'ready_by', 'order_no', 'total']).default('received_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>;

/**
 * Schema for order ID parameter
 */
export const orderIdSchema = z.string().uuid('Invalid order ID format');

// ==================================================================
// PHOTO UPLOAD SCHEMAS
// ==================================================================

/**
 * Schema for photo upload
 */
export const uploadPhotoSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  file: z.instanceof(File, { message: 'File is required' }),
  fileName: z.string().min(1, 'File name is required'),
});

// ==================================================================
// ITEM UPDATE SCHEMAS
// ==================================================================

/**
 * Schema for updating an order item
 */
export const updateOrderItemSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  color: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  hasStain: z.boolean().optional(),
  stainNotes: z.string().max(500).optional(),
  hasDamage: z.boolean().optional(),
  damageNotes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

// ==================================================================
// BULK OPERATIONS SCHEMAS
// ==================================================================

/**
 * Schema for bulk status update
 */
export const bulkUpdateStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order required').max(100, 'Maximum 100 orders'),
  status: orderStatusSchema,
  notes: z.string().max(500).optional(),
});

/**
 * Schema for bulk delete/cancel
 */
export const bulkCancelOrdersSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order required').max(100, 'Maximum 100 orders'),
  reason: z.string().min(1, 'Cancellation reason required').max(500, 'Reason too long'),
});

// ==================================================================
// VALIDATION HELPERS
// ==================================================================

/**
 * Validate and parse data against a schema
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Format Zod validation errors for display
 */
export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}

/**
 * Get first validation error message
 */
export function getFirstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Validation failed - Order Schema';
}
