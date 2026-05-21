import { z } from 'zod';

/**
 * Converts blank form strings into null so tenant overrides can intentionally
 * clear optional translated fields without sending meaningless empty strings.
 */
const nullableTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}, z.string().max(250).nullable().optional());

/**
 * The display order is optional because some tenants may prefer alphabetical
 * fallback ordering and intentionally leave the override unset.
 */
const nullableOrder = z.preprocess((value) => {
  if (value === '' || value === undefined) return null;
  return value;
}, z.number().int().nonnegative().nullable().optional());

/** Card brand overrides intentionally exclude card_brand_code because HQ owns it. */
export const updateCardBrandConfigSchema = z.object({
  name: z.string().trim().min(1).max(250),
  name2: nullableTrimmedString,
  description: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().nullable().optional()),
  description2: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().nullable().optional()),
  rec_order: nullableOrder,
});

export type UpdateCardBrandConfigFormInput = z.input<typeof updateCardBrandConfigSchema>;
export type UpdateCardBrandConfigFormValues = z.output<typeof updateCardBrandConfigSchema>;
