/**
 * Voucher types for CleanMateX.
 *
 * Legacy types (CreateVoucherInput, VoucherData, CreateReceiptVoucherForPaymentInput,
 * CreateRefundVoucherForPaymentInput) — used by the existing billing/vouchers flow.
 *
 * BVM types — used by the Business Voucher Module (new finance/vouchers UI and services).
 */

import type {
  VoucherCategory,
  VoucherSubtype,
  VoucherType,
  VoucherStatus,
  GlPostingStatus,
  VoucherDirection,
  LineType,
  LineRole,
  TargetType,
  LineStatus,
  WiringStatus,
  PartyType,
} from '../constants/voucher';
import type { Prisma } from '@prisma/client';

export type {
  VoucherCategory,
  VoucherSubtype,
  VoucherType,
  VoucherStatus,
  GlPostingStatus,
  VoucherDirection,
  LineType,
  LineRole,
  TargetType,
  LineStatus,
  WiringStatus,
  PartyType,
};

// ── Legacy types (billing/vouchers receipt-only flow) ─────────────────────────

/**
 *
 */
export interface CreateVoucherInput {
  tenant_org_id: string;
  branch_id?: string;
  voucher_category: VoucherCategory;
  voucher_subtype?: VoucherSubtype;
  voucher_type?: string;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
  total_amount: number;
  currency_code?: string;
  reason_code?: string;
  content_html?: string;
  content_text?: string;
  metadata?: Prisma.InputJsonValue;
  created_by?: string;
}

/**
 *
 */
export interface VoucherData {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  voucher_no: string;
  voucher_category: string;
  voucher_subtype: string | null;
  voucher_type: string | null;
  voucher_status?: string | null;
  posting_status?: string | null;
  direction?: string | null;
  voucher_date?: Date | null;
  voucher_datetime?: Date | null;
  party_type?: string | null;
  party_name?: string | null;
  invoice_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  supplier_id?: string | null;
  employee_id?: string | null;
  total_amount: number;
  paid_amount?: number | null;
  outstanding_amount?: number | null;
  refunded_amount?: number | null;
  currency_code: string | null;
  currency_ex_rate?: number | null;
  issued_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  reason_code: string | null;
  reversed_by_voucher_id: string | null;
  reversed_at?: Date | null;
  reversal_reason?: string | null;
  description?: string | null;
  notes?: string | null;
  source_module?: string | null;
  source_ref_type?: string | null;
  source_ref_id?: string | null;
  content_html: string | null;
  content_text: string | null;
  metadata: unknown;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}

/**
 *
 */
export interface CreateReceiptVoucherForPaymentInput {
  tenant_org_id: string;
  branch_id?: string;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
  total_amount: number;
  currency_code?: string;
  issued_at?: Date;
  created_by?: string;
  auto_issue?: boolean;
  metadata?: Prisma.InputJsonValue;
}

/**
 *
 */
export interface CreateRefundVoucherForPaymentInput {
  tenant_org_id: string;
  branch_id?: string;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
  total_amount: number;
  currency_code?: string;
  reason_code?: string;
  issued_at?: Date;
  created_by?: string;
}

// ── BVM types ─────────────────────────────────────────────────────────────────

/**
 *
 */
export interface CreateBizVoucherInput {
  branch_id?: string;
  voucher_type: VoucherType;
  direction?: VoucherDirection;
  voucher_date?: string;
  voucher_datetime?: string;
  party_type?: PartyType;
  supplier_id?: string;
  employee_id?: string;
  party_name?: string;
  customer_id?: string;
  order_id?: string;
  invoice_id?: string;
  currency_code?: string;
  currency_ex_rate?: number;
  total_amount?: number;
  description?: string;
  notes?: string;
  source_module?: string;
  source_ref_type?: string;
  source_ref_id?: string;
  idempotency_key?: string;
}

/**
 *
 */
export interface UpdateBizVoucherInput {
  branch_id?: string;
  voucher_date?: string;
  voucher_datetime?: string;
  party_type?: PartyType;
  supplier_id?: string;
  employee_id?: string;
  party_name?: string;
  customer_id?: string;
  total_amount?: number;
  description?: string;
  notes?: string;
}

/**
 *
 */
export interface CreateVoucherLineInput {
  line_type: LineType;
  line_role: LineRole;
  target_type?: TargetType;
  target_id?: string;
  order_id?: string;
  customer_id?: string;
  supplier_id?: string;
  employee_id?: string;
  branch_id?: string;
  cash_drawer_session_id?: string;
  payment_method_code?: string;
  payment_status?: string;
  amount: number;
  currency_code?: string;
  currency_ex_rate?: number;
  direction?: VoucherDirection;
  tendered_amount?: number;
  /** When set (including 0), overrides auto-derived cash change. */
  change_returned_amount?: number;
  card_brand_code?: string;
  card_last4?: string;
  auth_code?: string;
  gateway_code?: string;
  gateway_transaction_id?: string;
  gateway_reference?: string;
  bank_reference?: string;
  check_number?: string;
  check_bank?: string;
  check_date?: string;
  expense_category_code?: string;
  party_name?: string;
  description?: string;
  notes?: string;
  reversed_line_id?: string;
  idempotency_key?: string;
  /** For ORDER_CREDIT_APPLICATION lines: WALLET, GIFT_CARD, CUSTOMER_ADVANCE, CREDIT_NOTE, LOYALTY_CREDIT */
  credit_application_type?: string;
  org_payment_method_id?: string;
  payment_terminal_id?: string;
}

/**
 *
 */
export type UpdateVoucherLineInput = Partial<Omit<CreateVoucherLineInput, 'idempotency_key'>>;

/**
 *
 */
export interface VoucherLineData {
  id: string;
  tenant_org_id: string;
  voucher_id: string;
  line_no: number;
  line_type: string;
  line_role: string;
  target_type: string | null;
  target_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  supplier_id?: string | null;
  employee_id?: string | null;
  payment_method_code: string | null;
  payment_status: string | null;
  amount: number;
  currency_code: string | null;
  direction: string | null;
  tendered_amount: number | null;
  change_returned_amount: number | null;
  expense_category_code: string | null;
  party_name: string | null;
  description: string | null;
  notes?: string | null;
  line_status: string;
  wiring_status: string;
  reversed_line_id: string | null;
  created_at: Date;
  credit_application_type: string | null;
  order_payment_id: string | null;
  cash_drawer_mvt_id: string | null;
  org_payment_method_id: string | null;
  payment_terminal_id: string | null;
  cash_drawer_session_id: string | null;
  card_brand_code: string | null;
  card_last4: string | null;
  auth_code?: string | null;
  gateway_code: string | null;
  gateway_transaction_id?: string | null;
  gateway_reference: string | null;
  bank_reference: string | null;
  check_number: string | null;
  check_bank?: string | null;
  check_date?: Date | null;
  branch_id: string | null;
}

/**
 *
 */
export interface BizVoucherDetailData {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  voucher_no: string;
  voucher_type: VoucherType;
  voucher_status: VoucherStatus;
  posting_status: GlPostingStatus;
  direction: VoucherDirection | null;
  voucher_date: string | null;
  voucher_datetime?: string | null;
  party_type: PartyType | null;
  supplier_id?: string | null;
  employee_id?: string | null;
  party_name: string | null;
  customer_id: string | null;
  order_id?: string | null;
  invoice_id?: string | null;
  total_amount: number;
  subtotal_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  fee_amount: number | null;
  paid_amount: number | null;
  refunded_amount: number | null;
  outstanding_amount: number | null;
  currency_code: string | null;
  currency_ex_rate?: number | null;
  description: string | null;
  notes: string | null;
  source_module?: string | null;
  source_ref_type?: string | null;
  source_ref_id?: string | null;
  posted_at: Date | null;
  posted_by: string | null;
  reversed_at: Date | null;
  reversal_reason: string | null;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by?: string | null;
  lines: VoucherLineData[];
}

/**
 *
 */
export interface VoucherListItem {
  id: string;
  voucher_no: string;
  voucher_type: string;
  voucher_status: string;
  direction: string | null;
  party_name: string | null;
  total_amount: number;
  currency_code: string | null;
  voucher_date: string | null;
  created_at: Date;
}

/**
 *
 */
export interface VoucherListFilters {
  voucher_type?: VoucherType;
  voucher_status?: VoucherStatus;
  direction?: VoucherDirection;
  party_type?: PartyType;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
}

/**
 *
 */
export interface PostVoucherInput {
  idempotency_key?: string;
}

/**
 *
 */
export interface ReverseVoucherInput {
  reason: string;
}

/**
 *
 */
export interface VoucherReportFilters {
  date_from: string;
  date_to: string;
  branch_id?: string;
  voucher_type?: VoucherType;
  direction?: VoucherDirection;
}
