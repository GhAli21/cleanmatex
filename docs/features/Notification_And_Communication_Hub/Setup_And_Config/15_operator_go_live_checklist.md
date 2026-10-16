# 15 — Operator Go-Live Checklist (actions only a human can do)

**Last Updated:** 2026-10-14
**Audience:** the platform operator (not a developer). Everything here is configuration or a console action — no code changes.
**Context:** all code for the Notification Hub's pilot is built and verified (see [STATUS.md](../STATUS.md)). These are the remaining switches. Do them in this order; each step says how to confirm it worked.

Related deeper guides: [Runbook 01 accounts](../Runbooks/01_connection_verification_rotation.md) · [02 senders](../Runbooks/02_sender_registration.md) · [03 template import](../Runbooks/03_template_import_submission_approval.md) · [04 route activation](../Runbooks/04_tenant_activation.md) · [13 Twilio WABA](./13_twilio_waba_and_template_approval.md) · [14 order-created template](./14_twilio_production_order_created.md).

---

## Step 1 — Restore the disabled/drifted cron jobs (Supabase SQL Editor)

> **Prefer the screen:** HQ → Operations → **Jobs** (`/ops/jobs`). Filter "drift only", then enable/reschedule each job. The SQL below is the fallback.

**Why:** `ntf-outbox-processor` runs every 30 min instead of the tracked 1 min, and three jobs are switched off. Safe today (no active campaigns/push subscriptions).

Run in the Supabase SQL Editor (**remote**, then local if you use it):

```sql
SELECT cron.alter_job(7, schedule => '* * * * *');  -- ntf-outbox-processor back to every minute
SELECT cron.alter_job(5, active => true);           -- ntf-outbox-retry
SELECT cron.alter_job(6, active => true);           -- ntf-sweep-stale-push-subs
SELECT cron.alter_job(8, active => true);           -- ntf-campaign-scheduler
```

Job ids can differ per database — confirm first with `SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ntf-%';` and use the ids you see.

**Confirm:** the same SELECT shows `ntf-outbox-processor` = `* * * * *`, all active. Also expected and already active: `ntf-reconcile-outbox` (`*/5`) and `ntf-retention-sweep` (`0 4 * * *`).

---

## Step 2 — Set the HQ-side secrets for the route-based WhatsApp cutover (deployment env vars)

The route-aware HQ endpoint sends through Twilio using **platform** credentials injected as environment variables on **platform-api** (HQ), never stored in the database:

| Where | Variable | Value |
|---|---|---|
| platform-api (HQ) | `HQ_TWILIO_ACCOUNT_SID` | Twilio Account SID (`AC…`) |
| platform-api (HQ) | `HQ_TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| platform-api (HQ) | `NTF_TWILIO_CONTENT_CREDENTIAL_REF` | any stable label you choose, e.g. `twilio-prod-main` |
| platform-api (HQ) | `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` | optional; if set it must equal the account row's `credential_version` |
| platform-api (HQ) | `HQ_TWILIO_WHATSAPP_FROM` | fallback sender (`whatsapp:+…`) used when the route's sender row has no address |
| web-admin (tenant) | `NTF_HQ_ROUTE_DISPATCH_URL` | `https://<your-platform-api-host>/api/hq/v1/notifications/dispatch/route` (default is localhost) |

Already set earlier (generic proxy): web-admin `NTF_HQ_SERVICE_ROLE_KEY` = HQ `HQ_SERVICE_ROLE_KEY` (must match exactly), and `NTF_HQ_DISPATCH_URL`. The route endpoint reuses the same shared secret.

Redeploy both apps after changing env vars.

---

## Step 3 — Create and verify a Twilio account in HQ (HQ web UI)

Prerequisite (outside CleanMateX): a Twilio WhatsApp sender and an **approved** WhatsApp Content template (Content SID `HX…`). See [13](./13_twilio_waba_and_template_approval.md) and [14](./14_twilio_production_order_created.md). The sandbox template you showed earlier counts for testing.

In **HQ platform-web → Notifications → Providers → "Manage connections"**:
1. Create a platform account: provider `TWILIO_WHATSAPP` (the catalog code in `sys_ntf_providers_cd`; the legacy family code `TWILIO` is not in the catalog and fails the foreign key), channel `WHATSAPP`, `account_key` = a unique label (e.g. `twilio-whatsapp-prod`), `external_account_id` = your Account SID, `credential_ref` = exactly the `NTF_TWILIO_CONTENT_CREDENTIAL_REF` from Step 2, `credential_version` = e.g. `v1` (must equal `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` when that is set).
2. Click **Verify**. It calls Twilio live; success sets `VERIFIED`.
3. Add a sender under the same dialog (channel `WHATSAPP`, Provider sender ID `+E164`, Sender address `whatsapp:+E164`), then click **Verify live** on the sender (needs the account `VERIFIED`; the sender must be ONLINE in Twilio). Field-by-field detail and troubleshooting: [NTF_Create_Platform_Connections_And_Sender_Guide](./NTF_Create_Platform_Connections_And_Sender_Guide.md).

**Confirm:** the account shows `VERIFIED`. (API equivalents are in Runbooks 01–02.)

---

## Step 4 — Import the template and map its variables (HQ web UI)

In **HQ → Notifications → Providers** (Twilio import form):
0. **No seeding needed:** the import form asks for the **HQ template** and the **language** (EN/AR); HQ creates the template's WhatsApp locale and variables on first import. See the "Import a Twilio template" section of [NTF_Create_Platform_Connections_And_Sender_Guide](./NTF_Create_Platform_Connections_And_Sender_Guide.md).
1. Pick the verified account, the HQ template (e.g. `order.created.default`), the language (`EN`), sender, and paste the Content SID. Submit — HQ fetches the template and approval status from Twilio server-side.
2. Open the new revision → **Bindings**: map each ordered Twilio slot (`{{1}}`, `{{2}}`…) to the matching logical variable (e.g. `order_number`, `estimated_ready_at`). **This can be done once per revision** — to correct it, import/refresh a new revision.

**Confirm:** the revision shows complete bindings. Detail: [Runbook 03](../Runbooks/03_template_import_submission_approval.md).

---

## Step 5 — Create and activate the route for the demo tenant (HQ web UI)

In **HQ → Notifications → Tenant Configuration**, find tenant **Demo Laundry LLC** (`11111111-1111-1111-1111-111111111111`) → click the **"…"** button in the last (Action) column of any of that tenant's rows (scroll the table right if it is cut off) → **Routes**:
1. Click **Add route**, keep owner **Platform**, and pick the **Approved template** from the list (for the demo: `order.created · WHATSAPP · en — order_created_v4`). Only approved templates are listed. The event, channel, language and account are filled in from that template and cannot be typed, so they cannot be wrong. The sender is filled in when the template is tied to one; otherwise leave "Any compatible sender". The revision is chosen automatically and shows the status Twilio reported at import (`Revision 1 · APPROVED`). Click **Save**: the route is saved as **DRAFT** (no live effect).
   Activation re-checks everything on the server: account verified, template last observed as approved (no time limit unless you set an "Approval valid until" date on it in the Routes dialog; re-verify in Providers if Twilio changed its status), and the event/channel/language matching the template.
2. Click **Activate**.

**What changes live:** from this moment, `order.created` WhatsApp messages for **that tenant and language only** go through HQ's route-aware path instead of direct Twilio. Every other tenant/event/language is untouched. Customers with no `preferred_language` fall back to the tenant language, then `en` — so activate the language(s) you need.

**Undo anytime:** Routes dialog → **Suspend** (instantly returns that tenant to the legacy path). A suspended route shows **Resume** (it re-checks everything, like Activate). Each route in the list shows its template, revision, account, sender, dates and the optional **Approval valid until** date, which you can set or remove there. A DRAFT route can be edited; to change an active route, Suspend or Retire it and add a new one.

**Confirm:** create a test order for a demo customer whose phone has opted in to WhatsApp (customer card → "Customer WhatsApp notifications"; you can also set "Notification language" there). Then check:

```sql
SELECT idempotency_key, status, provider_code, provider_message_id, dispatched_at
FROM hq_ntf_dispatch_log
WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'
ORDER BY created_at DESC LIMIT 5;
```
A `SENT` row with a real Twilio SID = the route-based path worked. Record it as pilot evidence in STATUS.md.

---

## Step 6 — WhatsApp test through the generic proxy (optional, independent of routes)

> **Prefer the screen:** HQ → Operations → **Operations** → `ntf.pilot_test_message` (shows this exact SQL, takes the tenant and recipient as parameters, runs it with bound values). The raw SQL below is kept for copy-and-run use, **corrected 2026-10-14**: `org_ntf_outbox_dtl.idempotency_key` is NOT NULL with no default, so the original snippet (which omitted it) would have failed.

Same method as the SMS test. In the SQL Editor (note the fixed `scheduled_at` — the column is timezone-naive; a `now()` default under +04 would look "in the future" to the processor):

```sql
INSERT INTO org_ntf_outbox_dtl
  (tenant_org_id, channel_code, recipient_address, rendered_body, event_code, max_retries,
   scheduled_at, status, source_entity_type, metadata, idempotency_key)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'WHATSAPP', '+96877182624', 'CleanMateX A1 pilot test (WhatsApp)',
   'pilot.test', 1, '2000-01-01 00:00:00', 'QUEUED', 'A1_PILOT_TEST', '{"a1_pilot_test": true}',
   'a1-pilot-' || gen_random_uuid()::text)
RETURNING id;

SELECT public.ntf_trigger_outbox_proc();   -- or wait for the 1-min cron after Step 1
```
Then `SELECT id,status,provider_message_id,error_message,sent_at FROM org_ntf_outbox_dtl WHERE id = '<returned id>';` and check `hq_ntf_dispatch_log` for the same id as `idempotency_key`. The recipient must have joined your Twilio WhatsApp sandbox. Use an event code other than `order.created` so it cannot be routed by an active route.

---

## Step 7 — Email bounce/complaint webhook (Resend dashboard + env)

1. **Resend dashboard → Webhooks → Add endpoint** → URL: `https://<your-web-admin-host>/api/notifications/webhooks/resend`; events: `email.bounced`, `email.complained`.
2. Copy the **Signing secret** (`whsec_…`) Resend shows.
3. Set web-admin env `RESEND_WEBHOOK_SECRET` = that value and redeploy. Until set, the endpoint rejects every callback with 401 (by design).

**Confirm:** use Resend's "Send test event"; expect HTTP 200. Real bounces then appear in `org_ntf_suppression_lst`.

---

## Step 7b — SMS STOP replies (Twilio console)

1. **Twilio console → Phone Numbers → your SMS sender → Messaging configuration → "A message comes in"** → Webhook, HTTP POST, URL = the same value as `HQ_TWILIO_WEBHOOK_URL` (the HQ `/notifications/webhooks/twilio` callback).
2. Reply `STOP` from a test phone that previously received a notification.

**Confirm:** HQ Setup Health shows `A Twilio inbound SMS reply has been received` = OK, and the number appears in `org_ntf_suppression_lst` (`reason_code = CARRIER_OPT_OUT`, `source = TWILIO_INBOUND_SMS`) for the tenant(s) that messaged it. Reply `START` to lift it.

---
## Step 8 — Commit the uncommitted work (your git, both repos)

CleanMateX does not commit on your behalf. Review `git status` in:
- `cleanmatexsaas`: the new `dispatch/route-dispatch.*` files and test changes.
- `cleanmatex`: the customer preferred-language UI/service files, new tests, docs.

---

## Not on this list (Claude is building these — no operator action)

Soft-bounce thresholds, SMS inbound STOP opt-out, Meta WhatsApp message-id capture, sender live verification, quota reservation (A3), generic preview/test-send API (A4b), health/failover tooling (A6), canonical builder (A7), second-provider connectors (A8). All are in scope as of 2026-10-14 — see [RESUME_CONTINUATION.md](../RESUME_CONTINUATION.md) and [plan §23.1](../notification-hub-production-implementation-plan.md). Runbook drills with named owners (C2) remain a people task.
