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

### 5.4 Delivery status from provider webhooks (Owner, after 0812 and the HQ API deploy)

Needs a provider that calls back: Twilio SMS or Meta WhatsApp with its status callback URL set to `https://<hq-api>/notifications/webhooks/twilio` (or `/meta`). Email (Resend) has no webhook yet, so email rows stay `SENT`.

1. 0812 is applied (local and remote, 24 Nov). **Expected:** `select to_regprocedure('public.fn_ntf_status_apply(uuid,uuid,text,text,text,text,text,text)');` is not null.
2. HQ → Ops → Jobs → `ntf.status_apply` → switch on. **Expected:** **Enabled** with no drift within 30 seconds.
3. Send one SMS or WhatsApp to a phone you hold (for example, an order with SMS on for that tenant).
4. Within about a minute: `select channel_code, status, delivered_at, read_at from org_ntf_outbox_dtl order by created_at desc limit 3;` **Expected:** the row moves from `SENT` to `DELIVERED` (WhatsApp: `READ` after you open it).
5. `select receipt_kind, provider_status_raw from org_ntf_receipts_tr order by received_at desc limit 5;` **Expected:** one row per callback (`ACCEPTED`, `DELIVERED`, `READ`).
6. `select event_type, processed_at, processing_error from hq_ntf_webhook_events order by created_at desc limit 5;` **Expected:** `processed_at` filled, `processing_error` empty.
7. Reply `STOP` to the SMS. **Expected:** the event is processed and the number is on the suppression list; the next SMS to it is `SKIPPED`.

**If not:** `processed_at` empty and a `ntf.status_apply` job `created` → the queue is off (step 2). `processing_error` "No dispatch has this provider message id" → the callback is for a send outside the outbox. The provider shows HTTP 503 → HQ API runs without `JOBS_DATABASE_URL` (5.3 step 1).

### 5.5 Push (Owner, after 0816 and the HQ API deploy)

Push reaches only a user who has a registered device. No screen registers one yet, so until that task is done only steps 1–3 can be checked; step 4 needs one row in `org_ntf_push_subs_dtl` (a browser subscription from a test page, or a Firebase token from the app).

1. 0816 is applied (local and remote, 24 Nov). **Expected:** HQ → Ops → Config → `ntf.app.vapid.public_key` lists **HQ_API** under the apps; `ntf.hq.fcm.server_key` shows HQ_API as no longer used.
2. On the HQ API host set the same `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as web-admin (or rely on the registry values), and for apps `FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID` from the Firebase console (Project settings → Service accounts → Generate new private key). Then **Check now** on those keys. **Expected:** HQ_API shows **yes**.
3. Trigger a notification with push for a staff user who has no device (for example an order created). **Expected:** the PUSH outbox row ends `SKIPPED` with reason "The user has no active push device"; no row for it in `hq_ntf_dispatch_log`; the in-app bell row is there.
4. With one registered device, trigger it again. **Expected:** the phone or browser shows the pop-up; the outbox row is `SENT`; `failure_count` of the device stays 0.
5. Remove the device (uninstall the app or clear the browser site data), trigger again. **Expected:** the row is `FAILED_PERMANENT` ("provider rejected") and the device row is `is_active = false`.

**If not:** row `FAILED_TEMPORARY` and the dispatch log says `PUSH_NOT_CONFIGURED` → step 2 keys are missing on HQ API. Browser push `config` errors (401/403) → HQ uses a different VAPID pair from the one the browser subscribed with.

### 5.6 Campaigns (Owner, after the web-admin and cmx-workers deploy)

Campaigns now run as jobs: approving (or scheduling, starting, resuming) a campaign queues `ntf.campaign_start`; cmx-workers creates the targets and sends them in `ntf.campaign_chunk` jobs of 50. Switch on `ntf.campaign_start` and `ntf.campaign_chunk` in HQ → Ops → Jobs There is no pg_cron call to stop any more: migration 0798 removed the `ntf-campaign-scheduler` cron job (remote checked 24 Nov: no campaign job in `cron.job`), and its HQ worker replacement is off (desired and applied off). Keep `ntf-campaign-scheduler` off; migration 0818 marks it SUPERSEDED so it cannot be switched on. 5e deletes the `process-campaigns` and `jobs/campaign-expansion` routes.

1. Create a campaign on EMAIL for two staff users: one who allowed marketing email (Notifications → Preferences), one who did not. Submit it, then approve it. **Expected:** within about a minute the campaign is **Completed**; Targets = 2, Queued = 1, Skipped = 1; the skipped target says `NO_MARKETING_CONSENT`.
2. Open the queued target's outbox row. **Expected:** it has the user's email address and is sent by HQ API (`SENT`), and the campaign's Sent count becomes 1.
3. Create another campaign, approve it with **Start now**. **Expected:** it sends too (before this change "Start now" completed with nothing sent).
4. Schedule a campaign 5 minutes ahead. **Expected:** nothing is sent before that time; it completes shortly after.
5. Pause a large campaign (more than 50 targets) while it runs, then resume it. **Expected:** sending stops within one target, untouched targets stay Pending, resume finishes them, nobody gets the message twice.
6. Approve a campaign whose target list is empty. **Expected:** status **Failed**, audit shows "No user_ids in target_segment".

**Campaigns to customers (migration 0818, STEP5_PLAN 4b).** Switch EMAIL on for the Organization (and SMS if you test SMS).

7. Customers → open a customer with an email → **Preferences** tab. **Expected:** a **Marketing messages** card under the WhatsApp card, with three boxes (email, SMS, WhatsApp), all unticked. Tick email, **Save**. **Expected:** success message; reload keeps it ticked. Tick SMS on a customer with no phone. **Expected:** a warning that campaigns cannot reach them yet (saving is still allowed). A user without `customers:update` sees the boxes disabled and a read-only note. Check Arabic (right-to-left) too.
8. Notifications → Campaigns → Create. Choose **Customers**. **Expected:** channels are Email, SMS and WhatsApp (WhatsApp: steps 12–17). Choose **Chosen customers** → **Add customer**, search by name or phone, add the customer from step 7 and one who did not agree. Save, submit, approve. **Expected:** Completed; Targets = 2, Queued = 1, Skipped = 1 (`NO_MARKETING_CONSENT`); the queued outbox row is addressed to the customer's own email, has no user, and HQ sends it.
9. Create a customer campaign with **All customers who agreed** on Email and approve it. **Expected:** only customers with email ticked in step 7 become targets.
10. Untick email for the step 7 customer while a campaign row to them is still queued (or schedule the campaign a few minutes ahead, then untick before it sends). **Expected:** HQ does not send; the row is skipped with "Customer has not agreed to EMAIL marketing".
11. (Replaced by steps 12–17: WhatsApp campaigns to customers now work.)

**WhatsApp campaigns to customers (STEP5_PLAN 4c).** Needs: 0819 applied, HQ API + platform-web + web-admin + cmx-workers deployed, WhatsApp switched on for the Organization, a customer with a valid phone.

12. Apply `0819_ntf_campaign_wa_template.sql` on local, then remote. **Expected:** it commits. In SQL: `org_ntf_route_assign_cf` has `template_code` and constraint `uq_ntf_route_scope` now lists `template_code`; `org_ntf_campaigns_mst` has `template_vars` (default `{}`) and constraints `ck_ntf_camp_tvars`, `ck_ntf_camp_wa_tmpl`. The existing `order.created` route on remote is unchanged and still `ACTIVE`, with `template_code` NULL.
13. HQ → Notifications: import an approved WhatsApp template whose Meta category is **MARKETING** for a logical template of event `campaign.send` (EN, and AR if you test Arabic). Open the demo Organization → Routes → Add route, pick that template, save, **Activate**. **Expected:** active; the route row shows `campaign.send (<template code>)`. Repeat with a UTILITY template on `campaign.send`. **Expected:** Activate refuses with "needs a provider template approved in the MARKETING category".
14. In web-admin, Notifications → Campaigns → Create → **Customers** → **WhatsApp**. **Expected:** a short loading placeholder, then a **WhatsApp template** list with the step 13 template and "Sent in: en" (or "en, ar"). Pick it. **Expected:** one field per template variable; leaving a required one empty and saving shows "Enter a value" under it. With no `campaign.send` route for the Organization: a warning that no approved template is available yet. Check Arabic (right-to-left) too.
15. Give a customer WhatsApp marketing consent (Customers → Preferences → Marketing messages → WhatsApp) and another none. Create the WhatsApp campaign for both, fill the values, submit, approve. **Expected:** Completed; the agreeing customer's outbox row is WHATSAPP, event `campaign.send`, the customer's phone, metadata holding the values; HQ sends it through the step 13 route (dispatch log SENT, one message on the phone with the values filled). The other is Skipped (`NO_MARKETING_CONSENT`).
16. Untick the WhatsApp consent before HQ sends (schedule the campaign a few minutes ahead). **Expected:** HQ blocks it: "Customer has not agreed to WHATSAPP marketing"; nothing reaches the phone.
17. Suspend the step 13 route in HQ, then send `POST /api/v1/notifications/campaigns` with that `template_code` and `channel_code: WHATSAPP`. **Expected:** 422 `CAMPAIGN_TEMPLATE_NOT_AVAILABLE`. A customer whose preferred language has no route for the template is blocked by HQ with "No active WhatsApp route is available for this delivery".

**If not:** campaign stays **Approved** → `ntf.campaign_start` is off or cmx-workers is down (HQ → Ops → Jobs). Targets stay **Pending** with the channel switched off for the tenant → expected: the chunk checks again every 15 minutes until the channel is on or the campaign is cancelled.

### 5.7 OTP and receipts (STEP5_PLAN item 5)

**Database (Owner, now):**

1. Apply `0820_ntf_otp_receipt_send.sql` on local, then remote. **Expected:** it commits. In SQL:
   - `sys_otp_codes` has `request_ip` and index `idx_otp_ip_expires`;
   - `sys_ntf_events_cd` has `customer.otp_generated` and `order.receipt_sent`;
   - each has an APPROVED `.default` template: SMS for the OTP, EMAIL + WHATSAPP for the receipt;
   - `cron.job` has `ntf-short-retention` at `23 * * * *`, and `sys_ops_job_cf` has the same row.
2. After the next hour's minute 23: `select * from cron.job_run_details where command like '%short_retention%' order by start_time desc limit 1` shows `succeeded`. The 32 old test rows in `sys_otp_codes` (fixed code, expired) are gone.

2a. Apply `0822_ntf_otp_channels.sql` on local, then remote, **before deploying the 5d code**. **Expected:**
   - `sys_otp_codes.code` is `text`;
   - `sys_ntf_event_chan_map` has SMS, WHATSAPP and EMAIL for `customer.otp_generated`;
   - `sys_ntf_template_chan_dtl` has the same three rows for `customer.otp_generated.default`.

**One-time setup (Owner):**

- **`OTP_HMAC_SECRET`:** 64 random hex characters. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (or `openssl rand -hex 32`). Set the same value on every web-admin environment that shares a database (Vercel Production and Preview, local `.env.local`). Changing it invalidates codes in flight and signs every customer out of the customer app. Never commit it.
- **WhatsApp routes in HQ**, per Organization. SMS and email need none. Do this once per template and language:
  1. In Twilio Content Template Builder, create the template and submit it to WhatsApp:
     - **OTP:** Create new template → **WhatsApp authentication**. Fill in:
       - the name (for example `customer_otp_en`);
       - the language;
       - **Code expiration** 5 minutes (it matches the app);
       - **Add security recommendation** on;
       - a **Copy code** button.
       
       Meta writes the text ("<code> is your verification code"); its one parameter is the code. HQ shows it as slot `1` (fixed 24 Nov; before that HQ found no slot).
     - **Receipt:** category **Utility**, for example "Hello {{1}}, your receipt for order #{{2}}: total {{3}}. Track: {{4}}".
     
     Wait until Twilio shows it approved, then copy its Content SID (starts with `HX`).
  2. HQ → Notifications → **Providers** → **Import Twilio template**:
     - pick the verified account, the language, and the HQ template (`customer.otp_generated.default` or `order.receipt_sent.default`);
     - paste the SID → **Fetch and review**;
     - check that the category shows AUTHENTICATION or UTILITY;
     - **Confirm import**.
  3. On the imported revision → **Define bindings**: map each provider parameter to the typed variable.
     - OTP: parameter 1 → `otp_code`.
     - Receipt: `customer_name`, `order_number`, `total_amount`, `tracking_url`, in the template's order.
     
     The tenant sends exactly these keys (OTP also sends `tenant_name` and `expires_minutes`). Bindings cannot be changed later; a correction needs a new import.
  4. HQ → Notifications → **Tenant config** → the Organization's WhatsApp row → **Routes** → **Add route**:
     - choose the event (`customer.otp_generated` or `order.receipt_sent`) and the imported template revision;
     - save → **Activate**.
     - HQ refuses an OTP route whose template is not AUTHENTICATION. Repeat for Arabic if the Organization's language is Arabic: OTP routes use the Organization's language, and receipt routes use the customer's.

**Order-created WhatsApp with a tracking button (`order_confirmation_with_track_link`, 24 Nov):** the order-created event now also sends `customer_name`, `order_items` (one line: "2 × Shirt, 1 × Dishdasha", at most 10 items) and `track_code` (the order's public tracking token), as well as `order_number`, `estimated_ready_at` and `date`. Needs web-admin and HQ API (edit a suspended route) and platform-web deployed.
1. HQ → Notifications → Templates → `order.create_confirm`: create a new version whose English text uses all five keys, for example: `Hi {{customer_name}}, your order {{order_number}} is confirmed. Items: {{order_items}}. Ready: {{estimated_ready_at}}. Track: {{track_code}}`. Approve it. (Variables come from the placeholders of the latest approved version; v1 has no `track_code`, so its slot cannot be bound.)
2. Providers → **Import Twilio template** → template `order.create_confirm`, language EN, SID `HX0cdf6c5865d51a1efd61fde52656a42c` → Fetch and review. **Expected:** 5 variables, including `track_code`, and a "creates a new revision" note. Confirm.
3. On the new revision → **Define bindings**: each slot to the variable of the same name (`track_code`, `customer_name`, `order_number`, `order_items`, `estimated_ready_at`).
4. Tenant config → Demo Laundry LLC → WhatsApp → **Routes**: on the `order.created` / en route, **Suspend**, then **Edit**, then pick the new revision, Save, then **Activate**. **Expected:** active. (Editing a suspended route is new; before, a route's template could never be switched, because one row per scope also blocks a new route after Retire.)
5. Customer: phone with WhatsApp, language English (or empty when the Organization is English), and **WhatsApp notifications on** (customer → Preferences). Without the opt-in, HQ skips with "Customer has not opted in to WhatsApp notifications", as every recent WhatsApp order message on remote was.
6. Create an order for that customer. **Expected:** within about a minute, a WhatsApp message with the name, order number, items and ready date, and a **Track Your Order** button opening `https://cmx.cleanmatex.com/track/<token>`. That page shows the order. The outbox row is `SENT`, and its `metadata.variables` holds the five values.
7. To go back to the old template: Suspend → Edit → pick revision `order_created_v4` → Activate.

**Code (Owner, after deploy):** needs:
- web-admin, cmx-workers and HQ API deployed, and the `ntf.deliver` queue on;
- `OTP_HMAC_SECRET` (32+ random characters) set on web-admin;
- SMS, WhatsApp and Email switched on for the Organization (Settings → Notifications) for the channels you test.

3. Customers → a stub customer → **Upgrade profile**. **Expected:** a **Send the code by** list (SMS, WhatsApp, Email).
   - Keep SMS and send. **Expected:** the code-entry step opens at once. Within about 15 s a message says "Verification code sent". A real 6-digit SMS arrives, in Arabic when the customer's language is Arabic.
   - In SQL, `sys_otp_codes.code` holds a 64-character hash, not the code.
   - Enter the code. **Expected:** the profile is upgraded.
4. Choose **Email**: an email field appears with the customer's email. Clear it and send. **Expected:** "Enter a valid email address…". With an address: the email arrives with the code.
5. Choose **WhatsApp**. Without an HQ route for `customer.otp_generated`: the message ends with "could not be sent". HQ → Notifications → the Organization → Routes: add a route on `customer.otp_generated` with a **UTILITY** template. **Expected:** Activate refuses with "…AUTHENTICATION category". With an approved **AUTHENTICATION** template (its code variable bound to `otp_code`): activate it, send again. **Expected:** the WhatsApp code arrives.
6. Send again at once. **Expected:** "Wait a minute before asking for a new code…". Six sends within one hour for the same phone: the sixth is refused.
7. A customer with a phone outside the GCC (for example +44): SMS is refused with "Codes can only be sent to numbers in the countries we serve…". Email still works.
8. Enter a wrong code 3 times, then the right one. **Expected:** the 4th try is refused. A new code then works.
9. Stop HQ API, send a code, wait 6 minutes, start HQ API. **Expected:** no late message. The outbox row ends failed with "The message expired before it could be sent". The screen said "The code is still being sent…" after 15 s.
10. Forged token: `GET /api/v1/public/customer/orders` with `Authorization: Bearer <base64 of {"phone":"+968…","exp":9999999999999}>`. **Expected:** 401. A token from a real customer login still works. Tokens issued before the deploy stop working (customers sign in again).
11. Orders → an order → Receipts → tick WhatsApp and Email → Send. **Expected:**
    - "The receipt is being sent." first, then within 15 s one message per channel: "Receipt sent by Email." / "Receipt sent by WhatsApp." or "could not be sent".
    - The email holds the receipt.
    - WhatsApp needs the customer's WhatsApp opt-in and an HQ route of `order.receipt_sent` (UTILITY template, variables `order_number`, `customer_name`, `total_amount`, `tracking_url`). Without them it reports "could not be sent".
    - A customer without an email gets "The customer has no address for Email."
    - Click Send twice within 30 s. **Expected:** one outbox row per channel.
12. 25 hours after step 3: the OTP outbox rows have the text `[removed]`, and the WhatsApp one has no `otp_code` in `metadata.variables`.
13. WhatsApp campaign regression (4c, QA 5.6 step 15): the outbox row's `metadata.variables` holds the campaign values, and the WhatsApp message arrives with them filled in.

### 5.8 Campaign test send after 5e (STEP5_PLAN item 6)

Needs web-admin and HQ API deployed with 5e, and `ntf.deliver` on. Your staff user (Settings → Users) has an email and a phone.

1. Notifications → Campaigns → open a **DRAFT** EMAIL campaign → **Send Test**.
   **Expected:** "Test message queued for your account", then within about 15 s "Test notification dispatched to your account". The email arrives once. In SQL: one `org_ntf_outbox_dtl` row with `source_entity_type = 'campaign_test'`, `recipient_user_id` = you, status `SENT`. The campaign's counters do not change.
2. Click **Send Test** again. **Expected:** a second, separate email (every click is a new message).
3. Repeat for an SMS campaign, and for a PUSH campaign on a browser that allowed notifications. **Expected:** as step 1. With no registered device, push shows "The test message could not be sent" (row `SKIPPED`).
4. WhatsApp campaign whose template has an ACTIVE `campaign.send` route (QA 5.6). **Expected:** the WhatsApp arrives on your staff phone with the campaign's variable values. Remove your staff phone and try again: "Your staff account has no phone number on file".
5. IN_APP campaign. **Expected:** "Test notification dispatched to your account" at once, and the bell shows it.
6. Launch the campaign, then try **Send Test**. **Expected:** refused (only DRAFT / PENDING_APPROVAL / APPROVED can be tested).
7. The old routes are gone: `POST /api/notifications/process-outbox` (and `reconcile-outbox`, `process-campaigns`, `jobs/campaign-expansion`) on the deployed web-admin. **Expected:** 404.
8. Create an order for a WhatsApp-opted-in customer. **Expected:** the order WhatsApp still arrives (sent by HQ API, not web-admin).

## Step 6 — Sweeps and delayed jobs

### 6.1 Gift card, credit note and loyalty expiry (STEP6_PLAN 6a)

Credit notes run in the database (pg_cron); gift cards and loyalty run in cmx-workers.

**Database (Owner):**

1. Apply `0823_bg_jobs_fin_expiry_sweeps.sql` on local, then remote. **Expected:** it commits. In SQL: `cron.job` has `fin-credit-note-expiry` (`5 2 * * *`, active = false); `sys_ops_job_cf` row `fin-credit-note-expiry` has kind `PG_CRON`; four `fin.gift_card_expiry.*` / `fin.loyalty_expiry.*` queues in `pgboss.queue`; two `… .daily` rows with kind `PGBOSS_SCHEDULE`; `fin-gift-card-expiry` and `fin-loyalty-points-expiry` are `SUPERSEDED`.
2. On your machine: `npm test --workspace=cmx-workers`. **Expected:** all pass, including `expiry.test.ts`.

**Release:**

3. Deploy web-admin and cmx-workers (only after step 1 on remote). **Expected:** the worker starts; its log shows no "registry sync failed".
4. HQ → Ops → Jobs: switch on "Credit note expiry"; switch on the four `fin.gift_card_expiry.*` / `fin.loyalty_expiry.*` queues, then the two `… (daily)` schedules. **Expected:** the credit note job shows active at 02:05; within about 30 seconds each schedule shows as applied (02:00, 02:10 UTC). In SQL: `SELECT name, key, cron, timezone, options->>'missed' FROM pgboss.schedule` lists the two, timezone `UTC`, missed `once`.

**Behaviour (demo Organization):**

5. **Credit note spent after its date (fix):** a customer with an active credit note whose expiry date was yesterday. New order → payment → store credit. **Expected:** the note is not offered; forcing it through the API gives "Credit note has expired". The customer's credit note list does not show it.
6. HQ → Ops → Jobs → "Credit note expiry" → **Run now**. **Expected:** SUCCESS in its run history; the note becomes **Expired**, balance 0, one EXPIRY row. Run now again: nothing new (still one EXPIRY row). A note expiring in the future is untouched.
7. A gift card whose expiry date has passed. "Gift card expiry (daily)" → **Run now**. **Expected:** "Queued…", then SUCCESS in its run history ("Sent one job to fin.gift_card_expiry.sweep"); within about 10 minutes (300 s polling, twice) the card shows **Expired** with one EXPIRE row. Run now again: still one EXPIRE row. A card expiring in the future is untouched.
8. Loyalty: an Organization with points expiry days set (for example 30), a customer whose points were earned more than that many days ago. Run "Loyalty points expiry (daily)". **Expected:** those points leave the balance once; newer points stay.
9. Switch a schedule off. **Expected:** within 30 seconds it is gone from `pgboss.schedule` and shows as off.

### 6.2 POS session rollover (STEP6_PLAN 6b)

Runs in cmx-workers every 15 minutes. Each branch's business day is read in that branch's time zone.

**Database (Owner):**

1. Apply `0824_bg_jobs_fin_pos_rollover.sql` on local, then remote. **Expected:** it commits. In SQL: `SELECT name, policy, expire_seconds FROM pgboss.queue WHERE name = 'fin.pos_rollover.sweep'` → `stately`, 900; `sys_ops_job_cf` has `fin.pos_rollover.sweep` (PGBOSS_QUEUE, off) and `fin.pos_rollover.every_15m` (PGBOSS_SCHEDULE, `*/15 * * * *`, off); `fin-pos-session-rollover` is `SUPERSEDED`.
2. On your machine: `npm test --workspace=cmx-workers`. **Expected:** all pass, including `pos-rollover.test.ts`. (It runs the real sweep, so any live local POS session from a past business day is rolled over too.)

**Release:**

3. Deploy cmx-workers (after step 1 on remote). **Expected:** the worker starts with no "registry sync failed"; HQ → Ops → Jobs shows the new queue as reported.
4. HQ → Ops → Jobs: switch on `fin.pos_rollover.sweep`, then "POS session rollover (every 15 minutes)". **Expected:** within about 30 seconds the schedule shows as applied; `SELECT name, key, cron, timezone FROM pgboss.schedule` lists it with `*/15 * * * *`, `UTC`. A "State drift" right after switching on is normal until the worker's next check: press Refresh. "Last run" only fills for Run now (scheduled ticks are not in the run history until step 7).

**Behaviour (demo Organization):**

5. POS settings: rollover mode **Pause at rollover**. Open a POS session, then in SQL move its `business_date` back one day (`UPDATE org_pos_sessions_mst SET business_date = business_date - 1 WHERE tenant_org_id = '<tenant>' AND id = '<session>'`). "POS session rollover (every 15 minutes)" → **Run now**. **Expected:** SUCCESS in its run history; within about 5 minutes the session shows **Paused** (reason rollover) with one rollover event; the operator and supervisors get the "rolled over" notification; it cannot be resumed. Run now again: nothing new.
6. Same with **Force close at rollover**, drawer session counted and closed. **Expected:** the session shows **Force closed** and its shift Z-report exists.
6a. **Force close at rollover**, but the linked cash-drawer session still holds cash. **Expected:** the session is **Paused** (not force-closed) and cannot be resumed; its rollover event metadata shows `blockedByDrawer: true`.
7. A session opened today is left alone.
8. Stale: stale limit 1 hour, a session opened more than 1 hour ago (same business day). **Expected:** flagged stale once, one notification.
8a. A session the job already rolled over (step 5) is **not** flagged stale on the next runs. **Expected:** one alert per session ("rolled over"), no later "stale" alert. In SQL: `SELECT state, output FROM pgboss.job WHERE name = 'fin.pos_rollover.sweep' ORDER BY created_on DESC LIMIT 3` → later runs show `processedCount` 0 when nothing new is due.
9. Switch the schedule off. **Expected:** within 30 seconds it is gone from `pgboss.schedule` and shows as off.

### 6.3 ERP posting retry (STEP6_PLAN 6c)

No schedule. When an accounting posting fails with a **system error**, the posting engine queues one retry a few minutes later (5 minutes after the first failure, 15 after the second, none after the third). Other errors (missing rule, missing account mapping, closed period ...) still wait for a person in the Exception Workbench.

**Database (Owner):**

1. Apply `0825_bg_jobs_fin_erp_retry.sql` on local, then remote. **Expected:** it commits. In SQL: `SELECT name, policy, retry_limit, expire_seconds FROM pgboss.queue WHERE name = 'fin.erp_post.retry'` → `standard`, 2, 300; `sys_ops_job_cf` has `fin.erp_post.retry` (PGBOSS_QUEUE, off); `fin-erp-posting-retry` is `SUPERSEDED`.
2. On your machine: `npm test --workspace=cmx-workers`. **Expected:** all pass, including `erp-retry.test.ts`.

**Release:**

3. Deploy web-admin and cmx-workers (after step 1 on remote; the engine change is in both). **Expected:** the worker starts with no "registry sync failed".
4. HQ → Ops → Jobs: switch on `fin.erp_post.retry`. **Expected:** it shows as applied within about 30 seconds.

**Behaviour (local, demo Organization with ERP-Lite on).** Block journals with `ALTER TABLE org_fin_journal_mst ADD CONSTRAINT qa_block CHECK (false) NOT VALID;` and unblock with `ALTER TABLE org_fin_journal_mst DROP CONSTRAINT qa_block;`. Count jobs with `SELECT state, start_after, output FROM pgboss.job WHERE name = 'fin.erp_post.retry' ORDER BY created_on DESC LIMIT 3`.

5. Safety. Block, then record a payment on an order. **Expected:** the payment is refused and nothing is saved (the posting runs inside the payment's transaction). **No** new `fin.erp_post.retry` job. Unblock.
6. In ERP-Lite usage mappings, switch off the cash account mapping, then record a cash payment. **Expected:** the payment is saved; the Exception Workbench shows a "Missing usage mapping" exception; **no** retry job (it needs a person).
7. Switch the mapping back on. Block. In the Workbench, press **Retry** on that exception. **Expected:** the retry fails and a new **System error** exception appears; one job is `created`, starting about 15 minutes later. Unblock.
8. Wait about 20 minutes. **Expected:** the job is `completed` with `{"outcome":"RETRIED"}`; the System error exception shows **Retried**; the payment's journal exists; the exception history shows "Retried automatically after a system error" by `system/erp-auto-retry`. The first "Missing usage mapping" exception stays open (known limit): close it in the Workbench.
9. Repeat 6–7, but ignore the System error exception before its job runs. **Expected:** the job completes with `SKIPPED_ORPHAN`, reason `EXCEPTION_IGNORED`; no journal.
10. Repeat 6–7 and keep the block on until the job has run. **Expected:** the automatic retry fails (third attempt): one more System error exception and **no** further job. Unblock.

### 6.4 File purge (STEP6_PLAN 6e)

Runs in cmx-workers every Sunday at 03:47 UTC. It deletes the stored bytes of files that were deleted (or abandoned uploads that `file-util-expire` marked deleted), then marks them purged.

**Database (Owner):**

1. Apply `0847_bg_jobs_file_purge.sql` on local, then remote. **Expected:** it commits. In SQL: `SELECT name, policy, expire_seconds FROM pgboss.queue WHERE name = 'file.purge.sweep'` → `stately`, 300; `sys_ops_job_cf` has `file.purge.sweep` (PGBOSS_QUEUE, off) and `file.purge.weekly` (PGBOSS_SCHEDULE, `47 3 * * 0`, off); `file-util-purge` is `SUPERSEDED`.
2. On your machine: `npm test --workspace=cmx-workers`. **Expected:** all pass, including `file-purge.test.ts` (37/37 on 27 Nov). If every file fails with "'react' does not provide an export named 'cache'", the react stub in `cmx-workers/build.mjs` is missing.

**Release:**

3. Deploy cmx-workers and web-admin (after step 1 on remote). **Expected:** the worker starts with no "registry sync failed".
4. HQ → Ops → Jobs: switch on `file.purge.sweep`, then "File purge (weekly)". **Expected:** within about 30 seconds the schedule shows as applied; `SELECT name, key, cron, timezone FROM pgboss.schedule` lists it with `47 3 * * 0`, `UTC`.

**Behaviour (demo Organization):**

5. Open an order, Files tab: upload a photo, then delete it. In SQL: `SELECT status_code, purged_at FROM org_file_mst WHERE tenant_org_id = '<tenant>' ORDER BY created_at DESC LIMIT 1` → `DELETED`, `purged_at` empty.
6. "File purge (weekly)" → **Run now**. **Expected:** SUCCESS in its run history; within about 5 minutes the job is `completed` with `{"purged":1,"failed":0,"nextPage":null}` (`SELECT output FROM pgboss.job WHERE name = 'file.purge.sweep' ORDER BY created_on DESC LIMIT 1`); the row has `purged_at` set; in Supabase Studio → Storage the object (and its thumbnail) is gone.
7. Run now again. **Expected:** `{"purged":0,...}`; nothing else changes.
8. HQ → File Util usage health: "deleted, not purged" is 0.
9. Switch the schedule off. **Expected:** within 30 seconds it is gone from `pgboss.schedule` and shows as off.

### 6.5 Tenant Finance jobs section removed (STEP6_PLAN 6f)

Page: tenant app → Internal finance → Outbox (`/dashboard/internal_fin/outbox`), signed in as a user who had `finance_jobs:view` / `finance_jobs:run` (for example the Organization admin).

1. Deploy web-admin with 6f. Open the page in English. **Expected:** the outbox counts, filters, event list and handler catalog show as before; there is **no** "Finance jobs" table and **no** "Scheduled jobs" button in the header.
2. Switch to Arabic. **Expected:** the same, laid out right to left, with no missing-text keys.
3. In the address bar open `/api/v1/finance/jobs`. **Expected:** 404 (the route is gone). `POST /api/v1/finance/jobs/gift_card_expiry/run` also returns 404.
4. HQ → Ops → Jobs. **Expected:** gift card, credit note and loyalty expiry, POS rollover, ERP retry and the other jobs are listed with their switches, Run now and run history: the only place to run them for every Organization (6.6 covers the per-Organization buttons).

### 6.6 Run now for one Organization (STEP6_PLAN 6g)

Sign in as the Organization admin of the demo Organization. Do each step in English, then once in Arabic (layout right to left, no missing text).

**Database (Owner):**

1. Apply `0851_bg_jobs_fin_tenant_run_now.sql` on local, then remote. **Expected:** it commits; the notice says how many users' permissions were rebuilt. **Done 27 Nov (Owner); verified on remote by Dev: new signatures, grants, permission cache of the 3 admin users.**
2. In SQL: `SELECT count(*) FROM fn_fin_gift_card_exp_due(100)` and `SELECT fn_fin_credit_note_expiry_run(NULL::uuid)` still work (nightly path). Do not run the second on remote unless you mean to expire.

**Gift cards** (Marketing → Gift cards):

3. Issue a gift card with a small balance, then in SQL set its `expiry_date` to yesterday (`UPDATE org_gift_cards_mst SET expiry_date = now() - interval '1 day' WHERE tenant_org_id = '<tenant>' AND id = '<card>'`).
4. Click **Expire due cards now** → confirm. **Expected:** "1 gift card expired."; the list shows the card as Expired; its transaction log has one EXPIRE row; ERP-Lite (when on) has one journal for it.
5. Click it again. **Expected:** "No gift cards were due."; nothing else changes.

**Credit notes** (Customers → Stored value):

6. Issue a credit note, set its `expires_at` to two days ago in SQL (with `tenant_org_id`). Click **Expire due credit notes now** → confirm. **Expected:** "1 credit note expired."; the customer's credit-note total drops; the note's ledger has one EXPIRY row. Again → "No credit notes were due."

**Loyalty** (Marketing → Loyalty), with points expiry set (for example 30 days):

7. In SQL, move one customer's earn row `created_at` back 40 days (with `tenant_org_id`). Click **Expire due points now** → confirm. **Expected:** "Points expired on 1 customer account."; that customer's available points drop. Again → "No points were due."

**ERP retry all** (ERP-Lite → Exceptions):

8. Create a System error exception as in QA 6.3 (temporary block). Remove the block. Click **Retry all system errors** → confirm. **Expected:** "1 exception retried and posted."; the exception leaves the open list; its action history shows a manual Retry by you. Other exception types (for example missing mapping) stay.

**Isolation and permissions:**

9. Sign in to another Organization with its own due card. Run step 4 in the demo Organization. **Expected:** only the demo Organization's card expires.
10. Sign in as a user without `gift_cards:expire` (for example a viewer). **Expected:** no **Expire due cards now** button. Same for the other three permissions.

## Step 8 — Old plumbing removed

### 8.1 Before 0857 (after deploying web-admin, HQ API and HQ web with step 8)

1. `POST /api/finance/process-jobs` and `POST /api/finance/jobs/gift-card-expiry` on the tenant app. **Expected:** 404.
2. B2B → statements → run dunning as a user with `b2b_statements:create`. **Expected:** works as before. The same call with only an `x-cron-secret` header and no session. **Expected:** 401.
3. HQ API starts with no "BackgroundExecution" log lines; HQ → Ops → Jobs loads.

### 8.2 Migration 0857 (Owner)

4. Apply `0857_bg_jobs_retire_old_plumbing.sql` on local, then remote. **Expected:** it commits; notice "effective permissions rebuilt for N user/tenant rows". **Done 28 Nov (Owner); steps 5–6 verified on remote by Dev.**
5. SQL on remote: `SELECT count(*) FROM sys_ops_job_cf` → 45 (was 57); `SELECT count(*) FROM sys_ops_job_cf WHERE kind = 'HQ_WORKER'` fails the kind check if you try to insert one; `SELECT to_regclass('public.sys_fin_job_run_log')` → NULL; `SELECT count(*) FROM org_ntf_outbox_dtl WHERE status = 'QUEUED' AND tenant_org_id IS NOT NULL` → only rows that have an `ntf.deliver` job.
6. Regenerate types with `scripts/dev/gen-types.ps1` (both repos) and pull Prisma. **Expected:** `types/database.ts` is not empty; web-admin `tsc` shows no new errors.

### 8.3 HQ → Ops → Jobs after 0857

7. **Expected:** no SUPERSEDED rows; the Runner filter lists Database scheduler, Queue, Queue schedule (English) and the same in Arabic; no raw `kind.*` or `completion.*` keys.
8. The "Queues" figure filters to the pg-boss queues. Run now on "File purge (weekly)" → the dialog says the worker sends the job within about 30 seconds; the run appears in its history.
9. Switch a pg-boss queue off and on. **Expected:** "Saved. Consumers pause/resume this queue within about 30 seconds."
10. HQ → File Util usage health: "Last bytes removed" says it comes from the weekly file purge job (cmx-workers), EN and AR.

## Step 7 — HQ Ops Jobs on the queue, alerts

### 7.1 Migration 0858 (Owner)

1. Apply `0858_bg_jobs_ops_queue_views.sql` on local, then remote. **Expected:** it commits.
2. SQL on remote (as postgres): `SELECT queue_name, ready, failed, dead_letters, alert_ready_age_s FROM fn_ops_queue_stats()` → 28 rows; `SELECT source_queue, error FROM fn_ops_dead_letter_list()` → the 6 dead letters with short messages (no stack); `SELECT * FROM fn_ops_worker_list()` → `cmx-workers` (not silent) and an unnamed HQ API row until 7b deploys; `SELECT * FROM fn_ops_job_alerts()` → `WORKER_SILENT hq-api` is expected until 7b deploys (HQ API's instance gets its name then), nothing else.

**Done 28 Nov (Owner); verified on remote by Dev: 28 queues, 6 dead letters, cmx-workers running, one alert `WORKER_SILENT hq-api` (expected until HQ API deploys with its instance name).**

### 7.2 Workspace (HQ → Ops → Jobs, after deploying HQ API and HQ web)

3. Open HQ → Ops → Jobs. **Expected:** one page header with Refresh; tabs Jobs, Queues, Dead letters, Workers; the Jobs tab is the familiar table (switch, schedule, Run now, history, audit). `?tab=queues` in the address opens the Queues tab directly.
4. Arabic: same tabs right to left, no raw keys (`opsJobs.…`), numbers and queue names left to right.
5. As an operator with `hq_ops:read` only: tabs visible, no Pause / Resume / Redrive / Delete buttons.

### 7.3 Queues

6. Queues tab. **Expected:** 28 rows (name, `queue.name` code, On/Paused, Ready, Running, Scheduled, Failed (kept), Oldest waiting, Alert after, Dead letters, Total kept); the line above says when pg-boss last counted. `fin.order_change_applied.order_change_confirm` shows 5 dead letters.
7. **Recent jobs** on `fin.pos_rollover.sweep`. **Expected:** the last runs, Done, with their result text (counts); no payload data.
8. Pause a quiet queue (for example `ops.smoke_test`) → confirm. **Expected:** "Paused" and "Applying…" until the worker applies it (about 30 s); the Jobs tab shows the same switch off. Resume it.

### 7.4 Dead letters

9. Dead letters tab. **Expected:** 6 rows, newest first, with the queue, retries used and a short error (`ORDER_CHANGE_APPLIED_ROW_MISSING`, a POS rollover error); no stack, no data.
10. Filter to `fin.order_change_applied.order_change_confirm` → **Delete all from this queue** → the dialog says it is permanent → confirm. **Expected:** "5 dead letters deleted"; the Queues tab shows 0 for it; HQ audit has `ops_job.dead_letter_delete` with counts only.
11. On the remaining POS rollover row: **Redrive** → confirm. **Expected:** "1 job sent again"; in Queues → `fin.pos_rollover.sweep` → Recent jobs, a new Done run appears within about 5 minutes (polling 300 s).

### 7.5 Workers and alerts

12. Workers tab. **Expected:** `cmx-workers` and `hq-api` Running, last heartbeat under a minute ago, versions pg-boss 12.39.0 / Node 22; an older unnamed row may show from before the deploy.
13. Alert test (staging or a quiet moment): suspend the cmx-workers Render service for 3 minutes. **Expected:** the banner shows "cmx-workers: no heartbeat for more than 2 minutes"; Sentry receives one event tagged `ops_alert = WORKER_SILENT` (and an email once the Sentry rule exists). Resume the service: the banner clears within about a minute; no second Sentry event until it happens again.

## Step 9 — Prove it and soak

The proof runs (each job twice, a consumer killed mid-job, a provider timeout) and the 48-hour soak, with their exact checks and pass criteria, are in [STEP9_PLAN.md](STEP9_PLAN.md) §9.1–9.4. Run them after everything is deployed and QA 6.x / 7.x / 8 pass. Day-to-day operation: [RUNBOOK.md](RUNBOOK.md).
