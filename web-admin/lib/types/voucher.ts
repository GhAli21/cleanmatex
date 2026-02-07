/**
 * Voucher types for CleanMateX receipt voucher feature.
 * Constants and derived types from lib/constants/voucher.ts.
 */

import type {
  VoucherCategory,
  VoucherType,
  VoucherSubtype,
  VoucherStatus,
} from '../constants/voucher';

export type { VoucherCategory, VoucherType, VoucherSubtype, VoucherStatus };

export interface CreateVoucherInput {
  tenant_org_id: string;
  branch_id?: string;
  voucher_category: VoucherCategory;
  voucher_subtype?: VoucherSubtype;
  voucher_type?: VoucherType;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
  total_amount: number;
  currency_code?: string;
  reason_code?: string;
  content_html?: string;
  content_text?: string;
  metadata?: Record<string, unknown>;
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
}
