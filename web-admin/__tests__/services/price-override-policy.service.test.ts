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
