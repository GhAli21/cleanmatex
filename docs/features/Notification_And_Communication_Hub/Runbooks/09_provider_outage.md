# Runbook 09 — Provider Outage

**Status: Not implemented.** No automatic failover, account-health dashboard, or circuit breaker exists for any provider. The plan explicitly defers automatic provider failover as out-of-scope (section 1.2: "Automatic provider failover after unknown acceptance... is deliberately deferred scope"). Today there is exactly one live route per channel (the legacy direct-Twilio path) — there is no second provider to fail over *to* even if automatic failover existed.

## Purpose

Describe what actually happens, and what an operator can actually do, when a provider (e.g. Twilio) has a live outage or degraded service.

## What happens automatically today (verified in code, not aspirational)

1. A provider call that **throws** (timeout, connection error, 5xx) during `process-outbox` is caught and the row is held as `ACCEPTANCE_UNCERTAIN` (`markAcceptanceUncertain` in `process-outbox/route.ts`) — it is never blindly retried, because the exception itself proves nothing about whether the provider actually accepted it. This row needs Runbook 07's reconciliation pass to resolve.
2. A provider call that **returns** a classified transient failure (e.g. Twilio rate limit/429-equivalent, not a hard rejection) becomes `FAILED_TEMPORARY` and is retried automatically on the existing backoff schedule (`[5, 15, 60, 240, 720]` minutes — Runbook 07 Part A) — this is the main thing that naturally absorbs a short outage without any operator action, *as long as the provider's API still responds with a classifiable error rather than hanging/erroring at the transport level*.
3. If the outage is long enough that a tenant exhausts `max_retries`, the row becomes `FAILED_PERMANENT` — a human must look at it; there is no further automatic recovery for that specific row.
4. Twilio webhook ingestion (`platform-api/.../webhooks/webhooks.controller.ts`) is **not** JWT-protected (providers call it directly); signature verification happens inside `WebhooksService` and an invalid/forged signature returns `422` **before** any persistence — a provider-side outage or misconfiguration that breaks signature verification will show up as rejected webhooks, which is diagnosable via HQ logs/`get_advisors`/`query_logs` but is not surfaced on any dedicated health page.

## What does NOT exist (confirmed absent)

- No `GET /operations/health` or account/channel-health endpoint (plan section 10.2 proposes this; no `health`/`account.saturation`/`circuit breaker` code exists anywhere under `platform-api/src/modules/notifications-hq/observability`).
- No automatic "mark this provider account degraded and stop routing to it" mechanism.
- No multi-provider failover for any channel — WhatsApp has only Twilio wired as a live sender; there is no second WhatsApp provider configured to fail over to even manually today, outside of the BYO tenant-private account mechanism (which is a different tenant's own account, not a failover target for the same tenant).

## Operator steps during a confirmed provider outage

1. Confirm the outage is provider-side, not a CleanMateX credential/config problem: check recent `org_ntf_delivery_log_dtl.error_message` for the affected tenant/channel for a consistent provider-level error pattern (timeouts, 5xx, or a specific Twilio error code) across multiple tenants — a single-tenant-only failure pattern is more likely a credential/config issue (Runbook 01), not a provider outage.
2. To stop accumulating `ACCEPTANCE_UNCERTAIN`/`FAILED_TEMPORARY` rows against a known-down provider instead of letting them exhaust retries pointlessly, use Runbook 08's manual levers: disable the affected `org_ntf_channel_provider_cf` row (`is_active = false`) or the tenant/channel pair in `org_ntf_settings_cf`.
3. Once the provider recovers, re-enable the toggles from step 2. Rows left `FAILED_TEMPORARY` within their retry window will resume automatically on the next cron tick (Runbook 07 Part A); rows that reached `FAILED_PERMANENT` or `ACCEPTANCE_UNCERTAIN` need Runbook 07 Part B (manual reconciliation invocation, since no cron schedule exists for it).
4. There is no step to "switch to a backup provider" — none exists for any tenant/channel today.

## Expected outcome

- Short outages (provider recovers within the retry backoff window): mostly self-healing via the existing `FAILED_TEMPORARY` retry sweep, with some rows landing in `ACCEPTANCE_UNCERTAIN` needing a manual reconciliation pass afterward.
- Extended outages: accumulating `FAILED_PERMANENT`/`ACCEPTANCE_UNCERTAIN` rows that need Runbook 07's manual, per-row attention; no bulk "replay all of these now that the provider is back" tool exists either — reconciliation/retry both operate per-row on their own schedule.

## What would need to be built

1. A provider/account health signal (error-rate or consecutive-failure tracking) feeding an actual `GET /operations/health`-style endpoint, as the plan proposes.
2. A real second live route per channel (the route-resolver/route-lifecycle machinery in Runbook 04 already exists structurally) plus an explicit, reviewed cutover decision to make a second provider actually reachable as a fallback — not just configured.
3. A bulk "re-queue everything dead-lettered during window X for tenant Y now that the provider is confirmed back" operator tool, so recovery doesn't depend on per-row manual review alone.

**Last verified against source:** 2026-10-10 (`process-outbox/route.ts`, `reconciliation-service.ts`, `webhooks.controller.ts`; `notifications-hq/observability` searched for health/circuit-breaker code — none found).
