# Tenant Guard Restoration — STATUS

**Authoritative progress file.** Last updated: 2026-09-25.

| Step | Status |
|---|---|
| 0 — Guard (`$extends`, tests, audit script, docs) | ✅ Done 2026-09-25 (uncommitted) |
| 1 — Log-only discovery | 🟡 Runtime (DB suite) + static done → [VIOLATIONS.md](VIOLATIONS.md). **Remaining:** manual smoke of main screens in `npm run dev` |
| 2 — Fix queries | ⏳ Not started |
| 3 — Fail-closed (`enforce` default) | ⏳ Not started |

## Gates (Step 0, 2026-09-25)

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors (~63s, unchanged from baseline) |
| `eslint --quiet` (changed files) | ✅ 0 |
| Unit `npx jest` | ✅ 329/329 suites, 2909 tests (incl. new `tenant-guard.test.ts` 28/28) |
| DB `tenant-guard-cross-tenant.db.test.ts` (`enforce`) | ✅ 9/9 |
| Full DB suite (`log`, in-band) | 115/117. The 2 failures are **not related to the guard**: `order-amendment-governed-flow` (the test's `calculateOrderTotals` mock has no `taxBreakdown`, which `order-service.ts:3239` now reads) and `wf-policy-issue-catalog-seed-invariants` 0472 case (raw SQL only, local seed data) |
| `npm run build` | ✅ |

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Guard checks and rejects, never injects | Injecting silently changes query meaning (owner requirement) |
| D2 | Scope = any model with `tenant_org_id` (131), not the `org_` prefix | 12 `sys_*`/`hq_*`/`cmx_*` models carry tenant rows too; `org_tenants_mst` has no `tenant_org_id` and is guarded on `id` |
| D3 | `prisma` typed as `PrismaClient`, not the inferred extended type | Extended type: tsc 68s → 5.5min + 32 errors; extensions are query-only |
| D4 | Call-time binding proxy (`withTenantGuardCallsites`) | Prisma clones args and runs extensions lazily, so without it callsites were all `unknown` and tenant context was lost |
| D5 | `withTenantContext` / bypass now `await` inside their ALS scope | Found by the DB test: `() => prisma.x.find()` returned unawaited ran outside the scope |
| D6 | Deleted `lib/prisma-middleware.ts`, `__tests__/db/prisma-middleware.test.ts`, `__tests__/db/prisma-error-scenarios.test.ts` | They only tested the dead `$use` path |
| D7 | Default mode `log` until Phase 3 | Phase 1 needs discovery without breaking flows |

## Bypass register (`withTenantGuardBypass` reasons in app code)

_None yet._ Candidates from Phase 1: gateway webhook intake, outbox sweeps (see VIOLATIONS §C).

## Next

1. Manual smoke in `npm run dev` with `TENANT_GUARD_REPORT_FILE` set; append to VIOLATIONS.md.
2. Phase 2: R1–R5 first, then static MISSING file by file, then fixtures, then the raw-SQL verdicts.
