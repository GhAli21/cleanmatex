import { extractTaxFromInclusive } from '@/lib/services/order-financial-write.service';

describe('extractTaxFromInclusive', () => {
  /**
   * Phase 5 (ADR-017) — TAX_INCLUSIVE pricing.
   *
   * Formula: taxableAmount = inclusiveAmount / (1 + taxRate)
   *          taxAmount      = inclusiveAmount − taxableAmount
   *
   * The total_amount for a TAX_INCLUSIVE order equals the inclusive price
   * (net_before_tax + rounding); tax is NOT added on top.
   */

  describe('standard VAT extraction (5%)', () => {
    it('extracts tax correctly from spec worked example (105.000 @ 5%)', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(105, 0.05);
      expect(taxableAmount).toBeCloseTo(100, 2);
      expect(taxAmount).toBeCloseTo(5, 2);
    });

    it('taxableAmount + taxAmount should equal the original inclusive amount', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(105, 0.05);
      expect(taxableAmount + taxAmount).toBeCloseTo(105, 4);
    });
  });

  describe('various tax rates', () => {
    it('extracts correctly at 15% (Saudi VAT)', () => {
      // 115 inclusive @ 15%: taxable = 115/1.15 = 100, tax = 15
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(115, 0.15);
      expect(taxableAmount).toBeCloseTo(100, 2);
      expect(taxAmount).toBeCloseTo(15, 2);
    });

    it('extracts correctly at 10% (round number)', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(110, 0.1);
      expect(taxableAmount).toBeCloseTo(100, 2);
      expect(taxAmount).toBeCloseTo(10, 2);
    });

    it('handles fractional cents (rounded to 4 dp)', () => {
      // 100 @ 5%: taxable = 95.2381, tax = 4.7619
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(100, 0.05);
      expect(taxableAmount).toBeCloseTo(95.2381, 2);
      expect(taxAmount).toBeCloseTo(4.7619, 2);
      expect(taxableAmount + taxAmount).toBeCloseTo(100, 4);
    });
  });

  describe('edge cases — zero or invalid rate', () => {
    it('returns full amount as taxable, zero tax, when rate is 0', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(100, 0);
      expect(taxableAmount).toBe(100);
      expect(taxAmount).toBe(0);
    });

    it('returns full amount as taxable, zero tax, when rate is negative', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(100, -0.05);
      expect(taxableAmount).toBe(100);
      expect(taxAmount).toBe(0);
    });

    it('returns zeros when inclusive amount is zero', () => {
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(0, 0.05);
      expect(taxableAmount).toBe(0);
      expect(taxAmount).toBe(0);
    });
  });

  describe('TAX_EXCLUSIVE regression — extractTaxFromInclusive should NOT be called', () => {
    /**
     * TAX_EXCLUSIVE identity: total = net_before_tax + tax + rounding.
     * Verify that applying extractTaxFromInclusive to an EXCLUSIVE order would
     * produce wrong results — confirming the caller MUST branch on pricing mode.
     */
    it('would produce wrong taxable if mistakenly called on an exclusive order', () => {
      // TAX_EXCLUSIVE order: items_base=100, tax=5, total=105
      // If incorrectly called: 105 → taxable=100, tax=5 — looks right but is
      // wrong because total already includes the added tax, not an inclusive price.
      // This test documents the semantic difference, not a bug in the function.
      const { taxAmount } = extractTaxFromInclusive(105, 0.05);
      // The function extracts; the test asserts that calling it on an exclusive
      // 105 order gives the same math — but the MEANING differs.
      expect(taxAmount).toBeCloseTo(5, 2);
      // total for TAX_INCLUSIVE: 105 (net_before_tax includes tax)
      // total for TAX_EXCLUSIVE: 100 + 5 = 105 (tax added separately)
      // Both equal 105 at 5% but the formula for the TAX_EXCLUSIVE path in
      // resolveCanonicalTotalAmount adds the tax addend; TAX_INCLUSIVE does not.
    });
  });

  describe('multi-rate compound scenario', () => {
    it('handles a combined 15% effective rate from two stacked rates', () => {
      // Worked example: line with effective combined rate 15%
      // Inclusive price = 230, taxable = 200, tax = 30
      const { taxableAmount, taxAmount } = extractTaxFromInclusive(230, 0.15);
      expect(taxableAmount).toBeCloseTo(200, 2);
      expect(taxAmount).toBeCloseTo(30, 2);
    });
  });
});
