# I11 Background Execution — Expert Replan

**Status:** `0782` through `0790` applied. Canary is deferred: the named organization has 46 due notifications, so the first claim would send. Delivery, shadow, and `PLATFORM_BG_ENABLED` stay off. Gift-card, credit-note, and loyalty expiry stay superseded until the application posting service writes the journal. `ntf-outbox-reconcile` is not scheduled.  
**Written:** 20 Nov 2026  
**Approved_By_Jh:** 20 Nov 2026 (architecture); planning locks D9–D12 recorded same day for implementation readiness.  
**Authority it extends:** [PLAN](I11_background_execution_redesign_PLAN.md), [ADR](I11_background_execution_redesign_ADR.md), [handler contracts](I11_background_execution_handler_contracts.md), [runbook](I11_background_execution_RUNBOOK.md), [QA](I11_background_execution_QA_TEST_GUIDE.md), [I11/I11a](03_infrastructure_deploy_and_operations.md).  
**Repos:** `cleanmatex` (migrations, tenant app) · `cleanmatexsaas` (HQ API, web, workers).  
**Safety:** Keep `NTF_OUTBOX_WORKER_ENABLED=false`. Do not restore legacy HTTP `pg_cron`. Do not apply migrations from this document. Do not commit unless asked.

**Mandatory while planning or implementing any slice:** Do **not** ignore repository `CLAUDE.md`. Tenant: `F:\jhapp\cleanmatex\CLAUDE.md` (and `AGENTS.md`). HQ: `F:\jhapp\cleanmatexsaas\CLAUDE.md` / `AGENTS.md`. Load the skill that table names **before** writing SQL, UI, API, i18n, or `org_*` queries. D20.

---

## 1. Verdict

Keep the **business boundary**. Change the **runtime shape**.

The ADR is right: Vercel must not poll; Postgres owns data, the outbox, leases, and DB-native jobs; one canonical outbox; identity-only HQ provider call; no generic command runner. **BullMQ is rollback-only on the notification path.** Redis is **platform infrastructure** on HQ API (cache, rate limit, locks) — not the job bus.

### Copilot hybrid (accepted 20 Nov 2026)

A second review scored the outbox proposal ~8.5/10 technically and ~9.5/10 for current-scale simplicity, and disagreed with a blunt “Redis later.” That disagreement is **accepted**. Converged rule:

| Component | Now (CleanMateX scale) | Later (metrics only) |
|---|---|---|
| Queue of record | Postgres outbox + `SKIP LOCKED` | Unchanged for customer-visible effects |
| Wake | `LISTEN/NOTIFY` + safety sweep | Same (NOTIFY is a bell, not storage) |
| Scheduler | One: `pg_cron` + job registry | Do not add BullMQ repeatables beside it |
| Worker | One HQ runtime claiming rows | Split process / more workers if CPU |
| Redis | **Yes on HQ API** (cache, limiter, locks, ephemeral) | Still not “the send happened” |
| BullMQ | **Off** supported path (`LEGACY_BULLMQ_ENABLED` false) | Heavy CPU/fanout jobs **after** gates; still write outbox first if the effect is customer-visible |

**Graduation gates before BullMQ jobs:** claim SQL crowding OLTP (`pg_stat_statements`), due age while workers are healthy, PDF/export/image jobs starving HTTP. Then BullMQ is a **consumer**, not a second notification scheduler. Never start BullMQ merely because `REDIS_URL` is set (Upstash incident).

The current **implementation shape is not production-ready for this product**:

- Two always-on Render services (HQ API **and** a no-port worker) to do work HQ API already knows how to do.
- Chatty discovery (list all tenants, then N RPCs) even when delivery is off.
- Notification dispatch, shadow, and purge **ticks are not operator-managed**. `/ops/jobs` only drives `file-util-purge`.
- Tick constants, comments, runbook, and UI disagree (see §3.4).
- Reconciliation (the only safe recovery for uncertain sends) is **not scheduled**.
- Fourteen desired jobs are still missing from `cron.job`; restoring them as HTTP would re-break I11.
- Canary history already produced real customer-side effects (multi-tick sends, claimed-not-finalized, missing HQ URL/key). Process env flags alone are too sharp a tool.

**Do not throw away claim/finalize/HQ execute.** Fold execution into one host, make Postgres the wake source, and make `/ops/jobs` the operator surface for every approved loop.

---

## 2. What to keep vs what to change

### Keep (do not redesign)

| Decision | Why it is already the right idea |
|---|---|
| Classify `DATABASE` vs `HQ_WORKER` vs exceptional `HQ_JOB_API` | Matches physics: SQL vs storage/provider vs existing HQ policy/credentials |
| `org_ntf_outbox_dtl` is canonical | Prevents dual-sender / dual-status bugs |
| Worker (or executor) sends **only** `tenantOrgId`, `outboxId`, `claimToken` | Least privilege; HQ reloads policy |
| Exact-token finalize; `ACCEPTANCE_UNCERTAIN` is not a resend | Finance/notification correctness |
| Provider-specific reconciliation, never generic lease requeue | Duplicate WhatsApp/SMS/email is a defect |
| `sys_ops_job_cf` never stores SQL, URLs, or secrets | Operator safety |
| `ENV_ONLY` host secrets (`0777`) | Registry must not pretend to set Render env |
| File Util split: DB expire vs HQ byte purge | Bytes are not in Postgres |
| Legacy BullMQ opt-in only | Already proven dangerous when Redis existed |
| Remote Supabase as production evidence authority | I11 incidents were only visible that way |

### Change (this is the better idea)

| Current | Better |
|---|---|
| Separate Render **Background Worker** always-on, no inbound port | **One HQ runtime**: Nest `BackgroundExecutionModule` inside `platform-api` (same region, same secrets). Optional later split only if measured CPU/RAM contention |
| Minute/20-min/30-min **busy poll** of tenants | **Wake + sparse safety net**: `NOTIFY` / due-flag on insert + `pg_cron` nudge every 5–15 min; idle when queue is empty |
| Per-tenant JS loops | **One service-role RPC** returns due aggregates or one global claim batch (fairness in SQL) |
| Delivery gated only by Render env | **Registry job** `ntf-outbox-dispatch` (`HQ_WORKER`) for on/off/schedule/Run now **plus** env **emergency kill** |
| Shadow default-on, independent of `/ops/jobs` | Registry job `ntf-outbox-shadow` default **off** in production until soak; or fold metrics into dispatch tick |
| File Util runner always syncs even weekly | Sync **only** when due, Run now pending, or heartbeat interval (e.g. 5–15 min) |
| `ntf-outbox-processor` still `PG_CRON` / `ASYNC_HTTP` | Mark **SUPERSEDED**; never Enable/Restore |
| Reconciliation client exists, no loop | Registry job `ntf-outbox-reconcile` after dispatch soak |
| Overlapping Render deploys | **Scale to zero then one** for worker-class code; claim RPC remains the lock |
| Cost: HQ API Starter + Workers Starter + poll load | **Delete the worker service** after in-process runner is proven; Postgres `pg_cron` stays $0 incremental |

**Rejected alternatives**

| Idea | Why not |
|---|---|
| Restore all missing `pg_cron` HTTP jobs | Recreates Vercel/`pg_net` fragility and dual senders |
| Supabase Edge Functions as the sender | Secrets, private HQ network, 10-min purge, and claim/finalize do not fit well |
| BullMQ as the supported **notification** path | Dual-sender + Upstash quota when `REDIS_URL` implied a queue |
| Redis-free HQ API | Cache, rate limit, and locks belong on Redis; they are not the outbox |
| Generic `jobs-need-api` proxy or a god `doEverything` jobs service | ADR forbids command/URL/SQL; domain rules stay in domain executors (D19) |
| Worker reads Config Registry stored values for kill switches | 45s cache / wrong host; keep env emergency kill |
| Merge provider send into Postgres | Cannot hold Twilio/Resend keys or HTTP in SQL safely |
| Scale workers to 2+ before soak | Overlap already broke canary evidence |

---

## 3. Current implemented state (truth)

### 3.1 Control plane

- `0755`: V2 capabilities; `tax-kit-update` observation-only; no stored-command execution from HQ.
- `0768`: **only** `file-util-purge` is `HQ_WORKER` (schedule / disable / Run now / heartbeat).
- `0777`: eight worker env names as `ENV_ONLY`, `is_wired=false`; HQ cannot verify Render env.
- `/ops/jobs` is a **job registry**, not a process manager. It cannot start/stop Render.
- QA: ~22 jobs, **15 Missing in scheduler**, 7 in sync. `ntf-outbox-processor` OBSERVE-only, still looks like a cron job.

### 3.2 Notification path (canonical, delivery off)

```
org_ntf_outbox_dtl
  -> fn_ntf_worker_claim_due / fn_ntf_worker_claim_canary (0774)
  -> POST HQ /internal/jobs/notifications/outbox-deliveries/execute (machine key)
  -> fn_ntf_worker_finalize / reconcile (0769)
```

Gates: `NTF_OUTBOX_WORKER_ENABLED`, claim limit, max claims per boot, canary UUID.  
**Not in `main.ts`:** reconcile scheduler. Legacy tenant routes still exist for cutover rollback.

### 3.3 Always-on loops today (`platform-workers/src/main.ts`)

| Loop | Gate | Current tick in source | Operator surface |
|---|---|---|---|
| Shadow | default **on** unless `NTF_OUTBOX_SHADOW_ENABLED=false` | `20 * 60_000` | Render env |
| Dispatch | `NTF_OUTBOX_WORKER_ENABLED===true` | `20 * 60_000` | Render env |
| File Util runner | **always starts** | `30 * 60_000` | `/ops/jobs` for **job** schedule; tick is code |
| Legacy BullMQ | `LEGACY_BULLMQ_ENABLED` + `REDIS_URL` | queue poll | Render env |

Shadow and dispatch still **select all active tenants then RPC per tenant**.

### 3.4 Document / code / UI drift (bugs)

| Surface | Says | Code |
|---|---|---|
| Comments in dispatch scheduler | “One-minute cadence” | 20 minutes |
| `worker-job-runner` comments, File Util QA, Run now copy | “within about a minute” | 30 minutes |
| Earlier I11 FET | shadow ~every 60s | since changed in tree |
| `/ops/jobs` Run now | HQ worker starts within about 15 minutes | Same as tick (D10) |

Treat this as a **release defect**: either revert ticks to a documented value or update every operator string and the runbook in the same change.

### 3.5 Phase map vs reality

| Phase | Reality |
|---|---|
| 0 Inventory / freeze | Done enough; freeze still required for unreviewed enablement |
| 1 Classification / ADR | Target map approved; ADR not “fully complete” (metrics/retention still thin) |
| 2 Control plane | V2 + one HQ_WORKER pilot; notification durable state exists; **not** all jobs on the runner |
| 3 Database-native execution | **Mostly not started** (finance, campaigns, retry, sweeps, session) |
| 4 Worker foundation | Claim/canary/env registry yes; secrets inventory, singleton deploy, idle profile **no** |
| 5 External migrate | File Util yes; notification **paused**; reconcile **blocked**; finance HTTP still in functions |
| 6 jobs-need-api | One private execute endpoint; not a scheduler |
| 7 Ops UI | Partial; ntf lease health not projected; alerts webhook unset (I5) |
| 8 Proof | Canary incidents; soak blocked; Disk I/O root cause not worker physical reads |
| 9 Decommission | Blocked |

### 3.6 Incident lessons (must drive design)

1. **Missing `HQ_JOBS_API_URL` / machine key** → 37 uncertain claims, no HQ log. Fail-closed worked; recovery was manual.
2. **Claim limit per tenant per tick ≠ global canary** → three real `SENT` rows.
3. **Render deploy overlap ~2 minutes** with two claimers.
4. **Class-validator UUID** rejected a valid Postgres tenant id (HTTP 400).
5. **BullMQ started because `REDIS_URL` existed** until explicit opt-in.
6. **Suspending the whole worker** was the only way to stop File Util + shadow RPC.

Any new design must make (1)–(6) structurally hard.

---

## 4. Cost and operations (minimum money, minimum risk)

Render Starter is billed **per always-on service**, not per poll. A Background Worker that is idle still costs a Starter. Polling also burns **Supabase connections/CPU** (the real pain you already felt).

| Item | Approx | Action |
|---|---|---|
| `platform-api` web (already required) | 1× Starter | Keep |
| `platform-workers` Background Worker | 2nd Starter | **Remove after in-process runner soak** |
| Redis on HQ API | cache / limiter | **Keep or add** as platform; not a job queue |
| Redis on job runner | Upstash quota | **Unset** unless approved BullMQ heavy-job path; never auto-start BullMQ |
| `pg_cron` DATABASE jobs | included | Prefer this for all SQL-only work |
| Chatty PostgREST | connection/CPU | Eliminate N+1 and idle polls |
| Operator incidents | highest cost | One control plane, retired leftover jobs, kill switch |

**Cost-zero of background compute is impossible** if HQ API must stay up for the product. **Cost-zero of a second worker is possible.** That is the money target.

---

## 5. Target architecture

### 5.1 Runtimes

```
Vercel (web-admin, platform-web)
  user/API requests only — no pg_cron HTTP

Postgres
  canonical state, claims, DATABASE jobs via pg_cron
  NOTIFY ntf_outbox_due / ops_job_wakeup
  sparse safety cron: fn_ops_wakeup_due()

Render platform-api (ONE always-on process)
  HTTP for HQ UI + private execute (can stay for other callers)
  BackgroundExecutionModule:
    - LISTEN + sparse poll
    - HQ_WORKER executors (purge, ntf dispatch, later reconcile)
    - in-process call to OutboxDeliveryService (no HTTP, no second secret hop)
  Emergency: PLATFORM_BG_ENABLED=false stops all in-process loops
```

`platform-workers` remains a **rollback artifact** until the in-process runner has 48h soak, then the Render service is deleted.

If Owner **rejects** merging into API: convert workers to the same module code on a **second process**, but still use LISTEN + sparse poll and one aggregate RPC. Do not keep busy tenant loops.

### 5.2 Wake contract

1. Insert/transition to due outbox → `NOTIFY` (or write `sys_ops_wakeup_tr`).
2. HQ runner LISTENs; claims immediately (bounded).
3. `pg_cron` every 5–15 minutes runs `fn_ops_wakeup_due()` so missed notifies still drain.
4. Empty queue: **no per-tenant RPCs**.
5. File Util: runner sleeps until next cron slot, pending MANUAL request, or heartbeat.

### 5.3 Claim / fairness (SQL, not JS)

Replace:

```
for tenant in org_tenants_mst:
  rpc due_sum or claim_due(tenant)
```

With:

```
fn_ntf_worker_claim_due_global(p_limit, p_worker, p_canary)
  -- SKIP LOCKED, tenant_org_id in every predicate
  -- optional fair share: one row per tenant then fill
```

Shadow becomes **one** `fn_ntf_outbox_due_sum_all()` returning JSON aggregates (no PII).

### 5.4 Operator model (`/ops/jobs`)

Every supported loop is a row:

| job_code | kind | Default | Actions |
|---|---|---|---|
| `file-util-purge` | HQ_WORKER | weekly | SET_STATE, RUN_NOW (exists) |
| `file-util-expire` | DATABASE | hourly :17 | SET_STATE after grant |
| `ntf-outbox-dispatch` | HQ_WORKER | **disabled** | SET_STATE, RUN_NOW |
| `ntf-outbox-shadow` | HQ_WORKER | **disabled** | SET_STATE |
| `ntf-outbox-reconcile` | HQ_WORKER | disabled until 5.3 | SET_STATE |
| `ntf-outbox-processor` | SUPERSEDED | never enable | OBSERVE only |
| `ntf-reconcile-outbox` | SUPERSEDED after 5.3 | | OBSERVE |
| All DATABASE families | PG_CRON → fixed function | enable **one at a time** | SET_STATE when contract exists |

**Process health:** synthetic job or `/ops/health` signal `hq-background-runner` heartbeat. Suspend/scale remains Render.

**Emergency kill** stays env (`PLATFORM_BG_ENABLED` / `NTF_OUTBOX_WORKER_ENABLED`) and **fails closed**. Registry cannot override a false kill.

### 5.5 In-process execute (closes incident 1)

Dispatch executor calls `OutboxDeliveryService.execute(...)` in-process.  
Keep the HTTP endpoint for a **temporary** external worker, then deprecate.

Benefits: no missing URL, no 15s HTTP timeout class for localhost, one secret store (HQ API env).

Still: machine-auth if HTTP remains; identity-only DTO; exact claim reload.

### 5.6 Central work platform (one call site — D19)

Centralize the **work mechanics**, not every business rule. Callers must not each start a timer, BullMQ job, `pg_net`, or tenant cron HTTP.

```text
BEGIN
  domain write (invoice, order, campaign, …)
  WorkOutbox.enqueue({ jobCode, tenantOrgId, idempotencyKey, refs })
COMMIT
        │
        ▼
  Postgres outbox / job request row   ← only queue
        │  NOTIFY + 15 min sweep
        ▼
  BackgroundExecutionModule           ← only runner
        │  allowlisted job_code → executor
        ▼
  OutboxDeliveryService | purge | reconcile | (future named executor)
```

| Layer | One module | Callers do |
|---|---|---|
| Enqueue | `WorkOutbox.enqueue` (tenant and HQ), **same transaction** as the business write | Never send, never `Queue.add`, never `setInterval` for jobs |
| Run | `BackgroundExecutionModule` + `ExecutorRegistry` | `job_code` → registered function only; unknown code = refuse |
| Operate | `/ops/jobs` | On/off, schedule, Run now, history |
| Kill | `PLATFORM_BG_ENABLED` / `NTF_OUTBOX_WORKER_ENABLED` AND registry | Env wins if false |

**Register a new job:** (1) typed enqueue or SQL function, (2) executor or `pg_cron` function, (3) `sys_ops_job_cf` row. Do not add a fourth poller.

**Stay outside the central class:** ledger lock order, consent/template/quiet hours, S3 purge internals. Those are executors or domain SQL, not `doFinanceAndEmail()`.

**Forbidden in one central API:** `command`, raw SQL, arbitrary URL, recipient/provider payload as authority. Screens never call execute HTTP; only the runner does (in-process after WP2).

---

## 6. Work packages (complete; do not skip)

Statuses: `P0` must before any delivery enable. `P1` before soak. `P2` launch. `P3` after launch.

**Exit of every WP (including WP0–WP8):** run **WP-P** (progress) then **WP-D** (related docs). A WP is not Complete without both. After WP8 soak, run **WP9** (`/documentation`) then **WP10** (Cursor rule + skill).

### WP0 — Freeze and honesty (P0)

1. Keep delivery **false**; worker service **suspended or idle**.
2. Fix tick/comment/UI/runbook **to one documented number** (recommend: do not go back to 60s until N+1 is gone).
3. HQ deploy of `0777` unwired UI; `/ops/config` QA.
4. Registry: add `lifecycle_status` `ACTIVE | SUPERSEDED | RETIRED`; mark `ntf-outbox-processor` SUPERSEDED; hide Enable/Restore.
5. Do not Enable any “Missing in scheduler” HTTP job.

### WP1 — Idle + one-RPC (P0) — even if host stays `platform-workers`

1. Capacity profile: if dispatch off and shadow off, **do not** list tenants.
2. Shadow default **false** in production until soak (observation is a job, not a tax).
3. File Util: heartbeat ≤ 1 RPC/tick; skip claim path when disabled and no MANUAL queue.
4. `fn_ntf_outbox_due_sum_all` + `fn_ntf_worker_claim_due_global`.
5. Startup jitter; skip immediate `void tick()`; Render **scale-to-zero then 1**.
6. Dynamic-import BullMQ only if rollback flag true.
7. Bound Supabase JS client timeouts.

**Exit:** with delivery off, remote `pg_stat_activity` / statements show **~0 tenant loops per minute**.

### WP2 — Single HQ runtime (P0/P1) — D1 approved

Merge `BackgroundExecutionModule` into `platform-api`. `platform-workers` remains until this slice soaks, then the Render Background Worker is deleted.

1. Same executors, tests, graceful shutdown, concurrency cap (never unbounded `Promise.all`).
2. Isolate from HTTP: dedicated async pool, timeout per job, do not block Nest event loop.
3. One session-mode Postgres `LISTEN` client (D9); safety sweep stays.
4. In-process delivery call; keep HTTP behind flag until deleted.
5. After soak: delete Render worker service; worker env docs become rollback-only.
6. `ExecutorRegistry`: allowlisted `job_code` → executor; unknown code refuses. In-process delivery only through this map (D19).
7. D16: worker loops off when this module is on.

### WP3 — `/ops/jobs` owns HQ_WORKER loops (P1)

1. Register `ntf-outbox-dispatch`, `ntf-outbox-shadow` (and later reconcile) as `HQ_WORKER` using `0768` pattern.
2. Delivery desired_enabled default **false**.
3. Env kill still required to actually send.
4. Project outbox due age, leased, uncertain, dead-letter onto job detail (aggregates only).
5. Align Run now copy with real tick/LISTEN latency.
6. Heartbeat for the runner itself (`WORKER_NOT_SEEN`).

### WP4 — Notification correctness (P0/P1)

1. Reconcile **claimed-not-finalized / uncertain** with provider-specific policy only (existing decision table).
2. Wire `ntf-outbox-reconcile` scheduler **after** dispatch is stable (plan 5.3). Until then, **manual** exact-token reconcile runbook only.
3. Safe fixture tenant for canary (not “next due production row”).
4. Canary: `0774` UUID + one instance + idle profile; one claim; disable.
5. Stale-claim probe after every HQ/worker deploy.
6. Do not generic-requeue leases.

### WP5 — Phase 3 DATABASE jobs (P1/P2) — this is most of I11a

One handler at a time. Each: fixed function, grants, `tenant_org_id`, batch, overlap, tests, then `pg_cron` + registry SET_STATE, then **WP-P** and **WP-D**.

Order (low blast radius first):

1. `auth-session-sweep`
2. `ntf-quota-rsv-sweep`, `ntf-retention-sweep`, `ntf-sweep-stale-push-subs` (no FCM)
3. `ntf-outbox-retry` (bounded requeue; must not race dispatch)
4. `ops-job-run-capture` if not already healthy
5. `fin-idempotency-cleanup` **direct SQL** (drop HTTP wrapper)
6. Gift/credit/loyalty expiry (ledger parity)
7. POS rollover + ERP retry (lock order)
8. Finance domain outbox **consumers** (not providers)
9. Campaign expansion SQL parity (10/50, consent, quiet hours, idempotency)
10. Tax-kit: graduate from observation-only only with executor policy
11. Trial expiry (Owner product decision)

**Never** schedule `fin_trigger_*` / `ntf_trigger_*` HTTP wrappers.

### WP6 — Decommission (P2)

1. After soak: drop `pg_net` wrappers from supported path; delete tenant `/api/notifications/process-outbox|campaigns|reconcile` **scheduled** auth; keep functions until caller inventory empty.
2. Remove finance process-jobs HTTP if SQL parity exists.
3. Retire BullMQ from the worker/job-runner env as a supported path; keep Redis documented on HQ API only (cache/limiter/locks).
4. Delete `platform-workers` Render service if D1 merge done.
5. Do not edit global `AGENTS.md`/`CLAUDE.md` here — that is **WP10** after WP8 proof.

### WP7 — UX / HQ console (P1/P2)

1. List columns: target, desired vs actual, lifecycle SUPERSEDED, last **durable** vs cron observation (FET findings).
2. Do not show Enable on SUPERSEDED.
3. EN/AR leftovers (`VIEW DETAILS`, `[STARTED_AT]`, “1 row”).
4. History vs list last-run agreement (`file-util-expire` FET).
5. Dead-letter review (privileged, no raw payload).
6. I5: alert webhook for `WORKER_NOT_SEEN`, due age, uncertain growth — still no secrets in alerts.

### WP8 — Proof (P1/P2)

Reuse plan Phase 8, but add:

- Idle-profile RPC budget test
- Two-instance overlap test against **global** claim
- Crash mid-execute → uncertain → reconcile not resend
- Disable during run
- In-process vs HTTP execute parity (if both exist)
- 48h soak with dispatch **on** only after fixture + idle evidence
- Security: grants, no `anon` execute, machine key rotation drill (4.5)

### WP-P — Progress after every step (mandatory)

After **each** WP (and after each WP5 handler):

1. Update this file’s WP status and the [I11 PLAN Progress Log](I11_background_execution_redesign_PLAN.md) (date, evidence, owner, next action).
2. Update checkboxes/status columns on any still-open old Phase 0–9 rows this slice affects.
3. Do not mark Complete without the Progress Log row.

### WP-D — Related documentation after every step (mandatory)

After **each** WP, create or update only what that slice changed (no speculative packs):

| If the slice changed | Update |
|---|---|
| Architecture / D-decisions | This replan, ADR, handler contracts |
| Operator behavior | Runbook, QA guide |
| Registry / jobs UI | `job_manager_guide`, Platform_Operations_Console STATUS |
| Worker / HQ env | `config_key_env_map.json`, `0777` notes, Render worker runbook |
| File Util tick/purge | File_Util PLAN/STATUS/QA |
| Notifications path | Notification Hub STATUS/resume if it still describes cron HTTP |
| Cross-project ownership | both `integration-contracts.md` |
| I11/I11a blocker | `03_infrastructure_deploy_and_operations.md` |

No second source of truth. Do not invent APIs or schedules.

### WP9 — Full documentation pack (`/documentation`) — last-but-one

After WP8 soak evidence (not before):

1. Load tenant `/documentation` (`.claude/skills/documentation/SKILL.md`). If overlapping folders exist, switch to `/documentation-canonicalization` or `/documentation-pack-repair` as that skill directs.
2. Produce or complete the canonical pack under `docs/features/` (prefer existing Platform_Operations_Console / Notification / File_Util packs; do **not** fork a third I11 folder if a pack already owns the surface). Include README, STATUS, PLAN pointer, permissions, routes, env, migrations, runbook links.
3. Fill gaps with `TBD` rather than guesses. Mark retired HTTP cron docs as superseded, not live.
4. HQ repo: matching operator/deploy docs for `BackgroundExecutionModule`.
5. `npm`/i18n/doc checks that the documentation skill requires.

### WP10 — Cursor rule + skill (last)

After WP9, when the runtime is proven (old 9.3):

1. Load `/create-rule` and `/create-skill` (Cursor + Claude skill authoring).
2. Add `.cursor/rules/` (and HQ copy if required) covering: CLAUDE.md first; D19 enqueue/runner; no Vercel/`pg_net` job HTTP; no BullMQ on outbox; SUPERSEDED; tenant_org_id; no apply migrations.
3. Add `.claude/skills/` (and `.cursor/skills/` if the repo dual-homes skills) e.g. `background-execution` / `i11-work-platform`: WP sequence, claim/finalize, LISTEN, `/ops/jobs`, WorkOutbox, ExecutorRegistry, pointer to this replan.
4. Pointer-only updates to tenant + HQ `CLAUDE.md`/`AGENTS.md` (do not duplicate the full plan).
5. WP-P + WP-D for this slice.

---

## 7. Recommended sequence (calendar, not parallel chaos)

```
WP0 honesty + SUPERSEDED
 -> WP1 idle + global RPC          [may resume Render at 1 instance, delivery false]
 -> WP2 in-process runner in platform-api (D1 already approved)
 -> WP3 registry jobs for ntf loops
 -> WP4 fixture canary + reconcile port
 -> WP5 DATABASE jobs one-by-one
 -> WP7 console polish (can overlap WP5)
 -> WP8 soak
 -> WP6 delete worker service + HTTP bridges
 -> WP9 `/documentation` pack
 -> WP10 Cursor rule + background-execution skill
```

Each arrow also includes **WP-P** and **WP-D**. Old “9.3 rule files” is **WP10**.

**Do not** enable notification dispatch to “clear I11a missing jobs.” I11a is mostly **DATABASE** jobs, not the sender.

---

## 8. Owner decisions — **approved 20 Nov 2026**

| ID | Decision | Approved |
|---|---|---|
| D1 | Merge background runner into `platform-api` vs keep second Render process | **Merge** into `platform-api`; delete worker service after soak |
| D2 | Shadow in production | **Off** until soak; then optional low-frequency job |
| D3 | Tick / safety-net interval | **15 minutes** (D10). NOTIFY is immediate; this interval is only the safety net. |
| D4 | Who may Run now dispatch | `hq_ops:manage_jobs` + env kill true |
| D5 | Canary fixture | Dedicated non-customer tenant/recipients |
| D6 | Resume Render worker before WP1 | **No** — WP1 first or stay suspended |
| D7 | Tax-kit / trial enable | Separate product/legal, not I11 default |
| D8 | Redis vs BullMQ | **Redis on HQ API now** (cache/limiter/locks). **No BullMQ** on outbox until graduation gates. Job runner has no `REDIS_URL` unless that path is explicitly approved. |
| D9 | How `LISTEN` works on Supabase | **One dedicated `pg.Client` in session mode** (direct DB URL, not transaction pooler, not PostgREST). Payload is a channel name + job_code only — no PII. If the session URL is missing, WP1/WP2 run **safety sweep only** until the URL exists. |
| D10 | Transitional poll until LISTEN | **15 minutes** in code, comments, Run now copy, runbook, QA. Not 60s, not undocumented 20/30 min. After LISTEN, 15 min remains the safety net. |
| D11 | Which registry rows are SUPERSEDED in WP0 | HTTP wrappers only: `ntf-outbox-processor`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox`, `fin-outbox-processor`, `fin-gift-card-expiry`, `fin-credit-note-expiry`, `fin-loyalty-points-expiry`, `fin-erp-posting-retry`, `fin-pos-session-rollover`. Do **not** SUPERSEDE SQL-class jobs (`ntf-outbox-retry`, quota/retention/push-sub, `file-util-*`, cleanups, `fin-idempotency-cleanup` stays until WP5 retargets it off HTTP). UI: OBSERVE only; no Enable/Restore/Run now. |
| D12 | WP5 cadence | **One handler per migration**, Owner applies, remote verify, then next. No bulk restore of missing `cron.job` rows. |
| D13 | Cron timezone | All `pg_cron` and HQ worker cron matchers are **UTC**, same as File Util. Operator UI must say UTC. |
| D14 | Process lifecycle | SIGTERM: stop new claims, drop LISTEN, finish in-flight within a deadline, then exit. LISTEN reconnect with backoff; a dropped listen must **not** crash Nest HTTP. Two API instances after soak are allowed: **`SKIP LOCKED` is the lock**, not a Redis leader. Canary still **one** instance. |
| D15 | SUPERSEDED = product freeze | D11 HTTP jobs will **not run** until WP5 replacements. That pauses campaign expansion and finance expiry/rollover/ERP HTTP. `/ops/jobs` must not treat SUPERSEDED + “Missing in scheduler” as something to Enable. Owner accepts this freeze. |
| D16 | No dual runners | When `platform-api` `BackgroundExecutionModule` is on, `platform-workers` dispatch/shadow/purge loops stay **off**. Same claim table; two hosts claiming is safe only via SKIP LOCKED, but two **schedulers** for File Util slots is not. Cutover: API on, then disable worker loops, then delete service. |
| D17 | Delivery semantics | **At-least-once** + provider idempotency key + exact-token finalize. 429 → hold/backoff, not a tight loop. Poison: max attempts then DEAD_LETTER, never infinite retry. Timeout → UNCERTAIN → provider-specific reconcile only. |
| D18 | DB objects | New functions: locked `search_path`, no `anon`/`authenticated` execute, `COMMENT ON`, names ≤ 30 chars, tenant predicates, index for global claim (`status, not_before, leased_until`) justified at apply time. |
| D19 | Central work platform | One enqueue API (`WorkOutbox.enqueue`) in the **same DB transaction** as the domain write. One runner (`BackgroundExecutionModule` + allowlisted `ExecutorRegistry`). `/ops/jobs` is the only operator surface. No new feature-level `setInterval`, BullMQ `Queue.add`, `pg_net`, or tenant job HTTP. Not a generic command runner; not a god service. |
| D20 | CLAUDE.md | Planning and implementation **always** follow tenant `CLAUDE.md`/`AGENTS.md` and HQ `CLAUDE.md`/`AGENTS.md`. Load the named skill before writing that kind of artifact. A slice that skipped them is incomplete. |

---

## 9. Explicit non-goals (unchanged, restated)

- Do not restore HTTP `pg_cron` to make `/ops/jobs` green.
- Do not apply migrations or enable delivery from this replan.
- Do not put provider keys or `PLATFORM_WORKER_API_KEY` in the registry.
- Do not use CASCADE drops to “clean” job functions.
- Do not move ledger posting into a queue.
- Do not build a god service that sends email, posts GL, and deletes S3 in one class.
- Do not add a central HTTP job API that accepts `command`, SQL, or arbitrary URLs.

---

## 10. Definition of done (I11/I11a close)

I11 may close only when **all** are true on **remote** evidence:

1. No supported path from `pg_cron`/`pg_net` to Vercel tenant job routes.
2. One HQ background runtime; worker service gone or documented rollback-only.
3. Idle: empty outbox produces no per-tenant RPC storm.
4. `/ops/jobs` can enable/disable/Run now **file-util-purge**, **ntf dispatch** (env kill still required), and each approved DATABASE job; SUPERSEDED jobs cannot start.
5. Uncertain claims have a scheduled, provider-specific reconciler.
6. 48h soak: zero duplicate provider effects, zero cross-tenant writes, heartbeat live.
7. Finance/campaign/retry/sweeps either run as DATABASE functions or are explicitly deferred with Owner name.
8. Runbook, QA, integration-contracts, and env inventory match production.
9. New background work is created only via `WorkOutbox.enqueue` or an approved DATABASE function; `ExecutorRegistry` has no unknown `job_code` path (D19).

Until then I11 stays a **blocker**, correctly.

---

## 11. Implementation note

This file is the **execution roadmap**. The original I11 PLAN Progress Log points here; do not fork two living task lists. Implement WP0 then WP1 only after the Owner authorizes that code slice. **Never skip tenant/HQ `CLAUDE.md` (D20).** Skills: those CLAUDE tables, then `/database`, `/backend`, `/frontend`, `/i18n` as applicable; WP9 `/documentation`; WP10 `/create-rule` + `/create-skill`.

---

## 12. Planning pack (complete — no code)

This section finishes planning so WP0 can start without architecture debate. It does not authorize WP0.

### 12.1 Document roles (one living list)

| Document | Role after 20 Nov 2026 |
|---|---|
| **This file** | Living execution plan (WP0–WP10, D1–D20) |
| [I11 PLAN](I11_background_execution_redesign_PLAN.md) | Progress Log + historical Phase 0–9 |
| [ADR](I11_background_execution_redesign_ADR.md) | Boundary + runtime amendment |
| [Handler contracts](I11_background_execution_handler_contracts.md) | Per-family parity / tests |
| [Runbook](I11_background_execution_RUNBOOK.md) | Operator safety; delivery off |
| [QA guide](I11_background_execution_QA_TEST_GUIDE.md) | Remote evidence checklist |
| [I11/I11a](03_infrastructure_deploy_and_operations.md) | Launch blocker pointer |
| `docs/dev/rules/integration-contracts.md` (both repos) | Cross-project ownership |

### 12.2 Old I11 phases → this plan

| Old remaining work | WP |
|---|---|
| 0.4 freeze, 4.7 HQ `/ops/config` QA, tick/docs drift | WP0 |
| SUPERSEDED HTTP jobs (new) | WP0 / D11 |
| 2.2 idle, 4.1 one instance, N+1 RPCs | WP1 |
| 4.2/4.4 runner host, 6.2 in-process execute | WP2 |
| 2.3/2.4 beyond File Util, 7.1 ntf in registry | WP3 |
| 4.3/5.2/5.3 canary, reconcile, fixture | WP4 |
| Phase 3, 5.4, I11a missing DATABASE cron | WP5 |
| 5.5/9.1 decommission | WP6 |
| 7.1 FET UI, 6.4/7.3/I5 alerts | WP7 |
| Phase 8 soak/security/perf, 4.5 secrets | WP8 |
| 9.2/9.3/WP progress-log chores | WP-P / WP-D every slice; WP9 pack; WP10 rules+skill |
| Central enqueue + executor allowlist (D19) | WP2 / WP-D19 |

### 12.3 WP0 — planned tasks (drafted 21 Nov 2026; migration not applied)

| ID | Task | Repo | Exit |
|---|---|---|---|
| WP0.1 | Keep delivery false; worker suspended | Render | Env evidence, no `ntf-outbox-dispatch` lines |
| WP0.2 | Set all tick constants + comments + Run now i18n + runbook/QA to **15 min** (D10) | both | Grep finds no “one minute” operator copy for HQ worker start |
| WP0.3 | Deploy HQ `0777` unwired guards; browser `/ops/config` EN/AR | HQ | No Set value / Change policy on unwired keys |
| WP0.4 | Draft migration: `lifecycle_status` + `superseded_by`; seed D11 rows SUPERSEDED; V2 list/set_state/run_now/restore reject SUPERSEDED | `cleanmatex` | Owner reviews SQL; **do not apply in this planning step** |
| WP0.5 | HQ API/web: hide Enable/Edit/Run now when SUPERSEDED; badge + i18n | HQ | Tests + `check:i18n` |
| WP0.6 | Inventory HQ API Redis (present/absent) and whether a **session-mode** DB URL exists for LISTEN (D8/D9) | HQ | Written inventory, no secret values |
| WP0.7 | SUPERSEDED / HTTP-restore-stripped: UI “retired”, not Enable-on-Missing | HQ | No Enable/Restore on D11 rows |
| WP0.8 | Runbook + job notes: D15 freeze (campaigns + finance HTTP jobs paused) | both | Operator-readable EN/AR |
| WP0.P | Progress Log + this file status (WP-P) | both | Log row exists |
| WP0.D | Related docs for this slice (WP-D) | both | Runbook/QA/guides match ticks + SUPERSEDED |

### 12.4 WP1 — planned tasks (after WP0 applied)

| ID | Task | Exit |
|---|---|---|
| WP1.1 | Idle: no tenant list when dispatch off and shadow off | Unit test + remote statements |
| WP1.2 | Shadow default false unless env `true` **and** registry (after WP3) | Startup warning when off |
| WP1.3 | `fn_ntf_outbox_due_sum_all` + `fn_ntf_worker_claim_due_global` (service-role, `tenant_org_id` on every `org_*`, `SKIP LOCKED`, fair share) | Migration + tests; Owner apply |
| WP1.4 | File Util runner: heartbeat/sync without full claim path when disabled and no MANUAL | Tests |
| WP1.5 | Jitter; no immediate `void tick()`; scale-to-zero then 1 | Runbook step |
| WP1.6 | Dynamic-import BullMQ only if rollback flag | Bundle/test |
| WP1.7 | Bound Supabase JS timeouts | Code |
| WP1.8 | Global-claim index candidate + remote `EXPLAIN` after apply (D18) | `cleanmatex` | Plan on due predicate; no speculative indexes |
| WP1.P | WP-P progress | both | Log row |
| WP1.D | WP-D related docs | both | Runbook idle/RPC |

**Resume Render (idle only) is allowed after WP1.1–WP1.7 remote proof, still `NTF_OUTBOX_WORKER_ENABLED=false`.**

### 12.5 Later WPs (planning only)

- **WP2:** Nest module on `platform-api`; `ExecutorRegistry`; in-process `OutboxDeliveryService`; `LISTEN` on session URL; concurrency cap; `PLATFORM_BG_ENABLED` kill; D16 worker-loop off.
- **WP3:** New `HQ_WORKER` rows `ntf-outbox-dispatch` (desired off), `ntf-outbox-shadow` (desired off); later `ntf-outbox-reconcile`; runner heartbeat job or health signal.
- **WP-D19:** Tenant (+ HQ if it writes work) `WorkOutbox.enqueue` used in the same transaction as domain writes; lint/docs forbid new job timers/BullMQ/`pg_net` from feature folders. Existing outbox inserts migrate onto this helper without changing row shape. Screens never call execute HTTP.
- **WP4:** Fixture tenant; stale-claim probe; one-claim canary; port provider-specific reconciler; no generic requeue.
- **WP5:** Order in §6 WP5; each handler: function + grants + tests + `pg_cron` + SET_STATE.
- **WP6–WP8:** As §6; each ends with WP-P + WP-D.
- **WP9:** `/documentation` skill — full needed pack.
- **WP10 (last):** Cursor rule + `background-execution` skill; pointer in CLAUDE.md/AGENTS.md.

### 12.6 Schema intents (draft at implementation, not now)

- `sys_ops_job_cf.lifecycle_status` `ACTIVE \| SUPERSEDED \| RETIRED`, default `ACTIVE`.
- `sys_ops_job_cf.superseded_by` nullable `job_code` (e.g. processor → `ntf-outbox-dispatch` after WP3).
- `fn_ntf_outbox_due_sum_all()` — aggregates only, no PII.
- `fn_ntf_worker_claim_due_global(...)` — bounded, skip locked, exact token semantics unchanged.
- `NOTIFY ntf_outbox_due` from claim-eligible insert/update (WP2/D); payload not a recipient.

### 12.7 Planning complete — remaining Owner actions (not code)

1. Say **start WP0** when ready (drafts SQL/UI; you still apply migrations).
2. Confirm fixture tenant identity when WP4 is reached (D5).
3. Confirm session-mode DB URL for LISTEN when WP2 is reached (D9 inventory from WP0.6).
4. Keep tax-kit / trial as separate product decisions (D7).

**Planning is finished.** WP0 source is drafted (21 Nov 2026); `0779` is **not applied**. Delivery remains disabled.

---

## 13. Planning sign-off

| Item | State |
|---|---|
| Architecture (outbox, SKIP LOCKED, one HQ runtime, registry, NOTIFY bell) | Approved D1–D8 |
| Redis platform vs BullMQ jobs | Approved D8 |
| LISTEN mechanism, 15 min poll, SUPERSEDED list, WP5 cadence | Planning-locked D9–D12 |
| Dual task lists | Closed — this file executes; old PLAN logs |
| Code / migrations / delivery / Render resume | `0779` applied local + remote; types and Prisma regenerated. Delivery and Render worker stay off. |
| Plan QA (§14, D13–D18) | Closed in planning; production-ready only after WP8 remote evidence |
| Central work platform (D19, §5.6) | Planning-locked: one enqueue, one runner, allowlisted executors |
| CLAUDE.md always (D20); WP-P/WP-D each step; WP9 docs skill; WP10 rule+skill | Planning-locked |

---

## 14. Plan QA — production-ready / future-proof (planning, 20 Nov 2026)

A plan cannot **be** production-ready software. This section records whether the **plan** is complete enough that a careful implementation can be. Score: **architecture 9/10; this document after D13–D18 ~9/10; shipped system remains 0 until WP8.**

### 14.1 What was already sufficient

Transactional outbox, SKIP LOCKED, one scheduler, registry, NOTIFY as bell, exact-token finalize, no generic requeue, no Vercel cron, Redis≠queue, merge into HQ API, SUPERSEDED HTTP jobs, idle + global claim, fixture canary, WP5 one-handler, WP8 soak.

### 14.2 Gaps found in this review (now closed in D13–D18 / tasks below)

| Gap | Why it would have become a bug | Closure |
|---|---|---|
| LISTEN drop / pooler | Nest HTTP crash or silent no-wake | D9 + D14 reconnect; sweep remains |
| Merge into API still overlaps on deploy | Two claimers (same as worker overlap) | D14 SKIP LOCKED; canary one instance; SIGTERM drain |
| Two hosts after WP2 | File Util **slot** double-schedule | D16 cutover: API on, worker loops off |
| SUPERSEDED still looks “Missing — Enable me” | Operator restores HTTP | D15 + WP0.7 UI |
| D11 freezes campaigns and finance expiry | Silent product outage | D15 explicit Owner freeze until WP5 |
| D3 vs D10 (5–15 vs 15) | Tick drift again | D3 = 15 min |
| 429 tight loop / poison retry | Cost and duplicate risk | D17 |
| New RPCs without grants/index/comments | RLS bypass or seq scan | D18 |
| `0777` still `HQ_WORKERS` after merge | Honest registry lie | WP2 + WP9 |
| `fin-idempotency-cleanup` HTTP restore while not SUPERSEDED | Enable could POST tenant API | WP0.4: strip RESTORE/RUN_NOW if command is HTTP, even if lifecycle stays ACTIVE until WP5 |
| Independent Disk I/O | False “worker is healthy” | Out of I11; WP8 does not close it |
| HQ Jest stall (old 6.2) | Fake green | WP8 CI evidence |
| Clock/TZ | Cron at wrong local hour | D13 UTC |
| Dual kill switches | Registry on + env off unclear | Env AND registry: send only if **both** allow (D4) |
| Feature-local timers / queues / job HTTP | Second I11 | D19 one enqueue + one runner + allowlisted executors |

### 14.3 Extra tasks (were missing from §12)

| ID | Add to | Task |
|---|---|---|
| WP0.7 | WP0 | SUPERSEDED (and HTTP-restore-stripped) jobs: no Enable; drift text is “retired”, not “Missing — fix scheduler” |
| WP0.8 | WP0 | Document D15 freeze on `/ops/jobs` notes + runbook (campaigns/finance expiry paused) |
| WP1.8 | WP1 | Claim query index candidate + `EXPLAIN` on remote after apply (D18) |
| WP2.6 | WP2 | LISTEN reconnect; SIGTERM drain; `PLATFORM_BG_ENABLED`; D16 worker-loop off |
| WP2.7 | WP2 | Update `0777` `applies_to_app` to `HQ_API` for runner keys when module lives in API |
| WP4.7 | WP4 | 429 hold + poison DEAD_LETTER; Resend/Twilio/FCM/VAPID idempotency keys unchanged |
| WP5.0 | WP5 | Each handler: overlap lock, batch cap, UTC cron, grants, tenant tests — copy handler-contract checklist |
| WP8.1 | WP8 | Two API instances SKIP LOCKED race; LISTEN kill; 429; poison; SIGTERM; UUID Postgres-compat; no dual File Util slot |
| WP8.2 | WP8 | Access-contract/i18n/`check:ui` for SUPERSEDED + new job codes; no new tenant job routes |
| WP2.8 | WP2 | `ExecutorRegistry` allowlist; refuse unknown `job_code`; in-process execute only via map (D19) |
| WP-D19.1 | WP2/tenant | `WorkOutbox.enqueue` helper; same TX as domain write; migrate existing outbox inserts onto it |
| WP-D19.2 | both | Lint or review rule: no new feature `setInterval` / BullMQ `Queue.add` / `pg_net` / tenant job HTTP for scheduled work |
| WP-D19.3 | HQ web | No screen calls execute HTTP; Run now stays `/ops/jobs` |
| WP-P / WP-D | every WP | Progress Log + related docs; WP incomplete without them |
| WP9 | after WP8 | `/documentation` skill — generate/complete needed packs |
| WP10 | last | Cursor rule + `background-execution` skill; CLAUDE/AGENTS pointers |

### 14.4 Future-proof (do not build now)

- BullMQ **consumers** only after D8 graduation gates; still write outbox first for customer-visible work.
- Split worker process only if HQ API CPU/RAM evidence says so (reverse of D1 is allowed with the **same** module).
- Redis distributed lock is **not** required for claims.
- Do not invent a second outbox in Redis.

### 14.5 Honest non-claims

This plan does **not** guarantee zero bugs. It forbids the classes that already hurt I11 (dual sender, blind resend, busy N+1 poll, env-implied BullMQ, Enable-on-HTTP-cron). Remaining risk is implementation and WP5 domain SQL parity (finance lock order, campaign consent). Those stay handler-contract gated.

### 14.6 Production-ready checklist (close I11 only when all true)

Use §10 plus: D15 freeze lifted or Owner-deferred in writing; D16 single runner; D17 429/poison proven; D18 grants on remote; WP8.1 race tests; alerts (I5) optional for I11 close but required for launch.
