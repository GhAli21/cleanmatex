/**
 * Line-Level P7-03: tax profile rounding fields are validated at the boundary
 * against the DB values and mapped to their columns only when sent.
 */
import { taxProfileRoundingColumns, taxProfileRoundingSchema } from '@/lib/validations/tax-profile-rounding-schema';

describe('taxProfileRoundingSchema', () => {
  it('accepts the DB codes and nulls (currency default)', () => {
    expect(taxProfileRoundingSchema.safeParse({ roundingLevel: 'LINE', roundingMode: 'HALF_EVEN', outputDecimalPlaces: 3, roundingIncrementMinor: 5 }).success).toBe(true);
    expect(taxProfileRoundingSchema.safeParse({ roundingMode: null, outputDecimalPlaces: null, roundingIncrementMinor: null }).success).toBe(true);
    expect(taxProfileRoundingSchema.safeParse({}).success).toBe(true);
  });

  it('refuses unknown levels and modes, negative or fractional numbers, a zero increment', () => {
    for (const bad of [{ roundingLevel: 'ORDER' }, { roundingMode: 'BANKERS' }, { outputDecimalPlaces: -1 }, { outputDecimalPlaces: 2.5 }, { roundingIncrementMinor: 0 }]) {
      expect([bad, taxProfileRoundingSchema.safeParse(bad).success]).toEqual([bad, false]);
    }
  });

  it('maps only the fields that were sent', () => {
    expect(taxProfileRoundingColumns({ roundingLevel: 'DOCUMENT', roundingMode: null })).toEqual({ rounding_level: 'DOCUMENT', rounding_mode: null });
    expect(taxProfileRoundingColumns({})).toEqual({});
  });
});
