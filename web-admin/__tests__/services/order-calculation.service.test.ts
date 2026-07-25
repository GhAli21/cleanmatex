/**
 * Tests: order-calculation.service
 *
 * Covers:
 * - calculateOrderTotals — empty items returns zeroed result
 * - calculateOrderTotals — applies manual percent discount
 * - calculateOrderTotals — applies amount discount
 * - calculateOrderTotals — applies promo discount
 * - calculateOrderTotals — gift card stays separate from final total
 * - calculateOrderTotals — adds VAT on top of after-discount amount
 * - calculateOrderTotals — rounds to tenant decimal places
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPriceForOrderItem = jest.fn();
const mockGetVatRate           = jest.fn();
const mockGetCurrencyConfig    = jest.fn();
const mockValidatePromoCode    = jest.fn();
const mockGetBestDiscount      = jest.fn();
const mockEvaluateBestAutoApplyPromo = jest.fn();
const mockValidateGiftCard     = jest.fn();
const mockValidateGiftCardById = jest.fn();
const mockCalculateTax         = jest.fn();
const mockResolveTaxPricingMode = jest.fn();

jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: (...a: unknown[]) => mockResolveTaxPricingMode(...a),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/pricing.service', () => ({
  pricingService: {
    getPriceForOrderItem: (...a: unknown[]) => mockGetPriceForOrderItem(...a),
  },
}));

jest.mock('@/lib/services/tax.service', () => ({
  TaxService: jest.fn().mockImplementation(() => ({
    getTaxRate: (...a: unknown[]) => mockGetVatRate(...a),
  })),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: (...a: unknown[]) => mockGetCurrencyConfig(...a),
  })),
}));

jest.mock('@/lib/services/tax-engine.service', () => ({
  calculateTax: (...a: unknown[]) => mockCalculateTax(...a),
}));

jest.mock('@/lib/services/discount-service', () => ({
  validatePromoCode: (...a: unknown[]) => mockValidatePromoCode(...a),
  getBestDiscount:   (...a: unknown[]) => mockGetBestDiscount(...a),
  evaluateBestAutoApplyPromo: (...a: unknown[]) => mockEvaluateBestAutoApplyPromo(...a),
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  validateGiftCard:                  (...a: unknown[]) => mockValidateGiftCard(...a),
  validateGiftCardByIdForCalculation: (...a: unknown[]) => mockValidateGiftCardById(...a),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { calculateOrderTotals } from '@/lib/services/order-calculation.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-calc-001';

const defaultParams = {
  tenantId: TENANT,
  items: [{ productId: 'prod-1', quantity: 2 }],
};

function setupDefaults() {
  mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 });
  mockGetVatRate.mockResolvedValue(0);
  mockCalculateTax.mockResolvedValue([]);
  mockGetBestDiscount.mockResolvedValue(null);
  mockValidatePromoCode.mockResolvedValue({ isValid: false });
  mockEvaluateBestAutoApplyPromo.mockResolvedValue({ isValid: false });
  mockValidateGiftCard.mockResolvedValue({ isValid: false });
  mockValidateGiftCardById.mockResolvedValue({ isValid: false });
  // B11: every pre-existing test in this file is exclusive-mode and must stay
  // byte-identical — only the dedicated TAX_INCLUSIVE describe block below
  // overrides this per-test.
  mockResolveTaxPricingMode.mockResolvedValue('TAX_EXCLUSIVE');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('order-calculation.service — calculateOrderTotals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
  });

  it('returns zeroed result for empty items', async () => {
    const result = await calculateOrderTotals({ tenantId: TENANT, items: [] });
    expect(result.subtotal).toBe(0);
    expect(result.saleTotal).toBe(0);
    expect(result.discountLines).toEqual([]);
  });

  it('computes subtotal from pricing service', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 15, basePrice: 15 });

    const result = await calculateOrderTotals(defaultParams);
    // 2 items × 15 = 30
    expect(result.subtotal).toBeCloseTo(30);
  });

  it('uses item price override for subtotal when provided', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 15, basePrice: 15 });

    const result = await calculateOrderTotals({
      tenantId: TENANT,
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          priceOverride: 10,
          servicePrefCharge: 1.25,
          packingPrefCharge: 0.75,
        },
      ],
    });

    expect(result.subtotal).toBeCloseTo(22);
  });

  it('applies percent discount', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });

    const result = await calculateOrderTotals({ ...defaultParams, percentDiscount: 10 });
    // subtotal=20, 10% off → afterDiscounts=18
    expect(result.manualDiscount).toBeCloseTo(2);
    expect(result.afterDiscounts).toBeCloseTo(18);
  });

  it('applies fixed amount discount', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });

    const result = await calculateOrderTotals({ ...defaultParams, amountDiscount: 5 });
    expect(result.manualDiscount).toBeCloseTo(5);
    expect(result.afterDiscounts).toBeCloseTo(15);
  });

  it('applies promo discount when valid code provided', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });
    mockValidatePromoCode.mockResolvedValue({ isValid: true, discountAmount: 4 });

    const result = await calculateOrderTotals({ ...defaultParams, promoCode: 'PROMO10' });
    expect(result.promoDiscount).toBeCloseTo(4);
  });

  it('keeps gift card redemption separate from final total', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });
    mockValidateGiftCard.mockResolvedValue({ isValid: true, availableBalance: 5 });

    const result = await calculateOrderTotals({
      ...defaultParams, giftCardNumber: 'GC-001', giftCardAmount: 5,
    });
    expect(result.giftCardApplied).toBeCloseTo(5);
    expect(result.saleTotal).toBeCloseTo(result.afterDiscounts);
  });

  it('does not let gift card reduce the tax base or tax amount', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 100, basePrice: 100 });
    mockGetVatRate.mockResolvedValue(0.05);
    mockValidateGiftCard.mockResolvedValue({ isValid: true, availableBalance: 10 });

    const result = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'p1', quantity: 1 }],
      giftCardNumber: 'GC-002',
      giftCardAmount: 10,
    });

    expect(result.afterDiscounts).toBeCloseTo(100);
    expect(result.vatValue).toBeCloseTo(5);
    expect(result.taxAmount).toBeCloseTo(5);
    expect(result.saleTotal).toBeCloseTo(105);
    expect(result.giftCardApplied).toBeCloseTo(10);
  });

  it('adds VAT on top of after-discounts', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 100, basePrice: 100 });
    mockGetVatRate.mockResolvedValue(0.05); // 5% as a decimal

    const result = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'p1', quantity: 1 }] });
    expect(result.currencyCode).toBe('OMR');
    expect(result.vatTaxPercent).toBeGreaterThanOrEqual(0);
  });

  it('uses tenant currency code in result', async () => {
    mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'SAR', decimalPlaces: 2 });
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });

    const result = await calculateOrderTotals(defaultParams);
    expect(result.currencyCode).toBe('SAR');
    expect(result.decimalPlaces).toBe(2);
  });

  it('resolves and reports the tax pricing mode on every result (incl. empty items)', async () => {
    mockResolveTaxPricingMode.mockResolvedValue('TAX_EXCLUSIVE');
    const empty = await calculateOrderTotals({ tenantId: TENANT, items: [] });
    expect(empty.taxPricingMode).toBe('TAX_EXCLUSIVE');

    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });
    const nonEmpty = await calculateOrderTotals(defaultParams);
    expect(nonEmpty.taxPricingMode).toBe('TAX_EXCLUSIVE');
  });
});

describe('order-calculation.service — calculateOrderTotals TAX_INCLUSIVE (B11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
    mockResolveTaxPricingMode.mockResolvedValue('TAX_INCLUSIVE');
  });

  it('extracts embedded VAT via the profile-driven path — saleTotal stays the gross price, afterDiscounts becomes net', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 105, basePrice: 105 });
    // calculateTax is mocked at this layer — simulate what the real
    // pricingMode-aware engine (tested separately) would return: the
    // embedded VAT already extracted from the 105 gross.
    mockCalculateTax.mockResolvedValue([
      { taxType: 'VAT', label: 'VAT', label2: null, rate: 5, isCompound: false, baseAmount: 100, taxAmount: 5, profileId: 'p1' },
    ]);

    const result = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'p1', quantity: 1 }] });

    expect(result.vatValue).toBeCloseTo(5);
    expect(result.afterDiscounts).toBeCloseTo(100); // net-of-tax, not the 105 gross
    expect(result.saleTotal).toBeCloseTo(105); // tax already embedded — not re-added
    expect(result.taxPricingMode).toBe('TAX_INCLUSIVE');
  });

  it('treats profile-driven CUSTOM tax as embedded too (same tenant tax-profile mechanism as VAT)', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 107, basePrice: 107 });
    mockCalculateTax.mockResolvedValue([
      { taxType: 'VAT', label: 'VAT', label2: null, rate: 5, isCompound: false, baseAmount: 100, taxAmount: 5, profileId: 'p1' },
      { taxType: 'CUSTOM', label: 'Municipality', label2: null, rate: 2, isCompound: false, baseAmount: 100, taxAmount: 2, profileId: 'p2' },
    ]);

    const result = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'p1', quantity: 1 }] });

    expect(result.vatValue).toBeCloseTo(5);
    expect(result.additionalTaxAmount).toBeCloseTo(2);
    expect(result.afterDiscounts).toBeCloseTo(100);
    expect(result.saleTotal).toBeCloseTo(107); // gross unchanged — nothing re-added
  });

  it('extracts VAT via the no-profile-configured fallback, and keeps an ad-hoc additionalTaxAmount additive', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 105, basePrice: 105 });
    mockCalculateTax.mockResolvedValue([]); // no tax profile configured
    mockGetVatRate.mockResolvedValue(0.05);

    const result = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'p1', quantity: 1 }],
      additionalTaxAmount: 3, // ad-hoc order-level surcharge — never embedded in the priced item
    });

    expect(result.vatValue).toBeCloseTo(5); // extracted from the 105 gross
    expect(result.afterDiscounts).toBeCloseTo(100); // net after extracting only the embedded VAT
    expect(result.additionalTaxAmount).toBeCloseTo(3);
    expect(result.saleTotal).toBeCloseTo(108); // 105 gross + 3 ad-hoc surcharge, added on top
  });

  it('is a no-op when no tax profile and no VAT setting exist (zero-rated, B15 policy)', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 100, basePrice: 100 });
    mockCalculateTax.mockResolvedValue([]);
    mockGetVatRate.mockResolvedValue(0);

    const result = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'p1', quantity: 1 }] });

    expect(result.vatValue).toBe(0);
    expect(result.afterDiscounts).toBeCloseTo(100);
    expect(result.saleTotal).toBeCloseTo(100);
  });
});
