/**
 * Inventory stock adjustment – Zod schemas
 * Used by Adjust Stock modal for validation before calling adjustStockAction
 */

import { z } from 'zod';
import { ADJUSTMENT_ACTIONS } from '@/lib/constants/inventory';

export const stockAdjustmentSchema = z
  .object({
    action: z.enum([
      ADJUSTMENT_ACTIONS.INCREASE,
      ADJUSTMENT_ACTIONS.DECREASE,
      ADJUSTMENT_ACTIONS.SET,
    ]),
    quantity: z.coerce.number().finite(),
    reason: z.string().min(1, 'Reason is required').max(200),
  })
  .superRefine((data, ctx) => {
    if (data.action === ADJUSTMENT_ACTIONS.INCREASE && data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quantity must be positive for increase',
        path: ['quantity'],
      });
    }
    if (data.action === ADJUSTMENT_ACTIONS.DECREASE && data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quantity must be positive for decrease',
        path: ['quantity'],
      });
    }
    // SET allows negative (to set stock to negative value)
  });

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;

/** Schema for update branch stock request */
export const updateBranchStockSchema = z.object({
  product_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  reorder_point: z.number().min(0).optional(),
  min_stock_level: z.number().min(0).optional(),
  max_stock_level: z.number().min(0).nullable().optional(),
  last_purchase_cost: z.number().min(0).nullable().optional(),
  storage_location: z.string().max(100).nullable().optional(),
  id_sku: z.string().max(50).nullable().optional(),
});

export type UpdateBranchStockFormData = z.infer<typeof updateBranchStockSchema>;
