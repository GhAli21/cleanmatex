/**
 * P5-02 — checkout quote: the payment quote and Create submit price the cart
 * through the commercial calculator. Client prices are ignored, order
 * discounts keep today's order and competition, the gift card stays
 * settlement, and the tax panel lists the profiles from the same read.
 */
import {
  checkoutIntentOf,
  quoteCheckout,
  type CheckoutQuoteParams,
} from '@/lib/services/commercial/commercial-checkout.service';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';
import { toCartQuote } from '@/lib/services/commercial/commercial-cart-quote';

const mockBestDiscount = jest.fn();
const mockValidatePromo = jest.fn();
const mockAutoPromo = jest.fn();
const mockGiftById = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));
jest.mock('@/lib/money/currency-rounding', () => ({ resolveCurrencyRoundingRule: async () => null, roundToIncrement: (v: number) => v }));
jest.mock('@/lib/services/discount-service', () => ({
  getBestDiscount: (...args: unknown[]) => mockBestDiscount(...args),
  validatePromoCode: (...args: unknown[]) => mockValidatePromo(...args),
  evaluateBestAutoApplyPromo: (...args: unknown[]) => mockAutoPromo(...args),
}));
jest.mock('@/lib/services/gift-card-service', () => ({
  validateGiftCardByIdForCalculation: (...args: unknown[]) => mockGiftById(...args),
  validateGiftCard: jest.fn(),
}));
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: jest.fn().mockResolvedValue('TAX_EXCLUSIVE'),
  resolveExtraPricePricingMode: jest.fn().mockResolvedValue('INCLUDED_IN_ITEM_PRICE'),
}));

import { TAX_ENGINE_MODELS, activeTaxSetup, taxCodeColumns } from '../../helpers/tax-engine-fixtures';
const TENANT = '11111111-1111-1111-1111-111111111111';
const SHIRT = 'aaaaaaaa-0000-0000-0000-000000000001';

/** A read-only Prisma mock; `findMany` calls are counted per model. */
function mockDb() {
  const fixtures: Record<string, unknown[]> = {
    org_tenants_mst: [{ commercial_level: 'ITEM', disc_alloc_mode: 'DOCUMENT_LEVEL', disc_alloc_basis: 'PROPORTIONAL_NET', timezone: 'Asia/Muscat' }],
    org_product_data_mst: [{
      id: SHIRT, service_category_code: 'LAUNDRY', price_type: 'PER_PC', default_sell_price: '2.000', min_sell_price: null,
      turnaround_hh: '24', tax_category_code: 'STANDARD', tax_supply_code: null, tax_exempt_reason: null,
    }],
    sys_service_speed_cd: [{ code: 'STANDARD' }, { code: 'EXPRESS' }],
    org_tax_profiles_cf: [{
      id: 'vat', name: 'VAT', name2: 'ضريبة', tax_type: 'VAT', rate: '5', is_compound: false, is_default: true, applies_to: [],
      rounding_level: 'DOCUMENT', rounding_mode: 'HALF_UP', output_decimal_places: null, rounding_increment_minor: null, ...taxCodeColumns('VAT_STD'),
    }],
    ...activeTaxSetup('VAT_STD'),
    sys_currency_rounding_rules_cf: [{ rounding_mode: 'HALF_UP' }],
    org_service_preference_cf: [{ preference_code: 'STARCH', extra_price: '0.200', extra_turnaround_minutes: 0, branch_id: null }],
    sys_service_preference_cd: [{ code: 'STARCH', default_extra_price: '0.500', extra_turnaround_minutes: 0 }],
  };
  const counts: Record<string, number> = {};
  const model = (name: string) => ({
    findMany: jest.fn(async () => { counts[name] = (counts[name] ?? 0) + 1; return fixtures[name] ?? []; }),
    findFirst: jest.fn(async () => (fixtures[name] ?? [])[0] ?? null),
  });
  const names = ['org_tenants_mst', 'org_branches_mst', 'org_customers_mst', 'org_product_data_mst', 'org_price_lists_mst',
    'org_price_list_items_dtl', 'org_speed_price_rules_cf', 'org_tax_profiles_cf', 'org_tax_exemptions_cf',
    'org_service_preference_cf', 'org_packing_preference_cf', 'sys_service_preference_cd', 'sys_service_category_cd',
    'sys_service_speed_cd', 'sys_currency_rounding_rules_cf', ...TAX_ENGINE_MODELS];
  return { db: Object.fromEntries(names.map((n) => [n, model(n)])) as unknown as CommercialDb, counts };
}

// 2 shirts at 2.000 + STARCH 0.200 on the line = 4.200; an order-wide STARCH 0.200 charge.
const params = (over: Partial<CheckoutQuoteParams> = {}): CheckoutQuoteParams => ({
  tenantId: TENANT,
  items: [{ productId: SHIRT, quantity: 2, servicePrefs: [{ preference_code: 'STARCH' }] }],
  orderServicePrefs: [{ preference_code: 'STARCH' }],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockBestDiscount.mockResolvedValue(null);
  mockAutoPromo.mockResolvedValue(null);
  mockValidatePromo.mockResolvedValue({ isValid: false });
});

describe('quoteCheckout', () => {
  it('prices the cart from server facts; the charge is taxed (L25); rules choose the tax, so the panel offers no choice', async () => {
    const { db, counts } = mockDb();
    // A client amount on the line is ignored (C2, PF-02).
    const checkout = await quoteCheckout(params({ db, items: [{ ...params().items[0], priceOverride: null }] }));
    const t = checkout.totals;
    // VAT: lines 4.200 × 5% = 0.210, charge 0.200 × 5% = 0.010.
    expect([t.subtotal, t.chargesTotal, t.vatValue, t.saleTotal]).toEqual([4.2, 0.2, 0.22, 4.62]);
    // The included STARCH extras sit inside the 4.200 line price (Order Fin View "Extras included").
    expect(t.extrasIncludedAmount).toBe(0.2);
    expect(t.speedPremiumIncludedAmount).toBe(0); // standard speed
    expect(t.taxBreakdown).toEqual([expect.objectContaining({ profileId: 'vat', label: 'VAT', label2: 'ضريبة', rate: 5, taxAmount: 0.22 })]);
    expect(checkout.taxProfileEntries).toEqual([]);
    expect(counts.org_tax_profiles_cf).toBe(1);
    expect(checkout.quote.result.calcVersion).toBe(1);
  });

  it('manual → rule → promo, each evaluated on the base the calculator leaves', async () => {
    const { db } = mockDb();
    mockBestDiscount.mockResolvedValue({ discount_amount: 0.5, rule: { id: 'rule-1', rule_name: 'R', rule_name2: null, can_stack_with_promo: true } });
    mockValidatePromo.mockResolvedValue({ isValid: true, discountAmount: 0.3, promoCode: { id: 'promo-1' } });
    const checkout = await quoteCheckout(params({ db, percentDiscount: 10, promoCode: 'autumn' }));
    // 4.200 − 10% = 3.780 for the rule; 3.780 − 0.500 = 3.280 for the promo.
    expect(mockBestDiscount.mock.calls[0][1].order_total).toBe(3.78);
    expect(mockValidatePromo.mock.calls[0][0].order_total).toBe(3.28);
    const t = checkout.totals;
    expect([t.manualDiscount, t.autoRuleDiscount, t.promoDiscount, t.afterDiscounts]).toEqual([0.42, 0.5, 0.3, 2.98]);
    expect(t.saleTotal).toBe(Number((t.afterDiscounts + t.vatValue + t.chargesTotal).toFixed(3)));
    expect(checkout.promotionId).toBe('promo-1');
    expect(checkout.adjustmentMeta.get('promo')).toMatchObject({ promotionId: 'promo-1', sourceName: 'AUTUMN' });
    expect(checkout.adjustmentMeta.get('rule')).toMatchObject({ sourceId: 'rule-1' });
    expect(t.discountLines.map((d) => d.sourceType)).toEqual(['MANUAL', 'DISCOUNT_RULE', 'PROMO_CODE']);
  });

  it.each([
    { rule: 0.3, promo: 0.5, expected: [0, 0.5], promotionId: 'promo-1' },
    { rule: 0.6, promo: 0.5, expected: [0.6, 0], promotionId: null },
  ])('a non-stackable rule competes with the promo on the after-manual base (rule $rule, promo $promo)', async ({ rule, promo, expected, promotionId }) => {
    const { db } = mockDb();
    mockBestDiscount.mockResolvedValue({ discount_amount: rule, rule: { id: 'rule-1', rule_name: 'R', can_stack_with_promo: false } });
    mockValidatePromo.mockResolvedValue({ isValid: true, discountAmount: promo, promoCode: { id: 'promo-1' } });
    const checkout = await quoteCheckout(params({ db, promoCode: 'x' }));
    expect(mockValidatePromo.mock.calls[0][0].order_total).toBe(4.2);
    expect([checkout.totals.autoRuleDiscount, checkout.totals.promoDiscount]).toEqual(expected);
    expect(checkout.promotionId).toBe(promotionId);
  });

  it('G15: a typed promo that loses to a non-combinable rule is reported, never dropped silently', async () => {
    const { db } = mockDb();
    mockBestDiscount.mockResolvedValue({ discount_amount: 0.6, rule: { id: 'rule-1', rule_name: 'Weekday', rule_name2: 'أيام الأسبوع', can_stack_with_promo: false } });
    mockValidatePromo.mockResolvedValue({ isValid: true, discountAmount: 0.5, promoCode: { id: 'promo-1' } });
    const checkout = await quoteCheckout(params({ db, promoCode: 'autumn' }));
    expect(checkout.promoNotice).toEqual({ code: 'PROMO_NOT_APPLIED_RULE_WINS', promoCode: 'AUTUMN', ruleName: 'Weekday', ruleName2: 'أيام الأسبوع' });
    // An automatic promo that loses is not a cashier's choice: no notice.
    mockValidatePromo.mockReset();
    mockAutoPromo.mockResolvedValue({ isValid: true, discountAmount: 0.5, promo: { id: 'auto-1', promo_name: 'Weekend' } });
    expect((await quoteCheckout(params({ db: mockDb().db }))).promoNotice).toBeNull();
  });

  it('an automatic promo is applied and reported for its usage row (PF-15)', async () => {
    const { db } = mockDb();
    mockAutoPromo.mockResolvedValue({ isValid: true, discountAmount: 9, promo: { id: 'auto-1', promo_name: 'Weekend' } });
    const checkout = await quoteCheckout(params({ db }));
    // Capped at what is left (4.200), never rejected for a too-large service amount.
    expect(checkout.totals.promoDiscount).toBe(4.2);
    expect(checkout.promotionId).toBe('auto-1');
  });

  it('a gift card is settlement: it never lowers the sale total and is capped by it', async () => {
    const { db } = mockDb();
    mockGiftById.mockResolvedValue({ isValid: true, availableBalance: 100 });
    const checkout = await quoteCheckout(params({ db, giftCardId: 'gc-1' }));
    expect([checkout.totals.saleTotal, checkout.totals.giftCardApplied]).toEqual([4.62, 4.62]);
  });
});

describe('line discount (P5-03c)', () => {
  it('a cashier percent on a line is priced by the calculator, labelled and keeps its reason; order discounts start after it', async () => {
    const { db } = mockDb();
    const checkout = await quoteCheckout(params({
      db, percentDiscount: 10,
      items: [{ ...params().items[0], lineDiscount: { type: 'PERCENTAGE', value: 10, reason: 'Loyal customer' } }],
    }));
    const line = checkout.quote.result.lines[0].item.money;
    // 4.200 gross, 10% = 0.420 on the line; the order's 10% then applies to 3.780.
    expect([line.grossAmount.toNumber(), line.lineDiscountAmount.toNumber()]).toEqual([4.2, 0.42]);
    expect(checkout.totals.manualDiscount).toBe(0.378);
    expect(checkout.intent.lines[0].lineDiscounts).toEqual([{ id: 'L1:manual', source: 'MANUAL', calcType: 'PERCENTAGE', value: '10' }]);
    expect(checkout.adjustmentMeta.get('L1:manual')).toEqual({ sourceName: 'Line Discount', sourceName2: 'خصم سطر', notes: 'Loyal customer' });
    const cart = toCartQuote(checkout, 'r');
    expect(cart.lines[0].discounts).toEqual([{ source: 'MANUAL', rate: 10, amount: 0.42 }]);
  });

  it('an amount above the line gross is rejected, never clamped', async () => {
    const { db } = mockDb();
    await expect(quoteCheckout(params({
      db, items: [{ ...params().items[0], lineDiscount: { type: 'FIXED_AMOUNT', value: 5 } }],
    }))).rejects.toMatchObject({ code: 'LINE_DISCOUNT_EXCEEDS_GROSS' });
  });
});

describe('custom item (P5-03e)', () => {
  it('a line with no product is priced at the entered price, taxed as standard, next to a catalog line', async () => {
    const { db } = mockDb();
    const checkout = await quoteCheckout(params({
      db, orderServicePrefs: [],
      items: [
        { customItem: { name: 'Wedding dress', unitPrice: 5, serviceCategoryCode: 'LAUNDRY' }, quantity: 1 },
        { productId: SHIRT, quantity: 1 },
      ],
    }));
    const [custom, shirt] = checkout.quote.result.lines;
    expect([custom.item.money.unitPrice.toNumber(), custom.item.money.grossAmount.toNumber(), custom.item.tax.taxCategoryCode]).toEqual([5, 5, 'STANDARD']);
    expect(shirt.item.money.grossAmount.toNumber()).toBe(2);
    expect(checkout.intent.lines[0]).toMatchObject({ productId: null, customItem: { unitPrice: '5', serviceCategoryCode: 'LAUNDRY' } });
    expect(checkout.quote.prices[0].productId).toBeNull();
    // VAT 5% on 7.000.
    expect(checkout.totals.saleTotal).toBe(7.35);
    // Only the catalog product is read.
    const productQuery = (db.org_product_data_mst.findMany as jest.Mock).mock.calls[0][0];
    expect(productQuery.where.id).toEqual({ in: [SHIRT] });
  });
});

describe('toCartQuote (P5-03 cart)', () => {
  it('shows the same figures as the payment quote, per line by cart position, with the L25 disclosure', async () => {
    const { db } = mockDb();
    const checkout = await quoteCheckout(params({ db }));
    const cart = toCartQuote(checkout, 'req-1');
    expect(cart.requestId).toBe('req-1');
    expect(cart.totals).toEqual({
      subtotal: 4.2, orderDiscountTotal: 0, chargesTotal: 0.2, taxTotal: 0.22, roundingAdjustmentAmount: 0, saleTotal: 4.62,
    });
    expect(cart.totals.saleTotal).toBe(checkout.totals.saleTotal);
    expect(cart.lines).toEqual([expect.objectContaining({ index: 0, unitPrice: 2, includedModifierAmount: 0.2, grossAmount: 4.2, taxAmount: 0.21 })]);
    expect(cart.disclosures).toEqual([{ code: 'ORDER_CHARGE_TAXED', amount: 0.01 }]);
    // The resolver's order ready-by is the latest line ready-by.
    expect(cart.readyByAt).toBe(cart.lines[0].readyByAt);
  });

  it('no disclosure without an order charge', async () => {
    const { db } = mockDb();
    const cart = toCartQuote(await quoteCheckout(params({ db, orderServicePrefs: [] })), 'req-2');
    expect(cart.disclosures).toEqual([]);
    expect(cart.totals.chargesTotal).toBe(0);
  });
});

describe('checkoutIntentOf', () => {
  it('maps codes only: line, piece and order preferences; ceil(quantity) pieces; order and line speed; ready-by', () => {
    const intent = checkoutIntentOf({
      tenantId: TENANT, serviceSpeed: 'EXPRESS', readyByAt: 'not-a-date',
      items: [{ productId: SHIRT, quantity: 2.5, priceOverride: 1.5, packingPrefCode: 'HANG', serviceSpeed: 'STANDARD',
        pieces: [{ servicePrefs: [{ preference_code: 'STARCH' }] }] }],
      orderServicePrefs: [{ preference_code: 'IRON' }],
    }, new Date('2026-10-25T08:00:00Z'));
    expect(intent.serviceSpeed).toBe('EXPRESS');
    expect(intent.readyByOverride).toBeNull();
    const [line] = intent.lines;
    // P5-03b: a line keeps its own speed; the order speed is the default for the others.
    expect(line).toMatchObject({ lineId: 'L1', serviceSpeed: 'STANDARD', overrideUnitPrice: '1.5', preferences: [{ code: 'HANG', kind: 'PACKING' }] });
    expect(line.pieces?.map((p) => [p.pieceId, p.preferences.map((x) => x.code)])).toEqual([['L1-p1', ['STARCH']], ['L1-p2', []], ['L1-p3', []]]);
    expect(intent.orderPreferences).toEqual([{ code: 'IRON', kind: 'SERVICE' }]);
  });
});
