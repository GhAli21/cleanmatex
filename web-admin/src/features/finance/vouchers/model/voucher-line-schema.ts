import { z } from 'zod';

export const voucherLineSchema = z.object({
  line_type:              z.string({ error: 'Line type is required' }),
  line_role:              z.string({ error: 'Line role is required' }),
  target_type:            z.string().optional(),
  target_id:              z.string().uuid().optional(),
  order_id:               z.string().uuid().optional(),
  customer_id:            z.string().uuid().optional(),
  supplier_id:            z.string().uuid().optional(),
  employee_id:            z.string().uuid().optional(),
  branch_id:              z.string().uuid().optional(),
  cash_drawer_session_id: z.string().uuid().optional(),
  payment_method_code:    z.string().optional(),
  amount:                 z.number({ error: 'Amount is required' }).min(0),
  currency_code:          z.string().length(3).optional(),
  direction:              z.enum(['IN', 'OUT', 'NEUTRAL']).optional(),
  tendered_amount:        z.number().min(0).optional(),
  card_brand_code:        z.string().optional(),
  card_last4:             z.string().max(4).optional(),
  auth_code:              z.string().optional(),
  gateway_code:           z.string().optional(),
  gateway_transaction_id: z.string().optional(),
  gateway_reference:      z.string().optional(),
  bank_reference:         z.string().optional(),
  check_number:           z.string().optional(),
  check_bank:             z.string().optional(),
  check_date:             z.string().optional(),
  expense_category_code:  z.string().optional(),
  party_name:             z.string().optional(),
  description:            z.string().max(500).optional(),
  notes:                  z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method_code === 'BANK_TRANSFER' && !data.bank_reference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bank reference is required for bank transfer', path: ['bank_reference'] });
  }
  if (data.payment_method_code === 'CHECK') {
    if (!data.check_number) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check number is required', path: ['check_number'] });
    if (!data.check_bank)   ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check bank is required', path: ['check_bank'] });
    if (!data.check_date)   ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check date is required', path: ['check_date'] });
  }
  if (data.payment_method_code === 'CASH' && data.tendered_amount !== undefined && data.tendered_amount < data.amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tendered amount must be >= line amount', path: ['tendered_amount'] });
  }
});

/**
 *
 */
export type VoucherLineFormValues = z.infer<typeof voucherLineSchema>;
