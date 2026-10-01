# Tenant Guard Restoration — STATUS

**Authoritative progress file.** Last updated: 2026-10-01 (local verification session, paused before Phase 3 code edit — see "Local verification session" below).

| Step | Status |
|---|---|
| 0 — Guard (`$extends`, tests, audit script, docs) | ✅ Done 2026-09-25 (85f841a4) |
| 1 — Log-only discovery | ✅ Done. Runtime (DB suite) + static → [VIOLATIONS.md](VIOLATIONS.md). Manual dev smoke **replaced** by complete static coverage + production watch window (D11) |
| 2 — Fix queries | ✅ Done 2026-09-25. Static model MISSING 113 → **0**; all REVIEW verified; raw SQL all have a verdict |
| 2.5 — Local verification (laptop) | 🟡 **Partially done 2026-10-01** — prisma:generate + tsc confirmed clean of tenant-guard issues; DB-integration suite re-run and triaged (1 new non-guard gap found, see below); `npm run build` / `eslint` **not yet run** — blocked, needs owner decision (see "Open blocker" below) |
| 3 — Fail-closed (`enforce` default) | ⏳ **Not started.** No code edited yet. Waiting on the build/eslint gate above before touching `tenant-guard.ts` |

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

## Handoff to local (2026-09-25)

Work moved from the cloud session to the owner's laptop. State at handoff:

- Branch `claude/stoic-cray-0ojv6c` (both Phase 2 commit `bfa5917` and this docs update pushed). **No PR opened yet.**
- Nothing uncommitted. No migrations and no DB changes in this package.
- Cloud-only caveat: the container generated the Prisma client with CLI 6.19.2 against `@prisma/client` 6.18.0, which produced the 2 `prisma.ts:59` tsc errors. On the laptop run `npm run prisma:generate` with the repo's pinned versions first.

## Local verification session (2026-10-01)

**Branch correction:** `claude/stoic-cray-0ojv6c` is now an **ancestor of `main`** (verified via `git merge-base --is-ancestor` — both `85f841a4` and `bfa5917` are in `main`'s history). It was merged into `main` through one of the routine merge PRs sometime after handoff. **No checkout/PR step is needed** — Step 1 and 6 of the old "Next" list below are obsolete. All work continues directly on `main`.

**What was verified (read-only, nothing committed, no code edited):**

1. `npm run prisma:generate` (local pinned versions, 6.19.3) then `npx tsc --noEmit -p .` with `NODE_OPTIONS=--max-old-space-size=12288` → the cloud's 2 `prisma.ts:59` errors are **confirmed gone**. tsc did surface 4 *other* errors, all tracing to unrelated, already-uncommitted working-tree changes from the parallel POS Session & Cash Drawer Hardening / currency-profile package (`lib/constants/voucher.ts`, `add-line-dialog.tsx`, `database.generated.ts`/`database.ts` currency typing, a stale `recordMovement` reference) — **none touch any tenant-guard file**. Not fixed; out of scope for this package.
2. `npm run test:db-integration` (default, parallel workers) → 5 suites failed. Re-ran the same suite with `--runInBand` (serialized against the single shared local Postgres) → only **3** failed:
   - `order-amendment-governed-flow.db.test.ts` — known/expected (pre-existing, unrelated to guard).
   - `wf-policy-issue-catalog-seed-invariants.db.test.ts` (0472 case) — known/expected (pre-existing, local seed data).
   - `refund-concurrent-processing.db.test.ts` — **newly observed, NOT a `[TenantGuard]` violation.** Root-caused via `git log -L` on `order-refund.service.ts`: the test (B28 follow-up) was deliberately written against a "record-only CASH, no cash-drawer session" refund path; commit `38a973c0` ("feat(clf-r1): W4/W5/W6/W12/W14/W15 writer rewiring through the cash-drawer ledger" — the separate, in-progress CLF/Cash Ledger Foundation package) removed that record-only branch, so the test's fixture now fails `REFUND_CASH_DRAWER_SESSION_REQUIRED`. This is a gap for the **POS Session & Cash Drawer Hardening / CLF** work stream to fix, not tenant-guard. Documented here only so it isn't lost; not touched.
   - `cash-drawer-session-numbering-concurrency.db.test.ts` and `tenant-guard-cross-tenant.db.test.ts` (the guard's **own** cross-tenant proof suite) both **passed** once serialized — their earlier parallel-run failures (gapless-sequence mismatch; an `org_customers_mst` FK-violation on cleanup) were cross-suite races on the shared DB, not real bugs. **Conclusion: the guard's own DB-proof suite is green.**
   - **Process finding to carry forward:** `npm run test:db-integration` does not pass `--runInBand`, so running the full suite in parallel against one shared local Postgres produces false-positive failures from cross-suite interference. Re-run with `--runInBand` whenever a result looks surprising, before concluding something regressed.

**Open blocker — owner decision needed before Step 3 can proceed:**

`npm run build` / `npx eslint . --quiet` have **not** been run yet. The working tree has unrelated, uncommitted in-progress changes (POS Session & Cash Drawer Hardening / currency-profile package — see that feature's own STATUS.md) that already fail `tsc` on their own files (item 1 above). Running `build` as-is will fail on those, which would make it impossible to tell a tenant-guard build regression apart from the other package's known-incomplete state. Stashing that work to get an isolated clean read was proposed and **declined by the owner**. Needs an explicit owner call: either (a) stage/commit or otherwise park the other package's WIP first, (b) accept a non-isolated build/eslint run and have Claude manually confirm every resulting error traces to a non-tenant-guard file, or (c) some other approach the owner prefers. **Step 3's code edit (`tenant-guard.ts` default-mode flip) has not been made** — intentionally held until this gate is resolved, per the original instruction to run build/eslint before applying Phase 3.

> **Correction (2026-10-01, later same day):** the specific uncommitted files named in item 1 above (`voucher.ts`, `add-line-dialog.tsx`, `database.generated.ts`/`database.ts`, etc.) were committed in `ca948bbc` ("Continue in POS_Session_Cash_Drawer_Hardening and redesign cash drawer architecture and currency fx"). A **new** round of uncommitted WIP from the same POS/Currency-FX work stream is now sitting in the tree instead (cash-drawer-count/session/trx services, new cash-drawer API routes, `fx/*` services and tests). The blocker itself is unchanged in kind — the owner's other package is mid-flight and keeps producing fresh uncommitted files that `tsc`/`build` will trip over — but **do not trust the old filenames**; re-run `git status --short` fresh before diagnosing which errors are tenant-guard's and which aren't. Also note: `CLAUDE.md` Critical Rule #4 was independently strengthened in this window (explicit `tenant_org_id` predicate required in every query form — Prisma, Supabase client, raw SQL, joins). It reinforces rather than conflicts with this package's "check, never inject" design; no action needed on it from this package.

## Next (in order, on the laptop)

1. ~~`git fetch && git checkout claude/stoic-cray-0ojv6c` ...~~ — **obsolete**, branch already merged into `main`; stay on `main`.
2. ~~`npm run prisma:generate` / `tsc --noEmit`~~ — **done 2026-10-01**, clean of tenant-guard issues (see above).
3. ~~`npm run test:db-integration`~~ — **done 2026-10-01** (serialized), triaged (see above). Only the 2 originally-known failures remain guard-relevant-clean; the 3rd (`refund-concurrent-processing`) is a separate package's gap, not this one's.
4. **Resolve the open blocker above**, then run `npm run build` and `npx eslint . --quiet` in `web-admin/`.
5. Phase 3 apply (`tenant-guard.ts` `getTenantGuardMode()` default flip to `enforce`, JSDoc + `PRISMA_SETUP.md` update, new unit tests in `__tests__/db/tenant-guard.test.ts`), then re-run the DB-integration suite (`--runInBand`); it now runs in `enforce` and must show no *new* failures beyond the 2 known + the 1 separate-package gap above.
6. Update STATUS.md / CHANGELOG.md / IMPLEMENTATION_PLAN.md marking Phase 3 done, with gate results.
7. Open PR `main` → (or whatever branch the owner designates) — **do not push without explicit owner go-ahead.**
8. Step 4 rollout (IMPLEMENTATION_PLAN): production in `log` for the watch window, then `enforce`.
9. Optional hardening: make `audit:tenant-guard` exit non-zero when model MISSING > 0 and add it to CI.
