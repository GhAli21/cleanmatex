# ADR — I11 Background Execution Boundary

> **SUPERSEDED (28 Nov 2026, Background Jobs step 9).** Historical record only; do not follow it. The current design is [docs/features/Background_Jobs/DESIGN.md](../../features/Background_Jobs/DESIGN.md). The pg-boss redesign replaced this runtime (platform-workers and the HQ worker claims were deleted in step 8).

**Status:** Target boundary approved 17 Nov 2026; **runtime architecture amended and Owner-approved 20 Nov 2026** ([expert replan](I11_background_execution_EXPERT_REPLAN.md) D1–D8); **D19 central work platform** added 21 Nov 2026. Notification delivery stays disabled until WP0–WP4 gates.
**Approved_By_Jh:** 20 Nov 2026 (D1–D8); D19 recorded 21 Nov 2026 from Owner direction to centralize work calls.
**Scope:** `cleanmatex` database and tenant legacy routes; `cleanmatexsaas` HQ `platform-api`, `platform-web`; Render `platform-workers` is transitional until WP2.

## Decision

1. Vercel/tenant `web-admin` is limited to user-request-driven work. No supported `pg_cron` or `pg_net` path may invoke a tenant API route for scheduled execution.
2. Supabase PostgreSQL owns database-native schedules and fixed database functions. A database job has bounded work, explicit grants/search path, idempotency/overlap behavior, tenant-safe queries, durable outcome facts, and no provider call.
3. **Approved HQ runtime (20 Nov 2026):** `platform-api` owns the `BackgroundExecutionModule` (claim/finalize/purge, later reconcile). Wake is `LISTEN/NOTIFY` plus a 5–15 minute `pg_cron` safety sweep. PostgreSQL remains the durable source for outbox, claim, outcome, retry, and audit (`SKIP LOCKED`). Render `platform-workers` is transitional until that module soaks, then the Background Worker service is deleted. The notification **job path** does not use BullMQ. Redis may run on HQ API for cache, rate limit, and locks; it is not the job bus. Legacy BullMQ starts only under `LEGACY_BULLMQ_ENABLED=true`, and never merely because `REDIS_URL` is set.
4. **Owner-approved notification exception:** `platform-api/src/modules/jobs-need-api/notifications/outbox-delivery` remains the policy/provider boundary. Target execute is **in-process** after a canonical claim. HTTP machine ingress (`PLATFORM_WORKER_API_KEY`, identity-only DTO) stays until WP2, then is rollback-only. It is not a generic worker proxy or command runner.
5. `sys_ops_job_cf` is the HQ operator control plane. It records desired state and safe metadata, never arbitrary command text, URLs, secrets, or SQL. A scheduler may not be silently duplicated to make registry state look healthy.
6. **Owner-approved notification convergence:** `org_ntf_outbox_dtl` remains the canonical tenant delivery state. HQ workers may claim and finalize only that tenant record through fixed database contracts. `hq_ntf_dispatch_log` is an operational/audit projection and cannot independently authorize or finalize a customer delivery.
7. **Central work platform (D19, 21 Nov 2026):** Application code creates customer-visible background work only through one enqueue helper in the same transaction as the domain write. One HQ `BackgroundExecutionModule` runs allowlisted `job_code` executors. `/ops/jobs` is the operator surface. This is not a generic command/URL/SQL runner and not a god service that owns finance + notify + storage in one class.
8. **CLAUDE.md (D20):** Every planning or implementation slice loads tenant and HQ `CLAUDE.md`/`AGENTS.md` and the skills they name before writing that kind of artifact. Progress Log and related docs update after every WP. After soak: `/documentation` pack (WP9), then Cursor rule + `background-execution` skill (WP10).

## Approved target map

| Target | Handler families |
|---|---|
| `DATABASE` | Session, extension cleanup, File pending-upload expiry, finance idempotency, notification retry/quota/retention/push-subscription, operations capture, Setup Health, tax-kit update, campaigns, and financial domain transitions. |
| `HQ_WORKER` | Notification claim/finalize/reconciliation orchestration and File Util storage-byte purge. |
| `HQ_JOB_API` | Notification outbox policy and provider submission only (in-process target; machine HTTP until WP2). |

## Non-negotiable execution contracts

- Every `org_*` access has an explicit `tenant_org_id` predicate, except a documented global discovery that immediately partitions work by tenant.
- Scheduled work uses fixed allowlisted function/action identities. Run-now uses the same executor and idempotency boundary; it never executes stored command text.
- Claims are durable and bounded. An expired lease is recoverable; a provider timeout is an unknown result requiring reconciliation or provider idempotency, never blind resend.
- Notification shadow telemetry is read-only and independently switchable during a confirmed capacity incident. It cannot enable delivery, mutate canonical state, or replace remote database attribution.
- The notification API accepts only `tenantOrgId`, `outboxId`, and the opaque claim token. It verifies the current unexpired claim before reading tenant data or making a provider call; it never trusts a URL segment or caller-supplied recipient/provider payload as scope authority.
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

See [I11_background_execution_EXPERT_REPLAN.md](I11_background_execution_EXPERT_REPLAN.md) for the approved execution roadmap (D1–D12, WP0–WP9), [I11_background_execution_redesign_PLAN.md](I11_background_execution_redesign_PLAN.md) for the Progress Log, and the [Phase 0–4 register](Phase_0_to_4_Go_No_Go_Register.md) for launch gating.
