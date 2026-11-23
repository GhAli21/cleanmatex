# Background Jobs — Resume Here

Read this first when continuing the work in a new session or with another assistant.

## Where things stand (23 Nov 2026)

- **Design approved:** [DESIGN.md](DESIGN.md). The plan is §10 (gates §10.1, steps §10.2, rules §10.3). Read §18 and §19 before writing code: they hold the verified pg-boss facts and the traps.
- **Step 0:** code done, not committed. Files:
  - `web-admin/app/api/v1/orders/submit-order/route.ts` and `web-admin/app/api/v1/orders/[id]/transition/route.ts`: `after()` for notifications.
  - `web-admin/lib/services/order-history-consumer.service.ts`: `SKIPPED_ORPHAN`.
  - `web-admin/lib/services/outbox-processor.service.ts`: logs the orphan skip.
  - Tests: the two route test files mock `after()`, and the consumer test file has two orphan tests.
- **Step 0:** verified: Jest green, ESLint 0, `tsc --noEmit` 0.
- **Step 1:** done. 0807 applied local and remote, types regenerated in both repos, Prisma pulled. Remote verified.
- **Event catalog:** DESIGN §20 decisions approved (E1, E3–E6 as recommended; E2 = `_ops_` names and `sys_ops_job_cf` extended, §20.8). §21 renames **approved by the Owner** (7 renames, 24 kept, `VOUCHER_REVERSED` and `WORKFLOW_GATE_DECISION_ACCEPTED` added, `VOUCHER_POSTED` verify-then-add-or-remove, `GIFT_CARD_REDEEMED` removed). **Step 1b written:** `0808_ops_job_registry_event_catalog.sql` plus the web-admin rename (15 files, 11 tests, timeline label + theme tone colours). Validated: local dry run in a rolled-back transaction, Jest 171, tsc 0, ESLint 0, i18n and check:ui pass. **0808 applied local and remote on 23 Nov; the web-admin rename code is not deployed yet — production writes of renamed events fail until it is.** Next for the Owner: commit and deploy web-admin, then QA 1b.3–1b.4. Step 2 (`packages/jobs`) is done in code (see STATUS and DESIGN §22). Step 3 (`cmx-workers`) is done in code; the Owner creates its Render service after S-D6 (README there, QA 3.2–3.3). Step 4 is done in code (0809 applied local + remote; code not committed). Owner: deploy web-admin, create the Render worker with the step 4 variables, run `publish-events` once (QA 4.2–4.4). Step 5: 0810 applied (23 Nov); the tenant side (5b: requests, `ntf.orchestrate`) is done in code. Next for Dev: 5c, the HQ API pg-boss consumer for `ntf.deliver` / `ntf.reconcile` / `ntf.status_apply` (STEP5_PLAN.md "HQ code"), then 5d campaigns, OTP and receipts, then 5e deletions. Release order matters (QA 5.2, DESIGN §22.4 F20).
- **Queue rule:** each later step's migration creates that step's queues before any producer for them ships. 0807 has only `dead_letter`, `fin.domain_event`, `ops.smoke_test`.
- **Validation harness:** throwaway-database scripts (stubs for `org_tenants_mst` and `fn_audit_touch_row`, run the migration, drop the database) are the pattern for future migrations. pg-boss SQL comes from `getConstructionPlans('pgboss')` / `getMigrationPlans`.

## Facts you must not re-derive

- `@cmx/jobs` (`packages/jobs`) is the only producer API: `createJobProducer(prisma)` → `enqueue`, `publish`; `claimEffect` in handlers. Tests: `npm test --workspace=@cmx/jobs` (local Postgres).
- Deduplicate with the job id, not `singletonKey` (DESIGN §22 F1). `publish()` uses the event id as the job id.
- `cmx-workers` reads its queues from the registry (`consumer_app = 'CMX_WORKERS'`), maps them to `src/handlers/index.ts`, and reports `applied_*`. Tests: `npm test --workspace=cmx-workers` (esbuild-bundled, local Postgres).
- Domain events: `emitEventTx` writes and publishes; reactions are `fin.<event>.<handler>` queues run by `runDomainEventReaction` (web-admin) through `src/handlers/fin-reactions.ts`. A new reaction needs a migration row in `sys_ops_job_event_subs_cf`, a `REACTION_HANDLERS` entry, a `FIN_REACTIONS` line and an `OUTBOX_HANDLER_CATALOG` pair with EN/AR labels; the contract test fails until all agree.
- Importing web-admin into cmx-workers: esbuild bundles it; add any newly imported export to `src/types/web-admin-boundary.d.ts` (strict typecheck boundary, DESIGN §22.3 F12).
- Producer `start()` needs the regclass cast in `startDb` (DESIGN §22 F2). Keep pg-boss pinned at 12.39.0 in every consumer.

- pg-boss 12.39.0: `send()` requires `start()`. Producer mode works: `db` adapter, `migrate`, `supervise`, `schedule`, `registerInstance` all `false`. Verified: 5 queries at start, 0 extra connections, commit keeps the job, rollback removes it.
- Schema: install from `getConstructionPlans('pgboss')` as a repo migration. Every process runs `migrate: false`.
- Queues: create in the migration with `SELECT pgboss.create_queue(name, options)`. Sending to a missing queue throws. Never use `partition: true`; it creates tables at runtime.
- `dead_letter` needs `retentionSeconds` of 90 days, or the default 14 days deletes dead letters.
- The notification outbox already models "being sent" as `PROCESSING` with `claim_token`. Use the pg-boss job id as the claim token. Do not add a new status.
- Database in AWS `us-east-2`. Consumers use the session pooler on port 5432; Prisma uses 6543.
- HQ job permissions: `hq_ops:read`, `hq_ops:manage_jobs`.

## Rules

- Load the skills CLAUDE.md names before writing SQL, backend, frontend or i18n.
- Migration number: list `supabase/migrations/`, take latest + 1 at write time. Never apply migrations.
- After each step: update STATUS.md, QA_TEST_GUIDE.md, this file, and the Progress Log in `docs/pending_to_production/16_11_2026/I11_background_execution_redesign_PLAN.md`.
