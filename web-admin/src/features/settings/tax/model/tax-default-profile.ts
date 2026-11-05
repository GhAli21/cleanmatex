/** The profile fields the default-profile check reads. */
export interface DefaultProfileCandidate {
  is_active: boolean;
  is_default: boolean;
  applies_to: string[] | null;
  effective_from: string | null;
  effective_to: string | null;
}

/**
 * True when an active, general (no supply code) default profile is in effect
 * on `today`. Tax comes from tax profiles only (P6-03): without one, new
 * orders carry no tax, so Tax Setup warns.
 * @param profiles the tenant's tax profiles (ISO date strings)
 * @param today the business date, `YYYY-MM-DD`
 * @returns whether a default profile applies
 * @example hasDefaultTaxProfile(profiles, '2026-10-30') // true
 */
export function hasDefaultTaxProfile(profiles: readonly DefaultProfileCandidate[], today: string): boolean {
  return profiles.some((p) => p.is_active && p.is_default && (!p.applies_to || p.applies_to.length === 0)
    && (!p.effective_from || p.effective_from.slice(0, 10) <= today)
    && (!p.effective_to || p.effective_to.slice(0, 10) >= today));
}
