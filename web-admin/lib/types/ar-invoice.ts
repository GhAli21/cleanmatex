import type {
  ArAdjustmentStatus,
  ArAdjustmentType,
  ArAllocationOutcome,
  ArCreditAllocationStatus,
  ArDueDateSource,
  ArDisputeStatus,
  ArDunningAction,
  ArDunningRunStatus,
  ArDunningStage,
  ArInvoiceDocType,
  ArInvoiceStatus,
  ArInvoiceType,
  ArLedgerEntrySide,
  ArLedgerMovement,
  ArStatementCadence,
  ArStatementCustomerScope,
  ArSensitiveApprovalAction,
} from '@/lib/constants/ar-invoice';
import {
  AR_ADJUSTMENT_STATUSES,
  AR_ADJUSTMENT_TYPES,
  AR_ALLOCATION_OUTCOMES,
  AR_CREDIT_ALLOCATION_STATUSES,
  AR_DUE_DATE_SOURCES,
  AR_DISPUTE_STATUSES,
  AR_DUNNING_ACTIONS,
  AR_DUNNING_RUN_STATUSES,
  AR_DUNNING_STAGES,
  AR_INVOICE_DOC_TYPES,
  AR_INVOICE_STATUSES,
  AR_INVOICE_TYPES,
  AR_LEDGER_ENTRY_SIDES,
  AR_LEDGER_MOVEMENTS,
  AR_STATEMENT_CADENCES,
  AR_STATEMENT_CUSTOMER_SCOPES,
  AR_STATUS_BADGE_TONES,
  AR_STATUS_TRANSLATION_KEYS,
  AR_SENSITIVE_APPROVAL_ACTIONS,
} from '@/lib/constants/ar-invoice';

export type {
  ArAdjustmentStatus,
  ArAdjustmentType,
  ArAllocationOutcome,
  ArCreditAllocationStatus,
  ArDueDateSource,
  ArDisputeStatus,
  ArDunningAction,
  ArDunningRunStatus,
  ArDunningStage,
  ArInvoiceDocType,
  ArInvoiceStatus,
  ArInvoiceType,
  ArLedgerEntrySide,
  ArLedgerMovement,
  ArStatementCadence,
  ArStatementCustomerScope,
  ArSensitiveApprovalAction,
};

export {
  AR_ADJUSTMENT_STATUSES,
  AR_ADJUSTMENT_TYPES,
  AR_ALLOCATION_OUTCOMES,
  AR_CREDIT_ALLOCATION_STATUSES,
  AR_DUE_DATE_SOURCES,
  AR_DISPUTE_STATUSES,
  AR_DUNNING_ACTIONS,
  AR_DUNNING_RUN_STATUSES,
  AR_DUNNING_STAGES,
  AR_INVOICE_DOC_TYPES,
  AR_INVOICE_STATUSES,
  AR_INVOICE_TYPES,
  AR_LEDGER_ENTRY_SIDES,
  AR_LEDGER_MOVEMENTS,
  AR_STATEMENT_CADENCES,
  AR_STATEMENT_CUSTOMER_SCOPES,
  AR_STATUS_BADGE_TONES,
  AR_STATUS_TRANSLATION_KEYS,
  AR_SENSITIVE_APPROVAL_ACTIONS,
};

/**
 *
 */
export interface ArInvoiceLine {
  id: string;
  invoice_id: string;
  tenant_org_id: string;
  line_no: number;
  line_type: string;
  source_type?: string;
  source_order_id?: string;
  source_order_item_id?: string;
  description: string;
  description2?: string;
  quantity: number;
  unit_price: number;
  subtotal_amount: number;
  discount_amount: number;
  taxable_amount: number;
  tax_rate?: number;
  tax_amount: number;
  total_amount: number;
  currency_code: string;
  currency_ex_rate: number;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArInvoiceOrderLink {
  id: string;
  invoice_id: string;
  order_id: string;
  order_total_amount: number;
  invoiced_amount: number;
  paid_before_amount: number;
  credit_before_amount: number;
  outstanding_amount: number;
  allocation_policy: 'FULL_ORDER' | 'REMAINING_ONLY' | 'CUSTOM_AMOUNT';
}

/**
 *
 */
export interface ArInvoicePaymentAllocation {
  id: string;
  invoice_id: string;
  payment_id?: string;
  voucher_id?: string;
  allocation_no: number;
  allocation_outcome: ArAllocationOutcome;
  allocated_amount: number;
  unapplied_credit_amount: number;
  applied_at: string;
  reversed_at?: string;
  reversed_by?: string;
  reversal_reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArInvoiceAdjustment {
  id: string;
  invoice_id: string;
  adjustment_no: number;
  adjustment_type_cd: ArAdjustmentType;
  adjustment_amount: number;
  status_cd: ArAdjustmentStatus;
  approval_action_cd?: ArSensitiveApprovalAction;
  approved_at?: string;
  approved_by?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArInvoiceStatusHistoryEntry {
  id: string;
  invoice_id: string;
  from_status?: ArInvoiceStatus;
  to_status: ArInvoiceStatus;
  action_cd?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  created_by?: string;
}

/**
 *
 */
export interface ArCustomerLedgerEntry {
  id: string;
  customer_id: string;
  invoice_id?: string;
  payment_alloc_id?: string;
  adjustment_id?: string;
  voucher_id?: string;
  entry_no: number;
  movement_cd: ArLedgerMovement;
  entry_side: ArLedgerEntrySide;
  amount: number;
  running_balance: number;
  currency_code: string;
  event_at: string;
  ref_doc_no?: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArCustomerBalance {
  customer_id: string;
  currency_code: string;
  open_invoice_count: number;
  total_invoiced_amount: number;
  total_paid_amount: number;
  total_outstanding_amount: number;
  unapplied_credit_amount: number;
  net_balance_amount: number;
  last_activity_at?: string;
}

/**
 *
 */
export interface ArCustomerBalanceRow extends ArCustomerBalance {
  customer_name?: string;
  customer_name2?: string;
}

/**
 *
 */
export interface ArAgingBucketSummary {
  bucket_code: 'CURRENT' | 'DUE_1_30' | 'DUE_31_60' | 'DUE_61_90' | 'DUE_90_PLUS';
  invoice_count: number;
  total_amount: number;
}

/**
 *
 */
export interface ArAgingCustomerRow {
  customer_id: string;
  customer_name?: string;
  customer_name2?: string;
  currency_code: string;
  current_amount: number;
  due_1_30_amount: number;
  due_31_60_amount: number;
  due_61_90_amount: number;
  due_90_plus_amount: number;
  total_outstanding_amount: number;
}

/**
 *
 */
export interface ArStatementLine {
  kind: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT' | 'LEDGER';
  event_at: string;
  ref_no?: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  currency_code: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArCustomerStatement {
  customer_id: string;
  customer_name?: string;
  customer_name2?: string;
  currency_code: string;
  period_start?: string;
  period_end?: string;
  opening_balance: number;
  closing_balance: number;
  lines: ArStatementLine[];
}

/**
 *
 */
export interface ArInvoiceDetail {
  invoice: {
    id: string;
    tenant_org_id: string;
    order_id?: string;
    customer_id?: string;
    branch_id?: string;
    invoice_no: string;
    invoice_date?: string;
    invoice_type_cd?: ArInvoiceType;
    status: ArInvoiceStatus;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    outstanding_amount: number;
    currency_code: string;
    currency_ex_rate: number;
    due_date?: string;
    due_date_source_cd?: ArDueDateSource;
    due_terms_days?: number;
    payment_terms?: string;
    payment_method_code?: string;
    approval_required: boolean;
    approval_action_cd?: ArSensitiveApprovalAction;
    approved_at?: string;
    approved_by?: string;
    approval_notes?: string;
    numbering_doc_type_cd?: ArInvoiceDocType;
    numbering_seq_no?: number;
    issued_at?: string;
    issued_by?: string;
    voided_at?: string;
    voided_by?: string;
    void_reason?: string;
    customer_name?: string;
    customer_name2?: string;
    order_no?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at?: string;
  };
  lines: ArInvoiceLine[];
  orders: ArInvoiceOrderLink[];
  allocations: ArInvoicePaymentAllocation[];
  adjustments: ArInvoiceAdjustment[];
  history: ArInvoiceStatusHistoryEntry[];
  ledger: ArCustomerLedgerEntry[];
}

/**
 *
 */
export type ArInvoiceSummary = ArInvoiceDetail['invoice'];

/**
 *
 */
export interface ArInvoiceHubStats {
  total_invoices: number;
  draft_invoices: number;
  open_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_outstanding_amount: number;
}

/**
 *
 */
export interface ArCustomerCreditRow {
  source_ledger_id: string;
  customer_id: string;
  customer_name?: string;
  customer_name2?: string;
  currency_code: string;
  available_credit_amount: number;
  last_credit_at?: string;
  ref_doc_no?: string;
}

/**
 *
 */
export interface ArCreditApplication {
  id: string;
  tenant_org_id: string;
  customer_id: string;
  invoice_id: string;
  source_ledger_id: string;
  invoice_alloc_id?: string;
  allocation_no: number;
  allocation_status_cd: ArCreditAllocationStatus;
  applied_amount: number;
  applied_at: string;
  reversed_at?: string;
  reversed_by?: string;
  reversal_reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArDisputeCase {
  id: string;
  tenant_org_id: string;
  invoice_id: string;
  customer_id: string;
  dispute_no: string;
  status_cd: ArDisputeStatus;
  reason_cd: string;
  title: string;
  description: string;
  description2?: string;
  disputed_amount: number;
  opened_at: string;
  opened_by?: string;
  assigned_to?: string;
  assigned_at?: string;
  due_by_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_summary?: string;
  metadata?: Record<string, unknown>;
  invoice_no?: string;
  customer_name?: string;
  customer_name2?: string;
}

/**
 *
 */
export interface ArDunningRun {
  id: string;
  tenant_org_id: string;
  customer_id: string;
  invoice_id?: string;
  run_no: number;
  stage_cd: ArDunningStage;
  action_cd: ArDunningAction;
  status_cd: ArDunningRunStatus;
  scheduled_for?: string;
  executed_at?: string;
  response_message?: string;
  metadata?: Record<string, unknown>;
  customer_name?: string;
  customer_name2?: string;
  invoice_no?: string;
}

/**
 *
 */
export interface ArStatementCycle {
  id: string;
  tenant_org_id: string;
  cycle_code: string;
  cycle_name: string;
  cycle_name2?: string;
  cadence_cd: ArStatementCadence;
  customer_scope_cd: ArStatementCustomerScope;
  day_of_month?: number;
  day_of_week?: number;
  issue_day_offset: number;
  due_terms_days: number;
  last_run_at?: string;
  next_run_at?: string;
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

/**
 *
 */
export interface ArStatementCycleCustomer {
  id: string;
  cycle_id: string;
  customer_id: string;
  b2b_contract_id?: string;
  is_active: boolean;
  customer_name?: string;
  customer_name2?: string;
}
