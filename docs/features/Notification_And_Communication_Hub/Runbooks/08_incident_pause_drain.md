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

## What is recorded
Audit actions `notification_provider.paused`, `.draining`, `.resume`; table `sys_ntf_prov_ctl_log` keeps every transition with actor and reason.

## Limits (honest)
- Control is per provider and channel, platform-wide. Pausing one tenant only is not offered; disable the tenant's channel in its own settings instead.
- Jobs already inside a provider call when you pause finish normally.
- A paused provider that has a failover rule and a registered connector keeps delivering through the target (runbook 09).
