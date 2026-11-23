# cmx-workers

The one background-worker container of CleanMateX. It consumes every pg-boss queue whose code lives in this repo (`sys_ops_job_queue_cf.consumer_app = 'CMX_WORKERS'`). It replaces `cleanmatexsaas/platform-workers` (deleted in step 8). HQ API consumes only the notification delivery queues.

Design: [docs/features/Background_Jobs/DESIGN.md](../docs/features/Background_Jobs/DESIGN.md) (§4, §5, §8, §10 step 3, §22).

## How it works

- **pg-boss 12.39.0** consumer with `migrate: false` (the schema comes only from repo migrations). It runs pg-boss maintenance (expiry, retention, dead letters) and registers an instance with a 30-second heartbeat.
- **The registry is the control plane.** Every `REGISTRY_POLL_SECONDS` (30) it reads its queues from `sys_ops_job_cf` + `sys_ops_job_queue_cf`:
  - `desired_enabled = false` pauses a queue: running jobs finish, queued jobs wait.
  - Concurrency, polling or expiry changes restart that queue's consumer.
  - It writes `applied_enabled` / `applied_at` / `applied_by` back. That clears the HQ screen's `WORKER_NOT_SEEN` flag and shows `STATE_DRIFT` if it disagrees.
  - A switched-on registry queue with no handler here is logged and sent to Sentry, and is never marked as seen. A paused one is ignored (its code may not have shipped yet).
- **Handlers** live in `src/handlers/` and are mapped by queue name in `src/handlers/index.ts`. Each runs with a time budget shorter than its queue's `expire_s`, so a slow handler fails and retries cleanly instead of overlapping a pg-boss expiry.
- **Finance event reactions** (step 4, migration 0809): 13 queues named `fin.<event>.<handler>`, one per reaction in `sys_ops_job_event_subs_cf`. `src/handlers/fin-reactions.ts` maps each to the web-admin runner `lib/services/domain-event-reactions.service.ts`, which locks the event row, claims the effect key `<handler>:<event id>`, runs the web-admin service on the same transaction, and marks the event `PROCESSED` once all its reactions are applied. The last failed attempt marks it `DEAD_LETTERED`, so the tenant outbox monitor shows it and its Retry runs the reactions again.
- **Failures:** throw from the handler. pg-boss retries with backoff, then moves the job to `dead_letter`. The last attempt is reported to Sentry.
- **Shutdown:** SIGTERM stops fetching, lets running jobs finish for up to 30 s, then exits.
- `WORKER_ENABLED=false` keeps the process up and fetching nothing.

## Add a handler

1. A migration creates the queue (`pgboss.create_queue`), its `sys_ops_job_cf` row (`kind = 'PGBOSS_QUEUE'`) and its `sys_ops_job_queue_cf` row (`consumer_app = 'CMX_WORKERS'`).
2. Add the payload schema to `packages/jobs/src/queues.ts`.
3. Add the handler in `src/handlers/` and map it in `src/handlers/index.ts`. Use `claimEffect` (from `@cmx/jobs`) first inside the transaction for INTERNAL effects, and filter `tenant_org_id` from the payload on every `org_*` query.

A new **event reaction** instead needs: the queue, registry and queue detail rows plus a `sys_ops_job_event_subs_cf` row (migration); a handler in web-admin `REACTION_HANDLERS`; a line in `FIN_REACTIONS`; the pair in web-admin `OUTBOX_HANDLER_CATALOG` with EN/AR `billing.outboxMonitor.handlers` labels. `test/reactions.test.ts` fails until code and database agree.

**Importing web-admin code.** esbuild bundles it, resolving `@/...` through `web-admin/tsconfig.json`. `npm run typecheck` checks this workspace strictly and sees web-admin through `src/types/web-admin-boundary.d.ts` (web-admin compiles non-strict); add an export there when you import a new one. Tests run as esbuild bundles too (`dist-test/`), because tsx loads web-admin files as CommonJS.

## Commands

```bash
npm run build --workspace=cmx-workers      # prisma generate (web-admin schema) + esbuild → dist/main.js
npm run start --workspace=cmx-workers      # node dist/main.js
npm run dev --workspace=cmx-workers        # build + start (local env)
npm test --workspace=cmx-workers           # bundles test/ → dist-test/, runs against local Supabase (migrations through 0809)
npm run typecheck --workspace=cmx-workers
npm run smoke --workspace=cmx-workers      # send one smoke job and wait for "completed"
npm run smoke --workspace=cmx-workers -- fail   # expect 3 attempts, then a dead letter
npm run publish-events --workspace=cmx-workers -- --dry-run   # count unfinished events that have reactions
npm run publish-events --workspace=cmx-workers                # publish them (safe to rerun)
```

## Environment

| Name | Required | Value |
|---|---|---|
| `JOBS_DATABASE_URL` | Yes | Supabase **session pooler**, port 5432: `postgresql://postgres.<project-ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres`. No `sslmode` parameter: it would override the certificate check below. Never port 6543. |
| `JOBS_DATABASE_CA_CERT` | Yes, for any non-local database | The Supabase CA certificate (PEM, multi-line). Supabase Dashboard → Project Settings → Database → SSL Configuration → Download certificate. The server certificate is verified against it. |
| `DATABASE_URL` | Yes | Prisma, for the web-admin services the reactions run. Supabase **transaction pooler**, port 6543: `...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3&sslmode=require`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same values as the web-admin deployment. Some web-admin services create a Supabase client when they load. |
| `NODE_ENV` | Yes on Render | `production`. |
| `TENANT_GUARD_MODE` | No | Same value as web-admin production (the Prisma tenant guard). |
| `NODE_VERSION` | Yes on Render | `22.12.0` or newer (pg-boss 12 needs it). |
| `SENTRY_DSN` | Recommended | Sentry project DSN. Without it, failures are only in the logs. |
| `SENTRY_ENVIRONMENT` | No | Default `production`. |
| `WORKER_ENABLED` | No | Default `true`. `false` = fetch nothing. |
| `JOBS_DB_POOL_MAX` | No | Default 4 (DESIGN §4.3). |
| `REGISTRY_POLL_SECONDS` | No | Default 30. |
| `WORKER_INSTANCE_NAME` | No | Default `cmx-workers`. Shown in `pgboss.instance` and `applied_by`. |

## Render service (Owner)

Create a new **Background Worker**. Do not reuse the Oregon `platform-workers` service: Render cannot change a service's region.

| Setting | Value |
|---|---|
| Repository | `cleanmatex` (tenant repo), branch `main` |
| Region | **The database's region** (Ohio while the database is in AWS `us-east-2`; decide S-D6 first) |
| Root directory | empty (repo root: npm workspaces) |
| Runtime | Node |
| Build command | `npm ci && npm run build --workspace=cmx-workers` (`esbuild` and `tsx` are normal dependencies of cmx-workers, because `NODE_ENV=production` makes `npm ci` skip dev dependencies) |
| Start command | `npm run start --workspace=cmx-workers` |
| Instance type | Starter (512 MB) |
| Build filters, included paths | `cmx-workers/**`, `packages/**`, `package.json`, `package-lock.json`, `web-admin/lib/**`, `web-admin/prisma/**`, `web-admin/tsconfig.json`, `web-admin/package.json` |
| Environment | The table above |

The build installs every workspace on purpose: the worker bundles web-admin services, which need web-admin's dependencies, and the build generates the Prisma client from `web-admin/prisma/schema.prisma`.

**Measured (local, 23 Nov 2026, step 3, before the reactions):** idle RSS 96 MB, heap 41 MB, 1 pooled connection. The step 4 bundle (447 KB) also loads Prisma and the web-admin services; check Render's memory graph after the first day.

## After the first deploy

1. Render logs show `worker started` with `ops.smoke_test` and the 13 `fin.*` queues.
2. HQ → Ops → Jobs: `ops.smoke_test` no longer shows "worker not seen".
3. From a machine with the same two database variables set: `npm run smoke --workspace=cmx-workers` prints `state=completed`, and `-- fail` prints `state=failed attempts=3 deadLetter=<id>`.
4. Once, after the step 4 web-admin code is deployed: `npm run publish-events --workspace=cmx-workers -- --dry-run`, then without `--dry-run`. The tenant outbox monitor's pending count falls to zero within minutes.
