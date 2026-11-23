# CleanMateX Background Jobs — Target Design (solo-founder edition)

**Status:** Proposal, 23 Nov 2026. Not approved. Written from first principles, with nothing frozen, under the Owner's rules: lowest cost today, easy for one person to run, able to scale later, boring proven technology, measure before adding infrastructure, one API container and one worker container. If approved, it replaces the runtime parts of the [ADR](I11_background_execution_redesign_ADR.md), the [expert replan](I11_background_execution_EXPERT_REPLAN.md) and the [handler contracts](I11_background_execution_handler_contracts.md). Nothing here is applied.
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
- `singletonKey` and queue policies deduplicate work.
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

`dead_letter` has no worker. Its retention is 90 days. The HQ screen shows it and can redrive single jobs or a whole source queue.

### 5.3 Enqueue helper

```ts
// packages/jobs — the only way to create background work
await enqueue(tx, 'fin.loyalty_earn', { tenantOrgId, orderId }, { singletonKey: orderId });
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
| **Reaction** | Enqueued in the business transaction | `order.completed` → `fin.loyalty_earn`, `fin.order_history`, `ntf.orchestrate`. One job per consumer, so each retries alone. |
| **Delayed** | `startAfter` within the next few days | POS session rollover at cutoff, end of quiet hours, campaign send time |
| **Sweep** | pg-boss cron, for long horizons | Daily gift-card, credit-note and loyalty expiry. The sweep only selects due ids through a bounded SQL function and enqueues one item job each with a `singletonKey`. |
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
    recheck policy  →  set SENDING  →  call provider with the outbox id as key
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

- Pause is a row in `sys_job_queue_cf` (`queue_name`, `enabled`). Both consumers, `cmx-workers` and HQ API, read it every 30 seconds and call `offWork` or `work` to match. Jobs stay queued while paused.
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

Pre-launch, so each step replaces the old path directly. No dual-running, no rollback services.

| Step | Work | Done when | Size |
|---|---|---|---|
| 0 | **Stop silent loss now.** Await notification emission in order submit and transition. Make the order-history consumer skip orphan events. Confirm `NTF_QUEUE_ENABLED` is not `true` on HQ API. | No `void` on side effects in routes. | 1 day |
| 1 | **Queue foundation.** Migration with the pg-boss schema from `getConstructionPlans`, plus `org_job_effect_tr` and `sys_job_queue_cf`, with grants per §18.3. `packages/jobs` with queue names, payload schemas, producer-mode enqueue and the effect helper. Hook enqueue into the shared domain-event writer (`outbox.service.ts`). ESLint rule. | Owner applies the migration. A Vercel request enqueues inside its transaction, and a rollback leaves no job. | 3 days |
| 2 | **`cmx-workers`.** New workspace with an esbuild bundle (`server-only` aliased to a stub, Prisma external), Sentry, heartbeat, graceful shutdown, pause reader, queue bootstrap. Deploy it by repointing the existing Render worker service at `cleanmatex/cmx-workers`, with build filters that include `web-admin/lib/**`, `packages/**` and `prisma/**`. Measure memory on 512 MB. | A test job runs, fails, retries with backoff, reaches the dead-letter queue, and redrives. | 3 days |
| 3 | **Finance reactions.** One job per consumer. Enqueue one job for each of the 115 pending events. Add orphan skip and effect keys. | Pending events reach zero. Loyalty, history and change confirmations are written once. | 3 days |
| 4 | **Notifications.** `ntf.orchestrate` in `cmx-workers`. `ntf.deliver`, `ntf.reconcile` and webhooks in HQ API. Extract campaign expansion from its route into a service. Real OTP sending (launch blocker). Receipts through the outbox. Delete the tenant provider adapters and `whatsapp-client.ts`. | Demo tenants get each message once, including after a forced timeout and a killed consumer. | 6–8 days |
| 5 | **Sweeps and delayed jobs.** Expiries, POS rollover, ERP retry, dunning, file purge. | Each queue has a run-twice test and a tenant-isolation test. | 3–4 days |
| 6 | **HQ screen and alerts.** Rebuild `/ops/jobs` on queue stats, dead letters and pause. Add the four alerts. | The Owner can see and fix any failed job from the screen. | 3 days |
| 7 | **Delete the old plumbing.** `platform-workers` and its Render config, HQ API `BackgroundExecutionModule`, the private execute endpoint and machine key, HQ `DispatchQueueService` and `ntf.hq.queue_enabled`, the `fn_ops_job_*` worker functions, the `fn_ntf_worker_*` functions, `claim_outbox_batch`, the finance and notification job routes, the `pg_net` wrappers and extension, nine of the ten env switches. Drop with `RESTRICT`. | Grep and the remote catalog show no callers. | 2 days |
| 8 | **Prove it.** Run each job twice, kill each consumer mid-job, force provider timeouts, then a 48-hour soak on demo tenants. Fold the six I11 documents into one design, one runbook and one QA guide. | Zero duplicate messages, zero cross-tenant writes, empty dead-letter queue. | 3 days |

About 4 to 5 weeks for one person working with AI help. These are rough estimates. Steps 0 and 3 restore user-visible behavior first. Server-side PDFs (§17) are not in this plan; they ship as their own feature when needed.

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
| Dedupe on the server, not the client | A key built from the action, for example `receipt:<id>:whatsapp`, with a 30-second `singletonKey` window, and the button disabled while sending. A key minted fresh by the browser on each click cannot stop a double click. |
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
| B4 | A job that outlives `expireInSeconds` is retried while the first handler may still be running, so an external effect could run twice. | pg-boss expiry semantics | Every handler gets a hard timeout through `AbortSignal`, set shorter than its queue's `expireInSeconds`. Every handler checks the domain row's status first. `ntf.deliver` sets `SENDING` before the provider call, so a parallel or redriven attempt goes to reconcile, never to a second send. |
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

Queues are created by `cmx-workers` on boot with idempotent `createQueue` and `updateQueue`. HQ API's `work()` on a queue that does not exist yet retries until it does.

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
| Enqueue | Double clicks, repeated requests | Server-built `singletonKey` from the action, for example `receipt:<id>:whatsapp` |
| Outbox row | Preparing the same message twice | One row per event, recipient and channel, unique key |
| Effect table | Running an `INTERNAL` job twice | `org_job_effect_tr` primary key |
| Status check | Retries, expiry overlap, dead-letter redrive | Handler skips `SENT`, and sends `SENDING` or `UNCERTAIN` rows to reconcile |
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
- Check `platform-web` (HQ web) on Vercel as well. It should use the same function region as the tenant app.
