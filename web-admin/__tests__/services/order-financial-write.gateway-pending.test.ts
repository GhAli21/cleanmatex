/**
 * Tests: order-financial-write `buildWarningCodes` — gateway/pending exclusion (doc-19 rule 19/20).
 *
 * A gateway payment leg is persisted with payment_status PENDING (not COMPLETED) and is
 * therefore summed into `pendingPaymentAmount`, NOT `totalPaidAmount`. The recalc must
 * SURFACE that a pending (or authorized-but-not-captured) amount exists so it is never
 * silently treated as settled. This pins the exported decision point: pending/authorized
 * amounts raise their warning codes, and a fully-COMPLETED order raises neither.
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

describe('buildWarningCodes — gateway / pending exclusion', () => {
  it('raises PENDING_PAYMENT_COUNTED_AS_PAID when a pending (gateway) amount exists', () => {
    const codes = buildWarningCodes({ ...cleanInput(), pendingPaymentAmount: 30 });
    expect(codes).toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
  });

  it('raises AUTHORIZED_PAYMENT_COUNTED_AS_PAID when an authorized-not-captured amount exists', () => {
    const codes = buildWarningCodes({ ...cleanInput(), authorizedPaymentAmount: 30 });
    expect(codes).toContain(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
  });

  it('raises neither warning for a fully COMPLETED order (no pending/authorized legs)', () => {
    const codes = buildWarningCodes(cleanInput());
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
    expect(codes).not.toContain(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
  });

  it('surfaces a mixed cash(settled)+gateway(pending) order via the pending warning', () => {
    // Cash leg settled (outstanding closed by paid+credit elsewhere), gateway leg still pending.
    const codes = buildWarningCodes({
      ...cleanInput(),
      orderOutstandingAmount: 30,
      recomputedOutstandingAmount: 30,
      pendingPaymentAmount: 30,
    });
    expect(codes).toContain(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
  });
});
