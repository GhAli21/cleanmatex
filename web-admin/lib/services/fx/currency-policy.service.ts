/**
 * Tenant currency policy resolver (§4.3, C10). The single decision point
 * every module (orders, payments, drawers, AR) calls instead of
 * re-implementing currency rules. Read-only; never writes.
 *
 * Layers: global active (sys_currency_cd.is_active — deliberately NOT
 * re-checking is_platform_enabled here; that is only an add-time/C2 gate, so
 * HQ delisting a currency never breaks a tenant's existing usage) → tenant
 * row active + context flag → C10 readiness (checked first, before any DB
 * read) → branch (T-B not built yet — always passes, reserved) → drawer
 * currency match for the CASH context when a drawerId is given.
 *
 * `reasonCode` is reserved for BLOCKING reasons (`allowed: false`).
 * `FX_RATE_STALE` is never blocking — a resolved-but-stale rate surfaces as
 * the separate `staleRateWarning` flag instead (mirrors the HQ/tenant
 * resolver's own "reported, not enforced" staleness policy).
 *
 * Permission gating is the caller's responsibility, same convention as every
 * other service here.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { resolveRate } from './fx-rate-resolver.service';
import { FX_ERROR, FxError } from './fx-errors';
import {
  CURRENCY_CONTEXT,
  CURRENCY_POLICY_REASON,
  MULTI_CURRENCY_READY_CONTEXTS,
  type CurrencyContext,
  type CurrencyPolicyReason,
} from '@/lib/constants/currency-fx';

export interface CheckCurrencyPolicyInput {
  tenantId: string;
  branchId?: string;
  drawerId?: string;
  context: CurrencyContext;
  currencyCode: string;
}

export interface CurrencyPolicyResult {
  allowed: boolean;
  reasonCode: CurrencyPolicyReason | null;
  requiresFx: boolean;
  /** Non-blocking: a rate was resolved but is past its configured max age. */
  staleRateWarning?: boolean;
}

function blocked(reasonCode: CurrencyPolicyReason, requiresFx = false): CurrencyPolicyResult {
  return { allowed: false, reasonCode, requiresFx };
}

/** C10-ready contexts only; the 4 flags org_currency_cf actually has today. */
function isContextAllowed(
  currency: { allow_sales: boolean; allow_payments: boolean; allow_cash: boolean; allow_ar: boolean },
  context: CurrencyContext
): boolean {
  switch (context) {
    case CURRENCY_CONTEXT.SALES:
      return currency.allow_sales;
    case CURRENCY_CONTEXT.PAYMENTS:
      return currency.allow_payments;
    case CURRENCY_CONTEXT.CASH:
      return currency.allow_cash;
    case CURRENCY_CONTEXT.AR:
      return currency.allow_ar;
    default:
      // Not-ready contexts are already rejected by the C10 fail-fast guard below.
      return false;
  }
}

export async function checkCurrencyPolicy(input: CheckCurrencyPolicyInput): Promise<CurrencyPolicyResult> {
  const { tenantId, branchId, drawerId, context, currencyCode } = input;

  // C10: fail fast, before any DB read — a not-ready context is never allowed, for any currency.
  if (!MULTI_CURRENCY_READY_CONTEXTS.includes(context)) {
    return blocked(CURRENCY_POLICY_REASON.CONTEXT_NOT_READY);
  }

  return withTenantContext(tenantId, async (tenant) => {
    const [globalCurrency, currency, base] = await Promise.all([
      prisma.sys_currency_cd.findUnique({ where: { code: currencyCode }, select: { is_active: true } }),
      prisma.org_currency_cf.findFirst({ where: { tenant_org_id: tenant, currency_code: currencyCode, rec_status: 1 } }),
      prisma.org_currency_cf.findFirst({
        where: { tenant_org_id: tenant, is_base_currency: true, rec_status: 1 },
        select: { currency_code: true },
      }),
    ]);

    // Global active layer.
    if (!globalCurrency || !globalCurrency.is_active) {
      return blocked(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
    }

    // Tenant row active layer.
    if (!currency || !currency.is_active) {
      return blocked(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
    }

    // Context-allowed layer.
    if (!isContextAllowed(currency, context)) {
      return blocked(CURRENCY_POLICY_REASON.CONTEXT_NOT_ALLOWED);
    }

    // Branch layer — T-B (branch restriction) is not built yet; always passes, reserved for that stage.
    void branchId;

    // Drawer layer: CASH context with a drawer in scope must match the drawer's own currency.
    if (context === CURRENCY_CONTEXT.CASH && drawerId) {
      const drawer = await prisma.org_cash_drawers_mst.findFirst({
        where: {
          id: drawerId,
          tenant_org_id: tenant,
          ...(branchId && { branch_id: branchId }),
        },
        select: { currency_code: true },
      });
      if (!drawer || drawer.currency_code !== currencyCode) {
        return blocked(CURRENCY_POLICY_REASON.NO_DRAWER_IN_CURRENCY);
      }
    }

    if (!base) {
      // Should not happen — every tenant has a locked base row (migration 0532 backfill).
      // A read-only policy check reports it as not-enabled rather than throwing.
      return blocked(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
    }

    const requiresFx = currencyCode !== base.currency_code;
    if (!requiresFx) {
      return { allowed: true, reasonCode: null, requiresFx: false };
    }

    try {
      const resolved = await resolveRate(tenant, { from: currencyCode, to: base.currency_code });
      return { allowed: true, reasonCode: null, requiresFx: true, staleRateWarning: resolved.stale };
    } catch (error) {
      if (error instanceof FxError && error.code === FX_ERROR.RATE_NOT_FOUND) {
        return blocked(CURRENCY_POLICY_REASON.FX_RATE_MISSING, true);
      }
      throw error;
    }
  });
}
