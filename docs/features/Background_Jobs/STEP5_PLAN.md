# Step 5 — Notifications on pg-boss: implementation plan

Status (23 Nov): 0810 applied local + remote. **5b done in code:** tenant producer (`lib/notifications/request.service.ts`, `event-emitter.ts`), cmx-workers `ntf.orchestrate`, payloads in `@cmx/jobs`, tests 19/19. **5c done in code:** HQ API `queue-consumer` module (`ntf.deliver`, `ntf.reconcile`), BullMQ queue removed, per-attempt idempotency key, Resend `Idempotency-Key`. **`ntf.status_apply` done in code:** the webhook verifies, stores the event and queues `{ eventId }` (job id = event id), or answers 503 so the provider retries; the job applies STOP/START (`fn_ntf_carrier_opt_apply`) or a receipt (dispatch log + `fn_ntf_status_apply` from migration 0812: SENT → DELIVERED → READ, SENT → FAILED_PERMANENT on a bounce, receipt in `org_ntf_receipts_tr`). 0812 waits for the Owner. **5d push done in code (24 Nov):** HQ code item 8 below; 0816 waits for the Owner. 4 and 4b done in code. **4c done in code (24 Nov), 0819 applied local + remote.** **5d OTP / receipts: done in code (24 Nov), 0820 applied; 0820 + 0822 applied.** Then 5e deletions. Design: [DESIGN.md](DESIGN.md) §7, §14.5, §15, §16.

## What 0810 adds

| Object | Purpose |
|---|---|
| Queues `ntf.orchestrate`, `ntf.campaign_start`, `ntf.campaign_chunk` (consumer `CMX_WORKERS`) | Tenant-code work: turn a request into in-app and outbox rows; expand campaigns. |
| Queues `ntf.deliver`, `ntf.reconcile`, `ntf.status_apply` (consumer `HQ_API`) | Provider calls stay in HQ API's one copy of each provider (§14.5). |
| Registry and queue detail rows for the six | Start **paused**, so the step 4 worker does not alert on handlers that are not shipped yet. The step 5 release switches them on in HQ → Ops → Jobs. |
| `org_ntf_requests_tr` | One notification request per row. A job may carry ids only, so the event code, recipients and template variables live here; `ntf.orchestrate` gets `{ tenantOrgId, requestId }`. Server-only (RLS on, no policy, no `anon`/`authenticated` grants). |
| `fn_ntf_worker_claim_one(tenant, outboxId, claimToken, workerId, leaseSeconds)` | Claims one outbox row for one `ntf.deliver` job; the claim token is the pg-boss job id. Outcomes: `CLAIMED`, `OWN_CLAIM` (a retry of the same job: the earlier attempt may have reached the provider, so mark uncertain and reconcile, never resend), `NOT_DUE`, `NOT_CLAIMABLE`, `NOT_FOUND`. |

Dry run in a rolled-back transaction on local Postgres (23 Nov): all objects created; each claim outcome checked; no `anon`/`authenticated` grants on the request table.

## Tenant code (this repo)

1. **`@cmx/jobs`** — payload schemas: `ntf.orchestrate { tenantOrgId, requestId }`, `ntf.deliver { tenantOrgId, outboxId }`, `ntf.campaign_start { tenantOrgId, campaignId }`, `ntf.campaign_chunk { tenantOrgId, campaignId, chunk }`. Job id rules: orchestrate = request id; deliver = a new id per send attempt chain (the claim token).
2. **Producer** — `emitNotificationEvent(event)` becomes `requestNotificationTx(tx, event)`: insert `org_ntf_requests_tr` and `jobs.enqueue(tx, 'ntf.orchestrate', …, { id: requestId })` in the caller's transaction. The four callers today (submit order, order transition, POS rollover, stored value) move into their business transactions; the `after()` hooks from step 0 go away.
3. **`ntf.orchestrate` reaction** — web-admin service `runNotificationRequest(tenantOrgId, requestId)`: load the request (tenant-filtered), call the existing orchestrator, and for each outbox row it inserts, enqueue `ntf.deliver` with `startAfter = scheduled_at` (quiet hours) in the same transaction; mark the request `PROCESSED` with counts. The outbox idempotency key already makes a re-run write no second row; in-app rows need the same check (verify `deliverInApp`). cmx-workers handler in `src/handlers/ntf-orchestrate.ts`, last attempt marks the request `FAILED`.
4. **Campaigns** (done in code 24 Nov: `lib/notifications/campaign-jobs.service.ts`, cmx-workers `handlers/ntf-campaign.ts`, status route queues the start in its transaction; integration test 4/4) — extract the expansion in `app/api/notifications/process-campaigns/route.ts` into a service; `ntf.campaign_start` at the approved send time chunks targets into `ntf.campaign_chunk` jobs of 50; outbox rows and their `ntf.deliver` jobs use a low priority (−10) so receipts and OTP go first.
4b. **Campaigns to customers** (Owner agreed 24 Nov; fixes F32). **Done in code 24 Nov** (0818 applied local + remote; cmx-workers campaigns test 7/7; HQ Jest 16/16). Decisions taken while building: the audience is fixed at the first start (a resume never adds customers who agreed later); customers are added one at a time in the form with the shared list-of-values dialog (no multi-select component); SMS needs a phone that parses to E.164, otherwise `NO_RECIPIENT_ADDRESS`; an inactive customer is `CUSTOMER_INACTIVE`; marketing consent is recorded by staff on the customer Preferences tab (`consent_source = STAFF`); the order-update opt-out in `preferences.notifications` does not affect marketing. Not built: an audience column in the campaign list. Original scope:
   - `org_ntf_campaigns_mst.audience_code`: `STAFF` (target_segment `user_ids`; IN_APP, PUSH, EMAIL) or `CUSTOMERS` (target_segment `customer_ids`, or `all_consented: true`; EMAIL, SMS, WHATSAPP). A CHECK keeps each audience to its channels.
   - `org_ntf_cust_consent_dtl`: one row per customer and channel (EMAIL, SMS, WHATSAPP; WhatsApp marketing consent is separate from the order-update opt-in) with `marketing_consent`, given/withdrawn times and source. No row = no consent.
   - `org_ntf_camp_targets_dtl.recipient_customer_id` (composite FK to the customer; exactly one of user/customer; unique per campaign).
   - `ntf-campaign-scheduler` (old HQ worker → tenant HTTP route) becomes SUPERSEDED by `ntf.campaign_start`, so it can never be switched on next to the queues.
   - Code after apply (Prisma pull first): `startCampaign` builds customer targets (address = customer email / phone at that moment; customers without consent or address are SKIPPED); `runCampaignChunk` reads consent from the new table; create route + form: audience picker, customer picker or "all customers who agreed", channel list per audience; customer screen: marketing consent switches per channel (EMAIL, SMS, WHATSAPP) next to the WhatsApp card; HQ `CustomerDispatchConsentService`: for `source_entity_type = 'campaign'` re-read the target's customer consent just before sending.
   - Until 4c ships, the create route refuses CUSTOMERS + WHATSAPP with a clear message (the schema already allows it).
4c. **WhatsApp campaigns to customers. Done in code 24 Nov (0819 applied local + remote; see "Built" below).** Meta allows marketing on WhatsApp only through an approved template in the MARKETING category, never free text, and only to customers who agreed to WhatsApp marketing. HQ sends WhatsApp today through a route per event (`org_ntf_route_assign_cf` → approved template revision, variables from outbox metadata) and only for order sources. Work:
   - the campaign picks one of the Organization's approved WhatsApp marketing templates and fills its variables (no free-text body for WhatsApp);
   - HQ `WhatsAppCustomerEligibilityService` accepts `source_entity_type = 'campaign'`: customer from the campaign target, consent from `org_ntf_cust_consent_dtl` (channel WHATSAPP), phone from the customer;
   - HQ route resolution uses the campaign's chosen template instead of the per-event route;
   - check first whether the template tables need a column for the campaign's template (likely a small migration).

   **Checked 24 Nov — yes, migration `0819_ntf_campaign_wa_template.sql` (dry-run passed; applied local + remote by the Owner 24 Nov).** What we found: the campaign already has `template_code` (FK to `sys_ntf_templates_mst`); a logical template belongs to one event; HQ sends WhatsApp through `org_ntf_route_assign_cf`, one ACTIVE route per (tenant, event, channel, language) pinning account + sender + approved provider revision; every campaign row uses the event `campaign.send` (MARKETING, not transactional, no template yet). So with routes as they were, a tenant could hold only one marketing template per language. Remote today: one platform registration (UTILITY), one route (`order.created`), no campaigns.

   **Design (decided):** reuse the route system, keyed also by template for `campaign.send`.
   - **0819:** `org_ntf_route_assign_cf.template_code` (FK to the template catalog; set exactly for `campaign.send` routes, CHECK); route scope key becomes `UNIQUE NULLS NOT DISTINCT (tenant, event, channel, language, template_code)`, so event routes stay one per event/channel/language; `org_ntf_campaigns_mst.template_vars` JSONB object (variable values by `variable_key`); CHECK: a WhatsApp campaign names a `template_code`.
   - **HQ route admin** (`notification-routes` DTO/service, `platform-web` `tenant-routes-dialog.tsx`): `template_code` on create/update (template picker shown for `campaign.send`); activation also checks that the provider registration's template is the route's `template_code` and that its `category_code` is `MARKETING` for `campaign.send` routes (fail-closed).
   - **HQ send path:** `WhatsAppCustomerEligibilityService` accepts `campaign` (by outbox id → target → customer; consent = `org_ntf_cust_consent_dtl` WHATSAPP `marketing_consent`; phone from the customer; staff target blocked). `WhatsAppRouteResolutionService` for `campaign`: language from the target customer, route filtered by `event_code = 'campaign.send'` and `template_code` = the campaign's (read tenant-filtered). `RouteDispatchService` is unchanged (it revalidates the pinned identity and fills slots from outbox metadata).
   - **Tenant:** `GET /api/v1/notifications/campaigns/whatsapp-templates` lists `campaign.send` templates with an ACTIVE WhatsApp route for the tenant (languages per template) and the approved version's variables; create route requires one of them + every required variable and stores `template_vars`; `CAMPAIGN_CUSTOMER_CHANNELS_LIVE` gains WHATSAPP; worker writes outbox `metadata = template_vars` and renders the display body from the template; form: template picker + variable inputs when Customers + WhatsApp (EN/AR, `check:ui`).
   - Not built: per-language fallback (a customer whose language has no route for the template is blocked "No active WhatsApp route", as for order events today); per-customer variables (cut 24 Nov: every recipient gets the campaign's values; add a worker-filled `customer_name` only if a real template needs it).

   **Built (24 Nov).** HQ `platform-api`: route DTO/service take `template_code` (required exactly for `campaign.send`, 409 otherwise); activation refuses a `campaign.send` route whose registration is not `MARKETING` or belongs to another template; the registration list exposes `template_code`; `WhatsAppCustomerEligibilityService` campaign branch (outbox → target → active customer → WHATSAPP marketing consent → E.164 phone; staff target blocked; lookup errors retryable); `WhatsAppRouteResolutionService` takes the allowed customer id (language from that customer, so the order → customer lookup is gone) and filters `template_code` (the campaign's for `campaign`, NULL otherwise). HQ `platform-web` route dialog sends `template_code` from the chosen registration and shows it on the route. Tenant: `lib/notifications/campaign-wa-templates.service.ts` (list from ACTIVE routes → revision → registration → locale → template version → variables; check of a choice), `GET /api/v1/notifications/campaigns/whatsapp-templates`, create route requires a usable template + required values for WHATSAPP (422 `CAMPAIGN_TEMPLATE_NOT_AVAILABLE` / `CAMPAIGN_TEMPLATE_VARS_MISSING`) and stores only the template's own keys in `template_vars`; worker puts `template_vars` in the render variables and the outbox metadata; form shows the template picker and its variable fields for Customers + WhatsApp (EN/AR). Removed: `CAMPAIGN_CUSTOMER_CHANNELS_LIVE`, the 422 `CAMPAIGN_CHANNEL_NOT_AVAILABLE`, the worker's `UNSUPPORTED` start outcome.

   **Deferred by the Owner (24 Nov): one marketing template for many Organizations** — options, recommendation and open questions in [CAMPAIGN_IN_HQ_SHARED_TEMPLATES.md](CAMPAIGN_IN_HQ_SHARED_TEMPLATES.md).
5. **Immediate sends (§16)** — receipt send/resend and OTP write the outbox row and enqueue `ntf.deliver` at the highest priority in one transaction; return `202` with the outbox id. New tenant route `GET /api/v1/notifications/outbox/[id]/status` (tenant-filtered, status and failure reason only). Server-side dedupe key `receipt:<id>:<channel>` with `singletonKey` + `singletonSeconds: 30`. OTP: real code generation (replaces the fixed test code), per-phone and per-IP limits, allowed countries, `retryLimit: 2`, skip when expired, 24 h retention of OTP rows. Screens poll the status for up to 15 s and report through `cmxMessage` (EN/AR, `check:ui`).

   **Done in code 24 Nov, not committed.** 0820 applied local + remote by the Owner. **0822 (`0822_ntf_otp_channels.sql`) applied local + remote by the Owner (24 Nov)** (0820 left `sys_otp_codes.code` as VARCHAR(6), too short for the hash). See "Built" below.

   **What was found (24 Nov):**
   - `sendOTP` stores the fixed code `123456` and sends nothing. The code is stored in plain text. `verifyOTP` reads, then writes, the attempt count, so parallel guesses can exceed the 3-attempt limit. `RESEND_COOLDOWN_SECONDS` exists but is never checked.
   - **Security (launch blocker):** the customer "verification token" (`generateVerificationToken`) is plain base64 JSON `{phone, exp}` with no signature. The public customer routes (`/api/v1/public/customer/session`, `orders`, `addresses`, `booking`, `password`, financial view) accept it as a bearer token, so anyone can forge one for any phone number and act as that customer.
   - Callers: send-otp from the staff dashboard only (`upgrade-profile-modal.tsx`); verify from `customers` POST and `customers/[id]/upgrade`. The send route is behind the staff session (not in `PUBLIC_ROUTES`) but never reads the tenant.
   - Receipts call the WhatsApp client (free text and image) and the email sender directly. Remote has 0 receipts. `org_rcpt_receipts_mst` keeps one channel and one status per row. `receipts/[id]/resend` reads `params` without `await`.
   - No event existed for either message. HQ sends SMS and email from `rendered_body`, and WhatsApp only through a route per event (order source → customer opt-in → approved template).

   **Design (decided 24 Nov):**
   - **0820:** `sys_otp_codes.request_ip` plus a per-IP index. The `code` column holds an HMAC. Events `customer.otp_generated` (CUSTOMER, URGENT, SMS) and `order.receipt_sent` (ORDER, HIGH, EMAIL + WHATSAPP), each with an approved EN/AR template. `fn_ntf_short_retention_run`, run by the hourly pg_cron job `ntf-short-retention` (registered in `sys_ops_job_cf`), does three things, each capped at 5000 rows per tick:
     - deletes OTP rows 24 h after they expire;
     - replaces the code text in OTP outbox rows older than 24 h with `[removed]`;
     - clears `request_data` of requests PROCESSED more than 30 days ago. FAILED requests keep their data while the dead letter can be redriven.
   - **OTP send:**
     - The route reads the staff session and tenant.
     - The phone must parse with `normalizePhoneInput` and be in one of the six GCC countries (`OTP_ALLOWED_COUNTRIES`).
     - Limits: per phone, a 60 s cooldown and at most 5 per hour; per IP, at most 30 per hour. Windows are counted on `expires_at`, which is UTC; `created_at` is database-local time.
     - The code comes from `crypto.randomInt`, 6 digits. The stored value is HMAC-SHA256 of `phone:code` with the new env `OTP_HMAC_SECRET`, failing closed when it is missing.
     - The SMS text comes from the template, in the customer's language when the customer is known, otherwise the tenant's.
     - One transaction writes the OTP row, the outbox row and the `ntf.deliver` job:
       - outbox row: SMS, source `otp` / the OTP row id, idempotency key `otp:<id>`, `max_retries` 2, metadata `expires_at`;
       - `ntf.deliver` job: id = outbox id, priority 20, above every other send.
     - It returns `202 {outboxId, expiresAt, phone (masked)}`.
   - **OTP verify:** `timingSafeEqual` on the HMAC. The attempt counter is a conditional update (`attempts = n` → `n+1`), so parallel guesses cannot pass 3.
   - **Verification token:** signed with HMAC (same secret, `v1.<payload>.<sig>`). Old unsigned tokens stop working. That is intended, since they were forgeable.
   - **HQ API:** an outbox row whose metadata `expires_at` has passed is not sent (`POLICY_BLOCKED`, not retried), so a late OTP is dropped.
   - **Receipts:** for each channel, one transaction writes an outbox row and its `ntf.deliver` job (priority 15):
     - EMAIL: the receipt HTML, with the subject from the template.
     - WHATSAPP: source = the order, so HQ checks the customer's opt-in and uses an HQ route of `order.receipt_sent`. Metadata carries `order_number`, `customer_name`, `total_amount`, `tracking_url`. The QR image is not sent: a template sends text only.
     - Dedupe: an advisory lock on `receipt:<id>:<channel>`, plus "a row for this receipt and channel scheduled in the last 30 s" returns that row instead of a new one.
     - `app` stays as it is.
     - The send and resend routes return `202` with the outbox ids. Resend awaits `params` and stops calling the provider.
   - **Status:** `GET /api/v1/notifications/outbox/[id]/status` (staff session, tenant-filtered) returns `{status, skipReason}` only, never provider errors.
   - **Screens:** the upgrade modal and the receipt preview poll for up to 15 s and report sent / failed / still sending through `cmxMessage` (EN/AR).
   - **Changed by the Owner (24 Nov): a code can go by SMS, WhatsApp or email**, and the staff member chooses. The code still verifies the customer's phone: both verify flows check the phone. An email code proves the email inbox, not the phone. The allowed-country rule applies to SMS and WhatsApp only. WhatsApp goes through an HQ route of `customer.otp_generated`, which HQ activates only with a Meta AUTHENTICATION template. The code travels in `metadata.variables.otp_code` (with `tenant_name` and `expires_minutes`, so any of the three can be bound); HQ's WhatsApp eligibility reads the OTP row (unverified and unexpired), and there is no opt-in because the person asked for the code. The route uses the tenant's language.
   - Not built: a public OTP route for the customer app (none exists today), a per-tenant OTP cap, the customer's language for WhatsApp OTP (HQ picks the route by the tenant's language).

   **Built (24 Nov):**
   - **Migration 0822:**
     - `sys_otp_codes.code` becomes TEXT;
     - `customer.otp_generated` gains the WHATSAPP and EMAIL channels and their template rows;
     - the purge also removes `metadata.variables.otp_code`.
   - Dry-run (local, rolled back):
     - `code` takes a 64-character value;
     - the event has three channels and three template rows;
     - an old WhatsApp OTP row loses its text and `otp_code` but keeps other values.
   - **web-admin:**
     - `lib/constants/otp.ts` (channels, GCC countries, limits, error codes);
     - `lib/notifications/immediate-send.service.ts` (`queueImmediateSendTx`: outbox row + `ntf.deliver` job in the caller's transaction; priority OTP 20, receipt 15);
     - `lib/services/otp.service.ts` rewritten (signed token, HMAC code, limits under an advisory lock, template text in the customer's or the tenant's language, attempt counted before the compare; unused `cleanupExpiredOTPs` / `invalidatePhoneOTPs` removed; the hourly purge replaces them);
     - `app/api/v1/customers/send-otp/route.ts` (staff session, Zod, `202` or `{error, code}`);
     - `app/api/v1/notifications/outbox/[id]/status/route.ts` (new);
     - `lib/services/receipt-service.ts`: email and WhatsApp through the outbox, the 30 s dedupe by order and channel, the direct WhatsApp / email senders removed;
     - receipt send and resend routes: `202` with `sends`, `params` awaited, the resend counter now tenant-filtered;
     - `src/features/notifications/api/outbox-status-api.ts` + `hooks/use-outbox-delivery-report.ts` (polls 15 s, reports through `cmxMessage`);
     - `upgrade-profile-modal.tsx` (channel choice, email field, coded errors, delivery report);
     - `receipt-preview.tsx` + `use-receipts.ts` (report per channel);
     - EN/AR keys under `customers.otp.*` and `receipts.messages.*`.
   - **4c bug fixed here:**
     - HQ fills WhatsApp template slots from `metadata.variables`, but campaign rows stored the values at the top of metadata, so campaign WhatsApp messages would have gone out with empty slots;
     - `campaign-jobs.service.ts` now writes `metadata.variables`, and the cmx-workers test checks it.
   - **HQ API:**
     - `isExpired` in `outbox-delivery.service.ts`: a row whose `metadata.expires_at` has passed is dropped, not retried;
     - WhatsApp eligibility: `otp` source branch;
     - route resolution: a null customer uses the tenant's language;
     - route activation requires AUTHENTICATION for `customer.otp_generated`.
     - Twilio import (`twilio-content-importer.service.ts`): a `whatsapp/authentication` template gets its code slot `1`. It has no text, so placeholder scanning found no slot and the code could not be bound (spec added; provider-templates 56/56).
   - **Tests:**
     - web-admin `__tests__/lib/services/otp.service.test.ts` 7/7 (token round trip, forged and unsigned tokens refused, missing secret fails closed, hash, SMS/WhatsApp/email sends, country / email / phone refusals, cooldown and hourly limits);
     - the auth-guard test no longer exempts `send-otp`;
     - HQ routes + outbox-policy + outbox-delivery 53/53 (new: AUTHENTICATION route, OTP eligibility, `isExpired`).
   - **New env:** `OTP_HMAC_SECRET` on web-admin (32+ characters). Without it, send, verify and every customer-token route fail closed.
   **Owner question (24 Nov): two WhatsApp messages after an order is created.** Today it is one per event: one route per tenant/event/channel/language (`uq_ntf_route_scope`; `template_code` only for `campaign.send`), and one outbox row per event/channel/source/recipient (idempotency key). Options:
   - (A) one message with everything (`order_confirmation_with_track_link`). Recommended: WhatsApp bills per message, and two in a row raises block/report risk to the number's quality rating.
   - (B) a second event (e.g. `order.tracking_link`) with its own template and route; submit-order emits both. Small migration + code.
   - (C) several templates per event. Not recommended: routes, idempotency, HQ resolution and the CHECK all change.
   
   Waiting for the Owner; build B only if asked.
6. (Done early, 24 Nov: the inline WhatsApp send in `adapters/outbox.ts` and its switch `ntf.app.outbox_inline_dispatch`, because it ran in cmx-workers and failed every WhatsApp order message.) **Delete** the tenant provider adapters that call providers directly, `lib/integrations/whatsapp-client.ts`, and the `app/api/notifications/process-outbox` / `reconcile-outbox` / `process-campaigns` / `jobs/campaign-expansion` routes once their callers are gone (step 8 drops the SQL).
7. **Tests** — cmx-workers integration: request → orchestrate → outbox row + deliver job; re-run writes nothing; campaign chunking; tenant isolation. web-admin Jest for the producer, OTP limits and the status route.

## HQ code (`cleanmatexsaas/platform-api`)

1. pg-boss consumer module (about 30 lines of `work()` registration, `migrate: false`, pool from the session pooler, registry loop for pause/resume and `applied_*`, same rules as cmx-workers).
2. `ntf.deliver` handler: `fn_ntf_worker_claim_one` → recheck policy (consent, suppression, quota) → `OutboxDeliveryService.execute` → `fn_ntf_worker_finalize_claim`; timeout or unknown outcome → `fn_ntf_worker_mark_uncertain` + `ntf.reconcile` with `startAfter` 2 min; `NOT_DUE` → re-send with `startAfter`; provider rate limit → re-send with `startAfter` and complete.
3. `ntf.reconcile`: provider lookup → `fn_ntf_worker_reconcile_claim`; proven not sent → one resend; unknown after the last attempt → dead letter + Sentry.
4. Webhooks: verify signature, store the raw event, enqueue `ntf.status_apply`, return 200.
5. `Idempotency-Key` on Resend sends (the outbox id).
6. Delete `DispatchQueueService`, `ntf.hq.queue_enabled` and `NTF_QUEUE_ENABLED` (§15.1 trap).
7. HQ API must run in the database's region first (S-D6).
8. **Push (5d, added 24 Nov).** One outbox row per user; HQ fans out to the user's active devices in `org_ntf_push_subs_dtl`. Today it cannot work: FCM uses the legacy API Google retired in 2024 (`fcm/send` + server key), VAPID is a stub, the provider answers SENT with no device or with every device failing, and a retry would resend to devices that already got it. Fix: (a) FCM HTTP v1 with the service account (shared registry keys `ntf.app.fcm.service_account` / `ntf.app.fcm.project_id`; retire `ntf.hq.fcm.server_key`); (b) VAPID with `web-push`, using the same `ntf.app.vapid.*` key pair the browser subscribed with; (c) honest results: at least one device reached → SENT; none reached and some failed temporarily or push is not configured → FAILED (retry is safe, nothing was delivered); every device rejected → PERMANENT_FAILURE; (d) a user with no active device → the outbox row is SKIPPED before dispatch (no quota, no provider call); (e) failed devices are counted on their subscription (tenant-filtered), 3 failures or a permanent rejection deactivates it, a success resets the count; partial sends are never retried. Registry metadata migration adds HQ_API to the shared keys. Open: no screen registers a device yet (remote has 0 subscriptions), so push reaches nobody until web-admin and the apps register devices (separate task).

## Release order

1. Owner applies 0810 (local, then remote).
2. Ship tenant and HQ code together; switch the six queues on in HQ → Ops → Jobs.
3. Prove on demo tenants: each message once, including after a forced timeout and a killed consumer (§10.2 step 5 "done when").

## Findings while writing 0810

- **F15 — batch claims release scheduled rows 4 hours early.** The database time zone is `Asia/Muscat`; `org_ntf_outbox_dtl.scheduled_at` is a timestamp without time zone holding UTC (the app writes UTC ISO strings). The batch claims compare `scheduled_at <= now()`, which reads it as local time, so a quiet-hours delay ends 4 hours early. `fn_ntf_worker_claim_one` compares in UTC. The batch claims are deleted at step 8; until then the old path has this bug (it is switched off).
- `org_ntf_requests_tr.request_data` holds template variables, which can include customer names. Add it to the notification retention sweep (for example 30 days after `PROCESSED`) in the step 5 code release.
