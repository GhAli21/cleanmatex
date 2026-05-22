import { z } from 'zod';
import {
  AR_ADJUSTMENT_TYPES,
  AR_INVOICE_STATUSES,
  AR_INVOICE_TYPES,
  AR_SENSITIVE_APPROVAL_ACTIONS,
} from '@/lib/constants/ar-invoice';

const uuidSchema = z.string().uuid();
const moneySchema = z.number().nonnegative();
const dateStringSchema = z.string().date().or(z.string().datetime()).optional();

export const arInvoiceStatusSchema = z.enum([
  AR_INVOICE_STATUSES.DRAFT,
  AR_INVOICE_STATUSES.OPEN,
  AR_INVOICE_STATUSES.PARTIALLY_PAID,
  AR_INVOICE_STATUSES.PAID,
  AR_INVOICE_STATUSES.OVERDUE,
  AR_INVOICE_STATUSES.CANCELLED,
  AR_INVOICE_STATUSES.VOID,
  AR_INVOICE_STATUSES.PARTIALLY_REFUNDED,
  AR_INVOICE_STATUSES.REFUNDED,
  AR_INVOICE_STATUSES.WRITTEN_OFF,
  AR_INVOICE_STATUSES.DISPUTED,
]);

export const arInvoiceTypeSchema = z.enum([
  AR_INVOICE_TYPES.ORDER_CREDIT,
  AR_INVOICE_TYPES.B2B_ORDER,
  AR_INVOICE_TYPES.B2B_STATEMENT,
  AR_INVOICE_TYPES.MANUAL_AR,
  AR_INVOICE_TYPES.CREDIT_MEMO,
  AR_INVOICE_TYPES.DEBIT_NOTE,
  AR_INVOICE_TYPES.PROFORMA,
]);

export const arInvoiceLineInputSchema = z.object({
  description: z.string().min(1),
  description2: z.string().optional(),
  quantity: moneySchema.default(1),
  unit_price: moneySchema.default(0),
  subtotal_amount: moneySchema.optional(),
  discount_amount: moneySchema.default(0),
  taxable_amount: moneySchema.optional(),
  tax_rate: z.number().nonnegative().optional(),
  tax_amount: moneySchema.default(0),
  total_amount: moneySchema.optional(),
  currency_code: z.string().length(3),
  source_order_id: uuidSchema.optional(),
  source_order_item_id: uuidSchema.optional(),
  line_type: z.string().min(1).max(30).default('SERVICE'),
  source_type: z.string().max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createArInvoiceSchema = z.object({
  customer_id: uuidSchema,
  branch_id: uuidSchema.optional(),
  order_ids: z.array(uuidSchema).min(1).optional(),
  invoice_type_cd: arInvoiceTypeSchema.default(AR_INVOICE_TYPES.MANUAL_AR),
  invoice_date: dateStringSchema,
  due_date: dateStringSchema,
  payment_terms: z.string().max(50).optional(),
  payment_method_code: z.string().max(50).optional(),
  currency_code: z.string().length(3),
  currency_ex_rate: z.number().positive().default(1),
  subtotal: moneySchema,
  discount: moneySchema.default(0),
  tax: moneySchema.default(0),
  total: moneySchema,
  rec_notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(arInvoiceLineInputSchema).min(1),
});

export const createArInvoiceFromOrdersSchema = z.object({
  order_ids: z.array(uuidSchema).min(1),
  customer_id: uuidSchema.optional(),
  invoice_date: dateStringSchema,
  due_date: dateStringSchema,
  allocation_policy: z.enum(['FULL_ORDER', 'REMAINING_ONLY', 'CUSTOM_AMOUNT']).default('REMAINING_ONLY'),
  currency_code: z.string().length(3).optional(),
  rec_notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateArInvoiceSchema = z.object({
  due_date: dateStringSchema,
  payment_terms: z.string().max(50).optional(),
  payment_method_code: z.string().max(50).optional(),
  rec_notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});

export const issueArInvoiceSchema = z.object({
  issue_date: dateStringSchema,
  issued_by: z.string().max(120).optional(),
  idempotency_key: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

export const approveSensitiveArInvoiceSchema = z.object({
  approval_action_cd: z.enum([
    AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_CREDIT_MEMO,
    AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_DEBIT_NOTE,
    AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_WRITE_OFF,
    AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_VOID,
  ]),
  approval_notes: z.string().max(2000).optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const voidArInvoiceSchema = z.object({
  reason: z.string().min(1).max(2000),
  approved: z.boolean().optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const allocateArPaymentSchema = z.object({
  payment_id: uuidSchema.optional(),
  voucher_id: uuidSchema.optional(),
  allocated_amount: moneySchema,
  unapplied_credit_amount: moneySchema.default(0),
  applied_at: dateStringSchema,
  notes: z.string().max(1000).optional(),
  idempotency_key: z.string().max(120).optional(),
}).refine((value) => !!value.payment_id || !!value.voucher_id, {
  message: 'payment_id or voucher_id is required',
  path: ['payment_id'],
});

export const createCreditNoteSchema = z.object({
  adjustment_amount: moneySchema,
  reason: z.string().min(1).max(2000),
  approval_required: z.boolean().default(true),
  idempotency_key: z.string().max(120).optional(),
});

export const createDebitNoteSchema = z.object({
  adjustment_amount: moneySchema,
  reason: z.string().min(1).max(2000),
  approval_required: z.boolean().default(true),
  idempotency_key: z.string().max(120).optional(),
});

export const writeOffArInvoiceSchema = z.object({
  adjustment_amount: moneySchema.optional(),
  reason: z.string().min(1).max(2000),
  adjustment_type_cd: z.literal(AR_ADJUSTMENT_TYPES.WRITE_OFF).default(AR_ADJUSTMENT_TYPES.WRITE_OFF),
  approval_required: z.boolean().default(true),
  idempotency_key: z.string().max(120).optional(),
});

export const arInvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  invoice_type_cd: z.string().optional(),
  customer_id: uuidSchema.optional(),
  order_id: uuidSchema.optional(),
  branch_id: uuidSchema.optional(),
  search: z.string().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const arLedgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const arStatementQuerySchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  include_open_only: z.coerce.boolean().optional(),
});

export const arAgingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  as_of_date: z.string().date().optional(),
  branch_id: uuidSchema.optional(),
  customer_id: uuidSchema.optional(),
  search: z.string().optional(),
});

export type CreateArInvoiceInput = z.infer<typeof createArInvoiceSchema>;
export type CreateArInvoiceFromOrdersInput = z.infer<typeof createArInvoiceFromOrdersSchema>;
export type UpdateArInvoiceInput = z.infer<typeof updateArInvoiceSchema>;
export type IssueArInvoiceInput = z.infer<typeof issueArInvoiceSchema>;
export type ApproveSensitiveArInvoiceInput = z.infer<typeof approveSensitiveArInvoiceSchema>;
export type VoidArInvoiceInput = z.infer<typeof voidArInvoiceSchema>;
export type AllocateArPaymentInput = z.infer<typeof allocateArPaymentSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>;
export type WriteOffArInvoiceInput = z.infer<typeof writeOffArInvoiceSchema>;
export type ArInvoiceListQuery = z.infer<typeof arInvoiceListQuerySchema>;
export type ArLedgerQuery = z.infer<typeof arLedgerQuerySchema>;
export type ArStatementQuery = z.infer<typeof arStatementQuerySchema>;
export type ArAgingQuery = z.infer<typeof arAgingQuerySchema>;
