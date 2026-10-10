# Notification & Communication Hub — Operational Runbooks

**Authority:** Grounded directly in source code, routes, and migrations in both repos as of the "Last verified against source" date on each file. The canonical planning authority remains [`notification-hub-production-implementation-plan.md`](../notification-hub-production-implementation-plan.md) (section 21 lists these 12 runbook topics as required; section 24 requires them "exercised" with "owners assigned" before definition-of-done). [`STATUS.md`](../STATUS.md) is the more precise, dated record of what has actually shipped — these runbooks defer to it wherever the plan's prose is stale.

**How these runbooks were built:** for each topic, the underlying capability was verified by reading the actual route/controller/service/migration files before writing any step. Where no real implementation, script, or cron job exists, the file says so explicitly instead of inventing steps, buttons, or dashboards that don't exist.

| # | Runbook | Status | One-line description |
|---|---------|--------|------------------------|
| 01 | [Connection verification & rotation](./01_connection_verification_rotation.md) | Partial | Live Twilio-only verify for platform + tenant-private accounts; credential rotation exists only for tenant-private (write-only envelope, resets to PENDING). |
| 02 | [Sender registration](./02_sender_registration.md) | Partial | Platform/tenant-private sender CRUD exists; no live verification connector for senders in this increment. |
| 03 | [Template import, submission & approval](./03_template_import_submission_approval.md) | Partial | Server-side Twilio Content import (platform + tenant-private) with immutable revisions/bindings is implemented; CleanMateX never submits a template for provider approval — that happens in Twilio's console first. |
| 04 | [Tenant activation (route lifecycle)](./04_tenant_activation.md) | Partial | Full DRAFT→ACTIVE→SUSPENDED→RETIRED route API/UI exists, but it is wired SHADOW-ONLY — activating a route does not change what is actually sent to any customer today. |
| 05 | [Consent / opt-out](./05_consent_opt_out.md) | Partial | WhatsApp (opt-in) and EMAIL/SMS (opt-out) consent are rechecked at dispatch; PUSH has no customer consent model by design; no bounce/complaint/opt-out suppression-*list* table exists. |
| 06 | [Safe test](./06_safe_test.md) | Partial | A campaign-scoped "send to myself" test route exists; there is no generic per-template/per-event preview-or-test-send API despite the plan proposing one. |
| 07 | [Retry vs. reconciliation](./07_retry_vs_reconciliation.md) | Partial | Automatic retry sweep is cron-scheduled; reconciliation exists but has no cron schedule (manual invocation only) and only resolves WhatsApp/Twilio rows authoritatively — everything else dead-letters for manual review. |
| 08 | [Incident pause / drain](./08_incident_pause_drain.md) | Not implemented (manual levers only) | No dedicated pause/drain control exists; operators must flip existing per-channel/per-provider config flags or unschedule pg_cron jobs by hand. |
| 09 | [Provider outage](./09_provider_outage.md) | Not implemented | No automatic failover, account-health dashboard, or circuit breaker exists; only manual channel/provider disablement and the existing retry backoff apply. |
| 10 | [Restore & retention cleanup](./10_restore_and_retention_cleanup.md) | Not implemented | No notification-specific restore drill or retention/cleanup job exists; rows accumulate indefinitely today. |
| 11 | [Billing / usage reconciliation](./11_billing_usage_reconciliation.md) | Partial | Atomic, idempotent usage metering and quota reads are implemented; true pre-send reservation and any provider-invoice reconciliation are explicitly out of scope so far. |
| 12 | [Operator handover](./12_operator_handover.md) | Not implemented as a dedicated artifact | No standing handover checklist existed before this set; this index plus the other 11 files are the first one. |

**Status legend:** *Implemented* = the full procedure can be executed today exactly as written. *Partial* = some sub-steps are real and executable, others are explicitly gated or missing — each file says which. *Not implemented* = the capability does not exist in either repo today; the file states what would need to be built.
