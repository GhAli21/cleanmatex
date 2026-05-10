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

/** Gift Card sold (issue_type = SOLD | PROMOTIONAL | CORPORATE | GOODWILL) */
export interface ErpLiteGiftCardSoldInput {
  tenant_org_id?: string;
  gift_card_id: string;
  gift_card_code: string;
  /** issue_type drives which account receives the debit */
  issue_type: 'SOLD' | 'PROMOTIONAL' | 'CORPORATE' | 'GOODWILL' | 'MIGRATION' | 'REPLACEMENT';
  amount: number;
  currency_code: string;
  exchange_rate?: number;
  sold_date: string;
  branch_id?: string | null;
  customer_id?: string | null;
  created_by?: string | null;
}

/** Gift Card redeemed against an order/invoice */
export interface ErpLiteGiftCardRedeemedInput {
  tenant_org_id?: string;
  gift_card_id: string;
  txn_id: string;
  amount: number;
  currency_code: string;
  exchange_rate?: number;
  redeem_date: string;
  order_id?: string | null;
  invoice_id?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
}

/** Gift Card expired (breakage revenue recognition) */
export interface ErpLiteGiftCardExpiredInput {
  tenant_org_id?: string;
  gift_card_id: string;
  txn_id: string;
  amount: number;
  currency_code: string;
  exchange_rate?: number;
  expire_date: string;
  branch_id?: string | null;
  created_by?: string | null;
}

/** Gift Card refunded (redemption reversed) */
export interface ErpLiteGiftCardRefundedInput {
  tenant_org_id?: string;
  gift_card_id: string;
  txn_id: string;
  amount: number;
  currency_code: string;
  exchange_rate?: number;
  refund_date: string;
  order_id?: string | null;
  invoice_id?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
}

/** Gift Card voided by admin */
export interface ErpLiteGiftCardVoidedInput {
  tenant_org_id?: string;
  gift_card_id: string;
  txn_id: string;
  amount: number;
  currency_code: string;
  exchange_rate?: number;
  void_date: string;
  branch_id?: string | null;
  created_by?: string | null;
}

/** Bonus amount granted on a gift card */
export interface ErpLiteGiftCardBonusGrantedInput {
  tenant_org_id?: string;
  gift_card_id: string;
  txn_id: string;
  bonus_amount: number;
  currency_code: string;
  exchange_rate?: number;
  grant_date: string;
  branch_id?: string | null;
  created_by?: string | null;
}

export interface ErpLiteAutoPostDispatchResult {
  status: 'executed' | 'skipped';
  txn_event_code: ErpLiteTxnEventCode;
  policy?: ErpLiteAutoPostPolicy;
  request: ErpLitePostingRequest;
  execute_result?: ErpLitePostingExecuteResult;
  skip_reason?: 'POLICY_NOT_FOUND' | 'POLICY_DISABLED' | 'FEATURE_NOT_ENABLED';
}
