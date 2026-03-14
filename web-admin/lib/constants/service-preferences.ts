/**
 * Service Preferences Constants — Single source of truth for service and packing preference codes.
 * Used by lib/types/service-preferences.ts and validation schemas.
 */

/** Service preference codes (sys_service_preference_cd) */
export const SERVICE_PREFERENCE_CODES = {
  STARCH_LIGHT: 'STARCH_LIGHT',
  STARCH_HEAVY: 'STARCH_HEAVY',
  PERFUME: 'PERFUME',
  SEPARATE_WASH: 'SEPARATE_WASH',
  DELICATE: 'DELICATE',
  STEAM_PRESS: 'STEAM_PRESS',
  ANTI_BACTERIAL: 'ANTI_BACTERIAL',
  HAND_WASH: 'HAND_WASH',
  BLEACH_FREE: 'BLEACH_FREE',
  ECO_WASH: 'ECO_WASH',
} as const;

export type ServicePreferenceCode =
  (typeof SERVICE_PREFERENCE_CODES)[keyof typeof SERVICE_PREFERENCE_CODES];

/** Packing preference codes (sys_packing_preference_cd) */
export const PACKING_PREFERENCE_CODES = {
  HANG: 'HANG',
  FOLD: 'FOLD',
  FOLD_TISSUE: 'FOLD_TISSUE',
  BOX: 'BOX',
  GARMENT_BAG: 'GARMENT_BAG',
  VACUUM_SEAL: 'VACUUM_SEAL',
  ROLL: 'ROLL',
} as const;

export type PackingPreferenceCode =
  (typeof PACKING_PREFERENCE_CODES)[keyof typeof PACKING_PREFERENCE_CODES];

/** Preference categories for service preferences */
export const PREFERENCE_CATEGORIES = {
  WASHING: 'washing',
  PROCESSING: 'processing',
  FINISHING: 'finishing',
} as const;

export type PreferenceCategory =
  (typeof PREFERENCE_CATEGORIES)[keyof typeof PREFERENCE_CATEGORIES];

/** Source of preference (how it was applied) */
export const PREFERENCE_SOURCES = {
  MANUAL: 'manual',
  CUSTOMER_PREF: 'customer_pref',
  PRODUCT_DEFAULT: 'product_default',
  CONTRACT_DEFAULT: 'contract_default',
  BUNDLE: 'bundle',
} as const;

export type PreferenceSource =
  (typeof PREFERENCE_SOURCES)[keyof typeof PREFERENCE_SOURCES];

/**
 * Default Lucide icon names for service preferences when sys_service_preference_cd.icon is null.
 * Use PascalCase names matching lucide-react exports.
 */
export const SERVICE_PREF_DEFAULT_ICONS: Partial<Record<string, string>> = {
  STARCH_LIGHT: 'Snowflake',
  STARCH_HEAVY: 'Snowflake',
  PERFUME: 'Sparkles',
  SEPARATE_WASH: 'Droplets',
  DELICATE: 'Heart',
  STEAM_PRESS: 'Flame',
  ANTI_BACTERIAL: 'Shield',
  HAND_WASH: 'Hand',
  BLEACH_FREE: 'Ban',
  ECO_WASH: 'Leaf',
};

/** Fallback icon by preference_category when code has no default */
export const SERVICE_PREF_CATEGORY_ICONS: Record<string, string> = {
  washing: 'Droplets',
  processing: 'Snowflake',
  finishing: 'Sparkles',
};

/** Maps packing preference to packaging type (sys_pck_packaging_type_cd) */
export const PACKING_TO_PACKAGING_MAP: Record<PackingPreferenceCode, string> = {
  HANG: 'HANGER',
  FOLD: 'BAG',
  FOLD_TISSUE: 'BAG',
  BOX: 'BOX',
  GARMENT_BAG: 'BAG',
  VACUUM_SEAL: 'BAG',
  ROLL: 'BAG',
};
