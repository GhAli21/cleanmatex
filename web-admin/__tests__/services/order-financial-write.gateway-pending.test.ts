/**
 * Tests: order-financial-write `buildWarningCodes` — gateway/pending semantics.
 *
 * A gateway payment leg is persisted with payment_status PENDING (not COMPLETED)
 * and is therefore summed into `pendingPaymentAmount`, NOT `totalPaidAmount`.
 *
 * B33 (M9, D005/D009) narrowed the original doc-19 rule 19/20 pin: a by-design
 * pending/authorized amount is SURFACED as a reported bucket (visible on the
 * snapshot and Financial tab) but is NOT a warning — `*_COUNTED_AS_PAID` fires
 * only when the stored header paid total exceeds the completed-only
 * recomputation while such non-completed legs exist (a genuine leak of a
 * non-completed amount into `total_paid_amount`). This keeps healthy
 * check/bank/gateway orders CURRENT instead of permanently MISMATCH.
 */

import { buildWarningCodes } from '@/lib/services/order-financial-write.service';
import { ORDER_FINANCIAL_WARNING_CODES } from '@/lib/constants/order-financial';

/** A clean, fully-reconciled input (no mismatches) that individual tests perturb. */
function cleanInput(): Parameters<typeof buildWarningCodes>[0] {
  return {
    usedHeaderTotalFallback: false,
    orderTotalAmount: 100,
    recomputedTotalAmount: 100,
    orderDiscountAmount: 0,
    recomputedDiscountAmount: 0,
    orderTaxAmount: 0,
    recomputedTaxAmount: 0,
    orderOutstandingAmount: 0,
    recomputedOutstandingAmount: 0,
    orderPaidAmount: 70,
    recomputedPaidAmount: 70,
    pendingPaymentAmount: 0,
    authorizedPaymentAmount: 0,
    giftCardAppliedAmount: 0,
    totalCreditAppliedAmount: 0,
    hasCreditApplicationDiscountRows: false,
    arInvoiceOutstandingAmount: null,
    arReceivableAmount: 0,
    hasTaxDocumentAmountMismatch: false,
    hasUnclassifiedRefundSource: false,
    hasAmbiguousHistoricalPaymentRow: false,
  };
}

describe('buildWarningCodes — gateway / pending semantics (B33)', () => {
  it('a by-design pending (gateway) amount is a reported bucket, not a warning', () => {
    const codes = buildWarningCodes({
      ...cleanInput(),
      orderOutstandingAmount: 30,
      recomputedOutstandingAmount: 30,
      pendingPaymentAmount: 30,
    });
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
    expect(codes).toHaveLength(0); // healthy gateway order stays CURRENT
  });

  it('a by-design authorized-not-captured amount is a reported bucket, not a warning', () => {
    const codes = buildWarningCodes({
      ...cleanInput(),
      orderOutstandingAmount: 30,
      recomputedOutstandingAmount: 30,
      authorizedPaymentAmount: 30,
    });
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
    expect(codes).toHaveLength(0);
  });

  it('fires PENDING_PAYMENT_COUNTED_AS_PAID when the pending gateway leg leaked into the stored paid total', () => {
    const codes = buildWarningCodes({
      ...cleanInput(),
      pendingPaymentAmount: 30,
      orderPaidAmount: 100, // header claims the pending 30 as paid
      recomputedPaidAmount: 70,
    });
    expect(codes).toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
  });

  it('fires AUTHORIZED_PAYMENT_COUNTED_AS_PAID when an authorized amount leaked into the stored paid total', () => {
    const codes = buildWarningCodes({
      ...cleanInput(),
      authorizedPaymentAmount: 30,
      orderPaidAmount: 100,
      recomputedPaidAmount: 70,
    });
    expect(codes).toContain(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
  });

  it('raises neither warning for a fully COMPLETED order (no pending/authorized legs)', () => {
    const codes = buildWarningCodes(cleanInput());
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
  });
});
