/**
 * Tax profile rounding fields (Line-Level P7-03, M4 `0642_tax_profile_rounding.sql`).
 * One schema for the server actions, the API routes and the form. Values mirror
 * the DB: `rounding_level` CHECK (`TAX_ROUNDING_LEVELS`), `rounding_mode` FK to
 * `sys_rounding_mode_cd` (`CURRENCY_ROUNDING_MODES`). Null output decimals or
 * increment mean "use the currency's own".
 */
import { z } from 'zod';

import { TAX_ROUNDING_LEVELS } from '@/lib/constants/commercial';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';

const levels = Object.values(TAX_ROUNDING_LEVELS) as [string, ...string[]];
const modes = Object.values(CURRENCY_ROUNDING_MODES) as [string, ...string[]];

/** The rounding part of a tax profile create/update request (camelCase, all optional). */
export const taxProfileRoundingSchema = z.object({
  roundingLevel: z.enum(levels).optional(),
  roundingMode: z.enum(modes).nullable().optional(),
  // A currency has at most 4 minor-unit decimals in practice; 6 leaves room without allowing nonsense.
  outputDecimalPlaces: z.number().int().min(0).max(6).nullable().optional(),
  roundingIncrementMinor: z.number().int().min(1).max(1000).nullable().optional(),
});
export type TaxProfileRoundingInput = z.infer<typeof taxProfileRoundingSchema>;

/**
 * The DB columns for the fields that were sent (absent fields are left unchanged).
 * @param input - validated rounding input
 */
export function taxProfileRoundingColumns(input: TaxProfileRoundingInput) {
  return {
    ...(input.roundingLevel !== undefined && { rounding_level: input.roundingLevel }),
    ...(input.roundingMode !== undefined && { rounding_mode: input.roundingMode }),
    ...(input.outputDecimalPlaces !== undefined && { output_decimal_places: input.outputDecimalPlaces }),
    ...(input.roundingIncrementMinor !== undefined && { rounding_increment_minor: input.roundingIncrementMinor }),
  };
}
