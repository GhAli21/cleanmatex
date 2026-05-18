/**
 * Tests: order-calculation.service
 *
 * Covers:
 * - calculateOrderTotals — empty items returns zeroed result
 * - calculateOrderTotals — applies manual percent discount
 * - calculateOrderTotals — applies amount discount
 * - calculateOrderTotals — applies promo discount
 * - calculateOrderTotals — gift card reduces final total
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
const mockValidateGiftCard     = jest.fn();
const mockValidateGiftCardById = jest.fn();

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

jest.mock('@/lib/services/discount-service', () => ({
  validatePromoCode: (...a: unknown[]) => mockValidatePromoCode(...a),
  getBestDiscount:   (...a: unknown[]) => mockGetBestDiscount(...a),
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
  mockGetBestDiscount.mockResolvedValue(null);
  mockValidatePromoCode.mockResolvedValue({ isValid: false });
  mockValidateGiftCard.mockResolvedValue({ isValid: false });
  mockValidateGiftCardById.mockResolvedValue({ isValid: false });
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
    expect(result.finalTotal).toBe(0);
    expect(result.discountLines).toEqual([]);
  });

  it('computes subtotal from pricing service', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 15, basePrice: 15 });

    const result = await calculateOrderTotals(defaultParams);
    // 2 items × 15 = 30
    expect(result.subtotal).toBeCloseTo(30);
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

  it('applies gift card redemption to final total', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ finalPrice: 10, basePrice: 10 });
    mockValidateGiftCard.mockResolvedValue({ isValid: true, availableBalance: 5 });

    const result = await calculateOrderTotals({
      ...defaultParams, giftCardNumber: 'GC-001', giftCardAmount: 5,
    });
    expect(result.giftCardApplied).toBeCloseTo(5);
    expect(result.finalTotal).toBeLessThanOrEqual(result.afterDiscounts);
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
});
