/**
 * Tenant Currency Profile Service
 *
 * The tenant currency authority (Tenant_Currency_FX plan 01, stage L2 cut-over).
 * Reads `org_currency_cf` — the DB-locked base (functional) currency plus any
 * reporting/foreign currencies, migration 0532 — joined to `sys_currency_cd`
 * for decimal places (C8: decimals always come from `minor_unit`, never a
 * hand-carried setting).
 *
 * Currency is tenant-level only: `org_currency_cf` has no branch/user column,
 * matching the scope the retired `TENANT_CURRENCY` setting already had
 * (tenant-only; `BRANCH_CURRENCY` was never read by app code).
 *
 * Use the default `tenantCurrencyProfileService` in client components/hooks.
 * In server actions/API routes, use
 * `createTenantCurrencyProfileService(await createServerSupabaseClient())`.
 */

import { createClient } from '@/lib/supabase/client';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import {
  CURRENCY_RESOLUTION_ERRORS,
  CurrencyResolutionError,
} from '@/lib/money/currency-resolution';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TenantCurrencyEntry {
  currencyCode: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  isReportingCurrency: boolean;
  allowSales: boolean;
  allowPayments: boolean;
  allowCash: boolean;
  allowAr: boolean;
}

export interface TenantCurrencyProfile {
  base: TenantCurrencyEntry;
  /** Optional reporting currency (unset = report in base). */
  reporting: TenantCurrencyEntry | null;
  /** Base + reporting + every other active currency the tenant has enabled. */
  currencies: TenantCurrencyEntry[];
}

interface OrgCurrencyRow {
  currency_code: string;
  is_base_currency: boolean;
  is_reporting_currency: boolean;
  allow_sales: boolean;
  allow_payments: boolean;
  allow_cash: boolean;
  allow_ar: boolean;
}

export class TenantCurrencyProfileService {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createClient();
  }

  /**
   * Load the tenant's active currency portfolio.
   *
   * B15: no locale defaults — a tenant with no active base row (should not
   * happen; every tenant is backfilled by migration 0532) fails loudly with
   * `MISSING_TENANT_CURRENCY`, the same error the retired settings resolver
   * threw for an unconfigured tenant.
   */
  async getProfile(tenantId: string): Promise<TenantCurrencyProfile> {
    const { data, error } = await this.supabase
      .from('org_currency_cf')
      .select(
        'currency_code, is_base_currency, is_reporting_currency, allow_sales, allow_payments, allow_cash, allow_ar'
      )
      .eq('tenant_org_id', tenantId)
      .eq('rec_status', 1)
      .eq('is_active', true);

    if (error) {
      console.error('[TenantCurrencyProfileService] org_currency_cf read failed:', error);
      throw new CurrencyResolutionError(
        CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY,
        `tenant ${tenantId}`
      );
    }

    const rows = (data ?? []) as OrgCurrencyRow[];
    const baseRow = rows.find((r) => r.is_base_currency);
    if (!baseRow) {
      throw new CurrencyResolutionError(
        CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY,
        `tenant ${tenantId}`
      );
    }

    const decimalsByCode = await this.loadDecimalPlaces(rows.map((r) => r.currency_code));
    const toEntry = (row: OrgCurrencyRow): TenantCurrencyEntry => ({
      currencyCode: row.currency_code,
      decimalPlaces: decimalsByCode.get(row.currency_code) ?? ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
      isBaseCurrency: row.is_base_currency,
      isReportingCurrency: row.is_reporting_currency,
      allowSales: row.allow_sales,
      allowPayments: row.allow_payments,
      allowCash: row.allow_cash,
      allowAr: row.allow_ar,
    });

    const reportingRow = rows.find((r) => r.is_reporting_currency) ?? null;

    return {
      base: toEntry(baseRow),
      reporting: reportingRow ? toEntry(reportingRow) : null,
      currencies: rows.map(toEntry),
    };
  }

  private async loadDecimalPlaces(codes: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (codes.length === 0) return map;
    const { data, error } = await this.supabase
      .from('sys_currency_cd')
      .select('code, minor_unit')
      .in('code', codes);
    if (error) {
      console.error('[TenantCurrencyProfileService] sys_currency_cd read failed:', error);
      return map;
    }
    for (const row of (data ?? []) as { code: string; minor_unit: number }[]) {
      map.set(row.code, row.minor_unit);
    }
    return map;
  }
}

/** Default instance for client-side usage (uses browser client) */
export const tenantCurrencyProfileService = new TenantCurrencyProfileService();

/**
 * Create a service instance with a specific Supabase client.
 * Use in server actions/API routes: createTenantCurrencyProfileService(await createServerSupabaseClient())
 */
export function createTenantCurrencyProfileService(
  supabase: SupabaseClient
): TenantCurrencyProfileService {
  return new TenantCurrencyProfileService(supabase);
}
