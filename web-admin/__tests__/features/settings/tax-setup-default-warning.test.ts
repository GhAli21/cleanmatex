/**
 * P6-03: tax comes from tax profiles only, so Tax Setup warns when no active,
 * effective, general default profile exists (new orders would carry no tax).
 */
import { hasDefaultTaxProfile, type DefaultProfileCandidate } from '@features/settings/tax/model/tax-default-profile';

const TODAY = '2026-10-30';
const profile = (overrides: Partial<DefaultProfileCandidate> = {}): DefaultProfileCandidate => ({
  is_active: true, is_default: true, applies_to: [], effective_from: '2024-01-01T00:00:00.000Z', effective_to: null, ...overrides,
});

describe('Tax Setup: default tax profile check (P6-03)', () => {
  it('finds an active general default profile in effect', () => {
    expect(hasDefaultTaxProfile([profile()], TODAY)).toBe(true);
    expect(hasDefaultTaxProfile([profile({ applies_to: null, effective_to: '2026-10-30' })], TODAY)).toBe(true);
  });

  it('warns with no profile, a supply-code profile, an inactive, a non-default, a future or an expired one', () => {
    expect(hasDefaultTaxProfile([], TODAY)).toBe(false);
    for (const p of [
      profile({ applies_to: ['EXPORT'] }), profile({ is_active: false }), profile({ is_default: false }),
      profile({ effective_from: '2026-11-01' }), profile({ effective_to: '2026-10-29' }),
    ]) expect(hasDefaultTaxProfile([p], TODAY)).toBe(false);
  });
});
