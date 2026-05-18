/**
 * Tests: promotion-engine.service
 *
 * Covers:
 * - getAutoApplyPromotions  — returns active auto-apply promotions
 * - validatePromoCode       — valid code returns discount
 * - validatePromoCode       — missing code returns isValid=false
 * - validatePromoCode       — min order amount guard
 * - validatePromoCode       — max_uses exhausted guard
 * - calculatePromotionDiscount — PERCENTAGE, FIXED_AMOUNT, with max cap
 * - applyPromotionTx        — increments usage counter, writes usage row
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPromoFindMany    = jest.fn();
const mockPromoFindFirst   = jest.fn();
const mockUsageCount       = jest.fn();
const mockUsageCreate      = jest.fn();
const mockPromoUpdate      = jest.fn();
const mockTxQueryRaw       = jest.fn();

const mockTx = {
  $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
  org_promotions_mst:       { update: (...a: unknown[]) => mockPromoUpdate(...a) },
  org_promotion_usage_dtl:  { create: (...a: unknown[]) => mockUsageCreate(...a) },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_promotions_mst:     {
      findMany:  (...a: unknown[]) => mockPromoFindMany(...a),
      findFirst: (...a: unknown[]) => mockPromoFindFirst(...a),
    },
    org_promotion_usage_dtl: {
      count:  (...a: unknown[]) => mockUsageCount(...a),
      create: (...a: unknown[]) => mockUsageCreate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  getAutoApplyPromotions,
  validatePromoCode,
  applyPromotionTx,
  calculatePromotionDiscount,
} from '@/lib/services/promotion-engine.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-promo-001';
const CUST   = 'cust-promo-001';
const ORDER  = 'order-promo-001';
const PROMO  = 'promo-001';

const makePromo = (overrides: Record<string, unknown> = {}) => ({
  id:               PROMO,
  tenant_org_id:    TENANT,
  promo_code:       'SUMMER10',
  discount_type:    'PERCENTAGE',
  promo_type:       'PERCENTAGE',
  discount_value:   new Decimal('10'),
  max_discount_amount: null,
  max_uses:         null,
  max_uses_per_customer: null,
  min_order_amount: new Decimal('0'),
  current_uses:     0,
  is_active:        true,
  rec_status:       1,
  valid_from:       new Date(Date.now() - 86400_000),
  valid_to:         null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('promotion-engine.service — getAutoApplyPromotions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns auto-apply promotions', async () => {
    const promos = [makePromo({ promo_code: null })];
    mockPromoFindMany.mockResolvedValue(promos);

    const result = await getAutoApplyPromotions(TENANT, 100);
    expect(result).toBe(promos);
  });
});

describe('promotion-engine.service — validatePromoCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns isValid=true and discount for a valid code', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromo());
    mockUsageCount.mockResolvedValue(0);

    const result = await validatePromoCode(TENANT, 'SUMMER10', CUST, 100);
    expect(result.isValid).toBe(true);
    expect(result.discount).toBeGreaterThan(0);
  });

  it('returns isValid=false when promo not found or expired', async () => {
    mockPromoFindFirst.mockResolvedValue(null);

    const result = await validatePromoCode(TENANT, 'BADCODE');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns isValid=false when min order amount not met', async () => {
    mockPromoFindFirst.mockResolvedValue(
      makePromo({ min_order_amount: new Decimal('200') })
    );

    const result = await validatePromoCode(TENANT, 'SUMMER10', CUST, 50);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/minimum/i);
  });

  it('returns isValid=false when global max_uses is exhausted', async () => {
    mockPromoFindFirst.mockResolvedValue(makePromo({ max_uses: 10 }));
    mockUsageCount.mockResolvedValue(10);

    const result = await validatePromoCode(TENANT, 'SUMMER10', CUST, 100);
    expect(result.isValid).toBe(false);
  });
});

describe('promotion-engine.service — calculatePromotionDiscount', () => {
  it('computes PERCENTAGE discount', () => {
    const promo = { discount_value: new Decimal('20'), max_discount_amount: null };
    const result = calculatePromotionDiscount('PERCENTAGE', promo, 100);
    expect(result).toBeCloseTo(20);
  });

  it('caps PERCENTAGE discount at max_discount_amount', () => {
    const promo = { discount_value: new Decimal('50'), max_discount_amount: new Decimal('10') };
    const result = calculatePromotionDiscount('PERCENTAGE', promo, 100);
    expect(result).toBe(10); // capped
  });

  it('computes FIXED_AMOUNT discount', () => {
    const promo = { discount_value: new Decimal('15'), max_discount_amount: null };
    const result = calculatePromotionDiscount('FIXED_AMOUNT', promo, 50);
    expect(result).toBe(15);
  });

  it('caps FIXED_AMOUNT at order amount', () => {
    const promo = { discount_value: new Decimal('100'), max_discount_amount: null };
    const result = calculatePromotionDiscount('FIXED_AMOUNT', promo, 30);
    expect(result).toBe(30); // can't exceed order total
  });

  it('returns 0 for BUY_X_GET_Y (item-level logic)', () => {
    const promo = { discount_value: new Decimal('10'), max_discount_amount: null };
    const result = calculatePromotionDiscount('BUY_X_GET_Y', promo, 100);
    expect(result).toBe(0);
  });
});

describe('promotion-engine.service — applyPromotionTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments usage counter and writes usage row', async () => {
    mockTxQueryRaw.mockResolvedValue([{ id: PROMO, current_uses: 5 }]);
    mockPromoUpdate.mockResolvedValue({});
    mockUsageCreate.mockResolvedValue({ id: 'usage-1' });

    await applyPromotionTx(mockTx as Parameters<typeof applyPromotionTx>[0], {
      tenantId: TENANT, promotionId: PROMO, customerId: CUST,
      orderId: ORDER, discountAmount: 10, orderTotal: 90,
    });

    expect(mockPromoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ current_uses: { increment: 1 } }) })
    );
    expect(mockUsageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ promo_code_id: PROMO, order_id: ORDER, discount_amount: 10 }),
      })
    );
  });

  it('throws when promotion row not found', async () => {
    mockTxQueryRaw.mockResolvedValue([]); // no rows returned

    await expect(
      applyPromotionTx(mockTx as Parameters<typeof applyPromotionTx>[0], {
        tenantId: TENANT, promotionId: 'missing', customerId: CUST,
        orderId: ORDER, discountAmount: 10, orderTotal: 90,
      })
    ).rejects.toThrow(/not found/i);
  });
});
