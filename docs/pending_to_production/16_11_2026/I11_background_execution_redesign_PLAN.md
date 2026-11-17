# Background Execution Redesign — Implementation Plan

**Status:** In progress — Phase 0 discovery only; no schedule, runtime, credential, migration, or deployment change is approved by this document
**Written:** 17 Nov 2026  
**Scope:** `cleanmatex` (database authority and tenant services) and `cleanmatexsaas` (HQ API, web, and `platform-workers`)  
**Related readiness blocker:** [03 — Infrastructure, Deploy and Operations](03_infrastructure_deploy_and_operations.md) I11/I11a

## Objective

Make background work reliable, observable, tenant-safe, and independent of Vercel request lifecycles.

| Runtime | Owns | Does not own |
|---|---|---|
| Vercel | Frontend, bounded request/response work, authenticated user APIs, inbound webhooks | Polling, cron, queue consumers, long-running or retrying work |
| Render — HQ `platform-workers` | Queued external effects, provider calls, retries, batch/long-running work | Browser credentials, tenant UI behavior, duplicate scheduling |
| Supabase/PostgreSQL | Data, RLS, transactions, database-native functions, `pg_cron` for database-native schedules | Provider transport or storage-byte deletion that cannot happen in SQL |
| HQ `platform-api` `jobs-need-api` | A narrow, machine-authenticated fallback ingress only when DB and worker-direct execution are both impossible | A generic proxy, arbitrary command runner, or routine worker execution path |

## Non-negotiable invariants

1. Classify a job before implementation: `DATABASE`, `HQ_WORKER`, or the exceptional `HQ_JOB_API`.
2. One job has one scheduler: `pg_cron` for `DATABASE`; BullMQ/Render worker scheduling for `HQ_WORKER`; no double-fire path.
3. All external effects are at-least-once and idempotent. A duplicate delivery, financial posting, or provider call is a defect.
4. Claims are atomic and bounded. Use a durable lease/heartbeat and recovery path; do not rely on in-memory locks.
5. Every `org_*` write explicitly assigns or filters `tenant_org_id`, including worker and SQL paths.
6. `sys_ops_job_cf` is the approved operational registry and audit/control plane. It must never expose free-form SQL, shell, URLs, or secrets to HQ users.
7. A scheduled tick means dispatched/claimed, not completed. Completion is recorded only by the executor.
8. Scheduled functions and worker credentials are least-privilege. `anon`, `PUBLIC`, and browser clients cannot invoke privileged job operations.
9. Scheduled work has input limits, batch limits, timeouts, retry classification, dead-letter/review behavior, structured logs, and low-cardinality metrics.
10. Every change preserves financial transaction/lock order, tenant isolation, provider idempotency, and existing audit records.
11. **Remote Supabase is the only authority** for production readiness, scheduler state, backlog, job history, and deployment decisions. Use read-only remote queries for discovery; local DB may support unit/integration development only and must be labelled non-authoritative.

## Progress protocol — required after every task

**No checkbox may be marked complete until its completion record is written below in the same change.** For every completed, blocked, or superseded task:

- update its checkbox and `Status` column;
- add one row to the Progress Log with date, evidence link/command, owner, result, and next action;
- update every affected feature's `PLAN.md`, `STATUS.md`, `RESUME_CONTINUATION.md`, progress summary, QA/testing guide, deployment/runbook, and changelog where that document exists; create no duplicate source of truth;
- if a decision changes ownership, target runtime, API contract, schema, schedule, or rollout, update the approved ADR and both copies of `docs/dev/rules/integration-contracts.md`;
- do not claim production readiness from lint/build alone; record the runtime evidence separately.

Status values: `Planned` → `In progress` → `Blocked` / `Complete`; a task may be `Complete with follow-up` only when its follow-up has an owner and due condition.

### Documentation synchronization checklist — required after every task

The task owner must identify the related documents before marking any implementation, decision, verification, deployment, or rollback task complete. Update the applicable documents in **both repositories** in the same logical change:

| Change made | Documentation that must be synchronized |
|---|---|
| Plan/design/ownership decision | This plan's Progress Log; related feature `PLAN.md`; ADR when the decision is architectural or cross-project; `integration-contracts.md` when ownership/contract changes |
| Code, schema, API, worker, or UI implementation | Feature `STATUS.md`; progress summary/resume file; developer guide/API contract; testing guide/scenarios; changelog/version when maintained |
| Migration drafted/applied | Migration plan/status; schema/type regeneration evidence; deploy guide; rollback/runbook; affected database/feature documentation |
| Test, browser QA, performance test, soak, canary, or security review | This plan's Progress Log; test/QA guide result; feature status; evidence link; unresolved findings and next action |
| Deployment, configuration, schedule, secret rotation, alert, or incident | Deploy guide/runbook; environment-variable/owner inventory; feature status; incident/recovery record; Progress Log |
| Retired route, scheduler, credential, or feature | Caller inventory evidence; changelog; runbook; feature status; integration contract/rules when the supported boundary changes |

If a listed document does not exist, record `N/A` and the reason in the Progress Log. Never state “complete” while related documentation still describes the old behavior.

## Delivery boundaries and repository workstreams

This is a cross-project change. The database remains owned by `cleanmatex`; HQ consumes it with service-role access after the Owner applies approved migrations. No worker, API, or web change may invent a second source of truth for job state.

| Workstream | Primary repo / module | Responsibility | Required companion work |
|---|---|---|---|
| Registry, state, functions, RLS, schedules | `cleanmatex/supabase/` | Durable job contracts, DB-native work, `pg_cron`, permissions | New reviewed migration, object comments, DB tests, post-apply generated types in both repos |
| Tenant-owned domain logic | `cleanmatex/web-admin/lib/services/` and existing APIs | Preserve domain invariants while removing scheduled HTTP dependence | Explicit tenant predicates, targeted service tests, delete retired route only after caller inventory is empty |
| Worker execution | `cleanmatexsaas/platform-workers/src/` | Queue scheduler/consumer, provider adapters, leases, retries, safe shutdown | Build/tests, Render health/alerts, Redis sizing/recovery evidence |
| HQ job control API | `cleanmatexsaas/platform-api/src/modules/ops-jobs/` | Registry/admin actions, audit, safe run-now, health projection | DTO validation, permission guards, controller/service/repository tests |
| Exceptional API only | `cleanmatexsaas/platform-api/src/modules/jobs-need-api/` | Approved machine-to-machine boundary when direct worker/DB options are impossible | ADR exception, fixed allowlist, machine auth, replay and timeout tests |
| HQ operations UI | `cleanmatexsaas/platform-web/` | Safe status, drift, history and operator actions | Existing Cmx pattern, EN/AR/RTL, accessibility, permissions and browser QA |
| Deployment and operations | Render, Supabase, Vercel/HQ deployment config | Deployment sequencing, secret rotation, alerts, runbooks, rollback | Owner evidence; no secret in source or job registry |

### Required pre-code decision record for every handler

Create one decision record per handler in the Phase 0 inventory. A job name can hide multiple handlers; each handler needs its own classification.

| Field | Required content |
|---|---|
| Identity | Job code, handler name/version, owning module, owning team |
| Trigger | Schedule/manual/event, intended frequency, scheduler identity, time-zone requirement |
| Scope | Global or tenant-scoped; every tenant source/query/write listed |
| Inputs and output | Typed payload/reference, size ceiling, ordering, output/side effect |
| Side effects | DB transaction, provider request, storage operation, email/SMS/push/finance effect |
| Target decision | `DATABASE`, `HQ_WORKER`, or approved `HQ_JOB_API`, with rejected alternatives |
| Admission | Permissions, machine identity, secret source, idempotency/unique key |
| Reliability | Claim/lease, timeout, retry classes/backoff, dead-letter owner, manual recovery |
| Operations | Metrics, alert threshold, dashboard view, runbook, rollback and decommission condition |
| Proof | Tests, staging fixture, soak/canary evidence and linked Progress Log row |

## Initial classification register — hypotheses to verify, not implementation authority

The following maps the currently reported I11/I11a list to the expected target. A Phase 0 trace may change a target; no schedule is enabled from this table alone.

| Job / handler | Expected target | Why / required verification |
|---|---|---|
| `ntf-outbox-processor` | `HQ_WORKER` (confirmed external boundary) | Tenant route has durable tenant-scoped claim/lease and uncertain-acceptance protection around provider calls. Reconcile it with the separate existing HQ dispatch worker before any cutover; never run both against the same outbox rows. |
| `ntf-reconcile-outbox` | `HQ_WORKER` (confirmed external boundary) | Legacy `ntf_trigger_reconcile_proc` is an HTTP bridge to the tenant route. Trace the provider-status contract and enforce monotonic state merge before replacement. |
| `ntf-outbox-retry` | `DATABASE` (execution class confirmed) | Legacy restore command directly requeues eligible `FAILED_TEMPORARY` rows; it makes no provider call. Replacement must add a bounded, tenant-safe claim/update contract rather than preserving free-form SQL. |
| `ntf-campaign-scheduler` | `TBD` | It currently bridges to a tenant route that expands campaigns into inbox/outbox rows. The route has bounded campaigns/targets and idempotency keys but scans tenant work globally; decide whether a database function can preserve those semantics or a worker must own the orchestration. |
| `ntf-quota-rsv-sweep`, `ntf-retention-sweep` | `DATABASE` (confirmed execution class) | Remote functions perform local reservation expiry/retention cleanup. Before scheduling, review privileges, scope, batch/lock duration, and retention policy. |
| `ntf-sweep-stale-push-subs` | `TBD` | `DATABASE` if local expiry only; `HQ_WORKER` if it calls FCM/provider APIs. |
| `fin-outbox-processor` | Split by handler | Current `fin_trigger_outbox_proc` is a direct HTTP bridge. DB ledger/state work stays `DATABASE`; only external transport can be `HQ_WORKER`. |
| `fin-pos-session-rollover` | `DATABASE` | Financial state transition needs one DB transaction and reviewed lock order |
| `fin-credit-note-expiry`, `fin-gift-card-expiry`, `fin-loyalty-points-expiry` | `DATABASE` | Domain state transitions; verify accounting/audit side effects and batch safety |
| `fin-erp-posting-retry` | `TBD` | `DATABASE` for local posting; `HQ_WORKER` only for a real external ERP call |
| `auth-session-sweep` | `DATABASE` | Security/session data boundary remains in the database |
| `cleanup-cron-job-run-details`, `cleanup-net-http-response` | `DATABASE` | Supabase/extension maintenance; preserve only after retention and platform ownership are documented, never move to a worker |
| `ops-job-run-capture` | `DATABASE` | Copies scheduler facts into durable history; no external effect |
| `tax-kit-update`, `setup-health-refresh`, `fin-idempotency-cleanup` | `DATABASE` (Setup Health/idempotency confirmed) | Remote `fn_setup_health_refresh_all` and finance idempotency cleanup are data-native. Verify the remaining tax handler before retaining or replacing its schedule. |
| `file-util-expire` | `DATABASE` | Existing DB half of the approved file lifecycle split |
| `file-util-purge` | `HQ_WORKER` | Storage bytes are outside PostgreSQL; existing implementation is the reference pattern |
| Trial expiry | `DATABASE` | Subscription-state transition; its product outcome remains an Owner decision |

## Execution model and data contracts

### Database-native lifecycle

```text
pg_cron tick
  -> fixed SECURITY DEFINER or service-role-only function
  -> validate schedule/job enabled state
  -> atomically claim bounded eligible work
  -> apply one transactional domain transition per safe unit
  -> write durable outcome / next eligibility / audit facts
  -> emit aggregate run result
```

- Functions use a locked `search_path`, explicit grants, and no browser-invokable execution grant.
- A single long-running database transaction must not hold a broad lease while processing an unbounded collection. Claim bounded units and preserve domain lock order.
- `pg_cron` invokes a fixed database function. It does not POST to Vercel, call a tenant route, or interpolate schedule-controlled text.

### Worker lifecycle

```text
DB creates durable work/reference
  -> worker scheduler creates approved queue work
  -> worker atomically claims DB reference and starts lease
  -> typed adapter calls provider with stable idempotency key
  -> worker writes terminal result, retry time, or dead-letter reason
  -> HQ projects durable completion and operational health
```

- Queue payloads carry references and correlation IDs, not provider secrets or unrestricted customer records.
- Redis/BullMQ is transport and scheduling support; PostgreSQL remains the durable business/outcome authority.
- A provider timeout is an **unknown outcome**, not an automatic resend. Reconcile provider state or use the same provider idempotency key before retrying.
- Worker shutdown stops new claims, lets bounded in-flight work finish within a deadline, and leaves expired leases recoverable.

### Job state and run semantics

Use existing compatible schema where possible; otherwise design reviewed forward migrations rather than creating parallel ad-hoc state.

| Concept | Minimum semantics |
|---|---|
| Desired state | HQ operator intent: enabled/disabled plus approved schedule override |
| Actual scheduler state | Live `pg_cron` or worker scheduler state; never inferred from desired state |
| Run | A distinct scheduled/manual attempt with start/end, executor, correlation ID, and immutable outcome |
| Claim/lease | Atomic ownership of a bounded work unit, expiry, heartbeat, and safe release/recovery |
| Completion | `SUCCESS`, `SKIPPED`, `RETRY_SCHEDULED`, `DEAD_LETTERED`, or classified failure; never equate dispatch with success |
| Idempotency | Stable domain/provider key plus durable result so replay cannot duplicate a business or provider effect |
| Dead letter | Preserved payload reference and safe diagnostic reason; requires named owner/runbook, never silent deletion |

## `jobs-need-api` exception gate

Do not create this module merely because an HTTP call is familiar. It is allowed only when all answers below are recorded and approved in the handler decision record.

| Question | Required answer to proceed |
|---|---|
| Why not SQL? | The operation cannot safely run in PostgreSQL because of a concrete non-database dependency or runtime restriction. |
| Why not a worker adapter? | The worker cannot call the dependency directly due to a documented third-party inbound contract, network boundary, or existing controlled service boundary. |
| Why HQ API? | `platform-api` is the correct authoritative service boundary, not Vercel/web-admin, and the endpoint can stay internal. |
| Who calls it? | Identified machine principal with rotated secret/identity, scoped permission, replay protection, and network exposure decision. |
| What is allowed? | One typed action/version and strict schema; no arbitrary URL, command, SQL, event type, or tenant override. |
| How does it finish? | The endpoint is bounded and either completes safely or hands off durably; status is visible through run history. |
| When is it removed? | A stated decommission trigger and owner. |

## Security and privacy checklist

| Control | Required implementation/review outcome |
|---|---|
| Database privilege | SECURITY DEFINER functions have locked `search_path`, least grants, no `anon`/`PUBLIC` execution, and default privilege posture is safe |
| Tenant isolation | Every `org_*` read/join/write has direct `tenant_org_id` predicates/assignment; cross-tenant workers use explicit scoped operations only |
| Machine identity | Separate service credentials per runtime where feasible; rotation owner/date; no service role in browser/Vercel public env |
| Ingress | Webhooks verify signature/timestamp/replay; internal API verifies machine caller and idempotency key |
| Payload/logs | No credentials, raw authorization headers, payment data, or unnecessary customer content in BullMQ payloads/logs/alerts |
| Provider calls | Per-provider idempotency, timeout, retry classification, quota/rate-limit handling, and status reconciliation |
| Operator actions | Least-privilege HQ permission, confirmation for mutating actions, immutable audit event with actor/correlation |
| Retention | Retain job/run diagnostics only as long as operationally/legal necessary; cleanup is bounded and auditable |

## Performance and capacity plan

No fixed performance number is assumed before baseline measurements. For each handler, record expected input size, batch size, concurrency, query/request growth, provider limits, and failure behavior.

| Concern | Required approach |
|---|---|
| Database load | Select/lock only due rows with stable order, indexes justified by measured tenant-scoped predicates, bounded batches, and `SKIP LOCKED` only where claim semantics are correct |
| Worker concurrency | Per-queue and per-provider bounds; no unbounded `Promise.all`; protect Redis, DB pool, and provider quota |
| Fairness | Avoid one noisy tenant starving others; use deterministic ordering/partitioning only after measuring the workload |
| Retry storms | Exponential backoff with jitter, capped attempts, provider-aware 429 handling, and circuit/hold behavior where a provider is unhealthy |
| Observability | Measure queue age, due-work age, claim latency, handler duration p50/p95, retry/dead-letter rate, provider latency, DB query count/plan pressure, Redis backlog |
| Scaling | Scale workers only after preserving idempotency/lease safety; test multiple worker instances and rolling deploy overlap |

## HQ operations UI and user experience requirements

The HQ UI is an operations console, not a job implementation surface. It must make safe actions understandable without exposing technical secrets.

| Surface | Required behavior |
|---|---|
| Job list | Show code/name, execution target, desired/actual scheduler state, healthy/degraded/drift state, last **completion**, next schedule, queue/due age, and safe filter/sort |
| Job detail | Show configuration source, bounded recent runs, attempt/lease summary, failure reason safe for operators, linked audit records, and runbook link |
| Enable/disable | Explicit Cmx confirmation explaining effect and in-flight behavior; localized `cmxMessage` result; no hidden toggle mutation |
| Run now | Announces whether it was accepted, skipped, or completed; never reports async dispatch as completed; prevents unsafe overlap |
| Dead letters | Privileged review/retry/discard only with reason, correlation link, and audit; no raw payload/secret disclosure |
| Accessibility/i18n | Cmx components, keyboard/focus behavior, EN/AR keys, RTL layout, status text not color-only, responsive operator workflow |

## Test and evidence plan

| Layer | Mandatory scenarios |
|---|---|
| Database | Empty/due/large batch, lock contention, repeat tick, lease expiry, tenant mismatch, unauthorized call, scheduler disabled, transaction failure, retention cleanup |
| Worker | Start/restart/shutdown, Redis unavailable/reconnect, two workers claim race, duplicate queue message, timeout unknown outcome, 429, 5xx, permanent provider error, poison event |
| Provider adapters | Stable idempotency key, signature/credential handling, safe request mapping, reconciliation ordering, provider-specific retry contract |
| HQ API | Machine auth rejection, allowlist rejection, malformed payload, replay, deadline, audit, no arbitrary action/destination, run-now overlap |
| HQ web | Permissions, EN/AR, RTL, keyboard/focus, confirmation/cancel/recovery, dispatch-versus-completion semantics, responsive width |
| Integration | DB-to-worker handoff, worker-to-provider outcome, provider reconciliation, disable/re-enable, schedule drift, no duplicate external/finance effect |
| Runtime | Staging 48-hour soak, representative-load measurement, alert delivery, canary, rollback rehearsal, post-deploy state reconciliation |

## Rollout, rollback, and incident handling

1. Change one handler at a time, beginning with a non-financial, low-risk external effect.
2. Before cutover, establish a shared durable claim so old and new paths cannot both perform the effect.
3. Shadow only observation/eligibility where it cannot cause a side effect; never shadow-send customer notifications or financial actions.
4. Canary with a controlled tenant/fixture and explicit metrics. Expand only after the defined soak window passes.
5. Rollback disables the new scheduler/consumer first, preserves queue/outcome evidence, and restores the previously proven executor only if the shared claim prevents duplicates.
6. A provider-wide fault pauses new external dispatch according to the runbook; do not discard pending work or blind-retry unknown outcomes.
7. Every incident records time line, correlation IDs, affected tenants, customer impact, data repair decision, and prevention follow-up in the Progress Log/runbook.

## Phase 0 — Baseline and safe freeze

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 0.1 Inventory every enabled/missing `sys_ops_job_cf` row, its current `cron.job` command, real handler, data touched, outbound effects, schedule, concurrency, and owner. Do not restore missing schedules yet. | Dev | Complete | All 20 registry handlers and the active unregistered tax handler are inventoried; DB-native, external-provider, and legacy HTTP boundaries are recorded. |
| 0.2 Capture the **authoritative remote** baseline: queue/outbox counts, failures, job duration/overlap, cron history, provider error rates, and existing run records. Redact secrets/PII. Local output may only support development diagnosis. | Dev | Complete | Timestamped remote baseline attached to Progress Log |
| 0.3 Identify existing API-route calls from `pg_cron`/`pg_net`, including their credentials and idempotency behavior. | Dev | Complete | Five-route remote call graph, credential-source class, and route reliability boundary recorded; no secret values exposed. |
| 0.4 Define the production pilot freeze: no job enablement, schedule repair, or worker deployment until its job has a reviewed classification and rollback path. | Owner + Dev | In progress | Recorded owner decision |
| 0.5 Update plan status/progress for 0.1–0.4. | Dev | In progress | Progress Log entries added |

**Phase exit:** the current state is known, including the 13+ missing schedules; nothing is re-enabled merely to make the dashboard look healthy.

### Phase 0 baseline findings — 17 Nov 2026

**Evidence boundary:** remote Supabase was queried read-only on 17 Nov 2026 and is authoritative below. The earlier local snapshot remains development-path diagnosis only and is not used for production decisions. No SQL, migration, schedule, worker, credential, or deployment was changed.

| Finding | Evidence | Consequence / next action |
|---|---|---|
| Registry versus scheduler state | **Remote:** 20 active registry rows, 19 `desired_enabled`, and only 5 `cron.job` rows present/active. Fourteen desired-enabled jobs are absent; the disabled campaign scheduler is also absent. | The I11a blocker is confirmed and worsened versus the older wording. Complete handler classification before any state change. |
| Active remote registered jobs | `cleanup-cron-job-run-details`, `cleanup-net-http-response`, `file-util-expire`, `fin-idempotency-cleanup`, and `setup-health-refresh` are the five registry-backed jobs with active remote schedulers. | Classify their handlers before retaining or moving schedules. |
| Active unregistered job | Remote `cron.job` also has `tax-kit-update` active at `5 2 * * *`, calling `fn_tax_kit_update_all()`, but there is no active `sys_ops_job_cf` row for it. | This is an operational-control gap: HQ cannot show drift, audit actions, or enforce the future ownership model. Add it to the decision/registry migration only after its DB-native contract is reviewed; do not silently alter its current schedule. |
| Missing desired-enabled remote jobs | `auth-session-sweep`; finance credit-note/ERP/gift-card/loyalty/outbox/POS jobs; and notification outbox/retry/quota/reconcile/retention/push-sweep jobs are absent from remote `cron.job`. | Determine the approved DB/worker target and rollback path; do not restore legacy HTTP schedules automatically. |
| Frequency drift | Registry has invalid or unsafe effective schedules, including `*/500`, `*/660`, `*/59`, `30 2 */1 * *`, and multi-day notification sweep expressions. | Treat schedules as configuration defects requiring reviewed correction, not as values to copy to a worker scheduler. |
| Recent execution | In the remote 48-hour window, only `cleanup-net-http-response` (1), `file-util-expire` (3), `fin-idempotency-cleanup` (1), and `setup-health-refresh` (1) recorded completed runs; no registered job recorded a failed run. | Absence of failures is not health: most desired-enabled jobs did not execute at all. |
| Existing HTTP dependency | Source confirms `pg_cron` wrappers that ultimately call tenant `web-admin` routes for notification outbox, campaign processing, financial outbox, and financial jobs. | These are the first legacy HTTP paths to trace; target decision remains pending handler-by-handler classification. |
| Remote function catalog | Remote function definitions identify `fin_trigger_outbox_proc` → `/api/finance/process-outbox`, `fin_trigger_job` → `/api/finance/process-jobs`, `ntf_trigger_outbox_proc` → `/api/notifications/process-outbox`, and `ntf_trigger_campaign_proc` → `/api/notifications/process-campaigns`. | The routes are confirmed legacy scheduled ingress. Their cron rows are absent remotely, so no legacy scheduler is currently firing them; preserve that safety state while replacement design is reviewed. |
| Complete legacy HTTP call graph | A remote function-definition scan found exactly five public functions with `/api/` targets: finance outbox/jobs plus notification outbox/campaign/reconcile. Finance reads its runtime URL/secret configuration directly; notification uses a vault/config helper. | Every existing scheduled HTTP ingress is now enumerated without exposing a secret. Retire or replace only after its executor and shared idempotency/claim boundary are proven. |
| Execution-class proof | Remote functions show notification reservation sweep and retention sweep are local database work; Setup Health refresh loops active tenants and invokes a DB summary function. Notification outbox and reconciliation ultimately use `pg_net` to reach tenant API routes. | Preserve DB-native work in Supabase; move only external-provider execution to HQ workers. Complete the remaining handler-level safety and batching review before enabling any schedule. |
| Legacy control-plane limitation | The current restore registry keeps fixed SQL command text, including a direct notification retry update and legacy `pg_net` requests. The campaign route bounds activation (10) and target processing (50) with idempotency keys, but its global candidate queries are not explicit tenant-scoped. | Phase 2 must remove stored-command execution from the supported model. Any database replacement needs bounded claim semantics and explicit tenant filtering; campaign target is not decided until that parity review is complete. |
| Notification dispatcher split | The tenant `process-outbox` route contains its own provider calls, durable tenant claims, uncertain-acceptance handling, and retry logic; HQ `platform-workers` separately contains a notification dispatch processor with provider adapters. | Do not migrate either path until their producers, ownership, idempotency keys, and authoritative outbox states are reconciled. Running both against the same notification work would risk duplicate customer messages. |
| Finance dispatcher is tenant-service orchestration | `finance-jobs.service.ts` calls tenant services/Prisma for expiry, POS rollover, ERP retry, and outbox handling; the existing `pg_cron` functions only dispatch to tenant HTTP. The outbox handlers observed so far are in-process domain consumers rather than provider calls; POS rollover emits a notification event after its committed state transition. | Each finance handler requires a transaction/lock-order and external-effect trace before it can be classified as DB-native or worker-owned. A later provider delivery remains the Notification worker's responsibility, not the finance scheduler's. |
| Existing worker precedent | `platform-workers` currently runs notification dispatch and the independently scheduled File Util byte purge; File Util already separates DB expiry from storage-byte deletion. | Reuse only the proven worker patterns after validating their scheduling/lease/observability gaps against this plan. |
| Notification backlog | **Remote recheck after owner cleanup:** 0 `QUEUED`, 1 `FAILED_TEMPORARY`, 45 `FAILED_PERMANENT`, 411 `SENT`, and 14 `SKIPPED` rows. | The 57 queued rows present at cleanup preparation were deleted by the Owner. Sender migration remains blocked on provider-delivery ownership and retry/reconciliation design; terminal and temporary-failure history was preserved. |

### Phase 0 handler evidence matrix — confirmed subset

| Handler | Current remote implementation | Scope / safety fact | Provisional target | Remaining exit check |
|---|---|---|---|---|
| Session sweep | `fn_auth_sessions_sweep(180)` | Database-managed session/end-state maintenance; no HTTP or provider effect found. | `DATABASE` | Verify bounded loop/retention behavior and private execution grants. |
| Stale push-subscription sweep | `ntf_sweep_stale_push_subs()` | Global database update deactivates stale/failed subscription rows; it does not call FCM. | `DATABASE` | Review boundedness before it is re-enabled; this historical function is not an executor for push delivery. |
| Notification quota reservation / retention sweeps | `fn_ntf_quota_rsv_sweep`, `fn_ntf_retention_sweep` | Database state cleanup; quota rows serialize reservation with an advisory lock. | `DATABASE` | Confirm batch/delete limits, security grants, and retention approval. |
| Tax kit update | `fn_tax_kit_update_all()` | Iterates qualifying tenant tax configurations and delegates to database update logic; per-tenant failures are retained. | `DATABASE` | Review transaction duration/lock order and migration security hardening before enabling. |
| File pending-upload expiry | `fn_file_util_expire_pending()` | Bounded 5,000-row database transition; storage-byte purge is intentionally separate. | `DATABASE` | Retain only after scheduler/control-plane decision; worker owns the bytes purge. |
| Operations run capture | `fn_ops_job_capture_runs()` | Idempotently copies finished `pg_cron` facts then prunes 90-day history. | `DATABASE` | Validate capture retention load against all final schedules. |
| Extension housekeeping | `cleanup-cron-job-run-details`, `cleanup-net-http-response` | Existing active `pg_cron` jobs purge extension history/response rows; they are platform-database maintenance, not tenant application work. | `DATABASE` | Confirm current retention semantics with Supabase and ensure the HQ registry cannot make their destructive commands arbitrary. |
| Finance idempotency cleanup | `cleanup_expired_idempotency_keys()` | Single database cleanup function; no HTTP path. | `DATABASE` | Establish safe batch/retention and execution grant evidence. |
| Notification outbox / reconciliation | Tenant routes reached through `fn_ntf_cron_post` + `pg_net`; outbox route performs provider calls under claims. | External provider side effect and unknown-acceptance recovery required. | `HQ_WORKER` | Reconcile the tenant and existing HQ worker state machines before cutover. |
| Notification retry | Legacy restore command directly changes eligible outbox rows from temporary failure to queued. | No provider call; existing command is unbounded/global SQL. | `DATABASE` | Replace command text with a fixed, bounded, tenant-safe function and prove concurrent retry/dispatcher behavior. |
| Campaign expansion | Tenant route activates due campaigns and turns targets into inbox/outbox work with 10-campaign / 50-target limits and per-target idempotency keys. | No provider call in the expansion route, but it currently has global candidate scans and application-layer policy. | `TBD` | Prove a database-function design can preserve consent/quiet-hours/template/idempotency semantics; otherwise use a worker without calling Vercel. |
| Finance outbox/jobs | `fin_trigger_*` uses `pg_net` to call tenant routes; route dispatches service-level sub-handlers. | Cross-tenant service orchestration and possible financial/external effects. | Split per sub-handler | Complete transaction/lock-order and external-effect trace. |
| Finance expiry, ERP retry, and POS rollover | Tenant services enumerate tenants or live sessions then perform one domain transition at a time. Gift/credit/loyalty and ERP retry use tenant context and transactional ledger/posting services; POS uses a per-session transaction and emits a later notification event. | The scheduled work itself has no direct provider call in the reviewed paths, but its current TypeScript implementation is not yet a database function. | `DATABASE` candidate | Define fixed DB functions with parity for ledger/audit/idempotency/lock order and bounded work; do not move financial state work into BullMQ merely because it is scheduled. |

## Phase 1 — Job classification and architecture decision

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 1.1 Classify each handler, not merely each job name, using this decision order: SQL-only transactional work → `DATABASE`; external I/O or long/batched work → `HQ_WORKER`; only an unavoidable inbound/third-party HTTP contract after both are rejected → `HQ_JOB_API`. | Dev | Complete | Owner approved the proposed target matrix on 17 Nov 2026; no current `HQ_JOB_API` exception is justified. |
| 1.2 Confirm the initial candidates: DB-native includes trial expiry, retry eligibility, retention/quota sweeps, POS rollover, expiry jobs, session sweep, tax/setup refresh, idempotency cleanup, file pending-upload expiry, and cron-run capture. Treat every candidate as provisional until its real handler is traced. | Dev | Complete | [Handler contracts](I11_background_execution_handler_contracts.md) record the confirmed boundary, parity requirements, and tests for each family. |
| 1.2a Register `tax-kit-update` properly in the HQ control plane. Draft one forward migration in `cleanmatex` that creates its `sys_ops_job_cf` metadata and immutable fixed restore/command metadata only after the approved database-job contract is defined. It must attach to the already-live `cron.job` without duplicate scheduling or changing its current `5 2 * * *` schedule. | Dev writes; Owner applies | In progress | Migration acceptance criteria and no-duplicate proof are defined in the handler contracts; draft only in Phase 2. |
| 1.3 Confirm worker candidates: notification dispatch and provider reconciliation; split `fin-outbox-processor` by handler so DB-only postings are not moved behind a network queue. | Dev | In progress | Handler contracts define worker versus database boundary and the notification single-authority gate. |
| 1.4 Write/approve an ADR covering scheduler ownership, job state machine, lease semantics, failure/retry/dead-letter policy, registry authority, metrics, retention, and rollback. | Owner approves; Dev writes | In progress | [I11 background-execution ADR](I11_background_execution_redesign_ADR.md) drafted from the approved target matrix; per-handler implementation contracts remain. |
| 1.5 Update plan status/progress for 1.1–1.4 and 1.2a. | Dev | In progress | Progress Log entries added |

**Phase exit:** no implementation has an unclear owner or two schedulers.

### Proposed Phase 1 decision matrix — pending ADR approval

| Handler family | Proposed target | Reason | Cutover condition |
|---|---|---|---|
| Session, extension-history, pg_net-response, File pending-upload, idempotency, notification retry/quota/retention/push-subscription, operations capture, Setup Health, and tax-kit maintenance | `DATABASE` | Their observed effects are database state, bounded cleanup, or scheduler-history maintenance; no provider request is required. | Fixed-function contract, narrow execution grants, bounded batches, overlap/recovery proof, and registry reconciliation. |
| Campaign activation and expansion | `DATABASE` | The current route creates internal inbox/outbox work only. Consent, quiet-hours, template resolution, idempotency, and counters must be reproduced by a fixed DB function—not a Vercel route. | SQL parity design proves all current policy behavior, tenant isolation, and 10-campaign/50-target batching before any switch. |
| Gift-card, credit-note, loyalty expiry; ERP posting retry; POS rollover; financial-domain outbox consumers | `DATABASE` | Reviewed scheduled paths perform domain/ledger/posting transitions and write later notification events; they make no direct provider request. | One reviewed database contract per domain with accounting/audit/lock-order parity, idempotent bounded claims, and financial replay evidence. |
| Notification delivery and provider reconciliation | `HQ_WORKER` | Provider calls and unknown acceptance require durable claims, provider idempotency, deadlines, reconciliation, and worker retry/observability. | One authoritative outbox state machine across tenant code and the existing HQ dispatch worker; no dual sender. |
| File byte purge | `HQ_WORKER` | Storage bytes live outside PostgreSQL and the established worker already owns physical purge. | Preserve the database expiry → worker purge handoff and prove restart/lease recovery. |
| `jobs-need-api` | `N/A` | No inventoried handler requires an API after the DB/worker decision order is applied. | Create an exception module only for a future documented case that rejects both direct paths and has Owner-approved ADR evidence. |

## Phase 2 — Shared control-plane contract

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 2.1 Design the registry evolution: execution target, immutable job identity, scheduler identity, desired state, safe schedule override, batch/concurrency limits, and source migration. Preserve existing HQ audit behavior. | Dev | Planned | Reviewed schema/API design |
| 2.2 Design durable execution state: run, attempt, claim lease, heartbeat, outcome, retry time, dead-letter reason, correlation ID, and retention. Reuse existing tables where they already meet the contract. | Dev | Planned | Table/function reuse decision and data lifecycle |
| 2.3 Define `Run now`: it must use the same executor and idempotency path as scheduled work; it cannot execute stored command text. | Dev | Planned | Contract and negative tests listed |
| 2.4 Define worker registry synchronization: only the worker reconciles its approved `HQ_WORKER` schedules into BullMQ; HQ API records desired state and audits it. | Dev | Planned | Eventual-consistency/disable semantics documented |
| 2.5 Add only approved forward migrations in `cleanmatex`; document every database object, lock privileges/search path, and do not apply migrations. Regenerate types only after owner application. | Dev writes; Owner applies | Planned | Reviewed migration + post-apply type plan |
| 2.6 Update plan status/progress for 2.1–2.5. | Dev | Planned | Progress Log entries added |

**Phase exit:** the control plane has a reviewed, tenant-safe contract and no generic command execution.

## Phase 3 — Database-native execution

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 3.1 Extract/implement one database function per DB-native job boundary. Keep business invariants and writes in one transaction; use explicit tenant predicates for each `org_*` table. | Dev | Planned | Function contract and tenant tests |
| 3.2 Register `pg_cron` only for approved `DATABASE` jobs. Schedule functions directly—never a Vercel or tenant-app API route. | Dev writes; Owner applies | Planned | `cron.job` matches registry and command allowlist |
| 3.3 Add overlap protection and bounded batch/loop behavior. Confirm the recovery path for a killed or timed-out invocation. | Dev | Planned | Concurrency and recovery tests |
| 3.4 Add DB-level tests for authorization, duplicate/overlap handling, tenant isolation, and each domain transition; add no test that requires a live provider. | Dev | Planned | Targeted test evidence |
| 3.5 Update plan status/progress for 3.1–3.4. | Dev | Planned | Progress Log entries added |

**Phase exit:** a DB-native job runs entirely in PostgreSQL with no HTTP request dependency.

## Phase 4 — Render `platform-workers` foundation

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 4.1 Validate Render worker prerequisites: persistent Redis, one compatible `ioredis` version, same-region placement, no scale-to-zero, Node version, health signal, secrets, logs, and deployment rollback. | Owner + Dev | Planned | Render configuration checklist |
| 4.2 Establish the worker module contract: queue naming, typed payloads, bounded concurrency, graceful shutdown, Redis reconnect behavior, structured logs, metrics, and alert thresholds. | Dev | Planned | Worker design + tests |
| 4.3 Implement durable claim/lease before provider work. The worker must recover expired leases without reclaiming an active attempt. | Dev | Planned | Lease race/recovery tests |
| 4.4 Implement scheduler reconciliation for `HQ_WORKER` jobs. Startup/redeploy must be idempotent; disable must prevent future scheduling and safely handle in-flight work. | Dev | Planned | Reconciliation/disable tests |
| 4.5 Add job-specific secrets only to Render/HQ secret management; no provider key enters the browser, registry, logs, or job payload. | Owner + Dev | Planned | Secret inventory and redaction test |
| 4.6 Update plan status/progress for 4.1–4.5. | Dev | Planned | Progress Log entries added |

**Phase exit:** a deployed worker can run a harmless fixture job reliably through restart, retry, disable, and recovery.

## Phase 5 — Migrate external-effect jobs incrementally

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 5.1 Migrate one low-risk external job first, using a shared claim so old and new executors cannot process the same row. Use shadow telemetry before cutover. | Dev | Planned | No duplicate claims; comparable metrics |
| 5.2 Migrate notification dispatch: database creates/claims the outbox state; worker sends through provider adapters and records provider idempotency/outcome. Preserve consent, pause, quota, template, and tenant checks. | Dev | Planned | Sandbox success, retry, permanent failure, duplicate-delivery tests |
| 5.3 Migrate provider reconciliation only after dispatch is stable. Reconciliation is read/merge-safe and cannot regress a newer terminal state. | Dev | Planned | Ordering/race tests |
| 5.4 Split finance outbox handlers. Keep DB-only accounting state inside database transactions; move only external integrations to workers with finance-grade idempotency and lock-order review. | Dev | Planned | Financial parity and replay tests |
| 5.5 Remove each legacy `pg_net`/web-admin API trigger only after its replacement has passed soak criteria. Delete credentials/routes that become unreachable. | Dev | Planned | No legacy scheduler/call path remains |
| 5.6 Update plan status/progress for 5.1–5.5. | Dev | Planned | Progress Log entries added |

**Phase exit:** external effects do not depend on Vercel or tenant API availability, and duplicate-provider effects are prevented.

## Phase 6 — Exceptional `jobs-need-api` path (only when justified)

This phase is **not assumed**. Open a task only with an ADR decision record proving that PostgreSQL functions and direct worker execution are both unsuitable.

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 6.1 Record the unavoidable HTTP requirement, rejected alternatives, data classification, caller identity, timeout, replay, and decommission condition. | Dev; Owner approves | Planned | Approved exception record |
| 6.2 Create the HQ `platform-api/src/modules/jobs-need-api/` module with a fixed action allowlist, machine authentication, schema validation, idempotency key, correlation ID, audit record, deadline, and safe async handoff. | Dev | Planned | Module/controller/service tests |
| 6.3 Keep it internal: no generic proxy URL, arbitrary destination, arbitrary payload-to-command mapping, tenant browser access, or UI/navigation unless separately approved. | Dev | Planned | Negative authorization/validation tests |
| 6.4 Add run-history linkage and health/alert behavior to HQ Ops Jobs. | Dev | Planned | Operator failure/retry scenario |
| 6.5 Update plan status/progress for 6.1–6.4. | Dev | Planned | Progress Log entries added |

**Phase exit:** the exceptional API has one reviewed purpose and can be removed when the dependency is retired.

## Phase 7 — HQ operations, frontend, and usability

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 7.1 Update HQ Ops Jobs to show execution target, intended versus actual scheduler state, last dispatch versus last completion, lease/attempt state, and actionable drift. | Dev | Planned | EN/AR browser QA and permissions test |
| 7.2 Keep actions safe and explicit: enable, disable, restore, and run-now use confirmation, `cmxMessage` feedback, Cmx components, EN/AR/RTL strings, least-privilege HQ permissions, and immutable audit entries. | Dev | Planned | Accessibility, RTL, and RBAC evidence |
| 7.3 Add health checks and alerts for no worker heartbeat, growing due queue, repeated failures, dead-letter growth, scheduler drift, and excessive job latency. | Dev | Planned | Deliberate failure reaches alert channel |
| 7.4 Do not add tenant-app pages/routes unless a confirmed tenant user need exists. If one is approved, use tenant access contracts, Cmx UI, EN/AR, and explicit tenant authorization. | Dev | Planned | N/A or approved UI contract |
| 7.5 Update plan status/progress for 7.1–7.4. | Dev | Planned | Progress Log entries added |

**Phase exit:** an HQ operator can understand job health and take audited, non-dangerous actions without access to secrets or commands.

## Phase 8 — Security, performance, and release proof

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 8.1 Security review: service-role boundaries, function grants/search paths, RLS, machine auth, replay protection, payload/log redaction, rate limits, and tenant isolation. | Dev | Planned | Review findings resolved or accepted |
| 8.2 Reliability tests: process crash, Redis outage, DB outage, provider timeout, 429/5xx, poison event, duplicate delivery, schedule change, disable during run, and lease expiry. | Dev | Planned | Targeted automated test evidence |
| 8.3 Performance test representative due-queue volumes. Record throughput, p50/p95 duration, DB query growth, Redis pressure, worker concurrency, and provider-limit behavior; tune one measured bottleneck at a time. | Dev | Planned | Comparable before/after evidence |
| 8.4 Staging soak: 48 hours of scheduled runs with zero unhandled failure, scheduler drift, cross-tenant result, or duplicate external/financial effect. | Owner + Dev | Planned | Runtime dashboard/run-history export |
| 8.5 Production canary: move one non-critical job, observe, then move the next. Roll back by disabling the new scheduler/executor while preserving the durable queue and evidence. | Owner + Dev | Planned | Canary sign-off and rollback rehearsal |
| 8.6 Update plan status/progress for 8.1–8.5. | Dev | Planned | Progress Log entries added |

**Phase exit:** the readiness blocker I11/I11a can be closed with runtime evidence, not merely restored cron rows.

## Phase 9 — Decommission and final rule update

| Task | Owner | Status | Exit evidence |
|---|---|---:|---|
| 9.1 Remove retired Vercel/tenant API job routes, `pg_net` credentials, obsolete schedules, and dead deployment configuration after verifying no caller remains. | Dev | Planned | Source and runtime caller inventory is empty |
| 9.2 Update feature docs, runbooks, recovery procedures, environment-variable inventory, and the production-readiness roadmap. | Dev | Planned | Linked docs reflect deployed model |
| 9.3 **Only after the model is proven**, update the authoritative shared integration contract, both repos’ `AGENTS.md`/`CLAUDE.md`, relevant Cursor rules, and Codex architecture/backend/workflow skills. Use pointers to the canonical contract rather than duplicating policy. | Dev | Planned | Rules and skills are consistent and validated |
| 9.4 Update plan status/progress for 9.1–9.3 and record final decisions/follow-ups. | Dev | Planned | Final Progress Log entry |

**Phase exit:** no obsolete execution path remains, and future work is guided by the proven boundary.

## Required verification matrix

| Area | Required proof |
|---|---|
| Database | Function tests, privileges, `tenant_org_id` predicates, migration review/application by owner, generated types after application |
| Workers | Unit tests, retry/lease tests, build, Redis failure/reconnect test, deployed health signal |
| HQ API | Controller/service tests, machine-auth and allowlist tests, idempotency/replay tests, audit evidence |
| HQ web | Cmx-only UI, EN/AR/RTL, accessibility, RBAC and browser verification |
| Observability | Run history, metrics, alerts, no secret/PII logging, dashboard distinguishes dispatch from completion |
| Performance | Measured queue throughput/latency and DB/Redis pressure at representative volume |
| Rollout | Staging soak, canary, rollback rehearsal, documented owner sign-off |

## Explicit non-goals

- Do not restore all missing schedules before classification.
- Do not add a second generic scheduler or a generic HTTP-to-command bridge.
- Do not move database transactions to workers merely because they are scheduled.
- Do not turn `jobs-need-api` into a replacement for direct worker/database contracts.
- Do not apply migrations, deploy, or change production schedules without the owner’s explicit approval.

## Progress Log

Append newest entries first. Do not remove historical entries.

| Date | Task | Status | Evidence / result | Owner | Next action |
|---|---|---|---|---|---|
| 2026-11-17 | 0.3 legacy HTTP call graph | Complete | Read-only remote function-definition scan found exactly five tenant API bridges: finance outbox/jobs; notification outbox/campaign/reconcile. Finance uses direct runtime config; notifications use the vault/config helper. Route source confirms notification outbox has durable claim/lease and unknown-acceptance protection; finance is tenant-service orchestration with a run-log overlap guard. No secrets were read. | Dev | Complete 0.1 handler-level transaction, scope, batch, and external-effect inventory; no route or schedule changes. |
| 2026-11-17 | 0.1 handler classification evidence | In progress | Read-only remote definitions confirm `fn_ntf_quota_rsv_sweep`, `fn_ntf_retention_sweep`, and `fn_setup_health_refresh_all` are database-native; source/remote evidence confirms notification dispatch/reconcile cross an external-provider boundary. Initial classification register updated with confirmed versus provisional facts. | Dev | Trace remaining handlers, including finance sub-handlers, notification retry/push, auth, tax, file, and operational capture. |
| 2026-11-17 | 0.1 handler evidence expansion | In progress | Read-only remote definitions confirm session, stale-push subscription, tax-kit, file-expiry, operations-capture, and idempotency-cleanup handlers are database work; File Util keeps byte deletion in the HQ worker. The handler evidence matrix records the remaining safety checks and prevents a false "all DB work is safe to schedule" conclusion. | Dev | Trace finance sub-handlers and notification campaign/retry paths; then write a reviewed decision record and rollback path per handler. |
| 2026-11-17 | 0.1 campaign/retry boundary | In progress | Source/migration review confirms notification retry is a direct database requeue with no provider call, while campaign expansion is a bounded application route with per-target idempotency but global candidate scans. Legacy restore uses stored command text for both database and HTTP work. | Dev | Design a fixed-function retry contract and complete campaign parity assessment before making either target decision. |
| 2026-11-17 | 0.1 finance sub-handler trace | In progress | Finance outbox handlers reviewed so far are internal domain consumers; gift-card, credit-note, loyalty, ERP retry, and POS rollover execute tenant-aware transactional services. POS emits only a durable notification event after commit, not a provider request. | Dev | Specify database-function parity and bounded batch contracts for each financial handler; then test lock-order and accounting/audit invariants before implementation. |
| 2026-11-17 | Notification backlog cleanup | Complete | Owner executed the reviewed ID-fenced remote script. Read-only remote verification shows 0 `QUEUED`; preserved rows are 1 `FAILED_TEMPORARY`, 45 `FAILED_PERMANENT`, 411 `SENT`, and 14 `SKIPPED`. | Owner + Dev | Continue handler classification; do not enable the notification sender before a single provider-delivery ownership model is proven. |
| 2026-11-17 | 0.1 registry inventory refresh | In progress | Read-only remote inventory reconfirmed all 20 registry rows. It identifies extension-history/pg_net cleanup as database maintenance and confirms `fin-idempotency-cleanup` is still active through an unnecessary HTTP bridge even though its handler is database-only. It also reconfirms invalid effective schedules across missing jobs. | Dev | Include extension housekeeping and direct idempotency execution in the Phase 1 decision records; retain the no-enable freeze. |
| 2026-11-17 | 0.1 unregistered scheduler check | In progress | Read-only remote anti-join found one active scheduler outside `sys_ops_job_cf`: `tax-kit-update` runs `fn_tax_kit_update_all()` nightly. Its handler exists and is DB-native, but it has no HQ control-plane record. | Dev | Include the unregistered tax job in the handler decision record and proposed forward registry/control-plane migration; do not change its live schedule. |
| 2026-11-17 | 0.1 handler inventory | Complete | Read-only remote/function/source review covers the 20 active registry rows plus the one active unregistered tax schedule. The matrix records the actual executor class, scope, effects, and remaining parity/rollback gate for every job family. No missing schedule was restored and no executor changed. | Dev | Complete the owner-approved pilot freeze (0.4), then begin Phase 1 per-handler decision records and the ADR. |
| 2026-11-17 | 1.1 proposed target matrix | In progress | Every inventoried handler family has a proposed boundary: database-only maintenance/domain transitions stay in Supabase; notification provider delivery/reconciliation and File Util byte purge move/remain in HQ workers; no `jobs-need-api` exception is currently justified. | Dev + Owner | Approve the Phase 1 ADR and pilot freeze before writing implementation migrations or worker changes. |
| 2026-11-17 | Phase 1 approval / 1.1 | Complete | Owner approved Phase 1 and the proposed target matrix. The decision preserves the no-enable/no-cutover freeze pending ADR, handler contracts, and rollback proof. | Owner + Dev | Draft the ADR and the per-handler implementation contracts. |
| 2026-11-17 | 1.2a tax registry normalization | Planned | Owner directed that the active remote `tax-kit-update` database job be added to the HQ registry properly. It is explicitly scoped to a forward migration that attaches to the existing scheduler without duplicate scheduling or schedule mutation. | Dev writes; Owner applies | Define the database-job registry contract and draft the reviewed migration in Phase 2. |
| 2026-11-17 | 1.4 ADR draft | In progress | Created `I11_background_execution_redesign_ADR.md` from the approved target matrix. It fixes the DB/worker/API boundary and tax-kit registry non-duplication rule; detailed handler contracts, metrics, and test evidence remain before ADR completion. | Dev + Owner | Review per-handler contracts, then mark the ADR approved for implementation. |
| 2026-11-17 | 1.2 / 1.3 handler contracts | Complete / In progress | Created `I11_background_execution_handler_contracts.md`: database and worker execution contracts, per-family target/parity requirements, tax registry acceptance criteria, and required tests. Notification worker cutover remains in progress because the two existing dispatcher state machines still need reconciliation. | Dev | Design the safe notification state-machine convergence and Phase 2 forward migrations. |
| 2026-11-17 | 1.3 notification worker trace | In progress | Static HQ trace confirms `platform-api` reserves `hq_ntf_dispatch_log` and queues BullMQ `ntf-dispatch` work; `platform-workers` finalizes that log. The tenant legacy route independently claims `org_ntf_outbox_dtl`. No common durable handoff is confirmed, so direct cutover would be unsafe. | Dev | Design the reviewed DB link/state transition and prove that only one executor can own each notification before Phase 2 work. |
| 2026-11-17 | 0.2 remote baseline | Complete | Read-only remote registry, scheduler, 48-hour run-history, and notification-outbox queries captured: 20 registry rows / 19 desired-enabled / 5 active schedules / 14 desired-enabled missing; notification backlog 55 queued, 1 temporary-failed, 45 permanent-failed. | Dev | Complete handler/source inventory and classify each job before any schedule change. |
| 2026-11-17 | Remote MCP configuration | Complete | Read-only `supabase_remote_mcp` OAuth completed and the authoritative Phase 0 remote baseline executed successfully. | Dev | Use remote read-only evidence for all remaining production decisions. |
| 2026-11-17 | 0.2 remote baseline | Blocked | This session has no configured remote Supabase read-only connector; only the local connector is exposed. Per evidence-authority rule, no local substitution was made. | Dev | Owner enables/connects remote Supabase read-only access, then rerun the Phase 0 baseline queries. |
| 2026-11-17 | Evidence-authority rule | Complete | Remote Supabase is now explicit as the sole production-readiness authority; I11 plan, Phase 0–4 register, roadmap, README, and I11a blocker are synchronized. Prior local observations are development-only. | Dev | Run the required read-only remote baseline before any job decision. |
| 2026-11-17 | 0.1–0.5 baseline started | In progress | Read-only local registry/scheduler/outbox baseline and source call-path scan recorded in Phase 0 findings; discovered parallel tenant/HQ notification dispatch implementations and tenant-service finance orchestration. No mutation performed. | Dev | Trace every handler and refresh remote baseline before completing classification. |
| 2026-11-17 | Plan created | Complete | Architecture plan created; no runtime behavior changed | Dev | Owner approves Phase 0 discovery |
