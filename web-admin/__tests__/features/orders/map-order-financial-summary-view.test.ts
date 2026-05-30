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
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount: 0.14,
      totalAmount: 2.14,
      totalPaidAmount: 1,
      totalCreditAppliedAmount: 0.15,
      totalRefundedAmount: 0,
      outstandingAmount: 0.84,
      payOnCollectionAmount: 0,
      giftCardAppliedAmount: 0.15,
      changeReturnedAmount: 0,
      serviceChargeAmount: 0,
      roundingAmount: 0,
      netReceivableAmount: 1.99,
      financialEngineVersion: 1,
      vatAmount: 0.1,
    } as MapOrderFinancialSummaryInput['snapshot'],
    charges: [],
    discounts: [],
    taxes: [],
    payments: [],
    creditApplications: [],
    refunds: [],
    adjustments: [],
    auditTimeline: [],
    order: {
      gift_card_applied_amount: 0.15,
    },
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

    expect(view.amounts.invoiceAmount).toBeCloseTo(0.99);
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
});
