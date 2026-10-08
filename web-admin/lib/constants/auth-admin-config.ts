/**
 * Auth admin config constants — catalog item codes, groups, value types and sources.
 *
 * Values mirror the database exactly (migration 0570): `sys_auth_admin_config_cf` /
 * `org_auth_admin_config_cf`. Keep in sync with the seed; the DB catalog is authoritative.
 */

/** Catalog item codes (sys_auth_admin_config_cf.config_code). */
export const AUTH_CONFIG_CODES = {
  IDLE_TIMEOUT_MIN: 'AUTH_IDLE_TIMEOUT_MIN',
  IDLE_WARNING_SEC: 'AUTH_IDLE_WARNING_SEC',
  SESSION_MAX_HOURS: 'AUTH_SESSION_MAX_HOURS',
  REMEMBER_ME_DAYS: 'AUTH_REMEMBER_ME_DAYS',
  MAX_SESSIONS_PER_USER: 'AUTH_MAX_SESSIONS_PER_USER',
  SESSION_LIMIT_POLICY: 'AUTH_SESSION_LIMIT_POLICY',
  NEW_DEVICE_ALERT: 'AUTH_NEW_DEVICE_ALERT',
  LOCKOUT_MAX_ATTEMPTS: 'AUTH_LOCKOUT_MAX_ATTEMPTS',
  LOCKOUT_MINUTES: 'AUTH_LOCKOUT_MINUTES',
  LOCKOUT_WINDOW_MIN: 'AUTH_LOCKOUT_WINDOW_MIN',
  PWD_REQUIRE_CURRENT: 'AUTH_PWD_REQUIRE_CURRENT',
  PWD_FRESH_SIGNIN_MIN: 'AUTH_PWD_FRESH_SIGNIN_MIN',
  PWD_HISTORY_COUNT: 'AUTH_PWD_HISTORY_COUNT',
  PWD_BREACH_CHECK: 'AUTH_PWD_BREACH_CHECK',
} as const

export type AuthConfigCode = (typeof AUTH_CONFIG_CODES)[keyof typeof AUTH_CONFIG_CODES]

/** UI/DB grouping (config_group CHECK). */
export const AUTH_CONFIG_GROUPS = {
  SESSION: 'SESSION',
  DEVICE: 'DEVICE',
  LOCKOUT: 'LOCKOUT',
  PASSWORD: 'PASSWORD',
} as const

export type AuthConfigGroup = (typeof AUTH_CONFIG_GROUPS)[keyof typeof AUTH_CONFIG_GROUPS]

/** How config_value is parsed (value_type CHECK). */
export const AUTH_CONFIG_VALUE_TYPES = {
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ENUM: 'ENUM',
} as const

export type AuthConfigValueType = (typeof AUTH_CONFIG_VALUE_TYPES)[keyof typeof AUTH_CONFIG_VALUE_TYPES]

/** Display unit for INTEGER items (unit CHECK). */
export const AUTH_CONFIG_UNITS = {
  SECONDS: 'SECONDS',
  MINUTES: 'MINUTES',
  HOURS: 'HOURS',
  DAYS: 'DAYS',
  COUNT: 'COUNT',
  NONE: 'NONE',
} as const

export type AuthConfigUnit = (typeof AUTH_CONFIG_UNITS)[keyof typeof AUTH_CONFIG_UNITS]

/** Where an effective value comes from (fn_auth_config_effective.source). */
export const AUTH_CONFIG_SOURCES = {
  /** No tenant override; platform value applies. */
  PLATFORM: 'PLATFORM',
  /** Tenant override applies (allowed and within bounds). */
  TENANT: 'TENANT',
  /** An override exists but HQ disallowed it / tightened bounds, so the platform value applies. */
  PLATFORM_ENFORCED: 'PLATFORM_ENFORCED',
} as const

export type AuthConfigSource = (typeof AUTH_CONFIG_SOURCES)[keyof typeof AUTH_CONFIG_SOURCES]

/** Values of AUTH_SESSION_LIMIT_POLICY (allowed_values). */
export const SESSION_LIMIT_POLICIES = {
  REVOKE_OLDEST: 'REVOKE_OLDEST',
  BLOCK_NEW: 'BLOCK_NEW',
} as const

export type SessionLimitPolicy = (typeof SESSION_LIMIT_POLICIES)[keyof typeof SESSION_LIMIT_POLICIES]

/** Machine codes returned by the auth-config API / thrown by its use-cases. */
export const AUTH_CONFIG_ERROR_CODES = {
  /** Tenant's plan lacks flag session_timeout_control — editing disabled. */
  FEATURE_NOT_ENABLED: 'FEATURE_NOT_ENABLED',
  /** config_code is not an active catalog item. */
  UNKNOWN_ITEM: 'UNKNOWN_ITEM',
  /** Item is platform-managed (is_allow_tenant_change = false). */
  NOT_TENANT_EDITABLE: 'NOT_TENANT_EDITABLE',
  /** Value fails the item's type / range / allowed values. */
  INVALID_VALUE: 'INVALID_VALUE',
  /** Unexpected persistence failure. */
  SAVE_FAILED: 'SAVE_FAILED',
} as const

export type AuthConfigErrorCode = (typeof AUTH_CONFIG_ERROR_CODES)[keyof typeof AUTH_CONFIG_ERROR_CODES]
