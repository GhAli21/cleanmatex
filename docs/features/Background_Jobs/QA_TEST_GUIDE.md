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
