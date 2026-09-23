import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { log } from '@/lib/utils/logger';
import {
  CASH_CONTROL_SCOPE_LEVEL,
  CASH_CONTROL_SCOPE_RESOLUTION_ORDER,
  CASH_CONTROL_SETTINGS_DEFAULT,
  CASH_CONTROL_SETTING_DEFS,
  type CashControlScopeLevel,
  type CashControlSettingDef,
  type CashControlSettings,
} from '@/lib/constants/cash-control';

/**
 * Future-ready scope. Add fields here; never add a second read function
 * (§3.1.3 rule 1 — POS Session & Cash Drawer Hardening).
 */
export interface CashControlScope {
  tenantId: string;
  branchId?: string | null;
  userId?: string | null;
  drawerId?: string | null;
  /** Reserved — not yet consulted by resolution. */
  terminalId?: string | null;
  /** Reserved — not yet consulted by resolution. */
  posSessionId?: string | null;
}

type CashControlOverrideRow = {
  scope_level: string;
} & Record<string, unknown>;

// -----------------------------------------------------------------------------
// Per-request memoization (§3.1.3 rule 6)
//
// A plain module-level cache would leak stale values across unrelated
// requests/tenants in a long-lived Node process, so memoization is scoped to
// an explicit AsyncLocalStorage context instead of being always-on. Wrap a
// burst of gate checks that belong to one logical operation (e.g. a single
// order submit) in `withCashControlSettingsCache` to get deduplication; a
// call made outside that wrapper is still fully correct, just not cached —
// correctness never depends on the wrapper being used.
// -----------------------------------------------------------------------------

const requestCacheStorage = new AsyncLocalStorage<Map<string, CashControlSettings>>();

export function withCashControlSettingsCache<T>(fn: () => Promise<T>): Promise<T> {
  return requestCacheStorage.run(new Map(), fn);
}

function buildCacheKey(scope: CashControlScope): string {
  return [scope.tenantId, scope.branchId ?? '', scope.userId ?? '', scope.drawerId ?? ''].join('|');
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

/**
 * The only code that touches org_fin_cash_ctrl_stng_cf (§3.1.3 rule 4).
 * Migrating storage later means rewriting this function alone.
 */
async function loadOverrides(
  scope: CashControlScope
): Promise<Partial<Record<CashControlScopeLevel, CashControlOverrideRow>>> {
  return withTenantContext(scope.tenantId, async (tenantId) => {
    const scopeFilters: { scope_level: CashControlScopeLevel; scope_id: string | null }[] = [
      { scope_level: CASH_CONTROL_SCOPE_LEVEL.TENANT, scope_id: null },
    ];
    if (scope.branchId) {
      scopeFilters.push({ scope_level: CASH_CONTROL_SCOPE_LEVEL.BRANCH, scope_id: scope.branchId });
    }
    if (scope.userId) {
      scopeFilters.push({ scope_level: CASH_CONTROL_SCOPE_LEVEL.USER, scope_id: scope.userId });
    }
    if (scope.drawerId) {
      scopeFilters.push({ scope_level: CASH_CONTROL_SCOPE_LEVEL.DRAWER, scope_id: scope.drawerId });
    }

    const rows = await prisma.org_fin_cash_ctrl_stng_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        OR: scopeFilters.map((f) => ({ scope_level: f.scope_level, scope_id: f.scope_id })),
      },
    });

    const byScope: Partial<Record<CashControlScopeLevel, CashControlOverrideRow>> = {};
    for (const row of rows) {
      byScope[row.scope_level as CashControlScopeLevel] = row as CashControlOverrideRow;
    }
    return byScope;
  });
}

/**
 * Never throws on bad data (§3.1.3 rule 5). An unparseable or
 * out-of-range stored value is logged at WARN and treated as absent at that
 * scope, so resolution falls through to the next scope / the TS default
 * instead. A malformed config row must never stop a cashier taking money.
 */
function coerceOverrideValue(
  def: CashControlSettingDef,
  raw: unknown,
  logContext: Record<string, unknown>
): CashControlSettings[keyof CashControlSettings] | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  if (def.type === 'boolean' && typeof raw === 'boolean') {
    return raw;
  }

  if (def.type === 'enum' && typeof raw === 'string' && (def.values as readonly string[]).includes(raw)) {
    return raw as CashControlSettings[keyof CashControlSettings];
  }

  if (def.type === 'number') {
    const num = raw instanceof Prisma.Decimal ? raw.toNumber() : typeof raw === 'number' ? raw : NaN;
    if (
      !Number.isNaN(num) &&
      (def.min === undefined || num >= def.min) &&
      (def.exclusiveMin === undefined || num > def.exclusiveMin)
    ) {
      return num;
    }
  }

  log.warn('cash-control: malformed setting value at scope, falling back to inherited/default value', {
    ...logContext,
    dbColumn: def.dbColumn,
  });
  return undefined;
}

function resolveSettings(
  byScope: Partial<Record<CashControlScopeLevel, CashControlOverrideRow>>,
  logContext: Record<string, unknown>
): CashControlSettings {
  const resolved: CashControlSettings = { ...CASH_CONTROL_SETTINGS_DEFAULT };

  for (const def of CASH_CONTROL_SETTING_DEFS) {
    for (const level of CASH_CONTROL_SCOPE_RESOLUTION_ORDER) {
      const row = byScope[level];
      if (!row) {
        continue;
      }
      const value = coerceOverrideValue(def, row[def.dbColumn], { ...logContext, scopeLevel: level });
      if (value !== undefined) {
        (resolved as unknown as Record<string, unknown>)[def.tsField] = value;
        break;
      }
    }
  }

  return resolved;
}

/**
 * Resolves the fully-populated, DRAWER -> USER -> BRANCH -> TENANT -> default
 * cash-control policy for a given scope. Always fully populated (§3.1.3 rule
 * 2) — every field is non-optional and every default is applied, so no
 * caller ever branches on `undefined`.
 */
export async function getCashControlSettings(scope: CashControlScope): Promise<CashControlSettings> {
  const cache = requestCacheStorage.getStore();
  const cacheKey = buildCacheKey(scope);
  const cached = cache?.get(cacheKey);
  if (cached) {
    return cached;
  }

  const logContext = {
    tenantId: scope.tenantId,
    branchId: scope.branchId ?? undefined,
    userId: scope.userId ?? undefined,
    drawerId: scope.drawerId ?? undefined,
  };

  let resolved: CashControlSettings;
  try {
    const byScope = await loadOverrides(scope);
    resolved = resolveSettings(byScope, logContext);
  } catch (error) {
    log.error(
      'cash-control: failed to resolve settings, falling back to defaults',
      error as Error,
      logContext
    );
    resolved = { ...CASH_CONTROL_SETTINGS_DEFAULT };
  }

  cache?.set(cacheKey, resolved);
  return resolved;
}

// -----------------------------------------------------------------------------
// Write side — updateCashControlSettings
//
// Deferred (POS_Session_Cash_Drawer_Hardening STATUS.md W0-4/W0-4b, D17): the
// write path is audited on every call (§3.1.3), and its audit table
// (org_fin_cash_ctrl_audit_dtl, migration 0516) has been written but not yet
// applied. Adding an unaudited write function here would violate "a control
// that can be silently turned off is not a control" — so this lands together
// with the audit table once 0516 is applied and its Prisma model exists.
// -----------------------------------------------------------------------------
