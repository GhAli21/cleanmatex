# Step 6 — Sweeps and delayed jobs: implementation plan

Status (25 Nov): **6a done in code (revised the same day to pure database for credit notes, Owner decision). 0823 applied on local by the Owner; `npm test --workspace=cmx-workers` green after two fixes (below). Remote apply waits for the Owner.** 6b–6f not started. Design: [DESIGN.md](DESIGN.md) §5.5 (job shapes), §5.6 (orphans and poison), §6 (what moves), §20.8–§20.9 (registry).

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

## 6b — POS session rollover (next)

Delayed job at each session's cutoff (`startAfter` = the branch business-day end) when a session opens or its branch day changes, plus a daily safety sweep → one item per due session (`runPosSessionRolloverSweep` split into find + one-session). Supersedes `fin-pos-session-rollover`.

## 6c — ERP posting retry by design

The posting failure path queues `fin.erp_post` with a delay instead of a standing retry sweep; the item retries one posting log through `ErpLitePostingEngineService.retry` and closes the exception. Supersedes `fin-erp-posting-retry`.

## 6d — B2B dunning

Daily schedule → sweep over due statements → one item per statement; messages go through `ntf.orchestrate` (no direct `email-sender` / `sms-sender`). Retires `run-dunning-actions` and its `CRON_SECRET`.

## 6e — File purge

`file.purge` per expired file, queued by a schedule-driven sweep; moves the `platform-workers` job to cmx-workers (storage deletes through the service role). Supersedes `file-util-purge`.

## 6f — Tenant Finance jobs screen

Run now there must not run work for other tenants. Either queue only the calling tenant's due items, or remove the button and point to HQ → Ops → Jobs. Decide with 6b–6e; remove `finance-jobs.service.ts` and the `/api/finance/jobs/*` routes in step 8.
