/**
 * Tenant Currency & FX RBAC permission codes (mirror DB `sys_auth_permissions.code`
 * exactly — CLAUDE.md DB-mirror rule; format `resource:action`). Seeded by
 * migration 0538 (`rbac_permissions_currency_fx.sql`), applied local + remote.
 *
 * Usage rule: API route guards and `*-access.ts` contracts keep STRING
 * LITERALS (the platform-inventory extractor resolves literals only — see
 * orders-perm.ts header). Import this registry for typed programmatic use.
 */
export const CURRENCY_FX_PERMISSIONS = {
  CURRENCIES_VIEW: 'currencies:view',
  CURRENCIES_MANAGE: 'currencies:manage',
  /** Elevated — changing the base currency is DB-locked once documents exist (C6). */
  CURRENCIES_SET_BASE: 'currencies:set_base',
  FX_RATES_VIEW: 'fx_rates:view',
  FX_RATES_MANAGE: 'fx_rates:manage',
  FX_RATES_APPROVE: 'fx_rates:approve',
  FX_RATES_IMPORT: 'fx_rates:import',
  FX_RATES_MANUAL_OVERRIDE: 'fx_rates:manual_override',
} as const

export type CurrencyFxPermissionCode =
  (typeof CURRENCY_FX_PERMISSIONS)[keyof typeof CURRENCY_FX_PERMISSIONS]
