/**
 * Order Financial Platform — TypeScript types
 * Import constants-derived types from order-financial constants.
 */

import type {
  ChargeType,
  TaxType,
  CreditApplicationType,
  CreditApplicationStatus,
  RefundReasonCode,
  RefundMethod,
  PaymentNature,
  SettlementTypeCode,
  OrderFinancialSnapshotStatus,
  OrderFinancialWarningCode,
  ReconciliationSeverity,
  ReconciliationCheckName,
  TaxPricingMode,
  ExtraPricePricingMode,
  RefundSourceType,
  TaxDocumentType,
  TaxDocumentStatus,
  TaxDocumentTriggerEvent,
} from '@/lib/constants/order-financial';

// Re-export constant-derived types for single-import usage
export type {
  ChargeType,
  TaxType,
  CreditApplicationType,
  CreditApplicationStatus,
  RefundReasonCode,
  RefundMethod,
  PaymentNature,
  SettlementTypeCode,
  OrderFinancialSnapshotStatus,
  OrderFinancialWarningCode,
  ReconciliationSeverity,
  ReconciliationCheckName,
  TaxPricingMode,
  ExtraPricePricingMode,
  RefundSourceType,
  TaxDocumentType,
  TaxDocumentStatus,
  TaxDocumentTriggerEvent,
};

// ── Tax breakdown per line ────────────────────────────────────────────────────
/**
 *
 */
export type TaxLineItem = {
  taxType:    TaxType;
  label:      string;
  label2:     string | null;
  rate:       number;
  isCompound: boolean;
  baseAmount: number;
  taxAmount:  number;
  /** FK to org_tax_profiles_cf — populated when the line originates from a profile row. */
  profileId?: string;
};

// ── Charge line ───────────────────────────────────────────────────────────────
/**
 *
 */
export type ChargeLineItem = {
  chargeType: ChargeType;
  label:      string;
  label2:     string | null;
  amount:     number;
  sourceId:   string | null;
};

// ── Credit application input ──────────────────────────────────────────────────
/**
 *
 */
export type CreditApplicationInput = {
  type:        CreditApplicationType;
  referenceId: string;
  amount:      number;
};

// ── Payment leg input ─────────────────────────────────────────────────────────
/**
 *
 */
export type PaymentLegInput = {
  paymentMethodId: string;
  kind:            string;
  amount:          number;
  reference?:      string;
  terminalId?:     string;
  cashTendered?:   number;
};

// ── Full financial snapshot returned by order-calculation.service.ts ──────────
/**
 *
 */
export type FinancialBreakdownSnapshot = {
  subtotal:                number;
  chargesTotal:            number;
  grossTotal:              number;
  discountTotal:           number;
  netBeforeTax:            number;
  taxBreakdown:            TaxLineItem[];
  taxTotal:                number;
  grandTotal:              number;
  creditsTotal:            number;
  netReceivable:           number;
  paymentLegsTotal:        number;
  changeReturned:          number;
  outstanding:             number;
  currencyCode:            string;
  decimalPlaces:           number;
};

/** Canonical warning entry persisted inside the financial snapshot JSON trace. */
export type OrderFinancialCalculationWarning = {
  code: OrderFinancialWarningCode;
  detail?: string;
};

/** Canonical JSON payload persisted on `org_orders_mst.financial_calculation_snapshot`. */
export type OrderFinancialCalculationSnapshot = {
  version: number;
  warningCodes: OrderFinancialWarningCode[];
  usedLegacyTotalFallback: boolean;
  usedHeaderTotalFallback?: boolean;
  hasPaymentTargetUnclassified: boolean;
  hasRefundSourceUnclassified: boolean;
  /** Tax pricing mode resolved at calculation time for audit — 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE'. */
  taxPricingModeAtCalculation: TaxPricingMode;
  sourceTotals: Record<string, number | string | null>;
  derivedTotals: Record<string, number | string | null>;
  lineage: Record<string, string | null>;
  notes: string[];
};

/**
 * Tax-base decomposition per Order Fin v1.1 §8.11. The five buckets describe
 * how the order's commercial base splits across tax treatments for
 * jurisdiction-grade reporting (ZATCA / UAE / Oman VAT). Today the tax engine
 * only emits `taxableAmount`; the other four default to 0 until the engine
 * starts classifying (Phase 5 and later).
 */
export type OrderFinancialTaxBaseDecomposition = {
  taxableAmount: number;
  nonTaxableAmount: number;
  exemptAmount: number;
  zeroRatedAmount: number;
  outOfScopeAmount: number;
};

/** Base-currency reporting projection per ADR-039. */
export type OrderFinancialBaseCurrencySnapshot = {
  baseCurCurrencyCode: string | null;
  baseCurTotalAmount: number;
  baseCurTaxAmount: number;
  baseCurPaidAmount: number;
  baseCurCreditAppliedAmount: number;
  baseCurOutstandingAmount: number;
  baseCurArReceivableAmount: number;
};

/** Canonical order-header snapshot fields preferred by new Order Fin readers. */
export type CanonicalOrderFinancialSnapshot = {
  subtotalAmount: number;
  itemsBaseAmount: number;
  totalAmount: number;
  totalChargesAmount: number;
  totalDiscountAmount: number;
  taxableAmount: number;
  nonTaxableAmount: number;
  exemptAmount: number;
  zeroRatedAmount: number;
  outOfScopeAmount: number;
  totalTaxAmount: number;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  pendingCreditApplicationAmount: number;
  failedCreditApplicationAmount: number;
  refundedAmount: number;
  realPaymentRefundedAmount: number;
  netCollectedAmount: number;
  outstandingAmount: number;
  overpaidAmount: number;
  payOnCollectionAmount: number;
  arReceivableAmount: number;
  baseCurCurrencyCode: string | null;
  baseCurTotalAmount: number;
  baseCurTaxAmount: number;
  baseCurPaidAmount: number;
  baseCurCreditAppliedAmount: number;
  baseCurOutstandingAmount: number;
  baseCurArReceivableAmount: number;
  financialSnapshotStatus: OrderFinancialSnapshotStatus;
  financialMismatchWarningCount: number;
  financialCalculationSnapshot?: OrderFinancialCalculationSnapshot | null;
};

/**
 * A single payment / credit-application / deferred-settlement option available
 * at checkout for the current tenant.
 *
 * Returned by checkout-config.service.ts → getCheckoutOptions() and also
 * constructed inline inside order-submit-orchestrator.service.ts from a raw
 * SQL query that performs COALESCE(org.column, sys.column) for the five D9
 * config fields below. The COALESCE ensures org-level overrides take precedence
 * while system defaults apply when the org has not configured the method.
 */
// Returned by checkout-config.service.ts → getCheckoutOptions()
export type SettlementOption = {
  id:                    string;
  paymentMethodCode:     string;
  paymentNature:         PaymentNature;
  gatewayCode:           string | null;
  displayName:           string;
  displayName2:          string | null;
  settlementTypeCode:    SettlementTypeCode | null;
  creditApplicationType: CreditApplicationType | null;
  requiresCashDrawer:    boolean;
  requiresTerminal:      boolean;
  supportsOverpayment:   boolean;
  supportsChangeReturn:  boolean;
  minAmount:             number | null;
  maxAmount:             number | null;
  minOrderAmount:        number | null;
  maxOrderAmount:        number | null;
  isPlatformDisabled:    boolean;
  isGloballyDisabled:    boolean;
  availableBalance?:     number;
  // ── D9 config fields — resolved via COALESCE(org.column, sys.column) at query time ──
  /**
   * Payment creation status written to the voucher line on submission.
   * Gateway methods default to PROCESSING; CASH and CARD to COMPLETED;
   * everything else to PENDING. Org-level override wins when set.
   * Valid values: COMPLETED | PENDING | PROCESSING.
   */
  defaultCreationStatus: string;
  /**
   * When true, the request may supply a paymentStatus override that replaces
   * defaultCreationStatus on the voucher line (Phase 2 capability; not yet
   * wired through PaymentLeg).
   */
  allowStatusOverride:   boolean;
  /**
   * When true, the payment leg must carry at least one of: gatewayReference,
   * gatewayTransactionId, bankReference, or checkNumber. Enforced by
   * validateSettlementPlan(). Applies to BANK_TRANSFER, CHECK, and configured
   * gateway methods.
   */
  requiresReference:     boolean;
  /**
   * When true, the cashier user ID must be recorded on the payment fact row
   * (audit requirement for high-value cash methods in some GCC jurisdictions).
   */
  isUserIdRequired:      boolean;
  /**
   * When true, this method appears in the POS order creation form.
   * Maps to org_payment_methods_cf.allowed_in_pos. Methods with false are
   * available only in back-office payment flows, not at the POS counter.
   */
  allowedInPos:          boolean;
};

// ── Grouped checkout settlement options ───────────────────────────────────────
/**
 *
 */
export type CheckoutSettlementOptions = {
  paymentMethods:     SettlementOption[];
  creditApplications: SettlementOption[];
  deferredSettlement: SettlementOption[];
  arOptions:          SettlementOption[];
};

// ── Resolved settlement leg (enriched SettlementOption + user input) ──────────
/**
 *
 */
export type ResolvedSettlementLeg = {
  settlementOption:  SettlementOption;
  amount:            number;
  reference?:        string;
  terminalId?:       string;
  cashTendered?:     number;
  creditReferenceId?: string;
  /**
   * BVM Phase 6 Sub-item 6 (B7 closer): explicit per-leg payment status
   * propagated from the request's `paymentLegSchema.paymentStatus`. When
   * omitted, `settleOrder` and `buildSettlementPlan` fall back to the
   * existing gateway/D9-driven logic (gateway → PENDING, otherwise the
   * D9 `defaultCreationStatus`).
   */
  paymentStatus?:    'COMPLETED' | 'PENDING';
};

// ── Reconciliation issue ──────────────────────────────────────────────────────
/**
 *
 */
export type ReconciliationIssue = {
  id:                  string;
  checkName:           ReconciliationCheckName;
  severity:            ReconciliationSeverity;
  affectedEntityType:  string | null;
  affectedEntityId:    string | null;
  expectedValue:       number | null;
  actualValue:         number | null;
  delta:               number | null;
  message:             string;
  status:              'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
};

// ── Phase 7 — Tax-Document types ─────────────────────────────────────────────

/** Decision result from tax-document-decision.service.ts. */
export type TaxDocumentDecision = {
  shouldIssue:  boolean;
  documentType: TaxDocumentType | null;
  reason:       string;
};

/** Input to tax-document-write.service.ts createAndIssueTaxDocument(). */
export type TaxDocumentCreateInput = {
  orderId:       string;
  tenantId:      string;
  documentType:  TaxDocumentType;
  triggerEvent:  TaxDocumentTriggerEvent;
  totalAmount:   number;
  taxAmount:     number;
  currencyCode:  string;
  currencyExRate?: number;
  baseCurrencyCode?: string | null;
  taxLines?:     TaxDocumentLineInput[];
};

/** Single tax line contributed to a tax document. */
export type TaxDocumentLineInput = {
  taxType:        string;
  label:          string;
  label2?:        string | null;
  rate?:          number | null;
  baseAmount:     number;
  taxAmount:      number;
  orderTaxLineId?: string | null;
};

// ── Discount line input ───────────────────────────────────────────────────────
/**
 *
 */
export type DiscountLineInput = {
  sourceType:     string;
  sourceId:       string | null;
  sourceName:     string;
  sourceName2:    string | null;
  discountType:   string;
  discountRate:   number | null;
  discountAmount: number;
  promotionId?:   string;
  stackingGroup?: string;
};
