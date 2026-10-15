# Runbook 09 — Provider Outage

**Status: Implemented for platform-managed providers (2026-10-15, R14, migrations 0625 and 0626).** Account health, an automatic circuit breaker, manual pause, failover rules and alerts exist. Cross-provider failover needs a registered second connector (R13 provides the port, the sandbox connectors and the conformance kit; real second providers are chosen by the owner). **Last verified against source:** 2026-10-15.

## What happens automatically
1. **Health.** Every minute HQ API reads the rolling window (default 10 minutes) of the dispatch log per provider and channel. Failures are temporary failures and provider-caused permanent failures (rejected credentials or request); our own refusals (quota, not configured, paused, open circuit) and test traffic are ignored.
2. **Circuit breaker.** CLOSED → **OPEN** when at least `ntf.hq.breaker.min_volume` commands (default 10) were judged and failures reach `ntf.hq.breaker.failure_pct` (default 50). Open circuits refuse commands without calling the provider. After `ntf.hq.breaker.cooldown_seconds` (default 120) it becomes **HALF_OPEN**: a few probe commands go through; a success closes it, a failure reopens it. Every transition is compare-and-set in the database (several API instances cannot fight), logged, audited, and an opening circuit posts to the alert webhook `platform.ops.alert_webhook_url`.
3. **Failover.** If a rule exists (Operations → Failover rules: channel, from provider, to provider, priority) and the target has a registered connector and is itself available, commands are sent through the target; the dispatch log, metering and response name the provider actually used. Otherwise they are refused with a temporary failure and retried by the caller.
4. **Workers.** Queued jobs for a paused provider or an open circuit are re-delayed, not failed.

## Operator steps during an outage
1. Open Notifications → Operations. A red **Open** circuit or a falling success rate marks the provider. Setup Health `providers.control` is FAIL for an open circuit.
2. Decide: let the breaker do its work, **Pause** the provider (runbook 08), or add a failover rule to a healthy provider.
3. Fix the cause with the provider; the breaker probes by itself. If you know it is fixed, **Reset circuit** closes it at once (it reopens if the provider still fails).
4. Afterwards read the history (`GET /notifications/operations/history`) and run the **Usage reconciliation** report for the outage window.

## Tuning
Registry keys under Operations → Config: `ntf.hq.breaker.enabled` (default true), `.window_minutes` (1-60), `.min_volume` (1-1000), `.failure_pct` (1-100), `.cooldown_seconds` (10-3600). Changes apply within a minute.

## Limits (honest)
- Failover is for platform-managed routes with a registered connector; the existing providers (Resend, Twilio, Meta) have no automatic second provider until the owner chooses and credentials exist. Today the breaker and pause protect them, and sandbox connectors prove the path.
- Queued jobs are held, not re-routed, while a provider is down.
- Half-open probe budget and the admission cache are per API instance.
- The breaker only sees traffic that reached the dispatch log; a provider that fails before a command is logged shows as no traffic.
