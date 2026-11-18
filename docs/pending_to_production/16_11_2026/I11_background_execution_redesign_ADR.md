# ADR — I11 Background Execution Boundary

**Status:** Phase 1 target boundary approved on 17 Nov 2026; implementation detail remains in progress pending per-handler contracts and Owner-reviewed forward migrations.
**Scope:** `cleanmatex` database and tenant legacy routes; `cleanmatexsaas` HQ `platform-api`, `platform-web`, and Render `platform-workers`.

## Decision

1. Vercel/tenant `web-admin` is limited to user-request-driven work. No supported `pg_cron` or `pg_net` path may invoke a tenant API route for scheduled execution.
2. Supabase PostgreSQL owns database-native schedules and fixed database functions. A database job has bounded work, explicit grants/search path, idempotency/overlap behavior, tenant-safe queries, durable outcome facts, and no provider call.
3. Render HQ `platform-workers` owns external-provider delivery/reconciliation and storage-byte work. PostgreSQL remains the durable source for claim, outcome, retry, and audit state; BullMQ/Redis is not business-record authority.
4. `platform-api/src/modules/jobs-need-api` remains absent. It may be created only for an Owner-approved exception that proves neither a fixed DB function nor a direct worker contract can satisfy the external requirement.
5. `sys_ops_job_cf` is the HQ operator control plane. It records desired state and safe metadata, never arbitrary command text, URLs, secrets, or SQL. A scheduler may not be silently duplicated to make registry state look healthy.
6. **Owner-approved notification convergence:** `org_ntf_outbox_dtl` remains the canonical tenant delivery state. HQ workers may claim and finalize only that tenant record through fixed database contracts. `hq_ntf_dispatch_log` is an operational/audit projection and cannot independently authorize or finalize a customer delivery.

## Approved target map

| Target | Handler families |
|---|---|
| `DATABASE` | Session, extension cleanup, File pending-upload expiry, finance idempotency, notification retry/quota/retention/push-subscription, operations capture, Setup Health, tax-kit update, campaigns, and financial domain transitions. |
| `HQ_WORKER` | Notification provider dispatch/reconciliation and File Util storage-byte purge. |
| `HQ_JOB_API` | None. |

## Non-negotiable execution contracts

- Every `org_*` access has an explicit `tenant_org_id` predicate, except a documented global discovery that immediately partitions work by tenant.
- Scheduled work uses fixed allowlisted function/action identities. Run-now uses the same executor and idempotency boundary; it never executes stored command text.
- Claims are durable and bounded. An expired lease is recoverable; a provider timeout is an unknown result requiring reconciliation or provider idempotency, never blind resend.
- Financial transitions retain their reviewed transaction and lock order, ledger/audit writes, replay protection, and per-unit failure isolation.
- Operator UI shows dispatch separately from completion, supports only least-privilege confirmed actions, and is EN/AR/RTL safe.

## Tax-kit registry normalization

Remote evidence shows `cron.job` currently runs `tax-kit-update` at `5 2 * * *` with `SELECT public.fn_tax_kit_update_all()`, but no active `sys_ops_job_cf` row exists. The forward migration must:

- register the existing scheduler metadata without calling `cron.schedule`, `cron.unschedule`, or `cron.alter_job`;
- preserve the live schedule and job identity;
- define only fixed, audited metadata compatible with the new control-plane model;
- prove before/after that one and only one `cron.job` row exists; and
- be applied only by the Owner, followed by a remote read-only verification.

**Current-state prerequisite:** the existing registry still restricts kinds to `PG_CRON`, completion modes to `SYNC|ASYNC_HTTP`, and requires stored restore SQL. Its HQ restore/run-now/state controls consume those legacy functions. The registry/action allowlist must be modernized compatibly before `tax-kit-update` is registered; adding the row alone would extend the model this ADR retires.

**Applied implementation:** Owner applied `0755_ops_job_action_contract.sql` locally and remotely on 17 Nov 2026. It adds an observation-first action allowlist and V2 capability-gated control functions, then registers tax-kit after an exact scheduler preflight. It does not change `cron.job`. The HQ API/web source now consumes V2 capabilities; no mutation is enabled until a later per-executor decision grants it.

## Cutover and rollback

- Never run old and new notification dispatchers against the same work. Establish the shared claim/state machine first.
- Change one handler at a time. Canary with a harmless or tenant-isolated fixture and preserve run/outcome records.
- Rollback disables the replacement scheduler/consumer first; it does not delete pending durable work or retry unknown provider outcomes.
- No job is enabled merely because the registry says `desired_enabled`; enablement needs the handler contract, tests, operational metrics, and rollback evidence.

## Evidence and follow-up

Remote Supabase is the production authority. Phase 1 must produce the per-handler contract, a forward-only migration plan, worker/API changes where applicable, test/soak criteria, and runbooks before Phase 2 implementation.

See [I11_background_execution_redesign_PLAN.md](I11_background_execution_redesign_PLAN.md) for task status and the [Phase 0–4 register](Phase_0_to_4_Go_No_Go_Register.md) for launch gating.
