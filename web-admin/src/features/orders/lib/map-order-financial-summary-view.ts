import { CHARGE_TYPES, SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
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

/**
 * Maps Order Fin read model into the Order Details financial summary view model
 * with derived amounts, receivable rules, and consistency warnings.
 */
export function mapOrderFinancialSummaryView(
  input: MapOrderFinancialSummaryInput
): OrderFinancialSummaryViewModel {
  const { snapshot, charges, payments, creditApplications, refunds } = input;

  const itemsBaseAmount = n(snapshot.subtotalAmount);
  const pieceExtraPriceAmount = n(input.pieceExtraTotal);
  const preferenceExtraPriceAmount = n(input.preferenceExtraTotal);
  const serviceChargeAmount =
    n(input.order?.service_charge) || sumChargesByType(charges, ['SERVICE_CHARGE', 'SERVICE']);
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
  const taxableAmount = sumTaxableAmount(input.taxes, netBeforeTaxAmount);
  const roundingAmount = n(input.order?.rounding_adjustment_amount);
  const totalAmount = n(snapshot.totalAmount);
  const totalPaidAmount = n(snapshot.totalPaidAmount);
  const totalCreditAppliedAmount = n(snapshot.totalCreditAppliedAmount);
  const refundedAmount = n(snapshot.totalRefundedAmount);
  const netCollectedAmount = Math.max(0, totalPaidAmount + totalCreditAppliedAmount - refundedAmount);
  const expectedOutstandingAmount = Math.max(0, totalAmount - totalPaidAmount - totalCreditAppliedAmount);
  const outstandingAmount = n(snapshot.outstandingAmount);
  const overpaidAmount = Math.max(0, totalPaidAmount + totalCreditAppliedAmount - totalAmount);

  const paymentTypeCode = snapshot.paymentTypeCode;
  const payOnCollectionAmount =
    paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION && outstandingAmount > 0
      ? outstandingAmount
      : 0;
  const invoiceAmount =
    paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && outstandingAmount > 0
      ? outstandingAmount
      : 0;

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
    giftCardOnOrder: n(input.order?.gift_card_applied_amount),
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
    currencyCode: snapshot.currencyCode ?? 'OMR',
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
      taxAmount,
      roundingAmount,
      totalAmount,
      totalPaidAmount,
      totalCreditAppliedAmount,
      refundedAmount,
      netCollectedAmount,
      outstandingAmount,
      expectedOutstandingAmount,
      overpaidAmount,
      payOnCollectionAmount,
      invoiceAmount,
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
      netReceivableAmount: n(input.order?.net_receivable_amount),
      financialEngineVersion: input.order?.financial_engine_version ?? null,
    },
  };
}

function sumTaxableAmount(taxes: MapOrderFinancialSummaryInput['taxes'], fallback: number): number {
  if (!taxes.length) return fallback;
  return taxes.reduce((sum, row) => sum + n(row.tax_amount), 0);
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
  giftCardOnOrder: number;
}): FinancialWarning[] {
  const warnings: FinancialWarning[] = [];
  const tolerance = 0.001;

  if (Math.abs(ctx.outstandingAmount - ctx.expectedOutstandingAmount) > tolerance) {
    warnings.push({
      code: 'BALANCE_MISMATCH',
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

  const pendingPayments = ctx.payments.filter(
    (p) => p.payment_status && p.payment_status !== 'COMPLETED' && p.payment_status !== 'CANCELLED'
  );
  if (pendingPayments.length > 0 && ctx.totalPaidAmount > 0) {
    warnings.push({
      code: 'PENDING_PAYMENT_COUNTED',
      severity: 'info',
      messageKey: 'pendingPaymentsNote',
      messageParams: { count: pendingPayments.length },
    });
  }

  const creditSum = ctx.creditApplications.reduce((s, c) => s + n(c.applied_amount), 0);
  if (ctx.giftCardOnOrder > 0 && Math.abs(creditSum - ctx.totalCreditAppliedAmount) > tolerance) {
    warnings.push({
      code: 'GIFT_CARD_NOT_IN_CREDITS',
      severity: 'warning',
      messageKey: 'giftCardNotInCredits',
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
      code: 'CREDIT_INVOICE_MISSING_AR',
      severity: 'warning',
      messageKey: 'creditInvoiceMissingAr',
    });
  }

  return warnings;
}
