# Runbook 10 — Restore & Retention Cleanup

**Status: Not implemented.** Both topics are combined in this file because neither has any notification-specific tooling today — confirmed by searching both repos for retention/cleanup/purge logic and any backup/restore script scoped to notification tables; none exists. This is an expected, legitimate finding, not an oversight to paper over.

## Part A — Restore

### Purpose (as intended by the plan)

Recover notification queue/acceptance state after a database or Redis restore without causing duplicate sends, per plan section 22: *"Restore from backup can replay old queue/acceptance state; use provider reconciliation and a reviewed recovery window before re-enabling workers. Test database/Redis consistency recovery."*

### What exists today

- **Nothing notification-specific.** There is no documented restore drill, no restore script, and no "reviewed recovery window" procedure anywhere in either repo for notification tables specifically.
- The only applicable tooling is **platform-level**: standard Supabase/Postgres point-in-time recovery (PITR) and whatever Redis persistence/backup strategy the deployment uses for BullMQ — both are infrastructure concerns outside this feature's code, not configured or documented by this plan.
- The existing safety mechanisms that make a restore *survivable* (as opposed to a dedicated restore runbook) are the same ones covered elsewhere in this set: the durable claim/lease model (Runbook 07/08) means a restored database won't re-send anything whose outcome was already finalized, and `ACCEPTANCE_UNCERTAIN`/crashed-lease rows are exactly what Runbook 07's reconciliation pass is designed to resolve after any kind of process interruption — including a restore.

### NOT YET IMPLEMENTED — what would need to be built

1. A documented, exercised restore drill specific to the notification tables (`org_ntf_outbox_dtl`, `org_ntf_delivery_log_dtl`, `org_ntf_receipts_tr`, `hq_ntf_dispatch_log`, `org_ntf_usage_daily`, `org_ntf_usage_apply_evt`) that explicitly covers: restoring to a point before an in-flight claim, re-enabling workers only after running reconciliation, and confirming Redis/DB consistency (BullMQ job state vs. `hq_ntf_dispatch_log` state) before resuming normal cron/worker operation.
2. An explicit decision on whether a restore should pause the outbox/campaign cron jobs automatically (it does not today — nothing watches for "a restore just happened").

## Part B — Retention Cleanup

### Purpose (as intended by the plan)

Enforce "approved retention windows for event data, recipient addresses, payloads, receipts, usage and audit metadata. Minimize PII snapshots" (plan section 11.2), and have this "exercised" with an assigned owner per the definition-of-done (section 24).

### What exists today

- **No retention/cleanup job of any kind exists for any notification table in either repo.** Confirmed: no migration under `supabase/migrations` with a retention/cleanup/purge pattern scoped to `ntf`/`notification` tables, and no cron job beyond the already-documented dispatch/retry/campaign-scheduler jobs (`0350`, `0353`, `0362`) — none of which delete or archive anything.
- Rows in `org_ntf_outbox_dtl`, `org_ntf_delivery_log_dtl`, `org_ntf_notifications_mst` (in-app inbox), `org_ntf_receipts_tr`, `org_ntf_audit_dtl`, `org_ntf_usage_daily`, and `org_ntf_usage_apply_evt` **accumulate indefinitely today.** This includes recipient addresses and rendered message bodies stored in the outbox/delivery-log rows.

### NOT YET IMPLEMENTED — what would need to be built

1. An explicit, approved retention policy decision per data class (event/intent data, recipient addresses, rendered payload bodies, receipts, usage records, audit metadata) — the plan flags this as its own unresolved decision gate (section 23: "Retention/residency/compliance... Required before production cohort expansion") and it has not been made yet.
2. A reviewed migration implementing the actual cleanup (scheduled deletion/archival job, likely pg_cron-based like the existing dispatch jobs) once that policy is approved.
3. A way to minimize PII snapshots in already-stored rendered payloads (the plan calls this out separately from simple time-based deletion).

## Why these two are combined in one file

Per the task's own guidance: both topics are, today, "mostly NOT_IMPLEMENTED stubs" with no existing tooling to document — grouping avoids two files that would otherwise each consist of a single "nothing exists yet" statement, while keeping each sub-topic separately headed and findable above.

**Last verified against source:** 2026-10-10 (searched `supabase/migrations` and both repos' notification code for retention/cleanup/purge/restore patterns — none found beyond the dispatch/retry/campaign cron jobs already documented in Runbook 07/08).
