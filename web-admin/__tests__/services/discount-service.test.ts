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
    org_promo_codes_mst: { findFirst: jest.fn(), update: jest.fn() },
    org_promo_usage_log: { create: jest.fn(), count: jest.fn() },
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
import { applyPromoCodeTx, getBestDiscount } from '@/lib/services/discount-service';

const mockDiscountRulesFindMany = prisma.org_discount_rules_cf.findMany as jest.Mock;

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
    const buildTxClient = (locked: object[]) => ({
      $queryRaw: jest.fn().mockResolvedValue(locked),
      org_promotion_usage_dtl: { create: jest.fn().mockResolvedValue({}) },
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
      expect((tx.org_promotions_mst.update as jest.Mock).mock.calls[0][0].data.current_uses).toEqual({ increment: 1 });
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
