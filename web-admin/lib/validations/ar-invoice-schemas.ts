import { z } from 'zod';
import {
  AR_ADJUSTMENT_TYPES,
  AR_DISPUTE_STATUSES,
  AR_DUNNING_ACTIONS,
  AR_DUNNING_STAGES,
  AR_INVOICE_STATUSES,
  AR_INVOICE_TYPES,
  AR_STATEMENT_CADENCES,
  AR_STATEMENT_CUSTOMER_SCOPES,
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
  idempotency_key: z.string().max(120).optional(),
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
  idempotency_key: z.string().max(120).optional(),
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

export const reverseArPaymentAllocationSchema = z.object({
  reason: z.string().min(1).max(2000),
  reversed_at: dateStringSchema,
  idempotency_key: z.string().max(120).optional(),
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

export const arCreditsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customer_id: uuidSchema.optional(),
  search: z.string().optional(),
});

export const applyArCreditSchema = z.object({
  customer_id: uuidSchema,
  invoice_id: uuidSchema,
  source_ledger_id: uuidSchema,
  applied_amount: moneySchema,
  notes: z.string().max(1000).optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const reverseArCreditApplicationSchema = z.object({
  reason: z.string().min(1).max(2000),
  idempotency_key: z.string().max(120).optional(),
});

export const arDisputesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status_cd: z.string().optional(),
  customer_id: uuidSchema.optional(),
  invoice_id: uuidSchema.optional(),
  search: z.string().optional(),
});

export const createArDisputeSchema = z.object({
  invoice_id: uuidSchema,
  customer_id: uuidSchema,
  reason_cd: z.string().min(1).max(30),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  description2: z.string().max(4000).optional(),
  disputed_amount: moneySchema,
  due_by_at: dateStringSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const resolveArDisputeSchema = z.object({
  status_cd: z.enum([
    AR_DISPUTE_STATUSES.RESOLVED,
    AR_DISPUTE_STATUSES.REJECTED,
    AR_DISPUTE_STATUSES.CANCELLED,
  ]),
  resolution_summary: z.string().min(1).max(4000),
  idempotency_key: z.string().max(120).optional(),
});

export const arDunningQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customer_id: uuidSchema.optional(),
  invoice_id: uuidSchema.optional(),
  status_cd: z.string().optional(),
});

export const runArDunningSchema = z.object({
  customer_id: uuidSchema,
  invoice_id: uuidSchema.optional(),
  stage_cd: z.enum([
    AR_DUNNING_STAGES.REMINDER_1,
    AR_DUNNING_STAGES.REMINDER_2,
    AR_DUNNING_STAGES.FINAL_NOTICE,
    AR_DUNNING_STAGES.CREDIT_HOLD,
  ]),
  action_cd: z.enum([
    AR_DUNNING_ACTIONS.EMAIL,
    AR_DUNNING_ACTIONS.SMS,
    AR_DUNNING_ACTIONS.HOLD,
    AR_DUNNING_ACTIONS.NOTE,
  ]),
  notes: z.string().max(2000).optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const arStatementCyclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const createArStatementCycleSchema = z.object({
  cycle_code: z.string().min(1).max(50),
  cycle_name: z.string().min(1).max(150),
  cycle_name2: z.string().max(150).optional(),
  cadence_cd: z.enum([
    AR_STATEMENT_CADENCES.WEEKLY,
    AR_STATEMENT_CADENCES.BIWEEKLY,
    AR_STATEMENT_CADENCES.MONTHLY,
    AR_STATEMENT_CADENCES.CUSTOM,
  ]),
  customer_scope_cd: z.enum([
    AR_STATEMENT_CUSTOMER_SCOPES.ALL_B2B,
    AR_STATEMENT_CUSTOMER_SCOPES.CUSTOM_LIST,
  ]),
  day_of_month: z.number().int().min(1).max(31).optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  issue_day_offset: z.number().int().min(0).max(31).default(0),
  due_terms_days: z.number().int().min(0).max(365).default(0),
  customer_ids: z.array(uuidSchema).optional(),
  is_active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotency_key: z.string().max(120).optional(),
});

export const previewArStatementCycleSchema = z.object({
  as_of_date: z.string().date().optional(),
});

export type CreateArInvoiceInput = z.infer<typeof createArInvoiceSchema>;
export type CreateArInvoiceFromOrdersInput = z.infer<typeof createArInvoiceFromOrdersSchema>;
export type UpdateArInvoiceInput = z.infer<typeof updateArInvoiceSchema>;
export type IssueArInvoiceInput = z.infer<typeof issueArInvoiceSchema>;
export type ApproveSensitiveArInvoiceInput = z.infer<typeof approveSensitiveArInvoiceSchema>;
export type VoidArInvoiceInput = z.infer<typeof voidArInvoiceSchema>;
export type AllocateArPaymentInput = z.infer<typeof allocateArPaymentSchema>;
export type ReverseArPaymentAllocationInput = z.infer<typeof reverseArPaymentAllocationSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>;
export type WriteOffArInvoiceInput = z.infer<typeof writeOffArInvoiceSchema>;
export type ArInvoiceListQuery = z.infer<typeof arInvoiceListQuerySchema>;
export type ArLedgerQuery = z.infer<typeof arLedgerQuerySchema>;
export type ArStatementQuery = z.infer<typeof arStatementQuerySchema>;
export type ArAgingQuery = z.infer<typeof arAgingQuerySchema>;
export type ArCreditsQuery = z.infer<typeof arCreditsQuerySchema>;
export type ApplyArCreditInput = z.infer<typeof applyArCreditSchema>;
export type ReverseArCreditApplicationInput = z.infer<typeof reverseArCreditApplicationSchema>;
export type ArDisputesQuery = z.infer<typeof arDisputesQuerySchema>;
export type CreateArDisputeInput = z.infer<typeof createArDisputeSchema>;
export type ResolveArDisputeInput = z.infer<typeof resolveArDisputeSchema>;
export type ArDunningQuery = z.infer<typeof arDunningQuerySchema>;
export type RunArDunningInput = z.infer<typeof runArDunningSchema>;
export type ArStatementCyclesQuery = z.infer<typeof arStatementCyclesQuerySchema>;
export type CreateArStatementCycleInput = z.infer<typeof createArStatementCycleSchema>;
export type PreviewArStatementCycleInput = z.infer<typeof previewArStatementCycleSchema>;
