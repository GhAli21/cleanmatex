import {
  CHARGE_TYPES,
  CREDIT_APPLICATION_STATUSES,
  CREDIT_APPLICATION_TYPES,
  ORDER_FINANCIAL_WARNING_CODES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  SETTLEMENT_TYPE_CODES,
} from '@/lib/constants/order-financial';
import type {
  MapOrderFinancialSummaryInput,
  FinancialWarning,
  OrderFinancialSummaryViewModel,
} from '@features/orders/model/order-financial-summary-view';

function n(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Number(value);
}

function sumChargesByType(charges: MapOrderFinancialSummaryInput['charges'], types: string[]): number {
  return charges
    .filter((c) => types.includes(c.charge_type))
    .reduce((sum, c) => sum + n(c.amount), 0);
}

function normalizeUpper(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

/**
 * Maps Order Fin read model into the Order Details financial summary view model
 * with derived amounts, receivable rules, and consistency warnings.
 * @param input
 */
export function mapOrderFinancialSummaryView(
  input: MapOrderFinancialSummaryInput
): OrderFinancialSummaryViewModel {
  const { snapshot, charges, payments, creditApplications, refunds } = input;

  const itemsBaseAmount = n(snapshot.itemsBaseAmount ?? snapshot.subtotalAmount);
  const pieceExtraPriceAmount = n(snapshot.pieceExtraPriceAmount ?? input.pieceExtraTotal);
  const preferenceExtraPriceAmount = n(snapshot.preferenceExtraPriceAmount ?? input.preferenceExtraTotal);
  const serviceChargeAmount =
    n(snapshot.serviceChargeAmount) || sumChargesByType(charges, ['SERVICE_CHARGE', 'SERVICE']);
  const deliveryChargeAmount = sumChargesByType(charges, ['DELIVERY', 'DELIVERY_CHARGE']);
  const expressChargeAmount =
    sumChargesByType(charges, [CHARGE_TYPES.EXPRESS, 'EXPRESS_CHARGE']) || 0;
  const otherChargesAmount = charges
    .filter(
      (c) =>
        !['SERVICE_CHARGE', 'SERVICE', 'DELIVERY', 'DELIVERY_CHARGE', CHARGE_TYPES.EXPRESS, 'EXPRESS_CHARGE'].includes(
          c.charge_type
        )
    )
    .reduce((sum, c) => sum + n(c.amount), 0);

  const totalChargesAmount = n(snapshot.totalChargesAmount) || serviceChargeAmount + deliveryChargeAmount + expressChargeAmount + otherChargesAmount;
  const subtotalAmount = itemsBaseAmount;
  const grossAmount = Math.max(0, subtotalAmount + totalChargesAmount);
  const discountAmount = n(snapshot.totalDiscountAmount);
  const netBeforeTaxAmount = Math.max(0, grossAmount - discountAmount);
  const taxAmount = n(snapshot.totalTaxAmount);
  const taxableAmount = n(snapshot.taxableAmount) || sumTaxableAmount(input.taxes, netBeforeTaxAmount);
  // Tax-base decomposition (v1.1 §8.11). Default 0 today — engine wiring lands
  // in Phase 5. Surfaced now so the view model contract is stable for Phase 8 UI.
  const nonTaxableAmount = n(snapshot.nonTaxableAmount);
  const exemptAmount = n(snapshot.exemptAmount);
  const zeroRatedAmount = n(snapshot.zeroRatedAmount);
  const outOfScopeAmount = n(snapshot.outOfScopeAmount);
  const roundingAmount = n(input.order?.rounding_adjustment_amount);
  const totalAmount = n(snapshot.totalAmount);
  const totalPaidAmount = n(snapshot.totalPaidAmount);
  const totalCreditAppliedAmount = n(snapshot.totalCreditAppliedAmount);
  const pendingCreditApplicationAmount = n(snapshot.pendingCreditApplicationAmount);
  const failedCreditApplicationAmount = n(snapshot.failedCreditApplicationAmount);
  const refundedAmount = n(snapshot.refundedAmount);
  const realPaymentRefundedAmount = n(snapshot.realPaymentRefundedAmount);
  const netCollectedAmount =
    n(snapshot.netCollectedAmount) || Math.max(0, totalPaidAmount - realPaymentRefundedAmount);
  const expectedOutstandingAmount = Math.max(0, totalAmount - totalPaidAmount - totalCreditAppliedAmount);
  const outstandingAmount = n(snapshot.outstandingAmount);
  const overpaidAmount = Math.max(0, totalPaidAmount + totalCreditAppliedAmount - totalAmount);

  const paymentTypeCode = snapshot.paymentTypeCode;
  const payOnCollectionAmount =
    paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION && outstandingAmount > 0
      ? outstandingAmount
      : 0;
  const invoiceOutstandingAmount = n(input.arInvoice?.outstandingAmount ?? input.arInvoice?.amount);
  const arReceivableAmount = input.arInvoice
    ? invoiceOutstandingAmount
    : n(snapshot.arReceivableAmount)
      || (paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && outstandingAmount > 0
        ? outstandingAmount
        : 0);
  const baseCurrency = {
    currencyCode: snapshot.baseCurCurrencyCode ?? null,
    exchangeRate: n(snapshot.currencyExRate) || 1,
    totalAmount: n(snapshot.baseCurTotalAmount),
    taxAmount: n(snapshot.baseCurTaxAmount),
    paidAmount: n(snapshot.baseCurPaidAmount),
    creditAppliedAmount: n(snapshot.baseCurCreditAppliedAmount),
    outstandingAmount: n(snapshot.baseCurOutstandingAmount),
    arReceivableAmount: n(snapshot.baseCurArReceivableAmount),
  };

  const giftCardCreditAmount = creditApplications.reduce((sum, creditApplication) => {
    return normalizeUpper(creditApplication.credit_type) === CREDIT_APPLICATION_TYPES.GIFT_CARD
      && (normalizeUpper(creditApplication.application_status) || CREDIT_APPLICATION_STATUSES.APPLIED)
        === CREDIT_APPLICATION_STATUSES.APPLIED
      ? sum + n(creditApplication.applied_amount)
      : sum;
  }, 0);

  const warnings = buildWarnings({
    snapshot,
    payments,
    creditApplications,
    totalAmount,
    totalPaidAmount,
    totalCreditAppliedAmount,
    outstandingAmount,
    expectedOutstandingAmount,
    paymentTypeCode,
    arInvoice: input.arInvoice ?? null,
    arInvoiceOutstandingAmount: input.arInvoice ? invoiceOutstandingAmount : null,
    giftCardOnOrder: giftCardCreditAmount,
  });

  const reconciliationStatus: OrderFinancialSummaryViewModel['reconciliationStatus'] =
    warnings.some((w) => w.severity === 'error')
      ? 'error'
      : warnings.some((w) => w.severity === 'warning')
        ? 'warning'
        : 'ok';

  return {
    orderId: snapshot.orderId,
    orderNo: snapshot.orderNo ?? snapshot.orderId,
    customerId: input.order?.customer_id ?? null,
    branchId: input.order?.branch_id ?? null,
    currencyCode: snapshot.currencyCode ?? 'OMR',
    baseCurrency,
    customerName: input.order?.customer_name ?? undefined,
    branchName: input.order?.branch_name ?? undefined,
    orderStatus: input.order?.status ?? undefined,
    createdAt: input.order?.received_at ?? undefined,
    amounts: {
      itemsBaseAmount,
      pieceExtraPriceAmount,
      preferenceExtraPriceAmount,
      serviceChargeAmount,
      deliveryChargeAmount,
      expressChargeAmount,
      otherChargesAmount,
      totalChargesAmount,
      subtotalAmount,
      grossAmount,
      discountAmount,
      netBeforeTaxAmount,
      taxableAmount,
      nonTaxableAmount,
      exemptAmount,
      zeroRatedAmount,
      outOfScopeAmount,
      taxAmount,
      roundingAmount,
      totalAmount,
      totalPaidAmount,
      totalCreditAppliedAmount,
      pendingCreditApplicationAmount,
      failedCreditApplicationAmount,
      refundedAmount,
      netCollectedAmount,
      outstandingAmount,
      expectedOutstandingAmount,
      overpaidAmount,
      payOnCollectionAmount,
      arReceivableAmount,
    },
    payment: {
      paymentTypeCode,
      paymentStatus: snapshot.paymentStatus,
    },
    arInvoice: input.arInvoice ?? null,
    taxDocument: input.taxDocument ?? null,
    payments: input.payments,
    creditApplications: input.creditApplications,
    charges: input.charges,
    discounts: input.discounts,
    taxes: input.taxes,
    refunds: input.refunds,
    adjustments: input.adjustments,
    auditTimeline: input.auditTimeline,
    warnings,
    reconciliationStatus,
    rawSnapshot: {
      ...snapshot,
      serviceChargeAmount,
      roundingAmount,
      arReceivableAmount: n(snapshot.arReceivableAmount),
      financialEngineVersion: snapshot.financialEngineVersion ?? null,
      taxPricingModeAtCalculation:
        (snapshot.financialCalculationSnapshot as Record<string, unknown> | null)
          ?.taxPricingModeAtCalculation as string | null ?? null,
    },
  };
}

function sumTaxableAmount(taxes: MapOrderFinancialSummaryInput['taxes'], fallback: number): number {
  if (!taxes.length) return fallback;
  return taxes.reduce((sum, row) => sum + n(row.taxable_amount), 0);
}

function buildWarnings(ctx: {
  snapshot: MapOrderFinancialSummaryInput['snapshot'];
  payments: MapOrderFinancialSummaryInput['payments'];
  creditApplications: MapOrderFinancialSummaryInput['creditApplications'];
  totalAmount: number;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  outstandingAmount: number;
  expectedOutstandingAmount: number;
  paymentTypeCode: string | null;
  arInvoice: { id: string } | null;
  arInvoiceOutstandingAmount: number | null;
  giftCardOnOrder: number;
}): FinancialWarning[] {
  const warnings: FinancialWarning[] = [];
  const tolerance = 0.001;

  if (Math.abs(ctx.outstandingAmount - ctx.expectedOutstandingAmount) > tolerance) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.OUTSTANDING_MISMATCH,
      severity: 'warning',
      messageKey: 'balanceMismatch',
      messageParams: {
        total: ctx.totalAmount,
        paid: ctx.totalPaidAmount,
        credits: ctx.totalCreditAppliedAmount,
        expected: ctx.expectedOutstandingAmount,
        stored: ctx.outstandingAmount,
      },
    });
  }

  const pendingPayments = ctx.payments.filter((payment) =>
    ORDER_PAYMENT_LIFECYCLE_STATUSES.PENDING.includes(
      normalizeUpper(payment.payment_status) as (typeof ORDER_PAYMENT_LIFECYCLE_STATUSES.PENDING)[number]
    )
  );
  if (pendingPayments.length > 0 && ctx.totalPaidAmount > 0) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID,
      severity: 'info',
      messageKey: 'pendingPaymentsNote',
      messageParams: { count: pendingPayments.length },
    });
  }

  const authorizedPayments = ctx.payments.filter((payment) =>
    ORDER_PAYMENT_LIFECYCLE_STATUSES.AUTHORIZED.includes(
      normalizeUpper(payment.payment_status) as (typeof ORDER_PAYMENT_LIFECYCLE_STATUSES.AUTHORIZED)[number]
    )
  );
  if (authorizedPayments.length > 0 && ctx.totalPaidAmount > 0) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID,
      severity: 'info',
      messageKey: 'pendingPaymentsNote',
      messageParams: { count: authorizedPayments.length },
    });
  }

  const creditSum = ctx.creditApplications.reduce((sum, creditApplication) => {
    const status =
      normalizeUpper(creditApplication.application_status) || CREDIT_APPLICATION_STATUSES.APPLIED;
    if (status !== CREDIT_APPLICATION_STATUSES.APPLIED) return sum;
    return sum + n(creditApplication.applied_amount);
  }, 0);
  if (ctx.giftCardOnOrder > 0 && Math.abs(creditSum - ctx.totalCreditAppliedAmount) > tolerance) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.GIFT_CARD_DOUBLE_COUNTED,
      severity: 'warning',
      messageKey: 'giftCardNotInCredits',
    });
  }

  if (
    ctx.arInvoice &&
    ctx.arInvoiceOutstandingAmount != null &&
    Math.abs(ctx.arInvoiceOutstandingAmount - ctx.outstandingAmount) > tolerance
  ) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.AR_RECEIVABLE_MISMATCH,
      severity: 'warning',
      messageKey: 'arReceivableMismatch',
      messageParams: {
        invoiceOutstanding: ctx.arInvoiceOutstandingAmount,
        orderOutstanding: ctx.outstandingAmount,
      },
    });
  }

  if (ctx.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION && ctx.arInvoice) {
    warnings.push({
      code: 'POC_WITH_AR_INVOICE',
      severity: 'error',
      messageKey: 'payOnCollectionWithArInvoice',
    });
  }

  if (
    ctx.paymentTypeCode !== SETTLEMENT_TYPE_CODES.CREDIT_INVOICE &&
    ctx.totalPaidAmount >= ctx.totalAmount &&
    ctx.totalAmount > 0 &&
    ctx.arInvoice
  ) {
    warnings.push({
      code: 'PAID_WITH_AR_INVOICE',
      severity: 'warning',
      messageKey: 'paidOrderWithArInvoice',
    });
  }

  if (
    ctx.paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE &&
    ctx.outstandingAmount > tolerance &&
    !ctx.arInvoice
  ) {
    warnings.push({
      code: ORDER_FINANCIAL_WARNING_CODES.LEGACY_FIELD_USED_IN_SUMMARY,
      severity: 'warning',
      messageKey: 'creditInvoiceMissingAr',
    });
  }

  return warnings;
}
