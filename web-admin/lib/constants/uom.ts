/**
 * Unit of Measure constants — mirror the database exactly (migrations 0813–0815).
 *
 * Why: units, dimensions and the error-code prefixes the UoM triggers raise are
 * shared by the calculator, services, routes and screens. Values must match the
 * CHECK constraints and RAISE messages character for character (CLAUDE.md rule #9).
 * Docs: docs/features/Measured_Pricing/PLAN.md §3.2–§3.6a.
 */

/** `sys_uom_cd.uom_dimension` / `org_uom_cf.uom_dimension` (CHECK ck_suom_dimension). */
export const UOM_DIMENSIONS = {
  COUNT: 'COUNT',
  MASS: 'MASS',
  LENGTH: 'LENGTH',
  AREA: 'AREA',
  VOLUME: 'VOLUME',
  TIME: 'TIME',
} as const;
/** Derived union of unit dimensions. */
export type UomDimension = (typeof UOM_DIMENSIONS)[keyof typeof UOM_DIMENSIONS];

/** Dimensions in picker / grouping order. */
export const UOM_DIMENSION_ORDER: readonly UomDimension[] = [
  UOM_DIMENSIONS.COUNT,
  UOM_DIMENSIONS.MASS,
  UOM_DIMENSIONS.LENGTH,
  UOM_DIMENSIONS.AREA,
  UOM_DIMENSIONS.VOLUME,
  UOM_DIMENSIONS.TIME,
];

/**
 * The seeded system base units (one per dimension, `is_base_unit`). Code that
 * needs "the base of a dimension" must read it from the Organization's units;
 * these are for fallbacks and tests only.
 */
export const UOM_SYSTEM_BASE_UNITS: Readonly<Record<UomDimension, string>> = {
  COUNT: 'PC',
  MASS: 'KG',
  LENGTH: 'M',
  AREA: 'SQM',
  VOLUME: 'L',
  TIME: 'HR',
};

/**
 * The area units a product can be priced in, each with the length unit its length and width are typed and
 * stored in (area = length × width in that unit). Mirrors the guards of migration 0859. Any other area
 * unit, a custom one included, has no side unit and cannot price a product.
 */
export const UOM_AREA_SIDE_UNITS: Readonly<Record<string, string>> = {
  SQM: 'M',
  SQFT: 'FT',
};

/**
 * @param areaUnitCode an area unit
 * @returns the unit its length and width are measured in, or undefined when it cannot be measured
 * @example areaSideUnit('SQFT'); // 'FT'
 */
export function areaSideUnit(areaUnitCode: string | null | undefined): string | undefined {
  return areaUnitCode ? UOM_AREA_SIDE_UNITS[areaUnitCode] : undefined;
}

/**
 * @param unit an Organization unit
 * @returns whether a product may be priced in it (every unit but an area unit without a side unit)
 */
export function canBeProductUnit(unit: { code: string; dimension: string }): boolean {
  return unit.dimension !== UOM_DIMENSIONS.AREA || areaSideUnit(unit.code) !== undefined;
}

/** Unit of a line with no product (a custom item): one piece (0814 fn_uom_item_snapshot). */
export const UOM_DEFAULT_COUNT_CODE = 'PC';

/** Unit code format (CHECK ck_suom_code / ck_ouom_code). */
export const UOM_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,19}$/;

/** UN/ECE Rec 20 code format (CHECK ck_suom_unece). */
export const UOM_UNECE_PATTERN = /^[A-Z0-9]{2,3}$/;

/** Largest `qty_decimals` a unit may have (CHECK ck_suom_decimals). */
export const UOM_MAX_QTY_DECIMALS = 6;

/** Decimals of the QUANTITY precision class, DECIMAL(21,6) (docs/dev/rules/numeric-precision.md). */
export const QUANTITY_DECIMALS = 6;

/** Decimals of the UNIT_PRICE precision class, DECIMAL(21,6). */
export const UNIT_PRICE_DECIMALS = 6;

/** Decimals of the RATE precision class, DECIMAL(28,12). */
export const RATE_DECIMALS = 12;

/** Allowed difference of `multiply_rate × divide_rate` from 1 (CHECK ck_suomc_rates / ck_ouomc_rates). */
export const UOM_RATE_RECIPROCAL_TOLERANCE = '0.000001';

/**
 * Codes the UoM triggers and functions put at the start of their error message
 * (`'<CODE>: …'`), plus the measure codes the order services raise. Services map
 * each to `uom.errors.<CODE>` (EN/AR).
 */
export const UOM_ERROR_CODES = {
  /** A custom unit code equals a system code (fn_uom_org_unit_guard). */
  UOM_CODE_RESERVED: 'UOM_CODE_RESERVED',
  /** HQ: a new system code is a custom code in some Organization (fn_uom_sys_unit_guard). */
  UOM_CODE_IN_USE_BY_TENANTS: 'UOM_CODE_IN_USE_BY_TENANTS',
  /** A locked or immutable field was changed. */
  UOM_FIELD_LOCKED: 'UOM_FIELD_LOCKED',
  /** A custom physical unit has no conversion to its base unit (deferred check). */
  UOM_BASE_CONV_REQUIRED: 'UOM_BASE_CONV_REQUIRED',
  /** An Organization-wide conversion joins two dimensions. */
  UOM_CONV_DIMENSION: 'UOM_CONV_DIMENSION',
  /** An Organization-wide conversion uses a packaging unit. */
  UOM_CONV_PACKAGING: 'UOM_CONV_PACKAGING',
  /** The unit does not exist (in this Organization, or as an active system unit). */
  UOM_NOT_FOUND: 'UOM_NOT_FOUND',
  /** The unit is switched off for this Organization. */
  UOM_INACTIVE: 'UOM_INACTIVE',
  /** The unit is used by live products and cannot be switched off. */
  UOM_IN_USE: 'UOM_IN_USE',
  /** No conversion path between two units. */
  UOM_CONVERSION_MISSING: 'UOM_CONVERSION_MISSING',
  /** A conversion into a count unit is not a whole number. */
  UOM_QTY_NOT_WHOLE: 'UOM_QTY_NOT_WHOLE',
  /** A quantity has more decimals than its unit allows. */
  UOM_QTY_SCALE: 'UOM_QTY_SCALE',
  /** A FIXED price on a measured unit. */
  UOM_FIXED_PRICE_MEASURED: 'UOM_FIXED_PRICE_MEASURED',
  /** A measured line has no measure where one is required (commit, retail stock). */
  MEASURE_REQUIRED: 'MEASURE_REQUIRED',
  /** A measure, minimum or billing step on a count unit. */
  MEASURE_NOT_ALLOWED: 'MEASURE_NOT_ALLOWED',
  /** An area unit without a side unit cannot price a product (0859). */
  UOM_AREA_UNSUPPORTED: 'UOM_AREA_UNSUPPORTED',
  /** Application: the Organization already has a unit with this code. */
  UOM_CODE_EXISTS: 'UOM_CODE_EXISTS',
  /** Application: this pair already has a conversion (in either direction). */
  UOM_CONV_EXISTS: 'UOM_CONV_EXISTS',
  /** Application: a conversion copied from the system catalog is switched off, never deleted. */
  UOM_CONV_SYSTEM: 'UOM_CONV_SYSTEM',
} as const;
/** Derived union of UoM error codes. */
export type UomErrorCode = (typeof UOM_ERROR_CODES)[keyof typeof UOM_ERROR_CODES];

/**
 * Reads the UoM code at the start of a database error message ("UOM_IN_USE: unit KG …").
 * @param message the raw error message
 * @returns the code, or null when the message is not a UoM rule error
 * @example
 * parseUomErrorCode('UOM_IN_USE: unit KG is used by 3 product(s)'); // 'UOM_IN_USE'
 */
export function parseUomErrorCode(message: string | null | undefined): UomErrorCode | null {
  const match = /\b(UOM_[A-Z_]+|MEASURE_[A-Z_]+):/.exec(message ?? '');
  if (!match) return null;
  const code = match[1] as UomErrorCode;
  return (Object.values(UOM_ERROR_CODES) as string[]).includes(code) ? code : null;
}
