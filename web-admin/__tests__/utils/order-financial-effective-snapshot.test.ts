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
        totalTaxAmount: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 0,
        outstandingAmount: 0,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 0,
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
        totalTaxAmount: 0.2625,
        totalAmount: 5.5125,
        totalPaidAmount: 2,
        pendingPaymentAmount: 0,
        authorizedPaymentAmount: 0,
        failedPaymentAmount: 0,
        totalCreditAppliedAmount: 0,
        refundedAmount: 0,
        realPaymentRefundedAmount: 0,
        storedValueRestoredAmount: 0,
        customerCreditIssuedAmount: 0,
        netCollectedAmount: 2,
        outstandingAmount: 3.5125,
        overpaidAmount: 0,
        payOnCollectionAmount: 0,
        arReceivableAmount: 3.5125,
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
});
