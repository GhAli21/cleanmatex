# Runbook 10 — Restore & Retention Cleanup

**Status: Implemented (2026-10-15) — restore drill (Part A) written with read-only checks verified against the live schema, still to be rehearsed on a staging copy; retention cleanup (Part B) implemented.**

## Part A — Restore drill (written 2026-10-15; executable checks verified read-only against the live schema)

### Purpose
Recover the notification state after a database restore (point-in-time recovery) or a Redis loss, **without sending anything twice and without losing queued work**. Plan section 22: "Restore from backup can replay old queue/acceptance state; use provider reconciliation and a reviewed recovery window before re-enabling workers."

### Why a restore is dangerous for notifications
- A message sent **after** the restore point exists at the provider but not in the restored database. If it is still queued in Redis, or its outbox row comes back as `QUEUED`, it is sent **again**.
- The reverse is safe: a row restored as `SENT` is never re-sent (the idempotency key and the claim/lease model stop it).
- Quota reservations, usage counters and the pause/breaker state go back in time with the database; they are repaired by the checks below.

### Owner and frequency
Owner: the operator who holds `hq_notifications:operate` and database access (name them in plan section 24). Rehearse once on a staging copy before launch and after any change to the queue or outbox design.

### Procedure
**1. Stop sending (before or immediately after the restore)**
1. HQ → Operations → Job Manager: disable the notification jobs `ntf-outbox-processor`, `ntf-outbox-retry`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox` (a restored database may bring the cron schedule back enabled).
2. Stop the platform workers (the BullMQ consumers) and the HQ API instances that run the dispatcher, or **Pause** every provider and channel in HQ → Notifications → Operations (reason "restore in progress"; note the pause state itself may be rolled back by the restore, so re-check after).
3. Write down the restore point time `T_restore` and the incident time.

**2. Restore the database** (Supabase point-in-time recovery). Redis: if Redis was not restored, its queue still holds jobs created after `T_restore`; if Redis was restored from a snapshot, it may hold jobs for messages already sent.

**3. Decide what to do with the queue (Redis)**
- Preferred: **empty the notification queues** (BullMQ obliterate on the notification dispatch queues) after step 1. Safe because the durable source of truth is the database: rows restored as `QUEUED`/`FAILED_TEMPORARY` are picked up again by the outbox jobs; HQ dispatch commands are retried by their callers with the same idempotency key.
- Cost: a message that was sent after `T_restore` and whose outbox row was lost is not known to the system any more. For WhatsApp/Twilio it is found by the provider check in step 5; for email, SMS and push the provider's own dashboard/log for the window `T_restore → now` is the only record.

**4. Run the consistency checks (read-only SQL)**

| Check | Query | Healthy | If not |
|---|---|---|---|
| Rows with no live claim | `select id, tenant_org_id, channel_code, claimed_by, lease_expires_at, now() - updated_at as idle from org_ntf_outbox_dtl where status = 'PROCESSING' and (lease_expires_at is null or lease_expires_at < now());` | 0 rows | Expired leases are resolved by the reconciliation pass (step 5). A `PROCESSING` row with **no** lease at all is a legacy row the pass does not select: see "Known data finding" below. |
| Uncertain acceptance | `select reconcile_state, count(*) from org_ntf_outbox_dtl group by 1;` | no `ACCEPTANCE_UNCERTAIN` | Step 5. |
| Retries overdue | `select count(*) from org_ntf_outbox_dtl where status = 'FAILED_TEMPORARY' and next_retry_at < now() - interval '1 hour';` | 0 | Enable `ntf-outbox-retry`; they move to `QUEUED`. |
| Stale quota reservations | `select count(*) from org_ntf_quota_rsv_dtl where status = 'RESERVED' and expires_at < now();` | 0 | Run `select public.fn_ntf_quota_rsv_sweep();` (the 5-minute job does it; it expires them). |
| Provider control state | `select provider_code, channel_code, control_state, breaker_state from sys_ntf_prov_ctl_cf where control_state <> 'ACTIVE' or breaker_state <> 'CLOSED';` | only what you set on purpose | Fix in HQ → Notifications → Operations. A restored `OPEN` breaker with an old open time moves to probing by itself. |
| Usage versus sends | `select * from public.fn_ntf_usage_reconcile(current_date - 7, current_date);` | 0 rows (see the finding for historical rows) | A positive `difference` = sends that were never metered; billing for that window needs a manual correction decision by the owner. |
| Jobs back as intended | `select job_code, desired_enabled from sys_ops_job_cf where job_code like 'ntf-%' order by 1;` | all `true` after step 7 | Job Manager. |

**5. Reconcile uncertain rows before sending anything**
With the notification jobs still disabled, run the reconciliation pass once, manually (runbook 07, Part B): `POST <tenant app>/api/notifications/reconcile-outbox` with the outbox bearer secret. WhatsApp/Twilio rows with a captured SID are resolved from Twilio's answer; every other uncertain row ends as `FAILED_PERMANENT` with `RECONCILIATION_REQUIRED:` for a human. Review them:
`select id, channel_code, tenant_org_id, error_message from org_ntf_outbox_dtl where status = 'FAILED_PERMANENT' and error_message like 'RECONCILIATION_REQUIRED:%' order by finalized_at desc;`

**6. Review window**
Compare the provider logs for `T_restore → now` with the restored outbox: anything sent but missing is a "ghost" send (it cannot be re-sent by the system, nothing to do except tell the business); anything queued that was **already** sent is the duplicate risk, so mark those rows `FAILED_PERMANENT` with a note **before** step 7, or accept the duplicate.

**7. Re-enable**
1. Resume the paused providers (HQ → Notifications → Operations).
2. Enable the jobs in this order: `ntf-outbox-retry`, `ntf-outbox-processor`, `ntf-campaign-scheduler`, `ntf-reconcile-outbox`.
3. Start the workers and API.
4. Send one test message per channel (Templates → Preview & test).
5. After 15 minutes: Setup Health `providers.control`, `usage.reconciliation` and `jobs.last_run` must be OK.

### How to rehearse this on a staging copy (about 2 hours, once)
You never rehearse on production. You need a throwaway copy of the database and its own Redis.
1. **Get a staging copy.** Supabase dashboard > create a new project (name it `cleanmatex-restore-drill`). Restore a backup into it: Database > Backups > pick a daily backup or a point in time > "Restore to a new project" (needs a plan with backups or PITR). If your plan has no PITR, use `supabase db dump` of production and load it into the new project. Use a separate Redis (a free Upstash or a local Redis) and point a staging copy of HQ API, platform-workers and the tenant app at the new project; **use test provider credentials or only the sandbox connectors** (`HQ_NTF_SANDBOX_ENABLED=true`) so nothing reaches a real customer.
2. **Create the situation.** In staging send 20 messages through the sandbox provider, write down the time `T_restore`, send 20 more, then leave 5 of the second batch queued (pause the provider first so they stay queued).
3. **Simulate the restore.** Restore the staging database again to `T_restore` (or reload the dump taken before the second batch). Leave Redis as it is: it now holds the second batch's jobs, which is exactly the dangerous state.
4. **Run Parts 1 to 7 above in order** and write down for each step: the time it took, the query results, and anything that surprised you.
5. **Pass criteria:** no message of the second batch is sent twice; every check query is healthy at the end; one test message per channel arrives; Setup Health is OK after 15 minutes.
6. **Record it** in `DRILL_LOG` (new dated file) with the owner's name, then delete the staging project.

### Rollback / abort
Nothing in this procedure changes data except the manual `FAILED_PERMANENT` marking in step 6 and the reconciliation pass. If a step goes wrong, leave the jobs disabled and the providers paused: that state is safe and reversible.

### Known data finding (2026-10-15, live database)
Two `WHATSAPP` rows of the demo tenant have been `PROCESSING` for more than 30 days with **no claim token and no lease** (created before the claim/lease model, migration 0564). No sweep or reconciliation selects them, so they never finish. Because they are demo rows no customer is affected, but the owner should resolve them once (this runbook does not change data on its own):
`update org_ntf_outbox_dtl set status = 'FAILED_PERMANENT', error_message = 'RECONCILIATION_REQUIRED: legacy row without lease, closed manually', finalized_at = now(), updated_at = now() where status = 'PROCESSING' and lease_expires_at is null and updated_at < now() - interval '7 days' and tenant_org_id = '<tenant id>';`
(run per tenant; the explicit tenant filter is mandatory).

### What this runbook does not cover
- Redis persistence settings and PITR retention: infrastructure decisions outside this repository.
- Automatic detection that a restore happened (nothing watches for it; step 1 is manual).
- Provider-side delivery of messages sent in the lost window.

## Part B — Retention Cleanup

**Implemented (migrations 0609 and 0623).** Job `ntf-retention-sweep` (daily 04:00, Job Manager) calls `fn_ntf_retention_run()` (migration 0629), which reads the registry key `ntf.retention.days` (default 180, allowed 30-3650) and runs `fn_ntf_retention_sweep(days)`; before 0629 the number 180 was fixed in the job command. It it purges terminal rows older than 180 days from the outbox, delivery log, receipts, in-app inbox, the usage-apply ledger and the HQ dispatch log (never anything pending, queued or unread). 0623 fixed a defect that would have made the sweep fail on its first eligible row (the usage-apply ledger references the dispatch log) and added `ntf-quota-rsv-sweep` (every 5 minutes: expires unsettled quota reservations, purges settled ones after 30 days).

### Operator steps
1. Job Manager: both jobs active, last run SUCCESS; Setup Health `jobs.drift` / `jobs.last_run` OK.
2. Verify: `select count(*) from hq_ntf_dispatch_log where status in ('SENT','PERMANENT_FAILURE') and created_at < now() - interval '181 days';` → 0 after a run.
3. Change the window in HQ > Operations > Configuration Registry, key `ntf.retention.days` (30-3650 days; takes effect at the next 04:00 run; an invalid value is ignored and 180 is used). Lowering it makes the next run delete more history, so confirm your retention obligations first; the change is recorded in the key history.

### Still open
Minimizing PII inside rows younger than the window (the plan lists it separately), and the formal owner sign-off of the retention policy (plan section 23).

**Last verified against source:** 2026-10-15 (Part A written and its checks run read-only against the live schema; Part B updated).
