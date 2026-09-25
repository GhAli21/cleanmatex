/**
 * Tenant Guard — Prisma client extension ($extends) that checks every query on a
 * tenant-scoped model carries an explicit tenant_org_id constraint.
 *
 * Replaces the legacy `$use` middleware (lib/prisma-middleware.ts), which was silently
 * never registered on Prisma 6 (`$use` removed) — so for its whole life no query was
 * ever auto-filtered. Tenant Guard Restoration package:
 * docs/features/Tenant_Guard_Restoration/IMPLEMENTATION_PLAN.md
 *
 * Design rules (deliberate, do not "improve" them away):
 * - The guard NEVER injects a filter. Silently adding `tenant_org_id` changes what a
 *   query means (a findUnique-by-id that should 404 would instead return someone's
 *   row or null depending on context). It only logs (mode `log`) or rejects (`enforce`).
 * - Scope is derived from the Prisma datamodel: any model with a `tenant_org_id` field.
 *   `org_tenants_mst` has no tenant_org_id — its own `id` IS the tenant, so it is
 *   guarded on `id`.
 * - When a tenant context is active (withTenantContext), a query naming a different
 *   tenant is a violation too — catches mixed-up tenant IDs, not just missing ones.
 * - Legitimate cross-tenant work (cron sweeps, platform jobs) must opt out explicitly
 *   via withTenantGuardBypass(reason, fn) so every exception is greppable.
 * - Raw SQL ($queryRaw/$executeRaw) is NOT inspectable here; covered by the static
 *   audit script (scripts/audit-tenant-guard.ts) instead.
 */

import { appendFileSync } from 'node:fs';
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { getTenantId } from './tenant-context';

/** Extension argument shape accepted by $extends (type-only; nothing runs at import). */
type PrismaExtensionArg = Extract<Parameters<typeof Prisma.defineExtension>[0], { query?: unknown }>;

// ─── Types ────────────────────────────────────────────────────────────────

/** `log` = record + warn and let the query run; `enforce` = throw before it runs. */
export type TenantGuardMode = 'log' | 'enforce';

/** Why a query was flagged. */
export type TenantGuardReason =
  | 'MISSING_TENANT_FILTER' // where / data has no tenant constraint at all
  | 'TENANT_MISMATCH'; // query names a tenant other than the active tenant context

/** One recorded violation (deduplicated by model+operation+reason+callsite). */
export interface TenantGuardViolation {
  model: string;
  operation: string;
  reason: TenantGuardReason;
  callsite: string; // first application stack frame, repo-relative when possible
  contextTenantId: string | null;
  queryTenantIds: string[];
}

/** Thrown in `enforce` mode. Callers should treat it as a programming error (500). */
export class TenantGuardViolationError extends Error {
  readonly violation: TenantGuardViolation;

  /** @param violation - the violation that triggered the rejection */
  constructor(violation: TenantGuardViolation) {
    super(
      `[TenantGuard] ${violation.reason} on ${violation.model}.${violation.operation} ` +
        `(callsite: ${violation.callsite}). Add an explicit tenant_org_id filter, ` +
        'or wrap a legitimate cross-tenant job in withTenantGuardBypass(reason, fn).'
    );
    this.name = 'TenantGuardViolationError';
    this.violation = violation;
  }
}

// ─── Mode ─────────────────────────────────────────────────────────────────

/**
 * Resolve the guard mode from `TENANT_GUARD_MODE`.
 * Phase 1 (log-only discovery) defaults to `log`; Phase 3 flips the default to `enforce`.
 *
 * @returns the active mode; unknown values fall back to the default
 */
export function getTenantGuardMode(): TenantGuardMode {
  const raw = process.env.TENANT_GUARD_MODE?.trim().toLowerCase();
  if (raw === 'enforce' || raw === 'log') return raw;
  return 'log';
}

// ─── Scoped-model catalog (from the Prisma datamodel) ─────────────────────

/** Per-model guard metadata. */
interface ScopedModel {
  keyField: 'tenant_org_id' | 'id'; // column that identifies the tenant for this model
  tenantRelationFields: string[]; // relation fields whose FK is tenant_org_id (nested connect)
}

/** org_tenants_mst's primary key is the tenant id itself. */
const TENANT_ROOT_MODEL = 'org_tenants_mst';

let scopedModelsCache: Map<string, ScopedModel> | null = null;

function getScopedModels(): Map<string, ScopedModel> {
  if (scopedModelsCache) return scopedModelsCache;
  const map = new Map<string, ScopedModel>();
  for (const model of Prisma.dmmf.datamodel.models) {
    if (model.name === TENANT_ROOT_MODEL) {
      map.set(model.name, { keyField: 'id', tenantRelationFields: [] });
      continue;
    }
    if (!model.fields.some((f) => f.name === 'tenant_org_id')) continue;
    // Only the direct tenant relation (FK is exactly [tenant_org_id]); composite
    // relations like [branch_id, tenant_org_id] have connect.id = the branch, not a tenant.
    const tenantRelationFields = model.fields
      .filter((f) => {
        const from = f.relationFromFields ?? [];
        return f.kind === 'object' && from.length === 1 && from[0] === 'tenant_org_id';
      })
      .map((f) => f.name);
    map.set(model.name, { keyField: 'tenant_org_id', tenantRelationFields });
  }
  scopedModelsCache = map;
  return map;
}

/**
 * @param model - Prisma model name
 * @returns true when queries on this model must carry a tenant constraint
 */
export function isTenantScopedModel(model: string): boolean {
  return getScopedModels().has(model);
}

// ─── Constraint extraction ────────────────────────────────────────────────

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** Result of inspecting a where/data object for a tenant constraint. */
interface Constraint {
  scoped: boolean;
  tenantIds: string[]; // concrete tenant ids named (for the mismatch check)
}

const UNSCOPED: Constraint = { scoped: false, tenantIds: [] };

/** Interpret the value of a `tenant_org_id` (or `id` on the root model) key. */
function readKeyValue(value: unknown): Constraint {
  if (value === undefined) return UNSCOPED;
  // null is a legitimate constraint on nullable-tenant tables (global rows).
  if (value === null) return { scoped: true, tenantIds: [] };
  if (typeof value === 'string') return { scoped: true, tenantIds: [value] };
  if (isPlainObject(value)) {
    if (typeof value.equals === 'string') return { scoped: true, tenantIds: [value.equals] };
    if (value.equals === null) return { scoped: true, tenantIds: [] };
    if (Array.isArray(value.in) && value.in.length > 0 && value.in.every((v) => typeof v === 'string')) {
      return { scoped: true, tenantIds: value.in as string[] };
    }
  }
  // not / notIn / contains etc. do not pin a tenant.
  return UNSCOPED;
}

function merge(a: Constraint, b: Constraint): Constraint {
  return { scoped: a.scoped || b.scoped, tenantIds: [...a.tenantIds, ...b.tenantIds] };
}

/**
 * Inspect a where clause. Scoped when the key is constrained at the top level,
 * inside AND, inside a compound unique key (e.g. `tenant_org_id_id`), or in EVERY
 * branch of an OR. NOT and relation filters never count.
 */
export function extractWhereConstraint(where: unknown, keyField: string): Constraint {
  if (!isPlainObject(where)) return UNSCOPED;
  let result = readKeyValue(where[keyField]);

  const and = where.AND;
  for (const clause of Array.isArray(and) ? and : and !== undefined ? [and] : []) {
    result = merge(result, extractWhereConstraint(clause, keyField));
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const branches = where.OR.map((clause) => extractWhereConstraint(clause, keyField));
    if (branches.every((b) => b.scoped)) {
      result = merge(result, { scoped: true, tenantIds: branches.flatMap((b) => b.tenantIds) });
    }
  }

  // Compound unique inputs: { tenant_org_id_order_no: { tenant_org_id, order_no } }
  for (const [key, value] of Object.entries(where)) {
    if (key === keyField || key === 'AND' || key === 'OR' || key === 'NOT') continue;
    if (key.includes(keyField) && isPlainObject(value) && keyField in value) {
      result = merge(result, readKeyValue(value[keyField]));
    }
  }
  return result;
}

/** Inspect create data: direct column, or nested `connect` on the tenant relation. */
export function extractDataConstraint(data: unknown, meta: ScopedModel): Constraint {
  if (!isPlainObject(data)) return UNSCOPED;
  let result = readKeyValue(data[meta.keyField]);
  for (const rel of meta.tenantRelationFields) {
    const relValue = data[rel];
    if (isPlainObject(relValue) && isPlainObject(relValue.connect)) {
      result = merge(result, readKeyValue(relValue.connect.id));
    }
  }
  return result;
}

/** Operations whose tenant scope lives in `args.where`. */
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

/** Operations whose tenant scope lives in `args.data` (one row or many). */
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * Decide whether one query is correctly tenant-scoped.
 *
 * @param model - Prisma model name
 * @param operation - Prisma operation (findMany, update, ...)
 * @param args - the query args as passed by the caller
 * @param contextTenantId - active tenant from withTenantContext, or null
 * @returns the violation reason, or null when the query is acceptable
 */
export function evaluateTenantScope(
  model: string,
  operation: string,
  args: unknown,
  contextTenantId: string | null
): { reason: TenantGuardReason; tenantIds: string[] } | null {
  const meta = getScopedModels().get(model);
  if (!meta) return null;
  const a = isPlainObject(args) ? args : {};

  let constraint: Constraint;
  if (WHERE_OPERATIONS.has(operation)) {
    constraint = extractWhereConstraint(a.where, meta.keyField);
    // An update must not move a row into another tenant.
    if (operation.startsWith('update') && isPlainObject(a.data)) {
      const moved = readKeyValue(a.data[meta.keyField]);
      constraint = { ...constraint, tenantIds: [...constraint.tenantIds, ...moved.tenantIds] };
    }
  } else if (CREATE_OPERATIONS.has(operation)) {
    const rows = Array.isArray(a.data) ? a.data : [a.data];
    const each = rows.map((row) => extractDataConstraint(row, meta));
    constraint = {
      scoped: each.length > 0 && each.every((c) => c.scoped),
      tenantIds: each.flatMap((c) => c.tenantIds),
    };
  } else if (operation === 'upsert') {
    const where = extractWhereConstraint(a.where, meta.keyField);
    const create = extractDataConstraint(a.create, meta);
    constraint = { scoped: where.scoped && create.scoped, tenantIds: [...where.tenantIds, ...create.tenantIds] };
  } else {
    // Unknown/new operation: treat as unscoped so it surfaces instead of slipping through.
    constraint = UNSCOPED;
  }

  if (!constraint.scoped) return { reason: 'MISSING_TENANT_FILTER', tenantIds: constraint.tenantIds };
  if (contextTenantId && constraint.tenantIds.some((id) => id !== contextTenantId)) {
    return { reason: 'TENANT_MISMATCH', tenantIds: constraint.tenantIds };
  }
  return null;
}

// ─── Bypass ───────────────────────────────────────────────────────────────

const bypassStorage = new AsyncLocalStorage<string>();
const loggedBypassReasons = new Set<string>();

/**
 * Run legitimately cross-tenant work (platform sweeps, outbox processors, seeding)
 * without the guard. Every call site is an audited exception — keep the list in
 * docs/features/Tenant_Guard_Restoration/STATUS.md.
 *
 * @param reason - short stable description, e.g. 'finance-outbox-sweep'
 * @param fn - work to run unguarded
 * @returns fn's result
 * @example
 * await withTenantGuardBypass('notifications-outbox-sweep', () =>
 *   prisma.org_ntf_outbox_tr.findMany({ where: { status: 'PENDING' } })
 * );
 */
export function withTenantGuardBypass<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  if (!reason.trim()) throw new Error('[TenantGuard] withTenantGuardBypass requires a reason');
  if (!loggedBypassReasons.has(reason)) {
    loggedBypassReasons.add(reason);
    console.info(`[TenantGuard] bypass active: ${reason}`);
  }
  // Await INSIDE the scope: Prisma queries are lazy thenables that only execute on
  // .then(); returning one unawaited would run it after the scope has exited.
  return bypassStorage.run(reason, async () => await fn());
}

// ─── Violation recording ──────────────────────────────────────────────────

const violations = new Map<string, TenantGuardViolation>();

// Call-time capture (see withTenantGuardCallsites): the Error is created where the
// query was written; its stack is only formatted if a violation is recorded.
const callsiteStorage = new AsyncLocalStorage<Error>();

/** First stack frame outside node_modules and the Prisma wrappers — the offending query site. */
function findCallsite(): string {
  const origin = callsiteStorage.getStore() ?? new Error();
  const frames = (origin.stack ?? '').split('\n').slice(1);
  for (const frame of frames) {
    const normalized = frame.replace(/\\/g, '/');
    if (
      normalized.includes('node_modules') ||
      normalized.includes('lib/db/tenant-guard') ||
      normalized.includes('lib/db/prisma-performance') ||
      normalized.includes('node:internal') ||
      !normalized.includes('/')
    ) {
      continue;
    }
    const idx = normalized.indexOf('web-admin/');
    return (idx >= 0 ? normalized.slice(idx + 'web-admin/'.length) : normalized)
      .replace(/^\s*at\s+/, '')
      .replace(/\)$/, '');
  }
  return 'unknown';
}

function record(violation: TenantGuardViolation): void {
  const key = `${violation.model}|${violation.operation}|${violation.reason}|${violation.callsite}`;
  if (violations.has(key)) return;
  violations.set(key, violation);
  console.warn(
    `[TenantGuard] ${violation.reason} ${violation.model}.${violation.operation} at ${violation.callsite}`
  );
  // Phase 1 discovery: collect across jest workers / dev sessions into one JSONL file.
  const reportFile = process.env.TENANT_GUARD_REPORT_FILE;
  if (reportFile) {
    try {
      appendFileSync(reportFile, `${JSON.stringify(violation)}\n`);
    } catch {
      // Reporting must never break the query path.
    }
  }
}

/** @returns deduplicated violations seen by this process (tests / diagnostics) */
export function getTenantGuardViolations(): TenantGuardViolation[] {
  return [...violations.values()];
}

/** Clear recorded violations (tests only). */
export function resetTenantGuardViolations(): void {
  violations.clear();
}

// ─── Extension ────────────────────────────────────────────────────────────

/**
 * Check one query and log or reject it. Exported for unit tests; runtime code
 * goes through tenantGuardExtension.
 *
 * @throws TenantGuardViolationError in `enforce` mode when the query is not scoped
 */
export function checkTenantGuard(model: string | undefined, operation: string, args: unknown): void {
  if (!model || bypassStorage.getStore()) return;
  const contextTenantId = getTenantId();
  const verdict = evaluateTenantScope(model, operation, args, contextTenantId);
  if (!verdict) return;
  const violation: TenantGuardViolation = {
    model,
    operation,
    reason: verdict.reason,
    callsite: findCallsite(),
    contextTenantId,
    queryTenantIds: [...new Set(verdict.tenantIds)],
  };
  record(violation);
  if (getTenantGuardMode() === 'enforce') throw new TenantGuardViolationError(violation);
}

/**
 * Prisma client extension. Applies to the base client and to interactive
 * `$transaction` clients created from it.
 */
// Plain object (not Prisma.defineExtension): the jsdom unit suite resolves
// @prisma/client to its browser build, where defineExtension throws at import time.
export const tenantGuardExtension = {
  name: 'tenant-guard',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        checkTenantGuard(model, operation, args);
        return query(args);
      },
    },
  },
} satisfies PrismaExtensionArg;

// ─── Call-time binding ────────────────────────────────────────────────────

const PROMISE_METHODS = ['then', 'catch', 'finally'] as const;

/**
 * Bind a lazy PrismaPromise to the async context of the line that created it.
 *
 * Prisma model calls return thenables that only run (and only reach query
 * extensions) when .then() is first called — often after the caller's scope has
 * exited (`return prisma.x.findFirst(...)` from inside withTenantContext, or a
 * Promise.all built earlier). Without this, the guard would see no tenant context,
 * no bypass scope and a stack made only of Prisma internals.
 */
function bindToCallContext<T>(result: T): T {
  if (!result || typeof (result as { then?: unknown }).then !== 'function') return result;
  const resource = callsiteStorage.run(new Error(), () => new AsyncResource('TenantGuardQuery'));
  const target = result as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const method of PROMISE_METHODS) {
    const original = target[method];
    if (typeof original !== 'function') continue;
    target[method] = (...a: unknown[]) => resource.runInAsyncScope(original, result, ...a);
  }
  return result;
}

function wrapDelegate(delegate: object): object {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => bindToCallContext(value.apply(target, args));
    },
  });
}

/**
 * Wrap the (already $extends-ed) client so every tenant-scoped model call and every
 * interactive-transaction client records its call site and async context at call
 * time. Enforcement itself stays in tenantGuardExtension.
 *
 * @param client - the extended Prisma client
 * @returns a proxy with the same surface as client
 */
export function withTenantGuardCallsites<T extends object>(client: T): T {
  const delegates = new Map<PropertyKey, object>();
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && isTenantScopedModel(prop) && value && typeof value === 'object') {
        let wrapped = delegates.get(prop);
        if (!wrapped) {
          wrapped = wrapDelegate(value);
          delegates.set(prop, wrapped);
        }
        return wrapped;
      }
      if (prop === '$transaction' && typeof value === 'function') {
        return (first: unknown, ...rest: unknown[]) =>
          typeof first === 'function'
            ? value.call(target, (tx: object, ...more: unknown[]) => (first as (...a: unknown[]) => unknown)(withTenantGuardCallsites(tx), ...more), ...rest)
            : value.call(target, first, ...rest);
      }
      return value;
    },
  });
}
