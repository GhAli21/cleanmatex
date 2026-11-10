import { randomUUID } from 'crypto'

/**
 * Required tax code columns for a profile made in the old "Tax Profiles" editor.
 * shortcut: the old editor stays until the order engine moves to rules in T4, then this goes with it.
 * @param rate - The profile's rate
 * @returns The generated code and its category
 */
export function legacyTaxProfileIdentity(rate: number) {
  return {
    tax_code: `LEGACY_${randomUUID().slice(0, 8).toUpperCase()}`,
    tax_category_code: rate > 0 ? 'STANDARD' : 'ZERO_RATED',
  }
}
