import {
  CREDIT_APPLICATION_STATUSES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  REFUND_METHODS,
  SETTLEMENT_TYPE_CODES,
  isArReceivablePaymentTypeCode,
} from '@/lib/constants/order-financial';

const TOLERANCE = 0.0001;

/**
 * Why:
 * Historical orders can carry incomplete canonical snapshot values even when
 * detail rows already contain enough information to render a trustworthy
 * read-model. This helper rebuilds a safe effective snapshot for UI/reporting
 * reads without mutating the database during page load.
 */
export interface EffectiveOrderFinancialSnapshotInput {
  paymentTypeCode: string | null;
  roundingAmount: number;
  snapshot: {
    subtotalAmount: number;
    itemsBaseAmount: number;
    pieceExtraPriceAmount: number;
    preferenceExtraPriceAmount: number;
    serviceChargeAmount: number;
    deliveryChargeAmount: number;
    expressChargeAmount: number;
    otherChargesAmount: number;
    totalChargesAmount: number;
    totalDiscountAmount: number;
    taxableAmount: number;
    /**
     * Tax-base decomposition buckets (v1.1 §8.11). The tax engine emits only
     * `taxableAmount` today; the other four default to 0 until Phase 5 wires
     * bucket classification.
     */
    nonTaxableAmount: number;
    exemptAmount: number;
    zeroRatedAmount: number;
    outOfScopeAmount: number;
    totalTaxAmount: number;
    totalAmount: number;
    totalPaidAmount: number;
    pendingPaymentAmount: number;
    authorizedPaymentAmount: number;
    failedPaymentAmount: number;
    totalCreditAppliedAmount: number;
    pendingCreditApplicationAmount: number;
    failedCreditApplicationAmount: number;
    refundedAmount: number;
    realPaymentRefundedAmount: number;
    storedValueRestoredAmount: number;
    customerCreditIssuedAmount: number;
    netCollectedAmount: number;
    outstandingAmount: number;
    overpaidAmount: number;
    payOnCollectionAmount: number;
    arReceivableAmount: number;
    currencyExRate: number;
    baseCurCurrencyCode: string | null;
    baseCurTotalAmount: number;
    baseCurTaxAmount: number;
    baseCurPaidAmount: number;
    baseCurCreditAppliedAmount: number;
    baseCurOutstandingAmount: number;
    baseCurArReceivableAmount: number;
  };
  charges: Array<{
    charge_type: string;
    amount: number;
  }>;
  discounts: Array<{
    discount_amount: number;
  }>;
  taxes: Array<{
    tax_amount: number;
    taxable_amount?: number;
  }>;
  payments: Array<{
    amount: number;
    payment_status: string | null;
    payment_nature_snapshot: string | null;
    payment_method_code: string | null;
    gateway_code: string | null;
    gateway_reference: string | null;
    branch_payment_method_id: string | null;
  }>;
  creditApplications: Array<{
    applied_amount: number;
    application_status?: string | null;
  }>;
  refunds: Array<{
    refund_amount: number;
    refund_status: string | null;
    refund_method_code: string | null;
    original_payment_id: string | null;
  }>;
}

/**
 * Why:
 * Summary cards, detail breakdowns, and public/read-only routes should all use
 * one canonical fallback policy instead of each inventing slightly different
 * "if zero then guess" math for stale historical snapshots.
 *
 * @param input stored snapshot values plus detail rows already loaded for the read model
 * @returns effective financial snapshot values plus a flag indicating detail fallback usage
 */
export function buildEffectiveOrderFinancialSnapshot(
  input: EffectiveOrderFinancialSnapshotInput,
): EffectiveOrderFinancialSnapshotInput['snapshot'] & {
  usedReadFallback: boolean;
} {
  let usedReadFallback = false;

  const normalizeUpper = (value: string | null | undefined): string => value?.trim().toUpperCase() ?? '';
  const round4 = (value: number): number => Number(value.toFixed(4));
  const isNonZero = (value: number): boolean => Math.abs(value) > TOLERANCE;

  const preferStored = (storedValue: number, derivedValue: number): number => {
    if (isNonZero(storedValue)) return round4(storedValue);
    if (isNonZero(derivedValue)) {
      usedReadFallback = true;
      return round4(derivedValue);
    }
    return 0;
  };

  const isClearlyRealPaymentRow = (row: EffectiveOrderFinancialSnapshotInput['payments'][number]): boolean => {
    const paymentNature = normalizeUpper(row.payment_nature_snapshot);
    if (paymentNature === 'REAL_PAYMENT') return true;
    if (paymentNature) return false;

    return Boolean(
      row.payment_method_code?.trim()
      || row.gateway_code?.trim()
      || row.gateway_reference?.trim()
      || row.branch_payment_method_id?.trim(),
    );
  };

  const sumPaymentStatusAmount = (allowedStatuses: readonly string[]): number => {
    const allowed = new Set(allowedStatuses);

    return input.payments.reduce((sum, row) => {
      if (!allowed.has(normalizeUpper(row.payment_status))) return sum;
      if (!isClearlyRealPaymentRow(row)) return sum;
      return sum + Number(row.amount ?? 0);
    }, 0);
  };

  const classifyRefunds = () => {
    let refundedAmount = 0;
    let realPaymentRefundedAmount = 0;
    let storedValueRestoredAmount = 0;
    let customerCreditIssuedAmount = 0;

    for (const refund of input.refunds) {
      if (normalizeUpper(refund.refund_status) !== 'PROCESSED') continue;

      const amount = Number(refund.refund_amount ?? 0);
      const method = normalizeUpper(refund.refund_method_code);
      refundedAmount += amount;

      if (
        method === REFUND_METHODS.CASH
        || method === REFUND_METHODS.ORIGINAL_METHOD
        || Boolean(refund.original_payment_id)
      ) {
        realPaymentRefundedAmount += amount;
        continue;
      }

      if (method === REFUND_METHODS.WALLET) {
        storedValueRestoredAmount += amount;
        continue;
      }

      if (method === REFUND_METHODS.CREDIT_NOTE) {
        customerCreditIssuedAmount += amount;
      }
    }

    return {
      refundedAmount,
      realPaymentRefundedAmount,
      storedValueRestoredAmount,
      customerCreditIssuedAmount,
    };
  };

  const serviceChargeFromRows = input.charges
    .filter((row) => ['SERVICE', 'SERVICE_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const deliveryChargeFromRows = input.charges
    .filter((row) => ['DELIVERY', 'DELIVERY_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const expressChargeFromRows = input.charges
    .filter((row) => ['EXPRESS', 'EXPRESS_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const totalChargesFromRows = input.charges.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const otherChargesFromRows = Math.max(
    0,
    totalChargesFromRows - serviceChargeFromRows - deliveryChargeFromRows - expressChargeFromRows,
  );
  const totalDiscountFromRows = input.discounts.reduce(
    (sum, row) => sum + Number(row.discount_amount ?? 0),
    0,
  );
  const totalTaxFromRows = input.taxes.reduce((sum, row) => sum + Number(row.tax_amount ?? 0), 0);
  const taxableFromRows = input.taxes.reduce(
    (sum, row) => sum + Number(row.taxable_amount ?? 0),
    0,
  );

  const serviceChargeAmount = preferStored(input.snapshot.serviceChargeAmount, serviceChargeFromRows);
  const deliveryChargeAmount = preferStored(input.snapshot.deliveryChargeAmount, deliveryChargeFromRows);
  const expressChargeAmount = preferStored(input.snapshot.expressChargeAmount, expressChargeFromRows);
  const otherChargesAmount = preferStored(input.snapshot.otherChargesAmount, otherChargesFromRows);
  const totalChargesAmount = preferStored(
    input.snapshot.totalChargesAmount,
    serviceChargeAmount + deliveryChargeAmount + expressChargeAmount + otherChargesAmount,
  );
  const totalDiscountAmount = preferStored(input.snapshot.totalDiscountAmount, totalDiscountFromRows);
  const totalTaxAmount = preferStored(input.snapshot.totalTaxAmount, totalTaxFromRows);

  const fallbackNetBeforeTaxFromStoredTotal = Math.max(
    0,
    Number(input.snapshot.totalAmount ?? 0) - totalTaxAmount - input.roundingAmount,
  );
  const taxableAmount = preferStored(
    input.snapshot.taxableAmount,
    taxableFromRows || fallbackNetBeforeTaxFromStoredTotal,
  );
  const netBeforeTaxAmount = taxableAmount || fallbackNetBeforeTaxFromStoredTotal;
  const subtotalDerivedFromComponents = Math.max(
    0,
    netBeforeTaxAmount + totalDiscountAmount - totalChargesAmount,
  );
  const itemsBaseAmount = preferStored(
    input.snapshot.itemsBaseAmount,
    subtotalDerivedFromComponents,
  );
  const subtotalAmount = preferStored(
    input.snapshot.subtotalAmount,
    itemsBaseAmount || subtotalDerivedFromComponents,
  );
  const totalAmount = preferStored(
    input.snapshot.totalAmount,
    Math.max(0, netBeforeTaxAmount + totalTaxAmount + input.roundingAmount),
  );

  const totalPaidFromRows = sumPaymentStatusAmount(ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED);
  const pendingPaymentFromRows = sumPaymentStatusAmount(ORDER_PAYMENT_LIFECYCLE_STATUSES.PENDING);
  const authorizedPaymentFromRows = sumPaymentStatusAmount(ORDER_PAYMENT_LIFECYCLE_STATUSES.AUTHORIZED);
  const failedPaymentFromRows = sumPaymentStatusAmount(ORDER_PAYMENT_LIFECYCLE_STATUSES.FAILED);
  const sumCreditApplicationAmount = (allowedStatuses: readonly string[]): number => {
    const allowed = new Set(allowedStatuses);
    return input.creditApplications.reduce((sum, row) => {
      const status = normalizeUpper(row.application_status) || CREDIT_APPLICATION_STATUSES.APPLIED;
      if (!allowed.has(status)) return sum;
      return sum + Number(row.applied_amount ?? 0);
    }, 0);
  };
  const totalCreditAppliedFromRows = sumCreditApplicationAmount([CREDIT_APPLICATION_STATUSES.APPLIED]);
  const pendingCreditApplicationFromRows = sumCreditApplicationAmount([
    CREDIT_APPLICATION_STATUSES.PENDING,
    CREDIT_APPLICATION_STATUSES.RESERVED,
    CREDIT_APPLICATION_STATUSES.PROCESSING,
  ]);
  const failedCreditApplicationFromRows = sumCreditApplicationAmount([
    CREDIT_APPLICATION_STATUSES.FAILED,
    CREDIT_APPLICATION_STATUSES.CANCELLED,
    CREDIT_APPLICATION_STATUSES.EXPIRED,
  ]);
  const refundAmounts = classifyRefunds();

  const totalPaidAmount = preferStored(input.snapshot.totalPaidAmount, totalPaidFromRows);
  const pendingPaymentAmount = preferStored(input.snapshot.pendingPaymentAmount, pendingPaymentFromRows);
  const authorizedPaymentAmount = preferStored(input.snapshot.authorizedPaymentAmount, authorizedPaymentFromRows);
  const failedPaymentAmount = preferStored(input.snapshot.failedPaymentAmount, failedPaymentFromRows);
  const totalCreditAppliedAmount = preferStored(
    input.snapshot.totalCreditAppliedAmount,
    totalCreditAppliedFromRows,
  );
  const pendingCreditApplicationAmount = preferStored(
    input.snapshot.pendingCreditApplicationAmount,
    pendingCreditApplicationFromRows,
  );
  const failedCreditApplicationAmount = preferStored(
    input.snapshot.failedCreditApplicationAmount,
    failedCreditApplicationFromRows,
  );
  const refundedAmount = preferStored(input.snapshot.refundedAmount, refundAmounts.refundedAmount);
  const realPaymentRefundedAmount = preferStored(
    input.snapshot.realPaymentRefundedAmount,
    refundAmounts.realPaymentRefundedAmount,
  );
  const storedValueRestoredAmount = preferStored(
    input.snapshot.storedValueRestoredAmount,
    refundAmounts.storedValueRestoredAmount,
  );
  const customerCreditIssuedAmount = preferStored(
    input.snapshot.customerCreditIssuedAmount,
    refundAmounts.customerCreditIssuedAmount,
  );
  const netCollectedAmount = preferStored(
    input.snapshot.netCollectedAmount,
    Math.max(0, totalPaidAmount - realPaymentRefundedAmount),
  );
  const outstandingAmount = preferStored(
    input.snapshot.outstandingAmount,
    Math.max(0, totalAmount - totalPaidAmount - totalCreditAppliedAmount),
  );
  const overpaidAmount = preferStored(
    input.snapshot.overpaidAmount,
    Math.max(0, totalPaidAmount + totalCreditAppliedAmount - totalAmount),
  );
  const payOnCollectionAmount = preferStored(
    input.snapshot.payOnCollectionAmount,
    input.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION ? outstandingAmount : 0,
  );
  const arReceivableAmount = preferStored(
    input.snapshot.arReceivableAmount,
    isArReceivablePaymentTypeCode(input.paymentTypeCode) ? outstandingAmount : 0,
  );
  const baseCurRate = Number.isFinite(input.snapshot.currencyExRate) && input.snapshot.currencyExRate > 0
    ? input.snapshot.currencyExRate
    : 1;

  return {
    subtotalAmount,
    itemsBaseAmount,
    pieceExtraPriceAmount: round4(input.snapshot.pieceExtraPriceAmount),
    preferenceExtraPriceAmount: round4(input.snapshot.preferenceExtraPriceAmount),
    serviceChargeAmount,
    deliveryChargeAmount,
    expressChargeAmount,
    otherChargesAmount,
    totalChargesAmount,
    totalDiscountAmount,
    taxableAmount: round4(taxableAmount || Math.max(0, subtotalAmount + totalChargesAmount - totalDiscountAmount)),
    // Tax-base buckets pass through the stored snapshot 1:1. Phase 5 will
    // wire engine-emitted values; until then they stay at 0 by default.
    nonTaxableAmount: round4(input.snapshot.nonTaxableAmount ?? 0),
    exemptAmount: round4(input.snapshot.exemptAmount ?? 0),
    zeroRatedAmount: round4(input.snapshot.zeroRatedAmount ?? 0),
    outOfScopeAmount: round4(input.snapshot.outOfScopeAmount ?? 0),
    totalTaxAmount,
    totalAmount,
    totalPaidAmount,
    pendingPaymentAmount,
    authorizedPaymentAmount,
    failedPaymentAmount,
    totalCreditAppliedAmount,
    pendingCreditApplicationAmount,
    failedCreditApplicationAmount,
    refundedAmount,
    realPaymentRefundedAmount,
    storedValueRestoredAmount,
    customerCreditIssuedAmount,
    netCollectedAmount,
    outstandingAmount,
    overpaidAmount,
    payOnCollectionAmount,
    arReceivableAmount,
    currencyExRate: baseCurRate,
    baseCurCurrencyCode: input.snapshot.baseCurCurrencyCode ?? null,
    baseCurTotalAmount: preferStored(input.snapshot.baseCurTotalAmount, totalAmount * baseCurRate),
    baseCurTaxAmount: preferStored(input.snapshot.baseCurTaxAmount, totalTaxAmount * baseCurRate),
    baseCurPaidAmount: preferStored(input.snapshot.baseCurPaidAmount, totalPaidAmount * baseCurRate),
    baseCurCreditAppliedAmount: preferStored(
      input.snapshot.baseCurCreditAppliedAmount,
      totalCreditAppliedAmount * baseCurRate,
    ),
    baseCurOutstandingAmount: preferStored(input.snapshot.baseCurOutstandingAmount, outstandingAmount * baseCurRate),
    baseCurArReceivableAmount: preferStored(input.snapshot.baseCurArReceivableAmount, arReceivableAmount * baseCurRate),
    usedReadFallback,
  };
}
