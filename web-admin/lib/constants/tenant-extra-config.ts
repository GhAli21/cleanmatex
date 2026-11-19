/**
 * Extra Tenant Configuration constants.
 * Mirrors UPPERCASE codes and keys in `sys_tenant_extra_config_cf` (`0775_sys_tenant_extra_config_cf.sql`).
 *
 * @module lib/constants/tenant-extra-config
 */

/** Regex enforced by DB constraint `ck_stec_key` on config keys and category codes. */
export const EXTRA_CONFIG_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

/** Logical grouping categories for `/dashboard/settings/extra-config`. */
export const EXTRA_CONFIG_CATEGORIES = {
  NUMBERS_AND_DATES: 'NUMBERS_AND_DATES',
  TABLES_AND_DENSITY: 'TABLES_AND_DENSITY',
  POS_ERGONOMICS: 'POS_ERGONOMICS',
  ACCESSIBILITY: 'ACCESSIBILITY',
} as const;

export type ExtraConfigCategory =
  (typeof EXTRA_CONFIG_CATEGORIES)[keyof typeof EXTRA_CONFIG_CATEGORIES];

/** Canonical ordering of categories in UI and API grouped payloads. */
export const EXTRA_CONFIG_CATEGORY_ORDER: readonly ExtraConfigCategory[] = [
  EXTRA_CONFIG_CATEGORIES.NUMBERS_AND_DATES,
  EXTRA_CONFIG_CATEGORIES.TABLES_AND_DENSITY,
  EXTRA_CONFIG_CATEGORIES.POS_ERGONOMICS,
  EXTRA_CONFIG_CATEGORIES.ACCESSIBILITY,
] as const;

/** Input / validation kinds defined in `sys_tenant_extra_config_cf.value_type`. */
export const EXTRA_CONFIG_VALUE_TYPES = {
  SELECT: 'SELECT',
  BOOLEAN: 'BOOLEAN',
  NUMBER: 'NUMBER',
  TEXT: 'TEXT',
} as const;

export type ExtraConfigValueType =
  (typeof EXTRA_CONFIG_VALUE_TYPES)[keyof typeof EXTRA_CONFIG_VALUE_TYPES];

/** Seeded configuration keys in `sys_tenant_extra_config_cf.config_key`. */
export const EXTRA_CONFIG_KEYS = {
  NUMBER_SCRIPT: 'NUMBER_SCRIPT',
  DATE_DIGITS: 'DATE_DIGITS',
  NUMBER_GROUPING_LOCALE: 'NUMBER_GROUPING_LOCALE',
  BDI_ISOLATION_ENABLED: 'BDI_ISOLATION_ENABLED',
  DEFAULT_TABLE_PAGE_SIZE: 'DEFAULT_TABLE_PAGE_SIZE',
  TABLE_DENSITY_OVERRIDE: 'TABLE_DENSITY_OVERRIDE',
  SHOW_CURRENCY_CODE_IN_TABLES: 'SHOW_CURRENCY_CODE_IN_TABLES',
  POS_STEPPER_MIN_TARGET: 'POS_STEPPER_MIN_TARGET',
} as const;

export type ExtraConfigKey =
  (typeof EXTRA_CONFIG_KEYS)[keyof typeof EXTRA_CONFIG_KEYS];

/** Numeral scripts for `NUMBER_SCRIPT` and `DATE_DIGITS`. */
export const NUMBER_SCRIPTS = {
  LATN: 'LATN',
  ARAB: 'ARAB',
} as const;

export type NumberScript = (typeof NUMBER_SCRIPTS)[keyof typeof NUMBER_SCRIPTS];

/** Grouping separator styles for `NUMBER_GROUPING_LOCALE`. */
export const NUMBER_GROUPING_LOCALES = {
  EN_US: 'EN_US',
  AR_LATN: 'AR_LATN',
  AR_NATIVE: 'AR_NATIVE',
} as const;

export type NumberGroupingLocale =
  (typeof NUMBER_GROUPING_LOCALES)[keyof typeof NUMBER_GROUPING_LOCALES];

/** Organization table density override choices for `TABLE_DENSITY_OVERRIDE`. */
export const TABLE_DENSITY_OVERRIDES = {
  INHERIT: 'INHERIT',
  COMFORTABLE: 'COMFORTABLE',
  COMPACT: 'COMPACT',
} as const;

export type TableDensityOverride =
  (typeof TABLE_DENSITY_OVERRIDES)[keyof typeof TABLE_DENSITY_OVERRIDES];

/** Touch target presets for `POS_STEPPER_MIN_TARGET`. */
export const POS_STEPPER_MIN_TARGETS = {
  ADAPTIVE: 'ADAPTIVE',
  ALWAYS_TOUCH_44: 'ALWAYS_TOUCH_44',
} as const;

export type PosStepperMinTarget =
  (typeof POS_STEPPER_MIN_TARGETS)[keyof typeof POS_STEPPER_MIN_TARGETS];

/** Boolean string literals used by BOOLEAN rows (`allowed_values_json`). */
export const EXTRA_CONFIG_BOOLEAN_VALUES = {
  TRUE: 'TRUE',
  FALSE: 'FALSE',
} as const;

/** Allowed table page sizes in `DEFAULT_TABLE_PAGE_SIZE`. */
export const EXTRA_CONFIG_PAGE_SIZES = [10, 20, 30, 50, 100] as const;

/**
 * GCC-first preferred defaults (mirrors `sys_tenant_extra_config_cf` seeds).
 * Used as a non-throwing memory fallback when no tenant override exists or DB reads fail.
 */
export const DEFAULT_RESOLVED_EXTRA_CONFIG = {
  numberScript: NUMBER_SCRIPTS.LATN,
  dateDigits: NUMBER_SCRIPTS.LATN,
  numberGroupingLocale: NUMBER_GROUPING_LOCALES.EN_US,
  bdiIsolationEnabled: true,
  defaultTablePageSize: 10,
  tableDensityOverride: TABLE_DENSITY_OVERRIDES.INHERIT,
  showCurrencyCodeInTables: true,
  posStepperMinTarget: POS_STEPPER_MIN_TARGETS.ADAPTIVE,
} as const;
