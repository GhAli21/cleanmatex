# B19 — Expiry and Idempotency Jobs

## Metadata
Backlog ID: B19 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: IMPLEMENTED (2026-07-24, uncommitted; migration `0429_b19_expiry_and_idempotency_jobs.sql` APPLIED (owner, 2026-07-24) to local + remote, verified — 3 cron jobs active, `expire-gift-cards` confirmed unscheduled, `finance_jobs:view`/`finance_jobs:run` seeded)
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
2. "Wallet/loyalty expiry (when policies exist)" — wallet genuinely has no policy surface anywhere (dormant, nothing to wire). Loyalty is different: `org_loyalty_programs_cf.points_expiry_days` is a REAL, live, tenant-editable policy (non-null on seeded tenants, has its own admin UI) — but `org_loyalty_txn_dtl` has no per-earn-lot expiry stamp and redemptions decrement one denormalized `points_balance` with no FIFO lot-consumption tracking. A correct per-lot expiry sweep cannot be computed without first building that allocation model (a real, separate loyalty-ledger feature). Building an approximate sweep risked wrongly zeroing out points a customer already redeemed — deferred, not implemented, documented as a known gap (not silently dropped).
3. "Ops job permission (B27)" does not exist — re-verified against migration 0411; B27 seeded 7 unrelated codes. Seeded `finance_jobs:view`/`finance_jobs:run` in this package's own migration, following B7's own precedent.
4. "Aging sweep [that] stamps aged PENDING legs" / "feeds the B30 worklist age column" — neither the column nor any sweep exist; the worklist's "Age" column has always rendered a raw creation timestamp. Implemented as a cheap, always-current, query-time `ageDays` computation instead — no schema change, no batch job, no staleness risk.
5. ERP posting-retry logic already existed (`ErpLitePostingEngineService.retry()`, idempotency-checked replay) but had **zero production callers anywhere** — not the scheduled runner this doc describes, not even a manual button. Built both: a conservative scheduled sweep (SYSTEM_ERROR exceptions only, bounded 24h window — every other exception type needs a human to fix the underlying config first and will never self-heal from a retry) and a manual "Retry" button on the Exception Workbench (any exception type/age, operator-initiated).

## Required outcome
Scheduled runners (per B7 infrastructure): gift-card expiry, wallet/loyalty expiry (when policies exist), pending-payment aging sweep feeding the B30 worklist, idempotency cleanup honoring D010 retention, ERP posting-retry over exceptions.

## Scope
Job registrations + runbooks; expiry event emission (breakage recognition deferred to B25).
**Frontend surface (rule 7):** jobs appear on the B07 ops-visibility screen (last run, next run, outcome counts, manual re-run action); expiry results visible on the respective GC/wallet/loyalty screens.

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

Backend services: `lib/services/finance-jobs.service.ts` — 3 job runners (gift-card expiry via the rewritten ledger+GL-aware `expireGiftCards`; idempotency-key TTL cleanup; ERP posting-retry over SYSTEM_ERROR exceptions) + `runFinanceJob()` run-log wrapper. Wallet/loyalty expiry NOT implemented this pass — see corrections above.
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
Jobs/workers: this package IS the jobs (3 registered: gift_card_expiry, idempotency_cleanup, erp_posting_retry).
Feature flag: none — each job's own eligibility query is its natural off-switch (e.g. an unconfigured/empty eligible set is a routine no-op); disabling a job means unscheduling its pg_cron entry, not a flag.
Rollout: STOP-AND-WAIT migration apply → owner commit → Preview QA.
Rollback: unschedule the 3 new pg_cron jobs, re-schedule the retired `expire-gift-cards` (function never dropped) — see migration 0429's own rollback notes for the full sequence.

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
