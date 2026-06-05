import { buildEffectiveOrderFinancialSnapshot } from '@/lib/utils/order-financial-effective-snapshot';

describe('buildEffectiveOrderFinancialSnapshot', () => {
  it('rebuilds effective totals from detail rows when the stored snapshot stayed at zero', () => {
    const snapshot = buildEffectiveOrderFinancialSnapshot({
      paymentTypeCode: 'PAY_IN_ADVANCE',
      roundingAmount: 0,
      snapshot: {
        subtotalAmount: 0,
        itemsBaseAmount: 0,
        pieceExtraPriceAmount: 0,
        preferenceExtraPriceAmount: 0,
        serviceChargeAmount: 0,
        deliveryChargeAmount: 0,
        expressChargeAmount: 0,
        otherChargesAmount: 0,
        totalChargesAmount: 0,
        totalDiscountAmount: 0,
        taxableAmount: 0,
        nonTaxableAmount: 0,
        exemptAmount: 0,
        zeroRatedAmount: 0,
        outOfScopeAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        pendingCreditApplicationAmount: 0,
        failedCreditApplicationAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 0,
        outstandingAmount: 0,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 0,
        currencyExRate: 3.6725,
        baseCurCurrencyCode: 'AED',
        baseCurTotalAmount: 0,
        baseCurTaxAmount: 0,
        baseCurPaidAmount: 0,
        baseCurCreditAppliedAmount: 0,
        baseCurOutstandingAmount: 0,
        baseCurArReceivableAmount: 0,
      },
      charges: [],
      discounts: [{ discount_amount: 0.17 }],
      taxes: [{ tax_amount: 0.227, taxable_amount: 3.23 }],
      payments: [
        {
          amount: 3.457,
          payment_status: 'completed',
          payment_nature_snapshot: 'REAL_PAYMENT',
          payment_method_code: 'CARD',
          gateway_code: null,
          gateway_reference: null,
          branch_payment_method_id: null,
        },
      ],
      creditApplications: [],
      refunds: [],
    });

    expect(snapshot.usedReadFallback).toBe(true);
    expect(snapshot.subtotalAmount).toBeCloseTo(3.4);
    expect(snapshot.itemsBaseAmount).toBeCloseTo(3.4);
    expect(snapshot.taxableAmount).toBeCloseTo(3.23);
    expect(snapshot.totalTaxAmount).toBeCloseTo(0.227);
    expect(snapshot.totalAmount).toBeCloseTo(3.457);
    expect(snapshot.totalPaidAmount).toBeCloseTo(3.457);
    expect(snapshot.netCollectedAmount).toBeCloseTo(3.457);
    expect(snapshot.outstandingAmount).toBeCloseTo(0);
    expect(snapshot.baseCurCurrencyCode).toBe('AED');
    expect(snapshot.baseCurTotalAmount).toBeCloseTo(12.6958);
    expect(snapshot.baseCurPaidAmount).toBeCloseTo(12.6958);
  });

  it('keeps stored non-zero canonical values when they already exist', () => {
    const snapshot = buildEffectiveOrderFinancialSnapshot({
      paymentTypeCode: 'CREDIT_INVOICE',
      roundingAmount: 0,
      snapshot: {
        subtotalAmount: 5,
        itemsBaseAmount: 5,
        pieceExtraPriceAmount: 0,
        preferenceExtraPriceAmount: 0,
        serviceChargeAmount: 0.5,
        deliveryChargeAmount: 0,
        expressChargeAmount: 0,
        otherChargesAmount: 0,
        totalChargesAmount: 0.5,
        totalDiscountAmount: 0.25,
        taxableAmount: 5.25,
        nonTaxableAmount: 0,
        exemptAmount: 0,
        zeroRatedAmount: 0,
        outOfScopeAmount: 0,
        totalTaxAmount: 0.2625,
        totalAmount: 5.5125,
        totalPaidAmount: 2,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        pendingCreditApplicationAmount: 0,
        failedCreditApplicationAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 2,
        outstandingAmount: 3.5125,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 3.5125,
        currencyExRate: 1,
        baseCurCurrencyCode: 'OMR',
        baseCurTotalAmount: 5.5125,
        baseCurTaxAmount: 0.2625,
        baseCurPaidAmount: 2,
        baseCurCreditAppliedAmount: 0,
        baseCurOutstandingAmount: 3.5125,
        baseCurArReceivableAmount: 3.5125,
      },
      charges: [{ charge_type: 'SERVICE_CHARGE', amount: 0.1 }],
      discounts: [{ discount_amount: 0.1 }],
      taxes: [{ tax_amount: 0.01, taxable_amount: 0.2 }],
      payments: [],
      creditApplications: [],
      refunds: [],
    });

    expect(snapshot.usedReadFallback).toBe(false);
    expect(snapshot.totalAmount).toBeCloseTo(5.5125);
    expect(snapshot.totalPaidAmount).toBeCloseTo(2);
    expect(snapshot.outstandingAmount).toBeCloseTo(3.5125);
    expect(snapshot.arReceivableAmount).toBeCloseTo(3.5125);
  });

  it('passes through tax-base decomposition buckets from the stored snapshot (v1.1 §8.11)', () => {
    const snapshot = buildEffectiveOrderFinancialSnapshot({
      paymentTypeCode: 'PAY_IN_ADVANCE',
      roundingAmount: 0,
      snapshot: {
        subtotalAmount: 200,
        itemsBaseAmount: 200,
        pieceExtraPriceAmount: 0,
        preferenceExtraPriceAmount: 0,
        serviceChargeAmount: 0,
        deliveryChargeAmount: 0,
        expressChargeAmount: 0,
        otherChargesAmount: 0,
        totalChargesAmount: 0,
        totalDiscountAmount: 0,
        taxableAmount: 100,
        nonTaxableAmount: 25,
        exemptAmount: 30,
        zeroRatedAmount: 15,
        outOfScopeAmount: 30,
        totalTaxAmount: 5,
        totalAmount: 205,
        totalPaidAmount: 205,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        pendingCreditApplicationAmount: 0,
        failedCreditApplicationAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 205,
        outstandingAmount: 0,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 0,
        currencyExRate: 1,
        baseCurCurrencyCode: 'OMR',
        baseCurTotalAmount: 0,
        baseCurTaxAmount: 0,
        baseCurPaidAmount: 0,
        baseCurCreditAppliedAmount: 0,
        baseCurOutstandingAmount: 0,
        baseCurArReceivableAmount: 0,
      },
      charges: [],
      discounts: [],
      taxes: [],
      payments: [],
      creditApplications: [],
      refunds: [],
    });

    expect(snapshot.taxableAmount).toBeCloseTo(100);
    expect(snapshot.nonTaxableAmount).toBeCloseTo(25);
    expect(snapshot.exemptAmount).toBeCloseTo(30);
    expect(snapshot.zeroRatedAmount).toBeCloseTo(15);
    expect(snapshot.outOfScopeAmount).toBeCloseTo(30);
  });

  it('derives credit lifecycle buckets from application_status when the stored snapshot is still zero', () => {
    const snapshot = buildEffectiveOrderFinancialSnapshot({
      paymentTypeCode: 'PAY_IN_ADVANCE',
      roundingAmount: 0,
      snapshot: {
        subtotalAmount: 100,
        itemsBaseAmount: 100,
        pieceExtraPriceAmount: 0,
        preferenceExtraPriceAmount: 0,
        serviceChargeAmount: 0,
        deliveryChargeAmount: 0,
        expressChargeAmount: 0,
        otherChargesAmount: 0,
        totalChargesAmount: 0,
        totalDiscountAmount: 0,
        taxableAmount: 100,
        nonTaxableAmount: 0,
        exemptAmount: 0,
        zeroRatedAmount: 0,
        outOfScopeAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 100,
        totalPaidAmount: 0,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        pendingCreditApplicationAmount: 0,
        failedCreditApplicationAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 0,
        outstandingAmount: 0,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 0,
        currencyExRate: 1,
        baseCurCurrencyCode: 'OMR',
        baseCurTotalAmount: 0,
        baseCurTaxAmount: 0,
        baseCurPaidAmount: 0,
        baseCurCreditAppliedAmount: 0,
        baseCurOutstandingAmount: 0,
        baseCurArReceivableAmount: 0,
      },
      charges: [],
      discounts: [],
      taxes: [],
      payments: [],
      creditApplications: [
        { applied_amount: 10, application_status: 'APPLIED' },
        { applied_amount: 4, application_status: 'PENDING' },
        { applied_amount: 3, application_status: 'FAILED' },
      ],
      refunds: [],
    });

    expect(snapshot.totalCreditAppliedAmount).toBeCloseTo(10);
    expect(snapshot.pendingCreditApplicationAmount).toBeCloseTo(4);
    expect(snapshot.failedCreditApplicationAmount).toBeCloseTo(3);
  });
});
