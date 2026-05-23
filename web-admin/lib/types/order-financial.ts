/**
 * Order Financial Platform — TypeScript types
 * Import constants-derived types from order-financial constants.
 */

import type {
  ChargeType,
  TaxType,
  CreditApplicationType,
  RefundReasonCode,
  RefundMethod,
  PaymentNature,
  SettlementTypeCode,
  ReconciliationSeverity,
  ReconciliationCheckName,
} from '@/lib/constants/order-financial';

// Re-export constant-derived types for single-import usage
export type {
  ChargeType,
  TaxType,
  CreditApplicationType,
  RefundReasonCode,
  RefundMethod,
  PaymentNature,
  SettlementTypeCode,
  ReconciliationSeverity,
  ReconciliationCheckName,
};

// ── Tax breakdown per line ────────────────────────────────────────────────────
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
export type ChargeLineItem = {
  chargeType: ChargeType;
  label:      string;
  label2:     string | null;
  amount:     number;
  sourceId:   string | null;
};

// ── Credit application input ──────────────────────────────────────────────────
export type CreditApplicationInput = {
  type:        CreditApplicationType;
  referenceId: string;
  amount:      number;
};

// ── Payment leg input ─────────────────────────────────────────────────────────
export type PaymentLegInput = {
  paymentMethodId: string;
  kind:            string;
  amount:          number;
  reference?:      string;
  terminalId?:     string;
  cashTendered?:   number;
};

// ── Full financial snapshot returned by order-calculation.service.ts ──────────
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
export type CheckoutSettlementOptions = {
  paymentMethods:     SettlementOption[];
  creditApplications: SettlementOption[];
  deferredSettlement: SettlementOption[];
  arOptions:          SettlementOption[];
};

// ── Resolved settlement leg (enriched SettlementOption + user input) ──────────
export type ResolvedSettlementLeg = {
  settlementOption:  SettlementOption;
  amount:            number;
  reference?:        string;
  terminalId?:       string;
  cashTendered?:     number;
  creditReferenceId?: string;
};

// ── Reconciliation issue ──────────────────────────────────────────────────────
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

// ── Discount line input ───────────────────────────────────────────────────────
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
