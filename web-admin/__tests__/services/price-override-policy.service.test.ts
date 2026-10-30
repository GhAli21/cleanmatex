/**
 * Tests: lib/services/price-override-policy.service.ts — PF-01
 *
 * A line price override needs `pricing:override`; at submit it also needs a
 * reason. Lines without an override never trigger a permission check.
 */

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: jest.fn(),
}));

import {
  PriceOverrideError,
  assertOrderDiscountAllowed,
  assertPriceOverridesAllowed,
  hasPriceOverride,
} from '@/lib/services/price-override-policy.service';

const allow = jest.fn(async () => true);
const deny = jest.fn(async () => false);

describe('price override policy (PF-01)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats 0 as an override and null/undefined as none', () => {
    expect(hasPriceOverride({ priceOverride: 0 })).toBe(true);
    expect(hasPriceOverride({ priceOverride: null })).toBe(false);
    expect(hasPriceOverride({})).toBe(false);
  });

  it('does not check permission when no line is overridden', async () => {
    await expect(
      assertPriceOverridesAllowed([{ priceOverride: null }, {}], { requireReason: true, hasPermission: deny }),
    ).resolves.toBeUndefined();
    expect(deny).not.toHaveBeenCalled();
  });

  it('rejects an override without pricing:override (403) and names the lines', async () => {
    const promise = assertPriceOverridesAllowed(
      [{}, { priceOverride: 1, overrideReason: 'Customer agreed price' }],
      { requireReason: true, hasPermission: deny },
    );

    await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
    await promise.catch((error: PriceOverrideError) => {
      expect(error.code).toBe('PRICE_OVERRIDE_NOT_PERMITTED');
      expect(error.httpStatus).toBe(403);
      expect(error.lineIndexes).toEqual([1]);
    });
    expect(deny).toHaveBeenCalledWith('pricing:override');
  });

  it('requires a non-blank reason at submit (400)', async () => {
    const promise = assertPriceOverridesAllowed(
      [{ priceOverride: 5, overrideReason: '   ' }],
      { requireReason: true, hasPermission: allow },
    );

    await promise.catch((error: PriceOverrideError) => {
      expect(error.code).toBe('PRICE_OVERRIDE_REASON_REQUIRED');
      expect(error.httpStatus).toBe(400);
      expect(error.lineIndexes).toEqual([0]);
    });
    await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
  });

  it('allows a permitted override without a reason in preview mode', async () => {
    await expect(
      assertPriceOverridesAllowed([{ priceOverride: 5 }], { requireReason: false, hasPermission: allow }),
    ).resolves.toBeUndefined();
  });

  it('allows a permitted override with a reason at submit', async () => {
    await expect(
      assertPriceOverridesAllowed(
        [{ priceOverride: 5, overrideReason: 'Damaged item goodwill' }],
        { requireReason: true, hasPermission: allow },
      ),
    ).resolves.toBeUndefined();
  });
});

describe('line discount policy (P5-03c)', () => {
  const byCode = (granted: string[]) => jest.fn(async (code: string) => granted.includes(code));
  const discount = (reason?: string) => ({ lineDiscount: { reason } });

  it('needs orders:discount (403) and names the lines; an override is checked separately', async () => {
    const hasPermission = byCode(['pricing:override']);
    const promise = assertPriceOverridesAllowed([{}, discount('Loyal customer')], { requireReason: false, hasPermission });
    await promise.catch((error: PriceOverrideError) => {
      expect([error.code, error.httpStatus, error.lineIndexes]).toEqual(['LINE_DISCOUNT_NOT_PERMITTED', 403, [1]]);
    });
    await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
    expect(hasPermission).toHaveBeenCalledWith('orders:discount');
  });

  it('requires the reason at submit only (400)', async () => {
    const hasPermission = byCode(['orders:discount']);
    await expect(assertPriceOverridesAllowed([discount()], { requireReason: false, hasPermission })).resolves.toBeUndefined();
    const promise = assertPriceOverridesAllowed([discount('  ')], { requireReason: true, hasPermission });
    await promise.catch((error: PriceOverrideError) => {
      expect([error.code, error.httpStatus]).toEqual(['LINE_DISCOUNT_REASON_REQUIRED', 400]);
    });
    await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
  });

  it('a line without a discount never asks for orders:discount', async () => {
    const hasPermission = byCode([]);
    await expect(assertPriceOverridesAllowed([{ lineDiscount: null }, {}], { requireReason: true, hasPermission })).resolves.toBeUndefined();
    expect(hasPermission).not.toHaveBeenCalled();
  });
});

describe('order manual discount policy (owner decision 2026-10-28)', () => {
  it('a percent or amount needs orders:discount (403)', async () => {
    for (const request of [{ percentDiscount: 10 }, { amountDiscount: 0.5 }]) {
      const hasPermission = jest.fn(async () => false);
      const promise = assertOrderDiscountAllowed(request, { hasPermission });
      await promise.catch((error: PriceOverrideError) => {
        expect([error.code, error.httpStatus]).toEqual(['ORDER_DISCOUNT_NOT_PERMITTED', 403]);
      });
      await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
      expect(hasPermission).toHaveBeenCalledWith('orders:discount');
    }
  });

  it('no manual discount, no check; with the permission it passes', async () => {
    const deny = jest.fn(async () => false);
    await expect(assertOrderDiscountAllowed({ percentDiscount: 0, amountDiscount: 0 }, { hasPermission: deny })).resolves.toBeUndefined();
    expect(deny).not.toHaveBeenCalled();
    await expect(assertOrderDiscountAllowed({ percentDiscount: 5 }, { hasPermission: async () => true })).resolves.toBeUndefined();
  });
});

describe('custom item price (P5-03e)', () => {
  it('needs pricing:override (403); its name stands for the reason', async () => {
    const deny = jest.fn(async () => false);
    const promise = assertPriceOverridesAllowed([{}, { customItem: { name: 'Rug' } }], { requireReason: true, hasPermission: deny });
    await promise.catch((error: PriceOverrideError) => {
      expect([error.code, error.lineIndexes]).toEqual(['PRICE_OVERRIDE_NOT_PERMITTED', [1]]);
    });
    await expect(promise).rejects.toBeInstanceOf(PriceOverrideError);
    await expect(assertPriceOverridesAllowed([{ customItem: { name: 'Rug' } }], { requireReason: true, hasPermission: async () => true }))
      .resolves.toBeUndefined();
  });
});
