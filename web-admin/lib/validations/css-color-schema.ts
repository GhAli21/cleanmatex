/**
 * Shared Zod fields for `#RRGGBB` / `#RGB` tenant color overrides.
 */
import { z } from 'zod';
import { COLOR_HEX_DB_MAX_LENGTH, CSS_HEX_INPUT_PATTERN } from '@/lib/constants/css-color';

/** Empty string clears override (parity with modal "clear"). */
export const zOptionalNormalizedHexIngress = z.preprocess(
  (raw) => (raw === '' ? null : raw),
  z
    .union([z.null(), z.string().regex(CSS_HEX_INPUT_PATTERN).max(COLOR_HEX_DB_MAX_LENGTH)])
    .optional()
).optional();
