import { z } from 'zod';
import { DRAWER_TYPES } from '@/lib/constants/payment';

export const createCashDrawerSchema = z.object({
  drawer_code: z.string().min(1).max(50),
  drawer_name: z.string().min(1).max(250),
  drawer_name2: z.string().max(250).optional(),
  drawer_type: z.enum([
    DRAWER_TYPES.COUNTER,
    DRAWER_TYPES.SAFE,
    DRAWER_TYPES.DRIVER_BAG,
    DRAWER_TYPES.TEMPORARY,
  ]),
  branch_id: z.string().uuid(),
  currency_code: z.string().length(3),
  max_cash_limit: z.number().nonnegative().optional(),
  variance_approval_threshold: z.number().nonnegative().optional(),
  assigned_terminal_id: z.string().uuid().optional(),
});

export const updateCashDrawerSchema = createCashDrawerSchema.partial().omit({ currency_code: true, drawer_code: true });

/**
 *
 */
export type CreateCashDrawerFormValues = z.infer<typeof createCashDrawerSchema>;
/**
 *
 */
export type UpdateCashDrawerFormValues = z.infer<typeof updateCashDrawerSchema>;
