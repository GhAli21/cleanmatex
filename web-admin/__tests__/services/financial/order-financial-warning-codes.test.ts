import { buildWarningCodes } from '../../../lib/services/order-financial-write.service';
import { ORDER_FINANCIAL_WARNING_CODES } from '../../../lib/constants/order-financial';

type BuildWarningCodesInput = Parameters<typeof buildWarningCodes>[0];

function makeInput(overrides: Partial<BuildWarningCodesInput> = {}): BuildWarningCodesInput {
  return {
    usedHeaderTotalFallback: false,
    orderTotalAmount: 100,
    recomputedTotalAmount: 100,
    orderDiscountAmount: 0,
    recomputedDiscountAmount: 0,
    orderTaxAmount: 10,
    recomputedTaxAmount: 10,
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
    ...overrides,
  };
}

const C = ORDER_FINANCIAL_WARNING_CODES;

describe('buildWarningCodes', () => {
  describe('ORDER_TOTAL_COMPONENT_MISMATCH', () => {
    it('is silent when order total matches recomputed total', () => {
      const result = buildWarningCodes(makeInput({ orderTotalAmount: 100, recomputedTotalAmount: 100 }));
      expect(result).not.toContain(C.ORDER_TOTAL_COMPONENT_MISMATCH);
    });
    it('fires when order total differs from recomputed total beyond tolerance', () => {
      const result = buildWarningCodes(makeInput({ orderTotalAmount: 100, recomputedTotalAmount: 101 }));
      expect(result).toContain(C.ORDER_TOTAL_COMPONENT_MISMATCH);
    });
  });

  describe('DISCOUNT_TOTAL_MISMATCH', () => {
    it('is silent when discount amounts match', () => {
      const result = buildWarningCodes(makeInput({ orderDiscountAmount: 10, recomputedDiscountAmount: 10 }));
      expect(result).not.toContain(C.DISCOUNT_TOTAL_MISMATCH);
    });
    it('fires when discount amounts differ beyond tolerance', () => {
      const result = buildWarningCodes(makeInput({ orderDiscountAmount: 10, recomputedDiscountAmount: 15 }));
      expect(result).toContain(C.DISCOUNT_TOTAL_MISMATCH);
    });
  });

  describe('TAX_TOTAL_MISMATCH', () => {
    it('is silent when tax amounts match', () => {
      const result = buildWarningCodes(makeInput({ orderTaxAmount: 10, recomputedTaxAmount: 10 }));
      expect(result).not.toContain(C.TAX_TOTAL_MISMATCH);
    });
    it('fires when tax amounts differ beyond tolerance', () => {
      const result = buildWarningCodes(makeInput({ orderTaxAmount: 10, recomputedTaxAmount: 12 }));
      expect(result).toContain(C.TAX_TOTAL_MISMATCH);
    });
  });

  describe('OUTSTANDING_MISMATCH', () => {
    it('is silent when outstanding amounts match', () => {
      const result = buildWarningCodes(makeInput({ orderOutstandingAmount: 5, recomputedOutstandingAmount: 5 }));
      expect(result).not.toContain(C.OUTSTANDING_MISMATCH);
    });
    it('fires when outstanding amounts differ beyond tolerance', () => {
      const result = buildWarningCodes(makeInput({ orderOutstandingAmount: 5, recomputedOutstandingAmount: 10 }));
      expect(result).toContain(C.OUTSTANDING_MISMATCH);
    });
  });

  describe('PENDING_PAYMENT_COUNTED_AS_PAID', () => {
    it('is silent when no pending payments exist', () => {
      const result = buildWarningCodes(makeInput({ pendingPaymentAmount: 0 }));
      expect(result).not.toContain(C.PENDING_PAYMENT_COUNTED_AS_PAID);
    });
    it('fires when a pending payment is counted toward the paid total', () => {
      const result = buildWarningCodes(makeInput({ pendingPaymentAmount: 50 }));
      expect(result).toContain(C.PENDING_PAYMENT_COUNTED_AS_PAID);
    });
  });

  describe('AUTHORIZED_PAYMENT_COUNTED_AS_PAID', () => {
    it('is silent when no authorized payments exist', () => {
      const result = buildWarningCodes(makeInput({ authorizedPaymentAmount: 0 }));
      expect(result).not.toContain(C.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
    });
    it('fires when an authorized-only payment is counted toward the paid total', () => {
      const result = buildWarningCodes(makeInput({ authorizedPaymentAmount: 25 }));
      expect(result).toContain(C.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
    });
  });

  describe('GIFT_CARD_DOUBLE_COUNTED', () => {
    it('is silent when gift card amount is fully covered by credit applications', () => {
      const result = buildWarningCodes(makeInput({
        giftCardAppliedAmount: 100,
        totalCreditAppliedAmount: 100,
      }));
      expect(result).not.toContain(C.GIFT_CARD_DOUBLE_COUNTED);
    });
    it('fires when gift card amount exceeds total credit applied (potential double-count)', () => {
      const result = buildWarningCodes(makeInput({
        giftCardAppliedAmount: 100,
        totalCreditAppliedAmount: 50,
      }));
      expect(result).toContain(C.GIFT_CARD_DOUBLE_COUNTED);
    });
  });

  describe('CREDIT_APPLICATION_COUNTED_AS_DISCOUNT', () => {
    it('is silent when no credit application discount rows exist', () => {
      const result = buildWarningCodes(makeInput({ hasCreditApplicationDiscountRows: false }));
      expect(result).not.toContain(C.CREDIT_APPLICATION_COUNTED_AS_DISCOUNT);
    });
    it('fires when a credit application appears in the discount row (misclassification)', () => {
      const result = buildWarningCodes(makeInput({ hasCreditApplicationDiscountRows: true }));
      expect(result).toContain(C.CREDIT_APPLICATION_COUNTED_AS_DISCOUNT);
    });
  });

  describe('AR_RECEIVABLE_MISMATCH', () => {
    it('is silent when arInvoiceOutstandingAmount is null (no AR invoice)', () => {
      const result = buildWarningCodes(makeInput({ arInvoiceOutstandingAmount: null, arReceivableAmount: 50 }));
      expect(result).not.toContain(C.AR_RECEIVABLE_MISMATCH);
    });
    it('fires when AR invoice outstanding differs from AR receivable beyond tolerance', () => {
      const result = buildWarningCodes(makeInput({ arInvoiceOutstandingAmount: 100, arReceivableAmount: 50 }));
      expect(result).toContain(C.AR_RECEIVABLE_MISMATCH);
    });
  });

  describe('TAX_DOCUMENT_TOTAL_MISMATCH', () => {
    it('is silent when tax document totals are consistent', () => {
      const result = buildWarningCodes(makeInput({ hasTaxDocumentAmountMismatch: false }));
      expect(result).not.toContain(C.TAX_DOCUMENT_TOTAL_MISMATCH);
    });
    it('fires when the tax document total does not match the fiscal sale total', () => {
      const result = buildWarningCodes(makeInput({ hasTaxDocumentAmountMismatch: true }));
      expect(result).toContain(C.TAX_DOCUMENT_TOTAL_MISMATCH);
    });
  });

  describe('LEGACY_FIELD_USED_IN_SUMMARY', () => {
    it('is silent when canonical fields are used for the financial summary', () => {
      const result = buildWarningCodes(makeInput({ usedHeaderTotalFallback: false }));
      expect(result).not.toContain(C.LEGACY_FIELD_USED_IN_SUMMARY);
    });
    it('fires when a legacy header total fallback was used in the calculation', () => {
      const result = buildWarningCodes(makeInput({ usedHeaderTotalFallback: true }));
      expect(result).toContain(C.LEGACY_FIELD_USED_IN_SUMMARY);
    });
  });

  describe('REFUND_SOURCE_UNCLASSIFIED', () => {
    it('is silent when all refund sources are classified', () => {
      const result = buildWarningCodes(makeInput({ hasUnclassifiedRefundSource: false }));
      expect(result).not.toContain(C.REFUND_SOURCE_UNCLASSIFIED);
    });
    it('fires when a refund row has no classifiable source', () => {
      const result = buildWarningCodes(makeInput({ hasUnclassifiedRefundSource: true }));
      expect(result).toContain(C.REFUND_SOURCE_UNCLASSIFIED);
    });
  });

  describe('PAYMENT_TARGET_UNCLASSIFIED', () => {
    it('is silent when all payment rows have a recognized target', () => {
      const result = buildWarningCodes(makeInput({ hasAmbiguousHistoricalPaymentRow: false }));
      expect(result).not.toContain(C.PAYMENT_TARGET_UNCLASSIFIED);
    });
    it('fires when a historical payment row cannot be mapped to a canonical target', () => {
      const result = buildWarningCodes(makeInput({ hasAmbiguousHistoricalPaymentRow: true }));
      expect(result).toContain(C.PAYMENT_TARGET_UNCLASSIFIED);
    });
  });

  describe('tolerance boundary', () => {
    it('does not fire ORDER_TOTAL_COMPONENT_MISMATCH when difference is below tolerance (0.0009)', () => {
      const result = buildWarningCodes(makeInput({ orderTotalAmount: 100, recomputedTotalAmount: 100.0009 }));
      expect(result).not.toContain(C.ORDER_TOTAL_COMPONENT_MISMATCH);
    });
    it('fires ORDER_TOTAL_COMPONENT_MISMATCH when difference just exceeds tolerance (0.0011)', () => {
      const result = buildWarningCodes(makeInput({ orderTotalAmount: 100, recomputedTotalAmount: 100.0011 }));
      expect(result).toContain(C.ORDER_TOTAL_COMPONENT_MISMATCH);
    });
  });

  describe('clean baseline', () => {
    it('returns empty array when all inputs represent a consistent financial state', () => {
      const result = buildWarningCodes(makeInput());
      expect(result).toHaveLength(0);
    });
  });
});
