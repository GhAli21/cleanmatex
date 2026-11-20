# I11 Background Execution — Production Runbook

**Status:** Active for controlled notification-worker hardening. **Architecture locked 20 Nov 2026** ([expert replan](I11_background_execution_EXPERT_REPLAN.md) D1–D12). Do not resume the Render worker before WP1. Delivery stays `NTF_OUTBOX_WORKER_ENABLED=false`. Transitional poll/safety net is **15 minutes** (D10) once WP0 is implemented; until then source ticks may still disagree with this runbook.  
**Authority:** [expert replan](I11_background_execution_EXPERT_REPLAN.md), [I11 plan](I11_background_execution_redesign_PLAN.md), [I11 ADR](I11_background_execution_redesign_ADR.md), and [handler contracts](I11_background_execution_handler_contracts.md).  
**Test execution companion:** [I11 remote QA and evidence guide](I11_background_execution_QA_TEST_GUIDE.md).  
**Production evidence authority:** Remote Supabase read-only results and Render/HQ deployment evidence. Local results are development-only.

## Safety boundary

- Vercel and the tenant application do not run scheduled work.
- Supabase owns canonical notification state in `org_ntf_outbox_dtl` and immutable delivery attempts in `org_ntf_delivery_log_dtl`.
- Render `platform-workers` claims canonical rows. It calls HQ only with `tenantOrgId`, `outboxId`, and `claimToken`.
- HQ `jobs-need-api/notifications/outbox-delivery` rechecks policy and submits to the provider. It cannot accept arbitrary URLs, recipients, providers, commands, or payloads.
- BullMQ is not part of the supported notification path. It is rollback-only and starts only when `LEGACY_BULLMQ_ENABLED=true`, never merely because `REDIS_URL` is set. Redis on HQ API is for cache/limiter/locks only.
- Never retry an `ACCEPTANCE_UNCERTAIN` claim until provider/HQ evidence proves whether an external effect occurred.

## Required Render configuration

Do not put secrets or values in this document. The Owner sets the same dedicated `PLATFORM_WORKER_API_KEY` on HQ API and Render. Render uses the private HQ internal-jobs base URL for `HQ_JOBS_API_URL`.

HQ Config Registry (`/ops/config`, migration `0777`) inventories these names as `ENV_ONLY` host-managed metadata. The worker does not read registry stored values. Do not change those keys to a stored-value policy, and never paste `PLATFORM_WORKER_API_KEY` or `HQ_JOBS_API_URL` into the registry, chat, or tickets. HQ Check now cannot verify the Render worker environment.

| Situation | `NTF_OUTBOX_WORKER_ENABLED` | `NTF_OUTBOX_SHADOW_ENABLED` | `LEGACY_BULLMQ_ENABLED` | Canary limits |
|---|---:|---:|---:|---|
| Normal observation / incident recovery | `false` | `true` | `false` or unset | N/A |
| Capacity containment after proof | `false` | `false` | `false` or unset | N/A |
| One-claim canary only | `true` | `true` | `false` or unset | New `NTF_OUTBOX_CANARY_RUN_ID` UUID; `NTF_OUTBOX_CLAIM_LIMIT=1`; `NTF_OUTBOX_MAX_CLAIMS_PER_BOOT=1` |
| Explicit legacy rollback | `false` | as required | `true` | Prohibited unless the Owner has approved the legacy rollback plan and no canonical worker can claim the same work |

`NTF_OUTBOX_CANARY_RUN_ID` is database-global after migration `0774`: the same new UUID on every overlapping process permits one canonical claim only. `NTF_OUTBOX_MAX_CLAIMS_PER_BOOT=1` remains a defense-in-depth process limit. A canary still requires **exactly one active Render worker instance** for clean evidence; do not use it during autoscaling or an unverified duplicate service.

## Preflight before every deployment or canary

1. Confirm Render shows one active worker instance and no rollout is in progress.
2. Confirm the deployment build for `platform-workers` passed and the released source contains the canary and shadow gates.
3. Confirm Render startup contains `legacy BullMQ dispatch is disabled`.
4. For normal observation, confirm minute-level `ntf-outbox-shadow` lines occur from one process only. For capacity containment, confirm the explicit `Notification outbox shadow probe is disabled` warning instead.
5. Confirm `HQ_JOBS_API_URL` points to the deployed private HQ jobs base path and both services use the same dedicated machine key. Verify with a fake IDs stale-claim probe; it must return `200 {"kind":"STALE_CLAIM"}` and must not create a canonical row, HQ command, or provider request.
6. Capture the remote canonical state and verify no legacy notification HTTP scheduler exists:

```sql
SELECT status, reconcile_state, count(*) AS rows
FROM public.org_ntf_outbox_dtl
GROUP BY status, reconcile_state
ORDER BY status, reconcile_state;

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname ILIKE '%ntf%'
   OR command ILIKE '%notifications/process-outbox%'
   OR command ILIKE '%reconcile-outbox%'
ORDER BY jobid;
```

7. Keep all query results free of recipients, rendered content, machine keys, authorization headers, and raw provider payloads.

## Supabase Disk I/O investigation

The warning is not proof that the worker is the source. While delivery is disabled, one worker process issues six shadow reads per minute for five active tenants, plus two or three small registry RPCs per minute. Duplicate Render processes multiply that load. The prior Upstash request-limit incident is unrelated to Supabase Disk I/O.

Capture the following twice, five minutes apart, before changing cadence or pausing observation:

```sql
SELECT n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_stat_statements';
```

If the returned schema is `extensions`, run:

```sql
SELECT
  calls,
  total_exec_time,
  mean_exec_time,
  shared_blks_read,
  temp_blks_read,
  temp_blks_written,
  left(query, 400) AS query
FROM extensions.pg_stat_statements
WHERE query ILIKE '%fn_ntf_outbox_due_sum%'
   OR query ILIKE '%fn_ops_worker_job_%'
   OR query ILIKE '%org_ntf_outbox_dtl%'
ORDER BY shared_blks_read + temp_blks_read + temp_blks_written DESC
LIMIT 20;

SELECT pid, application_name, state, wait_event_type, wait_event,
       now() - query_start AS running_for, left(query, 500) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state <> 'idle'
  AND pid <> pg_backend_pid()
ORDER BY query_start;

SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE active
ORDER BY jobid;
```

If the shadow probe is measured as a material contributor, set only `NTF_OUTBOX_SHADOW_ENABLED=false` and redeploy. Verify its explicit startup warning, repeat the same remote snapshots, and record the before/after result. This does not affect notification delivery because that remains separately disabled.

If capacity is immediately critical and no attribution can be obtained, suspend the Render worker service temporarily. This preserves data but pauses shadow telemetry, file-purge run-now requests, and scheduled HQ-worker work. Record the start/end time and resume only after the capacity incident is understood.

## One-claim notification canary

The Owner may authorize this only after the preflight passes, the Disk I/O investigation is no longer an active blocker, and one safe/authorized due record is identified. Do not use an uncontrolled production backlog as a canary fixture.

1. Deploy with the one-claim environment values from the configuration table and exactly one active worker instance.
2. Observe one `ntf-outbox-dispatch` log with `claimed:1`. Do not wait through a second timer tick.
3. Immediately set `NTF_OUTBOX_WORKER_ENABLED=false` and redeploy. Keep the per-boot budget in place.
4. Capture the exact canonical row and matching latest delivery log. Confirm one of:
   - terminal `SENT`, `SKIPPED`, `FAILED_TEMPORARY`, or `FAILED_PERMANENT` with an exact finalizer result; or
   - `PROCESSING` plus `ACCEPTANCE_UNCERTAIN`, requiring reconciliation before any retry.
5. Capture the HQ projection/provider evidence without exposing sensitive request content.
6. Append the evidence, decision, recipient/customer impact class, and next action to the I11 Progress Log. Do not expand batch size, tenant count, or duration without Owner sign-off and the defined soak evidence.

## Incident actions

| Signal | Immediate action | Prohibited action | Recovery evidence |
|---|---|---|---|
| Unexpected provider sends or more than one canary claim | Set `NTF_OUTBOX_WORKER_ENABLED=false`, redeploy, preserve logs and canonical rows | Deleting rows, blind retries, enabling legacy BullMQ alongside canonical worker | Exact rows, claim tokens, delivery log, HQ/provider outcome, single-instance evidence |
| `ACCEPTANCE_UNCERTAIN` | Disable delivery; correlate canonical row with HQ and provider evidence | Requeueing or finalizing based on an assumption | Provider-confirmed acceptance/absence or an approved dead-letter decision |
| HQ ingress configuration/validation failure before submission | Disable delivery if not already disabled; use exact error-fenced reconciliation only after proving no request was made | Broadly updating all `PROCESSING` rows | Exact matched rows, zero HQ/provider command evidence, immutable recovery attempts |
| Legacy BullMQ/Redis log or Upstash error | Keep `LEGACY_BULLMQ_ENABLED=false`; verify canonical delivery is disabled during containment | Raising Redis limits as a substitute for removing double execution | New startup line confirms legacy dispatch disabled; no new Redis worker errors |
| Supabase Disk I/O warning | Keep delivery disabled; capture attribution snapshots; verify one worker | Blaming the worker without evidence or changing schedules blindly | Before/after remote snapshots and documented operator decision |

## Evidence and completion record

For every deployment, canary, containment action, or recovery, append a dated I11 Progress Log row with:

- release identifier and active Render instance count;
- non-secret flag state;
- remote canonical summary and relevant immutable attempt evidence;
- Render/HQ log correlation IDs with sensitive content redacted;
- result, customer-impact class, rollback decision, and named Owner follow-up.

This runbook is complete only when the plan’s remote performance, reliability, 48-hour soak, and operator-signoff gates are evidenced. It does not close I11 by itself.
