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
  baseAmount: number;
  taxAmount:  number;
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

// ── Checkout settlement option ────────────────────────────────────────────────
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
