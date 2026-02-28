/**
 * Tenant Settings Service
 *
 * Fetches tenant-specific settings using fn_stng_resolve_all_settings (7-layer resolution).
 * Single RPC call retrieves all settings with proper hierarchy: SYSTEM_DEFAULT → SYSTEM_PROFILE
 * → TENANT_OVERRIDE → BRANCH_OVERRIDE → USER_OVERRIDE.
 *
 * Use the default `tenantSettingsService` in client components/hooks.
 * In server actions/API routes, use `createTenantSettingsService(await createServerSupabaseClient())`
 * for proper auth context.
 */

import { createClient } from '@/lib/supabase/client';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Setting codes from sys_tenant_settings_cd (source of truth).
 * Must match catalog entries; see F:/jhapp/cleanmatex/supabase/migrations/
 */
export const SETTING_CODES = {
  TENANT_CURRENCY: 'TENANT_CURRENCY',
  TENANT_DECIMAL_PLACES: 'TENANT_DECIMAL_PLACES',
  TAX_RATE: 'TAX_RATE',
  DEFAULT_PHONE_COUNTRY_CODE: 'DEFAULT_PHONE_COUNTRY_CODE',
  USING_SPLIT_ORDER: 'USING_SPLIT_ORDER',
  USE_REJECT_TO_SOLVE: 'USE_REJECT_TO_SOLVE',
  USE_TRACK_BY_PIECE: 'USE_TRACK_BY_PIECE',
  REJECT_ROW_COLOR: 'REJECT_ROW_COLOR',
  AUTO_CLOSE_DAYS: 'AUTO_CLOSE_DAYS',
  PEAK_SEASON_START: 'PEAK_SEASON_START',
  BRANCH_CURRENCY: 'BRANCH_CURRENCY',
} as const;

/** Resolved settings map: setting code → parsed value (string, number, boolean) */
export type ResolvedSettingsMap = Record<string, string | number | boolean | null>;

export interface TenantProcessingSettings {
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  trackByPiece: boolean;
  rejectColor: string;
}

export interface CurrencyConfig {
  currencyCode: string;
  decimalPlaces: number;
}

export class TenantSettingsService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createClient();
  }

  /**
   * Get all resolved settings for tenant/branch/user in a single RPC call.
   * Uses fn_stng_resolve_all_settings (7-layer resolution).
   */
  async getAllResolvedSettings(
    tenantId: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<ResolvedSettingsMap> {
    try {
      const { data, error } = await this.supabase.rpc('fn_stng_resolve_all_settings', {
        p_tenant_id: tenantId,
        p_branch_id: branchId ?? null,
        p_user_id: userId ?? null,
      });

      if (error) {
        console.error('[TenantSettingsService] fn_stng_resolve_all_settings error:', error);
        return {};
      }

      const map: ResolvedSettingsMap = {};
      for (const row of data ?? []) {
        const code = row.stng_code as string;
        const jsonb = row.stng_value_jsonb;
        map[code] = parseJsonbValue(jsonb);
      }
      return map;
    } catch (err) {
      console.error('[TenantSettingsService] getAllResolvedSettings failed:', err);
      return {};
    }
  }

  /**
   * Check if a specific setting is allowed/enabled for the tenant.
   */
  async checkIfSettingAllowed(
    tenantId: string,
    settingCode: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<boolean> {
    const map = await this.getAllResolvedSettings(tenantId, branchId, userId);
    const v = map[settingCode];
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    if (typeof v === 'number') return v !== 0;
    return Boolean(v);
  }

  /**
   * Get the value of a specific setting for the tenant.
   */
  async getSettingValue(
    tenantId: string,
    settingCode: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<string | number | boolean | null> {
    const map = await this.getAllResolvedSettings(tenantId, branchId, userId);
    return map[settingCode] ?? null;
  }

  /**
   * Get all processing-related settings for the tenant.
   */
  async getProcessingSettings(
    tenantId: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<TenantProcessingSettings> {
    const map = await this.getAllResolvedSettings(tenantId, branchId, userId);
    return {
      splitOrderEnabled: toBoolean(map[SETTING_CODES.USING_SPLIT_ORDER], false),
      rejectEnabled: toBoolean(map[SETTING_CODES.USE_REJECT_TO_SOLVE], false),
      trackByPiece: toBoolean(map[SETTING_CODES.USE_TRACK_BY_PIECE], false),
      rejectColor: toString(map[SETTING_CODES.REJECT_ROW_COLOR], '#10B981'),
    };
  }

  /**
   * Get multiple boolean settings at once.
   */
  async getMultipleSettings(
    tenantId: string,
    settingCodes: string[],
    branchId?: string | null,
    userId?: string | null
  ): Promise<Record<string, boolean>> {
    const map = await this.getAllResolvedSettings(tenantId, branchId, userId);
    return settingCodes.reduce(
      (acc, code) => {
        acc[code] = toBoolean(map[code], false);
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  /**
   * Get tenant's configured currency code.
   */
  async getTenantCurrency(
    tenantId: string,
    branchId?: string | null,
    _userId?: string | null
  ): Promise<string> {
    const map = await this.getAllResolvedSettings(tenantId, branchId ?? undefined);
    const v = map[SETTING_CODES.TENANT_CURRENCY];
    const code = (typeof v === 'string' ? v : String(v ?? '')).trim();
    return code || ORDER_DEFAULTS.CURRENCY;
  }

  /**
   * Get tenant's configured decimal places for currency.
   */
  async getTenantDecimalPlaces(
    tenantId: string,
    branchId?: string | null,
    _userId?: string | null
  ): Promise<number> {
    const map = await this.getAllResolvedSettings(tenantId, branchId ?? undefined);
    const v = map[SETTING_CODES.TENANT_DECIMAL_PLACES];
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
  }

  /**
   * Get tenant's default phone country code (e.g. '+968', '+966').
   */
  async getDefaultPhoneCountryCode(
    tenantId: string,
    branchId?: string | null,
    _userId?: string | null
  ): Promise<string> {
    const map = await this.getAllResolvedSettings(tenantId, branchId ?? undefined);
    const v = map[SETTING_CODES.DEFAULT_PHONE_COUNTRY_CODE];
    const code = (typeof v === 'string' ? v : String(v ?? '')).trim();
    return code && code.startsWith('+') ? code : '+968';
  }

  /**
   * Get currency configuration (code + decimal places) in one call.
   */
  async getCurrencyConfig(
    tenantId: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<CurrencyConfig> {
    const map = await this.getAllResolvedSettings(tenantId, branchId, userId);
    const currencyCode =
      (typeof map[SETTING_CODES.TENANT_CURRENCY] === 'string'
        ? (map[SETTING_CODES.TENANT_CURRENCY] as string)
        : String(map[SETTING_CODES.TENANT_CURRENCY] ?? '')
      ).trim() || ORDER_DEFAULTS.CURRENCY;
    const decimalPlaces =
      (typeof map[SETTING_CODES.TENANT_DECIMAL_PLACES] === 'number'
        ? (map[SETTING_CODES.TENANT_DECIMAL_PLACES] as number)
        : parseInt(String(map[SETTING_CODES.TENANT_DECIMAL_PLACES] ?? ''), 10)
      );
    const decimalPlacesFinal =
      Number.isFinite(decimalPlaces) && decimalPlaces >= 0
        ? decimalPlaces
        : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
    return { currencyCode, decimalPlaces: decimalPlacesFinal };
  }
}

/** Parse JSONB value from fn_stng_resolve_all_settings (string, number, boolean, or null) */
function parseJsonbValue(jsonb: unknown): string | number | boolean | null {
  if (jsonb === null || jsonb === undefined) return null;
  if (typeof jsonb === 'string' || typeof jsonb === 'number' || typeof jsonb === 'boolean') {
    return jsonb;
  }
  if (typeof jsonb === 'object' && jsonb !== null && 'value' in jsonb) {
    return (jsonb as { value: unknown }).value as string | number | boolean | null;
  }
  return String(jsonb);
}

function toBoolean(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return Boolean(v);
}

function toString(v: unknown, fallback: string): string {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

/** Default instance for client-side usage (uses browser client) */
export const tenantSettingsService = new TenantSettingsService();

/**
 * Create a service instance with a specific Supabase client.
 * Use in server actions/API routes: createTenantSettingsService(await createServerSupabaseClient())
 */
export function createTenantSettingsService(supabase: SupabaseClient): TenantSettingsService {
  return new TenantSettingsService(supabase);
}
