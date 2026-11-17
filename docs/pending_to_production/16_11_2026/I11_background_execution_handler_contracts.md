# I11 Handler Implementation Contracts

**Status:** Phase 1 design input — no migration, schedule, API, worker, or deployment change is authorized by this file.
**Authority:** [I11 ADR](I11_background_execution_redesign_ADR.md) and [I11 plan](I11_background_execution_redesign_PLAN.md). Remote Supabase is the production evidence authority.

## Common database-job contract

Each database job must use a fixed function with a pinned `search_path`, least-privilege execution grants, explicit `tenant_org_id` predicates for tenant rows, bounded work, an idempotent claim/transition, durable aggregate outcome, and a recovery path for interruption. A `pg_cron` command invokes only that function. It never posts to an application URL.

## Common worker-job contract

The database creates or claims a durable work reference. `platform-workers` receives only the reference, correlation ID, and non-sensitive dispatch metadata; it acquires/renews a lease, uses the provider idempotency key, then writes a terminal outcome, retry time, or reconciliation-required state. A provider timeout is unknown—not a resend.

## Handler matrix

| Family | Current executor | Approved target | Required implementation contract |
|---|---|---|---|
| `tax-kit-update` | Active `pg_cron` → `fn_tax_kit_update_all()` | `DATABASE` | Add registry metadata without scheduling/unscheduling/altering the existing job. Prove one existing `cron.job` row before and after; retain its `5 2 * * *` schedule. |
| Auth session, extension cleanup, scheduler-run capture, Setup Health | Fixed database functions/extension commands | `DATABASE` | Retain as fixed database work; document retention, grants, boundedness, and registry safe-action policy. |
| File pending-upload expiry | `fn_file_util_expire_pending()` | `DATABASE` | Keep 5,000-row bounded expiry transition and no storage-byte deletion. |
| File byte purge | Existing HQ worker | `HQ_WORKER` | Preserve database-expiry handoff, storage delete authorization, worker retry/lease, and `purged_at` outcome. |
| Notification retry, quota reservation, retention, stale push subscriptions | Database SQL/functions | `DATABASE` | Replace legacy command text with fixed bounded functions. Claim/requeue transitions must not race notification delivery. |
| Notification campaign expansion | Tenant API route | `DATABASE` | Reproduce consent, quiet-hours, template, counters, 10-campaign/50-target limits, and per-target idempotency in a fixed database function. |
| Notification delivery/reconciliation | Tenant API route plus separate HQ worker | `HQ_WORKER` | Choose one authoritative outbox state machine. Static trace confirms the HQ API/worker currently reserves and updates `hq_ntf_dispatch_log`, whereas the tenant route claims `org_ntf_outbox_dtl`; a reviewed durable one-to-one link/state transition is required before either path consumes tenant outbox work. Preserve claim/lease, unknown acceptance, provider idempotency, quota/metering, and monotonic reconciliation. Remove legacy tenant scheduler ingress only after soak. |
| Gift-card, credit-note, loyalty expiry | Tenant finance service via HTTP bridge | `DATABASE` | Create one bounded, ledger/audit-parity DB contract per domain. Process independent units without a cross-tenant transaction; preserve expiry predicates and accounting facts. |
| ERP posting retry and POS rollover | Tenant finance service via HTTP bridge | `DATABASE` | Preserve posting/session lock order, replay protection, tenant-partitioned processing, and the post-commit notification event. |
| Financial domain outbox consumers | Tenant in-process handler registry via HTTP bridge | `DATABASE` | Split each event type into a fixed DB transition; preserve handler idempotency and dead-letter/recovery semantics. No provider delivery belongs here. |
| `jobs-need-api` | None | `N/A` | Do not create the module unless a future external contract cannot use a fixed DB function or direct worker adapter and the Owner approves an exception record. |

## Tax registry migration acceptance criteria

The future forward migration must pass these remote checks after Owner application:

1. `cron.job` contains exactly one `tax-kit-update` row, still active, with command `SELECT public.fn_tax_kit_update_all()` and schedule `5 2 * * *`.
2. `sys_ops_job_cf` contains exactly one active `tax-kit-update` row whose metadata describes the existing database job and whose safe control action cannot execute arbitrary SQL.
3. HQ Ops Jobs can read its actual scheduler state and history without exposing command text, secrets, or arbitrary schedule mutation.
4. No duplicate `cron.schedule`, no `cron.unschedule`, and no `cron.alter_job` occurs in that migration.
5. Owner captures remote read-only before/after evidence and updates plan, ADR, runbook, and go/no-go register.

## Required tests before cutover

- Database: tenant isolation, overlap, interrupted claim recovery, bounded batch continuation, duplicate/idempotent call, financial ledger/audit parity, and direct-execution grant rejection.
- Worker: lease race, restart, provider success/temporary/permanent/unknown outcome, replay, rate-limit/quota behavior, and no duplicate customer effect.
- Operations: scheduler drift, disable/run-now behavior, registry-to-runtime reconciliation, history projection, EN/AR/RTL operator controls, and alert delivery.
