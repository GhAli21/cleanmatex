/**
 * Shared Zod validation schemas for BVM voucher operations.
 * Used by both server actions (app/actions/finance/) and REST API routes
 * (app/api/v1/finance/vouchers/) so validation is identical at every entry point.
 */

import { z, ZodError } from 'zod';

/**
 * Formats a caught error for an API response.
 * Returns a human-readable message and the appropriate HTTP status code.
 * ZodErrors become 400; all others become 500.
 * @param err
 */
export function formatApiError(err: unknown): { message: string; status: number } {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((e) => (e.path.length > 0 ? `${e.path.map(String).join('.')}: ${e.message}` : e.message))
      .join('; ');
    return { message, status: 400 };
  }
  return {
    message: err instanceof Error ? err.message : 'Internal server error',
    status: 500,
  };
}
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE } from '../constants/voucher';

export const createBizVoucherSchema = z.object({
  voucher_type:      z.enum([
    VOUCHER_TYPE.RECEIPT, VOUCHER_TYPE.PAYMENT,
    VOUCHER_TYPE.REFUND, VOUCHER_TYPE.ADJUSTMENT, VOUCHER_TYPE.TRANSFER,
  ]),
  branch_id:         z.string().uuid().optional(),
  voucher_date:      z.string().optional(),
  voucher_datetime:  z.string().optional(),
  direction:         z.enum([VOUCHER_DIRECTION.IN, VOUCHER_DIRECTION.OUT, VOUCHER_DIRECTION.NEUTRAL]).optional(),
  party_type:        z.enum([PARTY_TYPE.CUSTOMER, PARTY_TYPE.SUPPLIER, PARTY_TYPE.EMPLOYEE, PARTY_TYPE.OTHER]).optional(),
  party_name:        z.string().max(250).optional(),
  customer_id:       z.string().uuid().optional(),
  supplier_id:       z.string().uuid().optional(),
  employee_id:       z.string().uuid().optional(),
  order_id:          z.string().uuid().optional(),
  invoice_id:        z.string().uuid().optional(),
  currency_code:     z.string().length(3).optional(),
  currency_ex_rate:  z.number().positive().optional(),
  total_amount:      z.number().nonnegative().optional(),
  description:       z.string().optional(),
  notes:             z.string().optional(),
  source_module:     z.string().optional(),
  source_ref_type:   z.string().optional(),
  source_ref_id:     z.string().uuid().optional(),
  idempotency_key:   z.string().optional(),
});

export const updateBizVoucherSchema = z.object({
  branch_id:    z.string().uuid().optional(),
  voucher_date: z.string().optional(),
  party_type:   z.string().optional(),
  supplier_id:  z.string().uuid().optional(),
  employee_id:  z.string().uuid().optional(),
  party_name:   z.string().max(250).optional(),
  customer_id:  z.string().uuid().optional(),
  total_amount: z.number().nonnegative().optional(),
  description:  z.string().optional(),
  notes:        z.string().optional(),
});

export const createVoucherLineSchema = z.object({
  line_type:              z.string(),
  line_role:              z.string(),
  target_type:            z.string().optional(),
  target_id:              z.string().uuid().optional(),
  order_id:               z.string().uuid().optional(),
  customer_id:            z.string().uuid().optional(),
  supplier_id:            z.string().uuid().optional(),
  employee_id:            z.string().uuid().optional(),
  branch_id:              z.string().uuid().optional(),
  cash_drawer_session_id: z.string().uuid().optional(),
  payment_method_code:    z.string().optional(),
  amount:                 z.number().min(0),
  currency_code:          z.string().length(3).optional(),
  currency_ex_rate:       z.number().positive().optional(),
  direction:              z.string().optional(),
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
  description:            z.string().optional(),
  notes:                  z.string().optional(),
  reversed_line_id:       z.string().uuid().optional(),
  idempotency_key:        z.string().optional(),
});

export const updateVoucherLineSchema = z.object({
  line_type:              z.string().optional(),
  line_role:              z.string().optional(),
  target_type:            z.string().optional(),
  target_id:              z.string().uuid().optional(),
  order_id:               z.string().uuid().optional(),
  customer_id:            z.string().uuid().optional(),
  payment_method_code:    z.string().optional(),
  amount:                 z.number().min(0).optional(),
  currency_code:          z.string().length(3).optional(),
  direction:              z.string().optional(),
  tendered_amount:        z.number().min(0).optional(),
  expense_category_code:  z.string().optional(),
  bank_reference:         z.string().optional(),
  party_name:             z.string().optional(),
  description:            z.string().optional(),
  notes:                  z.string().optional(),
});

export const listVoucherFiltersSchema = z.object({
  voucher_type:   z.string().optional(),
  voucher_status: z.string().optional(),
  direction:      z.string().optional(),
  party_type:     z.string().optional(),
  branch_id:      z.string().uuid().optional(),
  date_from:      z.string().optional(),
  date_to:        z.string().optional(),
  search:         z.string().optional(),
}).optional();
