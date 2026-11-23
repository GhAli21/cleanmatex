# CleanMateX Background Jobs — Target Design (solo-founder edition)

**Status:** **Approved by the Owner, 23 Nov 2026**, including every fix in §18 and §19 and decisions S-D1 to S-D5. S-D6 (database region) is still open. Step 0 is in progress. Written from first principles, with nothing frozen, under the Owner's rules: lowest cost today, easy for one person to run, able to scale later, boring proven technology, measure before adding infrastructure, one API container and one worker container. If approved, it replaces the runtime parts of the [ADR](../../pending_to_production/16_11_2026/I11_background_execution_redesign_ADR.md), the [expert replan](../../pending_to_production/16_11_2026/I11_background_execution_EXPERT_REPLAN.md) and the [handler contracts](../../pending_to_production/16_11_2026/I11_background_execution_handler_contracts.md). Nothing here is applied.
**Evidence date:** remote Supabase read-only queries, code reads, and library documentation checked on 23 Nov 2026.
**Names used here:** "HQ web" is `cleanmatexsaas/platform-web`, the HQ UI. "HQ API" is `cleanmatexsaas/platform-api`. "HQ worker" is `cleanmatexsaas/platform-workers`. "Tenant worker" is the proposed `cleanmatex/cmx-workers`, which replaces the HQ worker.

---

## 1. The design in one page

| Piece | Choice |
|---|---|
| Queue | **pg-boss** (v12.x) inside the existing Supabase Postgres. No Redis, no new database, no new vendor. |
| Containers | **1 API** (HQ `platform-api`, already running) + **1 worker** (`cleanmatex/cmx-workers`, replacing today's `platform-workers`, so no new service). Vercel keeps serving the web apps. |
| Code | **Two repositories stay.** Only the worker moves: `platform-workers` becomes `cleanmatex/cmx-workers`, so it imports tenant finance, order and notification-preparation code in-process. HQ API keeps its notification-sending code and consumes the `ntf.deliver` and `ntf.reconcile` queues itself (§14.5). |
| Creating work | Inside the business transaction, through pg-boss's Prisma adapter in producer mode (§18.2). If the business write rolls back, the job never existed. |
| Schema | pg-boss's schema SQL is a normal repo migration that the Owner applies. Self-migration is off everywhere (§18.2). |
| Job contents | Ids only. Data stays in the domain tables. |
| Retries | Exponential backoff with a cap. After the last attempt, the job moves to a dead-letter queue. |
| Idempotency | Every job is safe to run twice: one shared effect table records which effects already happened. |
| Crash recovery | pg-boss heartbeat. A job held by a dead worker is retried automatically within a minute. |
| Schedules | pg-boss cron for jobs that run app code. `pg_cron` stays for the nine pure-SQL housekeeping jobs that already work. |
| Operations | The existing HQ `/ops/jobs` page, rebuilt on pg-boss queue stats: counts, failures, dead letters, redrive, pause per queue. |
| Errors and alerts | Sentry, already installed in HQ, plus four alert rules. No new monitoring product. |

**Cost change:** zero new paid services. `platform-workers` becomes the worker. Redis and BullMQ leave the job path.

---

## 2. Why redesign: what is broken today

Remote database, 23 Nov 2026:

| Finding | Impact |
|---|---|
| 115 finance domain events pending, oldest 5 Nov | Loyalty points, order history, order-change confirmations, voucher, payment and refund follow-ups have not been applied for 18 days. |
| 22 dead-lettered events | All are events for orders that were deleted. They were retried 5 times when they should have been skipped once. |
| 14 notifications queued since 21 Nov, 5 sent ever | No delivery path is running. |
| Database allows 60 connections; Supabase's own services use about 23 at idle | About 35 remain for all apps. Every new process must justify its connections. |
| Database pooler in AWS `us-east-2` (Ohio), confirmed from the production Vercel `DATABASE_URL` host on 23 Nov 2026 | The worker and HQ API must run in Ohio next to the database. |
| Scale: 5 tenants, 21 orders, 121 domain events in 30 days | Throughput is irrelevant today. Correctness and simplicity matter. |

Code:

| Finding | Impact |
|---|---|
| Order submit and order transition call `void emitNotificationEvent(...)` after commit. The orchestrator then does about ten reads and writes the outbox. | On Vercel, work after the response can be frozen, so notifications can vanish without a trace. |
| `claim_outbox_batch` marks rows `PROCESSING` with no lease. | A crash strands events forever. |
| One finance event runs several handlers in one attempt. | A failure in the second handler re-runs the first. |
| Provider code (WhatsApp, SMS, push) exists in three places across two repos. | Fixes miss copies. |
| Campaign expansion is about 600 lines inside a route file. | A worker cannot reuse it without extraction. |
| Six services fall back to the browser Supabase client when no client is passed. | In a worker, that reads nothing under RLS and fails silently. |
| The current plan needs HQ to run tenant-repo code in-process. | Impossible across two repos. That is why seven jobs are frozen. |
| About 27 migrations, 20 claim and control functions, and 10 environment switches of hand-built plumbing. | Most I11 incidents were configuration incidents. |

**Proven on 23 Nov:** the full finance job code (ERP posting engine, gift cards, loyalty, POS rollover, outbox processor) loads in plain Node. It needs the TypeScript loader with `tsconfig` paths, a one-line stub for `server-only`, and the public env values. A worker can run the existing services unchanged.

---

## 3. The rules, and how the design meets each

| Owner rule | How it is met |
|---|---|
| Lowest cost today | No new paid service. The worker replaces `platform-workers`. The queue lives in the existing database. |
| Easy to operate alone | One queue technology, one worker, one screen, one emergency switch. |
| Able to scale later | pg-boss is safe with several worker instances. Each scaling step in §9 is a config change or one more container, triggered by a measurement. |
| No unnecessary complexity | No Redis queue, no workflow engine, no OpenTelemetry, no per-tenant pause, no separate compute workers until measured need. |
| Boring, proven technology | Postgres, a plain Node process, pg-boss (a long-maintained, widely used Postgres queue at major version 12), Sentry. |
| Measure before new infrastructure | §9 lists the metric that justifies each step. |
| Avoid premature microservices | One worker process runs every job. Domains are folders, not services. |
| Every slow task becomes a background job | §6 lists the request-path work that moves into jobs. |
| Small, lightweight jobs | One job does one thing for one entity. Sweeps only find ids and enqueue item jobs. |
| Pass ids, not objects | Payloads are validated by a schema that allows ids and small flags only. |
| Idempotent and retry-safe | Shared effect table (§5.4), and natural keys where the domain already has them. |
| Exponential backoff | `retryBackoff: true`, `retryDelay` and `retryDelayMax` set per queue. |
| Critical jobs auditable | Money and customer-message jobs keep their job history for 30 days, and their effects are recorded permanently in the effect table and domain tables. |
| Failed jobs go to a DLQ | Every queue sets `deadLetter: 'dead_letter'`. The HQ screen previews and redrives dead letters. |
| 1 API container + 1 worker container | Exactly that. |

---

## 4. Architecture

```text
 Vercel                      Render (Ohio, next to the database)  
 ┌──────────────┐           ┌───────────────────┐   ┌─────────────────────────┐
 │ tenant-web   │           │ API container      │   │ Worker container         │
 │ hq-web       │           │ platform-api       │   │ cleanmatex/cmx-workers   │
 │ requests only│           │ HTTP + ntf.deliver │   │ all tenant-code queues   │
 │ (producers)  │           │ + ntf.reconcile    │   │ + pg-boss crons          │
 └──────┬───────┘           └─────────┬─────────┘   └────────────┬────────────┘
        │  business write + boss.send(..., { db: fromPrisma(tx) })                │
        └───────────────────────┬─────┘                         │ fetch / complete
                                ▼                               ▼
                 ┌──────────────────────────────────────────────────────┐
                 │ Supabase Postgres                                     │
                 │  pgboss schema: queues, jobs, schedules, dead_letter  │
                 │  domain tables: outboxes, ledgers, events (audit)     │
                 │  org_job_effect_tr: one row per applied effect        │
                 │  pg_cron: pure-SQL housekeeping only                  │
                 └──────────────────────────────────────────────────────┘
```

### 4.1 Repository layout

Only the worker moves. Both repositories otherwise keep their shape.

```text
cleanmatex/                      (tenant repo, owns all migrations)
  web-admin/                     tenant web; enqueues jobs in producer mode
  cmx-workers/                   NEW npm workspace; replaces cleanmatexsaas/platform-workers
  packages/jobs/                 NEW: queue names, Zod payload schemas, enqueue + effect helpers
  supabase/migrations/           includes the pg-boss schema migration

cleanmatexsaas/                  (HQ repo)
  platform-api/                  HQ API; adds pg-boss work() for ntf.deliver + ntf.reconcile
  platform-web/                  HQ web; /ops/jobs rebuilt on pg-boss data
  platform-workers/              DELETED after cmx-workers is live
```

Domain services stay in `web-admin/lib/services`. The worker imports them directly, which is proven to work (§2). They move into `packages/` only when a second consumer needs them. Provider code stays only in HQ API `notifications-hq`.

### 4.2 Why pg-boss

| Option | Verdict | Reason |
|---|---|---|
| **pg-boss** | **Chosen** | Native dead-letter queue and redrive, exponential backoff with cap, heartbeat crash recovery, cron safe across instances, transactional enqueue with a Prisma adapter, queue stats API, job history retention. Postgres only. |
| Graphile Worker | Second | Fast and solid, but no dead-letter queue, deletes jobs on success (no audit trail), and leaves a crashed worker's jobs locked for 4 hours. Each gap needs custom code. |
| Keep the hand-built claim functions | No | Every job keeps costing a migration, a claim function and a runbook entry, and crash recovery is missing. |
| BullMQ + Redis | No | A second durable store to run and pay for. The Upstash incident already happened. |
| Temporal, Inngest, Trigger.dev | No | A new platform to operate or pay for. Not needed at this scale. |
| Vercel Cron or Supabase Edge Functions | No | Time limits, cold starts, and they cannot import the domain code cleanly. |

pg-boss facts this design relies on, verified against pgboss.io on 23 Nov 2026 (v12.39.0, Node 22.12+, Postgres 13+):

- `send(name, data, { db: fromPrisma(tx) })` inserts the job inside the caller's transaction. On rollback the job disappears.
- Queue options: `retryLimit` (default 2), `retryDelay`, `retryBackoff` (exponential with jitter), `retryDelayMax`, `expireInSeconds` (default 15 minutes), `heartbeatSeconds`, `deleteAfterSeconds` (default 7 days), `retentionSeconds` (default 14 days), `deadLetter`.
- After the last retry, the job is copied into the dead-letter queue with its source queue, id and error output. `redrive` moves it back. `previewRedrive` shows what would move.
- `schedule(name, cron, data, { tz })` is safe with several instances. Default time zone is UTC.
- A job id passed to `send()` deduplicates: inserts are `ON CONFLICT DO NOTHING` on `(name, id)`. `singletonKey` deduplicates only with `singletonSeconds` or a non-standard queue policy; **on a standard queue it does nothing on its own** (verified in step 2, §22).
- `getQueues` and `getQueueStats` return queued, active, failed and total counts.
- `offWork(name)` stops a queue's worker in this process.
- Polling every 2 seconds by default. LISTEN/NOTIFY is optional and needs a session-pinned connection.
- The schema migrates itself on `start()`. `migrate: false` disables that.

### 4.3 Connections

| Process | Pool |
|---|---|
| Worker: pg-boss | `max: 4`, through the Supabase session pooler |
| Worker: Prisma | `connection_limit=3`, through the transaction pooler |
| HQ API: pg-boss consumer | `max: 3`, through the session pooler |
| Vercel functions: pg-boss producer | 0 extra. Producer mode uses the request's own Prisma connection (§18.2). |

The worker and HQ API add about 10 connections together, which fits inside the measured headroom. The old `platform-workers` connections go away.

Polling: `ntf.deliver` every 1 second (HQ API), `ntf.orchestrate` every 2 seconds, every other queue every 30 seconds.

**What the 60-connection limit means.** It is Postgres `max_connections` on the current Supabase compute size, not a limit on users or logins. Users never hold a database connection. Their browsers talk to Vercel, Supabase Auth and PostgREST, and those services share small pools. Prisma traffic goes through Supavisor in transaction mode, which lends a real connection only for the length of one transaction. On this compute size the pooler accepts up to 200 clients and keeps about 15 real connections. What uses connections is **queries running at the same moment**. At about 5 ms per query, 15 pooled connections serve on the order of a few thousand queries per second. Larger compute sizes raise the limit: Small allows 90 and Medium 120.

**Rule for Vercel:** Prisma must use the transaction pooler (port 6543, `pgbouncer=true`) with `connection_limit=1` or `2`. A direct connection, or a high `connection_limit`, multiplies by every serverless instance Vercel starts and can exhaust the 60 under load. `docs/dev/implementation/PRISMA_INTEGRATION.md` suggests `connection_limit=10`, which is too high for serverless. Confirm the production Vercel value.

---

## 5. Job model

### 5.1 Effect classes

| Class | Meaning | Retry rule |
|---|---|---|
| `INTERNAL` | Only database writes. | Retry freely. The effect table makes a second run a no-op. |
| `EXTERNAL_IDEMPOTENT` | Calls a service that accepts an idempotency key, or is naturally idempotent. | Retry with the same key. |
| `EXTERNAL_UNCERTAIN` | Calls a service without a reliable key, so a timeout leaves the outcome unknown. | Mark the row `UNCERTAIN` and enqueue a reconcile job. Never resend until the provider proves it did not accept the message. |

### 5.2 Queue settings by class

| Setting | `INTERNAL` | `EXTERNAL_*` |
|---|---|---|
| `retryLimit` | 8 | 6 |
| `retryDelay` / `retryBackoff` / `retryDelayMax` | 10 s / on / 1 h | 30 s / on / 2 h |
| `heartbeatSeconds` | 30 | 30 |
| `expireInSeconds` | 300 | 120 per message |
| `deleteAfterSeconds` | 30 days for money queues, 7 days otherwise | 30 days |
| `deadLetter` | `dead_letter` | `dead_letter` |

`dead_letter` has no worker, so its jobs never leave the queued state. Set its `retentionSeconds` to 90 days; the pg-boss default of 14 days would silently delete dead letters. The HQ screen shows it and can redrive single jobs or a whole source queue.

### 5.3 Enqueue helper

```ts
// packages/jobs — the only way to create background work
await jobs.enqueue(tx, 'ops.smoke_test', { runId });                 // validated, inside the caller's transaction
await jobs.enqueue(tx, 'ntf.deliver', { outboxId }, { id: outboxId }); // a stable id makes it idempotent (step 5)
await jobs.publish(tx, 'ORDER_SUBMITTED', { tenantOrgId, eventId });  // one job per subscription, job id = event id
```

- `enqueue` validates the payload with the queue's Zod schema. Schemas allow ids, codes and small flags only, so objects and personal data cannot be passed.
- It calls `boss.send(name, data, { db: fromPrisma(tx), ...options })`.
- Unknown queue names are a type error.
- An ESLint rule bans `void` on promises, `setInterval`, BullMQ, `pg_net`, and calls to internal job routes in `app/api/**` and `lib/services/**`.

### 5.4 Effect table

```sql
org_job_effect_tr (
  tenant_org_id UUID NOT NULL, effect_key TEXT NOT NULL, queue_name TEXT NOT NULL,
  job_id UUID NOT NULL, ...full audit columns,
  PRIMARY KEY (tenant_org_id, effect_key)
)
```

The handler opens its Prisma transaction, inserts its effect key with `ON CONFLICT DO NOTHING`, and returns early if nothing was inserted. Otherwise it does the domain writes in the same transaction. The result is one effect per key, no matter how many times the job runs. It also gives a permanent audit record of which job applied which effect, after pg-boss deletes the job itself.

### 5.5 Job shapes

| Shape | When | Example |
|---|---|---|
| **Reaction** | Enqueued in the business transaction | `order.completed` → one `fin.domain_event` job per event, plus `ntf.orchestrate`. Each finance handler inside the job is guarded by its own effect key, so a retry never reruns a handler that already succeeded (§19, P3). |
| **Delayed** | `startAfter` within the next few days | POS session rollover at cutoff, end of quiet hours, campaign send time |
| **Sweep** | pg-boss cron, for long horizons | Daily gift-card, credit-note and loyalty expiry. The sweep only selects due ids through a bounded SQL function and enqueues one item job each with the entity id as the job id. |
| **Retry by design** | The failure path schedules the next attempt | An ERP posting failure enqueues `fin.erp_post` with a delay. No standing retry sweep. |

### 5.6 Orphans and poison

- **Orphan:** the entity is gone or no longer in the expected state. Complete the job as a no-op and log `SKIPPED_ORPHAN`. Never retry it.
- **Poison:** repeated failure for a code or data reason. Backoff runs its course, then the job goes to `dead_letter`, an alert fires, and it waits for a fix and redrive.

---

## 6. What moves into jobs

| Today | Becomes |
|---|---|
| `void emitNotificationEvent(...)` in order submit and transition | `enqueue(tx, 'ntf.orchestrate', { tenantOrgId, eventId })` inside the order transaction |
| Finance domain outbox + `claim_outbox_batch` + one-attempt fan-out | One reaction job per consumer. The event row stays as the audit record. |
| Notification outbox claim functions, HTTP execute hop, canary flags | `ntf.deliver` per outbox row, `ntf.reconcile` for uncertain rows |
| Campaign expansion route | `ntf.campaign_start` at send time → `ntf.campaign_chunk` jobs of 50 targets |
| Gift-card, credit-note, loyalty expiry | Daily sweep → one item job per entity |
| POS rollover sweep | Delayed job at the session's cutoff, with a daily sweep as a safety net |
| ERP posting retry sweep | Retry by design |
| B2B dunning route with `CRON_SECRET` | Daily sweep → one item job per statement. Messages go through `ntf.orchestrate`. |
| File purge in `platform-workers` | `file.purge` per file, enqueued by a sweep over expired files |
| Future: trial expiry, SaaS billing, ZATCA submission, PDF and export generation | Same model. ZATCA submission is `EXTERNAL_UNCERTAIN` with a reconciler. |

Stays on `pg_cron`, because it is pure SQL and already works: session sweep, quota reservation sweep, retention sweep, stale push subscriptions, idempotency cleanup, setup health, tax kit, and the two truncate jobs.

---

## 7. Notifications pipeline

```text
-- where each step runs (per §14.5): tenant web = order transaction; tenant worker = ntf.orchestrate;
-- HQ API = ntf.deliver, ntf.reconcile, provider webhooks
order transaction:  write order  +  enqueue ntf.orchestrate { tenantOrgId, eventId }
ntf.orchestrate  (INTERNAL)
    settings, consent, quiet hours, template, channel
    write in-app rows directly
    write org_ntf_outbox_dtl rows  +  enqueue ntf.deliver { outboxId }  (startAfter = quiet-hours end)
ntf.deliver  (class by channel)
    claim the row (status PROCESSING, claim_token = pg-boss job id)  →  recheck policy  →  call provider
    accepted → SENT    rejected → FAILED or retry    timeout → UNCERTAIN + enqueue ntf.reconcile (startAfter 2 min)
ntf.reconcile  (per provider)
    provider says sent → SENT    proven not sent → one resend    unknown → dead letter + alert
provider webhook (API container)
    verify signature → store raw event → enqueue ntf.status_apply → return 200
```

- One copy of each provider, in HQ API `notifications-hq`. The tenant adapters, `lib/integrations/whatsapp-client.ts` and the `platform-workers` copies are deleted.
- Transactional messages use priority 0. Campaign chunks use a lower priority, so a big campaign never delays a receipt.
- On a provider rate limit, the job re-enqueues itself with `startAfter` and completes, instead of spinning.

---

## 8. Operations

### 8.1 HQ `/ops/jobs`, rebuilt on the queue

| Section | Shows | Actions |
|---|---|---|
| Queues | Queued, active, failed, deferred and total counts per queue, from `getQueueStats` | Pause and resume a queue |
| Dead letters | Source queue, error, attempts, age | Preview redrive, redrive one, redrive a queue, delete |
| Schedules | pg-boss crons and `pg_cron` jobs, next run, last result | Run now |
| Worker | Version, start time, last heartbeat | None |

- Pause is the registry's `sys_ops_job_cf.desired_enabled` (§20.9). Both consumers, `cmx-workers` and HQ API, read it every 30 seconds, call `offWork` or `work` to match, and write `applied_enabled` / `applied_at` back. Jobs stay queued while paused.
- Reading uses the existing HQ permission `hq_ops:read`. Every action uses the existing `hq_ops:manage_jobs` and writes an audit row.
- Lists show counts, queue names and ids only. No recipients, amounts or message bodies.
- EN/AR, RTL, Cmx components.

### 8.2 Alerts

Four rules, sent through Sentry or an email webhook:

1. The oldest ready job in a queue is older than that queue's threshold: 2 minutes for notifications, 1 hour for finance.
2. The dead-letter queue gained jobs.
3. A consumer's heartbeat is older than 2 minutes. Both `cmx-workers` and HQ API register as pg-boss instances, so each has its own heartbeat.
4. A notification row stayed `UNCERTAIN` for more than 1 hour.

### 8.3 One switch

`WORKER_ENABLED=false` on the worker container stops all fetching. Everything else is the queue table.

### 8.4 Deploys

The worker stops fetching on SIGTERM, finishes running jobs up to 30 seconds, then exits. Rolling deploys are safe because pg-boss locks jobs and schedules across instances. Every process runs with `migrate: false`. Upgrading pg-boss means a new repo migration from `getMigrationPlans`, applied by the Owner, then the same pinned version deployed in `web-admin`, `cmx-workers` and HQ API.

---

## 9. Scaling path: measure first

| Step | Do it when | Change |
|---|---|---|
| 1 | Queue wait time exceeds its threshold while the worker is busy | Raise `localConcurrency` on that queue |
| 2 | Notification latency of up to 2 seconds becomes a problem | Turn on `useListenNotify` through the session pooler |
| 3 | Worker CPU stays above 70% | A second worker container, same image. pg-boss handles both safely. |
| 4 | Heavy jobs such as PDFs or exports slow other queues | A second container that only subscribes to the heavy queues |
| 5 | `pg_stat_statements` shows job queries crowding customer queries, or connections run short | Bigger Supabase compute before any new queue technology |
| 6 | Sustained thousands of jobs per second | Only then evaluate a dedicated queue system |

Nothing on this list is needed at launch.

---

## 10. Plan

Pre-launch, so each step replaces the old path directly. No dual-running, no rollback services. Checked against code, the remote database and local experiments on 23 Nov 2026 (§19).

### 10.1 Before step 1 (gates, not code)

| Gate | Why | Who |
|---|---|---|
| Approve S-D1 to S-D6 in writing | They change the locked I11 decisions | Owner |
| Decide the database region (S-D6), then place HQ API, `cmx-workers` and Vercel functions in it (§18.8) | Nothing should move twice | Owner |
| Pin Node **22.12 or newer** for `web-admin` on Vercel, HQ API on Render, and `cmx-workers` | pg-boss 12 requires it. Today no runtime pins a version (§19, P8). | Owner, dashboards + `engines` field |
| Create `docs/features/Background_Jobs/` with `STATUS.md`, `QA_TEST_GUIDE.md`, `RESUME_CONTINUATION.md`, and move this design there with a pointer left behind | Feature docs live in the feature folder | Dev |

### 10.2 Steps

| Step | Work | Done when | Size |
|---|---|---|---|
| 0 | **Stop silent loss now** (can start before the gates). Await notification emission in order submit and transition. Make the order-history consumer complete orphan events as skipped. | No `void` on side effects in routes. Remote: no new dead letters for deleted orders. | 1 day |
| 1 | **Queue foundation — database.** One migration: pg-boss schema from `getConstructionPlans('pgboss')`; this step's queues created with `SELECT pgboss.create_queue(name, options)`: `dead_letter` (`retentionSeconds` 90 days), `fin.domain_event`, `ops.smoke_test`. Each later step's migration creates that step's queues before its producers ship; `org_job_effect_tr`; `sys_job_queue_cf`; grants per §18.3. **Stop: Owner applies local, then remote.** | Remote: pgboss schema, all queues and both tables exist. `anon` and `authenticated` cannot read them. | 2 days |
| 2 | **Queue foundation — code.** `packages/jobs`: queue names, Zod payload schemas, producer-mode enqueue (§18.2), effect helper. ESLint rule. Producer is not yet called from any business flow. | Local integration test: enqueue inside a transaction, commit keeps the job, rollback removes it. | 2 days |
| 3 | **`cmx-workers`.** New workspace, esbuild bundle (`server-only` aliased to a stub, Prisma external), Sentry, pg-boss instance heartbeat, graceful shutdown, pause reader, handler timeouts below `expireInSeconds`. **Create a new Render Background Worker in the database's region** (the Oregon worker cannot change region). Build filters include `web-admin/lib/**`, `packages/**`, `prisma/**`. | A test job runs, fails, retries with backoff, lands in `dead_letter`, and redrives. Memory measured on 512 MB. | 3 days |
| 4 | **Finance reactions.** Hook enqueue into the shared domain-event writer (`outbox.service.ts` and the four other writers). **One `fin.domain_event` job per event**: it runs the matching handlers, each guarded by its own effect key, then marks the event row `PROCESSED`, so the tenant outbox monitor keeps working. One-off script publishes the 115 pending events; the job id is the event id, so a rerun adds nothing. Stop the old `claim_outbox_batch` path. | Remote: pending events reach zero. Loyalty, history and change confirmations written once. Rerunning a job writes nothing. | 3 days |
| 5 | **Notifications.** Tenant: `ntf.orchestrate` in `cmx-workers`; extract campaign expansion into a service; real OTP sending (launch blocker); receipts through the outbox; delete the tenant provider adapters and `whatsapp-client.ts`. Database: one migration adding a function that claims **one** outbox row by id, reusing today's `PROCESSING` + `claim_token` model with the pg-boss job id as the token. **Stop: Owner applies.** HQ API: pg-boss consumer for `ntf.deliver` and `ntf.reconcile` reusing the existing finalize, mark-uncertain and reconcile functions; `Idempotency-Key` on Resend; webhooks enqueue `ntf.status_apply`. **HQ API must already run in the database's region.** | Demo tenants get each message once, including after a forced timeout and a killed consumer. | 7–9 days |
| 6 | **Sweeps and delayed jobs.** Expiries, POS rollover, ERP retry, dunning, file purge. | Each queue has a run-twice test and a tenant-isolation test. Remote run on demo data. | 3–4 days |
| 7 | **HQ screen and alerts.** Rebuild `/ops/jobs` on queue stats, dead letters and pause (`hq_ops:read`, `hq_ops:manage_jobs`). Four alerts. EN/AR, `check:ui`, `check:i18n`. | The Owner can see and fix any failed job from the screen. | 3 days |
| 8 | **Delete the old plumbing and clean the registry.** Owner request: **clean `sys_ops_job_cf` data at the end** — remove or retire every `HQ_WORKER`, `ASYNC_HTTP` and `SUPERSEDED` row, drop `restore_command` and the `HQ_WORKER` kind once no row uses them, and leave only rows that describe live work. Also delete the dead `voucher-posting.service.ts`. `platform-workers` and its Oregon Render service; HQ `BackgroundExecutionModule`; the private execute endpoint, machine key and URL; HQ `DispatchQueueService` and `ntf.hq.queue_enabled`; `fn_ops_job_*` worker functions; the **batch** claim functions `fn_ntf_worker_claim_due`, `_due_global`, `_canary` (keep finalize, mark-uncertain, reconcile); `claim_outbox_batch`; the finance and notification job routes; `pg_net` wrappers and extension; nine of ten env switches. Drop with `RESTRICT`. **Stop: Owner applies.** | Grep and the remote catalog show no callers. | 2 days |
| 9 | **Prove it.** Run each job twice, kill each consumer mid-job, force provider timeouts, then a 48-hour soak on demo tenants. Fold the six I11 documents into the feature folder: one design, one runbook, one QA guide; old files get a superseded header. | Zero duplicate messages, zero cross-tenant writes, empty dead-letter queue. | 3 days |

About 4 to 5 weeks for one person working with AI help. These are rough estimates. Steps 0 and 4 restore user-visible behavior first. Server-side PDFs (§17) are not in this plan; they ship as their own feature when needed.

### 10.2b Step 1b — registry extension, event catalog, event-code renames (added 23 Nov 2026)

Migration `0808_ops_job_registry_event_catalog.sql` plus the paired web-admin code change (DESIGN §20.8, §21).

**Release order is mandatory: deploy the web-admin code first, then apply 0808.** Before 0808 the event log accepts any code, so the new code works. 0808 adds a foreign key that rejects the old codes; applied first, order submit would fail until the code deploys.

### 10.3 Rules for every step

- Load the skills CLAUDE.md names before writing: `/database` and `/multitenancy` for SQL and `org_*` queries, `/backend` for services and HQ API, `/frontend`, `/i18n` and `/cmx-ui-design-review` for screens. HQ repo work follows `cleanmatexsaas/CLAUDE.md`.
- Each migration: list `supabase/migrations/`, take latest + 1 at write time, write it, then **stop** until the Owner confirms local and remote apply.
- Exit evidence is remote, not a green build. After each step: update `STATUS.md`, `QA_TEST_GUIDE.md`, `RESUME_CONTINUATION.md` and the Progress Log.
- Gates per repo: `npm run build`, `npx eslint . --quiet`, `npm run check:i18n` and `npm run check:ui` where screens changed.

---

## 11. What this design removes

| Removed | Count today |
|---|---|
| Render services for background work | `platform-workers` (replaced by the worker, so the service count stays at two) |
| Job-path technologies | BullMQ, Redis-as-queue, `pg_net` |
| Environment switches | 10 → 1 |
| Hand-built claim and control functions | about 20 |
| Copies of provider code | 4 → 1 (HQ API only) |
| Hand-built job runners | 2 (`platform-workers` loops, HQ `BackgroundExecutionModule`) → 0 |
| I11 documents | 6 → 3 |

---

## 12. Decisions for the Owner

| ID | Decision | Recommendation |
|---|---|---|
| S-D1 | Use pg-boss as the only job queue. | Approve. |
| S-D2 | Where the worker's code lives: (a) merge all HQ apps into the tenant repo, or (b) move only the worker into the tenant repo and keep notification delivery as one private call to HQ API. | **(b)**, per §14, with HQ API consuming the delivery queues directly (§14.5) so no HQ URL or machine key is needed. Revisit (a) if more HQ jobs appear. |
| S-D3 | Turn `platform-workers` into the single worker container, in Render's Ohio region, next to the database in AWS `us-east-2`. | Approve. |
| S-D4 | Keep `pg_cron` for pure-SQL housekeeping only. | Approve. |
| S-D5 | Do Step 0 now, before any decision above. | Approve. It stops silent loss on today's code. |
| S-D6 | The database is in AWS `us-east-2` (Ohio) while users are in the GCC. This affects latency and possibly data-residency rules. | **Decide before launch, while all data is demo data**, because moving a live database later is the hardest migration there is. Leading candidate: Supabase Frankfurt (`eu-central-1`), with Render Frankfurt and Vercel `fra1`. All backend parts sit together, and GCC users are closer than to US East. Verify Supabase's region list, measured latency from the GCC, and any customer residency requirement first. If no move happens, run Render in Ohio and Vercel functions in `cle1` (Cleveland), next to the database. |

---

## 13. Verification results (23 Nov 2026)

### 13.1 pg-boss through Supabase's pooler

Sources: Supabase "Connecting to Postgres" and "Pooling and limits" docs, pgboss.io v12.39 docs, pg-boss GitHub issues.

| Question | Finding |
|---|---|
| Session pooler (Supavisor, port 5432) | Supabase says session mode supports prepared statements, session state, LISTEN/NOTIFY and cursors. Nothing blocks pg-boss there. No pg-boss issue reports a session-mode problem. No source says pg-boss was formally tested on Supavisor. |
| Transaction pooler (port 6543) | Avoid for pg-boss. It drops prepared statements, session locks and LISTEN between transactions. Issue #773 reports stale reads from a worker through Supavisor transaction mode, closed without a fix. |
| Direct connection | IPv6 only, unless the paid IPv4 add-on is bought. The shared pooler is IPv4 on every plan. A Render worker should therefore use the **session pooler**. |
| Advisory locks | Used only for schema creation and migration, as transaction-level locks. Scheduling uses a single-statement update instead. |
| Idle background work | Each `work()` subscription polls on its own interval, 2 seconds by default. Supervise and monitor run every 60 seconds, cron checks every 30 seconds, instance heartbeat every 30 seconds, maintenance daily. The default pool is 10 connections, so set `max: 4`. |
| Reported load issues | Issue #702 calls per-worker polling heavy, with no numbers. The maintainer points to LISTEN/NOTIFY. There are also fixed deadlock and planner issues in 2026 releases, so pin a recent 12.x version. |
| Supabase limits | Micro compute: 60 connections, 200 pooler clients, session pool size 15. Supabase says to stay below the maximum, not at it. |

**Decision:** the worker's pg-boss connects through the session pooler with `max: 4`. The worker's Prisma uses the transaction pooler. pg-boss migrations run through the same session connection on start.

### 13.2 Idle polling load, measured

pg-boss 12.39.0 on a throwaway database in the local Supabase Postgres 17, 15 idle queues, one cron schedule, 60-second window after a 15-second settle. The database was dropped afterwards.

| Setup | Queries/sec | Database time per minute | Disk block reads | Connections |
|---|---|---|---|---|
| Default 2-second polling on all queues | 14.6 | 12.7 ms | 0 | 4 |
| 2 seconds on 3 queues, 30 seconds on 12 | 3.3 | 7.9 ms | 0 | 4 |
| LISTEN/NOTIFY on | 9.0 | 8.5 ms | 0 | 5 |

- Even the worst case costs about 13 ms of database time per minute, around 0.02% of one CPU core. All reads come from memory, so polling does not touch disk I/O, which was the earlier I11 concern.
- **Use the tuned setup:** 2 seconds for notification queues, 30 seconds for finance, sweeps and files. It cuts query count by about 4.5 times at no latency cost that matters for those queues.
- **Leave LISTEN off.** It measured more queries than tuned polling and holds one more connection.
- Limits of this measurement: a local machine with empty tables. Supabase Micro has shared CPU, and job tables grow with retention. Re-measure on remote with `pg_stat_statements` one week after go-live. The scaling path in §9 applies if it changes.

---

## 14. Option: move only `platform-workers` into the tenant repo

The Owner asked whether moving only the worker, and leaving `platform-api` and `platform-web` in the HQ repo, is enough.

### 14.1 What moves and what does not

| Part of `platform-workers` today | Lines (non-test) | Fate |
|---|---|---|
| Finance HTTP callers | 337 | Delete. The tenant worker calls the tenant finance services in-process. |
| Notification claim, dispatch, reconcile clients, provider copies, legacy BullMQ | 1,434 | Keep only the small HQ delivery client and the reconcile decision. Delete the provider copies and BullMQ. |
| File purge | 180 | Move as is. |
| Ops runner and cron matching | 230 | Delete. pg-boss replaces them. |
| Shared helpers | 134 | Keep what the kept code uses. |
| HQ `BackgroundExecutionModule` in `platform-api` (never enabled) | 709 | Delete. |

### 14.2 How notifications work in this option

HQ notification delivery is about 4,500 lines and tied to HQ provider accounts, tenant-supplied credentials, quotas and metering. Porting it would be a large job. So the tenant worker keeps calling HQ's existing private delivery operation, which accepts only `tenantOrgId`, `outboxId` and `claimToken`.

- That call goes from one Render container to another, both always on. It does not have the Vercel timeout and cold-start problems that ruled out HTTP before.
- If HQ API is down, the `ntf.deliver` job retries with backoff. If the call times out, the outcome is unknown, so the row goes to `UNCERTAIN` and the reconciler handles it. That uncertain-result path already exists.
- The worker checks `HQ_JOBS_API_URL` and the machine key on startup and refuses to start if either is missing. That closes the earlier incident where 37 claims went uncertain because the URL was missing.
- A contract test on both sides pins the three-field request and the result shape.

### 14.3 Comparison

| | Full merge (S-D2) | Move only the worker | Keep both as today |
|---|---|---|---|
| Finance and campaign jobs can run | Yes, in-process | Yes, in-process | No |
| Notification delivery | In-process | One private HTTP call to HQ | One private HTTP call to HQ |
| Provider code copies | 1 | 1, in HQ | 3 |
| Containers | 1 API + 1 worker | 1 API + 1 worker | 1 API + 1 worker + an unused in-process host |
| Repo work | Move three apps, repoint all deploys | Create `cmx-workers/` in the tenant repo, repoint one Render service | None |
| Extra environment values on the worker | None | 2: HQ URL and machine key | 2 |
| Future HQ jobs such as trial expiry and SaaS billing | Worker imports HQ code | Worker calls a typed HQ operation per entity, or the job is pure SQL | Unsolved |
| Size | 2–3 days before the worker | About 1 day before the worker | 0 |

### 14.4 Recommendation

**Move only the worker.** It meets every Owner rule, gives the main benefit of the merge, which is in-process finance and campaign jobs, and leaves HQ untouched. Its only cost is one private HTTP call for notification delivery, which the design already handles safely. Revisit the full merge only if more HQ jobs appear, or if keeping two repos in step keeps costing time.

This changes S-D2. The decision table below is updated to match.

### 14.5 Better: let HQ API consume the delivery queue, so no URL is needed

The HTTP call in §14.2 exists only because delivery code lives in the HQ API process and the worker lives in the tenant repo. pg-boss removes that need: every process that connects to the same database can consume a queue. So HQ API can subscribe to `ntf.deliver` and `ntf.reconcile` itself.

```text
tenant worker:  ntf.orchestrate → writes org_ntf_outbox_dtl + enqueue ntf.deliver { outboxId }
HQ API:         boss.work('ntf.deliver', { localConcurrency: 5 }) → OutboxDeliveryService in-process
```

| | Worker calls HQ over HTTP (§14.2) | HQ API consumes the queue |
|---|---|---|
| `HQ_JOBS_API_URL`, `PLATFORM_WORKER_API_KEY` | Required | **Deleted** |
| Private execute endpoint and its auth guard | Kept | **Deleted** |
| Failure layers | Worker→HQ timeout and HQ→provider timeout | Only HQ→provider timeout |
| Retry and dead-letter handling | Two places | One place, pg-boss |
| Background work inside the API process | None | Notification delivery only. It is I/O-bound provider calls, capped at 5 at a time. |
| Containers | 1 API + 1 worker | 1 API + 1 worker |

The cost is that the API container also runs one light, I/O-bound queue. If measurement ever shows delivery hurting API response times, move the same `work()` call into a second HQ worker container. That needs no code change beyond where it starts.

**Recommendation: use this instead of §14.2.** The tenant worker runs everything whose code lives in the tenant repo. HQ API runs only the notification delivery and reconcile queues, because that code lives there. The 709-line `BackgroundExecutionModule` is still deleted, and about 30 lines of pg-boss `work()` registration replace it.

---

## 15. Notifications that HQ sends

### 15.1 What HQ sends today (code read 23 Nov 2026)

| Today | Where | How |
|---|---|---|
| HQ staff password emails | `platform-api/src/modules/hq-auth/mail/hq-password-mailer.ts` | Sends directly through Resend inside the request. |
| Tenant user password emails | `platform-api/src/modules/tenant-users/password/password-mail.service.ts` | Same, direct. |
| HQ broadcasts | `platform-api/src/modules/notifications-hq/broadcast` | HQ creates and approves rows in `org_ntf_campaigns_mst`. The campaign flow sends them. |
| Template test sends | `notifications-hq/templates/preview` | Calls `DispatchService` directly. |
| Public dispatch endpoint | `notifications-hq/dispatch/dispatch.controller.ts` | Carries recipient and payload. When `ntf.hq.queue_enabled` is true, SMS, WhatsApp and push go into a BullMQ queue in Redis. |

**Status 23 Nov 2026:** the Owner confirmed `NTF_QUEUE_ENABLED=false` on HQ API, so this trap is not active today.

**Trap found:** the only consumer of that BullMQ queue is the legacy processor in HQ workers, which is off. If `ntf.hq.queue_enabled` ever becomes `true`, SMS, WhatsApp and push sends wait in Redis forever. That includes sends from the canonical outbox path, because `OutboxDeliveryService` calls `DispatchService.dispatch`. The database value is empty and the policy is `ENV_OVERRIDES_DB`, so the live value depends on `NTF_QUEUE_ENABLED` on the HQ API host. **Check that it is not `true`.** The design deletes the queue, the setting and the env name.

### 15.2 Target: four kinds of HQ message

| Kind | Example | Recipient | Path |
|---|---|---|---|
| Account emails while someone waits | HQ staff password reset, tenant user invite or password set | One person in a live flow | **Stay direct** in the request. The person sees an error and can retry, so a queue adds nothing. |
| Platform lifecycle messages | Trial ending, subscription invoice, payment failed, plan change, suspension | Tenant owners and admins | **HQ writes the outbox row and enqueues `ntf.deliver` in one transaction.** It skips `ntf.orchestrate` because HQ renders its own templates. HQ API delivers it through the same queue. |
| Broadcasts | Maintenance notice, new feature announcement | Many tenants' admins | **Campaign flow:** an approved broadcast starts `ntf.campaign_start`, which chunks recipients into outbox rows. Lowest priority. |
| Operator alerts | Dead letters, worker down, old waiting jobs | The Owner | **Sentry or an email webhook, outside the notification pipeline,** so alerts still arrive when the pipeline itself is broken. |

### 15.3 What changes to support it

1. **Sender scope on the outbox.** Add `sender_scope` (`TENANT` or `PLATFORM`) to `org_ntf_outbox_dtl`. Platform messages always use HQ's own provider accounts, never a tenant's own WhatsApp number or email domain, and they do not count against the tenant's notification quota. Today the outbox has no such column, so dispatch would pick the tenant's provider.
2. **Transactional enqueue from HQ API.** HQ API mostly uses supabase-js, which has no transactions. For the few places that create platform messages, use the `pg` client HQ API already depends on: open a transaction, insert the outbox row, call `boss.send(..., { db })` with that client, and commit.
3. **In-app for platform messages.** HQ writes the inbox row directly for tenant admins, so the message also appears in the tenant web notification bell.
4. **Delete** the HQ BullMQ `DispatchQueueService`, `ntf.hq.queue_enabled`, and `NTF_QUEUE_ENABLED`. The public dispatch endpoint stays only for template test sends, which are synchronous.

---

## 16. Immediate sends from the tenant app

### 16.1 Today (code read 23 Nov 2026)

| Flow | Code | What it does |
|---|---|---|
| Customer OTP | `web-admin/lib/services/otp.service.ts` `sendOTP` | Stores a **fixed test code** and sends nothing. Customer OTP login cannot work in production. |
| Receipt send and resend | `web-admin/lib/services/receipt-service.ts` → `lib/integrations/whatsapp-client.ts` | Calls the Meta WhatsApp Graph API **directly from the Vercel request**. It skips consent, quota, suppression, tenant provider policy and the delivery log. It is a fourth copy of provider code. |

### 16.2 Target: same pipeline, fast lane

An immediate send is a normal send with high priority, prepared inside the request because a person is waiting.

1. **Tenant web request.** A staff member clicks "Send on WhatsApp", or a customer asks for an OTP. The request runs the preparation code itself: consent, template and channel, all tenant code. Then in **one transaction** it writes the outbox row and enqueues `ntf.deliver` with the highest priority. It returns `202` with the outbox id.
2. **HQ API** polls `ntf.deliver` **every 1 second**, picks the job by priority, runs its policy checks, and calls the provider.
3. **The screen** shows "Sending…", then polls the outbox status by id every second for up to about 15 seconds. It shows "Sent" or the failure reason through `cmxMessage`. After 15 seconds it says the message is still sending and links to the message log.

Expected time from click to provider acceptance: about 1 to 3 seconds. Arrival on the phone then depends on the carrier, which is the same for any design.

One queue serves everything. Priority orders it: OTP first, then staff-clicked and order messages, then campaigns last. Polling every 1 second instead of 2 adds roughly one query per second, measured as negligible in §13.2.

### 16.3 Rules for immediate sends

| Rule | Why |
|---|---|
| Never call a provider from the tenant web request | A slow provider freezes the screen. A Vercel timeout leaves the outcome unknown, and a second click then sends twice. It also skips every policy check. |
| Dedupe on the server, not the client | A key built from the action, for example `receipt:<id>:whatsapp`, with a 30-second window (`singletonKey` plus `singletonSeconds: 30`; a key alone does not deduplicate, §22), and the button disabled while sending. A key minted fresh by the browser on each click cannot stop a double click. |
| OTP jobs expire | `ntf.deliver` checks the code's expiry before sending and skips an expired one. Retries are limited to 2, because a late code is useless and the customer can ask again. |
| OTP abuse limits | Limit requests per phone number and per IP, and allow only the countries you serve. This blocks SMS pumping fraud, which bills you for fake OTP traffic. |
| OTP code retention | The outbox row holds the rendered code, so OTP rows get a short retention, for example 24 hours. |

### 16.4 Changes

- Implement real OTP sending through this path. Replace the fixed test code.
- Route receipt sends through the outbox and `ntf.deliver`. Delete `lib/integrations/whatsapp-client.ts`.
- Add a tenant status endpoint for one outbox id, tenant-filtered, returning status and failure reason only.
- Later option: a provider verification service such as Twilio Verify for OTP, which handles codes, retries and fraud checks. It adds per-verification cost and a direct provider call, so start without it.

---

## 17. Reports, PDFs and sending files

### 17.1 Today (code read 23 Nov 2026)

- Printing happens in the browser: print pages under `app/dashboard/**/print` and `window.print`. `lib/utils/report-export.ts` builds CSV, Excel (`xlsx`) and simple PDFs (`jspdf`) for download in the browser.
- No server-side PDF engine exists. jsPDF does not shape Arabic text or lay out right-to-left without extra fonts and work.
- File Util stores files in Supabase Storage. It issues signed upload URLs to the browser and signed download URLs. It has no function that saves bytes generated on the server.

### 17.2 Keep in the browser

Screen printing and "Download CSV/Excel" of what is already on screen stay in the browser. They are instant and free. Use a job only when the work is slow, large, scheduled, or must be sent to someone.

### 17.3 Target flow

```text
tenant web request (user has the permission)
   one transaction: org_doc_request_tr row (QUEUED, type, small filter params, requested_by)
                    + enqueue doc.render { requestId }
   returns 202 + requestId; screen shows "Preparing…"
cmx-workers  doc.render  (COMPUTE queue, localConcurrency 1)
   load data through the domain service, tenant-filtered
   PDF: Chromium renders the print page HTML  ·  Excel/CSV: xlsx in the worker
   save bytes through File Util (new server-side save), category GENERATED_DOC, expiry 30 days
   one transaction: request row → READY + file_id
                    + if "send" was asked: outbox row(s) with attachment_file_id + enqueue ntf.deliver
                    + in-app "ready" notification to the requester
HQ API  ntf.deliver
   email: Resend attachment from storage  ·  WhatsApp: document message with a signed link (valid 1 hour)
```

| Piece | Choice | Reason |
|---|---|---|
| PDF engine | **Headless Chromium (Playwright or Puppeteer)** in `cmx-workers` | It renders Arabic, right-to-left text and the existing HTML print layouts exactly as the browser does. It is the boring, proven option. jsPDF and react-pdf have weak Arabic shaping. A separate PDF service or a paid PDF API adds a service or a per-document cost. |
| HTML source | The existing print pages, opened by Chromium with a **one-time render token**: tenant-scoped, read-only, expires in 5 minutes | No second copy of each layout. A failed page load is a normal retry for a `COMPUTE` job. Later, move a layout to a server-rendered template only if it changes often or Vercel latency hurts. |
| Status and audit | New `org_doc_request_tr`: tenant, type, parameters, status, file id, requester, error code, full audit columns | The screen needs a status to show. Reports contain business data, so who generated what is recorded. The job payload is the request id only. |
| Storage | File Util, new server-side `saveGeneratedFile(...)` | One storage path, signed URLs, and the existing expiry and purge jobs remove old files. |
| Chaining | The render job enqueues the send in its final transaction | No workflow engine. If rendering fails, nothing is sent. If sending fails, the file still exists, and the send retries alone. |
| Idempotency | Request id as the job key. Output is saved under a key derived from the request, so a rerun overwrites rather than duplicates. The send dedupes by outbox key. | A retry never produces two files or two messages. |
| Attachments | New `attachment_file_id` on `org_ntf_outbox_dtl` | The outbox row still carries ids only. HQ API reads the bytes or signs a link at send time. |

### 17.4 Limits and cost

- Chromium needs about 300–500 MB of memory while rendering. The worker container's current size (512 MB) is likely too small once PDFs go live. Plan one size up on Render (2 GB) **when this feature ships, after measuring**, not before.
- Keep the render queue at one job at a time. Big Excel exports run in the same queue.
- If rendering slows other queues, step 4 of §9 applies: a second container that only runs `doc.render`.
- Size limits: WhatsApp documents up to 100 MB, and email attachments much smaller. Reports above about 10 MB are sent as a signed download link instead of an attachment.
- KSA ZATCA Phase 2 invoices need PDF/A-3 with the XML embedded. Chromium output then needs a post-processing step, for example with `pdf-lib`. Treat that as part of the ZATCA work, not this feature.

---

## 18. Architecture review (23 Nov 2026)

A skeptical review of this document before any build. Each finding was checked against code, the remote database, or a local experiment. Every fix below is already applied in the sections named.

### 18.1 Blockers found and fixed

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | The document contradicted itself: §1, §4.1, §7, §10, §11 and the appendix still described the full repo merge, while §12 and §14.5 chose moving only the worker. | Document read | Rewrote §1, §4, §4.1, §7, §10 and §11 for the worker-only move with HQ API consuming the delivery queues. Removed the stale appendix. |
| B2 | pg-boss migrates its own schema on `start()`. That would apply schema changes automatically on deploy, which CLAUDE.md forbids. | pgboss.io constructor docs; CLAUDE.md rules 2–3 | `migrate: false` in every process. The schema comes from `getConstructionPlans('pgboss')` as a repo migration the Owner applies. Upgrades use `getMigrationPlans`. **Verified locally:** the exported SQL (about 21 KB) installed the schema and a worker started against it with `migrate: false`. |
| B3 | `send()` refuses to run before `start()`, even with a transaction adapter. A Vercel function cannot enqueue the way §5.3 first described. | **Local test:** "Database not opened. Call start() before using pg-boss". | Producer mode: construct pg-boss with a `db` adapter over the request's own Prisma client and `migrate`, `supervise`, `schedule` and `registerInstance` all off, then `start()` once per cold start. **Verified locally:** 5 queries at start, 0 extra connections, a committed send produced a job, a rolled-back send produced none. |
| B4 | A job that outlives `expireInSeconds` is retried while the first handler may still be running, so an external effect could run twice. | pg-boss expiry semantics | Every handler gets a hard timeout through `AbortSignal`, set shorter than its queue's `expireInSeconds`. Every handler checks the domain row's status first. `ntf.deliver` claims the row (`PROCESSING` with a claim token) before the provider call, so a parallel or redriven attempt finds it claimed and goes to reconcile, never to a second send. |
| B5 | Two repositories run pg-boss and share payloads. Version or payload drift between `web-admin`, `cmx-workers` and HQ API would break jobs. | Design review | One pinned pg-boss version in all three, checked at start (`migrate: false` fails on a schema mismatch). Payload changes are additive only. HQ API keeps a copy of the `ntf.deliver` and `ntf.reconcile` payload schemas, with a contract test in both repos. |

### 18.2 Producer mode, as built

```ts
// web-admin and HQ API: once per process, no own pool
const boss = new PgBoss({ db: fromPrisma(prisma), migrate: false, supervise: false,
                          schedule: false, registerInstance: false });
await boss.start();
// inside the business transaction
await boss.send('ntf.orchestrate', { tenantOrgId, eventId }, { db: fromPrisma(tx) });
```

Queues are created only by migrations (`pgboss.create_queue`, §19 P1); no process creates or alters queues on boot.

### 18.3 Security, restored from the earlier draft

- The `pgboss` schema is not in Supabase's exposed API schemas. `anon` and `authenticated` get no grants on it, on `org_job_effect_tr`, or on `sys_job_queue_cf`.
- Jobs carry ids only, so the queue tables hold no personal data or secrets.
- Provider credentials stay where they are today, in HQ API's provider accounts and Vault.
- Every `org_*` query in a handler filters `tenant_org_id` from the payload, and checks it against the loaded row before writing.

### 18.4 Smaller issues fixed

| # | Issue | Fix |
|---|---|---|
| I1 | The connections table missed HQ API's consumer pool and the Vercel producer. | §4.3 updated. |
| I2 | Polling was 2 seconds in §13.2 and 1 second in §16.2 for `ntf.deliver`. | §4.3: 1 second for `ntf.deliver`, 2 seconds for `ntf.orchestrate`, 30 seconds for the rest. |
| I3 | The heartbeat alert assumed one consumer. | §8.2: both consumers register as pg-boss instances. |
| I4 | An invented permission `ops_jobs:manage`. | §8.1: the existing `hq_ops:read` and `hq_ops:manage_jobs`. |
| I5 | Running the worker through the TypeScript loader at runtime is slow to start and memory-heavy. | §10 step 2: an esbuild bundle, with Render build filters so a change to tenant services redeploys the worker. |
| I6 | The campaign route extraction, real OTP sending and receipt rerouting were not in the plan. | §10 step 4. |
| I7 | Pause must reach both consumers. | §8.1. |
| I8 | Provider code count was 3; the receipt WhatsApp client makes it 4. | §11. |
| I9 | Two messages for the same order can arrive out of order, because `ntf.deliver` runs up to 5 at a time. | Accepted as a known limit. Revisit with a per-recipient ordering key if it ever matters. |

### 18.5 Checked and sound

- pg-boss as the queue, with the dead-letter queue, backoff, heartbeat recovery and retention.
- In-transaction enqueue for finance events: all five writers go through Prisma transactions, mostly through one shared helper in `outbox.service.ts`.
- The session pooler for consumers, and idle load (§13).
- Effect classes, the effect table, orphan and poison handling.

### 18.6 Idempotency at every layer, and the one gap it cannot close

Duplicate protection is layered. Each layer stops a different cause:

| Layer | Stops | How |
|---|---|---|
| Enqueue | Double clicks, repeated requests | A stable job id (the outbox row or event id), or a server-built `singletonKey` with `singletonSeconds` for a time window, for example `receipt:<id>:whatsapp` |
| Outbox row | Preparing the same message twice | One row per event, recipient and channel, unique key |
| Effect table | Running an `INTERNAL` job twice | `org_job_effect_tr` primary key |
| Status check | Retries, expiry overlap, dead-letter redrive | Handler skips final statuses, and sends claimed `PROCESSING` rows or `ACCEPTANCE_UNCERTAIN` rows to reconcile |
| Provider key | The provider sending twice after a lost response | Only where the provider supports it |

What each provider supports for the last layer, checked against their documentation on 23 Nov 2026:

| Provider | Send-side idempotency key | Lookup after a timeout | Class |
|---|---|---|---|
| Resend (email) | **Yes.** `Idempotency-Key` header, kept 24 hours. A repeat returns the first response without sending again. | Not needed | `EXTERNAL_IDEMPOTENT` |
| Twilio (SMS, WhatsApp) | **No.** The create-message API has no key or client reference. | List messages by `To` and `DateSent` range, then match | `EXTERNAL_UNCERTAIN` |
| Meta WhatsApp Cloud API | **No.** No key, no client reference. | No lookup endpoint. Only status webhooks. | `EXTERNAL_UNCERTAIN` |
| Firebase push (FCM) | **No.** | None. Android `tag` replaces a duplicate already shown on the device. | `EXTERNAL_UNCERTAIN`, with `tag` set to the outbox id so a duplicate replaces the first on screen |

The gap: Twilio, Meta and FCM can accept a message, send it, and then lose the response on the way back. Our side sees a timeout. Without a provider key, resending would create a duplicate. That single case is why `UNCERTAIN` and the reconciler exist. For Meta, an uncertain row waits for the status webhook. If none arrives within the reconcile window, it goes to the dead-letter queue for a human decision, never an automatic resend.

**Gap found in today's code:** HQ API's Resend provider (`email-resend.provider.ts`) sends no `Idempotency-Key`. Add the outbox id as that header. Email then becomes safe to retry after any timeout.

### 18.7 Still to confirm before step 1

| Item | Who |
|---|---|
| `NTF_QUEUE_ENABLED` is not `true` on HQ API | **Confirmed `false` by the Owner, 23 Nov 2026.** The §15.1 trap is not active. |
| Production Vercel `DATABASE_URL` uses port 6543 with `connection_limit` 1–2 | **Confirmed by the Owner, 23 Nov 2026:** `aws-1-us-east-2.pooler.supabase.com:6543`, `pgbouncer=true`, `connection_limit=2`. Correct as is. It also shows the database is in AWS `us-east-2` (Ohio), not `us-east-1`. |
| Vercel functions run next to the database | **Owner checked 23 Nov 2026: `iad1` (Virginia).** About 10–12 ms per round trip to Ohio. Change to `cle1` (Cleveland). |
| HQ API and the worker run in the same region as the database | **Owner checked 23 Nov 2026: both in Oregon (US West).** About 50 ms per round trip to Ohio. See §18.8. |
| Worker and HQ API pg-boss connection | Same pooler host on port **5432** (session mode): `aws-1-us-east-2.pooler.supabase.com:5432`. Set when step 2 starts. |
| Database region decision (S-D6) | Owner |
| `cmx-workers` memory on Render's 512 MB instance | Measured in step 2 |

### 18.8 Region placement (found 23 Nov 2026)

| Service | Today | Distance to the database in Ohio | Target |
|---|---|---|---|
| Supabase database | AWS `us-east-2`, Ohio | — | Stays, unless S-D6 moves it |
| HQ API (`platform-api`, Render) | Oregon | about 50 ms per round trip | Ohio |
| HQ worker (`platform-workers`, Render) | Oregon | about 50 ms per round trip | Not moved. It is replaced by `cmx-workers`, created in Ohio. |
| Tenant web functions (Vercel) | `iad1`, Virginia | about 10–12 ms per round trip | `cle1`, Cleveland |

Figures are typical AWS inter-region latencies, not measurements of this setup.

- Database work is mostly sequential round trips, so distance multiplies. An HQ page with 20 sequential queries spends about 1 second just travelling between Oregon and Ohio. A notification send in HQ API, with about 10 queries, would spend about half a second.
- This matters more under this design, because HQ API becomes the consumer of `ntf.deliver`.
- **Vercel:** a settings change, Project → Settings → Functions → region `cle1`, effective on the next deploy. No cost.
- **Render:** an existing service cannot change region. Create a new HQ API web service in Ohio, copy the environment variables, deploy, move the custom domain, then delete the Oregon service. Expect a short overlap of two running services during the switch.
- **Order matters: decide S-D6 first.** If the database stays in Ohio, move HQ API to Ohio and set Vercel to `cle1` now. If the database moves before launch (for example to Frankfurt), move the database, HQ API and the new worker together, and set Vercel to the matching region, so nothing moves twice.
- **HQ web (`platform-web`) on Vercel: `iad1` (Virginia), checked by the Owner on 23 Nov 2026.** It mostly calls HQ API, often straight from the browser through `NEXT_PUBLIC_API_URL`. Only one file queries the database directly. So its own region matters little. What matters is HQ API's region, which the Ohio move fixes. Set it to `cle1` along with the tenant app for consistency. This is low priority.

---

## 19. Implementation plan check (23 Nov 2026)

The plan in §10 was checked against code, the remote database and local pg-boss 12.39.0 experiments on throwaway databases. §10 already includes every fix below.

| # | Finding | Evidence | Fix in §10 |
|---|---|---|---|
| P1 | Sending to a queue that does not exist throws. If producer code shipped before the queues, order submit and other business transactions would fail. | Local test: "Queue q.missing does not exist". | Step 1 creates every queue in the migration with `pgboss.create_queue(...)`, before any producer is wired. Producers are wired only from step 4. |
| P2 | `createQueue` with `partition: true` creates a new table at runtime, which is schema change outside a migration. | Local test: 13 tables before and after a default queue, 14 after a partitioned one. | Never use `partition: true`. All queues are default queues created by migration. |
| P3 | One job per consumer would stop updating the event row's status, and the tenant outbox monitor reads that status. | `lib/services/outbox-monitor.service.ts` counts `PENDING` and `PROCESSING`. | One `fin.domain_event` job per event. Each handler is guarded by its own effect key, which also fixes the rerun problem, and the job marks the event `PROCESSED`. Simpler, and the monitor keeps working. |
| P4 | The plan invented a `SENDING` state. The outbox already has a stricter model: `PROCESSING` with `claim_token`, `claimed_by` and a lease, and `reconcile_state = ACCEPTANCE_UNCERTAIN` allowed only on a claimed `PROCESSING` row, all enforced by CHECK constraints. | Remote constraints on `org_ntf_outbox_dtl`. Allowed statuses: `QUEUED`, `PROCESSING`, `SENT`, `DELIVERED`, `READ`, `FAILED_TEMPORARY`, `FAILED_PERMANENT`, `SKIPPED`, `CANCELLED`. | Reuse it. The pg-boss job id becomes the claim token. Add one function that claims a single row by id. Keep the finalize, mark-uncertain and reconcile functions. Delete only the batch claim functions. |
| P5 | The plan said to repoint the existing Render worker, but it runs in Oregon and Render cannot change a service's region. | §18.8, Owner's region check. | Step 3 creates a new worker service in the database's region. The Oregon worker is deleted in step 8. |
| P6 | Dead-letter jobs never leave the queued state, and pg-boss deletes queued jobs after `retentionSeconds`, default 14 days. | pgboss.io queue options. | `dead_letter` gets `retentionSeconds` of 90 days in the step 1 migration. |
| P7 | HQ API sends notifications from step 5, so its Oregon placement would add latency to every send. | §18.8. | Step 5 requires HQ API to already run in the database's region. |
| P8 | No runtime pins a Node version. pg-boss 12 needs Node 22.12 or newer. | Only the tenant root has `"node": ">=20.0.0"`. No `.nvmrc`, no Render config file. | Gate in §10.1. |
| P9 | The plan had no stop points for migrations and no doc updates, both required by CLAUDE.md and the Owner's standing rules. | CLAUDE.md, Owner memory rules. | §10.3, and stops marked in steps 1, 5 and 8. |
| P10 | Design docs live in `docs/pending_to_production/`, but feature docs belong in the feature folder. | Owner's standing rule. | Gate in §10.1: `docs/features/Background_Jobs/`. |

Checked and unchanged: the queue choice, producer mode, schema-as-migration, the effect table, the idempotency layers, region targets, and the step order apart from the fixes above. The S1 gift-card code from 22 Nov is already committed, so the build starts from a clean tree apart from these design documents.

---

## 20. Proposal: event-type catalog with one queue per subscription (23 Nov 2026, for discussion)

Owner request: manage each event type separately (edit, enable, disable, pause, and more), give each its own queue, and seed a catalog table so code publishes predefined jobs.

### 20.1 Facts found

- About 24 domain event codes exist. 17 are in `OUTBOX_EVENT_TYPES` (`web-admin/lib/constants/order-financial.ts`). Others are plain strings in services: `CASH_DRAWER_SESSION_OPENED`, `CASH_DRAWER_SESSION_CLOSING`, `CASH_DRAWER_SESSION_CLOSED`, `CASH_DRAWER_TRX_POSTED`, `CASH_DRAWER_OVER_SHORT`, `ORDER_CHANGE_APPLIED`, `VOUCHER_REVERSED`, `PAYMENT_VERIFIED`. No database catalog exists, so CLAUDE.md rule 9 (constants mirror the database) has nothing to mirror.
- Remote `org_domain_events_outbox` has rows for 15 of them. Only 7 have a consumer today: order history (4 types), loyalty earn, cash over/short, order-change confirmation. The rest are logged only.
- Notifications already have their own catalog, `sys_ntf_events_cd`, with lowercase codes such as `order.created`.
- pg-boss has publish/subscribe built in: `pgboss.subscription (event, name)`. `publish(event, data, { db })` reads the subscribed queues and sends one job to each, inside the caller's transaction. Publishing an event with no subscribers creates no jobs and no error.

### 20.2 Recommendation: three levels, not one

| Level | Answers | Table | Operator actions |
|---|---|---|---|
| Event type | What happened | `sys_job_event_type_cd` (new) | Edit labels and description, enable or disable publishing (non-financial types only), replay a date range |
| Subscription | Who reacts to it | `sys_job_event_sub_cf` (new), mirrored into `pgboss.subscription` | Enable or disable one reaction, replay it |
| Queue | How the reaction runs | `sys_job_queue_cf` (exists, gains runtime settings) | Pause, resume, edit retry, backoff, retention, priority, concurrency; retry or cancel dead letters |

**Why a queue per subscription, not per event type:** one event can have several reactions. `ORDER_COMPLETED` drives order history today, and will drive a notification and possibly general-ledger fan-out. If they shared one queue, pausing one broken reaction would stop the others too. With a queue per subscription, each reaction pauses, retries and dead-letters alone. An event with one reaction still gets exactly one queue, which is what was asked for. This is the standard topic-and-subscription pattern used by message brokers.

Example: `ORDER_COMPLETED` → subscription `order_history` → queue `fin.order_completed.order_history`.

### 20.3 Proposed tables (for review, not written)

`sys_job_event_type_cd`: `event_code` (primary key, upper snake case, identical to the code constant), `domain_code` (`FIN`, `AR`, `POS`, `ORD`, …), `category_code`, `name`, `name2`, `description`, `description2`, `aggregate_type`, `producer_app`, `payload_version`, `is_financial` (true = can never be disabled, only paused), `can_disable`, `is_enabled`, standard 14 audit columns.

`sys_job_event_sub_cf`: `event_code` and `handler_code` (unique pair), `queue_name` (unique, FK to `sys_job_queue_cf`), `consumer_app`, `effect_class`, `is_enabled`, `rec_order`, audit columns. `handler_code` is the stable key of a handler in the worker's registry.

`sys_job_queue_cf` gains the desired runtime settings: `retry_limit`, `retry_delay_s`, `retry_backoff`, `retry_delay_max_s`, `expire_s`, `retention_s`, `delete_after_s`, `default_priority`, `local_concurrency`, `polling_s`. This table is the source of truth. HQ API copies edits into `pgboss.queue` through pg-boss `updateQueue`, which updates rows only, never tables. A drift check compares the two.

### 20.4 How code uses it

```ts
// one call, inside the business transaction
await publishDomainEvent(tx, DOMAIN_EVENTS.ORDER_COMPLETED, {
  tenantOrgId, aggregateType: 'order', aggregateId: orderId,
});
// 1. inserts the immutable org_domain_events_outbox row (the event log)
// 2. boss.publish(code, { tenantOrgId, eventId }, { db: fromPrisma(tx) }) → one job per enabled subscription
```

- `DOMAIN_EVENTS` is a typed constant that mirrors the seeded catalog exactly. A typo fails at compile time, and a database-integration test fails if the constant and the table differ.
- Disabling an event type or a subscription removes its row from `pgboss.subscription`, so publishing costs nothing extra at runtime. The event log row is still written, so a later replay can process it.
- Every handler keeps its effect key (§5.4), so replays and duplicates are safe.

### 20.5 Effect on the approved plan

- Step 4 changes: one queue per subscription instead of the single `fin.domain_event` queue. A migration removes `fin.domain_event` and creates the subscription queues, before any producer ships.
- §19 P3 changes: the event row becomes an immutable log. Progress is shown per subscription, from pg-boss and the effect table, so the tenant outbox monitor screen needs an update.
- Step 7 (HQ jobs screen) gains Event types and Subscriptions tabs.
- Polling: about 10 finance subscription queues at 30 seconds add roughly 0.3 queries per second, within the measured budget (§13.2).

### 20.6 Decisions for the Owner

| # | Decision | Recommendation |
|---|---|---|
| E1 | Queue per subscription, or per event type | Per subscription (§20.2) |
| E2 | Table names | **Owner decision (20.7): `_ops_` prefix, and `sys_ops_job_cf` is kept and extended.** Tables: `sys_ops_job_event_types_cd`, `sys_ops_job_event_subs_cf`, `sys_ops_job_queue_cf`, `org_ops_job_effect_tr` (§20.8). |
| E3 | Can financial event types be disabled | No. Pause only, so no money effect is ever skipped. |
| E4 | One catalog for all domains, or finance only | All domains (finance, AR, POS, orders, later others). Keep `sys_ntf_events_cd` for notification templates and channels, and link to it from the notification subscription. |
| E5 | New permission for destructive actions (cancel queued jobs, disable a type) | Add `hq_ops:purge_jobs`; keep `hq_ops:manage_jobs` for pause, resume, edit and retry. |
| E6 | Replay | Include it: replay one subscription for a date range from the event log. Effect keys make it safe. |

### 20.7 Owner decisions, 23 Nov 2026

- E1, E3, E4, E5, E6: **approved as recommended.**
- E2 changed by the Owner: table names use the `_ops_` prefix, and **`sys_ops_job_cf` is kept and extended** into the one registry for every kind of background work (cron schedules, queues, queue schedules, and later kinds). It is not retired. §20.8 is the revised model.
- New request: rename event codes so each says what really happened. §21 is the proposal.

### 20.8 Revised model: one registry, kind-specific detail tables

Facts read on remote, 23 Nov 2026: `sys_ops_job_cf` has 25 rows (11 `HQ_WORKER`, 14 `PG_CRON`, 3 of them `SUPERSEDED`). `kind` allows only `PG_CRON` and `HQ_WORKER`. `cron_job_name` and `default_schedule` are `NOT NULL`, and `default_schedule` must be a cron expression. HQ's jobs screen uses `fn_ops_job_list_v2`, `fn_ops_job_set_state_v2`, `fn_ops_job_run_now_v2` and `fn_ops_job_restore_v2`.

| Table | Role | Change |
|---|---|---|
| `sys_ops_job_cf` | **The registry.** One row per unit of background work, whatever its kind: code, EN/AR names, category, module, kind, lifecycle, enabled, allowed operator actions. | `kind` gains `PGBOSS_QUEUE` and `PGBOSS_SCHEDULE`. Cron-only columns (`cron_job_name`, `default_schedule`) become required only when `kind = 'PG_CRON'`. The V2 functions learn the new kinds, so HQ's screen lists all of them in one place. `HQ_WORKER` rows move to the new kinds as their jobs move to pg-boss, and the kind is removed at step 8. |
| `sys_ops_job_queue_cf` | Detail for `PGBOSS_QUEUE` rows: queue name, consuming app, effect class, retry, backoff, retention, priority, concurrency, polling. Source of truth that HQ API copies into `pgboss.queue`. | **Renamed** from `sys_job_queue_cf` (0807). Gains the runtime-setting columns and a 1:1 key to `sys_ops_job_cf.job_code`. Pause moves to the registry's `desired_enabled`, so there is one on/off switch per job. |
| `sys_ops_job_event_types_cd` | **New.** One row per domain event code: domain, category, EN/AR names and descriptions, aggregate type, financial flag, can-disable flag, enabled. Fully seeded from §21. | — |
| `sys_ops_job_event_subs_cf` | **New.** Which handler reacts to which event, through which queue (a `PGBOSS_QUEUE` registry row). Mirrored into `pgboss.subscription`. | — |
| `org_ops_job_effect_tr` | One row per applied effect, for idempotency and audit. | **Renamed** from `org_job_effect_tr` (0807). |

Both 0807 tables are empty of business data and no code uses them yet, so the renames are safe now. They happen in a new forward migration; 0807 is never edited.

### 20.9 The registry and its queue detail, by example

`sys_ops_job_cf` answers **what background work exists and is it on**. It is what an operator sees and controls. `sys_ops_job_queue_cf` answers **how one queue runs**. It is what pg-boss needs. Only queue jobs have a detail row; cron jobs do not need retry or retention settings, so they live in the registry alone.

| `job_code` (registry) | `kind` | Registry holds | Queue detail row |
|---|---|---|---|
| `tax-kit-update` | `PG_CRON` | EN/AR names, category, `schedule = '5 2 * * *'`, `cron_job_name`, on/off | None |
| `fin.order_submitted.order_history` | `PGBOSS_QUEUE` | EN/AR names, category, on/off (pause) | `queue_name`, consumer `CMX_WORKERS`, effect `INTERNAL`, retry 8, backoff 10 s to 1 h, retention 30 days, concurrency, polling 30 s |
| `ntf.deliver` | `PGBOSS_QUEUE` | EN/AR names, on/off | consumer `HQ_API`, effect per channel, retry 6, polling 1 s, concurrency 5 |
| `fin.gift_card_expiry.sweep` | `PGBOSS_SCHEDULE` | EN/AR names, `schedule = '0 2 * * *'`, on/off, `target_job_code` = the queue job that runs the sweep | None (the target queue has its own detail row) |

Operator actions:

- **Pause or resume** any job: the registry's `desired_enabled`. Cron jobs are switched in `pg_cron`; queue consumers stop or resume fetching within about 30 seconds; queue schedules stop sending.
- **Edit a queue's behaviour** (retries, backoff, retention, priority, concurrency, polling): the queue detail row. HQ API then copies it into `pgboss.queue` with `updateQueue`, and a drift check compares the two.
- **Edit names, description, category, schedule**: the registry row.

The event tables point at the registry: each `sys_ops_job_event_subs_cf` row names the `PGBOSS_QUEUE` registry job that runs that reaction.

```text
sys_ops_job_event_types_cd ──< sys_ops_job_event_subs_cf >── sys_ops_job_cf (kind PGBOSS_QUEUE) ──1:1── sys_ops_job_queue_cf
      what happened                  who reacts                   the job, on/off, names                 how the queue runs
```

---

## 21. Event codes that say what happened (approved by the Owner, 23 Nov 2026)

Rule: an event code is a **past-tense fact** about one domain object, `<OBJECT>_<PAST_VERB>`. A request for work is named `<THING>_REQUESTED`. Each row below was checked at the place the event is written.

### 21.1 Rename

| Current code | Where it is written, and what has just happened | Proposed code |
|---|---|---|
| `ORDER_COMPLETED` | `settleOrderTx`, called by order submit and create-from-checkout. The order was just submitted and its financial snapshot saved, **even when unpaid** (payload has `settled: false`). It is not workflow completion, and it collides with the real `COMPLETED` order status. Order history would show "completed" right after creation. | `ORDER_SUBMITTED` |
| `LOYALTY_EARN` | `reconcileOrderLoyaltyEarn`: a money change asks for the order's loyalty earn to be recalculated later. It is a request, not a fact. | `LOYALTY_EARN_RECALC_REQUESTED` |
| `STORED_VALUE_CHANGED` | `order-credit-application.service`: stored value applied to an order. The constant's own comment says it only covers redemption. | `STORED_VALUE_REDEEMED` |
| `ORDER_CANCEL_FINANCIAL_UNWIND` | `order-cancel-financials.service`, after a cancelled order's money was unwound. The name reads as a command. | `ORDER_CANCEL_FINANCIALS_UNWOUND` |
| `CASH_DRAWER_SESSION_CLOSING` | `startCloseTx`: the close of a drawer session was started. | `CASH_DRAWER_SESSION_CLOSE_STARTED` |
| `CASH_DRAWER_OVER_SHORT` | Written at open (missing opening count), at finalize, and at variance approval: a drawer variance was recorded. | `CASH_DRAWER_VARIANCE_RECORDED` |
| `CASH_FACT_REDIRECTED` | `stampCashLinesTx`: a cash line was posted to a different drawer session than the one requested. | `CASH_LINE_SESSION_REDIRECTED` |

### 21.2 Keep (already accurate)

`ORDER_FINANCIAL_ADJUSTMENT_CREATED`, `ORDER_CHANGE_APPLIED`, `PAYMENT_RECEIVED`, `PAYMENT_VERIFIED`, `PAYMENT_CANCELLED`, `PAYMENT_FAILED`, `PAYMENT_VOIDED`, `PAYMENT_REVERSED`, `PAYMENT_CAPTURED`, `PAYMENT_SETTLED`, `REFUND_PROCESSED`, `STORED_VALUE_FUNDING_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`, `AR_INVOICE_VOIDED`, `AR_PAYMENT_ALLOCATED`, `AR_PAYMENT_ALLOCATION_REVERSED`, `AR_OVERPAYMENT_CREDIT_CREATED`, `AR_CREDIT_MEMO_POSTED`, `AR_DEBIT_NOTE_POSTED`, `AR_WRITE_OFF_POSTED`, `CASH_DRAWER_SESSION_OPENED`, `CASH_DRAWER_SESSION_CLOSED`, `CASH_DRAWER_TRX_POSTED`.

### 21.3 Bring into the catalog or remove

| Code | Finding | Proposal |
|---|---|---|
| `VOUCHER_REVERSED` | Written as a plain string in `voucher-line-reversal.service`, not in the constant. 1 remote row. | Add to the constant and the catalog. |
| `VOUCHER_POSTED` | Plain string in `voucher-posting.service`, not in the constant. No remote rows. **Verified dead:** the post-voucher action calls `postManualVoucherWithPosPolicy` (wiring path, `VOUCHER_POSTED_AND_WIRED`); `postBizVoucher` is called only by its own test. | Not catalogued. Delete `voucher-posting.service.ts` and its test in step 8. |
| `WORKFLOW_GATE_DECISION_ACCEPTED` | Plain string constant in `workflow-gate-decision.service`. | Add to the constant and the catalog. |
| `GIFT_CARD_REDEEMED` | In the constant, written nowhere. Gift-card redemption (`redeemGiftCardTx`) emits no event of its own; the order-level `STORED_VALUE_REDEEMED` covers it. | **Owner decision: keep as reserved** (`is_reserved = true`) for future gift-card-level reactions, for example a balance notice or gift-card ledger posting. |

### 21.4 What a rename touches (one forward migration plus code)

- `UPDATE org_domain_events_outbox` for existing rows, including the 115 pending ones (pre-launch, demo data).
- `chk_history_action_type` on `org_order_history`: replace `ORDER_COMPLETED` with `ORDER_SUBMITTED`. No history rows use the event-derived codes yet (remote, 23 Nov 2026).
- The constants file, every emit site, the order-history consumer, the outbox processor handler sets, the tenant outbox monitor labels, tests and EN/AR labels.
- The seed of `sys_ops_job_event_types_cd` uses only the final names.

---

## 22. Step 2 findings (23 Nov 2026)

Found while building and testing `packages/jobs` against local Postgres. Each is fixed in code and covered by the package's integration test.

| # | Finding | Evidence | Fix |
|---|---|---|---|
| F1 | `singletonKey` alone does not deduplicate on a standard queue. The unique indexes that use it apply only to the `short`, `singleton`, `stately`, `exclusive` and `key_strict_fifo` policies, or when `singletonSeconds` is set. §18.6 assumed it did. | pg-boss 12.39.0 construction SQL: `job_i1`–`job_i8` are policy-scoped, `job_i4` needs `singleton_on`. | Deduplicate with the job id instead. Job inserts are `ON CONFLICT DO NOTHING` on `(name, id)`, so a stable id (event id, outbox id, entity id) inserts once per queue while the job is kept. `publish()` always uses the event id. After pg-boss deletes the job, the effect table still stops a second effect. |
| F2 | `start()` fails through Prisma: the install check `SELECT to_regclass('pgboss.version') as name` returns a `regclass` column that Prisma cannot read. The §18.2 probe used a raw `pg` adapter, so it did not catch this. | Test run: "Failed to deserialize column of type 'regclass'". | The producer's start adapter casts that one query to text. Every `send` still uses `fromPrisma(tx)`. Tied to the pinned 12.39.0 SQL; the integration test fails first if an upgrade changes it. |
| F3 | Four campaign audit inserts in web-admin were written as `void supabase.from('org_ntf_audit_dtl').insert(...)`. A PostgREST query runs only when awaited, so these audit rows were never written. | `app/api/notifications/process-campaigns/route.ts` (3), `app/api/v1/notifications/campaigns/[id]/status/route.ts` (1). Found by the new lint rule. | Awaited, with a warning log on failure. |
| F4 | pg-boss is ESM-only, and the web-admin Jest setup is CommonJS. | Package `"type": "module"`. | The package tests run on Node's test runner through `tsx` against local Postgres. Web-admin unit tests mock `@cmx/jobs` when step 4 wires it in. |

### 22.1 Step 3 findings (23 Nov 2026)

| # | Finding | Fix |
|---|---|---|
| F5 | Supabase signs the pooler certificate with its own CA, so `pg` cannot verify it without that CA. Turning verification off would allow a man-in-the-middle. | `JOBS_DATABASE_CA_CERT` (the Supabase CA PEM) is required for any non-local database; the worker refuses to start without it. No `sslmode` in the URL, because `pg` lets it override the certificate settings. |
| F6 | `sys_ops_job_cf.updated_by` is a user UUID, so a process name cannot go there. | The worker writes only `applied_enabled`, `applied_at`, `applied_by`. |
| F7 | pg-boss keeps stopped instances in `pgboss.instance` as history. | Tests delete their own instance row. In production the HQ screen should read the newest non-stopped row per name. |
| F8 | There is no SQL function to send a job, so the Owner cannot prove a deployed worker from the SQL editor. | `npm run smoke --workspace=cmx-workers [-- fail]` sends a validated smoke job and reports where it ended. |

### 22.2 Step 4 decisions (23 Nov 2026)

| # | Topic | Decision |
|---|---|---|
| D1 | Reactions | 13, one queue each, named `fin.<event>.<handler>`. Order history reacts to all 10 timeline events: the consumer and `chk_history_action_type` already supported payment cancel, fail, void, reverse, capture and settle, but the old router sent it only 4, so those never reached the timeline. |
| D2 | Event row status | The row stays the audit log and keeps a status for the tenant outbox monitor: `PENDING` = reactions outstanding, `PROCESSED` = every enabled reaction applied (or none exists), `DEAD_LETTERED` = a reaction failed its last retry (`error_message`). `FAILED` and `PROCESSING` belonged to the old processor. |
| D3 | No reaction | Trigger `trg_odeo_no_reaction` writes such an event as `PROCESSED`. It reads `pgboss.subscription`, the same list `publish()` reads. |
| D4 | Effect key | `<handler_code>:<event id>`, claimed in the reaction's own transaction. The reaction first locks its event row, so reactions to one event run one after another and the last one sees the others' effect rows when it decides the event is done. |
| D5 | Orphans | An event row that no longer exists (tenant cleanup) completes as `SKIPPED_ORPHAN`, no retry (§5.6). |
| D6 | Polling | 10 s for order submitted and loyalty (users see them soon after the action), 30 s for the rest. Idle cost about 0.6 queries per second. Concurrency 1; pg-boss keeps fetching without delay while a fetch comes back full, so a backlog drains fast. |
| D7 | Retry from the tenant outbox monitor | Sets the row back to `PENDING` and publishes the event again with new job ids. Reactions already applied find their effect row and do nothing. |
| D8 | Old path | Removed in the same release: `outbox-processor.service.ts`, the two outbox job routes, and `outbox_processor` in the tenant finance-jobs hub. `claim_outbox_batch` is dropped at step 8. |

### 22.3 Step 4 findings (23 Nov 2026)

| # | Finding | Fix |
|---|---|---|
| F9 | A started pg-boss producer still refreshes its queue cache every 60 s (`getQueues()`), so each warm web-admin instance sends one light query a minute, and the timer keeps a Node process alive. | Accepted: the refresh is what lets a producer see a queue that a later migration creates. Tests call `jobs.stop()` in teardown. |
| F10 | tsx loads web-admin `.ts` files as CommonJS (web-admin's `package.json` has no `"type": "module"`), so ESM named imports from them fail under tsx. | cmx-workers tests are bundled by esbuild with the production settings (`node build.mjs --test`) and run with `node --test`: tests run what ships. |
| F11 | The reaction import chain reaches web-admin modules that create a Supabase client when they load, and that import `next/headers` / `next/server`. | The worker requires the web-admin Supabase variables (validated before the handlers load, so a missing one reads "invalid environment"); esbuild maps `next/headers` and `next/server` to their `.js` files for Node's ESM loader. |
| F12 | web-admin compiles with `strict: false`; type-checking it under cmx-workers' strict settings fails on code this step does not own. | `npm run typecheck` uses `tsconfig.typecheck.json`, which sees web-admin through `src/types/web-admin-boundary.d.ts`; the integration tests run the real modules, so a signature change fails a test. |
| F13 | `OUTBOX_HANDLER_CATALOG` (tenant outbox monitor) was a stale copy of the old router: 4 history events, no cash over/short, and an `order-change-applied` handler with no EN/AR label. | It now mirrors `sys_ops_job_event_subs_cf` exactly; cmx-workers' contract test compares code, catalog and database. |
| F14 | `voucher-posting.service.ts` (dead since BVM) still wrote events without publishing. | Deleted now instead of at step 8. |

### 22.4 Step 5 findings so far (23 Nov 2026)

| # | Finding | Fix |
|---|---|---|
| F15 | The database time zone is `Asia/Muscat`; `org_ntf_outbox_dtl.scheduled_at` holds UTC without a zone. The batch claims compare `scheduled_at <= now()`, so a scheduled send (quiet hours) is released 4 hours early. | `fn_ntf_worker_claim_one` compares in UTC. The batch claims go at step 8. |
| F16 | A notification job may carry ids only, but `emitNotificationEvent` passes recipients and template variables. | `org_ntf_requests_tr` stores the request; `ntf.orchestrate` gets `{ tenantOrgId, requestId }` (STEP5_PLAN.md). |
| F17 | New queues for code that has not shipped would make the running worker alert "no handler" on every start. | New queues start paused; the runner reports a missing handler only for a switched-on queue. |
| F18 | `deliverInApp` documented "ON CONFLICT DO NOTHING" but did a plain insert, so a repeat reported a failed in-app delivery (and would fail every `ntf.orchestrate` retry). | A unique-key violation counts as delivered. Found by the cmx-workers notification test. |
| F19 | The template lookup ordered by `sys_ntf_template_ver_dtl(version_number)` without selecting it, so PostgREST rejected every lookup and all messages used the plain fallback text (local and remote run the same code). | `version_number` added to both embedded selects; lookup errors in the test went from every call to 0. |
| F20 | In-app notifications are now written by the worker. If web-admin ships before the worker runs (or while `ntf.orchestrate` is paused), new in-app notifications wait. External channels are already not sent today (old dispatcher off; 17 outbox rows waiting on remote) and resume with the HQ consumer (5c). | Release order in QA 5.2: worker first, then web-admin, then switch `ntf.orchestrate` on. |
| F21 | The outbox path called `DispatchService` with the outbox id as idempotency key. `DispatchService` answers a known key from `hq_ntf_dispatch_log` without calling the provider, so every retry after a temporary failure replayed the first `FAILED` and the message was never sent. | Key per attempt: `<outboxId>:<retry_count>` (`outboxAttemptKey`). The same key is the Resend `Idempotency-Key` and the key `ntf.reconcile` reads. |
| F22 | HQ API's in-process `ntf-outbox-dispatch` claimed up to 25 rows and sent them but never finalized them, so they stayed `PROCESSING` until the lease ran out (it was switched off). | Executor removed; delivery is the `ntf.deliver` queue. Registry rows `ntf-outbox-dispatch` / `ntf-outbox-shadow` (desired off) are retired at step 8. |
| F23 | Resend was called without `Idempotency-Key` (§18.6 gap). | Sent with the attempt key, so `httpDispatch` retries and a repeat of the same attempt do not send a second email. |
| F24 | The HQ consent check (`CustomerDispatchConsentService`) applies the order customer's email/SMS opt-out to every message about that order, including `order.created`, which goes to the staff user. A customer opt-out therefore also stops the staff email. | Open. Fix in 5d: check customer consent only when the recipient is the customer (`recipient_user_id` empty). |
| F25 | HQ → Ops → Jobs read the Enable/Disable button and the state badge from `actual_active`, which for a worker-reported job is only the worker's last report. After switching on a queue whose consumer had not reported yet, the screen still offered **Enable** and said **Disabled**, although `desired_enabled` was saved as true. | Fixed: for HQ workers and pg-boss queues the button follows `desired_enabled`, and a job without a report shows **Waiting for worker**; `PGBOSS_QUEUE` added to the web kind type. Test added. |
| F26 | A consumer start failure was only logged. A database that was briefly unreachable at boot left delivery off until the next deploy. | The consumer retries every 60 s (an invalid setting is not retried). Each distinct start error is written once as a FAILED run of every HQ_API queue in `sys_ops_job_run_dtl` (shown under Last run / History) and sent to Sentry when it is configured. |
