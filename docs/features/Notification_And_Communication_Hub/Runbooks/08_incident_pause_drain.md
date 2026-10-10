# Runbook 08 — Incident Pause / Drain

**Status: Not implemented as a dedicated control — manual levers only.** There is no pause/drain API, admin button, or script anywhere in either repo (confirmed: no `scripts/*` files reference notifications; no BullMQ `.pause()`/`.drain()`/`.obliterate()` call exists in `platform-api`/`platform-workers`). An operator must combine several pre-existing configuration toggles and direct `cron.unschedule` calls to approximate a pause.

## Purpose

Stop new/queued notification sends quickly during an incident (e.g. a bad template, a compromised credential, an unexpected send volume) without destroying evidence of what was already attempted.

## What actually exists today (manual levers, verified in code)

1. **Tenant channel-level disable** — `org_ntf_settings_cf.is_enabled` per `(tenant, channel_code)`. Read via `NotificationSettingsService` (`settings-service.ts:93/115`); referenced directly in operator-facing hints inside `orchestrator.ts:191` and `adapters/whatsapp.ts:437` ("Set org_ntf_settings_cf WHATSAPP is_enabled=true..."). Setting this to `false` stops the *orchestrator* from creating new outbox rows for that tenant/channel going forward — it does not touch rows already queued.
   - Toggle via the existing Settings UI, or directly:
     ```sql
     UPDATE org_ntf_settings_cf SET is_enabled = false, updated_at = NOW()
     WHERE tenant_org_id = '<tenant_org_id>' AND channel_code = '<CHANNEL>';
     ```
2. **Provider-config-level disable** — `org_ntf_channel_provider_cf.is_active` (migration `0356_ntf_provider_cf_is_enabled`). Disables a specific provider configuration for a channel without touching the tenant's overall channel toggle.
3. **HQ route suspend** — `PATCH /notifications/tenants/:tenantOrgId/routes/:id/suspend` (Runbook 04). **Only meaningful once a tenant is actually cut over to route-based sending** — today (shadow-only, see Runbook 04) this has no effect on live traffic for any tenant.
4. **Cron-level drain** — stop the scheduler from picking up any more work at all, tenant-wide, every tenant:
   ```sql
   SELECT cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('ntf-outbox-processor', 'ntf-outbox-retry', 'ntf-campaign-scheduler');
   ```
   (Job names confirmed from migrations `0350_ntf_outbox_cron.sql` and `0362_ntf_campaign_scheduler_cron.sql`.) This is the bluntest lever available — it stops **every** tenant's EMAIL/SMS/WhatsApp/Push/campaign dispatch, not just one tenant or channel. Re-running the relevant migration's `cron.schedule(...)` block re-arms it (the migrations are idempotent re-run-safe per their own header comments).
5. **HQ queue-level** — `NTF_QUEUE_ENABLED` environment variable gates whether `dispatch.service.ts` enqueues to BullMQ at all (`platform-api/.../dispatch/dispatch.service.ts:243/263/286`). Flipping it to `false` and redeploying routes dispatch back to the synchronous path instead of the queue — this is a deploy-time change, not a runtime toggle, and has no effect on jobs already enqueued in Redis.

## What is explicitly NOT available

- No single "pause this tenant" or "pause this channel" button/endpoint exists.
- No way to pause only *new* work while letting in-flight claims finish cleanly (a true drain) — the levers above either block at the orchestrator (new rows only) or stop the scheduler entirely (all tenants, all channels).
- No automatic unpause/expiry on any of these toggles — an operator who disables a channel during an incident must remember to re-enable it.
- No BullMQ pause/drain control exists for the HQ-side queue (`platform-workers`) — the only lever is the worker process's own lifecycle (stop/restart) or scaling it to zero instances, which is an infrastructure action outside this codebase's scope.

## Operator steps for the closest approximation to "pause this tenant/channel now"

1. Disable the tenant/channel pair: `UPDATE org_ntf_settings_cf SET is_enabled = false ...` (lever 1 above). New business events for that tenant/channel stop generating outbox rows.
2. If the provider itself is the problem (not the tenant), also disable the provider config (lever 2) so no tenant routes through it.
3. Rows already `QUEUED`/`PROCESSING` will still be picked up by the next `process-outbox` cron tick (lever 1 does not retroactively cancel them) — if those must stop too, use lever 4 (unschedule the cron jobs) as a last resort, understanding it is tenant-blind.
4. Document the exact toggles flipped and the time, so they can be reversed completely once the incident is resolved.

## Expected outcome

- New sends for the targeted tenant/channel stop within one orchestrator call after lever 1/2; already-queued rows stop only after lever 4 (cron unschedule) or their own natural processing.

## Rollback / abort guidance

- Reverse exactly the toggles flipped (`is_enabled = true`, `is_active = true`, re-run the `cron.schedule(...)` block from the relevant migration). There is no "resume" command — only the inverse of each manual change.

## What would need to be built

A dedicated incident-control surface (plan section 21 implies this is expected: "incident pause/drain" is listed as a required runbook, implying the capability should exist) — e.g. a single audited HQ/tenant endpoint that atomically suspends new claims for a `(tenant, channel)` or `(tenant, provider)` pair, distinguishes "stop new work" from "also cancel in-flight claims," and auto-expires or requires explicit resume — does not exist today.

**Last verified against source:** 2026-10-10 (`settings-service.ts`, `orchestrator.ts`, `dispatch.service.ts`, migrations `0350`, `0356`, `0362`; `scripts/` directories in both repos searched for notification-related pause/drain tooling — none found).
