import { z } from 'zod';
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE } from '@/lib/constants/voucher';

export const voucherHeaderSchema = z.object({
  voucher_type: z.enum([
    VOUCHER_TYPE.RECEIPT,
    VOUCHER_TYPE.PAYMENT,
    VOUCHER_TYPE.REFUND,
    VOUCHER_TYPE.ADJUSTMENT,
    VOUCHER_TYPE.TRANSFER,
  ] as const, { error: 'Voucher type is required' }),
  branch_id:        z.string().uuid().optional(),
  voucher_date:     z.string().optional(),
  voucher_datetime: z.string().optional(),
  direction:        z.enum([VOUCHER_DIRECTION.IN, VOUCHER_DIRECTION.OUT, VOUCHER_DIRECTION.NEUTRAL]).optional(),
  party_type:       z.enum([PARTY_TYPE.CUSTOMER, PARTY_TYPE.SUPPLIER, PARTY_TYPE.EMPLOYEE, PARTY_TYPE.OTHER]).optional(),
  party_name:       z.string().max(250).optional(),
  customer_id:      z.string().uuid().optional(),
  supplier_id:      z.string().uuid().optional(),
  employee_id:      z.string().uuid().optional(),
  order_id:         z.string().uuid().optional(),
  invoice_id:       z.string().uuid().optional(),
  currency_code:    z.string().length(3).optional(),
  currency_ex_rate: z.number().positive().optional(),
  description:      z.string().max(500).optional(),
  notes:            z.string().optional(),
  idempotency_key:  z.string().optional(),
});

export type VoucherHeaderFormValues = z.infer<typeof voucherHeaderSchema>;
