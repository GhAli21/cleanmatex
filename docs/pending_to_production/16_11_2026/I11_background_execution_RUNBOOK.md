# I11 Background Execution — Production Runbook

> **SUPERSEDED (28 Nov 2026, Background Jobs step 9).** Historical record only; do not follow it. The current runbook is [docs/features/Background_Jobs/RUNBOOK.md](../../features/Background_Jobs/RUNBOOK.md). The pg-boss redesign replaced this runtime (platform-workers and the HQ worker claims were deleted in step 8).

**Status:** Active. Migrations `0782` through `0804` are applied on local and remote. **22 Nov 2026:** every job stays in one of three places ([expert replan §1.1](I11_background_execution_EXPERT_REPLAN.md)). For finance and campaigns, Postgres claims the due rows and one existing poster performs the effect. That build is not implemented yet. Do not call the tenant app for those jobs. The HQ API may claim shadow, dispatch, and file purge, and it can alert on a missing worker, old due mail, and growing uncertain rows. **Do not enable that host yet.** `PLATFORM_BG_ENABLED` stays unset. `PLATFORM_WORKER_LOOPS_ENABLED` stays unset, so Render `platform-workers` is still the only claimer. Notification delivery stays off. `ntf-outbox-reconcile` is not scheduled. Trial expiry is not a job. Safety sweep is **15 minutes** (D10). I11 stays open until the cutover below, S0–S7 and W1, and a 48-hour soak.  
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

## Current jobs (21 Nov 2026)

These HTTP wrappers stay **Retired**. Do not Enable, Restore, or Run now:

`ntf-outbox-processor`, `ntf-reconcile-outbox`.

These seven rows stay desired off. Source S0 no longer claims them from the HQ API or starts them in the worker. That source is not live until the HQ API and worker builds are deployed. Do not set their env flags. Do not Run now:

`ntf-campaign-scheduler`, `fin-outbox-processor`, `fin-gift-card-expiry`, `fin-credit-note-expiry`, `fin-loyalty-points-expiry`, `fin-erp-posting-retry`, `fin-pos-session-rollover`.

`0805` is applied. `fn_fin_gift_card_exp_due` only lists due gift cards. `expireGiftCard` locks the card, writes the expire ledger, and calls the existing general-ledger poster. HQ does not claim this job. Do not enable `fin-gift-card-expiry`.

`ntf-outbox-dispatch` and `ntf-outbox-shadow` are `HQ_WORKER` and stay desired off. `file-util-purge` is `HQ_WORKER`. Notification delivery is the one `HQ_JOB_API` operation and stays off. `fin-idempotency-cleanup` is SQL and `SYNC`. `tax-kit-update`, `file-util-expire`, `setup-health-refresh`, `cleanup-cron-job-run-details`, and `cleanup-net-http-response` are active SQL jobs and can be paused.

## Cutover — only after this HQ API build is deployed

Do these in one change. Doing only one of them drops file purge or starts a second claimer.

1. Deploy the HQ API build that contains the claim gate and the job alert. That build must not claim the seven finance and campaign job codes.
2. Set `PLATFORM_BG_ENABLED=true` on the HQ API and `PLATFORM_WORKER_LOOPS_ENABLED=false` on `platform-workers`, then restart both.
3. Leave `NTF_OUTBOX_WORKER_ENABLED` false.
4. Confirm `/ops/jobs` shows one worker heartbeat and no second claimer in the logs.

After that deploy is stable, implement S0–S7 and W1 in expert replan §1.1, then a provider-specific reconcile schedule, then a 48-hour soak, then removal of the retired HTTP cron paths. Trial expiry stays a separate product decision.

## WP0 operator freeze (D11 / D15)

After `0779` is applied, HQ `/ops/jobs` shows the two remaining HTTP wrappers as **Retired** (`SUPERSEDED`). The finance and campaign rows were later moved to HQ worker jobs by `0792` through `0798`. Do not treat those as retired.

## WP5 — one database handler at a time

`0784` through `0804` are applied. Remote idempotency cleanup runs `SELECT public.cleanup_expired_idempotency_keys()` daily at 03:00 and is recorded as `SYNC`. `0791` adds the read-only dead-letter list. `0792` through `0798` registered the finance and campaign jobs as HQ worker rows. The §1.1 build replaces their HTTP callers with a due-row claim plus the existing poster. They must not call the tenant app. `0799` through `0801` restore the tax, file-expiry, and setup-health cron rows and allow pause. `0803` and `0804` do the same for the two truncate jobs. None of these migrations send a notification.

## WP0.6 inventory (no secret values)

| Item | Finding | LISTEN / Redis implication |
|---|---|---|
| HQ API Redis | `REDIS_URL` is documented in `platform-api/.env.example` and is used in deployed HQ API for cache/limiter/locks (D8). | Not a job bus. Presence of Redis must not start BullMQ. |
| Session-mode Postgres | Local example `DATABASE_URL` targets the direct Postgres port (`54322`), which is session mode. Production LISTEN (WP2/D9) needs a **direct / session** URL, not the transaction pooler (`6543`). | Confirm the production session-mode URL exists before WP2; do not paste it here. |

## Required Render configuration

Do not put secrets or values in this document. The Owner sets the same dedicated `PLATFORM_WORKER_API_KEY` on HQ API and Render. Render uses the private HQ internal-jobs base URL for `HQ_JOBS_API_URL`.

HQ Config Registry (`/ops/config`, migration `0777`) inventories these names as `ENV_ONLY` host-managed metadata. The worker does not read registry stored values. Do not change those keys to a stored-value policy, and never paste `PLATFORM_WORKER_API_KEY` or `HQ_JOBS_API_URL` into the registry, chat, or tickets. HQ Check now cannot verify the Render worker environment.

| Situation | `NTF_OUTBOX_WORKER_ENABLED` | `NTF_OUTBOX_SHADOW_ENABLED` | `LEGACY_BULLMQ_ENABLED` | Canary limits |
|---|---:|---:|---:|---|
| Normal observation / incident recovery | `false` | `false` unless an aggregate snapshot is required | `false` or unset | N/A |
| Capacity containment after proof | `false` | `false` | `false` or unset | N/A |
| One-claim canary only | `true` | `true` | `false` or unset | New `NTF_OUTBOX_CANARY_RUN_ID` UUID; `NTF_OUTBOX_CANARY_TENANT_ID` fixture UUID; `NTF_OUTBOX_CLAIM_LIMIT=1`; `NTF_OUTBOX_MAX_CLAIMS_PER_BOOT=1`. No fixture means no claim. |
| Explicit legacy rollback | `false` | as required | `true` | Prohibited unless the Owner has approved the legacy rollback plan and no canonical worker can claim the same work |

`NTF_OUTBOX_CANARY_RUN_ID` is database-global after migration `0774`: the same new UUID on every overlapping process permits one canonical claim only. `NTF_OUTBOX_MAX_CLAIMS_PER_BOOT=1` remains a defense-in-depth process limit. A canary still requires **exactly one active Render worker instance** for clean evidence; do not use it during autoscaling or an unverified duplicate service.

## Preflight before every deployment or canary

1. Confirm Render shows one active worker instance and no rollout is in progress.
2. Confirm the deployment build for `platform-workers` passed and the released source contains the canary and shadow gates.
3. Confirm Render startup contains `legacy BullMQ dispatch is disabled`.
4. For normal observation, confirm `ntf-outbox-shadow` lines occur from one process only at the 15-minute safety tick, not once per minute. For capacity containment, confirm the explicit `Notification outbox shadow probe is disabled` warning instead.
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

The warning is not proof that the worker is the source. While delivery is disabled, one worker process issues shadow reads on the 15-minute safety tick (I11 D10), plus File Util registry RPCs on the same cadence. Duplicate Render processes multiply that load. The prior Upstash request-limit incident is unrelated to Supabase Disk I/O.

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

The Owner named the canary organization `11111111-1111-1111-1111-111111111111`. On 2026-11-21 one Run now claimed and finalized one email. Remote outbox `028b2104-5b98-4464-8eab-fe1dd8c7a4ad` is `SENT`, the claim and lease are cleared, and that organization has no queued-due, retry-due, or processing row. One canary run stays `CLAIMED`. Set `NTF_OUTBOX_WORKER_ENABLED=false` and restart. A later delivery enable without a new `NTF_OUTBOX_CANARY_RUN_ID` uses the global claim.

1. Deploy with the one-claim environment values from the configuration table and exactly one active worker instance. `NTF_OUTBOX_CANARY_TENANT_ID` is the organization above.
2. Observe one `ntf-outbox-dispatch` log with `claimed:1`. Do not wait through a second timer tick.
3. Immediately set `NTF_OUTBOX_WORKER_ENABLED=false` and redeploy. Keep the per-boot budget in place.
4. Capture the exact canonical row and matching latest delivery log. Confirm one of:
   - terminal `SENT`, `SKIPPED`, `FAILED_TEMPORARY`, or `FAILED_PERMANENT` with an exact finalizer result; or
   - `PROCESSING` plus `ACCEPTANCE_UNCERTAIN`, requiring reconciliation before any retry.
5. Capture the HQ projection/provider evidence without exposing sensitive request content.
6. Append the evidence, decision, recipient/customer impact class, and next action to the I11 Progress Log. Do not expand batch size, tenant count, or duration without Owner sign-off and the defined soak evidence.

The canary also requires `NTF_OUTBOX_CANARY_TENANT_ID`. Without that fixture UUID the worker claims nothing and does not list organizations.

## Manual exact-token reconciliation

Do not register or run `ntf-outbox-reconcile` until dispatch has soaked. Do not scan organizations. Do not update `org_ntf_outbox_dtl` by hand. Do not requeue a lease because it expired.

One uncertain row is settled only after provider evidence, then one call to `fn_ntf_worker_reconcile_claim` with that row's `tenant_org_id`, `outbox_id`, and `claim_token`:

| Evidence | Decision |
|---|---|
| Provider lookup failed | Leave the row unchanged |
| No lookup is possible | `FAILED_PERMANENT`. This is operator review, not a resend |
| Twilio has no message (404 / 20404) and retries remain | `FAILED_TEMPORARY` |
| Twilio has no message and the retry cap is spent | `FAILED_PERMANENT` |
| Twilio accepted or delivered, or Meta already returned a message id | `SENT` |
| Twilio reported a permanent failure | `FAILED_PERMANENT` |

`reconcileOutboxClaim` is the only writer. A `false` result means the claim token no longer matches; stop. Do not try the next row.

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
