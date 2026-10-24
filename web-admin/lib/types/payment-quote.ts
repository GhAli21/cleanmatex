/** Shared checkout quote contract; server and browser consume the same financial snapshot. */
import type { PreviewPaymentRequest } from '@/lib/validations/new-order-payment-schemas';

/** A real payment method or customer credit eligible for the quoted amount. */
export type CheckoutSettlementOption = {
  id: string;
  payment_method_code: string;
  payment_nature: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  description: string | null;
  description2: string | null;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  requires_reference: boolean;
  allowed_in_pos: boolean;
  allowed_for_pay_now?: boolean | null;
  allowed_for_pay_on_collection?: boolean | null;
  allowed_for_invoice_payment?: boolean | null;
  credit_application_type?: string | null;
  available_balance?: number | null;
  requires_credit_reference_selection?: boolean;
  display_order?: number | null;
};

/**
 * Envelope returned by `/api/v1/orders/checkout-options`.
 */
export type CheckoutOptionsResponse = {
  paymentMethods: CheckoutSettlementOption[];
  customerCredits: CheckoutSettlementOption[];
};

/** Authorized customer balances; null in the quote when balance access is denied. */
export type StoredValueSummaryResponse = {
  wallet: {
    walletId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  advance: {
    advanceId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  creditNoteTotal: number;
  creditNotes: Array<{
    id: string;
    remaining_balance: number;
    currency_code: string;
  }>;
  loyalty?: {
    pointsBalance: number;
    availableValue: number;
    expiredUnappliedPoints: number;
    redeemRatePerPoint: number;
  };
};

/** Tax presentation and totals shared with the posting payload. */
export type TaxBreakdownLine = {
  taxType: 'VAT' | 'GST' | 'CUSTOM';
  label: string;
  label2: string | null;
  rate: number;
  isCompound: boolean;
  baseAmount: number;
  taxAmount: number;
  profileId?: string;
};

/**
 * A default tax profile row that feeds the payment preview / client fallback.
 */
export type TaxProfileEntry = {
  id: string;
  name: string;
  name2: string | null;
  tax_type: string;
  rate: number;
  is_compound: boolean;
  enabled: boolean;
};

/**
 * Server-computed totals returned by `/api/v1/orders/preview-payment`.
 */
export type ServerTotals = {
  subtotal: number;
  manualDiscount: number;
  autoRuleDiscount: number;
  promoDiscount: number;
  afterDiscounts: number;
  additionalTaxAmount: number;
  vatValue: number;
  giftCardApplied: number;
  saleTotal: number;
  vatTaxPercent: number;
  taxBreakdown: TaxBreakdownLine[];
  /** B18 — sum of order-level preference charges (e.g. "Whole Order" prefs). 0 when none applied. */
  chargesTotal?: number;
  /** B11 — resolved server-side; drives the "tax included" label. Client never chooses. */
  taxPricingMode?: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
  /** B17 — currency cash-rounding delta applied to saleTotal; 0 when no rule changes it. */
  roundingAdjustmentAmount?: number;
  creditLimit?: {
    currentBalance: number;
    creditLimit: number;
    available: number;
    wouldExceed: boolean;
    mode?: 'warn' | 'block';
  };
};

/** Existing preview inputs plus a correlation token; tenant and user come from authentication. */
export type PaymentQuoteRequest = PreviewPaymentRequest & { requestId: string };

/** One server-authoritative set of totals, currency rules, selected taxes, and amount eligibility. */
export type PaymentQuoteData = ServerTotals & {
  /** Echoed input identity lets the browser reject superseded responses; it is not authorization. */
  requestId: string;
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
  taxProfileEntries: TaxProfileEntry[];
  checkoutOptions: CheckoutOptionsResponse;
  /** Null also represents denied detailed-balance access; callers must not interpret it as zero. */
  storedValueSummary: StoredValueSummaryResponse | null;
};

/** Error codes remain structured so UI feedback is localized rather than displaying server text. */
export type PaymentQuoteResponse =
  | { success: true; data: PaymentQuoteData }
  | { success: false; error?: string; errorCode?: string };
