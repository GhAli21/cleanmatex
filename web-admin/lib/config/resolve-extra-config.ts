/**
 * Pure, dependency-free Extra Tenant Configuration validator and resolver.
 * Safe for both server services and unit tests without DB connectivity.
 *
 * @module lib/config/resolve-extra-config
 */

import {
  DEFAULT_RESOLVED_EXTRA_CONFIG,
  EXTRA_CONFIG_KEYS,
  EXTRA_CONFIG_PAGE_SIZES,
  EXTRA_CONFIG_VALUE_TYPES,
  NUMBER_GROUPING_LOCALES,
  NUMBER_SCRIPTS,
  POS_STEPPER_MIN_TARGETS,
  TABLE_DENSITY_OVERRIDES,
  type NumberGroupingLocale,
  type NumberScript,
  type PosStepperMinTarget,
  type TableDensityOverride,
} from '@/lib/constants/tenant-extra-config';
import type {
  ExtraConfigItemView,
  ExtraConfigOption,
  OrgExtraConfigOverride,
  ResolvedExtraConfig,
  SysExtraConfigRow,
} from '@/lib/types/tenant-extra-config';

/** Validation error codes returned by {@link validateExtraConfigValue}. */
export type ExtraConfigValidationCode =
  | 'INACTIVE_KEY'
  | 'NOT_EDITABLE'
  | 'INVALID_OPTION'
  | 'INVALID_BOOLEAN'
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE'
  | 'PATTERN_MISMATCH'
  | 'VALUE_EMPTY';

export type ExtraConfigValidationResult =
  | { valid: true; normalizedValue: string }
  | { valid: false; code: ExtraConfigValidationCode; message: string };

/** Safely parse `allowed_values_json` from JSONB into normalized options. */
export function parseExtraConfigOptions(raw: unknown): ExtraConfigOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ExtraConfigOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.value !== 'string' || typeof obj.label !== 'string') continue;
    options.push({
      value: obj.value,
      label: obj.label,
      label2: typeof obj.label2 === 'string' && obj.label2.length > 0 ? obj.label2 : obj.label,
      description: typeof obj.description === 'string' ? obj.description : null,
      description2: typeof obj.description2 === 'string' ? obj.description2 : null,
    });
  }
  return options;
}

/**
 * Validate a candidate string value against a catalog row's `value_type`,
 * curated `allowed_values_json` list, numeric bounds, and regex constraints.
 */
export function validateExtraConfigValue(
  catalogRow: SysExtraConfigRow,
  rawValue: string
): ExtraConfigValidationResult {
  if (!catalogRow.is_active || catalogRow.rec_status !== 1) {
    return { valid: false, code: 'INACTIVE_KEY', message: 'Configuration key is inactive.' };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { valid: false, code: 'VALUE_EMPTY', message: 'Configuration value cannot be empty.' };
  }

  const options = parseExtraConfigOptions(catalogRow.allowed_values_json);

  switch (catalogRow.value_type) {
    case EXTRA_CONFIG_VALUE_TYPES.BOOLEAN: {
      const upper = trimmed.toUpperCase();
      if (upper !== 'TRUE' && upper !== 'FALSE') {
        return {
          valid: false,
          code: 'INVALID_BOOLEAN',
          message: 'Value must be TRUE or FALSE.',
        };
      }
      if (options.length > 0 && !options.some((opt) => opt.value === upper)) {
        return {
          valid: false,
          code: 'INVALID_OPTION',
          message: 'Value is not in the allowed list.',
        };
      }
      return { valid: true, normalizedValue: upper };
    }

    case EXTRA_CONFIG_VALUE_TYPES.SELECT: {
      if (options.length > 0 && !options.some((opt) => opt.value === trimmed)) {
        return {
          valid: false,
          code: 'INVALID_OPTION',
          message: 'Selected value is not in the curated option list.',
        };
      }
      return { valid: true, normalizedValue: trimmed };
    }

    case EXTRA_CONFIG_VALUE_TYPES.NUMBER: {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return { valid: false, code: 'INVALID_NUMBER', message: 'Value must be a valid number.' };
      }
      if (catalogRow.min_num !== null && parsed < Number(catalogRow.min_num)) {
        return {
          valid: false,
          code: 'OUT_OF_RANGE',
          message: `Value must be at least ${catalogRow.min_num}.`,
        };
      }
      if (catalogRow.max_num !== null && parsed > Number(catalogRow.max_num)) {
        return {
          valid: false,
          code: 'OUT_OF_RANGE',
          message: `Value must be at most ${catalogRow.max_num}.`,
        };
      }
      if (options.length > 0 && !options.some((opt) => Number(opt.value) === parsed || opt.value === trimmed)) {
        return {
          valid: false,
          code: 'INVALID_OPTION',
          message: 'Number is not one of the allowed choices.',
        };
      }
      return { valid: true, normalizedValue: String(parsed) };
    }

    case EXTRA_CONFIG_VALUE_TYPES.TEXT:
    default: {
      if (options.length > 0 && !options.some((opt) => opt.value === trimmed)) {
        return {
          valid: false,
          code: 'INVALID_OPTION',
          message: 'Value is not in the curated option list.',
        };
      }
      if (catalogRow.validation_regex) {
        try {
          const rx = new RegExp(catalogRow.validation_regex);
          if (!rx.test(trimmed)) {
            return {
              valid: false,
              code: 'PATTERN_MISMATCH',
              message: 'Value does not match the required pattern.',
            };
          }
        } catch {
          // Malformed regex in DB catalog does not throw inside resolver.
        }
      }
      return { valid: true, normalizedValue: trimmed };
    }
  }
}

function asNumberScript(val: string | undefined, fallback: NumberScript): NumberScript {
  return val === NUMBER_SCRIPTS.ARAB ? NUMBER_SCRIPTS.ARAB : val === NUMBER_SCRIPTS.LATN ? NUMBER_SCRIPTS.LATN : fallback;
}

function asGroupingLocale(
  val: string | undefined,
  fallback: NumberGroupingLocale
): NumberGroupingLocale {
  if (
    val === NUMBER_GROUPING_LOCALES.EN_US ||
    val === NUMBER_GROUPING_LOCALES.AR_LATN ||
    val === NUMBER_GROUPING_LOCALES.AR_NATIVE
  ) {
    return val;
  }
  return fallback;
}

function asDensityOverride(
  val: string | undefined,
  fallback: TableDensityOverride
): TableDensityOverride {
  if (
    val === TABLE_DENSITY_OVERRIDES.INHERIT ||
    val === TABLE_DENSITY_OVERRIDES.COMFORTABLE ||
    val === TABLE_DENSITY_OVERRIDES.COMPACT
  ) {
    return val;
  }
  return fallback;
}

function asPosStepperTarget(
  val: string | undefined,
  fallback: PosStepperMinTarget
): PosStepperMinTarget {
  if (
    val === POS_STEPPER_MIN_TARGETS.ADAPTIVE ||
    val === POS_STEPPER_MIN_TARGETS.ALWAYS_TOUCH_44
  ) {
    return val;
  }
  return fallback;
}

function asBooleanValue(val: string | undefined, fallback: boolean): boolean {
  if (val === 'TRUE') return true;
  if (val === 'FALSE') return false;
  return fallback;
}

function asPageSize(val: string | undefined, fallback: number): number {
  const num = Number(val);
  if (Number.isInteger(num) && (EXTRA_CONFIG_PAGE_SIZES as readonly number[]).includes(num)) {
    return num;
  }
  return fallback;
}

/**
 * Pure resolver merging global catalog defaults, per-Organization overrides, and plan flags.
 */
export function resolveExtraConfig(
  catalogRows: readonly SysExtraConfigRow[],
  orgOverrides: readonly OrgExtraConfigOverride[],
  planFlags?: Readonly<Record<string, unknown>>
): { resolved: ResolvedExtraConfig; items: ExtraConfigItemView[] } {
  const activeCatalog = [...catalogRows]
    .filter((row) => row.is_active && row.rec_status === 1)
    .sort((a, b) => {
      const catDiff = a.category_code.localeCompare(b.category_code);
      if (catDiff !== 0) return catDiff;
      const ordDiff = (a.rec_order ?? 9999) - (b.rec_order ?? 9999);
      return ordDiff !== 0 ? ordDiff : a.config_key.localeCompare(b.config_key);
    });

  const overrideByKey = new Map<string, OrgExtraConfigOverride>();
  for (const ov of orgOverrides) {
    if (ov.is_active && ov.rec_status === 1) {
      overrideByKey.set(ov.config_key, ov);
    }
  }

  const valuesByKey: Record<string, string> = {};
  const items: ExtraConfigItemView[] = [];

  for (const row of activeCatalog) {
    const planAllowed = !row.plan_flag_key || planFlags?.[row.plan_flag_key] === true;
    const rawOverride = overrideByKey.get(row.config_key);
    const options = parseExtraConfigOptions(row.allowed_values_json);

    let effectiveValue = row.default_value;
    let isOverridden = false;

    if (rawOverride && row.is_editable_by_tenant && planAllowed) {
      const check = validateExtraConfigValue(row, rawOverride.config_value);
      if (check.valid) {
        effectiveValue = check.normalizedValue;
        isOverridden = effectiveValue !== row.default_value;
      }
    }

    valuesByKey[row.config_key] = effectiveValue;

    items.push({
      config_key: row.config_key,
      category_code: row.category_code,
      name: row.name,
      name2: row.name2,
      description: row.description,
      description2: row.description2,
      value_type: row.value_type,
      default_value: row.default_value,
      effective_value: effectiveValue,
      override_value: rawOverride?.config_value ?? null,
      is_overridden: isOverridden,
      source: isOverridden ? 'TENANT' : 'SYSTEM',
      is_editable_by_tenant: row.is_editable_by_tenant,
      plan_flag_key: row.plan_flag_key,
      plan_allowed: planAllowed,
      allowed_values: options,
      validation_regex: row.validation_regex,
      min_num: row.min_num !== null ? Number(row.min_num) : null,
      max_num: row.max_num !== null ? Number(row.max_num) : null,
      rec_order: row.rec_order,
    });
  }

  const resolved: ResolvedExtraConfig = {
    numberScript: asNumberScript(
      valuesByKey[EXTRA_CONFIG_KEYS.NUMBER_SCRIPT],
      DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript
    ),
    dateDigits: asNumberScript(
      valuesByKey[EXTRA_CONFIG_KEYS.DATE_DIGITS],
      DEFAULT_RESOLVED_EXTRA_CONFIG.dateDigits
    ),
    numberGroupingLocale: asGroupingLocale(
      valuesByKey[EXTRA_CONFIG_KEYS.NUMBER_GROUPING_LOCALE],
      DEFAULT_RESOLVED_EXTRA_CONFIG.numberGroupingLocale
    ),
    bdiIsolationEnabled: asBooleanValue(
      valuesByKey[EXTRA_CONFIG_KEYS.BDI_ISOLATION_ENABLED],
      DEFAULT_RESOLVED_EXTRA_CONFIG.bdiIsolationEnabled
    ),
    defaultTablePageSize: asPageSize(
      valuesByKey[EXTRA_CONFIG_KEYS.DEFAULT_TABLE_PAGE_SIZE],
      DEFAULT_RESOLVED_EXTRA_CONFIG.defaultTablePageSize
    ),
    tableDensityOverride: asDensityOverride(
      valuesByKey[EXTRA_CONFIG_KEYS.TABLE_DENSITY_OVERRIDE],
      DEFAULT_RESOLVED_EXTRA_CONFIG.tableDensityOverride
    ),
    showCurrencyCodeInTables: asBooleanValue(
      valuesByKey[EXTRA_CONFIG_KEYS.SHOW_CURRENCY_CODE_IN_TABLES],
      DEFAULT_RESOLVED_EXTRA_CONFIG.showCurrencyCodeInTables
    ),
    posStepperMinTarget: asPosStepperTarget(
      valuesByKey[EXTRA_CONFIG_KEYS.POS_STEPPER_MIN_TARGET],
      DEFAULT_RESOLVED_EXTRA_CONFIG.posStepperMinTarget
    ),
    valuesByKey,
  };

  return { resolved, items };
}
