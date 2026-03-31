import type { PaymentMethodCode } from '@/lib/types/payment';
import type {
  ErpLiteBlockingMode,
  ErpLiteTxnEventCode,
} from '@/lib/constants/erp-lite-posting';
import type {
  ErpLitePostingExecuteResult,
  ErpLitePostingRequest,
} from '@/lib/types/erp-lite-posting';

export interface ErpLiteAutoPostPolicy {
  auto_post_id: string;
  pkg_id: string;
  policy_ver: number;
  txn_event_code: string;
  is_enabled: boolean;
  blocking_mode: ErpLiteBlockingMode;
  required_success: boolean;
  retry_allowed: boolean;
  repost_allowed: boolean;
  failure_action_code: string;
  package_code: string;
  package_version_no: number;
}

export interface ErpLiteInvoiceAutoPostInput {
  tenant_org_id?: string;
  invoice_id: string;
  invoice_no?: string | null;
  order_id?: string | null;
  branch_id?: string | null;
  currency_code: string;
  exchange_rate?: number;
  invoice_date: string;
  subtotal: number;
  discount_amount?: number;
  tax_amount?: number;
  vat_amount?: number;
  total_amount: number;
  created_by?: string | null;
}

export interface ErpLitePaymentAutoPostInput {
  tenant_org_id?: string;
  payment_id: string;
  invoice_id?: string | null;
  order_id?: string | null;
  branch_id?: string | null;
  currency_code: string;
  exchange_rate?: number;
  payment_date: string;
  payment_method_code: PaymentMethodCode;
  paid_amount: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  vat_amount?: number;
  created_by?: string | null;
}

export interface ErpLiteRefundAutoPostInput {
  tenant_org_id?: string;
  refund_payment_id: string;
  original_payment_id: string;
  invoice_id?: string | null;
  order_id?: string | null;
  branch_id?: string | null;
  currency_code: string;
  exchange_rate?: number;
  refund_date: string;
  payment_method_code: PaymentMethodCode;
  refund_amount: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  vat_amount?: number;
  created_by?: string | null;
}

export interface ErpLiteExpenseAutoPostInput {
  tenant_org_id?: string;
  expense_id: string;
  expense_no: string;
  branch_id?: string | null;
  currency_code: string;
  exchange_rate?: number;
  expense_date: string;
  subtotal_amount: number;
  tax_amount?: number;
  total_amount: number;
  settlement_code: 'CASH' | 'BANK';
  created_by?: string | null;
}

export interface ErpLitePettyCashAutoPostInput {
  tenant_org_id?: string;
  cash_txn_id: string;
  txn_no: string;
  cashbox_id: string;
  branch_id?: string | null;
  currency_code: string;
  exchange_rate?: number;
  txn_date: string;
  amount_total: number;
  txn_type_code: 'TOPUP' | 'SPEND';
  created_by?: string | null;
}

export interface ErpLiteAutoPostDispatchResult {
  status: 'executed' | 'skipped';
  txn_event_code: ErpLiteTxnEventCode;
  policy?: ErpLiteAutoPostPolicy;
  request: ErpLitePostingRequest;
  execute_result?: ErpLitePostingExecuteResult;
  skip_reason?: 'POLICY_NOT_FOUND' | 'POLICY_DISABLED';
}
