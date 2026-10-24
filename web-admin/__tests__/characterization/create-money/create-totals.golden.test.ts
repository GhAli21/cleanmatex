/**
 * P1-01 (Line-Level Money Snapshot) = P1B-01 (Reusable Order Fin View):
 * characterization of today's Create totals.
 *
 * Pins `calculateOrderTotals` exactly as it behaves on 2026-10-23, with the
 * REAL tax engine (profiles, compounding, inclusive extraction, exemption).
 * Only I/O is mocked. Every expectation is an exact value (`toEqual`), never
 * `toBeCloseTo`, so any change of a figure (including one minor unit from a
 * float -> decimal move) fails here and needs owner sign-off.
 *
 * Fixtures are synthetic (PLAN §21 C13). A case marked `KNOWN DEFECT` pins
 * today's behaviour on purpose; the fix that changes it must update the case
 * and list it in docs/features/Order_Fin/Line_Level_Money_Snapshot/P1_01_CHARACTERIZATION.md.
 */

const mockGetPriceForOrderItem = jest.fn();
const mockGetTaxRate = jest.fn();
const mockGetCurrencyConfig = jest.fn();
const mockValidatePromoCode = jest.fn();
const mockGetBestDiscount = jest.fn();
const mockEvaluateBestAutoApplyPromo = jest.fn();
const mockValidateGiftCard = jest.fn();
const mockValidateGiftCardById = jest.fn();
const mockResolveTaxPricingMode = jest.fn();
const mockResolveCurrencyRoundingRule = jest.fn();
const mockTaxProfileFindMany = jest.fn();
const mockTaxExemptionFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tax_profiles_cf: { findMany: (...a: unknown[]) => mockTaxProfileFindMany(...a) },
    org_tax_exemptions_cf: { findFirst: (...a: unknown[]) => mockTaxExemptionFindFirst(...a) },
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: (...a: unknown[]) => mockResolveTaxPricingMode(...a),
}));
jest.mock('@/lib/money/currency-rounding', () => ({
  resolveCurrencyRoundingRule: (...a: unknown[]) => mockResolveCurrencyRoundingRule(...a),
  roundToIncrement: jest.requireActual('@/lib/money/currency-rounding').roundToIncrement,
}));
jest.mock('@/lib/services/pricing.service', () => ({
  pricingService: {
    getPriceForOrderItem: (...a: unknown[]) => mockGetPriceForOrderItem(...a),
    getBasePricesForOrder: async (params: { tenantId: string; items: { productId: string; quantity: number }[]; isExpress: boolean; customerId?: string }) =>
      Promise.all(params.items.map(async (item) => (await mockGetPriceForOrderItem({
        tenantId: params.tenantId, productId: item.productId, quantity: item.quantity,
        isExpress: params.isExpress, customerId: params.customerId,
      })).basePrice)),
  },
}));
jest.mock('@/lib/services/tax.service', () => ({
  TaxService: jest.fn().mockImplementation(() => ({ getTaxRate: (...a: unknown[]) => mockGetTaxRate(...a) })),
}));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: (...a: unknown[]) => mockGetCurrencyConfig(...a),
  })),
}));
jest.mock('@/lib/services/discount-service', () => ({
  validatePromoCode: (...a: unknown[]) => mockValidatePromoCode(...a),
  getBestDiscount: (...a: unknown[]) => mockGetBestDiscount(...a),
  evaluateBestAutoApplyPromo: (...a: unknown[]) => mockEvaluateBestAutoApplyPromo(...a),
}));
jest.mock('@/lib/services/gift-card-service', () => ({
  validateGiftCard: (...a: unknown[]) => mockValidateGiftCard(...a),
  validateGiftCardByIdForCalculation: (...a: unknown[]) => mockValidateGiftCardById(...a),
}));

import { calculateOrderTotals, type OrderCalculationResult } from '@/lib/services/order-calculation.service';

const TENANT = 'tenant-golden-001';

/** Synthetic tax profile row as `org_tax_profiles_cf` returns it. */
function profile(id: string, taxType: 'VAT' | 'CUSTOM', rate: number, isCompound = false) {
  return { id, name: `${taxType} ${rate}%`, name2: null, tax_type: taxType, rate, is_compound: isCompound };
}

/** Prices keyed by product id; `basePrice` is what Create charges (see pricing golden). */
function priceBook(prices: Record<string, number>) {
  mockGetPriceForOrderItem.mockImplementation(async ({ productId }: { productId: string }) => ({
    basePrice: prices[productId],
    finalPrice: prices[productId],
  }));
}

/** The money figures a characterization case pins. */
function money(r: OrderCalculationResult) {
  return {
    subtotal: r.subtotal,
    manualDiscount: r.manualDiscount,
    autoRuleDiscount: r.autoRuleDiscount,
    promoDiscount: r.promoDiscount,
    afterDiscounts: r.afterDiscounts,
    vatTaxPercent: r.vatTaxPercent,
    vatValue: r.vatValue,
    additionalTaxAmount: r.additionalTaxAmount,
    taxAmount: r.taxAmount,
    chargesTotal: r.chargesTotal,
    roundingAdjustmentAmount: r.roundingAdjustmentAmount,
    saleTotal: r.saleTotal,
    giftCardApplied: r.giftCardApplied,
  };
}

const ZERO = {
  manualDiscount: 0,
  autoRuleDiscount: 0,
  promoDiscount: 0,
  vatTaxPercent: 0,
  vatValue: 0,
  additionalTaxAmount: 0,
  taxAmount: 0,
  chargesTotal: 0,
  roundingAdjustmentAmount: 0,
  giftCardApplied: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 });
  mockResolveTaxPricingMode.mockResolvedValue('TAX_EXCLUSIVE');
  mockResolveCurrencyRoundingRule.mockResolvedValue(null);
  mockTaxProfileFindMany.mockResolvedValue([]);
  mockTaxExemptionFindFirst.mockResolvedValue(null);
  mockGetTaxRate.mockResolvedValue(0);
  mockGetBestDiscount.mockResolvedValue(null);
  mockValidatePromoCode.mockResolvedValue({ isValid: false });
  mockEvaluateBestAutoApplyPromo.mockResolvedValue({ isValid: false });
  mockValidateGiftCard.mockResolvedValue({ isValid: false });
  mockValidateGiftCardById.mockResolvedValue({ isValid: false });
});

describe('P1-01 golden — lines and subtotal', () => {
  it('G01 sums qty × basePrice per line (OMR, 3 decimals)', async () => {
    priceBook({ a: 1.25, b: 3.333 });
    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }],
    });
    expect(money(r)).toEqual({ ...ZERO, subtotal: 5.833, afterDiscounts: 5.833, saleTotal: 5.833 });
    expect(r.currencyCode).toBe('OMR');
    expect(r.decimalPlaces).toBe(3);
    expect(r.discountLines).toEqual([]);
  });

  it('G02 a price override replaces the unit price; line prefs and packing add once per line', async () => {
    priceBook({ a: 10 });
    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 2, priceOverride: 8, servicePrefCharge: 0.5, packingPrefCharge: 0.25 }],
    });
    // 2 × 8 + 0.5 + 0.25
    expect(r.subtotal).toBe(16.75);
  });

  it('G03 an override of 0 is an override (free line), not "no override"', async () => {
    priceBook({ a: 10 });
    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 2, priceOverride: 0, servicePrefCharge: 0.5, packingPrefCharge: 0.25 }],
    });
    expect(r.subtotal).toBe(0.75);
  });

  it('G04 a FIXED price_type product is still charged unit × quantity (price_type is not read)', async () => {
    priceBook({ fixed: 5 });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'fixed', quantity: 3 }] });
    expect(r.subtotal).toBe(15);
  });

  it('G05 Create charges `basePrice` (list price already discounted by SQL), never `finalPrice`', async () => {
    mockGetPriceForOrderItem.mockResolvedValue({ basePrice: 9, finalPrice: 8.1 });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });
    expect(r.subtotal).toBe(9);
  });

  it('G06 express is passed to the price lookup for every line (order-wide), with the customer', async () => {
    priceBook({ a: 1, b: 2 });
    await calculateOrderTotals({
      tenantId: TENANT,
      customerId: 'cust-1',
      isExpress: true,
      items: [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 4 }],
    });
    expect(mockGetPriceForOrderItem.mock.calls.map((c) => c[0])).toEqual([
      { tenantId: TENANT, productId: 'a', quantity: 1, isExpress: true, customerId: 'cust-1' },
      { tenantId: TENANT, productId: 'b', quantity: 4, isExpress: true, customerId: 'cust-1' },
    ]);
  });

  it('G07 KNOWN DEFECT: no items returns all zeros and drops order charges', async () => {
    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [],
      orderCharges: [{ label: 'ORDER_PREF', amount: 2 }],
    });
    expect(money(r)).toEqual({ ...ZERO, subtotal: 0, afterDiscounts: 0, saleTotal: 0 });
  });
});

describe('P1-01 golden — discounts', () => {
  it('G10 manual percent: rounded on the rounded subtotal (3 × 3.333, 10%)', async () => {
    priceBook({ a: 3.333 });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 3 }], percentDiscount: 10 });
    // 9.999 × 10% = 0.9999 -> 1.000
    expect(money(r)).toEqual({ ...ZERO, subtotal: 9.999, manualDiscount: 1, afterDiscounts: 8.999, saleTotal: 8.999 });
    expect(r.discountLines).toEqual([
      {
        sourceType: 'MANUAL',
        sourceName: 'Manual Discount',
        sourceName2: 'خصم يدوي',
        discountType: 'PERCENTAGE',
        discountRate: 10,
        discountAmount: 1,
      },
    ]);
  });

  it('G11 manual fixed amount; percent wins when both are sent', async () => {
    priceBook({ a: 3.333 });
    const fixed = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 3 }], amountDiscount: 2 });
    expect([fixed.manualDiscount, fixed.afterDiscounts]).toEqual([2, 7.999]);
    expect(fixed.discountLines[0]).toMatchObject({ discountType: 'FIXED_AMOUNT', discountRate: undefined });

    const both = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 3 }],
      percentDiscount: 10,
      amountDiscount: 2,
    });
    expect(both.manualDiscount).toBe(1);
  });

  it('G12 a manual amount above the subtotal is capped at the subtotal', async () => {
    priceBook({ a: 3.333 });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 3 }], amountDiscount: 50 });
    expect([r.manualDiscount, r.afterDiscounts, r.saleTotal]).toEqual([9.999, 0, 0]);
  });

  it('G13 automatic rule stacks with a promo code: rule on the after-manual base, promo on the after-rule base', async () => {
    priceBook({ a: 10 });
    mockGetBestDiscount.mockResolvedValue({
      discount_amount: 1,
      rule: { id: 'rule-1', rule_name: 'Ten off', rule_name2: 'خصم', can_stack_with_promo: true },
    });
    mockValidatePromoCode.mockResolvedValue({ isValid: true, discountAmount: 0.5, promoCode: { id: 'promo-1' } });

    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 1 }],
      promoCode: 'save5',
      serviceCategories: ['DRY_CLEAN'],
    });

    expect(money(r)).toEqual({ ...ZERO, subtotal: 10, autoRuleDiscount: 1, promoDiscount: 0.5, afterDiscounts: 8.5, saleTotal: 8.5 });
    expect(mockGetBestDiscount).toHaveBeenCalledWith(TENANT, expect.objectContaining({
      order_total: 10,
      items_count: 1,
      service_categories: ['DRY_CLEAN'],
    }));
    expect(mockValidatePromoCode).toHaveBeenCalledWith(expect.objectContaining({ promo_code: 'save5', order_total: 9 }), {
      tenantId: TENANT, currencyConfig: { currencyCode: 'OMR', decimalPlaces: 3 }, strictResolution: false,
    });
    expect(r.discountLines).toEqual([
      { sourceType: 'DISCOUNT_RULE', sourceId: 'rule-1', sourceName: 'Ten off', sourceName2: 'خصم', discountType: 'FIXED_AMOUNT', discountAmount: 1 },
      { sourceType: 'PROMO_CODE', sourceId: 'promo-1', sourceName: 'SAVE5', discountType: 'FIXED_AMOUNT', discountAmount: 0.5 },
    ]);
  });

  it('G14 non-stackable rule vs a larger promo: the promo wins, evaluated on the after-manual base', async () => {
    priceBook({ a: 10 });
    mockGetBestDiscount.mockResolvedValue({
      discount_amount: 1,
      rule: { id: 'rule-1', rule_name: 'R', rule_name2: null, can_stack_with_promo: false },
    });
    mockValidatePromoCode.mockResolvedValue({ isValid: true, discountAmount: 2, promoCode: { id: 'promo-1' } });

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], promoCode: 'big' });

    expect([r.autoRuleDiscount, r.promoDiscount, r.afterDiscounts]).toEqual([0, 2, 8]);
    expect(mockValidatePromoCode).toHaveBeenCalledWith(expect.objectContaining({ order_total: 10 }), {
      tenantId: TENANT, currencyConfig: { currencyCode: 'OMR', decimalPlaces: 3 }, strictResolution: false,
    });
    expect(r.discountLines.map((l) => l.sourceType)).toEqual(['PROMO_CODE']);
  });

  it('G15 non-stackable rule vs a smaller promo: the rule stays and the typed promo is dropped silently', async () => {
    priceBook({ a: 10 });
    mockGetBestDiscount.mockResolvedValue({
      discount_amount: 1,
      rule: { id: 'rule-1', rule_name: 'R', rule_name2: null, can_stack_with_promo: false },
    });
    mockValidatePromoCode.mockResolvedValue({ isValid: true, discountAmount: 0.5, promoCode: { id: 'promo-1' } });

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], promoCode: 'small' });

    expect([r.autoRuleDiscount, r.promoDiscount, r.afterDiscounts]).toEqual([1, 0, 9]);
    expect(r.discountLines.map((l) => l.sourceType)).toEqual(['DISCOUNT_RULE']);
  });

  it('G16 auto-apply promo (no code typed) is evaluated and named after the promo', async () => {
    priceBook({ a: 10 });
    mockEvaluateBestAutoApplyPromo.mockResolvedValue({
      isValid: true,
      discountAmount: 1.5,
      promo: { id: 'auto-1', promo_name: 'Weekend' },
    });

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], customerId: 'cust-1' });

    expect([r.promoDiscount, r.afterDiscounts]).toEqual([1.5, 8.5]);
    expect(r.discountLines).toEqual([
      { sourceType: 'PROMO_CODE', sourceId: 'auto-1', sourceName: 'Weekend', discountType: 'FIXED_AMOUNT', discountAmount: 1.5 },
    ]);
    expect(mockValidatePromoCode).not.toHaveBeenCalled();
  });

  it('G17 a promo larger than the base is capped at the base', async () => {
    priceBook({ a: 10 });
    mockValidatePromoCode.mockResolvedValue({ isValid: true, discountAmount: 25, promoCode: { id: 'p' } });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], promoCode: 'x' });
    expect([r.promoDiscount, r.afterDiscounts, r.saleTotal]).toEqual([10, 0, 0]);
  });
});

describe('P1-01 golden — tax', () => {
  it('G20 exclusive default profiles VAT 5% + CUSTOM 2% on the after-discount base', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5), profile('mun', 'CUSTOM', 2)]);

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });

    expect(money(r)).toEqual({
      ...ZERO,
      subtotal: 10,
      afterDiscounts: 10,
      vatTaxPercent: 5,
      vatValue: 0.5,
      additionalTaxAmount: 0.2,
      taxAmount: 0.5,
      saleTotal: 10.7,
    });
    expect(r.taxRate).toBe(0.05);
    expect(r.taxBreakdown).toEqual([
      { taxType: 'VAT', label: 'VAT 5%', label2: null, rate: 5, isCompound: false, baseAmount: 10, taxAmount: 0.5, profileId: 'vat' },
      { taxType: 'CUSTOM', label: 'CUSTOM 2%', label2: null, rate: 2, isCompound: false, baseAmount: 10, taxAmount: 0.2, profileId: 'mun' },
    ]);
    // The default-profile query: tenant-scoped, is_default, active.
    expect(mockTaxProfileFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_org_id: TENANT, is_default: true, is_active: true }),
    }));
    // getTaxRate is not used when profiles exist.
    expect(mockGetTaxRate).not.toHaveBeenCalled();
  });

  it('G21 a compound profile is taxed on base + prior tax and always runs after non-compound ones', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('mun', 'CUSTOM', 2, true), profile('vat', 'VAT', 5)]);

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });

    expect(r.taxBreakdown.map((l) => [l.profileId, l.baseAmount, l.taxAmount])).toEqual([
      ['vat', 10, 0.5],
      ['mun', 10.5, 0.21],
    ]);
    expect(r.saleTotal).toBe(10.71);
  });

  it('G22 discounts reduce the tax base (VAT on 9 after 10% off)', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5)]);
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], percentDiscount: 10 });
    expect([r.afterDiscounts, r.vatValue, r.saleTotal]).toEqual([9, 0.45, 9.45]);
  });

  it('G23 inclusive: tax is extracted from the gross, saleTotal stays the gross, afterDiscounts becomes net', async () => {
    priceBook({ a: 10.7 });
    mockResolveTaxPricingMode.mockResolvedValue('TAX_INCLUSIVE');
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5), profile('mun', 'CUSTOM', 2)]);

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });

    expect(money(r)).toEqual({
      ...ZERO,
      subtotal: 10.7,
      afterDiscounts: 10,
      vatTaxPercent: 5,
      vatValue: 0.5,
      additionalTaxAmount: 0.2,
      taxAmount: 0.5,
      saleTotal: 10.7,
    });
    expect(r.taxPricingMode).toBe('TAX_INCLUSIVE');
  });

  it('G24 selected profile ids replace the defaults; an unknown id is rejected', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5)]);
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], taxProfileIds: ['vat'] });
    expect(r.vatValue).toBe(0.5);
    expect(mockTaxProfileFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_org_id: TENANT, id: { in: ['vat'] } }),
    }));

    mockTaxProfileFindMany.mockResolvedValue([]);
    await expect(
      calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], taxProfileIds: ['gone'] }),
    ).rejects.toThrow('INVALID_TAX_PROFILE_SELECTION');
  });

  it('G25 no profile configured: tenant VAT rate fallback (exclusive and inclusive)', async () => {
    priceBook({ a: 10 });
    mockGetTaxRate.mockResolvedValue(0.05);
    const exclusive = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });
    expect([exclusive.vatTaxPercent, exclusive.vatValue, exclusive.afterDiscounts, exclusive.saleTotal]).toEqual([5, 0.5, 10, 10.5]);
    expect(exclusive.taxBreakdown).toEqual([]);

    priceBook({ a: 10.5 });
    mockResolveTaxPricingMode.mockResolvedValue('TAX_INCLUSIVE');
    const inclusive = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });
    expect([inclusive.vatValue, inclusive.afterDiscounts, inclusive.saleTotal]).toEqual([0.5, 10, 10.5]);
  });

  it('G26 customer exemption: no tax and no VAT fallback (after the PF-04 fix)', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5)]);
    mockGetTaxRate.mockResolvedValue(0.05);
    mockTaxExemptionFindFirst.mockResolvedValue({ id: 'ex-1' });

    const r = await calculateOrderTotals({ tenantId: TENANT, customerId: 'cust-exempt', items: [{ productId: 'a', quantity: 1 }] });

    expect(money(r)).toEqual({ ...ZERO, subtotal: 10, afterDiscounts: 10, saleTotal: 10 });
    expect(mockTaxProfileFindMany).not.toHaveBeenCalled();
    expect(mockGetTaxRate).not.toHaveBeenCalled();
  });

  it('G27 KNOWN DEFECT (PF-05): one exempt service category exempts the whole order', async () => {
    priceBook({ a: 10, b: 20 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5)]);
    mockTaxExemptionFindFirst.mockResolvedValue({ id: 'ex-svc' });

    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 1 }],
      serviceCategories: ['WASH_AND_IRON', 'EXEMPT_SERVICE'],
    });

    expect([r.vatValue, r.saleTotal]).toEqual([0, 30]);
    expect(mockTaxExemptionFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenant_org_id: TENANT,
        OR: [{ service_type: { in: ['WASH_AND_IRON', 'EXEMPT_SERVICE'] } }],
      }),
    }));
  });
});

describe('P1-01 golden — charges (PF-19), rounding, gift card, currencies', () => {
  it('G30 ORDER-level preference charges are added after tax: not discounted, not taxed', async () => {
    priceBook({ a: 10 });
    mockGetTaxRate.mockResolvedValue(0.05);

    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 1 }],
      percentDiscount: 10,
      orderCharges: [{ label: 'EXPRESS_BAG', amount: 1 }],
    });

    // 10 - 1 = 9; VAT 5% on 9 = 0.45; + charge 1
    expect(money(r)).toEqual({
      ...ZERO,
      subtotal: 10,
      manualDiscount: 1,
      afterDiscounts: 9,
      vatTaxPercent: 5,
      vatValue: 0.45,
      taxAmount: 0.45,
      chargesTotal: 1,
      saleTotal: 10.45,
    });
  });

  it('G31 inclusive mode also adds charges outside the tax envelope', async () => {
    priceBook({ a: 10.5 });
    mockResolveTaxPricingMode.mockResolvedValue('TAX_INCLUSIVE');
    mockGetTaxRate.mockResolvedValue(0.05);
    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 1 }],
      orderCharges: [{ label: 'X', amount: 1 }],
    });
    expect([r.vatValue, r.afterDiscounts, r.chargesTotal, r.saleTotal]).toEqual([0.5, 10, 1, 11.5]);
  });

  it('G32 SAR (2 decimals), VAT 15% fallback, cash rounding 0.05 HALF_UP on the grand total', async () => {
    mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'SAR', decimalPlaces: 2 });
    mockResolveCurrencyRoundingRule.mockResolvedValue({ roundingMethod: 'HALF_UP', roundingUnit: 0.05 });
    mockGetTaxRate.mockResolvedValue(0.15);
    priceBook({ a: 9.99 });

    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }] });

    // 9.99 × 15% = 1.4985 -> 1.50; 11.49 -> 11.50 (+0.01)
    expect(money(r)).toEqual({
      ...ZERO,
      subtotal: 9.99,
      afterDiscounts: 9.99,
      vatTaxPercent: 15,
      vatValue: 1.5,
      taxAmount: 1.5,
      roundingAdjustmentAmount: 0.01,
      saleTotal: 11.5,
    });
    expect(r.currencyCode).toBe('SAR');
    expect(mockResolveCurrencyRoundingRule).toHaveBeenCalledWith('SAR');
  });

  it('G33 gift card is settlement only: capped by balance, never reduces saleTotal or tax', async () => {
    priceBook({ a: 10 });
    mockTaxProfileFindMany.mockResolvedValue([profile('vat', 'VAT', 5)]);
    mockValidateGiftCardById.mockResolvedValue({ isValid: true, availableBalance: 3 });

    const r = await calculateOrderTotals({
      tenantId: TENANT,
      items: [{ productId: 'a', quantity: 1 }],
      giftCardId: 'gc-1',
      giftCardAmount: 5,
    });

    expect([r.vatValue, r.saleTotal, r.giftCardApplied]).toEqual([0.5, 10.5, 3]);
    expect(mockValidateGiftCardById).toHaveBeenCalledWith('gc-1', TENANT);
    expect(r.discountLines).toEqual([]);
  });

  it('G34 gift card without an amount takes min(balance, total)', async () => {
    priceBook({ a: 10 });
    mockValidateGiftCard.mockResolvedValue({ isValid: true, availableBalance: 50 });
    const r = await calculateOrderTotals({ tenantId: TENANT, items: [{ productId: 'a', quantity: 1 }], giftCardNumber: ' GC-9 ' });
    expect(r.giftCardApplied).toBe(10);
    expect(mockValidateGiftCard).toHaveBeenCalledWith({ gift_card_code: 'GC-9' });
  });
});
