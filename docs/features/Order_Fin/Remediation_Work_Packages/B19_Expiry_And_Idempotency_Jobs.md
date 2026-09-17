# B19 — Expiry and Idempotency Jobs

## Metadata
Backlog ID: B19 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: IMPLEMENTED (2026-07-24, uncommitted; migration `0429_b19_expiry_and_idempotency_jobs.sql` APPLIED (owner, 2026-07-24) to local + remote, verified — 3 cron jobs active, `expire-gift-cards` confirmed unscheduled, `finance_jobs:view`/`finance_jobs:run` seeded). **Loyalty points FIFO ledger + expiry job IMPLEMENTED 2026-09-17, migration `0511_b19_loyalty_points_fifo_expiry.sql` APPLIED (owner, 2026-09-17) local + remote, verified** — the one deferred item (see "Corrections found during implementation" #2 below) is now closed. Owner-authorized full re-scope: "implement B19 loyalty FIFO ledger following best practices, production-ready, no gaps, no bugs, UI/UX best practices" (previously scoped OUT of the session as new-feature-sized; owner reversed that call).
Authoritative report sections: §45, §33 (expiry rows), §50-B19
Required decisions: [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md) (breakage interaction), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md) (key retention)
Dependencies: [B07](B07_Financial_Outbox_Processor.md) (hard — job infrastructure)
Blocks: — · Recommended phase: Seq 9

## Confirmed problem
`expireGiftCards` exists with zero callers (DISCONNECTED); wallet/loyalty expiry, pending-payment aging sweep, idempotency-key TTL cleanup, and posting-retry runners are NOT_FOUND (§45).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| gift-card-service.ts:1194 | expireGiftCards ready | no scheduler |
| org_idempotency_keys TTLs | expires_at stored | no cleaner |
| §45 required-paths list | four ordered recovery paths | unimplemented |

**Corrections found during implementation (2026-07-24):**
1. `expireGiftCards` is at line ~1349, not 1194 (file has grown) — and worse, it was a bare `updateMany` (zero ledger rows, zero ERP-Lite GL dispatch), not a ready-to-schedule function as the doc implied. A **separate, already-live** raw SQL cron (`expire-gift-cards`, migration 0296, confirmed ACTIVE in the remote DB, schedule `0 2 * * *`) has been silently auto-expiring gift cards with **zero lineage and zero GL** for an unknown period — completely independent of and uncoordinated with `expireGiftCards()`. Rewrote `expireGiftCards()` to loop the existing, correct, ledger+GL-aware `expireGiftCard()` per eligible card, and retired the competing raw cron in the same migration (mirrors B7's own retirement of the dead `outbox-worker` cron).
2. "Wallet/loyalty expiry (when policies exist)" — wallet genuinely has no policy surface anywhere (dormant, nothing to wire; still out of scope). Loyalty is different: `org_loyalty_programs_cf.points_expiry_days` is a REAL, live, tenant-editable policy (non-null on seeded tenants, has its own admin UI) — but `org_loyalty_txn_dtl` had no per-earn-lot expiry stamp and redemptions decremented one denormalized `points_balance` with no FIFO lot-consumption tracking. A correct per-lot expiry sweep couldn't be computed without first building that allocation model — deferred at the time, documented as a known gap. **CLOSED 2026-09-17** — see the "Loyalty points FIFO ledger" section below for the full design and implementation.
3. "Ops job permission (B27)" does not exist — re-verified against migration 0411; B27 seeded 7 unrelated codes. Seeded `finance_jobs:view`/`finance_jobs:run` in this package's own migration, following B7's own precedent.
4. "Aging sweep [that] stamps aged PENDING legs" / "feeds the B30 worklist age column" — neither the column nor any sweep exist; the worklist's "Age" column has always rendered a raw creation timestamp. Implemented as a cheap, always-current, query-time `ageDays` computation instead — no schema change, no batch job, no staleness risk.
5. ERP posting-retry logic already existed (`ErpLitePostingEngineService.retry()`, idempotency-checked replay) but had **zero production callers anywhere** — not the scheduled runner this doc describes, not even a manual button. Built both: a conservative scheduled sweep (SYSTEM_ERROR exceptions only, bounded 24h window — every other exception type needs a human to fix the underlying config first and will never self-heal from a retry) and a manual "Retry" button on the Exception Workbench (any exception type/age, operator-initiated).

## Required outcome
Scheduled runners (per B7 infrastructure): gift-card expiry, loyalty points expiry (**DONE 2026-09-17** — FIFO ledger; wallet expiry remains out of scope, no policy surface exists), pending-payment aging sweep feeding the B30 worklist, idempotency cleanup honoring D010 retention, ERP posting-retry over exceptions.

## Scope
Job registrations + runbooks; expiry event emission (breakage recognition deferred to B25).
**Frontend surface (rule 7):** jobs appear on the B07 ops-visibility screen (last run, next run, outcome counts, manual re-run action); expiry results visible on the respective GC/loyalty screens (loyalty: the customer detail page's Loyalty tab, `CustomerLoyaltyTab`, 2026-09-17).

## Out of scope
Breakage GL (B25); outbox runner itself (B7); snapshot-repair sweep (ships with B2 follow-up).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (expiry events later) |
| Snapshot | NO |
| Reconciliation | YES (aging visibility) |
| Customer receipt | NO |
| Audit/outbox | YES |

## Acceptance criteria
Expired-dated gift card flips to EXPIRED on schedule with ledger event; keys past retention are removed; aged PENDING legs appear in the worklist feed.

## Required tests
integration (schedules), idempotency (re-run safety), regression.

## Dependencies and sequencing
Hard after B7.

## Delivery surfaces

Backend services: `lib/services/finance-jobs.service.ts` — 3 job runners (gift-card expiry via the rewritten ledger+GL-aware `expireGiftCards`; idempotency-key TTL cleanup; ERP posting-retry over SYSTEM_ERROR exceptions) + `runFinanceJob()` run-log wrapper. Wallet/loyalty expiry NOT implemented this pass — see corrections above. **2026-09-17:** same service now also runs `outbox_processor` and ledger-aware `credit_note_expiry` (no GL) — see Follow-up below.
Database/schema: `sys_fin_job_run_log` (new run-history table) + 2 new SQL functions (`cleanup_expired_idempotency_keys`, `list_retryable_posting_exceptions`) + `finance_jobs:view`/`finance_jobs:run` permissions — migration 0429 (doc originally said "none new"; corrected during implementation, a run-log needs somewhere to live).
API/endpoints: `POST /api/finance/process-jobs` (bearer-secret, pg_cron-driven dispatcher for all 3 jobs); `GET /api/v1/finance/jobs` (last-run list); `POST /api/v1/finance/jobs/[jobCode]/run` (interactive manual trigger, ops-gated).
Frontend page/screen/dialog/action: Scheduled Jobs section appended to the B7 outbox ops-visibility screen (`/dashboard/internal_fin/outbox`) — job name/schedule/last run/status/outcome counts/manual Run Now button; a new Retry button/column on the Exception Workbench (`/dashboard/erp-lite/exceptions`); the pending-payments worklist's Age column now renders elapsed days (amber past 3) instead of a raw timestamp.
Reusable components/helpers: `finance-jobs-section.tsx` (new, self-contained); reuses B7's `sys_fin_runtime_cf` secret + `fin_trigger_...`/`net.http_post`/pg_cron pattern verbatim.
Permissions: `finance_jobs:view` / `finance_jobs:run` (seeded in this package's own migration — B27 does NOT already have an "ops job permission"; doc corrected).
Validation: job idempotency — re-run produces zero duplicate effects (an already-EXPIRED card, an already-cleaned key, and an already-RETRIED exception are all no-ops or skip conditions).
i18n/RTL: EN/AR job names/status (`billing.financeJobs.*`), age column (`billing.pendingPayments.columns.ageDays`, ICU plural), Retry button (`erpLite.exceptions.actions.retry`).
Accessibility: table semantics on both the Jobs section and the age column; hover tooltip retains the exact timestamp behind the age display.
Audit trail: `sys_fin_job_run_log` per job run (started/finished/counts/actor for manual); `org_fin_post_action_tr` for each manual exception retry (existing table, action_domain=EXCEPTION, action_code=RETRY).
Observability: run status/outcome counts visible on the ops screen; a job that throws is always finalized FAILED (never left stuck RUNNING).
Jobs/workers: this package IS the jobs (0429: `gift_card_expiry`, `idempotency_cleanup`, `erp_posting_retry`). **2026-09-17:** also `outbox_processor` (B07 wrap), `credit_note_expiry`, and `loyalty_points_expiry` — [FINANCE_JOBS_HUB.md](../Order_Fin_Docs/FINANCE_JOBS_HUB.md).
Feature flag: none — each job's own eligibility query is its natural off-switch (e.g. an unconfigured/empty eligible set is a routine no-op); disabling a job means unscheduling its pg_cron entry, not a flag.
Rollout: STOP-AND-WAIT migration apply → owner commit → Preview QA. Migrations 0429, 0505, and 0511 all APPLIED (owner) local + remote.
Rollback: unschedule the pg_cron jobs added by each migration; 0429's own rollback notes cover the original 3; 0511's own post-migration notes cover unscheduling `fin-loyalty-points-expiry`, restoring `chk_fjrl_job_code`/`fin_list_job_schedules()`, and dropping `org_loyalty_txn_allocs_dtl`/`remaining_points`.

## End-to-end operational flow (operator: ops)

- **Trigger:** system — each registered job fires on its schedule via pg_cron -> `fin_trigger_job()` -> `POST /api/finance/process-jobs` (gift-card expiry daily 02:00, idempotency cleanup daily 03:00, ERP posting-retry hourly :15). Operator trigger: manual re-run per job from the Scheduled Jobs section on the outbox ops screen; a separate manual Retry button on the Exception Workbench retries one specific exception (any type/age, not gated by the scheduled sweep's SYSTEM_ERROR-only/24h-window narrowing).
- **Permissions:** scheduled runs carry no actor (system); the Jobs section and manual-run route require `finance_jobs:view`/`finance_jobs:run`; the Exception Workbench's manual retry reuses the existing `erp_lite_post_audit:view` code (same as the pre-existing Resolve action).
- **API/system action:** `POST /api/finance/process-jobs` (bearer-secret) for scheduled runs; `GET /api/v1/finance/jobs` + `POST /api/v1/finance/jobs/[jobCode]/run` for interactive ops; `retryExceptionAction` server action for the per-exception manual retry.
- **Backend execution:** gift-card expiry loops every active tenant, calling the ledger+GL-aware `expireGiftCard()` per eligible card (one card's failure never blocks the rest); idempotency cleanup is a single cross-tenant SQL `DELETE ... WHERE expires_at < NOW()`; ERP posting-retry reads a bounded cross-tenant eligible set (SYSTEM_ERROR, ≤24h old) and replays each via the existing idempotency-checked `ErpLitePostingEngineService.retry()`.
- **Success path:** `sys_fin_job_run_log` records started/finished/processed/failed counts; a successful gift-card expiry shows the EXPIRED status + EXPIRE ledger row on the gift-card screen; a successful posting-retry marks the original exception RETRIED (drops out of the open-exceptions view); the Jobs section shows the green run.
- **Failure handling:** a job that throws mid-run still finalizes its run-log row as FAILED with the error captured (never left stuck RUNNING); one tenant's/exception's failure inside a job never blocks the rest of that same run.
- **Retry logic:** next scheduled run naturally re-processes remaining eligible rows; every job is idempotent by construction (status guards, `expires_at` comparisons, RETRIED status transitions) — re-running produces zero duplicate effects.
- **Audit logging:** `sys_fin_job_run_log` per run (schedule vs manual, actor for manual, counts, duration); each gift-card expiry still writes its own `EXPIRE` ledger row (unchanged from the pre-existing single-card path); each exception retry (manual or scheduled) writes an `org_fin_post_action_tr` audit row.
- **Observability:** the Jobs section's last-run status/outcome is the primary signal; a job stuck at RUNNING would indicate a crash bypassing the wrapper's own finally-equivalent handling (structurally shouldn't happen — `runFinanceJob()` always finalizes).
- **Recovery procedures:** failed run → fix the underlying cause, manual re-run (idempotent, safe); a systemically broken ERP mapping → fix the mapping, then use the Exception Workbench's manual Retry (not wait for the narrow scheduled sweep, which deliberately excludes non-SYSTEM_ERROR types); wrongly expired gift cards → no governed un-expire path exists in this package (out of scope — would need its own reversal design, same caution as B10's REVERSE).

## Completion evidence
Migration: `0429_b19_expiry_and_idempotency_jobs.sql` — **APPLIED (owner, 2026-07-24) to local + remote, verified via `mcp__supabase_remote_db` read-only queries** (3 cron jobs `fin-gift-card-expiry`/`fin-idempotency-cleanup`/`fin-erp-posting-retry` active; `expire-gift-cards` confirmed absent from `cron.job`; `finance_jobs:view`/`finance_jobs:run` both seeded). Owner also regenerated Supabase types. Adds `sys_fin_job_run_log` (run-history ledger), seeds `finance_jobs:view`/`finance_jobs:run`, adds `cleanup_expired_idempotency_keys()` + `list_retryable_posting_exceptions()` SQL functions, unschedules the competing `expire-gift-cards` cron (confirmed active in remote DB before this migration), registers 3 new pg_cron jobs (`fin-gift-card-expiry` daily 02:00, `fin-idempotency-cleanup` daily 03:00, `fin-erp-posting-retry` hourly :15) via a shared `fin_trigger_job()` dispatcher reusing B7's existing `sys_fin_runtime_cf` secret (no new secret minted).

Implementation files: `lib/services/gift-card-service.ts` (`expireGiftCards` rewritten — ledger+GL-aware loop, not a bare `updateMany`), `lib/services/finance-jobs.service.ts` (new — the 3 job runners + `runFinanceJob()` run-log wrapper + `listFinanceJobsLastRun()`), `lib/services/erp-lite-posting-engine.service.ts` + `lib/types/erp-lite-posting.ts` (widened `retry()`/`ErpLiteRetryParams` to accept an explicit `tenant_org_id` for the cross-tenant scheduled sweep), `lib/services/erp-lite-exceptions.service.ts` (new `retryException()` — manual retry + audit trail), `app/actions/erp-lite/ops-actions.ts` (new `retryExceptionAction`), `app/api/finance/process-jobs/route.ts` (new — bearer-secret dispatcher), `app/api/v1/finance/jobs/route.ts` + `app/api/v1/finance/jobs/[jobCode]/run/route.ts` (new — interactive list + manual-run routes), `lib/services/pending-payments-worklist.service.ts` + `app/api/v1/finance/pending-payments/route.ts` (query-time `ageDays` added, no schema change), `src/features/billing/ui/finance-jobs-section.tsx` (new — Jobs section, appended to the B7 outbox ops screen), `src/features/billing/ui/outbox-monitor-page.tsx` (wired in), `src/features/billing/ui/pending-payments-worklist-page.tsx` (age column now renders elapsed days, amber past 3), `src/features/erp-lite/ui/erp-lite-exceptions-screen.tsx` (new Retry button/column), `src/features/billing/access/billing-access.ts` + `src/features/erp-lite/access/erp-lite-access.ts` (new actions/apiDependencies entries), `prisma/schema.prisma` (hand-mirrored + `npx prisma generate`).

Tests: `__tests__/services/finance-jobs.service.test.ts` (new, 10 tests — per-job runner logic, run-log RUNNING→SUCCESS/FAILED lifecycle including a job that throws, `listFinanceJobsLastRun`), `__tests__/services/gift-card-service.test.ts` (+7 new — `expireGiftCard`/`expireGiftCards` ledger+GL behavior, mixed success/failure batch, zero-eligible no-op; all 46 pre-existing cases in the same file untouched and still passing), `__tests__/services/erp-lite-exceptions-retry.service.test.ts` (new, 2 tests — success marks RETRIED, failure leaves the exception open).

**Gates ALL GREEN:** tsc clean (3 pre-existing unrelated errors, none in any B19 file: `order-service.ts` ×2, `processing-piece-row.tsx` ×1 — all from the owner's own concurrent `order-service.ts` work, confirmed unrelated) · eslint 0 (project-wide) · targeted jest 65/65 across the 3 touched/new suites · full jest **232/232 suites, 2243/2243 tests — zero known failures** · `npm run build` ✓ (exit 0; all 3 new routes confirmed in the route manifest) · `check:i18n` ✓ (pre-existing benign EN=AR placeholder warnings only) · `check:ui-access-contract --wire` PASS for both touched routes (`/dashboard/internal_fin/outbox`, `/dashboard/erp-lite/exceptions`) · `sync:ui-access-contract` PASS (144/144 routes, drift 0; platform inventories regenerated).

Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —

### Follow-up — credit-note expiry + jobs hub (2026-09-17)

Migration **0505 APPLIED (owner, 2026-09-17) to local + remote**; types regenerated. Adds `outbox_processor` / `credit_note_expiry` to `chk_fjrl_job_code`, unique RUNNING index `uq_fjrl_one_running`, `fin_list_job_schedules()`, unschedules raw `expire-credit-notes`, schedules `fin-credit-note-expiry` at `5 2 * * *`. Credit-note expire is ledger-aware (`expireCreditNote` / `EXPIRY` txn, remaining 0) and does **not** invent GL. Overlap: MANUAL 409 `JOB_ALREADY_RUNNING`; SCHEDULE skip. Canonical runbook: [FINANCE_JOBS_HUB.md](../Order_Fin_Docs/FINANCE_JOBS_HUB.md). QA: §20.12–20.20.

### Follow-up — loyalty points FIFO ledger + expiry job (2026-09-17)

**Owner directive: "implement B19 loyalty FIFO ledger following best practices to build production-ready, with no gaps, no bugs, UI/UX best practices."** Closes the one item this package had deliberately left open (correction #2 above) — building the FIFO lot-consumption model the earlier pass correctly identified as a prerequisite for safe loyalty expiry, rather than an approximate sweep that risked wrongly zeroing out already-redeemed points.

**Migration `0511_b19_loyalty_points_fifo_expiry.sql` — APPLIED (owner, 2026-09-17) to local + remote, verified.**

- `org_loyalty_txn_dtl.remaining_points` (nullable `INTEGER`) — the unconsumed, unexpired balance of a "lot." Only meaningful on a credit row (`EARN`/`BONUS`/positive `ADJUST`, `points > 0`); `NULL` on debit rows (`REDEEM`/`EXPIRE`/negative `ADJUST`). Invariant, enforced by construction and asserted by the migration's own validation block: `SUM(remaining_points)` per `account_id` always equals `org_loyalty_accounts_mst.points_balance` for that account.
- New table `org_loyalty_txn_allocs_dtl` — one row per (debit txn, credit lot) draw, mirroring the existing `org_ar_credit_allocs_dtl` pattern (migration 0321). Full audit traceability: which specific earn(s)/bonus(es)/adjustment(s) funded a given redemption or expiry.
- A one-time backfill (`DO` block) replays every pre-existing txn row in chronological order per account to reconstruct `remaining_points` and allocation rows exactly as if FIFO tracking had existed from day one. **Verified 0 rows on this database both before and after** (no tenant had ever earned or redeemed a loyalty point) — the replay logic itself is written generally, not as an empty-table shortcut, and the migration's validation block would fail loudly on a populated environment with real drift.
- Registers `loyalty_points_expiry` on the existing B19/0505 finance-jobs-hub infrastructure (`sys_fin_job_run_log`, `fin_trigger_job`, `fin_list_job_schedules`) — daily `02:10`, after gift-card (`02:00`) and credit-note (`02:05`) expiry.

**Runtime wiring (`lib/services/loyalty.service.ts`):**

- `consumeLoyaltyLotsTx` — new internal helper. Every debit path (redeem, negative adjust, expiry) calls it after its own `org_loyalty_txn_dtl` row already exists: locks open lots (`remaining_points > 0`) oldest-first `FOR UPDATE`, draws down each until the requested amount is satisfied, writing one `org_loyalty_txn_allocs_dtl` row per lot drawn on. Throws `LOYALTY_LOT_ALLOCATION_SHORTFALL` if the open lots can't cover the request — this should never happen given the invariant above, so a shortfall means real ledger drift and must surface loudly, never silently under-allocate (same "fail loudly" posture `resolveLoyaltyRedemptionPoints` already documents for itself).
- `redeemPointsTx` — after creating the `REDEEM` row, consumes the redeemed amount from the oldest open lot(s).
- `processEarnPoints` — the new `EARN` row opens a fully-unconsumed lot (`remaining_points = earnPoints`).
- `adjustPointsTx` — a positive delta opens a new lot (`remaining_points = delta`); a negative delta consumes lots FIFO exactly like a redemption.
- `expireLoyaltyPointsForAccount(tenantId, accountId, cutoff)` — expires every open lot older than `cutoff` for one account in a single atomic sweep, aggregating all qualifying lots into **one** `EXPIRE` ledger row (full per-lot traceability still lives in the allocation table) rather than one row per lot — mirrors how a multi-lot redemption already produces one `REDEEM` row with N allocations. Idempotent per calendar day (`loyalty-expiry-${accountId}-${YYYY-MM-DD}`) — a same-day retry after a failure is a safe no-op.
- `expireLoyaltyPoints(tenantId)` — the scheduled-job entry point. No-ops immediately for a tenant with no active program or no `points_expiry_days` configured (dormant until an owner deliberately sets a policy, same posture as gift-card/credit-note expiry's own natural off-switches); otherwise finds every account with an open lot older than the cutoff and sweeps each.
- `getLoyaltyTransactions` / `getLoyaltyExpirySummary` — new read helpers powering the frontend below.

**Job registration (`lib/services/finance-jobs.service.ts`):** `FINANCE_JOB_CODES.LOYALTY_POINTS_EXPIRY`, a `FINANCE_JOB_CATALOG` entry (`fin-loyalty-points-expiry`, `10 2 * * *`, related link `/dashboard/marketing/loyalty`), and `runLoyaltyPointsExpiry()` in the `JOB_RUNNERS` dispatch table — the Scheduled Jobs section on the outbox ops screen picks it up automatically (registry-driven, no hardcoded job list to update there).

**Frontend — a real gap closed, not merely the expiry job:** the customer detail page's Loyalty tab (`/dashboard/customers/[id]` and `/dashboard/b2b/customers/[id]`, previously two byte-identical stub components) showed a **hardcoded** balance number and a static "No transactions yet" placeholder with zero i18n and zero real data — wired to nothing. Replaced both with one new shared `CustomerLoyaltyTab` (`src/features/customers/ui/customer-loyalty-tab.tsx`, Cmx components throughout): points balance / lifetime earned / current tier stat cards, an upcoming-expiry warning banner (FIFO lot-based — "N points expire on \<date\>"), and a real transaction history table (type badge, signed points, running balance, reference). Backed by a new server action `getCustomerLoyaltyDetail` (`app/actions/customers/loyalty-actions.ts`).

**Incidental bug found and fixed while wiring the tab:** `GET /api/v1/customers/[id]/loyalty` (an existing but completely orphaned route — zero callers anywhere before this pass) gated on `requirePermission('loyalty:view')`, a permission code that **was never seeded** — the route 403'd for every role since it was written. Corrected to `loyalty:view_customer_points` (the real, seeded, broadly-granted code). Extended the route's response with `transactions`/`expirySummary` alongside the existing `account`/`tier`, and registered it in both customer-detail pages' access contracts (`customers-access.ts`, `b2b-access.ts`) for the first time.

**Design decisions:**

- **Aggregate one EXPIRE row per sweep, not one per lot.** A customer could accumulate many small earn lots; per-lot EXPIRE rows would bloat the ledger for no operational benefit. Full per-lot lineage is preserved in `org_loyalty_txn_allocs_dtl` regardless.
- **Any credit row is a "lot," not just EARN.** `BONUS` and a positive `ADJUST` are fungible with `EARN` once in the balance — the tenant's expiry policy applies to all of them uniformly by `created_at`, avoiding txn-type special-casing in the FIFO/expiry queries.
- **Backfill correctness over an empty-table shortcut.** Verified 0 rows on this database, but the migration's `DO` block replays full FIFO history generically (not "since it's empty, just set remaining_points = points everywhere") — the identical logic is correct if this migration is ever applied to a populated environment, and its own validation block would catch drift instead of silently accepting it.
- **No GL/breakage posting.** Matches credit-note expiry's own precedent (the closer architectural sibling — simple balance decrement + EXPIRE ledger row, no GL) rather than gift-card expiry's fuller GL integration. Breakage recognition remains deferred to B25, consistent with this package's original "Out of scope" line.
- **Wallet points expiry remains out of scope.** No policy surface exists anywhere for it — unchanged from the original B19 deferral.

**Tests:** `__tests__/services/loyalty.service.test.ts` rewritten with a SQL-content-aware `$queryRaw` mock (distinguishes the account-lock query from the lot-consumption query so both can be stubbed independently within one debit call) — 38 tests total, new coverage: `redeemPointsTx` FIFO consumption (single lot, multi-lot span, shortfall-throws), `processEarnPoints` lot-opening, `adjustPointsTx` positive/negative FIFO behavior, `expireLoyaltyPointsForAccount` (aggregated EXPIRE row, no-op when nothing eligible, same-day idempotency, account-not-found), `expireLoyaltyPoints` (no-op without a policy, cross-account sweep), `getLoyaltyTransactions`, `getLoyaltyExpirySummary`. `__tests__/services/finance-jobs.service.test.ts` (+2 — loyalty job loop + one-tenant-failure isolation; fixed a pre-existing `toHaveLength(5)` assertion to `6` for the new catalog entry).

**Gates ALL GREEN:** tsc clean (0 errors) / eslint 0 (all new + changed files) / `check:i18n` ✓ (no new warnings) / `check:access-contracts` 10/10 (nav↔contract drift 0) / full jest **314/314 suites, 2779/2779 tests, zero regressions** / `npm run build` ✓ (exit 0, full route manifest; one transient Windows Prisma query-engine file-lock EPERM on the first attempt, self-resolved on retry — the same known non-code flake this program has hit and documented before). Migration 0511 applied and independently verified via remote read-only queries (`remaining_points` column, `org_loyalty_txn_allocs_dtl` table, `fin-loyalty-points-expiry` cron row, extended `chk_fjrl_job_code` all present).

Commit: pending (owner) · Preview QA: pending — needs a pilot tenant with an active loyalty program + `points_expiry_days` configured to exercise the expiry sweep; the FIFO redemption/adjustment paths are exercised by any live redemption today. QA_TEST_GUIDE needs a new scenario before VERIFIED.
