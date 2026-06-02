import { mapOrderFinancialSummaryView } from '@/src/features/orders/lib/map-order-financial-summary-view';
import type { MapOrderFinancialSummaryInput } from '@/src/features/orders/model/order-financial-summary-view';

function buildInput(
  overrides: Partial<MapOrderFinancialSummaryInput> = {}
): MapOrderFinancialSummaryInput {
  return {
    snapshot: {
      orderId: 'order-1',
      orderNo: 'ORD-1',
      currencyCode: 'OMR',
      paymentTypeCode: 'CREDIT_INVOICE',
      paymentStatus: 'PARTIALLY_PAID',
      subtotalAmount: 2,
      itemsBaseAmount: 2,
      pieceExtraPriceAmount: 0,
      preferenceExtraPriceAmount: 0,
      serviceChargeAmount: 0,
      deliveryChargeAmount: 0,
      expressChargeAmount: 0,
      otherChargesAmount: 0,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      taxableAmount: 2,
      totalTaxAmount: 0.14,
      totalAmount: 2.14,
      totalPaidAmount: 1,
      pendingPaymentAmount: 0,
      authorizedPaymentAmount: 0,
      failedPaymentAmount: 0,
      totalCreditAppliedAmount: 0.15,
      refundedAmount: 0,
      realPaymentRefundedAmount: 0,
      storedValueRestoredAmount: 0,
      customerCreditIssuedAmount: 0,
      netCollectedAmount: 1,
      outstandingAmount: 0.84,
      overpaidAmount: 0,
      payOnCollectionAmount: 0,
      arReceivableAmount: 0.84,
      arInvoiceId: null,
      arInvoiceNo: null,
      arInvoiceStatus: null,
      taxDocumentId: null,
      taxDocumentNo: null,
      taxDocumentStatus: null,
      taxDocumentType: null,
      financialSnapshotStatus: 'CURRENT',
      financialMismatchWarningCount: 0,
      financialCalculationSnapshot: null,
      financialCalculationHash: null,
      financialCalculationTraceId: null,
      changeReturnedAmount: 0,
      roundingAmount: 0,
      financialEngineVersion: 1,
    } as MapOrderFinancialSummaryInput['snapshot'],
    charges: [],
    discounts: [],
    taxes: [],
    payments: [],
    creditApplications: [],
    refunds: [],
    adjustments: [],
    auditTimeline: [],
    ...overrides,
  };
}

describe('mapOrderFinancialSummaryView', () => {
  it('prefers AR invoice outstanding amount when an invoice exists', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        arInvoice: {
          id: 'ar-1',
          invoiceNo: 'ARI-000016',
          status: 'OVERDUE',
          amount: 0.99,
          outstandingAmount: 0.99,
        },
      })
    );

    expect(view.amounts.arReceivableAmount).toBeCloseTo(0.99);
  });

  it('emits a warning when invoice and order outstanding amounts diverge', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        arInvoice: {
          id: 'ar-1',
          invoiceNo: 'ARI-000016',
          status: 'OVERDUE',
          amount: 0.99,
          outstandingAmount: 0.99,
        },
      })
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AR_RECEIVABLE_MISMATCH',
          messageKey: 'arReceivableMismatch',
        }),
      ])
    );
  });

  it('uses real-payment refunds instead of total credits to compute net collected', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          refundedAmount: 0.5,
          realPaymentRefundedAmount: 0.25,
          netCollectedAmount: 0,
        },
      }),
    );

    expect(view.amounts.netCollectedAmount).toBeCloseTo(0.75);
  });

  it('flags mixed-case pending payments with the canonical warning code', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        payments: [
          {
            id: 'pay-1',
            payment_method_code: 'CARD',
            payment_nature_snapshot: 'REAL_PAYMENT',
            amount: 1,
            payment_status: 'processing',
            received_by: null,
            gateway_code: null,
            gateway_reference: null,
            branch_payment_method_id: null,
            created_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PENDING_PAYMENT_COUNTED_AS_PAID',
        }),
      ]),
    );
  });

  it('flags mixed-case authorized payments with the canonical warning code', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        payments: [
          {
            id: 'pay-2',
            payment_method_code: 'CARD',
            payment_nature_snapshot: 'REAL_PAYMENT',
            amount: 1,
            payment_status: 'authorized',
            received_by: null,
            gateway_code: null,
            gateway_reference: null,
            branch_payment_method_id: null,
            created_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AUTHORIZED_PAYMENT_COUNTED_AS_PAID',
        }),
      ]),
    );
  });

  it('uses canonical snapshot service charge amount instead of legacy header fallback', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          serviceChargeAmount: 0.3,
          totalChargesAmount: 0.3,
        },
        charges: [
          {
            id: 'charge-1',
            charge_type: 'SERVICE_CHARGE',
            label: 'Service',
            label2: null,
            amount: 0.1,
            currency_code: 'OMR',
          },
        ],
      }),
    );

    expect(view.amounts.serviceChargeAmount).toBeCloseTo(0.3);
  });

  it('derives gift-card warning input from canonical credit applications instead of legacy header aliases', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          totalCreditAppliedAmount: 0.15,
        },
        creditApplications: [
          {
            id: 'credit-1',
            credit_type: 'GIFT_CARD',
            credit_source_id: 'gc-1',
            applied_amount: 0.1,
            currency_code: 'OMR',
            reference_no: 'GC-0001',
            applied_by: null,
            applied_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'GIFT_CARD_DOUBLE_COUNTED',
        }),
      ]),
    );
  });
});
