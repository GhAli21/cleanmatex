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
  requires_session: z.boolean().optional(),
  opening_float_required: z.boolean().optional(),
  max_cash_limit: z.number().nonnegative().optional(),
  assigned_terminal_id: z.string().uuid().optional(),
});

export const updateCashDrawerSchema = createCashDrawerSchema.partial().omit({ currency_code: true, drawer_code: true });

export const openDrawerSessionSchema = z.object({
  cash_drawer_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  opening_float_amount: z.number().nonnegative(),
  currency_code: z.string().length(3),
});

export const closeDrawerSessionSchema = z.object({
  session_id: z.string().uuid(),
  counted_cash_amount: z.number().nonnegative(),
  close_notes: z.string().max(500).optional(),
});

export type CreateCashDrawerFormValues = z.infer<typeof createCashDrawerSchema>;
export type UpdateCashDrawerFormValues = z.infer<typeof updateCashDrawerSchema>;
export type OpenDrawerSessionFormValues = z.infer<typeof openDrawerSessionSchema>;
export type CloseDrawerSessionFormValues = z.infer<typeof closeDrawerSessionSchema>;
