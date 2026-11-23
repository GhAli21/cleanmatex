# Background Jobs — QA Test Guide

Owner checks per step. Each check says where to go, what to do, and what you should see. Use a demo tenant.

## Step 0 — Stop silent loss

### 0.1 Order created notification arrives

1. In the tenant app, create and submit a new order.
2. Open the notification bell.
3. **Expected:** an "order created" in-app notification for that order appears within a few seconds. The order submit itself responds as fast as before.

### 0.2 Order status notification arrives

1. Move an order to the next workflow status, for example to Ready, from the order screen.
2. Open the notification bell.
3. **Expected:** the status notification appears, showing the order number, not a long id.

### 0.3 Orphan finance events no longer dead-letter

This check needs the finance consumer to run, which happens from step 4. Until then it is covered by the automated tests `order-history-consumer.service.test.ts` ("completes as SKIPPED_ORPHAN…" and "rethrows an FK violation…").

## Step 1 — Queue foundation migration (`0807_bg_jobs_queue_foundation.sql`)

### 1.1 Apply

1. Apply `supabase/migrations/0807_bg_jobs_queue_foundation.sql` locally, then remotely, the same way you apply other migrations.
2. From the repo root run `npm run prisma:pull`, then regenerate the Supabase types in both repos as usual. Prisma gains `sys_job_queue_cf` and `org_job_effect_tr`. The `pgboss` schema is not part of Prisma.

### 1.2 Verify on remote (Supabase SQL editor, read-only)

```sql
SELECT name, retry_limit, retention_seconds, dead_letter FROM pgboss.queue ORDER BY name;
SELECT version FROM pgboss.version;
SELECT queue_name, consumer_app, effect_class, is_enabled FROM public.sys_job_queue_cf ORDER BY rec_order;
SELECT has_schema_privilege('anon', 'pgboss', 'USAGE') AS anon_usage,
       has_schema_privilege('authenticated', 'pgboss', 'USAGE') AS authenticated_usage,
       has_table_privilege('authenticated', 'public.org_job_effect_tr', 'SELECT') AS effects_readable;
```

**Expected:**
- 3 queues: `dead_letter` (retry 0, retention 7776000, no dead letter), `fin.domain_event` (retry 8, retention 2592000, dead letter `dead_letter`), `ops.smoke_test` (retry 2, retention 86400, dead letter `dead_letter`).
- Version `47`.
- 3 catalog rows, all `is_enabled = true`.
- All three privilege checks `false`.
- Nothing in the app changes yet. No code uses these objects until step 2 and later.

## Step 1b — Registry extension, event catalog, renamed event codes (`0808`)

### 1b.1 Release order (do not reverse)

1. Deploy the web-admin code that uses the new event codes (Vercel).
2. Apply `supabase/migrations/0808_ops_job_registry_event_catalog.sql` locally, then remotely.
3. Run `npm run prisma:pull` and regenerate Supabase types in both repos.

### 1b.2 Verify on remote (Supabase SQL editor, read-only)

```sql
SELECT count(*) AS types, count(*) FILTER (WHERE is_financial) AS financial, count(*) FILTER (WHERE is_reserved) AS reserved
FROM public.sys_ops_job_event_types_cd;
SELECT event_type, count(*) FROM public.org_domain_events_outbox GROUP BY 1 ORDER BY 1;
SELECT job_code, kind, drift_flags FROM public.fn_ops_job_list_v2() WHERE kind LIKE 'PGBOSS%';
SELECT name FROM pgboss.queue ORDER BY 1;
```

**Expected:** 34 types, 33 financial, 1 reserved. No event rows with `ORDER_COMPLETED`, `LOYALTY_EARN`, `STORED_VALUE_CHANGED`, `ORDER_CANCEL_FINANCIAL_UNWIND`, `CASH_DRAWER_SESSION_CLOSING`, `CASH_DRAWER_OVER_SHORT` or `CASH_FACT_REDIRECTED`; the 115 pending ones now carry the new names. Two pg-boss rows in the list: `dead_letter` (no flags) and `ops.smoke_test` (`WORKER_NOT_SEEN`, expected until the worker exists). Queues: `dead_letter`, `ops.smoke_test` only.

### 1b.3 HQ jobs screen

1. Open HQ web → Ops → Jobs.
2. **Expected:** the list still loads. Two new rows, `dead_letter` and `ops.smoke_test`. `ops.smoke_test` shows a "worker not seen" style flag; that is correct until step 3. Run now on them is refused with a clear message.

### 1b.4 Tenant app

1. Submit a new order, then open the order's history timeline.
2. **Expected:** order submit works as before. The timeline labels use theme colours in light and dark mode, and are readable in both.
3. In Arabic, the timeline is right-to-left and readable.

## Step 2 — `packages/jobs` (no screen; developer check)

### 2.1 Producer integration test

1. Start local Supabase (`npm run supabase:start` from the repo root) with migrations up to 0808 applied.
2. From the repo root run `npm test --workspace=@cmx/jobs`.
3. **Expected:** 7 tests pass. Afterwards, in local SQL: `SELECT count(*) FROM pgboss.job WHERE name = 'ops.smoke_test';` returns 0.

### 2.2 Campaign audit rows (fixed bug)

1. In the tenant app, change a notification campaign's status (for example pause, then resume).
2. **Expected:** `org_ntf_audit_dtl` gains one `STATUS_CHANGED` row for that campaign per change. Before this fix no row was written.

## Step 3 — `cmx-workers` (Render)

### 3.1 Local proof (developer)

1. Local Supabase running with migrations through 0808.
2. `npm test --workspace=cmx-workers`.
3. **Expected:** 9 tests pass in about 25 seconds.

### 3.2 Deploy (Owner, after S-D6)

1. Create the Render Background Worker as in `cmx-workers/README.md` → "Render service", in the database's region.
2. Set `JOBS_DATABASE_URL` (session pooler, port 5432), `JOBS_DATABASE_CA_CERT` (Supabase CA PEM), `NODE_VERSION` 22.12+, `SENTRY_DSN`.
3. Deploy. **Expected:** the log shows `worker started` with `queues: ["ops.smoke_test"]`. A log line `invalid environment` names the missing variable.

### 3.3 Prove it on remote

1. HQ → Ops → Jobs. **Expected:** within a minute, `ops.smoke_test` no longer shows "worker not seen".
2. On your machine, with the same two database variables set: `npm run smoke --workspace=cmx-workers`. **Expected:** `state=completed attempts=1 deadLetter=none`.
3. `npm run smoke --workspace=cmx-workers -- fail`. **Expected:** `state=failed attempts=3 deadLetter=<id>`, and a Sentry issue tagged `queue: ops.smoke_test`.
4. HQ → Ops → Jobs: pause `ops.smoke_test`, wait 30 seconds, run step 2. **Expected:** it reports no outcome (the job waits). Resume it: the waiting job completes within 30 seconds.
5. Render → the worker → Metrics. **Expected:** memory well under 512 MB (about 100 MB idle).

## Step 4 — Finance reactions

### 4.1 Apply 0809 (Owner)

1. Apply `0809_bg_jobs_fin_event_reactions.sql` on local, then remote.
2. Run in the SQL editor:
   `select count(*) from pgboss.queue where name like 'fin.%';` **Expected:** 13.
   `select count(*) from pgboss.subscription where name like 'fin.%';` **Expected:** 13.
   `select status, count(*) from org_domain_events_outbox group by 1;` **Expected:** no `PENDING` rows for cash drawer session, cash drawer transaction, payment received or refund processed events; the pending order, voucher, loyalty and order-change events are still `PENDING` (published by Dev's drain script after the code ships).
3. HQ → Ops → Jobs. **Expected:** 13 new rows in category Reaction, each flagged "worker not seen" until `cmx-workers` runs; `fin-outbox-processor` shows as superseded.

### 4.2 Release order (Owner)

1. 0809 is applied (done 23 Nov).
2. Deploy web-admin with the step 4 code. From then on every new domain event is published to its reaction queues in the same transaction. Until a worker runs, the jobs wait and the events stay `PENDING`; nothing is lost.
3. Create or update the Render `cmx-workers` service (step 3, after S-D6) with the extra variables in `cmx-workers/README.md`: `DATABASE_URL` (transaction pooler 6543, `pgbouncer=true&connection_limit=3&sslmode=require`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV=production`, and `TENANT_GUARD_MODE` as on web-admin. Add the build filters `web-admin/lib/**`, `web-admin/prisma/**`, `web-admin/tsconfig.json`, `web-admin/package.json`.
4. **Expected:** Render log `worker started` lists `ops.smoke_test` and 13 `fin.*` queues. HQ → Ops → Jobs: none of the 13 shows "worker not seen".

### 4.3 Publish the waiting events (Owner, once)

1. On your machine, with `JOBS_DATABASE_URL` and `JOBS_DATABASE_CA_CERT` as on the worker: `npm run publish-events --workspace=cmx-workers -- --dry-run`. **Expected:** a count per event type (order submitted, voucher posted, loyalty, order change, cash variance; the 22 May `ORDER_SUBMITTED` dead letters are included).
2. Run it without `--dry-run`. **Expected:** `published N event(s)`. Run it again: it lists the same events but creates no new jobs (safe to repeat).
3. Tenant app → Internal finance → Outbox monitor. **Expected:** the pending count falls to 0 within a few minutes; dead-lettered stays 0, or shows rows whose error message explains the failure.

### 4.4 Check the reactions (Owner, demo tenant)

1. Submit a new order from checkout. Open the order → History. **Expected:** "Order submitted" appears within about 15 seconds.
2. Cancel or void a pending payment on an order. **Expected:** the matching payment entry appears in the order History (it never did before step 4).
3. Close a cash drawer session with a variance. **Expected:** the over/short adjustment voucher is posted within a minute.
4. Outbox monitor → an event with status Dead-lettered (if any) → Retry. **Expected:** it goes to Pending, then Processed; the order History does not get a second entry.
5. The "Event consumers" card lists Order history, Loyalty points earned, Cash over/short posting and Order change confirmation, in English and Arabic.
6. Finance jobs hub (same page): no "Outbox Processor" row.

## Step 5 — Notifications

### 5.1 Apply 0810 (Owner)

1. Apply `0810_bg_jobs_ntf_queues_requests.sql` on local, then remote.
2. SQL editor: `select name from pgboss.queue where name like 'ntf.%' order by 1;` **Expected:** 6 rows.
3. `select claim_outcome from fn_ntf_worker_claim_one(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'qa', 120);` **Expected:** `NOT_FOUND`.
4. HQ → Ops → Jobs. **Expected:** six new rows in category Notification, all paused. Leave them paused until the step 5 code ships.

### 5.2 Tenant side: requests and preparation (Owner, after the worker runs)

1. Release order: the Render `cmx-workers` service runs (step 3/4), then deploy web-admin, then HQ → Ops → Jobs → `ntf.orchestrate` → switch on. Leave `ntf.deliver`, `ntf.reconcile` and `ntf.status_apply` paused until the HQ consumer ships (5c).
2. Submit an order on a demo tenant. **Expected:** within about 5 seconds the bell shows "Order created" with the real template text (not the plain fallback).
3. SQL editor: `select status, result_summary from org_ntf_requests_tr order by created_at desc limit 1;` **Expected:** `PROCESSED`, with `deliverJobs` ≥ 1 when email is on for the tenant.
4. `select state, count(*) from pgboss.job where name = 'ntf.deliver' group by 1;` **Expected:** jobs in `created` (they wait for HQ API in 5c).

### 5.3 HQ API sends the messages (Owner, after the HQ API deploy)

**A. Deploy**
1. Commit and push both repos (tenant and HQ).
2. Render → `cleanmatexsaas-api` → Environment: `NODE_VERSION` = `22.16.0` (pg-boss needs 22.12 or later), `JOBS_DATABASE_URL` = the same value as on `cmx-workers` (pooler port 5432), `JOBS_DATABASE_CA_CERT` = the same certificate. Save, deploy.
3. HQ API logs. **Expected:** `queue consumer started as hq-api; running: ntf.deliver, ntf.reconcile` (or `none (all paused)` if they are off). If you see `queue consumer did not start (next try in 60 s): ...`, the text names the problem; it is also a FAILED row under **Last run / History** of `ntf.deliver` and `ntf.reconcile` in HQ → Ops → Jobs. HTTP keeps working, and the consumer tries again every minute.

**B. Switch on**
4. HQ → Ops → Jobs, search `ntf.`. For `ntf.orchestrate`, `ntf.deliver`, `ntf.reconcile`: the button shows **Disable** when the switch is on. Before HQ API reports, the badge says **Waiting for worker** and Drift says **Worker not reporting**; within 30 seconds of the deploy both change to **Enabled** with no drift. Leave `ntf.status_apply`, `ntf.campaign_start`, `ntf.campaign_chunk` off.

**C. One email, end to end**
5. Pick the account you will test with: a staff user of **Demo Laundry LLC** (or Demo Saudi Riyadh Dry Clean) whose login email is an inbox you can open. The `order.created` notification goes to **the staff user who submits the order**, at that user's login email. Both demo tenants have the email and in-app channels on.
6. Sign in to the tenant app as that user. New order: pick a customer who has **not** opted out of email (customer → preferences; an opt-out also blocks this staff email, see F24), add one item, submit.
7. **Expected within about 10 seconds:**
   - the bell shows "Order created" with the order number;
   - one email "Order created …" arrives in that inbox (check spam the first time; it comes from the HQ Resend sender address).
8. SQL editor (Supabase, production):
   ```sql
   select channel_code, status, retry_count, provider_message_id, error_message, sent_at
     from org_ntf_outbox_dtl
    where source_entity_type = 'order'
    order by created_at desc limit 5;
   ```
   **Expected:** the EMAIL row is `SENT`, with a `provider_message_id`, `retry_count` 0, no error.
9. ```sql
   select name, state, count(*) from pgboss.job where name like 'ntf.%' group by 1, 2 order by 1, 2;
   ```
   **Expected:** `ntf.orchestrate` and `ntf.deliver` `completed`; nothing `failed`; no `ntf.reconcile` (it runs only after an uncertain send).
10. Submit one more order and refresh the inbox: exactly one new email (not two).

**If the email row is not SENT**
- `SKIPPED` with "opted out": the order's customer opted out of email; use another customer.
- `FAILED_TEMPORARY`: a new `ntf.deliver` job waits 5 minutes (then 15, 60, 240, 720); `error_message` and `hq_ntf_dispatch_log` show the provider's reason.
- `FAILED_PERMANENT` "PROVIDER_NOT_CONFIGURED": check HQ → configuration `ntf.hq.resend.api_key` and `ntf.hq.resend.from_email` (the from address must be on a domain verified in Resend).
- Still `QUEUED` and the job `created`: HQ API is not consuming; see step 3.

**Note:** the order submitted on 23 Nov at 21:10 already has three `ntf.deliver` jobs waiting (PUSH, EMAIL, SMS). They are sent as soon as step 4 is done, so that email may arrive first. Older outbox rows written before this release have no job and are not sent (stale demo messages; step 8 marks them skipped).
