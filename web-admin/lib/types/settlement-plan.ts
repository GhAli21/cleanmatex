/**
 * Settlement plan types — output of order-settlement-planner.service.ts.
 *
 * The planner classifies resolved payment legs into two buckets:
 * real payments (create voucher ORDER_PAYMENT lines) and credit applications
 * (create voucher ORDER_CREDIT_APPLICATION lines). Everything else is deferred
 * and handled by settleOrder() directly.
 *
 * NOTE: `changeReturnedAmount` is intentionally absent from these types.
 * Change due to the customer is auto-computed inside addVoucherLine() from
 * tenderedAmount − amount and written directly to the voucher line. Storing
 * it here would duplicate the calculation and create a drift risk.
 */

import type { PaymentLeg } from '../validations/new-order-payment-schemas';

export type { PaymentLeg };

/**
 * One real-money payment leg — maps to an ORDER_PAYMENT voucher line.
 *
 * Built by buildSettlementPlan() from a REAL_PAYMENT-natured ResolvedSettlementLeg.
 * Consumed by the orchestrator to create voucher lines and drive settleOrder().
 */
export interface RealPaymentLeg {
  /**
   * Original index in the resolvedLegs array — used to derive per-leg idempotency
   * sub-keys (e.g. `${idempotencyKey}_vl_rp_${legIndex}`). Must survive array
   * zipping between resolvedLegs and originalLegs.
   */
  legIndex: number;
  paymentMethodCode: string;
  /** FK to org_payment_methods_cf.id */
  orgPaymentMethodId: string;
  amount: number;
  currencyCode: string;
  /** Set when requiresCashDrawer=true and session ID provided in request. */
  cashDrawerSessionId?: string;
  /** Cash tendered by customer (CASH legs only). */
  tenderedAmount?: number;
  /** Effective payment config flag after branch overrides and tenant fallback. */
  supportsChangeReturn: boolean;
  /** Effective payment config flag allowing retained non-cash overpayment. */
  supportsOverpayment: boolean;
  cardBrandCode?: string;
  cardLast4?: string;
  /** Authorization code from terminal for CARD legs. */
  authCode?: string;
  gatewayCode?: string;
  /** Distinct gateway transaction identifier (maps to gateway_transaction_id column). */
  gatewayTransactionId?: string;
  /** Gateway reference string (maps to gateway_reference column). */
  gatewayReference?: string;
  bankReference?: string;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: string;
  terminalId?: string;
  /**
   * Whether a reference number is mandatory for this leg (sourced from D9
   * COALESCE config). Validated by validateSettlementPlan() before any DB write.
   * True for BANK_TRANSFER, CHECK, and configured gateway methods.
   */
  requiresReference: boolean;
  /**
   * Whether an open cash drawer session must be present for this leg (from D9
   * COALESCE config). When true, cashDrawerSessionId must be non-null and the
   * referenced session must have session_status = 'OPEN'.
   */
  requiresCashDrawer: boolean;
  /** When true, terminalId must be present (from D9 COALESCE config). */
  requiresTerminal: boolean;
  /**
   * Default payment creation status sourced from D9 COALESCE config:
   * COMPLETED | PENDING | PROCESSING. Falls back to resolveDefaultStatus()
   * when the config column is null.
   */
  defaultCreationStatus: string;
  /** When true, a paymentStatus override from the request may replace defaultCreationStatus (Phase 2). */
  allowStatusOverride: boolean;
  /**
   * The payment status actually written to the voucher line and payment fact row.
   * Currently equals defaultCreationStatus; override support is reserved for Phase 2
   * (no paymentStatus field on PaymentLeg yet).
   */
  resolvedPaymentStatus: string;
}

/**
 * One credit application leg — maps to an ORDER_CREDIT_APPLICATION voucher line.
 *
 * Built from a CREDIT_APPLICATION-natured ResolvedSettlementLeg. Does not
 * produce a cash movement; reduces the net receivable amount on the order.
 */
export interface CreditApplicationLeg {
  /** Original index in resolvedLegs — used for per-leg idempotency sub-keys (`_vl_ca_${legIndex}`). */
  legIndex: number;
  /**
   * Exact DB values for chk_org_order_credit_apps_type:
   * GIFT_CARD | WALLET | CUSTOMER_CREDIT | LOYALTY_CREDIT | CUSTOMER_ADVANCE
   */
  creditType: string;
  amount: number;
  currencyCode: string;
  creditReferenceId?: string;
}

/**
 * Structured output of buildSettlementPlan() — consumed by the orchestrator.
 *
 * Legs are pre-classified into real-payment and credit-application buckets.
 * Deferred/AR/adjustment legs are excluded from both arrays and instead
 * reflected in outstandingAmount + outstandingPolicy.
 */
export interface SettlementPlan {
  orderId: string;
  /** Server-authoritative grand total used as the denominator for outstanding calculation. */
  totalAmount: number;
  realPaymentLegs: RealPaymentLeg[];
  creditApplicationLegs: CreditApplicationLeg[];
  realPaymentAmount: number;
  creditAppliedAmount: number;
  /** Sum of realPaymentAmount + creditAppliedAmount — drives voucher total_amount. */
  immediateSettlementAmount: number;
  /** totalAmount − immediateSettlementAmount, floored at 0. */
  outstandingAmount: number;
  /**
   * How the outstanding balance is handled after voucher creation:
   *  - NONE: fully settled — no remaining balance.
   *  - PAY_ON_COLLECTION: partial payment; remainder collected at delivery.
   *  - CREDIT_INVOICE: remainder converted to an AR invoice (B2B INVOICE / CREDIT_INVOICE orders).
   * PAY_ON_DELIVERY is not a valid planner output — deferred methods use PAY_ON_COLLECTION.
   */
  outstandingPolicy: 'NONE' | 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE';
  /**
   * True when at least one real or credit-application leg exists.
   * Drives voucher creation in the orchestrator — when false, settleOrder()
   * handles everything directly without a BVM receipt voucher.
   */
  shouldCreateReceiptVoucher: boolean;
  /** True when outstanding balance settles via AR invoice (CREDIT_INVOICE policy). */
  shouldCreateArInvoice: boolean;
  /** Applied settlement minus order total (leg amounts). */
  excessAmount: number;
  /** Cash tendered minus applied on change-capable cash legs. */
  cashChangeCapacity: number;
  /** All cash legs support change return. */
  canReturnChangeFromCash: boolean;
  /** Non-cash supports_overpayment retains excess without explicit disposition. */
  hasAllowedRetainedOverpayment: boolean;
  /** Excess requiring explicit resolution before submit (ADR-047). */
  unresolvedExcessAmount: number;
}
