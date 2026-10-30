/**
 * P4-02 — standard price and speed premium resolvers (PLAN.md §7, §15 test matrix).
 */
import fc from 'fast-check';
import {
  PriceNotResolvedError,
  SPEED_RULE_LEVELS,
  resolveSpeedPricing,
  resolveStandardPrice,
  selectSpeedRule,
  toMoney,
  type PriceListCandidate,
  type SpeedContext,
  type SpeedRuleCandidate,
} from '@/lib/commercial';

const DATE = '2026-10-24';

const row = (over: Partial<PriceListCandidate> = {}): PriceListCandidate => ({
  priceListId: 'pl-std',
  priceListItemId: 'pli-1',
  listType: 'standard',
  listPriority: 0,
  effectiveFrom: null,
  effectiveTo: null,
  listActive: true,
  itemActive: true,
  unitPrice: '2.000',
  discountPercent: null,
  minQuantity: 1,
  maxQuantity: null,
  ...over,
});

const std = (candidates: PriceListCandidate[], over: { quantity?: number; customerListType?: string | null; productDefaultPrice?: string | null } = {}) =>
  resolveStandardPrice({
    quantity: over.quantity ?? 1,
    businessDate: DATE,
    customerListType: over.customerListType ?? null,
    candidates,
    productDefaultPrice: over.productDefaultPrice === undefined ? '3.000' : over.productDefaultPrice,
  });

describe('resolveStandardPrice', () => {
  it('uses the standard list and returns its discount separately (PF-03)', () => {
    const result = std([row({ unitPrice: '10', discountPercent: '10' })]);
    expect(result.unitPrice.toString()).toBe('10');
    expect(result.priceListDiscountPercent.toString()).toBe('10');
    expect(result.source).toBe('PRICE_LIST');
    expect(result.priceListItemId).toBe('pli-1');
  });

  it('falls back to the product default when no list row applies', () => {
    const result = std([row({ listActive: false }), row({ itemActive: false })]);
    expect(result).toMatchObject({ source: 'PRODUCT_DEFAULT', priceListId: null });
    expect(result.unitPrice.toString()).toBe('3');
    expect(result.priceListDiscountPercent.isZero()).toBe(true);
  });

  it('prefers the customer list, then the standard list, then the default', () => {
    const b2b = row({ priceListId: 'pl-b2b', priceListItemId: 'pli-b2b', listType: 'b2b', unitPrice: '1.500' });
    expect(std([row(), b2b], { customerListType: 'b2b' })).toMatchObject({ source: 'CUSTOMER_PRICE', priceListId: 'pl-b2b' });
    expect(std([row()], { customerListType: 'b2b' })).toMatchObject({ source: 'PRICE_LIST', priceListId: 'pl-std' });
    expect(std([], { customerListType: 'vip' }).source).toBe('PRODUCT_DEFAULT');
    expect(std([row(), b2b], { customerListType: 'standard' }).source).toBe('PRICE_LIST');
  });

  it('respects effective dates (inclusive) and quantity tiers', () => {
    expect(std([row({ effectiveFrom: '2026-10-25' })]).source).toBe('PRODUCT_DEFAULT');
    expect(std([row({ effectiveTo: '2026-10-23' })]).source).toBe('PRODUCT_DEFAULT');
    expect(std([row({ effectiveFrom: DATE, effectiveTo: DATE })]).source).toBe('PRICE_LIST');
    const tiers = [
      row({ priceListItemId: 't1', minQuantity: 1, maxQuantity: 9, unitPrice: '2' }),
      row({ priceListItemId: 't10', minQuantity: 10, maxQuantity: null, unitPrice: '1.8' }),
    ];
    expect(std(tiers, { quantity: 5 }).unitPrice.toString()).toBe('2');
    expect(std(tiers, { quantity: 10 }).unitPrice.toString()).toBe('1.8');
  });

  it('orders by priority, then deepest tier, then item id (deterministic)', () => {
    const low = row({ priceListItemId: 'a', listPriority: 1, unitPrice: '5' });
    const high = row({ priceListItemId: 'b', listPriority: 2, unitPrice: '4' });
    expect(std([low, high]).unitPrice.toString()).toBe('4');
    const nullPrio = row({ priceListItemId: 'c', listPriority: null, unitPrice: '6' });
    expect(std([nullPrio, low]).unitPrice.toString()).toBe('5');
    const tie1 = row({ priceListItemId: 'z', unitPrice: '7' });
    const tie2 = row({ priceListItemId: 'y', unitPrice: '8' });
    expect(std([tie1, tie2]).priceListItemId).toBe('y');
    expect(std([tie2, tie1]).priceListItemId).toBe('y');
  });

  it('keeps 4-decimal list prices exact (the SQL function returned NUMERIC(10,3))', () => {
    expect(std([row({ unitPrice: '1.2345' })]).unitPrice.toString()).toBe('1.2345');
  });

  it('accepts a zero default price but never invents one', () => {
    expect(std([], { productDefaultPrice: '0' }).unitPrice.isZero()).toBe(true);
    expect(() => std([], { productDefaultPrice: null })).toThrow(PriceNotResolvedError);
  });

  it('rejects bad input', () => {
    expect(() => std([row()], { quantity: 0 })).toThrow();
    expect(() => std([row({ discountPercent: '101' })])).toThrow(/0–100/);
    expect(() => std([row({ discountPercent: '-1' })])).toThrow(/0–100/);
  });
});

// ── speed ──────────────────────────────────────────────────────────────────

const ctx: SpeedContext = {
  serviceSpeed: 'EXPRESS',
  branchId: 'br-1',
  serviceCategoryCode: 'DRY_CLEAN',
  productId: 'prod-1',
  businessDate: DATE,
};

const rule = (over: Partial<SpeedRuleCandidate> = {}): SpeedRuleCandidate => ({
  id: 'r-1',
  serviceSpeed: 'EXPRESS',
  branchId: null,
  serviceCategoryCode: null,
  productId: null,
  speedPriceType: 'MULTIPLIER',
  defaultSpeedSellPrice: null,
  multiplierSpeed: '0.30',
  speedExtraAmount: null,
  priceBasis: null,
  turnaroundHhSpeed: null,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  isActive: true,
  ...over,
});

const byLevel: Record<(typeof SPEED_RULE_LEVELS)[number], SpeedRuleCandidate> = {
  PRODUCT_BRANCH: rule({ id: 'pb', productId: 'prod-1', branchId: 'br-1' }),
  PRODUCT: rule({ id: 'p', productId: 'prod-1' }),
  CATEGORY_BRANCH: rule({ id: 'cb', serviceCategoryCode: 'DRY_CLEAN', branchId: 'br-1' }),
  CATEGORY: rule({ id: 'c', serviceCategoryCode: 'DRY_CLEAN' }),
  TENANT_BRANCH: rule({ id: 'tb', branchId: 'br-1' }),
  TENANT: rule({ id: 't' }),
};

describe('selectSpeedRule', () => {
  it.each(SPEED_RULE_LEVELS.map((level, i) => [level, i] as const))(
    '%s wins over every less specific level',
    (level, i) => {
      const candidates = SPEED_RULE_LEVELS.slice(i).map((l) => byLevel[l]).reverse();
      expect(selectSpeedRule(ctx, candidates)).toMatchObject({ level, rule: { id: byLevel[level].id } });
    },
  );

  it('needs every scope the rule sets to match the row', () => {
    expect(selectSpeedRule({ ...ctx, branchId: 'br-2' }, [byLevel.PRODUCT_BRANCH])).toBeNull();
    expect(selectSpeedRule({ ...ctx, branchId: null }, [byLevel.TENANT_BRANCH])).toBeNull();
    expect(selectSpeedRule({ ...ctx, serviceCategoryCode: 'WASH' }, [byLevel.CATEGORY])).toBeNull();
    expect(selectSpeedRule({ ...ctx, productId: null }, [byLevel.PRODUCT])).toBeNull();
    const productInOtherCategory = rule({ id: 'x', productId: 'prod-1', serviceCategoryCode: 'WASH' });
    expect(selectSpeedRule(ctx, [productInOtherCategory])).toBeNull();
  });

  it('ignores inactive, not-yet-effective, expired and other-speed rules', () => {
    expect(selectSpeedRule(ctx, [rule({ isActive: false })])).toBeNull();
    expect(selectSpeedRule(ctx, [rule({ effectiveFrom: '2026-10-25' })])).toBeNull();
    expect(selectSpeedRule(ctx, [rule({ effectiveTo: '2026-10-23' })])).toBeNull();
    expect(selectSpeedRule(ctx, [rule({ serviceSpeed: 'SAME_DAY' })])).toBeNull();
    expect(selectSpeedRule(ctx, [rule({ effectiveFrom: DATE, effectiveTo: DATE })])).not.toBeNull();
  });

  it('at one level, the later effective_from wins, then the lower id', () => {
    const older = rule({ id: 'a', effectiveFrom: '2026-01-01' });
    const newer = rule({ id: 'b', effectiveFrom: '2026-06-01' });
    expect(selectSpeedRule(ctx, [newer, older])?.rule.id).toBe('b');
    expect(selectSpeedRule(ctx, [older, newer])?.rule.id).toBe('b');
    const twin = rule({ id: 'a2', effectiveFrom: '2026-06-01' });
    expect(selectSpeedRule(ctx, [twin, newer])?.rule.id).toBe('a2');
  });

  it('property: the result never depends on candidate order', () => {
    const all = Object.values(byLevel);
    fc.assert(fc.property(fc.shuffledSubarray(all, { minLength: 1 }), (subset) => {
      const forward = selectSpeedRule(ctx, subset)?.rule.id;
      expect(selectSpeedRule(ctx, [...subset].reverse())?.rule.id).toBe(forward);
    }));
  });
});

describe('resolveSpeedPricing', () => {
  const price = (rules: SpeedRuleCandidate[], over: Partial<Parameters<typeof resolveSpeedPricing>[0]> = {}) =>
    resolveSpeedPricing({
      ...ctx,
      standardUnitPrice: '10',
      referenceUnitPrice: '10',
      quantity: 2,
      rules,
      ...over,
    });

  it('STANDARD speed has no premium, even when rules exist', () => {
    const result = price([rule({ serviceSpeed: 'STANDARD' })], { serviceSpeed: 'STANDARD' });
    expect(result).toMatchObject({ outcome: 'STANDARD_SPEED', ruleId: null });
    expect(result.unitPrice.toString()).toBe('10');
    expect(result.premiumAmount.isZero()).toBe(true);
  });

  it('no rule means no premium, reported as NO_RULE for the cart note', () => {
    const result = price([]);
    expect(result).toMatchObject({ outcome: 'NO_RULE', ruleId: null, ruleLevel: null });
    expect(result.premiumAmount.isZero()).toBe(true);
  });

  it('MULTIPLIER adds the fraction (L20: 10 × 0.30 + 10 = 13)', () => {
    const result = price([rule()]);
    expect(result.unitPremium.toString()).toBe('3');
    expect(result.unitPrice.toString()).toBe('13');
    expect(result.premiumAmount.toString()).toBe('6');
    expect(result).toMatchObject({ outcome: 'RULE_APPLIED', ruleId: 'r-1', ruleLevel: 'TENANT', speedPriceType: 'MULTIPLIER' });
  });

  it('MULTIPLIER 0 (the M2 backfill for factor 1.00) gives normal + 0', () => {
    expect(price([rule({ multiplierSpeed: '0' })]).unitPrice.toString()).toBe('10');
  });

  it('SELL_PRICE premium is the rule price minus the product default', () => {
    const r = rule({ speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '14.500', productId: 'prod-1' });
    const result = price([r]);
    expect(result.unitPremium.toString()).toBe('4.5');
    expect(result.unitPrice.toString()).toBe('14.5');
  });

  it('PF-08: a B2B customer keeps the express premium on top of the B2B price', () => {
    const r = rule({ speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '4', productId: 'prod-1' });
    const result = price([r], { standardUnitPrice: '2', referenceUnitPrice: '3', quantity: 1 });
    expect(result.unitPremium.toString()).toBe('1');
    expect(result.unitPrice.toString()).toBe('3');
  });

  it('SELL_PRICE below the normal price holds the premium at 0 and warns', () => {
    const r = rule({ speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '8' });
    const result = price([r]);
    expect(result.unitPremium.isZero()).toBe(true);
    expect(result.warnings).toEqual(['SELL_PRICE_BELOW_STANDARD']);
  });

  it('FIXED_AMOUNT adds per unit, or once per line for PER_LINE', () => {
    const perUnit = rule({ speedPriceType: 'FIXED_AMOUNT', multiplierSpeed: null, speedExtraAmount: '0.500' });
    const perUnitResult = price([perUnit], { quantity: 3 });
    expect(perUnitResult.unitPrice.toString()).toBe('10.5');
    expect(perUnitResult.premiumAmount.toString()).toBe('1.5');

    const perLine = rule({ ...perUnit, priceBasis: 'PER_LINE' });
    const perLineResult = price([perLine], { quantity: 3 });
    expect(perLineResult.unitPrice.toString()).toBe('10');
    expect(perLineResult.linePremium.toString()).toBe('0.5');
    expect(perLineResult.premiumAmount.toString()).toBe('0.5');
  });

  it('a custom item uses category or tenant rules, and its entered price as reference', () => {
    const product = rule({ id: 'p', productId: 'prod-1', multiplierSpeed: '1' });
    const sell = rule({ id: 'c', serviceCategoryCode: 'DRY_CLEAN', speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '12' });
    const result = price([product, sell], { productId: null, referenceUnitPrice: null, quantity: 1 });
    expect(result.ruleId).toBe('c');
    expect(result.unitPremium.toString()).toBe('2');
  });

  it('returns the rule turnaround, or null to keep the standard one', () => {
    expect(price([rule({ turnaroundHhSpeed: '6.5' })]).turnaroundHours?.toString()).toBe('6.5');
    expect(price([rule()]).turnaroundHours).toBeNull();
  });

  it('works with fractional quantities (per-kg lines)', () => {
    expect(price([rule()], { quantity: '1.25' }).premiumAmount.toString()).toBe('3.75');
  });

  it('rejects a rule missing the value of its price type', () => {
    expect(() => price([rule({ multiplierSpeed: null })])).toThrow(/no value/);
  });

  it('property: unit price = standard + unit premium; premium total = unit × qty + line', () => {
    const amount = fc.integer({ min: 0, max: 10_000_000 }).map((n) => toMoney(n).dividedBy(10_000));
    fc.assert(fc.property(amount, amount, fc.integer({ min: 1, max: 50 }), (standard, extra, qty) => {
      const result = price([rule({ speedPriceType: 'FIXED_AMOUNT', multiplierSpeed: null, speedExtraAmount: extra })], {
        standardUnitPrice: standard, quantity: qty,
      });
      expect(result.unitPrice.equals(standard.plus(result.unitPremium))).toBe(true);
      expect(result.premiumAmount.equals(result.unitPremium.times(qty).plus(result.linePremium))).toBe(true);
      expect(result.premiumAmount.isNegative()).toBe(false);
    }));
  });
});
