# Step 6 — Sweeps and delayed jobs: implementation plan

Status (25 Nov): **6a done in code (revised the same day to pure database for credit notes, Owner decision). 0823 applied on local by the Owner; `npm test --workspace=cmx-workers` green after two fixes (below). Remote: 0823 applied, web-admin + cmx-workers deployed, credit note cron on (25 Nov); gift card / loyalty queues and schedules still off.** **6b done in code, not committed (25 Nov): POS session rollover on cmx-workers (every effect is TypeScript-only: Z-report, cash-control settings, notifications), one 15-minute schedule + one `stately` queue calling the existing sweep; migration 0824 (dry-run passed, rolled back).** **Released (25 Nov): Owner applied 0824 local + remote, deployed cmx-workers, switched on the queue and the schedule. Verified on remote: `fin.pos_rollover.sweep` applied on 23:05:31 UTC, schedule `*/15 * * * *` UTC with `missed: once` applied 23:07:02 UTC; `pgboss.queue` policy stately. A "State drift" seen on HQ Ops → Jobs right after switching on was the gap before the worker's next registry check (clears on Refresh). Scheduled ticks do not write `sys_ops_job_run_dtl` (only Run now does), so "Last run" stays empty for them — step 7.** **First tick failed (23:15 UTC): `TypeError: Cannot read properties of undefined (reading 'parse')` at `fin-pos-rollover.ts:14` — commit 5a1d75ef has the handler and 0824 but not `packages/jobs/src/queues.ts` (the `fin.pos_rollover.sweep` payload), so the deployed `@cmx/jobs` lacks it. No session touched. Owner: commit + push `packages/jobs/src/queues.ts`, redeploy cmx-workers, Run now, check `pgboss.job` state `completed`.** **Running on remote since the redeploy (25 Nov): 23:31 UTC 3 sessions rollover-paused (2 organizations, business days 28 Oct / 13 Nov / 17 Nov); 23:46 UTC the same 3 flagged stale = a second alert per session. Fixed in code (not committed): `isSessionStale` skips a session whose rollover is applied (model + service + unit test; model 13/13, DB integration 5/5, ESLint 0). Owner: commit + redeploy cmx-workers.** Then QA 6.2. **6c done in code (25 Nov, not committed): ERP posting retry by design. No sweep: when a posting fails with SYSTEM_ERROR, the engine queues one delayed `fin.erp_post.retry` job (5 min after attempt 1, 15 min after attempt 2, none after 3; job id = exception id; inside a business transaction under a savepoint, so a rolled-back sale never gets a journal later). cmx-workers replays the posting log; success marks the exception RETRIED + one action audit row; an exception a person already handled is skipped. Migration 0825 (queue off, old `fin-erp-posting-retry` superseded) dry-run OK on local, not applied. Engine tests 19/19 (3 new), web-admin tsc 0, ESLint 0, cmx-workers typecheck + bundle 0; worker test `erp-retry.test.ts` runs after 0825 is applied. Found: the old sweep could never match (it read status OPEN; the engine writes NEW).** **6c live (25 Nov): Owner applied 0825 on local + remote, deployed, switched on `fin.erp_post.retry` (remote desired + applied on). Owner left: QA 6.3. Owner question: why do replaced jobs still show in HQ → Ops → Jobs? By design (I11 WP0 D11): a replaced row stays as SUPERSEDED, observe only (no enable / Run now), with a link to its replacement, until step 8 deletes it together with the old code that still refers to it. 9 such rows on remote. Step 7 adds a "show replaced jobs" filter, off by default.** 6d–6f not started. Design: [DESIGN.md](DESIGN.md) §5.5 (job shapes), §5.6 (orphans and poison), §6 (what moves), §20.8–§20.9 (registry).

## Findings (remote, 24–25 Nov)

| Job | Today | Effect |
|---|---|---|
| Gift card, credit note, loyalty expiry | `HQ_WORKER` registry rows, switched **off**; HQ's runner does not register them (`tenant-jobs.ts` is a list of rejected callers) | **Nothing expires on remote.** Cards and notes stay ACTIVE past their dates; old loyalty points stay spendable until the customer's next checkout read. |
| POS session rollover | `fin-pos-session-rollover`, off, same as above | Sessions are not paused or force-closed at the end of the branch's business day. |
| ERP posting retry | `fin-erp-posting-retry`, off | SYSTEM_ERROR posting exceptions stay OPEN. |
| B2B dunning | `POST /api/v1/b2b/run-dunning-actions` with `CRON_SECRET`; no caller found in `cron.job` | Not running. |
| File purge | `file-util-purge` in `platform-workers` (`HQ_WORKER`, on) | Runs. Moves to `file.purge` jobs. |
| Tenant "Finance jobs" screen → Run now | `POST /api/v1/finance/jobs/[jobCode]/run` (`finance_jobs:run`) runs the old in-process sweep | **Runs the sweep for every tenant**, from one tenant's staff screen. Older issue; handled in 6f. |

## Why this design, and its limits (Owner question, 25 Nov)

Before step 6 the three expiries were `HQ_WORKER` registry rows (HQ's worker calling tenant HTTP routes), switched off and run by nothing. They were never pg_cron jobs. Now: the timer is a pg-boss schedule (stored in `pgboss.schedule`, fired inside cmx-workers), the due ids come from SQL functions, and each record is expired in cmx-workers by the existing TypeScript service. Pure-SQL pg_cron jobs (session sweep, retention, quota, push subs, idempotency cleanup, setup health, tax kit, truncates) stay on pg_cron.

| Option | Verdict |
|---|---|
| pg_cron + SQL only | No: gift card expiry writes ledger rows and a GL entry implemented in TypeScript; SQL would be a second copy of money rules. |
| Vercel cron → tenant route | No: the old model (one long cross-tenant loop in a web request, time limits, HTTP secret, no per-record retry). |
| **pg-boss in cmx-workers** | **Chosen:** reuses the service, one small job per record (retry, dead letter, run-twice safe), on/off and Run now from HQ, no new service. |

Limits, and the Owner's decisions (25 Nov):

1. **Daily, not at the exact moment** → the guard must be the date check at use. Gift cards: checked at validation and redemption. Loyalty: synced at checkout. **Credit notes were not checked** (`redeemCreditNoteTx` / `getCreditNotes` looked at `status` only). **Fixed (Owner agreed):** `redeemCreditNoteTx` refuses a note whose `expires_at` is before today (UTC) ("Credit note has expired"), and `getCreditNotes` lists only notes with no expiry date or one from today on.
2. **A missed 02:00 run was skipped** (pg-boss default). **Fixed (Owner agreed):** schedules use `missed: 'once'`, so a run that came due while cmx-workers was down is sent when it is back.
3. **Worker load (Owner: prefer pure database, to save database IO and connections).** Facts: queues do not add connections (cmx-workers has a fixed pool); the idle cost is one fetch per running queue per polling interval. Decision: **pure database wherever the work has no TypeScript-only effect** → credit notes move to pg_cron with the logic in SQL (one copy; the TypeScript `expireCreditNote` now calls it). Gift cards stay in cmx-workers (GL entry through the TypeScript ERP engine); loyalty stays (the lot-expiry code is shared with checkout and redemption; a SQL copy would be a second set of points rules). Their queues poll every **300 s** instead of 30 s, and the schedule sync reads all pg-boss schedules in one query. Idle cost of 6a: 4 queues × 1 fetch / 5 min ≈ 0.8 queries a minute.

## Shapes used

- **Schedule → sweep → item.** A `PGBOSS_SCHEDULE` registry row (cron, UTC) sends one job to a `<x>.sweep` queue. The sweep reads up to 100 due ids through a bounded SQL function and queues one `<x>.item` job per id in one transaction. A full page re-sends the sweep with `page + 1` after 60 s (300 s when nothing new was queued), up to 50 pages a day. Job ids make an id that is already queued a no-op.
- **Item = one entity**, through the existing service that owns the money/ledger rules. The service re-checks "still due" under its row lock, so an entity changed after the sweep is left alone and the job completes as `SKIPPED_ORPHAN` (never retried). Running an item twice writes nothing the second time.
- **Schedules are applied by the worker that consumes the target queue.** cmx-workers reads the registry every 30 s: `desired_enabled` + `schedule` (else `default_schedule`) → `boss.schedule(target, cron, {}, { key: job_code, tz: 'UTC' })`, or `unschedule` when off / superseded; it reports `applied_enabled` / `applied_schedule`. HQ "Run now" on a schedule writes a MANUAL request (`fn_ops_job_run_now`, already there); the worker claims it (`fn_ops_job_sched_claim_manual`, 0823), sends one job to the target queue and closes it with `fn_ops_job_finish` (run history row).

## 6a — Gift card, credit note and loyalty expiry (done in code, 25 Nov; revised the same day)

**Migration 0823** (written, dry-run on local in a rolled-back transaction, not applied):

| Object | Purpose |
|---|---|
| `fn_fin_credit_note_expire_one(tenant, note, only_if_due, actor)` | **Credit notes, pure database.** Expires one note under its row lock: EXPIRED, balance 0, one EXPIRY ledger row keyed `cn-expiry-<id>` when a balance remained. Returns `EXPIRED`, `ALREADY_EXPIRED`, `NOT_FOUND`, `NOT_ACTIVE`, `NOT_DUE`. The single copy: web-admin `expireCreditNote` calls it. |
| `fn_fin_credit_note_expiry_run()` + pg_cron `fin-credit-note-expiry` (`5 2 * * *`, UTC) + index `ix_cn_active_expiry` | Daily run: every due note (up to 5,000), one savepoint each, 5 s lock wait; returns `{expired, skipped, failed}`. The cron job is created **switched off**. The existing registry row moves from `HQ_WORKER` to `PG_CRON` in place (on/off, Run now from HQ). |
| Queues `fin.gift_card_expiry.sweep/.item`, `fin.loyalty_expiry.sweep/.item` + registry and queue detail rows | cmx-workers; INTERNAL, 8 retries, 300 s expiry, 7-day retention, **polling 300 s**; sweep concurrency 1, item 2. Start **off**. |
| Schedules `fin.gift_card_expiry.daily` (`0 2 * * *`), `fin.loyalty_expiry.daily` (`10 2 * * *`), UTC | Start **off**. Run now allowed. |
| `fin-gift-card-expiry`, `fin-loyalty-points-expiry` | → `SUPERSEDED` (observe only), `superseded_by` the new schedule. |
| `fn_fin_loyalty_exp_due(limit)` | Bounded due-id read (≤ 100), like the existing `fn_fin_gift_card_exp_due`. |
| `fn_ops_job_sched_claim_manual(consumer, worker)` | Claims waiting manual runs of schedules whose target queue that consumer owns; closes a claim older than 10 minutes as FAILED. |

All new functions: service role only.

Dry run (local, rolled back): credit note SQL — another tenant's id `NOT_FOUND`, first run `EXPIRED` with one EXPIRY row (−3, 3 → 0), second `ALREADY_EXPIRED` (no new row), future note `NOT_DUE`, daily run expired the due note and left the future one, HQ Run now on the cron job executed it; cron job created inactive; 4 queues polling 300 s; 2 schedules; 2 old rows superseded; Run now on a schedule → claim → finish → run history SUCCESS; second request while one waits → ALREADY_RUNNING; claim older than 10 minutes → FAILED; anon/authenticated cannot execute any new function.

**Code:**

- `@cmx/jobs` `queues.ts`: payloads for the four queues.
- web-admin `lib/services/finance-expiry-jobs.service.ts`: `runExpirySweep('gift_card' | 'loyalty', page)`, `runGiftCardExpiryItem`, `runLoyaltyExpiryItem`, `loyaltyExpiryJobId` (one id per account per UTC day). `expireGiftCard(id, tenant, { onlyIfDue })`: the due check runs inside the existing row lock.
- web-admin `stored-value.service.ts`: `expireCreditNote` calls `fn_fin_credit_note_expire_one`; `redeemCreditNoteTx` refuses a note past its date; `getCreditNotes` hides it.
- cmx-workers: `src/schedules.ts` (read all schedules in one query, apply with `tz: 'UTC'` and `missed: 'once'`, report `applied_*`, serve Run now), called from the registry loop; `src/handlers/fin-expiry.ts`; boundary types; `test/expiry.test.ts` (gift card and loyalty items: tenant isolation, run twice, not due; credit note SQL: the same plus the daily run; schedule on/off with `missed: 'once'`; Run now → sweep → item → EXPIRED + run history).
- Checks (25 Nov): web-admin tsc 0, ESLint 0 errors, Jest 150/150 (stored value, gift card, loyalty, finance jobs; new tests for the SQL call, the expired-note refusal and the spendable-list filter); cmx-workers typecheck 0. `expiry.test.ts` runs once 0823 is applied locally.

**Local test run (25 Nov, Owner applied 0823 locally):** first run 31/33. Fixed: (1) **real bug** — Prisma sends the page size as `bigint`, `fn_fin_gift_card_exp_due(integer)` did not match, so every sweep failed; now `${EXPIRY_SWEEP_PAGE}::int` (loyalty too); (2) test cleanup deleted loyalty ledger rows before their allocation rows. Also: an expected "not due" gift card no longer logs an ERROR; a registry sync cut off by worker stop no longer logs "registry sync failed". Leftover test rows on local were removed. Re-run: `expiry.test.ts` 6/6 (isolation, run twice, not due, credit note daily run, schedule on/off with `missed: 'once'`, Run now → sweep → item → EXPIRED + run history); gift card Jest 47/47; web-admin tsc 0, ESLint 0; cmx-workers typecheck 0.

**Release order:** apply 0823 (local, then remote) **before** deploying cmx-workers with 6a — the worker calls `fn_ops_job_sched_claim_manual` on start and refuses to start without it. Deploy web-admin with it too (`expireCreditNote` calls the new function; the redemption check ships with it). Then switch on the credit note cron job, the four queues and the two schedules (QA 6.1).

**Not changed in 6a:** the old routes `/api/finance/jobs/{gift-card,credit-note,loyalty-points}-expiry` and `finance-jobs.service.ts` stay until step 8 (no caller runs them; every path is idempotent). The tenant Finance jobs screen is 6f.

## 6b — POS session rollover (done in code, 25 Nov; 0824 waits for the Owner)

**What the job does (Owner question, 25 Nov).** Every 15 minutes, for each Open or Paused POS session (`pos-session-rollover-model.ts` holds the rules):

1. **Business day ended?** Session business date vs today in the **branch** time zone. If ended, the cash-control rollover mode decides: **Off** → nothing; **Pause at rollover** → Open becomes Paused (reason rollover), and a Paused one is only stamped; either way it can no longer be resumed; **Force close at rollover** → Force closed by the system and the shift Z-report frozen in the same transaction (when Z-reports are required). **Never force-closes while the linked cash-drawer session still holds cash:** it pauses instead and records `blockedByDrawer`.
2. **Otherwise, open too long?** Live longer than `pos_session_stale_hours` (0 = off) → flagged stale (warning only, status unchanged).

Each action writes one session timeline event (system actor) and notifies the operator and supervisors (`pos_session:force_close` holders in that branch or with all-branch view). Rollover and stale happen once per session; a session a person is closing at that moment is skipped. On remote it has never run (old row off, no runner), so sessions from past days stay open today.

**Pure database? No.** Under the Owner rule every effect of this job is TypeScript-only: a force-close freezes the shift Z-report in the same transaction (`generateShiftZReportTx`, the 450-line snapshot builder), the policy (pause / force-close / off, stale hours, Z-report required) comes from the cash-control settings chain (drawer / user / branch / tenant / type default), and the operator and supervisors are notified (`emitNotificationEvent`). A SQL copy would be a second copy of all three.

**Changed from the earlier plan.** The earlier plan said "a delayed job at each session's cutoff + a daily safety sweep → one item per session". Not built: it would hook the POS session-open path (cashier critical) and add a second queue and poller. The existing sweep already locks and re-checks each session in its own transaction, skips one a person closed, can run twice safely, and isolates failures; a failed session is simply found again on the next tick. So:

| Registry row | Kind | What |
|---|---|---|
| `fin.pos_rollover.every_15m` | PGBOSS_SCHEDULE | pg-boss cron `*/15 * * * *` UTC (same cadence as the row it replaces), `missed: 'once'`, Run now allowed |
| `fin.pos_rollover.sweep` | PGBOSS_QUEUE | one job = `runPosSessionRolloverSweep()`; output `{processedCount, failedCount}` |
| `fin-pos-session-rollover` | HQ_WORKER → SUPERSEDED | observe only |

Queue: policy `stately` (at most one waiting and one running sweep: a slow sweep never stacks ticks), retry 2 × 60 s, expire 900 s (one tick), kept 1 day, concurrency 1, polling 300 s (a tick starts within 5 minutes; idle cost one fetch per 5 minutes). Each branch's business day is still read in the branch time zone by the service; the cron itself is UTC.

**Limit (shortcut, in code):** one job sweeps every tenant. If a sweep nears the 900 s expiry, split it into sweep → one item per session.

**Files:** `supabase/migrations/0824_bg_jobs_fin_pos_rollover.sql`; `packages/jobs/src/queues.ts` (payload `{}`); `cmx-workers/src/handlers/fin-pos-rollover.ts` + `handlers/index.ts`; `cmx-workers/src/types/web-admin-boundary.d.ts`; `cmx-workers/test/pos-rollover.test.ts` (schedule on/off in UTC with `missed: 'once'`; Run now → sweep completed with counts + run history SUCCESS). The rollover rules are already proven against the same function by web-admin `__tests__/db-integration/pos-session-rollover.db.test.ts`. No web-admin or HQ code change: HQ's `tenant-jobs.ts` entry and `platform-workers/src/finance/pos-rollover.job.ts` go in step 8 (platform-workers stays suspended); the web-admin `/api/finance/jobs/pos-session-rollover` route goes in step 8 / 6f.

**Checks:** dry run of 0824 on local, rolled back: queue `stately` with the values above, three registry rows as in the table, Run now on the schedule → QUEUED and claimable by CMX_WORKERS, Run now on the old row → SUPERSEDED, a second waiting sweep job refused, re-running the migration harmless. cmx-workers typecheck 0; test bundle builds. `pos-rollover.test.ts` runs after 0824 is applied locally (it runs the real sweep, so it also rolls over any live local session from a past business day).

**Release order:** apply 0824 (local, then remote) → deploy cmx-workers → HQ → Ops → Jobs: switch on `fin.pos_rollover.sweep`, then "POS session rollover (every 15 minutes)" (QA 6.2).

## 6c — ERP posting retry by design

**Done in code (25 Nov, not committed). Migration 0825 waits for the Owner.**

Why not pure database: a retry replays the stored request through the TypeScript posting engine (rules, accounts, journal, snapshot). There is no SQL copy of the engine.

Why no sweep: the engine already knows the moment a posting fails. It queues the retry then, so nothing reads the exception table on a timer.

| Piece | What it does |
|---|---|
| `ErpLitePostingEngineService.queueAutoRetry` (web-admin) | After a failed execute or retry: only `SYSTEM_ERROR` (the one type that can heal by itself), only attempts 1 and 2 (`ERP_LITE_AUTO_RETRY`). Sends `fin.erp_post.retry` `{tenantOrgId, exceptionId, postingLogId}`, job id = exception id, `startAfter` 300 s × 3^(attempt − 1) (5 min, then 15 min). Never throws. |
| In a business transaction (`executeInTransaction`) | The job is written in that transaction under `SAVEPOINT erp_auto_retry`. Commit keeps it; a rolled-back sale or redemption has no job, so it never gets a journal later. A failed enqueue rolls back to the savepoint only. |
| `runErpPostRetryItem` (web-admin `erp-posting-auto-retry.service.ts`, run by cmx-workers) | Reads the exception (tenant, id, posting log). Gone, or not `NEW`/`OPEN` (a person resolved, ignored or retried it) → `SKIPPED_ORPHAN`. Else replays the log (`ErpLitePostingEngineService.retry`). Success → exception `RETRIED` by `system/erp-auto-retry` + one `org_fin_post_action_tr` row. Fails again → `FAILED_AGAIN`; the new exception has queued its own job if attempts remain. |
| Queue `fin.erp_post.retry` (0825) | standard, retry 2 (60 s, backoff, max 600 s) for crashes only, expiry 300 s, kept 7 days (jobs sent while it is off still run once switched on), concurrency 1, polling 300 s. Starts off. |
| `fin-erp-posting-retry` | Superseded. `list_retryable_posting_exceptions()` and `runErpPostingRetry` stay until step 8. They never matched anything: they read status `OPEN`, the engine writes `NEW`. |

Checks: engine unit tests 19/19 (3 new: SYSTEM_ERROR queues one job; attempt 3 and RULE_NOT_FOUND queue none; in a transaction the enqueue uses a savepoint and a failed enqueue does not break the posting result). web-admin `tsc` 0, ESLint 0, cmx-workers typecheck + bundle 0. 0825 dry-run on local in a rolled-back transaction: queue standard/2/300, registry row off, queue row CMX_WORKERS/300, old row SUPERSEDED. `cmx-workers/test/erp-retry.test.ts` (job for an unknown exception → `SKIPPED_ORPHAN`, same id sent twice → one job) runs after 0825 is applied.

In practice: every business posting today runs inside its business transaction (payments, refunds, gift cards, invoices, cash events). A database error there rolls the business change back too, so no job is queued, which is correct (the old sweep design would have posted a journal for a sale that never happened). The automatic retry fires for errors that leave the transaction healthy, and for a Workbench Retry that fails with a system error.

Remote today: no SYSTEM_ERROR exceptions (one RULE_NOT_FOUND from May), so there is nothing to backfill.

Seen, not changed (pre-existing): a posting that fails inside a business transaction still writes its posting log and exception outside it, so the Workbench can show an exception for a sale that was rolled back. A person pressing Retry on it would post a journal for that missing sale.

Known limits: a retry that fails again leaves the earlier exception open next to the new one (the same as the Exception Workbench Retry button today). If ERP-Lite is switched off for the tenant, the job fails and ends in `dead_letter` after 2 retries.

**Release order:** apply 0825 (local, then remote) → deploy web-admin and cmx-workers (the engine change is in both) → HQ → Ops → Jobs: switch on `fin.erp_post.retry` (QA 6.3).

## 6d — B2B dunning

Daily schedule → sweep over due statements → one item per statement; messages go through `ntf.orchestrate` (no direct `email-sender` / `sms-sender`). Retires `run-dunning-actions` and its `CRON_SECRET`.

**Findings (25 Nov), waiting for an Owner decision:**

- Nothing runs today: no `cron.job` calls `POST /api/v1/b2b/run-dunning-actions`. Remote has 0 rows in `org_b2b_statements_mst` and 0 in `org_ar_dunning_runs_mst`.
- `executeDunningActions` (`dunning.service.ts`) is not safe to schedule as it is: it records nothing about what it already did, so a daily run would send the same level again every day. Messages are hard-coded English HTML/SMS, sent straight through `email-sender` / `sms-sender` (outside the notification hub, no Arabic, no templates). Default levels set `is_credit_hold` automatically at 30 days. It reads `b2b_dunning_levels` through the session settings client, which a worker does not have.
- Two dunning models exist: B2B statement dunning (settings levels, no history) and AR invoice dunning (`ar-dunning-ops.service.ts`, manual, one `org_ar_dunning_runs_mst` row per action with stage REMINDER_1 / REMINDER_2 / FINAL_NOTICE / CREDIT_HOLD, also direct senders).
- So 6d is a new feature (stage history, EN/AR notification templates, a credit-hold rule), not a job move. Owner asked to choose: build automatic dunning now, or postpone it and only retire the dead cron route (`CRON_SECRET` branch) in step 8.

## 6e — File purge

`file.purge` per expired file, queued by a schedule-driven sweep; moves the `platform-workers` job to cmx-workers (storage deletes through the service role). Supersedes `file-util-purge`.

## 6f — Tenant Finance jobs screen

Run now there must not run work for other tenants. Either queue only the calling tenant's due items, or remove the button and point to HQ → Ops → Jobs. Decide with 6b–6e; remove `finance-jobs.service.ts` and the `/api/finance/jobs/*` routes in step 8.
