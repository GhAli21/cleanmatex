# Runbook 07 — Retry vs. Reconciliation

**Status: Partial.** Automatic retry (for *known*, proven-retryable failures) runs on a cron schedule. Reconciliation (for *uncertain* acceptance) is implemented as code but has **no cron schedule** — it must be invoked manually — and only resolves WhatsApp/Twilio rows authoritatively; every other row dead-letters for manual operator review.

## Purpose

Distinguish the two different recovery mechanisms so an operator never conflates them: **retry** replays a delivery that is *proven* not to have been accepted by the provider; **reconciliation** resolves a delivery whose provider acceptance is *unknown* (a crash or timeout mid-call) by asking the provider directly, never by guessing.

## Part A — Automatic retry (implemented, scheduled)

1. A transient failure (`FAILED_TEMPORARY`) is written with `next_retry_at` computed by `nextRetryAt()` in `process-outbox/route.ts` — backoff schedule `[5, 15, 60, 240, 720]` minutes by `retry_count`.
2. pg_cron job `ntf-outbox-retry` (migration `0350_ntf_outbox_cron.sql`, schedule `*/5 * * * *`) sweeps:
   ```sql
   UPDATE org_ntf_outbox_dtl SET status = 'QUEUED', updated_at = NOW()
   WHERE status = 'FAILED_TEMPORARY' AND next_retry_at <= NOW() AND retry_count < max_retries
   ```
3. pg_cron job `ntf-outbox-processor` (same migration, schedule `* * * * *`) calls `POST /api/notifications/process-outbox` (Bearer `NOTIFICATIONS_OUTBOX_SECRET`) every minute, which claims and re-delivers the now-`QUEUED` row.
4. A row that exhausts `max_retries` becomes `FAILED_PERMANENT` and stops retrying automatically.

**Operator steps to inspect retry state:**
```sql
SELECT id, channel_code, status, retry_count, max_retries, next_retry_at, error_message
FROM org_ntf_outbox_dtl
WHERE tenant_org_id = '<tenant_org_id>' AND status = 'FAILED_TEMPORARY'
ORDER BY next_retry_at;
```
To confirm the cron jobs are actually scheduled (read-only discovery): `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ntf-outbox%';`

## Part B — Reconciliation (implemented, NOT scheduled — manual invocation required)

1. A row enters reconciliation scope when either:
   - `reconcile_state = 'ACCEPTANCE_UNCERTAIN'` (set by `process-outbox/route.ts`'s `markAcceptanceUncertain` when a provider call throws mid-flight — the error could mean the message was or wasn't accepted), or
   - the row is `PROCESSING` with a claim lease expired more than 2 minutes past its 5-minute bound (`LEASE_GRACE_MILLISECONDS` in `reconciliation-service.ts`) — i.e. the worker that claimed it crashed and recorded nothing.
2. **Manually invoke** (no pg_cron job exists for this route — confirmed: migration `0350` only schedules `process-outbox`/the retry sweep; no equivalent exists for `reconcile-outbox`):
   ```bash
   curl -X POST https://<app-url>/api/notifications/reconcile-outbox \
     -H "Authorization: Bearer $NOTIFICATIONS_OUTBOX_SECRET"
   ```
   Implementation: `web-admin/app/api/notifications/reconcile-outbox/route.ts` → `reconcileTenantOutbox()` in `lib/notifications/reconciliation-service.ts`, run independently per active tenant (`org_tenants_mst` where `is_active = true AND rec_status = 1`) so one tenant's provider/credential problem cannot block another tenant.
3. Per stuck row, the resolution logic:
   - **If `channel_code = 'WHATSAPP'` AND a `provider_message_id` (Twilio SID) was captured:** calls Twilio's `messages(sid).fetch()` and finalizes from the verified answer only:
     - `delivered/sent/queued/accepted` → `SENT` (+ an immutable `org_ntf_receipts_tr` receipt row).
     - `failed/undelivered` → `FAILED_TEMPORARY` or `FAILED_PERMANENT`, using the same permanent-error classification as the live WhatsApp adapter (`isTwilioMessagePermanentFailure`).
     - A Twilio `404` (message never created) is treated as proof of non-submission and the row re-enters the normal `FAILED_TEMPORARY` retry path (Part A), per invariant "retry only proven unsubmitted attempts."
   - **Every other case** (no captured SID at all, `META_WHATSAPP`, or any non-WhatsApp channel — `EMAIL`/`SMS`/`PUSH`) **dead-letters to `FAILED_PERMANENT`** with an explicit `error_message` prefixed `RECONCILIATION_REQUIRED:` for manual operator review. This is a normal, auditable `FAILED_PERMANENT` row with its own delivery-log entry — never a silent drop.

**Operator steps to find rows that need manual review after a reconciliation pass:**
```sql
SELECT id, channel_code, tenant_org_id, error_message, finalized_at
FROM org_ntf_outbox_dtl
WHERE status = 'FAILED_PERMANENT' AND error_message LIKE 'RECONCILIATION_REQUIRED:%'
ORDER BY finalized_at DESC;
```

## Expected outcomes

- Retry: a `FAILED_TEMPORARY` row automatically becomes `QUEUED` again within its backoff window with no operator action, up to `max_retries`.
- Reconciliation: every `ACCEPTANCE_UNCERTAIN`/crashed-lease row ends in exactly one of `SENT` (verified), `FAILED_TEMPORARY` (verified non-submission, will retry), or `FAILED_PERMANENT` with `RECONCILIATION_REQUIRED:` (needs a human).

## Rollback / abort guidance

- There is no automatic "retry" UI button for a dead-lettered row — the plan explicitly requires that unknown acceptance "must never appear as an ordinary Retry button without its additional review path" (section 21), and no such button exists in the current delivery-log UI (no `POST /delivery-log/:id/retry` route exists anywhere in `web-admin/app/api/v1/notifications`). An operator who has manually confirmed the true outcome out-of-band (e.g. checked the Twilio console directly) must currently update the row by hand (e.g. requeue by setting `status='QUEUED', retry_count=0, error_message=NULL` after clearing `reconcile_state`) — this is a deliberate manual, auditable gap, not an oversight, but it is also a real operational risk worth flagging to the feature owner.

## Known gaps (explicit, not invented)

1. **No pg_cron schedule exists for `reconcile-outbox`.** Until an operator explicitly approves and applies a migration mirroring `0350`'s `cron.schedule` pattern, `ACCEPTANCE_UNCERTAIN`/crashed-lease rows sit unresolved until someone remembers to call the endpoint by hand.
2. **No reconciliation lookup exists for `META_WHATSAPP`, `EMAIL`, `SMS`, or `PUSH`** — only `TWILIO_WHATSAPP` has an authoritative provider status check. Building the others requires: capturing a provider message ID for each adapter (only the WhatsApp/Twilio adapter does this today), plus a status-lookup call per provider.
3. **No dedicated manual-retry API/UI exists** for a `RECONCILIATION_REQUIRED:` dead letter — direct SQL is the only path today.

**Last verified against source:** 2026-10-10 (`process-outbox/route.ts`, `reconcile-outbox/route.ts`, `reconciliation-service.ts`, migration `0350_ntf_outbox_cron.sql`).
