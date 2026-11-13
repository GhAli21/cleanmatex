/**
 * Exchange rate for one ERP-Lite purchase document.
 *
 * The document stores `exchange_rate` (base = amount × rate) plus the book row
 * that produced it. A same-currency document stores 1 and no book row. A missing
 * rate is refused: posting 1 would value the document wrongly in the organization
 * currency. A manual override is not accepted here.
 */
import 'server-only';

import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { FX_ERROR, FxError } from './fx-errors';
import { resolveRate } from './fx-rate-resolver.service';

/** Rate facts written on the document and copied onto its tax lines. */
export interface DocFxRate {
  /** Organization (base) currency. */
  baseCurrencyCode: string;
  /** Exact decimal string. `1` when the document currency is the base currency. */
  exchangeRate: string;
  /** Rate-book row date. Null for a same-currency document. */
  fxRateDate: string | null;
  /** `TENANT:CBO` or `HQ:ECB`. Null for a same-currency document. */
  fxRateSource: string | null;
  /** Row id in the tenant or HQ rate book. Null for a same-currency document. */
  fxRateId: string | null;
  /** Minor-unit digits of the base currency, used when rounding base tax. */
  baseMinorUnit: number;
}

/**
 * Organization currency and its minor unit.
 * @param tenantId - Organization; `org_tenants_mst.id` is the tenant key (the table has no `tenant_org_id`)
 * @returns Base currency code and minor-unit digits
 * @throws Error when the organization has no currency, or that currency has no minor unit
 */
async function organizationBaseCurrency(tenantId: string): Promise<{ code: string; minorUnit: number }> {
  // withTenantContext sets the tenant for the guard. The currency row is global (`sys_*`).
  return withTenantContext(tenantId, async () => {
    const tenant = await prisma.org_tenants_mst.findFirst({
      where: { id: tenantId },
      select: { currency: true },
    });
    const code = tenant?.currency?.trim().toUpperCase() ?? '';
    if (!code) throw new Error('Organization currency is not set');
    const row = await prisma.sys_currency_cd.findUnique({
      where: { code },
      select: { minor_unit: true },
    });
    if (row?.minor_unit == null) throw new Error(`Currency ${code} has no minor unit`);
    return { code, minorUnit: row.minor_unit };
  });
}

/**
 * Rate from the document currency into the organization currency on the document date.
 * A stale approved rate is still used: the document keeps its date so the age stays visible.
 * @param tenantId - Organization, resolved from the session by the caller
 * @param currencyCode - Document currency
 * @param date - Document date (YYYY-MM-DD)
 * @returns Rate facts for the document columns
 * @throws CommercialRuleError FX_RATE_NOT_FOUND when no approved rate exists on or before `date`
 * @throws Error when the organization currency is missing
 */
export async function resolveDocFxRate(tenantId: string, currencyCode: string, date: string): Promise<DocFxRate> {
  const currency = currencyCode.trim().toUpperCase();
  const base = await organizationBaseCurrency(tenantId);
  if (currency === base.code) {
    return {
      baseCurrencyCode: base.code,
      exchangeRate: '1',
      fxRateDate: null,
      fxRateSource: null,
      fxRateId: null,
      baseMinorUnit: base.minorUnit,
    };
  }

  try {
    const resolved = await resolveRate(tenantId, { from: currency, to: base.code, date });
    const book = resolved.book;
    const fxRateSource = book ? (resolved.sourceCode ? `${book}:${resolved.sourceCode}` : book) : null;
    return {
      baseCurrencyCode: base.code,
      exchangeRate: resolved.rate,
      fxRateDate: resolved.rateDate,
      fxRateSource,
      fxRateId: resolved.rateId,
      baseMinorUnit: base.minorUnit,
    };
  } catch (error) {
    if (error instanceof FxError && error.code === FX_ERROR.RATE_NOT_FOUND) {
      throw new CommercialRuleError(
        COMMERCIAL_ERROR_CODES.FX_RATE_NOT_FOUND,
        'No approved exchange rate for this document date.',
        { currency, baseCurrency: base.code, date },
      );
    }
    throw error;
  }
}

/**
 * Refuses a petty-cash document in a foreign currency.
 * `org_fin_cash_txn_tr` keeps `exchange_rate` 1 and has no rate-book columns, so a
 * foreign cash box would be posted as if it were the organization currency.
 * @param tenantId - Organization, resolved from the session by the caller
 * @param currencyCode - Cash-box or transaction currency
 * @returns Nothing when the currency is the organization currency
 * @throws CommercialRuleError PETTY_CASH_FX_UNSUPPORTED when it is not
 */
export async function assertOrgBaseCurrency(tenantId: string, currencyCode: string): Promise<void> {
  const base = await organizationBaseCurrency(tenantId);
  const currency = currencyCode.trim().toUpperCase();
  if (currency === base.code) return;
  throw new CommercialRuleError(
    COMMERCIAL_ERROR_CODES.PETTY_CASH_FX_UNSUPPORTED,
    'Petty cash must be in the organization currency.',
    { currency, baseCurrency: base.code },
  );
}
