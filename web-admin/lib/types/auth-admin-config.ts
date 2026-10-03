/**
 * Auth admin config types (migration 0570).
 *
 * Constant-derived unions live in `lib/constants/auth-admin-config.ts`; they are re-exported here
 * so consumers can single-import.
 */

import type {
  AuthConfigGroup,
  AuthConfigSource,
  AuthConfigUnit,
  AuthConfigValueType,
} from '@/lib/constants/auth-admin-config'

export type {
  AuthConfigCode,
  AuthConfigErrorCode,
  AuthConfigGroup,
  AuthConfigSource,
  AuthConfigUnit,
  AuthConfigValueType,
  SessionLimitPolicy,
} from '@/lib/constants/auth-admin-config'

/**
 * One catalog item resolved for a tenant (row of fn_auth_config_effective). Values are text as
 * stored; use `parseAuthConfigValue` to get a typed value.
 */
export interface AuthConfigItem {
  configCode: string
  configGroup: AuthConfigGroup
  valueType: AuthConfigValueType
  unit: AuthConfigUnit
  name: string
  /** Arabic label. */
  name2: string | null
  description: string | null
  /** Arabic description. */
  description2: string | null
  displayOrder: number
  platformValue: string
  /** Active tenant override value, when one exists (even if currently ignored). */
  tenantValue: string | null
  effectiveValue: string
  source: AuthConfigSource
  /** true = tenants may override this item. */
  isAllowTenantChange: boolean
  minValue: number | null
  maxValue: number | null
  allowedValues: string[] | null
}

/** Value accepted from API callers before normalisation to the stored text form. */
export type AuthConfigInputValue = string | number | boolean

/** One requested change: `value: null` resets the item to the platform value. */
export interface AuthConfigChange {
  configCode: string
  value: AuthConfigInputValue | null
}

/** Result of validating one raw value against a catalog item. Flat shape (strict:false narrowing). */
export interface AuthConfigValidation {
  ok: boolean
  /** Normalised text value, set when ok. */
  value?: string
  /** Why validation failed, set when !ok. */
  reason?: 'type' | 'range' | 'not_allowed'
}
