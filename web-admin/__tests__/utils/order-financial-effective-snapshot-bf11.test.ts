/**
 * Reusable Order Fin View Phase 1 — BF-11 / BF-01 regressions for the read
 * fallback. A snapshot the engine wrote is the authority, zeros included.
 */
import {
  buildEffectiveOrderFinancialSnapshot,
  type EffectiveOrderFinancialSnapshotInput,
} from '@/lib/utils/order-financial-effective-snapshot';

const ZERO_SNAPSHOT: EffectiveOrderFinancialSnapshotInput['snapshot'] = {
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
  currencyExRate: 1,
  baseCurCurrencyCode: null,
  baseCurTotalAmount: 0,
  baseCurTaxAmount: 0,
  baseCurPaidAmount: 0,
  baseCurCreditAppliedAmount: 0,
  baseCurOutstandingAmount: 0,
  baseCurArReceivableAmount: 0,
};

function input(
  overrides: Partial<EffectiveOrderFinancialSnapshotInput>,
): EffectiveOrderFinancialSnapshotInput {
  return {
    paymentTypeCode: 'PAY_IN_ADVANCE',
    roundingAmount: 0,
    snapshotWritten: true,
    snapshot: ZERO_SNAPSHOT,
    charges: [],
    discounts: [],
    taxes: [],
    payments: [],
    creditApplications: [],
    refunds: [],
    ...overrides,
  };
}

const paidCash = (amount: number) => ({
  amount,
  payment_status: 'completed',
  payment_nature_snapshot: 'REAL_PAYMENT',
  payment_method_code: 'CASH',
  gateway_code: null,
  gateway_reference: null,
  branch_payment_method_id: null,
});

describe('buildEffectiveOrderFinancialSnapshot — BF-11 / BF-01', () => {
  it('BF-11: a written snapshot keeps its zeros (overpaid returned as change, charge voided to 0)', () => {
    const result = buildEffectiveOrderFinancialSnapshot(
      input({
        snapshot: { ...ZERO_SNAPSHOT, totalAmount: 10, totalPaidAmount: 12, netCollectedAmount: 12 },
        changeReturnedAmount: 2,
        charges: [{ charge_type: 'DELIVERY', amount: 1, is_voided: false }],
        payments: [paidCash(12)],
      }),
    );

    expect([
      result.overpaidAmount,
      result.deliveryChargeAmount,
      result.outstandingAmount,
      result.usedReadFallback,
    ]).toEqual([0, 0, 0, false]);
  });

  it('unwritten snapshot: voided charge rows never count (BF-01)', () => {
    const result = buildEffectiveOrderFinancialSnapshot(
      input({
        snapshotWritten: false,
        charges: [
          { charge_type: 'DELIVERY', amount: 1, is_voided: false },
          { charge_type: 'DELIVERY', amount: 5, is_voided: true },
          { charge_type: 'EXPRESS', amount: 3, is_voided: true },
        ],
      }),
    );

    expect([
      result.deliveryChargeAmount,
      result.expressChargeAmount,
      result.totalChargesAmount,
      result.usedReadFallback,
    ]).toEqual([1, 0, 1, true]);
  });

  it('unwritten snapshot: the overpaid fallback subtracts change returned (computeOverpaidAmount)', () => {
    const result = buildEffectiveOrderFinancialSnapshot(
      input({
        snapshotWritten: false,
        snapshot: { ...ZERO_SNAPSHOT, totalAmount: 10 },
        changeReturnedAmount: 2,
        payments: [paidCash(12)],
      }),
    );

    expect(result.overpaidAmount).toBe(0);
  });
});
