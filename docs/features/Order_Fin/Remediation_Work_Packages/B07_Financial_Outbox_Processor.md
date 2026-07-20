# B07 — Financial Outbox Processor

## Metadata
Backlog ID: B7 · Severity: HIGH · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-07-20** (see Completion evidence) — migration 0410 authored, **APPLIED (owner, 2026-07-20)** (owner must apply before the cron/route/screen are live); awaiting owner commit → Preview QA → approval before VERIFIED
Authoritative report sections: H6, H7, §45, §50-B7
Required decisions: [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: none · Blocks: [B19](B19_Expiry_And_Idempotency_Jobs.md) (hard); [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) (opt — outbox-based durable history only)
Recommended phase: Seq 5

## Confirmed problem
The financial outbox is emitted but never consumed: `claimBatch`/retry/dead-letter machinery idle, `order-history-consumer` has no caller (H6). Loyalty earning is a concrete victim — `queueEarnPoints` emits `LOYALTY_EARN`, `processEarnPoints` never runs, points are never credited (H7).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| outbox.service.ts:57–123 | claim/markProcessed/scheduleRetry exist | no runner |
| order-history-consumer.service.ts | handler ready | zero callers |
| loyalty.service.ts:141–144 | LOYALTY_EARN emit-only | earn never credited (H7) |
| notifications/process-outbox route | working pattern for notification outbox | template to mirror |

## Required outcome
Scheduled processor (route/job) claiming batches, dispatching to a handler registry (order history, loyalty earn, future GL fan-out), per-event idempotent completion, bounded retries, dead-letter after max attempts, observability (age/stuck metrics feeding OUTBOX_STUCK check).

## Scope
Runner + registry; wire history consumer; wire `processEarnPoints`; retry/dead-letter policy; ops runbook.
**Frontend surface (rule 7):** operational visibility screen — outbox health (pending/failed/dead-letter counts, event age, per-event retry action) so operators never need DB access to see or recover stuck financial events.

## Out of scope
New event types; GL dispatch content (B6); worklist UI (B30).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES (OUTBOX_PROCESSED goes green) |
| Customer receipt | NO |
| Audit/outbox | YES (history materializes; loyalty ledger earns) |

## Acceptance criteria
Settled qualifying order credits loyalty points end-to-end; PAYMENT_VERIFIED/REFUND_PROCESSED events produce history rows; poison event dead-letters without blocking the batch; replayed event processes once.

## Required tests
unit (registry), integration (end-to-end earn + history), idempotency, concurrency (two runners), regression.

## Dependencies and sequencing
Independent; unblocks B19 and B30's durable-history option.

## Delivery surfaces

Backend services: `lib/services/outbox-processor.service.ts` (NEW) — `OUTBOX_HANDLERS` registry + `processOutboxBatch()`: claims a batch via the now-fixed `claimBatch()`, fans each event out to every handler whose `eventTypes` set owns it, marks processed/failed/dead-lettered. Handlers: `order-history` (wraps the existing `consumeOrderHistoryEvent`) and `loyalty-earn` (NEW `lib/services/outbox-handlers/loyalty-earn.handler.ts`, wraps the existing-but-uncalled `processEarnPoints` — computes `earnPoints = floor(orderAmount × program.earn_rate_per_unit)`, a conversion that had never been implemented anywhere before this package)
Database/schema: migration 0410 — adds `DEAD_LETTERED` to the `org_domain_events_outbox.status` CHECK (was silently indistinguishable from "about to retry"); seeds `finance_outbox:view`/`finance_outbox:retry` permissions + role grants; seeds the `finance_outbox_monitor` nav component; creates `sys_fin_runtime_cf` (base URL + a randomly-generated bearer secret — never hardcoded); registers the `fin-outbox-processor` pg_cron job (every minute) via a SECURITY DEFINER wrapper + `net.http_post`; **unschedules the dead `outbox-worker` cron job** (0296) whose edge-function handlers were placeholders and whose own cron body has been a permanent no-op since inception (gated on a GUC that can never be set on Supabase's non-superuser `postgres` role — the actual root cause of H6)
API/endpoints: `POST /api/finance/process-outbox` (bearer-secret authenticated, mirrors `notifications/process-outbox` exactly) + `GET /api/v1/finance/outbox` (health counts + paginated/filterable event list, `finance_outbox:view`) + `POST /api/v1/finance/outbox/[eventId]/retry` (manual retry, `finance_outbox:retry`)
Frontend page/screen/dialog/action: `/dashboard/internal_fin/outbox` — ops-visibility screen (`OutboxMonitorPage` in `src/features/billing/ui/outbox-monitor-page.tsx`): 5 health-count tiles (pending/processing/failed/dead-lettered/processed-24h), status-filterable event table (event type, aggregate, status badge, attempts/max, next retry, created, error message), manual retry button on FAILED/DEAD_LETTERED rows (gated by `finance_outbox:retry`, hidden entirely for viewers without it)
Reusable components/helpers: `OutboxHandler` registry contract (`outbox-processor.service.ts`); reuses `CmxDataTable`/`CmxSelectDropdown`/`useMessage` exactly as the notifications delivery-log screen does
Permissions: NEW `finance_outbox:view` (ops screen read) + `finance_outbox:retry` (manual retry action) — migration 0410, granted to `super_admin`/`tenant_admin`/`admin`/`finance_manager`
Validation: handler idempotency by event id — `loyalty-earn-${event.id}` deterministic key into `processEarnPoints`' existing idempotency-skip; `order-history`'s existing upsert-based idempotency reused unchanged (D010)
i18n/RTL: `billing.outboxMonitor.*` EN/AR (title, counts, columns, status labels, retry/refresh actions, error messages)
Accessibility: status conveyed via badge text (not color-only); retry button has explicit text state (`Retry`/`Retrying…`), not an icon-only control
Audit trail: `processed_at`/`attempts`/`error_message` per event (existing columns); manual retry is itself a permissioned, auditable action (route-gated, tenant-scoped `manualRetry`)
Observability: health counts (pending/processing/failed/dead-lettered/processed-24h) exposed on the ops screen; `logger.warn`/`logger.error` on batch failures and processor crashes feed existing log-based alerting. `OUTBOX_STUCK`-style reconciliation wiring **not added this pass** — the existing reconciliation check surface (B20) doesn't yet have this check; noted as a follow-up, not silently implied
Jobs/workers: `fin-outbox-processor` pg_cron job (every minute, migration 0410) → `POST /api/finance/process-outbox` → `processOutboxBatch()`
Feature flag: **none** — this closes a confirmed gap (H6/H7: nothing has ever consumed the outbox); there is no "old behavior" to preserve behind a flag, only a `PENDING`-forever backlog. The doc originally proposed a per-handler flag for staged history→loyalty rollout; both handlers ship together since neither can cause new financial writes beyond what `processEarnPoints`/`consumeOrderHistoryEvent` already do safely (both are already idempotent, already-shipped functions — this package's job was only to finally call them)
Rollout: migration 0410 (owner applies) → owner copies the generated `outbox_secret_key` into `FINANCE_OUTBOX_SECRET` (env) → cron fires every minute → verify on Preview: a qualifying order's `LOYALTY_EARN`/`ORDER_COMPLETED` events flip PENDING→PROCESSED and the loyalty ledger/order-history rows materialize
Rollback: `SELECT cron.unschedule('fin-outbox-processor')` — events resume accumulating PENDING (today's state) without data loss; the dead `outbox-worker` job is not re-registered by rollback (it was already permanently broken, not a functioning fallback)

## End-to-end operational flow (operator: ops/finance)

- **Trigger:** system — `fin-outbox-processor` pg_cron fires every minute, calling `POST /api/finance/process-outbox` (bearer-secret auth) which runs `processOutboxBatch()` → `claimBatch()` (the `claim_outbox_batch` SQL function, `FOR UPDATE SKIP LOCKED`). Operator trigger: ops user opens the Outbox Monitor screen; manual retry is a per-event action there.
- **Permissions:** the cron/processor route is a system actor (bearer secret, not RBAC). The health screen (`finance_outbox:view`) and the manual-retry action (`finance_outbox:retry`) are RBAC-gated — unauthorized users don't see the retry button at all (client-side hide) and the API 403s regardless.
- **API/system action:** `POST /api/finance/process-outbox` (scheduled, internal-only); `GET /api/v1/finance/outbox` (health counts + event list); `POST /api/v1/finance/outbox/[eventId]/retry` (manual retry).
- **Backend execution:** each claimed event dispatches to every registered handler whose `eventTypes` set owns its `event_type` (`order-history`, `loyalty-earn`); an event with no matching handler is marked processed immediately (nothing was ever meant to consume it). Handlers reuse existing idempotent functions (`consumeOrderHistoryEvent`'s outbox_event_id upsert; `processEarnPoints`'s idempotency-skip keyed `loyalty-earn-${event.id}`) — reprocessing a completed event is a no-op.
- **Success path:** event marked PROCESSED with `processed_at`; order-history rows materialize for ORDER_COMPLETED/VOUCHER_POSTED_AND_WIRED/AR_INVOICE_ISSUED/PAYMENT_VERIFIED; loyalty points credit the ledger exactly once per LOYALTY_EARN event (H7 closed).
- **Failure handling:** a handler throw calls `markFailed`, which schedules a bounded retry with backoff (1/5/15/60/240 min) or, once exhausted, sets `DEAD_LETTERED` (NEW status, migration 0410) — a poison event never blocks the rest of the batch (the dispatch loop continues regardless; regression-locked in `outbox-processor.service.test.ts`). Concurrent claims are DB-locked via `FOR UPDATE SKIP LOCKED` inside `claim_outbox_batch` — no app-level lease needed.
- **Retry logic:** automatic bounded retries with backoff; manual retry from the Outbox Monitor screen resets `attempts`/`next_retry_at`/`error_message` so the next cron tick picks it up immediately; both paths are safe under concurrent processor ticks.
- **Audit logging:** per-event `processed_at`/`attempts`/`error_message` (existing columns); handler effects (order-history rows, loyalty ledger entries) carry their own actor/audit fields as before.
- **Observability:** pending/processing/failed/dead-lettered/processed-24h counts on the Outbox Monitor screen; `logger.warn` on any batch with failures, `logger.error` on a processor crash. A dedicated `OUTBOX_STUCK`-style reconciliation check was **not** added this pass (B20 already shipped; adding a new check there is a separate, explicitly out-of-scope follow-up, not silently assumed done).
- **Recovery procedures:** poison event → DEAD_LETTERED after 6 attempts (~5h20m of backoff) → ops fixes the underlying cause → manual retry re-queues it; systemic handler defect → no flag to disable (see Delivery-surfaces rationale) — the fix is a code deploy, and events simply keep accumulating PENDING/FAILED without loss in the meantime, exactly like the pre-B7 state.

## Completion evidence

**Migration:** `0410_b07_financial_outbox_processor.sql` — authored, **STOP-AND-WAIT, not yet applied** by the owner. Adds `DEAD_LETTERED` to the outbox status CHECK; seeds `finance_outbox:view`/`finance_outbox:retry` + role grants + `finance_outbox_monitor` nav component; creates `sys_fin_runtime_cf` (base URL + randomly-generated secret, never hardcoded); registers `fin-outbox-processor` cron; unschedules the dead `outbox-worker` cron (0296).

**Implementation (2026-07-20):**
- `lib/services/outbox.service.ts` — `claimBatch()` rewritten to call the existing-but-unused `claim_outbox_batch` SQL RPC (true `FOR UPDATE SKIP LOCKED`, migration 0296) instead of a racy `findMany`+`updateMany` pair; `markFailed`/`scheduleRetry` now return/set `DEAD_LETTERED` once the retry budget is exhausted (previously stayed `FAILED` forever, indistinguishable from "about to retry"); new `manualRetry(eventId, tenantId)` ops action; new exported `OutboxEventRow` type.
- `lib/constants/order-financial.ts` — `OUTBOX_STATUSES.DEAD_LETTERED` added.
- `lib/services/outbox-processor.service.ts` (NEW) — `OUTBOX_HANDLERS` registry + `processOutboxBatch()`.
- `lib/services/outbox-handlers/loyalty-earn.handler.ts` (NEW) — `processLoyaltyEarnEvent`: resolves the tenant's active loyalty program, computes `earnPoints = floor(orderAmount × earn_rate_per_unit)` (a conversion that had never existed anywhere in the codebase before this package — the root cause of H7), calls the existing `processEarnPoints` with a deterministic idempotency key; a tenant with no active program is a no-op (not an error), mirroring the B15 "no config = feature unused" policy.
- `app/api/finance/process-outbox/route.ts` (NEW) — bearer-secret processor route, mirrors `notifications/process-outbox` exactly.
- `app/api/v1/finance/outbox/route.ts` (NEW) — health counts + paginated/filterable event list, `finance_outbox:view`.
- `app/api/v1/finance/outbox/[eventId]/retry/route.ts` (NEW) — manual retry, `finance_outbox:retry`.
- `app/dashboard/internal_fin/outbox/page.tsx` (NEW) + `src/features/billing/ui/outbox-monitor-page.tsx` (NEW) — the ops-visibility screen.
- `src/features/billing/access/billing-access.ts` — new `/dashboard/internal_fin/outbox` contract entry (page + `retryEvent` action + 2 `apiDependencies`) authored via the golden path (`check`/`sync` — scaffold's automated insertion failed on this file's no-semicolon array-closing style, a pre-existing tooling gap, not a process skip); `BILLING_INTERNAL_FIN_OUTBOX_ACCESS` derived const added.
- `lib/constants/permissions/finance-perm.ts` — `FINANCE_OUTBOX_VIEW`/`FINANCE_OUTBOX_RETRY` added.
- `config/navigation.ts` — `finance_outbox_monitor` child entry under Internal Finance And Operations (dual-write with the migration's `sys_components_cd` seed, CRITICAL RULE 10).
- `messages/en(ar)/billing.json` — new `outboxMonitor` namespace.
- `.env.local` / `.env.dbcloudjh` — `FINANCE_OUTBOX_SECRET=` placeholder added (real value generated by migration 0410 at apply time — owner retrieves and fills in, see migration header).

**Tests (2026-07-20):** `__tests__/services/outbox.service.test.ts` — `claimBatch` rewritten for the RPC-based mock (was findMany/updateMany); new dead-letter escalation suite (`markFailed`/`scheduleRetry` → `DEAD_LETTERED` once exhausted); new `manualRetry` suite. `__tests__/services/outbox-processor.service.test.ts` (NEW, 9 tests) — registry ownership, per-event-type dispatch, no-handler-marks-processed, **poison event doesn't block the batch** (H6 regression lock), dead-lettered vs failed counting, zero-effect replay, concurrent-call isolation. `__tests__/services/outbox-handlers/loyalty-earn.handler.test.ts` (NEW, 5 tests) — earn-rate computation (incl. flooring, not rounding), no-active-program skip, zero-points skip, payload-validation throw. **Incidental fix discovered by the full-suite gate run:** `__tests__/services/refund.service.test.ts`'s self-approval test was asserting pre-owner-policy-change behavior (the owner's own commit `f7dccb8a`, "no need for maker-checker in approve… same user can approve if he has the required permission," had already landed `ENABLE_SELF_APPROVAL_CHECK = false` in `order-refund.service.ts` without updating this test) — rewritten to assert the current, intentional behavior; unrelated to B7 itself but was blocking a clean full-jest gate.

**Gates (2026-07-20, all green):** `npx tsc --noEmit` clean · `npx eslint . --quiet` 0 · `npm run check:i18n` ✓ · targeted jest (outbox.service + outbox-processor.service + loyalty-earn.handler) 26/26 · full jest 2060/2068 (8 fails = the pre-existing, documented `order-calculation.service.test.ts` mock gap, unrelated) · `npm run build` ✓ (exit 0, `/dashboard/internal_fin/outbox` in the route manifest) · `npm run sync:ui-access-contract` PASS (142/142 routes, drift 0) · `npm run check:platform-info-inventories` PASS.

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending, **and gated on the owner applying migration 0410 first** (the cron/route/screen have no effect until then) — scenarios: a qualifying order's LOYALTY_EARN event credits the ledger once; ORDER_COMPLETED/PAYMENT_VERIFIED produce order-history rows; Outbox Monitor shows live counts; manual retry re-queues a FAILED event · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (H6/H7 close once VERIFIED).
