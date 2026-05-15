/**
 * Payment Types for CleanMateX Order System
 *
 * This file contains all TypeScript types and interfaces for the payment module,
 * including payment methods, invoices, discounts, promo codes, and gift cards.
 * Payment codes/statuses: single source of truth is lib/constants/payment.ts; types and key consts re-exported here for one-import convenience.
 * Gift card status/type constants: single source of truth is lib/constants/gift-card.ts.
 */

import {
  type PaymentMethodCode,
  type PaymentKind,
  type PaymentTypeId,
  type InvoiceStatus,
  type PaymentStatus,
  type PaymentGateway,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_TYPE_IDS,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_GATEWAYS,
  getPaymentTypeFromMethod,
} from "../constants/payment";

import {
  type GiftCardStatus,
  type GiftCardTxnType,
  type GiftCardType,
  type GiftCardIssueType,
  GIFT_CARD_STATUS,
  GIFT_CARD_TXN_TYPE,
  GIFT_CARD_TYPE,
  GIFT_CARD_ISSUE_TYPE,
  REDEEMABLE_STATUSES,
  REFUND_REVERTIBLE_STATUSES,
  GIFT_CARD_PIN_MAX_ATTEMPTS,
} from "../constants/gift-card";

/** Re-export gift card constants for one-import convenience */
export type { GiftCardStatus, GiftCardTxnType, GiftCardType, GiftCardIssueType };
export {
  GIFT_CARD_STATUS,
  GIFT_CARD_TXN_TYPE,
  GIFT_CARD_TYPE,
  GIFT_CARD_ISSUE_TYPE,
  REDEEMABLE_STATUSES,
  REFUND_REVERTIBLE_STATUSES,
  GIFT_CARD_PIN_MAX_ATTEMPTS,
};

export type { PaymentMethodCode, PaymentKind, PaymentTypeId, InvoiceStatus, PaymentStatus, PaymentGateway };

/** Re-export key payment constants (single source: lib/constants/payment.ts) for one-import convenience */
export {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_TYPE_IDS,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_GATEWAYS,
  getPaymentTypeFromMethod,
};

// ============================================================================
// Payment Method / Type Entities
// ============================================================================

/** Payment method entity (DB/API record with code, name, etc.) */
export interface PaymentMethod {
  payment_method_code: PaymentMethodCode;
  payment_method_name: string;
  payment_method_name2?: string; // Arabic name
  is_enabled: boolean;
  is_active: boolean;
  payment_method_icon?: string;
  payment_method_color1?: string;
  payment_method_color2?: string;
  payment_method_color3?: string;
  payment_method_image?: string;
  rec_notes?: string;
}

export interface PaymentType {
  payment_type_code: string;
  payment_type_name: string;
  payment_type_name2?: string; // Arabic name
  is_enabled: boolean;
  has_plan: boolean;
  is_active: boolean;
  payment_type_icon?: string;
  payment_type_color1?: string;
  rec_notes?: string;
}

// ============================================================================
// Invoice Types
// ============================================================================

export interface Invoice {
  id: string;
  order_id?: string;
  order_no?: string;
  customer_id?: string;
  customerName?: string;
  tenant_org_id: string;
  branch_id?: string;
  invoice_no: string;
  invoice_date?: string;

  // Amounts
  subtotal: number;
  discount: number;
  tax: number;
  tax_rate?: number;
  total: number;
  vat_rate?: number;
  vat_amount?: number;
  discount_rate?: number;
  service_charge?: number;
  service_charge_type?: string;
  promo_discount_amount?: number;
  /** Renamed from gift_card_discount_amount in migration 0257 */
  gift_card_applied_amount?: number;

  // Payment info
  status: InvoiceStatus;
  due_date?: string;
  payment_terms?: string;
  payment_method_code?: PaymentMethodCode;
  paid_amount: number;
  paid_at?: string;
  paid_by?: string;
  paid_by_name?: string;
  handed_to_name?: string;
  handed_to_mobile_no?: string;
  handed_to_date?: string;
  handed_to_by_user?: string;

  // Reference
  trans_desc?: string;
  customer_reference?: string;

  // Metadata
  metadata?: InvoiceMetadata;
  rec_notes?: string;
  currency_code?: string;
  currency_ex_rate?: number;

  // Audit fields
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  rec_status?: number;
  is_active?: boolean;
}

export interface InvoiceMetadata {
  promo_code_applied?: string;
  promo_discount_amount?: number;
  gift_card_applied?: string;
  gift_card_amount?: number;
  manual_discount_reason?: string;
  tax_rate?: number;
  tax_breakdown?: Record<string, number>;
  payment_gateway_response?: Record<string, any>;
  [key: string]: any;
}

export interface CreateInvoiceInput {
  order_id: string;
  customer_id?: string;
  subtotal: number;
  discount?: number;
  total?: number;
  promo_discount_amount?: number;
  /** Renamed from gift_card_discount_amount in migration 0257 */
  gift_card_applied_amount?: number;
  /** VAT amount (separate from additional tax) */
  vatAmount?: number;
  /** Additional/order tax amount (separate from VAT) */
  tax?: number;
  due_date?: string;
  payment_method_code?: PaymentMethodCode;
  metadata?: InvoiceMetadata;
  rec_notes?: string;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  payment_method_code?: PaymentMethodCode;
  paid_amount?: number;
  paid_at?: string;
  paid_by?: string;
  paid_by_name?: string;
  handed_to_name?: string;
  handed_to_mobile_no?: string;
  handed_to_date?: string;
  handed_to_by_user?: string;
  trans_desc?: string;
  customer_reference?: string;
  metadata?: InvoiceMetadata;
  rec_notes?: string;
}

// ============================================================================
// Payment Transaction Types
// ============================================================================

export interface PaymentTransaction {
  id: string;
  invoice_id?: string;
  voucher_id?: string;
  tenant_org_id: string;
  branch_id?: string;
  order_id?: string;
  customer_id?: string;

  // Payment details
  currency_code: string;
  paid_amount: number;
  status: PaymentStatus;
  due_date?: string;
  payment_method_code: PaymentMethodCode;
  payment_type_code?: string;
  tax?: number;
  vat?: number;

  // Transaction info
  paid_at?: string;
  paid_by?: string;
  gateway?: PaymentGateway;
  transaction_id?: string;

  // Metadata
  metadata?: PaymentTransactionMetadata;
  rec_notes?: string;
  trans_desc?: string;

  // Audit fields
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface PaymentTransactionMetadata {
  gateway_transaction_id?: string;
  gateway_response?: Record<string, any>;
  card_last_four?: string;
  card_brand?: string;
  check_number?: string;
  bank_reference?: string;
  failure_reason?: string;
  refund_reason?: string;
  [key: string]: any;
}

export interface CreatePaymentTransactionInput {
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
  paid_amount: number;
  payment_method_code: PaymentMethodCode;
  currency_code?: string;
  payment_type_code?: string;
  /** @deprecated Use tax_amount */
  tax?: number;
  /** @deprecated Use vat_amount */
  vat?: number;
  tax_rate?: number;
  tax_amount?: number;
  vat_amount?: number;
  paid_by?: string;
  gateway?: PaymentGateway;
  transaction_id?: string;
  metadata?: PaymentTransactionMetadata;
  rec_notes?: string;
  /** Amount breakdown */
  subtotal?: number;
  discount_rate?: number;
  discount_amount?: number;
  manual_discount_amount?: number;
  promo_discount_amount?: number;
  gift_card_applied_amount?: number;
  vat_rate?: number;
  currency_ex_rate?: number;
  payment_channel?: string;
  check_number?: string;
  check_bank?: string;
  check_date?: Date;
  promo_code_id?: string;
  gift_card_id?: string;
  /** For currency lookup when branch-specific */
  branch_id?: string;
  /** Short description/reference for the transaction */
  trans_desc?: string;
}

// ============================================================================
// Payment Data Types (for UI forms)
// ============================================================================

export type DiscountType = 'percentage' | 'amount';

export interface PaymentFormData {
  // Payment method selection
  paymentMethod: PaymentMethodCode;
  checkNumber?: string;

  // Discount
  discountType: DiscountType;
  discountValue: number;

  // Promo code
  promoCode?: string;
  promoCodeApplied?: boolean;
  promoDiscountAmount?: number;

  // Gift card
  giftCardNumber?: string;
  giftCardApplied?: boolean;
  giftCardAmount?: number;

  // Options
  payAllOrders: boolean;
}

export interface PaymentSummary {
  subtotal: number;
  manualDiscount: number;
  promoDiscount: number;
  giftCardApplied: number;
  tax: number;
  total: number;
}

export interface PaymentValidation {
  isValid: boolean;
  errors: PaymentValidationError[];
  warnings?: string[];
}

export interface PaymentValidationError {
  field: string;
  message: string;
  code?: string;
}

// ============================================================================
// Promo Code Types
// ============================================================================

export type PromoDiscountType = 'percentage' | 'fixed_amount';

export interface PromoCode {
  id: string;
  tenant_org_id: string;

  // Code details
  promo_code: string;
  promo_name: string;
  promo_name2?: string; // Arabic name
  description?: string;
  description2?: string; // Arabic description

  // Discount configuration
  discount_type: PromoDiscountType;
  discount_value: number;
  max_discount_amount?: number;

  // Validation rules
  min_order_amount: number;
  max_order_amount?: number;
  applicable_categories?: string[];

  // Usage limits
  max_uses?: number;
  max_uses_per_customer: number;
  current_uses: number;

  // Validity
  valid_from: string;
  valid_to?: string;

  // Status
  is_active: boolean;
  is_enabled: boolean;
  metadata?: Record<string, any>;

  // Audit fields
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface PromoCodeUsage {
  id: string;
  tenant_org_id: string;
  promo_code_id: string;

  // Usage details
  customer_id?: string;
  order_id?: string;
  invoice_id?: string;

  // Discount applied
  discount_amount: number;
  order_total_before: number;
  order_total_after: number;

  // Metadata
  used_at: string;
  used_by?: string;
  metadata?: Record<string, any>;
}

export interface ValidatePromoCodeInput {
  promo_code: string;
  order_total: number;
  customer_id?: string;
  service_categories?: string[];
}

export interface ValidatePromoCodeResult {
  isValid: boolean;
  promoCode?: PromoCode;
  discountAmount?: number;
  error?: string;
  errorCode?:
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'MAX_USES_EXCEEDED'
    | 'MIN_ORDER_NOT_MET'
    | 'CATEGORY_NOT_APPLICABLE'
    | 'CUSTOMER_LIMIT_EXCEEDED'
    | 'UNAUTHORIZED';
}

// ============================================================================
// Gift Card Types
// ============================================================================

// GiftCardStatus is imported from lib/constants/gift-card and re-exported above.

/**
 * Gift card entity returned by service functions.
 *
 * Security rules — NEVER include in this interface:
 *   - card_pin (legacy plaintext PIN)
 *   - pin_hash (bcrypt hash)
 *   - pin_failed_attempts (lock counter)
 */
export interface GiftCard {
  id: string;
  tenant_org_id: string;

  // Card identification (renamed from card_number in migration 0257)
  gift_card_code: string;

  // Card details
  card_name: string;
  card_name2?: string;

  // Balance fields
  original_amount: number;
  current_balance: number;
  available_amount: number;
  redeemed_amount: number;
  bonus_amount: number;
  bonus_remaining: number;

  // Validity
  issued_date: string;
  expiry_date?: string;
  activation_date?: string;

  // Customer association
  issued_to_customer_id?: string;
  issued_to_customer_name?: string;
  purchased_by_cust_id?: string;

  // Card classification
  status: GiftCardStatus;
  is_active: boolean;
  is_reloadable: boolean;
  is_transferable: boolean;
  max_redemptions?: number;
  redemption_count: number;
  issue_type: GiftCardIssueType;
  gift_card_type: GiftCardType;
  currency_code: string;
  batch_id?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  rec_notes?: string;

  // Audit fields
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

/** GiftCardTxnType is imported from lib/constants/gift-card and re-exported above. */

export interface GiftCardTransaction {
  id: string;
  tenant_org_id: string;
  gift_card_id: string;

  // Transaction details
  transaction_type: GiftCardTxnType;
  amount: number;
  balance_before: number;
  balance_after: number;

  // Related entities
  order_id?: string;
  invoice_id?: string;

  // Transaction metadata
  notes?: string;
  transaction_date: string;
  processed_by?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GiftCardTransaction enriched with parent card details — used by the
 * tenant-wide transaction log.
 */
export interface GiftCardTransactionLogRow extends GiftCardTransaction {
  gift_card_code: string;
  card_name: string;
}

export interface ValidateGiftCardInput {
  /** gift_card_code or legacy card number */
  gift_card_code: string;
  card_pin?: string;
}

export interface ValidateGiftCardResult {
  isValid: boolean;
  giftCard?: GiftCard;
  availableBalance?: number;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'EXPIRED' | 'INSUFFICIENT_BALANCE' | 'INVALID_PIN' | 'CARD_SUSPENDED' | 'VOIDED' | 'UNAUTHORIZED';
}

export interface ApplyGiftCardInput {
  gift_card_code: string;
  amount: number;
  order_id: string;
  invoice_id: string;
  processed_by?: string;
}

/** @deprecated Use gift_card_code — kept for internal compatibility during migration */
export type GiftCardTransactionType = GiftCardTxnType;

// ============================================================================
// Discount Rules Types
// ============================================================================

export type DiscountRuleType =
  | 'bulk_discount'
  | 'category_discount'
  | 'customer_tier'
  | 'seasonal'
  | 'first_order'
  | 'loyalty';

export interface DiscountRule {
  id: string;
  tenant_org_id: string;

  // Rule identification
  rule_code: string;
  rule_name: string;
  rule_name2?: string; // Arabic name
  description?: string;
  description2?: string; // Arabic description

  // Rule type
  rule_type: DiscountRuleType;

  // Discount configuration
  discount_type: PromoDiscountType;
  discount_value: number;

  // Conditions
  conditions: DiscountRuleConditions;

  // Priority and stacking
  priority: number;
  can_stack_with_promo: boolean;
  can_stack_with_other_rules: boolean;

  // Validity
  valid_from: string;
  valid_to?: string;

  // Status
  is_active: boolean;
  is_enabled: boolean;
  metadata?: Record<string, any>;

  // Audit fields
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface DiscountRuleConditions {
  min_order_amount?: number;
  min_items?: number;
  service_categories?: string[];
  customer_tiers?: string[];
  days_of_week?: number[]; // 0 = Sunday, 6 = Saturday
  time_ranges?: { start: string; end: string }[];
  [key: string]: any;
}

export interface EvaluateDiscountRulesInput {
  order_total: number;
  items_count: number;
  service_categories: string[];
  customer_tier?: string;
  order_date?: string;
}

export interface EvaluatedDiscount {
  rule: DiscountRule;
  discount_amount: number;
  applied: boolean;
}

// ============================================================================
// Standalone Payment Creation Input (for Create Payment Page)
// ============================================================================

export interface CreateStandalonePaymentInput {
  customer_id?: string;
  order_id?: string;
  invoice_id?: string;
  payment_kind: PaymentKind;
  payment_method_code: PaymentMethodCode;
  amount: number;
  currency_code?: string;
  payment_type_code?: string;
  notes?: string;
  // Check fields
  check_number?: string;
  check_bank?: string;
  check_date?: string;
}

// ============================================================================
// Payment Processing Types
// ============================================================================

export interface ProcessPaymentInput {
  order_id?: string;
  invoice_id?: string;
  customer_id?: string;
  payment_kind?: PaymentKind;
  payment_method_code: PaymentMethodCode;
  amount: number;

  // Optional payment details
  check_number?: string;
  check_bank?: string;
  check_date?: Date;
  gateway_token?: string;

  // Discounts
  manual_discount?: number;
  promo_code?: string;
  promo_code_id?: string;
  gift_card_number?: string;
  gift_card_amount?: number;
  gift_card_id?: string;

  // Amount breakdown (for order payments)
  subtotal?: number;
  discount_rate?: number;
  discount_amount?: number;
  manual_discount_amount?: number;
  promo_discount_amount?: number;
  gift_card_applied_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  final_total?: number;
  currency_code?: string;
  currency_ex_rate?: number;
  branch_id?: string;
  payment_type_code?: string;

  // Metadata
  processed_by?: string;
  notes?: string;
  /** Short description/reference for the transaction */
  trans_desc?: string;
  /** Channel that recorded the payment (e.g. web_admin, pos) */
  payment_channel?: string;
  /** When true and no invoice_id: apply payment across all order invoices with balance (FIFO, oldest first) */
  distribute_across_invoices?: boolean;
}

export interface ProcessPaymentResult {
  success: boolean;
  invoice_id: string;
  transaction_id?: string;
  payment_status: PaymentStatus;
  amount_paid: number;
  remaining_balance: number;
  payment_kind?: PaymentKind;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface RefundPaymentInput {
  transaction_id: string;
  amount: number;
  reason: string;
  processed_by?: string;
  /** Voucher reason_code: CUSTOMER_RETURN, ORDER_CANCELLED, REFUND, etc. */
  reason_code?: string;
}

export interface RefundPaymentResult {
  success: boolean;
  refund_transaction_id: string;
  refund_amount: number;
  error?: string;
}

// ============================================================================
// Payment Gateway Types
// ============================================================================

export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  is_enabled: boolean;
  is_test_mode: boolean;
  config: Record<string, any>;
}

export interface GatewayPaymentRequest {
  amount: number;
  currency: string;
  customer_email?: string;
  customer_name?: string;
  order_reference: string;
  return_url: string;
  callback_url: string;
}

export interface GatewayPaymentResponse {
  success: boolean;
  transaction_id?: string;
  gateway_reference?: string;
  redirect_url?: string;
  status: PaymentStatus;
  error?: string;
  raw_response?: Record<string, any>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface MoneyAmount {
  amount: number;
  currency: string; // Default: 'OMR'
  formatted: string; // e.g., 'OMR 25.500'
}

export interface PaymentReceipt {
  invoice_no: string;
  order_id: string;
  payment_date: string;
  payment_method_code: PaymentMethodCode;
  amount_paid: number;
  payment_summary: PaymentSummary;
  tenant_info: {
    name: string;
    name2?: string;
    address?: string;
    phone?: string;
    tax_id?: string;
  };
  customer_info: {
    name: string;
    phone?: string;
    email?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const PAYMENT_METHOD_ICONS: Record<PaymentMethodCode, string> = {
  CASH: 'banknotes',
  CARD: 'credit-card',
  PAY_ON_COLLECTION: 'hand-coins',
  CHECK: 'receipt',
  INVOICE: 'file-text',
  HYPERPAY: 'credit-card',
  PAYTABS: 'credit-card',
  STRIPE: 'credit-card',
  BANK_TRANSFER: 'building-2',
  MOBILE_PAYMENT: 'smartphone',
  GIFT_CARD: 'gift',
  PROMO_CODE: 'tag',
};

export const DEFAULT_CURRENCY = 'USD';
export const CURRENCY_DECIMALS = 2; // OMR uses 3 decimal places

// ============================================================================
// Payment List Types (for Payments Page)
// ============================================================================

export interface PaymentListItem extends PaymentTransaction {
  // Joined display fields
  customerName?: string;
  customerName2?: string;
  orderReference?: string;
  invoiceNumber?: string;
  paymentMethodName?: string;
  paymentMethodName2?: string;
  paymentTypeName?: string;
  paymentTypeName2?: string;
  // Extended amount fields
  subtotal?: number;
  discount_rate?: number;
  discount_amount?: number;
  manual_discount_amount?: number;
  promo_discount_amount?: number;
  gift_card_applied_amount?: number;
  vat_rate?: number;
  currency_ex_rate?: number;
  // Check fields
  check_number?: string;
  check_bank?: string;
  check_date?: string;
  // Channel
  payment_channel?: string;
  /** True if any refund rows exist for this payment (original); used to hide Cancel */
  hasRefunds?: boolean;
}

export interface PaymentListFilters {
  status?: PaymentStatus[];
  paymentMethodCode?: string[];
  kind?: PaymentKind[];
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

export interface PaymentStats {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<PaymentStatus, { count: number; amount: number }>;
  byMethod: Record<string, { count: number; amount: number }>;
  recentTrends: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface PaymentListResult {
  payments: PaymentListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// ============================================================================
// Cash Up / Reconciliation Types
// ============================================================================

export type CashUpReconciliationStatus = 'pending' | 'reconciled' | 'variance_noted';

export interface CashUpReconciliationEntry {
  payment_method_code: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  status: CashUpReconciliationStatus;
  reconciled_by?: string;
  reconciled_at?: string;
  notes?: string;
}

export interface CashUpSubmitEntry {
  payment_method_code: string;
  actual_amount: number;
  notes?: string;
}

export interface CashUpSubmitInput {
  date: string;
  entries: CashUpSubmitEntry[];
}

export interface CashUpDayData {
  date: string;
  expectedByMethod: Record<string, number>;
  reconciliation: CashUpReconciliationEntry[];
  paymentMethods: PaymentMethod[];
}

/** Amount mismatch diff for create-with-payment AMOUNT_MISMATCH response */
export interface AmountMismatchDiff {
  client: number;
  server: number;
}

export type AmountMismatchDifferences = Partial<
  Record<'subtotal' | 'manualDiscount' | 'promoDiscount' | 'vatValue' | 'finalTotal', AmountMismatchDiff>
>;

// ============================================================================
// V1 Payment Config Client Layer Types
// ============================================================================

import type {
  PaymentNature, FeeType, TerminalType, DrawerType,
  CashDrawerSessionStatus, CashDrawerMovementType, MovementDirection,
  CreditType, OrderPaymentStatus, RefundStatus,
} from '../constants/payment';

export type {
  PaymentNature, FeeType, TerminalType, DrawerType,
  CashDrawerSessionStatus, CashDrawerMovementType, MovementDirection,
  CreditType, OrderPaymentStatus, RefundStatus,
};

/** Typed gateway credential shapes — secrets masked after first save */
export interface HyperPayGatewayConfig {
  entityId: string;
  apiKey: string;
  webhookSecret: string;
  testMode: boolean;
  supportedBrands: string[];
  returnUrl: string;
  cancelUrl: string;
}

export interface StripeGatewayConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  testMode: boolean;
  supportedBrands: string[];
}

export interface PayTabsGatewayConfig {
  entityId: string;
  apiKey: string;
  webhookSecret: string;
  testMode: boolean;
  supportedBrands: string[];
  returnUrl: string;
  cancelUrl: string;
}

export type GatewayConfig = HyperPayGatewayConfig | StripeGatewayConfig | PayTabsGatewayConfig | Record<string, unknown>;

/** Tenant-level payment method config row (gateway_config secrets masked) */
export interface OrgPaymentMethodConfig {
  id: string;
  tenant_org_id: string;
  payment_method_code: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  description: string | null;
  description2: string | null;
  payment_nature: PaymentNature;
  is_enabled: boolean;
  allowed_in_pos: boolean;
  allowed_in_customer_app: boolean;
  allowed_in_staff_app: boolean;
  allowed_in_admin_app: boolean;
  allowed_for_pay_now: boolean;
  allowed_for_pay_on_collection: boolean;
  allowed_for_invoice_payment: boolean;
  allowed_for_refund: boolean;
  supports_partial_payment: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  requires_reference: boolean;
  requires_approval: boolean;
  min_amount: number | null;
  max_amount: number | null;
  currency_code: string | null;
  fee_type: FeeType;
  fee_amount: number;
  fee_rate: number;
  gateway_config: GatewayConfig;
  ui_config: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  rec_status: number;
}

/** Branch-level override row */
export interface OrgBranchPaymentMethodConfig {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  org_payment_method_id: string;
  is_enabled: boolean | null;
  allowed_in_pos: boolean | null;
  allowed_in_customer_app: boolean | null;
  allowed_in_staff_app: boolean | null;
  allowed_for_pay_now: boolean | null;
  allowed_for_pay_on_collection: boolean | null;
  allowed_for_invoice_payment: boolean | null;
  allowed_for_refund: boolean | null;
  cash_drawer_required: boolean;
  terminal_required: boolean;
  min_amount: number | null;
  max_amount: number | null;
  branch_gateway_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  rec_status: number;
}

/** POS terminal row */
export interface OrgPaymentTerminal {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  terminal_code: string;
  terminal_name: string;
  terminal_name2: string | null;
  terminal_type: TerminalType;
  gateway_code: string | null;
  serial_no: string | null;
  merchant_id: string | null;
  terminal_external_id: string | null;
  is_enabled: boolean;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  rec_status: number;
}

/** Cash drawer row */
export interface OrgCashDrawer {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  drawer_code: string;
  drawer_name: string;
  drawer_name2: string | null;
  drawer_type: DrawerType;
  currency_code: string;
  requires_session: boolean;
  opening_float_required: boolean;
  max_cash_limit: number | null;
  assigned_user_id: string | null;
  assigned_terminal_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  rec_status: number;
}

/** Cash drawer session row */
export interface OrgCashDrawerSession {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  cash_drawer_id: string;
  session_no: string;
  opened_by: string;
  opened_at: string;
  opening_float_amount: number;
  currency_code: string;
  status: CashDrawerSessionStatus;
  expected_cash_amount: number;
  counted_cash_amount: number | null;
  difference_amount: number | null;
  closed_by: string | null;
  closed_at: string | null;
  close_notes: string | null;
  force_close_reason: string | null;
  is_active: boolean;
  created_at: string;
}

/** Cash drawer movement row */
export interface OrgCashDrawerMovement {
  id: string;
  tenant_org_id: string;
  branch_id: string;
  cash_drawer_id: string;
  cash_drawer_session_id: string;
  movement_type: CashDrawerMovementType;
  direction: MovementDirection;
  amount: number;
  currency_code: string;
  order_id: string | null;
  order_payment_id: string | null;
  reference_no: string | null;
  reason: string | null;
  performed_by: string;
  performed_at: string;
  created_at: string;
}

/** Dedicated order payment row (org_order_payments_dtl) */
export interface OrgOrderPayment {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  order_id: string;
  customer_id: string | null;
  org_payment_method_id: string | null;
  branch_payment_method_id: string | null;
  payment_terminal_id: string | null;
  cash_drawer_id: string | null;
  cash_drawer_session_id: string | null;
  payment_method_code: string;
  payment_method_name_snapshot: string | null;
  payment_status: OrderPaymentStatus;
  amount: number;
  currency_code: string;
  tendered_amount: number | null;
  change_returned_amount: number | null;
  card_brand_code: string | null;
  card_last4: string | null;
  auth_code: string | null;
  gateway_code: string | null;
  gateway_transaction_id: string | null;
  gateway_reference: string | null;
  check_no: string | null;
  check_bank_name: string | null;
  check_due_date: string | null;
  check_status: string | null;
  bank_reference: string | null;
  idempotency_key: string | null;
  paid_at: string | null;
  received_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  rec_status: number;
  metadata: Record<string, unknown>;
}

// ---- Input Types ----

export interface CreatePaymentMethodConfigInput {
  payment_method_code: string;
  gateway_code?: string;
  display_name: string;
  display_name2?: string;
  description?: string;
  description2?: string;
  payment_nature: PaymentNature;
  allowed_in_pos?: boolean;
  allowed_in_customer_app?: boolean;
  allowed_in_staff_app?: boolean;
  allowed_in_admin_app?: boolean;
  allowed_for_pay_now?: boolean;
  allowed_for_pay_on_collection?: boolean;
  allowed_for_invoice_payment?: boolean;
  allowed_for_refund?: boolean;
  supports_partial_payment?: boolean;
  supports_overpayment?: boolean;
  supports_change_return?: boolean;
  requires_reference?: boolean;
  requires_approval?: boolean;
  min_amount?: number;
  max_amount?: number;
  currency_code?: string;
  fee_type?: FeeType;
  fee_amount?: number;
  fee_rate?: number;
  gateway_config?: GatewayConfig;
  display_order?: number;
}

export type UpdatePaymentMethodConfigInput = Partial<CreatePaymentMethodConfigInput>;

export interface UpdateGatewayConfigInput {
  gateway_config: GatewayConfig;
}

export interface CreateTerminalInput {
  terminal_code: string;
  terminal_name: string;
  terminal_name2?: string;
  terminal_type: TerminalType;
  gateway_code?: string;
  branch_id?: string;
  serial_no?: string;
  merchant_id?: string;
  terminal_external_id?: string;
  config?: Record<string, unknown>;
}

export type UpdateTerminalInput = Partial<CreateTerminalInput>;

export interface CreateCashDrawerInput {
  drawer_code: string;
  drawer_name: string;
  drawer_name2?: string;
  drawer_type: DrawerType;
  branch_id: string;
  currency_code: string;
  requires_session?: boolean;
  opening_float_required?: boolean;
  max_cash_limit?: number;
  assigned_terminal_id?: string;
}

export type UpdateCashDrawerInput = Partial<Omit<CreateCashDrawerInput, 'currency_code' | 'drawer_code'>>;

export interface OpenDrawerSessionInput {
  cash_drawer_id: string;
  branch_id: string;
  opening_float_amount: number;
  currency_code: string;
}

export interface CloseDrawerSessionInput {
  session_id: string;
  counted_cash_amount: number;
  close_notes?: string;
}

export interface UpsertBranchPaymentMethodInput {
  branch_id: string;
  org_payment_method_id: string;
  is_enabled?: boolean;
  allowed_in_pos?: boolean;
  allowed_in_customer_app?: boolean;
  allowed_in_staff_app?: boolean;
  allowed_for_pay_now?: boolean;
  allowed_for_pay_on_collection?: boolean;
  allowed_for_invoice_payment?: boolean;
  allowed_for_refund?: boolean;
  cash_drawer_required?: boolean;
  terminal_required?: boolean;
  min_amount?: number;
  max_amount?: number;
  branch_gateway_config?: Record<string, unknown>;
  display_order?: number;
}

export interface CreateOrderPaymentInput {
  order_id: string;
  customer_id?: string;
  branch_id?: string;
  payment_method_code: string;
  payment_method_name_snapshot?: string;
  amount: number;
  currency_code: string;
  org_payment_method_id?: string;
  branch_payment_method_id?: string;
  payment_terminal_id?: string;
  cash_drawer_id?: string;
  cash_drawer_session_id?: string;
  tendered_amount?: number;
  change_returned_amount?: number;
  card_brand_code?: string;
  card_last4?: string;
  auth_code?: string;
  gateway_code?: string;
  gateway_transaction_id?: string;
  gateway_reference?: string;
  check_no?: string;
  check_bank_name?: string;
  check_due_date?: string;
  bank_reference?: string;
  idempotency_key?: string;
  paid_at?: string;
  received_by?: string;
}
