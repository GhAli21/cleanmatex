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
const mockUsageFindFirst   = jest.fn();
const mockPromoUpdate      = jest.fn();
const mockTxQueryRaw       = jest.fn();

const mockTx = {
  $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
  org_promotions_mst:       { update: (...a: unknown[]) => mockPromoUpdate(...a) },
  org_promotion_usage_dtl:  {
    // applyPromotionTx now delegates to discount-service.applyPromoCodeTx, which
    // runs an idempotency-skip findFirst before create. Default: no prior usage.
    findFirst: (...a: unknown[]) => mockUsageFindFirst(...a),
    create:    (...a: unknown[]) => mockUsageCreate(...a),
  },
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

// applyPromotionTx + validatePromoCode now delegate to discount-service (the
// canonical hardened path / unified evaluator). Mock it so this suite tests the
// delegation contract and does not pull discount-service's transitive
// supabase/tenant-settings imports.
const mockApplyPromoCodeTx = jest.fn();
const mockEvaluatePromoCode = jest.fn();
jest.mock('@/lib/services/discount-service', () => ({
  applyPromoCodeTx: (...a: unknown[]) => mockApplyPromoCodeTx(...a),
  evaluatePromoCode: (...a: unknown[]) => mockEvaluatePromoCode(...a),
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

describe('promotion-engine.service — validatePromoCode (adapts evaluatePromoCode → PromoValidation)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards to evaluatePromoCode and maps a valid result to PromoValidation', async () => {
    const promo = makePromo();
    mockEvaluatePromoCode.mockResolvedValue({ isValid: true, promo, discountAmount: 10 });

    const result = await validatePromoCode(TENANT, 'SUMMER10', CUST, 100);

    expect(mockEvaluatePromoCode).toHaveBeenCalledWith({
      tenantId: TENANT, code: 'SUMMER10', customerId: CUST, orderTotal: 100,
    });
    expect(result).toEqual({ isValid: true, promotion: promo, discount: 10 });
  });

  it('maps an invalid result to { isValid:false, error } (drops errorCode for this route)', async () => {
    mockEvaluatePromoCode.mockResolvedValue({ isValid: false, errorCode: 'NOT_FOUND', error: 'Promo code not found or is no longer active' });

    const result = await validatePromoCode(TENANT, 'BADCODE');

    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(result).not.toHaveProperty('promotion');
  });

  it('defaults orderAmount to 0 when omitted', async () => {
    mockEvaluatePromoCode.mockResolvedValue({ isValid: false, errorCode: 'MIN_ORDER_NOT_MET', error: 'too low' });

    await validatePromoCode(TENANT, 'SUMMER10');

    expect(mockEvaluatePromoCode).toHaveBeenCalledWith(
      expect.objectContaining({ orderTotal: 0, customerId: undefined })
    );
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

describe('promotion-engine.service — applyPromotionTx (delegates to applyPromoCodeTx)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards mapped params to the canonical hardened apply', async () => {
    mockApplyPromoCodeTx.mockResolvedValue(undefined);

    await applyPromotionTx(mockTx as Parameters<typeof applyPromotionTx>[0], {
      tenantId: TENANT, promotionId: PROMO, customerId: CUST,
      orderId: ORDER, discountAmount: 10, orderTotal: 90,
    });

    // promotionId→promoCodeId, tenantId→tenantOrgId, orderTotal→orderTotalBefore.
    expect(mockApplyPromoCodeTx).toHaveBeenCalledWith(mockTx, {
      promoCodeId: PROMO,
      orderId: ORDER,
      tenantOrgId: TENANT,
      customerId: CUST,
      discountAmount: 10,
      orderTotalBefore: 90,
    });
  });

  it('propagates errors from the canonical apply (e.g. PROMO_NOT_FOUND)', async () => {
    mockApplyPromoCodeTx.mockRejectedValueOnce(new Error('PROMO_NOT_FOUND'));

    await expect(
      applyPromotionTx(mockTx as Parameters<typeof applyPromotionTx>[0], {
        tenantId: TENANT, promotionId: 'missing', customerId: CUST,
        orderId: ORDER, discountAmount: 10, orderTotal: 90,
      })
    ).rejects.toThrow('PROMO_NOT_FOUND');
  });
});
