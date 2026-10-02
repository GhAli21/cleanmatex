/**
 * Read-only catalog lookups for the tenant FX screen (plan 01 §7.2).
 * Thin projections of the shared `sys_*` catalogs — never written from here.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isProviderFetchable } from './fx-provider-fetch';

export interface SelectableCurrency {
  code: string;
  name: string;
  name2: string | null;
  minorUnit: number;
}

export interface FxRateTypeOption {
  code: string;
  name: string;
  name2: string | null;
  maxAgeDays: number | null;
}

export interface FxRateSourceOption {
  code: string;
  name: string;
  name2: string | null;
}

/** C2: every active, platform-enabled currency — the universe "Add currency" may pick from. */
export async function listPlatformEnabledCurrencies(): Promise<SelectableCurrency[]> {
  const rows = await prisma.sys_currency_cd.findMany({
    where: { is_active: true, is_platform_enabled: true },
    select: { code: true, name: true, name2: true, minor_unit: true },
    orderBy: { code: 'asc' },
  });
  return rows.map((r) => ({ code: r.code, name: r.name, name2: r.name2, minorUnit: r.minor_unit }));
}

/** Platform-enabled currencies the tenant has NOT already added to its portfolio. */
export async function listAddableCurrencies(tenantId: string): Promise<SelectableCurrency[]> {
  return withTenantContext(tenantId, async (tenant) => {
    const [all, portfolio] = await Promise.all([
      listPlatformEnabledCurrencies(),
      prisma.org_currency_cf.findMany({ where: { tenant_org_id: tenant, rec_status: 1 }, select: { currency_code: true } }),
    ]);
    const taken = new Set(portfolio.map((p) => p.currency_code));
    return all.filter((c) => !taken.has(c.code));
  });
}

export async function listFxRateTypes(): Promise<FxRateTypeOption[]> {
  const rows = await prisma.sys_fx_rate_type_cd.findMany({
    where: { is_active: true },
    select: { code: true, name: true, name2: true, max_age_days: true },
    orderBy: { display_order: 'asc' },
  });
  return rows.map((r) => ({ code: r.code, name: r.name, name2: r.name2, maxAgeDays: r.max_age_days }));
}

export async function listFxSources(): Promise<FxRateSourceOption[]> {
  const rows = await prisma.sys_exchange_rate_source_cd.findMany({
    where: { is_active: true },
    select: { code: true, name: true, name2: true },
    orderBy: { display_order: 'asc' },
  });
  return rows.map((r) => ({ code: r.code, name: r.name, name2: r.name2 }));
}

export interface FxProviderOption {
  code: string;
  name: string;
  name2: string | null;
  sourceCode: string;
  baseCurrencyCode: string | null;
  supportsHistorical: boolean;
}

/**
 * Active providers this app can actually fetch (5E) — filtered to rows whose
 * `parser_code` is implemented in `fx-provider-fetch.ts`'s `PARSER_REGISTRY`,
 * not just `is_active`. Today that's `ECB_DAILY_XML` only.
 */
export async function listActiveFxProviders(): Promise<FxProviderOption[]> {
  const rows = await prisma.sys_fx_provider_cd.findMany({
    where: { is_active: true, rec_status: 1 },
    select: {
      code: true,
      name: true,
      name2: true,
      source_code: true,
      base_currency_code: true,
      supports_historical: true,
      parser_code: true,
    },
    orderBy: { display_order: 'asc' },
  });
  return rows
    .filter((r) => isProviderFetchable(r.parser_code))
    .map((r) => ({
      code: r.code,
      name: r.name,
      name2: r.name2,
      sourceCode: r.source_code,
      baseCurrencyCode: r.base_currency_code,
      supportsHistorical: r.supports_historical,
    }));
}
