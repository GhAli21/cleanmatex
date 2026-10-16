# Runbook 08 — Incident Pause / Drain

**Status: Implemented (2026-10-15, R14, migrations 0625 and 0626).** Operators pause, drain and resume a provider per channel from HQ → Notifications → **Operations**; the dispatcher and the queue workers honour it. **Owner:** operator holding `hq_notifications:operate`. **Last verified against source:** 2026-10-15.

## Purpose
Stop or wind down sending through one provider on one channel immediately and reversibly, without touching a tenant's settings, jobs or code.

## States
| State | New commands | Jobs already queued (SMS / WhatsApp / push workers) |
|---|---|---|
| **Active** | sent | sent |
| **Paused** | refused with a temporary failure (or failed over, see runbook 09); no provider call | **held**: re-delayed every minute, no retry attempt consumed |
| **Draining** | refused (or failed over) | **still delivered** — use it to wind a provider down |
Tenant-owned (BYO) accounts are not governed by these platform controls.

## Steps
1. HQ → Notifications → Operations → find the provider and channel in the health table.
2. **Pause** (incident, wrong behaviour) or **Drain** (planned wind-down). A reason is required; it is shown on the screen and written to the audit log and the transition history.
3. Confirm: a refused command is recorded in `hq_ntf_dispatch_log` with status `FAILED` and error code `PROVIDER_PAUSED` / `PROVIDER_DRAINING`; callers retry with a new key (nothing is lost). Setup Health `providers.control` shows WARN.
4. When the provider is fixed press **Resume**. Held jobs continue within a minute. The state is cached for at most 5 seconds per API instance.

## Pause one organization (migration 0631, 2026-10-16)
Provider pause stops a provider for everybody. To stop ONE organization (abuse, billing suspension, a compromised account, a wrong bulk send) use HQ > Notifications > Operations > **Paused organizations**.
1. Enter the organization id (UUID), choose **All channels** or one channel (email, SMS, WhatsApp, push), write the reason (required) and press **Pause**, then confirm.
2. From that moment (cached for at most 5 seconds per API instance) every command of that organization on that scope is **refused for good**: the dispatch log row is PERMANENT_FAILURE with error code `TENANT_PAUSED`, the quota unit is given back, no provider is called and nothing is metered. Queued jobs of that organization are closed by the workers the same way. Refusals are not provider failures, so they never open a circuit.
3. Messages are **not held**: holding them and releasing everything on resume would be a spam burst. The organization's own outbox shows the refusal; after the resume it can resend what still matters.
4. **Resume** from the same list. A paused scope that is covered by an "All channels" pause stays paused until that one is resumed too.
5. In-app notifications are created inside the organization's own app and are not affected.
6. Setup Health `tenants.paused` is WARN while any organization is paused. Every pause and resume is audited (`notification_tenant.paused` / `.resumed`) and kept in `sys_ntf_tenant_pause_log` with actor and reason. Needs `hq_notifications:operate`.

## What is recorded
Audit actions `notification_provider.paused`, `.draining`, `.resume`; table `sys_ntf_prov_ctl_log` keeps every transition with actor and reason.

## Limits (honest)
- Control is per provider and channel, platform-wide. Pausing one tenant only is not offered; disable the tenant's channel in its own settings instead.
- Jobs already inside a provider call when you pause finish normally.
- A paused provider that has a failover rule and a registered connector keeps delivering through the target (runbook 09).
