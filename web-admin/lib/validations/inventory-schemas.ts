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
