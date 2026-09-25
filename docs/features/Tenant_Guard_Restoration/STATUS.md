# Tenant Guard Restoration — STATUS

**Authoritative progress file.** Last updated: 2026-09-25.

| Step | Status |
|---|---|
| 0 — Guard (`$extends`, tests, audit script, docs) | ✅ Done 2026-09-25 (85f841a4) |
| 1 — Log-only discovery | ✅ Done. Runtime (DB suite) + static → [VIOLATIONS.md](VIOLATIONS.md). Manual dev smoke **replaced** by complete static coverage + production watch window (D11) |
| 2 — Fix queries | ✅ Done 2026-09-25. Static model MISSING 113 → **0**; all REVIEW verified; raw SQL all have a verdict |
| 3 — Fail-closed (`enforce` default) | 🟡 **Ready, awaiting owner apply** — see "Phase 3 apply" below |

## Gates (Phase 2, 2026-09-25, cloud container)

| Gate | Result |
|---|---|
| Unit `npx jest` | ✅ 330/330 suites, 2942 tests (was 2909; +webhook scoping tests, stricter tenant assertions) |
| `eslint --quiet` (48 changed files) | ✅ 0 |
| `tsc --noEmit` | ✅ no new errors. The container reports 2 errors in `lib/db/prisma.ts:59` (TS2859 excessive complexity) that also occur on the untouched baseline: this container's Prisma CLI is 6.19.2 and `@prisma/client` 6.18.0. Re-check locally with matching versions |
| Static audit | model MISSING **0**, REVIEW 95 (all hand-verified), BYPASS 2 · raw MISSING 7 / REVIEW 7 (all verdicts in VIOLATIONS §D) |
| Nested-only tenant filter scan (817 call sites) | ✅ 0. No call site filters tenant only through a relation, which `enforce` would reject |
| DB suite (`jest.db.config.js`) | ⏳ Not runnable here (no Postgres). **Run locally**, see Phase 3 apply |
| `npm run build` | ⏳ Not run here (same Prisma type issue + memory). Run locally |

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
| D8 | Outbox follow-up writes are scoped by the **claimed row's own** `tenant_org_id` (no bypass, no per-tenant loop) | `claimBatch` stays one cross-tenant SKIP LOCKED claim (raw SQL, fair batching); `markProcessed/markFailed/scheduleRetry(eventId, tenantId, …)` then write with a real tenant filter |
| D9 | Gateway webhook: bypass only for pre-resolution intake; tenant stamped with `where: { id, tenant_org_id: null }`; every later write scoped | One public endpoint serves all tenants; the tenant is only knowable after matching the leg. The NULL guard makes re-stamping to a different tenant impossible |
| D10 | Order-lock expiry cron = registered bypass | Global TTL sweep, deletes only expired rows, reads no tenant data. A per-tenant loop would need a cross-tenant tenant listing anyway |
| D11 | Manual dev smoke replaced | Local dev too slow (owner). Covered instead by: complete static coverage (0 MISSING, REVIEW verified, nested scan clean) + first production deploy in `log` with `TENANT_GUARD_REPORT_FILE`, then `enforce` |
| D12 | Phase 3 mode resolution: unset **or unknown** value → `enforce`; only literal `log` opts out | Fail-closed; a typo (`enfroce`) must not silently downgrade isolation |

## Bypass register (`withTenantGuardBypass` reasons in app code)

| Reason | Where | Scope of bypass |
|---|---|---|
| `gateway-webhook-intake` | `lib/services/gateway-webhook.service.ts` | Event-row insert (tenant NULL), payment-leg resolution by provider ids, UNMATCHED mark, one-time tenant stamp |
| `order-edit-locks-expiry-sweep` | `lib/services/order-lock.service.ts` `cleanupExpiredLocks()` | `deleteMany` of locks with `expires_at <= now()` |

The static audit lists these under **BYPASS**. A new bypass must be added here in the same PR.

## Phase 3 apply (owner)

The one-line default flip was **not** applied in the cloud session: the environment's safety policy blocked editing a shared security control without explicit owner sign-off. To apply:

1. `web-admin/lib/db/tenant-guard.ts` → `getTenantGuardMode()`:
   ```ts
   const raw = process.env.TENANT_GUARD_MODE?.trim().toLowerCase();
   return raw === 'log' ? 'log' : 'enforce';
   ```
   Update its JSDoc (D12) and the modes table in `lib/db/PRISMA_SETUP.md`.
2. Add a unit test to `__tests__/db/tenant-guard.test.ts`: unset → `enforce`, `'bogus'` → `enforce`, `'log'` → `log`.
3. Locally: `npm run test:db-integration` (now enforce by default; expect only the 2 known unrelated failures), `npx tsc --noEmit`, `npm run build`.
4. **Rollout:** first production deploy with `TENANT_GUARD_MODE=log` + `TENANT_GUARD_REPORT_FILE` (or log sink on `[TenantGuard]`) for a watch window (suggest 7 days of normal traffic). Fix anything reported, then remove the env var → `enforce`. Rollback = set `TENANT_GUARD_MODE=log` (no deploy needed).

## Next

1. Owner: Phase 3 apply (above).
2. Optional hardening: gate CI on `audit:tenant-guard` model MISSING == 0 (script already exits 0 today).
