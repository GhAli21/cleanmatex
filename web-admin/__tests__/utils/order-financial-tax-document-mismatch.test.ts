import { evaluateTaxDocumentTotalMismatch } from '@/lib/utils/order-financial-tax-document-mismatch';

describe('evaluateTaxDocumentTotalMismatch', () => {
  describe('when no tax document is linked', () => {
    it('returns false even if amounts differ wildly', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: null,
          taxDocumentTotalAmount: 999.999,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });

    it('returns false for undefined taxDocumentId', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: undefined,
          taxDocumentTotalAmount: 2.14,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });
  });

  describe('when a tax document is linked but its fiscal total is not stored yet (pre-Phase 7)', () => {
    it('returns false for a fully-paid CREDIT_INVOICE-style order', () => {
      // Regression: previous logic compared AR receivable (0) against total (2.14)
      // and incorrectly fired TAX_DOCUMENT_TOTAL_MISMATCH. With the helper, we
      // do not have a fiscal comparand yet, so we must not warn.
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000001',
          taxDocumentTotalAmount: null,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });

    it('returns false for a partially-paid CREDIT_INVOICE-style order (the P0 bug case)', () => {
      // Order total = 2.14, AR receivable = 1.14 — old comparand would have
      // produced |1.14 - 2.14| = 1.0 > 0.001 → false positive. Helper must not warn.
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000002',
          taxDocumentTotalAmount: null,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });

    it('returns false for a PAY_ON_COLLECTION order that happens to have a tax doc linked', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000003',
          taxDocumentTotalAmount: undefined,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });
  });

  describe('when a tax document is linked and its fiscal total is known (Phase 7 onwards)', () => {
    it('returns false when fiscal total equals order sale total', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000004',
          taxDocumentTotalAmount: 2.14,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });

    it('returns false when the drift is within tolerance (0.001 default)', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000005',
          taxDocumentTotalAmount: 2.1405,
          orderTotalAmount: 2.14,
        }),
      ).toBe(false);
    });

    it('returns true when fiscal total drifts beyond tolerance', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000006',
          taxDocumentTotalAmount: 2.5,
          orderTotalAmount: 2.14,
        }),
      ).toBe(true);
    });

    it('respects a custom tolerance', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000007',
          taxDocumentTotalAmount: 2.15,
          orderTotalAmount: 2.14,
          tolerance: 0.05,
        }),
      ).toBe(false);

      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000008',
          taxDocumentTotalAmount: 2.15,
          orderTotalAmount: 2.14,
          tolerance: 0.001,
        }),
      ).toBe(true);
    });

    it('treats sale total greater than fiscal total as a mismatch (drift in either direction)', () => {
      expect(
        evaluateTaxDocumentTotalMismatch({
          taxDocumentId: '00000000-0000-0000-0000-000000000009',
          taxDocumentTotalAmount: 1.0,
          orderTotalAmount: 2.14,
        }),
      ).toBe(true);
    });
  });
});
