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
  VoucherStatusLegacy,
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
  VoucherStatusLegacy,
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

export interface VoucherData {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  voucher_no: string;
  voucher_category: string;
  voucher_subtype: string | null;
  voucher_type: string | null;
  invoice_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  total_amount: number;
  currency_code: string | null;
  status: string;
  issued_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  reason_code: string | null;
  reversed_by_voucher_id: string | null;
  content_html: string | null;
  content_text: string | null;
  metadata: unknown;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}

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
  amount: number;
  currency_code?: string;
  currency_ex_rate?: number;
  direction?: VoucherDirection;
  tendered_amount?: number;
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
}

export type UpdateVoucherLineInput = Partial<Omit<CreateVoucherLineInput, 'idempotency_key'>>;

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
  payment_method_code: string | null;
  amount: number;
  currency_code: string | null;
  direction: string | null;
  tendered_amount: number | null;
  change_returned_amount: number | null;
  expense_category_code: string | null;
  party_name: string | null;
  description: string | null;
  line_status: string;
  wiring_status: string;
  reversed_line_id: string | null;
  created_at: Date;
}

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
  party_type: PartyType | null;
  party_name: string | null;
  customer_id: string | null;
  total_amount: number;
  subtotal_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  fee_amount: number | null;
  paid_amount: number | null;
  refunded_amount: number | null;
  outstanding_amount: number | null;
  currency_code: string | null;
  description: string | null;
  notes: string | null;
  posted_at: Date | null;
  posted_by: string | null;
  reversed_at: Date | null;
  reversal_reason: string | null;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  lines: VoucherLineData[];
}

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

export interface PostVoucherInput {
  idempotency_key?: string;
}

export interface ReverseVoucherInput {
  reason: string;
}

export interface VoucherReportFilters {
  date_from: string;
  date_to: string;
  branch_id?: string;
  voucher_type?: VoucherType;
  direction?: VoucherDirection;
}
