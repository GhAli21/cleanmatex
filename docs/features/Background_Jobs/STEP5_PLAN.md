# Step 5 — Notifications on pg-boss: implementation plan

Status (23 Nov): 0810 applied local + remote. **5b done in code:** tenant producer (`lib/notifications/request.service.ts`, `event-emitter.ts`), cmx-workers `ntf.orchestrate`, payloads in `@cmx/jobs`, tests 19/19. **5c done in code:** HQ API `queue-consumer` module (`ntf.deliver`, `ntf.reconcile`), BullMQ queue removed, per-attempt idempotency key, Resend `Idempotency-Key`. Open in 5c: `ntf.status_apply` (webhooks still update status inline; the queue stays paused). Next: 5d campaigns / OTP / receipts, 5e deletions. Design: [DESIGN.md](DESIGN.md) §7, §14.5, §15, §16.

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
4. **Campaigns** — extract the expansion in `app/api/notifications/process-campaigns/route.ts` into a service; `ntf.campaign_start` at the approved send time chunks targets into `ntf.campaign_chunk` jobs of 50; outbox rows and their `ntf.deliver` jobs use a low priority (−10) so receipts and OTP go first.
5. **Immediate sends (§16)** — receipt send/resend and OTP write the outbox row and enqueue `ntf.deliver` at the highest priority in one transaction; return `202` with the outbox id. New tenant route `GET /api/v1/notifications/outbox/[id]/status` (tenant-filtered, status and failure reason only). Server-side dedupe key `receipt:<id>:<channel>` with `singletonKey` + `singletonSeconds: 30`. OTP: real code generation (replaces the fixed test code), per-phone and per-IP limits, allowed countries, `retryLimit: 2`, skip when expired, 24 h retention of OTP rows. Screens poll the status for up to 15 s and report through `cmxMessage` (EN/AR, `check:ui`).
6. **Delete** the tenant provider adapters that call providers directly, `lib/integrations/whatsapp-client.ts`, and the `app/api/notifications/process-outbox` / `reconcile-outbox` / `process-campaigns` / `jobs/campaign-expansion` routes once their callers are gone (step 8 drops the SQL).
7. **Tests** — cmx-workers integration: request → orchestrate → outbox row + deliver job; re-run writes nothing; campaign chunking; tenant isolation. web-admin Jest for the producer, OTP limits and the status route.

## HQ code (`cleanmatexsaas/platform-api`)

1. pg-boss consumer module (about 30 lines of `work()` registration, `migrate: false`, pool from the session pooler, registry loop for pause/resume and `applied_*`, same rules as cmx-workers).
2. `ntf.deliver` handler: `fn_ntf_worker_claim_one` → recheck policy (consent, suppression, quota) → `OutboxDeliveryService.execute` → `fn_ntf_worker_finalize_claim`; timeout or unknown outcome → `fn_ntf_worker_mark_uncertain` + `ntf.reconcile` with `startAfter` 2 min; `NOT_DUE` → re-send with `startAfter`; provider rate limit → re-send with `startAfter` and complete.
3. `ntf.reconcile`: provider lookup → `fn_ntf_worker_reconcile_claim`; proven not sent → one resend; unknown after the last attempt → dead letter + Sentry.
4. Webhooks: verify signature, store the raw event, enqueue `ntf.status_apply`, return 200.
5. `Idempotency-Key` on Resend sends (the outbox id).
6. Delete `DispatchQueueService`, `ntf.hq.queue_enabled` and `NTF_QUEUE_ENABLED` (§15.1 trap).
7. HQ API must run in the database's region first (S-D6).

## Release order

1. Owner applies 0810 (local, then remote).
2. Ship tenant and HQ code together; switch the six queues on in HQ → Ops → Jobs.
3. Prove on demo tenants: each message once, including after a forced timeout and a killed consumer (§10.2 step 5 "done when").

## Findings while writing 0810

- **F15 — batch claims release scheduled rows 4 hours early.** The database time zone is `Asia/Muscat`; `org_ntf_outbox_dtl.scheduled_at` is a timestamp without time zone holding UTC (the app writes UTC ISO strings). The batch claims compare `scheduled_at <= now()`, which reads it as local time, so a quiet-hours delay ends 4 hours early. `fn_ntf_worker_claim_one` compares in UTC. The batch claims are deleted at step 8; until then the old path has this bug (it is switched off).
- `org_ntf_requests_tr.request_data` holds template variables, which can include customer names. Add it to the notification retention sweep (for example 30 days after `PROCESSED`) in the step 5 code release.
