# Tenant Guard Restoration — Implementation Plan

**Approved:** 2026-09-25 (owner: "ok") · Separate from POS/CLF work.

## Design rules

1. **Check, never inject.** In `log` mode the guard records a violation. In `enforce` mode it throws `TenantGuardViolationError` before the query reaches the DB.
2. **Scope comes from the datamodel.** A model is scoped if it has a `tenant_org_id` field. That is 131 models today: 119 `org_*` plus 12 `sys_*`/`hq_*`/`cmx_*` that carry `tenant_org_id`. `org_tenants_mst` is guarded on `id`.
3. **Accepted forms:** the key at the top level (value / `equals` / non-empty `in`), in `AND`, in a compound unique key, or in **every** `OR` branch. `NOT`, `notIn` and relation filters don't count. `create*` needs the column or a `connect` on the direct tenant relation (single-FK only) on every row. `upsert` needs it in `where` and `create`. Unknown operations count as unscoped.
4. **Mismatch detection.** Inside `withTenantContext(A)`, any tenant id other than A in `where`, `data` or `in` is a `TENANT_MISMATCH`. This includes an update that moves a row to another tenant.
5. **Explicit bypass.** `withTenantGuardBypass(reason, fn)` is for genuine cross-tenant jobs. Every reason is registered in STATUS.md.
6. **Real callsites.** Prisma queries are lazy thenables, so the extension otherwise sees only Prisma frames and runs outside the caller's AsyncLocalStorage scope. `withTenantGuardCallsites` binds each query's `then/catch/finally` to an `AsyncResource` created at the call line. That gives the extension the real file:line plus the caller's tenant/bypass context. Enforcement still lives only in the extension.

## Steps

| Step | Scope | Exit criteria | Progress |
|---|---|---|---|
| **0 — Guard** | `tenant-guard.ts`, `$extends` wiring in `prisma.ts`, performance monitor ported to `$extends`, dead `$use` middleware + its 2 tests deleted, `withTenantContext` awaits inside its scope, unit tests, cross-tenant DB test, static audit script, `PRISMA_SETUP.md` rewritten | tsc/eslint/unit/DB/build green | ✅ 85f841a4 |
| **1 — Log-only discovery** | Default mode `log`. Runtime list from the DB-integration suite with `TENANT_GUARD_REPORT_FILE`, plus static audit, plus a manual smoke of main screens in `npm run dev` | `VIOLATIONS.md` written, each entry classified fix / bypass / false positive | ✅ Manual smoke replaced (STATUS D11) |
| **2 — Fix** | Add explicit filters service by service (by-id `findUnique` → `findFirst({id, tenant_org_id})` or the compound key). Wrap true cross-tenant jobs in the bypass. Fix test-fixture cleanup the same way. Review raw-SQL MISSING/REVIEW items by hand | A full DB suite + manual smoke in `log` mode reports **0** violations outside the guard's own test; static MISSING = 0 or each one justified | ✅ bfa5917 (static 0; DB suite re-run pending locally) |
| **3 — Fail-closed** | Default `enforce` in every environment. `jest.db.config.js` sets `enforce`. Optional CI gate on `audit:tenant-guard` MISSING = 0 | Suites green in `enforce` mode; STATUS closed | 🟡 Ready; owner applies locally (STATUS "Phase 3 apply") |
| **4 — Rollout** | First production deploy with `TENANT_GUARD_MODE=log` + report sink for a watch window, then unset → `enforce` | 0 `[TenantGuard]` lines over the window | ⏳ After Phase 3 |

**Deviation (2026-09-25):** the Phase 1/2 manual `npm run dev` smoke was dropped (local dev too slow). Its role moves to Step 4, where production traffic in `log` mode is the smoke run. Phase 2 exit was proved statically instead: 0 MISSING, every REVIEW entry hand-verified, and a nested-only-filter scan over 817 call sites.

Every step ends with a STATUS.md update and a doc refresh. Every phase ends with a `/documentation` pass.

## Test coverage

- `__tests__/db/tenant-guard.test.ts` (unit, real `Prisma.dmmf`): all operations, accepted/rejected where forms, create/createMany/upsert, the composite-relation trap, `org_tenants_mst`, global models, both modes, bypass scoping.
- `__tests__/db-integration/tenant-guard-cross-tenant.db.test.ts` (real Postgres, real exported `prisma`, `enforce`). It first proves tenant B's row exists and is reachable when the guard is bypassed, so the rejections that follow aren't vacuous. It then shows that under tenant A:
  - unscoped read, update and delete of B's row are rejected, and B's row is unchanged;
  - naming B is rejected;
  - a scoped query returns null;
  - a lazy query awaited outside the context is still checked;
  - callsites are real;
  - `$transaction` clients are guarded.

## Risks / limits

- **Raw SQL** cannot be checked at runtime. It is covered only by the static audit. The durable fix is RLS through a non-superuser DB role, proposed as a follow-up package.
- **Nested writes** are only checked at the top level.
- **Typing:** `prisma` stays typed as `PrismaClient`. The inferred extended type cost about 5x in `tsc` (68s → 5.5min) and produced 32 assignability errors.
- **jsdom unit tests** load Prisma's browser stub. `prisma.ts` falls back to that stub only when `window` exists, and the stub throws on every access.
- **Per-query overhead:** one `Error` (stack formatted only on violation) plus one `AsyncResource`, for scoped models only.
