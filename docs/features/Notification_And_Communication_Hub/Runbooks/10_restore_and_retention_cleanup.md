# Runbook 10 — Restore & Retention Cleanup

**Status: Partial — retention cleanup implemented (Part B); restore drill not implemented (Part A).** Retention is implemented (Part B, updated 2026-10-15); restore has no notification-specific drill yet (Part A) — an expected, legitimate gap, not an oversight to paper over.

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

**Implemented (migrations 0609 and 0623).** Job `ntf-retention-sweep` (daily 04:00, Job Manager) calls `fn_ntf_retention_sweep(180)`: it purges terminal rows older than 180 days from the outbox, delivery log, receipts, in-app inbox, the usage-apply ledger and the HQ dispatch log (never anything pending, queued or unread). 0623 fixed a defect that would have made the sweep fail on its first eligible row (the usage-apply ledger references the dispatch log) and added `ntf-quota-rsv-sweep` (every 5 minutes: expires unsettled quota reservations, purges settled ones after 30 days).

### Operator steps
1. Job Manager: both jobs active, last run SUCCESS; Setup Health `jobs.drift` / `jobs.last_run` OK.
2. Verify: `select count(*) from hq_ntf_dispatch_log where status in ('SENT','PERMANENT_FAILURE') and created_at < now() - interval '181 days';` → 0 after a run.
3. Changing the window means a new migration (the 180 days follow the existing session-sweep precedent; the plan leaves the final policy to the owner).

### Still open
Minimizing PII inside rows younger than the window (the plan lists it separately), and the formal owner sign-off of the retention policy (plan section 23).

## Why these two are combined in one file

Per the task's own guidance: both topics are, today, "mostly NOT_IMPLEMENTED stubs" with no existing tooling to document — grouping avoids two files that would otherwise each consist of a single "nothing exists yet" statement, while keeping each sub-topic separately headed and findable above.

**Last verified against source:** 2026-10-15 (Part B updated; Part A, restore, is still an exercised-drill gap).
