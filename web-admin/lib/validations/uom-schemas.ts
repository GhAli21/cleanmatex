/**
 * Zod schemas for the UoM routes and the measure fields of order lines
 * (PLAN §3.8). Quantities and rates are decimal strings so no precision is lost;
 * the rules mirror the database CHECKs and triggers (0813–0815), which stay the
 * last line of defence.
 */
import { z } from 'zod';
import {
  UOM_CODE_PATTERN,
  UOM_DIMENSIONS,
  UOM_MAX_QTY_DECIMALS,
  UOM_RATE_RECIPROCAL_TOLERANCE,
  UOM_UNECE_PATTERN,
} from '@/lib/constants/uom';
import { areRatesReciprocal } from '@/lib/uom/convert';

/** A decimal as text: digits with an optional fraction; the sign is not allowed. */
const decimalText = (label: string, maxDecimals: number) =>
  z.string().trim().regex(/^\d+(\.\d+)?$/, `${label} must be a positive number`)
    .refine((v) => (v.split('.')[1] ?? '').length <= maxDecimals, `${label} allows at most ${maxDecimals} decimals`);

/** A strictly positive decimal text (> 0). */
const positiveDecimalText = (label: string, maxDecimals: number) =>
  decimalText(label, maxDecimals).refine((v) => Number(v) > 0, `${label} must be greater than zero`);

/** A unit code: upper case, starts with a letter, max 20 (CHECK ck_ouom_code). */
export const uomCodeSchema = z.string().trim().regex(UOM_CODE_PATTERN, 'Use capital letters, digits and _ (max 20), starting with a letter');

/** A unit dimension. */
export const uomDimensionSchema = z.enum(Object.values(UOM_DIMENSIONS) as [string, ...string[]]);

/** Presentation fields a tenant may edit on any unit. */
const unitPresentation = {
  name: z.string().trim().min(1).max(120),
  name2: z.string().trim().max(120).nullable().optional(),
  symbol: z.string().trim().min(1).max(20),
  symbol2: z.string().trim().max(20).nullable().optional(),
  qtyDecimals: z.number().int().min(0).max(UOM_MAX_QTY_DECIMALS),
  displayOrder: z.number().int().min(0).max(100000).nullable().optional(),
};

/** POST /api/v1/uom/units — a new custom unit. */
export const createCustomUnitSchema = z.object({
  kind: z.literal('custom'),
  code: uomCodeSchema,
  dimension: uomDimensionSchema,
  isPackaging: z.boolean().default(false),
  uneceCode: z.string().trim().regex(UOM_UNECE_PATTERN, 'UN/ECE code is 2–3 capital letters or digits').nullable().optional(),
  ...unitPresentation,
}).refine((v) => v.dimension !== UOM_DIMENSIONS.COUNT || v.qtyDecimals === 0, {
  path: ['qtyDecimals'], message: 'A count unit is always whole (0 decimals)',
});

/** POST /api/v1/uom/units — add system units to the Organization ("Add from system catalog"). */
export const addSystemUnitsSchema = z.object({
  kind: z.literal('system'),
  codes: z.array(uomCodeSchema).min(1).max(50),
});

/** POST /api/v1/uom/units body. */
export const createUnitSchema = z.union([createCustomUnitSchema, addSystemUnitsSchema]);

/** PATCH /api/v1/uom/units/[code] — presentation fields and the on/off switch only. */
export const updateUnitSchema = z.object({
  name: unitPresentation.name.optional(),
  name2: unitPresentation.name2,
  symbol: unitPresentation.symbol.optional(),
  symbol2: unitPresentation.symbol2,
  qtyDecimals: unitPresentation.qtyDecimals.optional(),
  displayOrder: unitPresentation.displayOrder,
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to change');

/** Create / update a conversion (the "Define UOM Conversion" screen). */
export const conversionSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  fromCode: uomCodeSchema,
  toCode: uomCodeSchema,
  multiplyRate: positiveDecimalText('Multiply rate', 12),
  divideRate: positiveDecimalText('Divide rate', 12),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((v) => v.fromCode !== v.toCode, { path: ['toCode'], message: 'Choose a different unit' })
  .refine((v) => areRatesReciprocal(v.multiplyRate, v.divideRate, UOM_RATE_RECIPROCAL_TOLERANCE), {
    path: ['divideRate'], message: 'Multiply rate × divide rate must be 1 (within 0.000001)',
  });

/** PATCH /api/v1/uom/conversions/[id] — rates, on/off, notes (the pair is immutable). */
export const updateConversionSchema = z.object({
  multiplyRate: positiveDecimalText('Multiply rate', 12),
  divideRate: positiveDecimalText('Divide rate', 12),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((v) => areRatesReciprocal(v.multiplyRate, v.divideRate, UOM_RATE_RECIPROCAL_TOLERANCE), {
  path: ['divideRate'], message: 'Multiply rate × divide rate must be 1 (within 0.000001)',
});

/** POST /api/v1/uom/convert — conversion preview. */
export const convertPreviewSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  quantity: decimalText('Quantity', 6),
  fromCode: uomCodeSchema,
  toCode: uomCodeSchema,
});

/**
 * The measure fields staff enter for a measured order line. The server computes
 * the billed quantity; the client only previews it (never sends it).
 */
export const lineMeasureSchema = z.object({
  /** KG, M, L … (any non-area measured unit). */
  measuredQty: positiveDecimalText('Measure', 6).optional(),
  /** Area units: metres. */
  length: positiveDecimalText('Length', 6).optional(),
  width: positiveDecimalText('Width', 6).optional(),
}).refine((v) => (v.length == null) === (v.width == null), {
  path: ['width'], message: 'Enter both length and width',
}).refine((v) => v.measuredQty == null || (v.length == null && v.width == null), {
  path: ['measuredQty'], message: 'Enter either a measure or length × width, not both',
});

/** Optional product measure settings (decimal text; empty = none). */
export const productMeasureSettingsSchema = z.object({
  minBillableQty: positiveDecimalText('Minimum billable', 6).nullable().optional(),
  billingIncrement: positiveDecimalText('Billing step', 6).nullable().optional(),
});

/** Types inferred from the schemas. */
export type CreateCustomUnitInput = z.infer<typeof createCustomUnitSchema>;
export type AddSystemUnitsInput = z.infer<typeof addSystemUnitsSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ConversionInput = z.infer<typeof conversionSchema>;
export type ConvertPreviewInput = z.infer<typeof convertPreviewSchema>;
export type LineMeasureInput = z.infer<typeof lineMeasureSchema>;
