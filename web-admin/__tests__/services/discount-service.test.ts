/**
 * Tests: discount-service
 *
 * Covers:
 * - applyPromoCodeTx TOCTOU guard (SELECT FOR UPDATE throws when max_uses hit)
 * - evaluateDiscountRules stacking (getBestDiscount returns highest discount)
 */

// ---------------------------------------------------------------------------
// Mocks — defined inside factory functions to avoid TDZ hoisting issues
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    org_promotions_mst: { findFirst: jest.fn() },
    org_promotion_usage_dtl: { count: jest.fn() },
    org_discount_rules_cf: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-abc'),
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-abc')
  ),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  tenantSettingsService: {
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  },
}));

jest.mock('@/lib/money/format-money', () => ({
  formatMoneyAmountWithCode: jest.fn((v: number) => String(v)),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma';
import { applyPromoCodeTx, getBestDiscount, evaluatePromoCode } from '@/lib/services/discount-service';

const mockDiscountRulesFindMany = prisma.org_discount_rules_cf.findMany as jest.Mock;
const mockPromoFindFirst = prisma.org_promotions_mst.findFirst as jest.Mock;
const mockUsageCount = prisma.org_promotion_usage_dtl.count as jest.Mock;

// Minimal valid promo row (lower-case discount_type, matching real DB storage).
function makePromoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    tenant_org_id: 'tenant-abc',
    promo_code: 'SUMMER10',
    discount_type: 'percentage',
    discount_value: 10,
    max_discount_amount: null,
    min_order_amount: 0,
    max_order_amount: null,
    applicable_categories: null,
    max_uses: null,
    current_uses: 0,
    max_uses_per_customer: null,
    valid_from: new Date(Date.now() - 86_400_000), // yesterday
    valid_to: null,
    is_active: true,
    is_enabled: true,
    rec_status: 1,
    ...overrides,
  };
}

describe('discount-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // applyPromoCodeTx — TOCTOU guard
  // -------------------------------------------------------------------------

  describe('applyPromoCodeTx', () => {
    // Mock keys match the actual table names used by discount-service.ts:
    // org_promotion_usage_dtl (was org_promo_usage_log) and org_promotions_mst (was org_promo_codes_mst).
    // existingUsage defaults to null (no prior apply); override per-test for the
    // PR-2 idempotency-replay case.
    const buildTxClient = (locked: object[], existingUsage: object | null = null) => ({
      $queryRaw: jest.fn().mockResolvedValue(locked),
      org_promotion_usage_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingUsage),
        create: jest.fn().mockResolvedValue({}),
      },
      org_promotions_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('throws PROMO_NOT_FOUND when row lock returns empty', async () => {
      const tx = buildTxClient([]);
      await expect(
        applyPromoCodeTx(tx as never, {
          promoCodeId: 'promo-1',
          orderId: 'order-1',
          invoiceId: 'inv-1',
          tenantOrgId: 'tenant-abc',
          discountAmount: 5,
          orderTotalBefore: 100,
        })
      ).rejects.toThrow('PROMO_NOT_FOUND');
    });

    it('throws PROMO_MAX_USES_EXCEEDED when current_uses >= max_uses', async () => {
      const tx = buildTxClient([{ id: 'promo-1', current_uses: 10, max_uses: 10 }]);
      await expect(
        applyPromoCodeTx(tx as never, {
          promoCodeId: 'promo-1',
          orderId: 'order-1',
          invoiceId: 'inv-1',
          tenantOrgId: 'tenant-abc',
          discountAmount: 5,
          orderTotalBefore: 100,
        })
      ).rejects.toThrow('PROMO_MAX_USES_EXCEEDED');
    });

    it('records usage and increments count on success', async () => {
      const tx = buildTxClient([{ id: 'promo-1', current_uses: 3, max_uses: 10 }]);
      await applyPromoCodeTx(tx as never, {
        promoCodeId: 'promo-1',
        orderId: 'order-1',
        invoiceId: 'inv-1',
        tenantOrgId: 'tenant-abc',
        discountAmount: 10,
        orderTotalBefore: 100,
      });
      expect((tx.org_promotion_usage_dtl.create as jest.Mock).mock.calls[0][0].data.discount_amount).toBe(10);
      expect((tx.org_promotion_usage_dtl.create as jest.Mock).mock.calls[0][0].data.idempotency_key).toBe('order-1:promo-1');
      expect((tx.org_promotions_mst.update as jest.Mock).mock.calls[0][0].data.current_uses).toEqual({ increment: 1 });
    });

    it('PR-2: skips (no create, no increment) when this order+promo was already applied', async () => {
      // findFirst returns an existing usage row for the same idempotency key.
      const tx = buildTxClient([{ id: 'promo-1', current_uses: 3, max_uses: 10 }], { id: 'usage-existing' });
      await applyPromoCodeTx(tx as never, {
        promoCodeId: 'promo-1',
        orderId: 'order-1',
        invoiceId: 'inv-1',
        tenantOrgId: 'tenant-abc',
        discountAmount: 10,
        orderTotalBefore: 100,
      });
      expect(tx.org_promotion_usage_dtl.create as jest.Mock).not.toHaveBeenCalled();
      expect(tx.org_promotions_mst.update as jest.Mock).not.toHaveBeenCalled();
    });

    it('allows unlimited uses when max_uses is null', async () => {
      const tx = buildTxClient([{ id: 'promo-1', current_uses: 999, max_uses: null }]);
      await expect(
        applyPromoCodeTx(tx as never, {
          promoCodeId: 'promo-1',
          orderId: 'order-1',
          invoiceId: 'inv-1',
          tenantOrgId: 'tenant-abc',
          discountAmount: 5,
          orderTotalBefore: 100,
        })
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getBestDiscount — stacking policy
  // -------------------------------------------------------------------------

  describe('getBestDiscount', () => {
    const baseRule = {
      tenant_org_id: 'tenant-abc',
      rule_type: 'auto',
      conditions: { min_order_amount: 0 },
      can_stack_with_promo: false,
      can_stack_with_other_rules: false,
      valid_from: new Date('2020-01-01'),
      valid_to: null,
      is_active: true,
      is_enabled: true,
      created_at: new Date(),
      updated_at: null,
      rule_name2: null,
      description: null,
      description2: null,
      created_by: null,
      updated_by: null,
      metadata: null,
    };

    it('returns the rule with the highest discount amount', async () => {
      mockDiscountRulesFindMany.mockResolvedValue([
        { ...baseRule, id: 'r1', rule_code: 'LOYAL10', rule_name: '10%', discount_type: 'percentage', discount_value: 10, priority: 1 },
        { ...baseRule, id: 'r2', rule_code: 'VIP20', rule_name: '20%', discount_type: 'percentage', discount_value: 20, priority: 2 },
      ]);

      const best = await getBestDiscount('tenant-abc', {
        order_total: 100,
        items_count: 2,
        service_categories: [],
        order_date: new Date().toISOString(),
      });

      expect(best?.discount_amount).toBe(20);
      expect(best?.rule.rule_code).toBe('VIP20');
    });

    it('returns null when no rules exist', async () => {
      mockDiscountRulesFindMany.mockResolvedValue([]);
      const result = await getBestDiscount('tenant-abc', {
        order_total: 50,
        items_count: 1,
        service_categories: [],
        order_date: new Date().toISOString(),
      });
      expect(result).toBeNull();
    });

    it('skips rules where min_order_amount condition is not met', async () => {
      mockDiscountRulesFindMany.mockResolvedValue([
        {
          ...baseRule,
          id: 'r-hi',
          rule_code: 'BIG50',
          rule_name: '50% big',
          discount_type: 'percentage',
          discount_value: 50,
          priority: 10,
          conditions: { min_order_amount: 200 },
        },
      ]);

      const result = await getBestDiscount('tenant-abc', {
        order_total: 50, // below 200
        items_count: 1,
        service_categories: [],
        order_date: new Date().toISOString(),
      });
      expect(result).toBeNull();
    });
  });
});

// ===========================================================================
// evaluatePromoCode — canonical evaluation shared by checkout + marketing preview
// ===========================================================================

describe('discount-service — evaluatePromoCode (unified validator)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsageCount.mockResolvedValue(0);
  });

  const base = { tenantId: 'tenant-abc', code: 'SUMMER10', orderTotal: 100 };

  it('valid percentage promo → isValid + computed discount', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ discount_type: 'percentage', discount_value: 10 }));
    const r = await evaluatePromoCode(base);
    expect(r.isValid).toBe(true);
    expect(r.discountAmount).toBeCloseTo(10); // 100 * 10%
    expect(r.promo?.id).toBe('promo-1');
  });

  it('computes percentage discount regardless of discount_type casing (regression)', async () => {
    // The marketing preview used to return 0 for upper-case stored values.
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ discount_type: 'PERCENTAGE', discount_value: 25 }));
    const r = await evaluatePromoCode(base);
    expect(r.isValid).toBe(true);
    expect(r.discountAmount).toBeCloseTo(25);
  });

  it('caps a percentage discount at max_discount_amount', async () => {
    mockPromoFindFirst.mockResolvedValue(
      makePromoRow({ discount_type: 'percentage', discount_value: 50, max_discount_amount: 10 })
    );
    const r = await evaluatePromoCode(base);
    expect(r.discountAmount).toBe(10);
  });

  it('fixed_amount discount cannot exceed the order total', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ discount_type: 'fixed_amount', discount_value: 999 }));
    const r = await evaluatePromoCode({ ...base, orderTotal: 30 });
    expect(r.discountAmount).toBe(30);
  });

  it('looks the code up upper-cased (case-insensitive codes)', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow());
    await evaluatePromoCode({ ...base, code: 'summer10' });
    expect(mockPromoFindFirst.mock.calls[0][0].where.promo_code).toBe('SUMMER10');
    // Strict liveness filter is applied.
    expect(mockPromoFindFirst.mock.calls[0][0].where).toMatchObject({
      is_active: true, is_enabled: true, rec_status: 1, tenant_org_id: 'tenant-abc',
    });
  });

  it('NOT_FOUND when no matching promo', async () => {
    mockPromoFindFirst.mockResolvedValue(null);
    const r = await evaluatePromoCode(base);
    expect(r).toMatchObject({ isValid: false, errorCode: 'NOT_FOUND' });
  });

  it('EXPIRED when not yet valid', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ valid_from: new Date(Date.now() + 86_400_000) }));
    const r = await evaluatePromoCode(base);
    expect(r).toMatchObject({ isValid: false, errorCode: 'EXPIRED' });
    expect(r.error).toMatch(/not yet valid/i);
  });

  it('EXPIRED when past valid_to', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ valid_to: new Date(Date.now() - 86_400_000) }));
    const r = await evaluatePromoCode(base);
    expect(r).toMatchObject({ isValid: false, errorCode: 'EXPIRED' });
  });

  it('MAX_USES_EXCEEDED via the current_uses counter', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ max_uses: 10, current_uses: 10 }));
    const r = await evaluatePromoCode(base);
    expect(r).toMatchObject({ isValid: false, errorCode: 'MAX_USES_EXCEEDED' });
  });

  it('MIN_ORDER_NOT_MET when below the minimum', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ min_order_amount: 200 }));
    const r = await evaluatePromoCode({ ...base, orderTotal: 50 });
    expect(r).toMatchObject({ isValid: false, errorCode: 'MIN_ORDER_NOT_MET' });
  });

  it('MAX_ORDER_EXCEEDED when above the maximum (no longer mislabelled MIN)', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ max_order_amount: 80 }));
    const r = await evaluatePromoCode({ ...base, orderTotal: 100 });
    expect(r).toMatchObject({ isValid: false, errorCode: 'MAX_ORDER_EXCEEDED' });
  });

  it('CATEGORY_NOT_APPLICABLE when none of the order categories match', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ applicable_categories: ['DRY_CLEAN'] }));
    const r = await evaluatePromoCode({ ...base, serviceCategories: ['WASH_FOLD'] });
    expect(r).toMatchObject({ isValid: false, errorCode: 'CATEGORY_NOT_APPLICABLE' });
  });

  it('CUSTOMER_LIMIT_EXCEEDED counts only non-voided usages', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromoRow({ max_uses_per_customer: 1 }));
    mockUsageCount.mockResolvedValue(1);
    const r = await evaluatePromoCode({ ...base, customerId: 'cust-1' });
    expect(r).toMatchObject({ isValid: false, errorCode: 'CUSTOMER_LIMIT_EXCEEDED' });
    expect(mockUsageCount.mock.calls[0][0].where).toMatchObject({ voided_at: null, customer_id: 'cust-1' });
  });
});
