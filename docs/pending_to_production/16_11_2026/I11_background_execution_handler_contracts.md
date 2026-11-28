# I11 Handler Implementation Contracts

> **SUPERSEDED (28 Nov 2026, Background Jobs step 9).** Historical record only; do not follow it. The current design is [docs/features/Background_Jobs/DESIGN.md](../../features/Background_Jobs/DESIGN.md). The pg-boss redesign replaced this runtime (platform-workers and the HQ worker claims were deleted in step 8).

**Status:** The Phase 2 control-plane migration is applied and the notification worker/API boundary is in controlled canary hardening. **20 Nov 2026:** Owner approved the expert-replan runtime (one HQ `BackgroundExecutionModule`, LISTEN + safety sweep, Redis-as-platform, no BullMQ on outbox). **22 Nov 2026:** the three places stay locked. Finance, POS, ERP, the finance outbox, and campaign expansion use the §1.1 build: Postgres claims due rows, and one existing poster performs the effect in-process when that poster is TypeScript. Tenant HTTP callers stay off. Delivery stays disabled. Remote production evidence still gates expansion.
**Authority:** [I11 ADR](I11_background_execution_redesign_ADR.md), [expert replan](I11_background_execution_EXPERT_REPLAN.md), [I11 plan](I11_background_execution_redesign_PLAN.md). Remote Supabase is the production evidence authority.

## Common database-job contract

Each database job must use a fixed function with a pinned `search_path`, least-privilege execution grants, explicit `tenant_org_id` predicates for tenant rows, bounded work, an idempotent claim/transition, durable aggregate outcome, and a recovery path for interruption. A `pg_cron` command invokes only that function. It never posts to an application URL.

## Common worker-job contract

The database creates the durable work state. Domain code must enqueue through one `WorkOutbox` helper in the **same transaction** as the business write (D19); it must not start timers, BullMQ, `pg_net`, or tenant job HTTP. The HQ runner (today `platform-workers`; approved target `platform-api` `BackgroundExecutionModule`) claims due rows through a **global** `SKIP LOCKED` RPC, not a per-tenant JS loop. An `ExecutorRegistry` maps `job_code` to a named executor and refuses unknown codes. Wake is `LISTEN/NOTIFY` plus a sparse safety sweep. The executor retains only tenant/outbox/claim identity; HQ loads policy and submits to the provider (in-process target). It writes a terminal outcome, retry time, or reconciliation-required state through the exact claim token. A provider timeout is unknown—not a resend. BullMQ is not on this path except `LEGACY_BULLMQ_ENABLED`. Redis on HQ API is not the outbox. Screens never call the execute HTTP.

## Approved notification convergence contract

`org_ntf_outbox_dtl` is the single tenant-owned delivery state. Its existing tenant key, status, retry, idempotency, claim, and lease facts remain authoritative. The Render worker calls HQ with only `tenantOrgId`, `outboxId`, and the opaque `claimToken`; it never carries recipient content, rendered payload, or provider credentials in a queue.

1. A no-write shadow probe may observe aggregate due/lease/uncertainty counts; it cannot claim, send, retry, or schedule. It is independently disableable only for a confirmed capacity incident.
2. The worker calls a fixed, tenant-scoped claim function for a due row with no active claim. It conditionally writes its worker identity, opaque claim token, and bounded lease, then returns only the minimum identity required to invoke the private HQ operation. A failed claim is a no-op, not an error or resend.
3. The worker invokes the one private HQ `jobs-need-api` notification-delivery operation with the outbox identity and exact claim token. HQ rechecks policy and submits through the provider using the outbox idempotency key; the worker calls a fixed finalize function with `tenant_org_id`, `outbox_id`, and the exact claim token. The function alone can transition status, retry time, provider message reference, delivery audit, and campaign counters.
4. A timeout/transport ambiguity persists a reconciliation-required tenant state under the same claim. Only the reconciler can settle it, and it cannot overwrite a newer terminal state.
5. `hq_ntf_dispatch_log` may receive a constrained reference to the tenant outbox record for audit/metrics. It must not become a second mutable delivery-status authority. If that reference requires a schema change, use a forward migration with a tenant-safe FK and a uniqueness rule that prevents two projection rows for one outbox record.
6. Legacy tenant route scheduling is retired only after the new worker path passes canary/soak proof and the shared claim guarantees that both paths cannot send the same record.

## Handler matrix

| Family | Current executor | Approved target | Required implementation contract |
|---|---|---|---|
| `tax-kit-update` | Active `pg_cron` → `fn_tax_kit_update_all()` | `DATABASE` | `0755` recorded observation-only registry metadata without scheduling/unscheduling/altering the existing job. Retain the one existing `5 2 * * *` schedule until a separately reviewed executor policy authorizes any control action. |
| Auth session, extension cleanup, scheduler-run capture, Setup Health | Fixed database functions/extension commands | `DATABASE` | Retain as fixed database work; document retention, grants, boundedness, and registry safe-action policy. |
| File pending-upload expiry | `fn_file_util_expire_pending()` | `DATABASE` | Keep 5,000-row bounded expiry transition and no storage-byte deletion. |
| File byte purge | Existing HQ worker | `HQ_WORKER` | Preserve database-expiry handoff, storage delete authorization, worker retry/lease, and `purged_at` outcome. |
| Notification retry, quota reservation, retention, stale push subscriptions | Database SQL/functions | `DATABASE` | Replace legacy command text with fixed bounded functions. Claim/requeue transitions must not race notification delivery. |
| Notification campaign expansion | Tenant API route | `HQ_WORKER` | Postgres claims the batch. HQ runs the existing consent, quiet-hours, and template module in-process. Keep the 10-campaign and 50-target limits and per-target idempotency. The screen calls that same module. |
| Notification delivery/reconciliation | Tenant API route plus separate HQ worker | `HQ_WORKER` + `HQ_JOB_API` | Approved exception: the worker claims/finalizes canonical `org_ntf_outbox_dtl`; the private HQ API owns policy and provider submission. Its fixed typed operation accepts only outbox identity plus claim token, verifies the live lease, and never becomes a generic proxy. Preserve claim/lease, unknown acceptance, provider idempotency, quota/metering, consent, suppression, route/template, BYO credentials, fallback, and monotonic reconciliation. Remove legacy tenant scheduler ingress only after soak. |
| Gift-card, credit-note, loyalty expiry | Tenant finance service via HTTP bridge | `DATABASE` when a fixed SQL ledger contract already exists; otherwise `HQ_WORKER` | Postgres claims due rows. The existing poster writes the ledger. Use that SQL function when it already exists. When the poster is TypeScript, HQ calls that one module in-process. Gift cards: `fn_fin_gift_card_exp_due` lists due cards; `expireGiftCard` locks the row and writes the ledger plus the existing general-ledger entry. HQ does not claim that job yet. Preserve expiry predicates and accounting facts. No second ledger. |
| POS rollover | Tenant finance service via HTTP bridge | `DATABASE` when the lock order already fits one SQL function; otherwise `HQ_WORKER` | Postgres claims due sessions. The existing poster keeps the session lock order, replay protection, and the post-commit notification event. |
| ERP posting retry | Tenant finance service via HTTP bridge | `HQ_WORKER` | Postgres claims `SYSTEM_ERROR` exceptions. HQ calls the existing posting engine in-process. Do not add a second posting engine in SQL. |
| Financial domain outbox consumers | Tenant in-process handler registry via HTTP bridge | `HQ_WORKER` | Postgres claims due events. HQ runs the existing consumer for that event type in-process. Preserve handler idempotency and dead-letter semantics. No provider delivery belongs here. |
| `jobs-need-api` | Notification outbox policy/provider boundary | `HQ_JOB_API` | Owner approved one `notifications/outbox-delivery` exception: direct worker delivery cannot safely own the existing credential, route/template, quota, and audit boundary. One private worker-authenticated operation only; no generic actions, destinations, SQL, or tenant override. |

## Tax registry migration acceptance evidence

Owner applied `0755_ops_job_action_contract.sql` locally and remotely. The following remote checks are the retained acceptance evidence:

1. `cron.job` contains exactly one `tax-kit-update` row, still active, with command `SELECT public.fn_tax_kit_update_all()` and schedule `5 2 * * *`.
2. `sys_ops_job_cf` contains exactly one active `tax-kit-update` row whose metadata describes the existing database job and whose safe control action cannot execute arbitrary SQL.
3. HQ Ops Jobs can read its actual scheduler state and history without exposing command text, secrets, or arbitrary schedule mutation.
4. No duplicate `cron.schedule`, no `cron.unschedule`, and no `cron.alter_job` occurs in that migration.
5. Owner captured remote read-only before/after evidence; the plan, ADR, runbook, and go/no-go register retain the current observation-only state.

## Ops Jobs compatibility sequence

The existing HQ feature calls `fn_ops_job_list`, `fn_ops_job_set_state`, `fn_ops_job_restore`, and `fn_ops_job_run_now` through the `platform-api` Ops Jobs repository/service/controller and the `platform-web` Ops Jobs feature. The replacement must be ordered as follows:

1. Add a database-owned executor/action allowlist and broaden the registry model without deleting legacy columns or changing live scheduler rows.
2. Update the database functions so list output exposes executor/action capability rather than command presence; state, restore, and run-now select a fixed allowlisted action by job code/target and reject unsupported legacy HTTP actions.
3. Update HQ API types, repository, service, controller, tests, and audit projection to consume capabilities—not stored-command semantics.
4. Update HQ web types/UI/messages/tests so restore/run-now are unavailable when a job has no approved action and so completion is labelled as dispatched versus completed correctly.
5. `0755` registered `tax-kit-update` as an observation-only database executor attached to its existing `cron.job` row. Do not create, delete, or alter that row.
6. After the new model has replaced every legacy HTTP executor, remove `restore_command` and its constraint in a later forward migration with source-caller proof.

**Current implementation checkpoint:** Owner applied `0755_ops_job_action_contract.sql` locally and remotely. Remote read-only verification confirms all four V2 functions, `tax-kit-update` still active at `5 2 * * *` with its original fixed function, and an observation-only tax registry record. HQ API/web source now uses the V2 capability contract: unsupported actions are hidden in the UI, rejected before dispatch in the API, and rejected again by the database. The migration contains no `cron.schedule`, `cron.unschedule`, or `cron.alter_job` call. No job currently grants `SET_STATE`, `RESTORE`, or `RUN_NOW` during the freeze.

## Notification worker implementation state and remaining gate

The legacy `platform-workers` notification processor owned a separate `hq_ntf_dispatch_log` state machine and carried recipient/payload content in BullMQ. It is not the canonical delivery path and only starts when `LEGACY_BULLMQ_ENABLED=true`. The current canonical worker instead claims `org_ntf_outbox_dtl`, calls the fixed private HQ operation with claim identity only, and finalizes only through the exact claim-token function. The API reuses HQ policy/provider handling; `hq_ntf_dispatch_log` remains an audit projection, never independent delivery authority.

The claim/load/finalize/reconcile contracts now exist over `org_ntf_outbox_dtl`, with explicit tenant predicates in canonical access. The worker must never receive recipient content or provider credentials. `hq_ntf_dispatch_log` can evolve only as a constrained tenant-outbox projection after its consumers use the same authoritative result; it must not become an independent mutable delivery status.

**Current production gate:** `PLATFORM_WORKER_API_KEY` authenticates the fixed private operation; the worker is disabled unless the Owner explicitly sets `NTF_OUTBOX_WORKER_ENABLED=true`. A one-claim canary also requires `NTF_OUTBOX_CLAIM_LIMIT=1`, `NTF_OUTBOX_MAX_CLAIMS_PER_BOOT=1`, and exactly one active Render instance. The total budget is process-scoped, not a multi-instance distributed budget. The worker must remain disabled while remote Supabase Disk I/O attribution is open; the read-only shadow probe may be separately paused through `NTF_OUTBOX_SHADOW_ENABLED=false` only if it is measured as a material contributor.

**Lease-safety finding (19 Nov 2026):** The fixed worker RPCs do not themselves provide expired-`PROCESSING` recovery, but the existing tenant reconciliation service does: it performs provider lookup where possible, dead-letters unverifiable outcomes, and retries only Twilio's proven-not-submitted result. The required work is to port that exact provider-specific reconciliation policy to the Render/HQ boundary. Do not add a generic expired-lease requeue function: it would bypass the proof requirement and risk duplicate sends. The eventual fixed contract must preserve unknown outcomes for reconciliation rather than freeing/retrying them.

## Required tests before cutover

- Database: tenant isolation, overlap, interrupted claim recovery, bounded batch continuation, duplicate/idempotent call, financial ledger/audit parity, and direct-execution grant rejection.
- Worker: lease race, restart, provider success/temporary/permanent/unknown outcome, replay, rate-limit/quota behavior, and no duplicate customer effect.
- Operations: scheduler drift, disable/run-now behavior, registry-to-runtime reconciliation, history projection, EN/AR/RTL operator controls, and alert delivery.
