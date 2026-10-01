/**
 * Tenant currency portfolio CRUD (`org_currency_cf`, Tenant_Currency_FX plan
 * 01 §4). Enforces C2 (platform-enabled), C4 (usage guard on deactivation
 * and on turning any context off), C6 (base-currency lock — DB trigger is
 * authoritative; this service pre-checks for a clean typed error), C10
 * (module-readiness registry), C11 (pricing mode).
 *
 * Permission gating (`currencies:manage`, `currencies:set_base`) is the
 * caller's responsibility (route/server-action layer) — every function here
 * assumes the actor is already authorized, same convention as
 * `cash-control-settings.service.ts`.
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  CURRENCY_CONTEXT,
  MULTI_CURRENCY_READY_CONTEXTS,
  SALES_PRICING_MODE,
  type SalesPricingMode,
} from '@/lib/constants/currency-fx';
import { FX_ERROR, FxError } from './fx-errors';
import { checkCurrencyInUse } from './currency-usage.service';

export interface CurrencyPortfolioRow {
  currencyCode: string;
  isBaseCurrency: boolean;
  isReportingCurrency: boolean;
  allowSales: boolean;
  allowPayments: boolean;
  allowCash: boolean;
  allowAr: boolean;
  allowWallet: boolean;
  allowGiftCard: boolean;
  allowCustomerAdvance: boolean;
  allowPurchasing: boolean;
  salesPricingMode: SalesPricingMode;
  defaultRateTypeCode: string | null;
  defaultRateSourceCode: string | null;
  rateMaxAgeDays: number | null;
  allowManualFxRate: boolean;
  manualFxRequiresApproval: boolean;
  manualRateTolerancePct: number | null;
  taxRateSourceCode: string | null;
  isActive: boolean;
}

export interface CurrencyActor {
  userId: string;
  reason?: string;
}

/** v1-settable context flags — the 4 C10-ready contexts. Others always read false (reserved). */
export interface CurrencyContextInput {
  allowSales?: boolean;
  allowPayments?: boolean;
  allowCash?: boolean;
  allowAr?: boolean;
}

export interface FxPolicyInput {
  salesPricingMode?: SalesPricingMode;
  defaultRateTypeCode?: string | null;
  defaultRateSourceCode?: string | null;
  rateMaxAgeDays?: number | null;
  allowManualFxRate?: boolean;
  manualFxRequiresApproval?: boolean;
  manualRateTolerancePct?: number | null;
  taxRateSourceCode?: string | null;
}

export type AddCurrencyInput = CurrencyContextInput & FxPolicyInput;
export type UpdateCurrencyInput = CurrencyContextInput & FxPolicyInput;

type OrgCurrencyRow = Prisma.org_currency_cfGetPayload<Record<string, never>>;

function toPortfolioRow(row: OrgCurrencyRow): CurrencyPortfolioRow {
  return {
    currencyCode: row.currency_code,
    isBaseCurrency: row.is_base_currency,
    isReportingCurrency: row.is_reporting_currency,
    allowSales: row.allow_sales,
    allowPayments: row.allow_payments,
    allowCash: row.allow_cash,
    allowAr: row.allow_ar,
    allowWallet: row.allow_wallet,
    allowGiftCard: row.allow_gift_card,
    allowCustomerAdvance: row.allow_customer_advance,
    allowPurchasing: row.allow_purchasing,
    salesPricingMode: row.sales_pricing_mode as SalesPricingMode,
    defaultRateTypeCode: row.default_rate_type_code,
    defaultRateSourceCode: row.default_rate_source_code,
    rateMaxAgeDays: row.rate_max_age_days,
    allowManualFxRate: row.allow_manual_fx_rate,
    manualFxRequiresApproval: row.manual_fx_requires_approval,
    manualRateTolerancePct: row.manual_rate_tolerance_pct ? Number(row.manual_rate_tolerance_pct) : null,
    taxRateSourceCode: row.tax_rate_source_code,
    isActive: row.is_active,
  };
}

/** C11: PRICE_LIST is reserved until price lists support currencies. */
function assertPricingMode(mode: SalesPricingMode | undefined): void {
  if (mode !== undefined && mode !== SALES_PRICING_MODE.CONVERT_FROM_BASE) {
    throw new FxError(FX_ERROR.INVALID_PRICING_MODE, `pricing mode ${mode} is not yet supported`);
  }
}

/** C2: the currency must be active and platform-enabled in the shared catalog. */
async function assertPlatformEnabled(currencyCode: string): Promise<void> {
  const currency = await prisma.sys_currency_cd.findUnique({
    where: { code: currencyCode },
    select: { is_active: true, is_platform_enabled: true },
  });
  if (!currency || !currency.is_active || !currency.is_platform_enabled) {
    throw new FxError(
      FX_ERROR.CURRENCY_NOT_PLATFORM_ENABLED,
      `currency ${currencyCode} is not active and platform-enabled`
    );
  }
}

function contextPatchData(input: CurrencyContextInput): Prisma.org_currency_cfUncheckedUpdateInput {
  const data: Prisma.org_currency_cfUncheckedUpdateInput = {};
  if (input.allowSales !== undefined) data.allow_sales = input.allowSales;
  if (input.allowPayments !== undefined) data.allow_payments = input.allowPayments;
  if (input.allowCash !== undefined) data.allow_cash = input.allowCash;
  if (input.allowAr !== undefined) data.allow_ar = input.allowAr;
  return data;
}

function policyPatchData(input: FxPolicyInput): Prisma.org_currency_cfUncheckedUpdateInput {
  const data: Prisma.org_currency_cfUncheckedUpdateInput = {};
  if (input.salesPricingMode !== undefined) data.sales_pricing_mode = input.salesPricingMode;
  if (input.defaultRateTypeCode !== undefined) data.default_rate_type_code = input.defaultRateTypeCode;
  if (input.defaultRateSourceCode !== undefined) data.default_rate_source_code = input.defaultRateSourceCode;
  if (input.rateMaxAgeDays !== undefined) data.rate_max_age_days = input.rateMaxAgeDays;
  if (input.allowManualFxRate !== undefined) data.allow_manual_fx_rate = input.allowManualFxRate;
  if (input.manualFxRequiresApproval !== undefined) data.manual_fx_requires_approval = input.manualFxRequiresApproval;
  if (input.manualRateTolerancePct !== undefined) {
    data.manual_rate_tolerance_pct = input.manualRateTolerancePct === null ? null : new Prisma.Decimal(input.manualRateTolerancePct);
  }
  if (input.taxRateSourceCode !== undefined) data.tax_rate_source_code = input.taxRateSourceCode;
  return data;
}

/**
 * Any context flag turning OFF (false) in `patch`, or a full deactivation,
 * runs the C4 usage guard. Deliberately conservative: it checks every usage
 * reason (not just the one context being turned off) rather than mapping
 * each flag to a narrow reason subset — a currency with open activity must
 * never lose a context it's actually being used for.
 */
function hasContextTurningOff(patch: CurrencyContextInput): boolean {
  return (
    patch.allowSales === false ||
    patch.allowPayments === false ||
    patch.allowCash === false ||
    patch.allowAr === false
  );
}

/** Full active portfolio for a tenant, base row first. */
export async function listPortfolio(tenantId: string): Promise<CurrencyPortfolioRow[]> {
  return withTenantContext(tenantId, async (tenant) => {
    const rows = await prisma.org_currency_cf.findMany({
      where: { tenant_org_id: tenant, rec_status: 1 },
      orderBy: [{ is_base_currency: 'desc' }, { currency_code: 'asc' }],
    });
    return rows.map(toPortfolioRow);
  });
}

export async function getCurrency(tenantId: string, currencyCode: string): Promise<CurrencyPortfolioRow | null> {
  return withTenantContext(tenantId, async (tenant) => {
    const row = await prisma.org_currency_cf.findFirst({
      where: { tenant_org_id: tenant, currency_code: currencyCode, rec_status: 1 },
    });
    return row ? toPortfolioRow(row) : null;
  });
}

/** Add a foreign currency to the tenant's portfolio (contexts default off). */
export async function addCurrency(
  tenantId: string,
  currencyCode: string,
  input: AddCurrencyInput,
  actor: CurrencyActor
): Promise<CurrencyPortfolioRow> {
  assertPricingMode(input.salesPricingMode);
  await assertPlatformEnabled(currencyCode);

  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_currency_cf.findFirst({
      where: { tenant_org_id: tenant, currency_code: currencyCode },
    });
    if (existing && existing.rec_status === 1) {
      throw new FxError(FX_ERROR.CURRENCY_ALREADY_EXISTS, `tenant ${tenant} currency ${currencyCode}`);
    }

    const data = {
      ...contextPatchData(input),
      ...policyPatchData(input),
    };

    const row = existing
      ? await prisma.org_currency_cf.update({
          where: { id: existing.id, tenant_org_id: tenant },
          data: { ...data, is_active: true, rec_status: 1, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
        })
      : await prisma.org_currency_cf.create({
          data: {
            tenant_org_id: tenant,
            currency_code: currencyCode,
            ...data,
            created_by: actor.userId,
            created_info: actor.reason ?? null,
          } as Prisma.org_currency_cfUncheckedCreateInput,
        });
    return toPortfolioRow(row);
  });
}

/**
 * Update context toggles / FX policy for an existing currency row (base or
 * foreign). Turning a context OFF runs the C4 usage guard first.
 */
export async function updateCurrency(
  tenantId: string,
  currencyCode: string,
  input: UpdateCurrencyInput,
  actor: CurrencyActor
): Promise<CurrencyPortfolioRow> {
  assertPricingMode(input.salesPricingMode);

  if (hasContextTurningOff(input)) {
    const usage = await checkCurrencyInUse(tenantId, currencyCode);
    if (usage.inUse) {
      throw new FxError(
        FX_ERROR.CURRENCY_IN_USE,
        `tenant ${tenantId} currency ${currencyCode}: ${usage.reasons.join(', ')}`
      );
    }
  }

  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_currency_cf.findFirst({
      where: { tenant_org_id: tenant, currency_code: currencyCode, rec_status: 1 },
    });
    if (!existing) {
      throw new FxError(FX_ERROR.CURRENCY_NOT_FOUND, `tenant ${tenant} currency ${currencyCode}`);
    }

    const row = await prisma.org_currency_cf.update({
      where: { id: existing.id, tenant_org_id: tenant },
      data: {
        ...contextPatchData(input),
        ...policyPatchData(input),
        updated_at: new Date(),
        updated_by: actor.userId,
        updated_info: actor.reason ?? null,
      },
    });
    return toPortfolioRow(row);
  });
}

/**
 * C6: set the tenant's base (functional) currency. This pre-check exists
 * only to return a clean FxError instead of a raw Postgres trigger
 * exception — `fn_orgcur_base_lock` (migration 0532) is the authoritative
 * enforcement and will reject this regardless if an order slipped in
 * between the check and the write.
 */
export async function setBaseCurrency(
  tenantId: string,
  currencyCode: string,
  actor: CurrencyActor
): Promise<CurrencyPortfolioRow> {
  await assertPlatformEnabled(currencyCode);

  return withTenantContext(tenantId, async (tenant) => {
    const [hasOrders, currentBase, target] = await Promise.all([
      prisma.org_orders_mst.count({ where: { tenant_org_id: tenant } }).then((n) => n > 0),
      prisma.org_currency_cf.findFirst({ where: { tenant_org_id: tenant, is_base_currency: true, rec_status: 1 } }),
      prisma.org_currency_cf.findFirst({ where: { tenant_org_id: tenant, currency_code: currencyCode } }),
    ]);

    if (currentBase?.currency_code === currencyCode) {
      return toPortfolioRow(currentBase); // already the base — no-op, not an error
    }
    if (hasOrders) {
      throw new FxError(FX_ERROR.BASE_CURRENCY_LOCKED, `tenant ${tenant} already has orders`);
    }

    return prisma.$transaction(async (tx) => {
      if (currentBase) {
        await tx.org_currency_cf.update({
          where: { id: currentBase.id, tenant_org_id: tenant },
          data: { is_base_currency: false, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
        });
      }

      const readyContextFlags = {
        allow_sales: true,
        allow_payments: true,
        allow_cash: true,
        allow_ar: true,
      };

      const row = target
        ? await tx.org_currency_cf.update({
            where: { id: target.id, tenant_org_id: tenant },
            data: {
              is_base_currency: true,
              is_reporting_currency: false, // base ≠ reporting (chk_orgcur_roles)
              is_active: true,
              rec_status: 1,
              ...readyContextFlags,
              updated_at: new Date(),
              updated_by: actor.userId,
              updated_info: actor.reason ?? null,
            },
          })
        : await tx.org_currency_cf.create({
            data: {
              tenant_org_id: tenant,
              currency_code: currencyCode,
              is_base_currency: true,
              ...readyContextFlags,
              created_by: actor.userId,
              created_info: actor.reason ?? null,
            } as Prisma.org_currency_cfUncheckedCreateInput,
          });
      return toPortfolioRow(row);
    });
  });
}

/** Set (or clear, with `currencyCode: null`) the tenant's reporting currency. */
export async function setReportingCurrency(
  tenantId: string,
  currencyCode: string | null,
  actor: CurrencyActor
): Promise<void> {
  if (currencyCode) await assertPlatformEnabled(currencyCode);

  await withTenantContext(tenantId, async (tenant) => {
    await prisma.$transaction(async (tx) => {
      await tx.org_currency_cf.updateMany({
        where: { tenant_org_id: tenant, is_reporting_currency: true },
        data: { is_reporting_currency: false, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
      });

      if (!currencyCode) return;

      const target = await tx.org_currency_cf.findFirst({
        where: { tenant_org_id: tenant, currency_code: currencyCode, rec_status: 1 },
      });
      if (!target) {
        throw new FxError(FX_ERROR.CURRENCY_NOT_FOUND, `tenant ${tenant} currency ${currencyCode}`);
      }
      if (target.is_base_currency) {
        throw new FxError(FX_ERROR.REPORTING_ALREADY_SET, 'reporting currency cannot equal the base currency');
      }
      await tx.org_currency_cf.update({
        where: { id: target.id, tenant_org_id: tenant },
        data: { is_reporting_currency: true, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
      });
    });
  });
}

/** C4: deactivate a foreign currency. Blocked for the base currency and for any currency in use. */
export async function deactivateCurrency(
  tenantId: string,
  currencyCode: string,
  actor: CurrencyActor
): Promise<void> {
  const existing = await getCurrency(tenantId, currencyCode);
  if (!existing) {
    throw new FxError(FX_ERROR.CURRENCY_NOT_FOUND, `tenant ${tenantId} currency ${currencyCode}`);
  }
  if (existing.isBaseCurrency) {
    throw new FxError(FX_ERROR.CANNOT_DEACTIVATE_BASE, `tenant ${tenantId} currency ${currencyCode}`);
  }

  const usage = await checkCurrencyInUse(tenantId, currencyCode);
  if (usage.inUse) {
    throw new FxError(FX_ERROR.CURRENCY_IN_USE, `tenant ${tenantId} currency ${currencyCode}: ${usage.reasons.join(', ')}`);
  }

  await withTenantContext(tenantId, async (tenant) => {
    await prisma.org_currency_cf.updateMany({
      where: { tenant_org_id: tenant, currency_code: currencyCode },
      data: { is_active: false, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
    });
  });
}

/** Reactivate a previously deactivated currency row (re-validates C2). */
export async function reactivateCurrency(
  tenantId: string,
  currencyCode: string,
  actor: CurrencyActor
): Promise<CurrencyPortfolioRow> {
  await assertPlatformEnabled(currencyCode);
  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_currency_cf.findFirst({
      where: { tenant_org_id: tenant, currency_code: currencyCode, rec_status: 1 },
    });
    if (!existing) {
      throw new FxError(FX_ERROR.CURRENCY_NOT_FOUND, `tenant ${tenant} currency ${currencyCode}`);
    }
    const row = await prisma.org_currency_cf.update({
      where: { id: existing.id, tenant_org_id: tenant },
      data: { is_active: true, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
    });
    return toPortfolioRow(row);
  });
}

export { CURRENCY_CONTEXT, MULTI_CURRENCY_READY_CONTEXTS };
