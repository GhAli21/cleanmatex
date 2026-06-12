import { z } from 'zod';
import {
  CUSTOMER_RECEIPT_ALLOCATION_MODES,
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  SETTLEMENT_MONEY_EPSILON,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
} from '@/lib/types/customer-receipt-allocation';

const allocationLineSchema = z.object({
  lineRole: z.enum([
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.ORDER_PAYMENT,
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT,
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.STATEMENT_PAYMENT,
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.CUSTOMER_ADVANCE_RECEIPT,
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.WALLET_TOPUP,
    CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.CUSTOMER_CREDIT_ISSUE,
  ]),
  targetType: z.enum([
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_ADVANCE,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.WALLET_TOPUP,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_CREDIT,
    CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.RETURN_CHANGE,
  ]),
  targetId: z.string().uuid(),
  amount: z.number().positive(),
});

export const previewAutoAllocationRequestSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  sourceType: z
    .enum([VOUCHER_SOURCE_TYPES.ORDER_PAYMENT_MODAL, VOUCHER_SOURCE_TYPES.CUSTOMER_RECEIPT])
    .default(VOUCHER_SOURCE_TYPES.ORDER_PAYMENT_MODAL),
  sourceOrderId: z.string().uuid().optional(),
  receiptAmount: z.number().min(0),
  currentOrderAllocationAmount: z.number().min(0),
  excessAmount: z.number().positive(),
  currencyCode: z.string().length(3),
  paymentMethodCode: z.string().min(1).optional(),
  policyCode: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export const previewManualAllocationRequestSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    customerId: z.string().uuid(),
    sourceOrderId: z.string().uuid().optional(),
    receiptAmount: z.number().min(0),
    excessAmount: z.number().positive(),
    currencyCode: z.string().length(3),
    allocations: z.array(allocationLineSchema).min(1),
    idempotencyKey: z.string().min(1).max(200).optional(),
  })
  .superRefine((payload, ctx) => {
    const sum = payload.allocations.reduce((acc, line) => acc + line.amount, 0);
    if (Math.abs(sum - payload.excessAmount) > SETTLEMENT_MONEY_EPSILON) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RECEIPT_ALLOCATION_UNBALANCED',
        path: ['allocations'],
      });
    }
  });

export const confirmAllocationPreviewRequestSchema = z.object({
  previewId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export const postAllocationRequestSchema = z.object({
  previewId: z.string().uuid(),
  customerId: z.string().uuid(),
  sourceOrderId: z.string().uuid().optional(),
  paymentMethodCode: z.string().min(1).optional(),
  cashDrawerSessionId: z.string().uuid().optional(),
  currencyCode: z.string().length(3),
  idempotencyKey: z.string().min(1).max(200),
});

export const postCustomerReceiptRequestSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  previewId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  receiptAmount: z.number().positive(),
  currencyCode: z.string().length(3),
  cashTendered: z.number().optional(),
  cashDrawerSessionId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(200),
});

export type PreviewAutoAllocationRequest = z.infer<typeof previewAutoAllocationRequestSchema>;
export type PreviewManualAllocationRequest = z.infer<typeof previewManualAllocationRequestSchema>;
export type ConfirmAllocationPreviewRequest = z.infer<typeof confirmAllocationPreviewRequestSchema>;
export type PostAllocationRequest = z.infer<typeof postAllocationRequestSchema>;
export type PostCustomerReceiptRequest = z.infer<typeof postCustomerReceiptRequestSchema>;
export type ManualAllocationLineInput = z.infer<typeof allocationLineSchema>;

export { allocationLineSchema };
