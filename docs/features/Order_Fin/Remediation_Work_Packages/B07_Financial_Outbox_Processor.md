# B07 — Financial Outbox Processor

## Metadata
Backlog ID: B7 · Severity: HIGH · Classification: CONTROL_GAP · Status: NOT_STARTED
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

Backend services: outbox runner (claimBatch → handler registry → markProcessed/scheduleRetry/dead-letter); handlers: order-history-consumer, processEarnPoints
Database/schema: none new (outbox table has status/attempt columns)
API/endpoints: processor route (mirrors notifications/process-outbox pattern) + ops read endpoints for health counts
Frontend page/screen/dialog/action: ops-visibility screen — outbox health (pending/failed/dead-letter counts, oldest-event age, per-event detail with payload summary, manual retry action)
Reusable components/helpers: handler-registry contract; shared retry/backoff helper
Permissions: ops screen + manual retry behind an admin/finance-ops permission (code via B27)
Validation: handler idempotency by event id (D010)
i18n/RTL: EN/AR for ops screen labels/status chips
Accessibility: table semantics + status announced via text, not color alone
Audit trail: processed_at/attempts per event; manual retry records actor
Observability: OUTBOX_STUCK recon check fed by real ages; dead-letter alert threshold
Jobs/workers: the runner itself (scheduled)
Feature flag: `order_fin.outbox_processor` per-handler enable (history first, loyalty earn second)
Rollout: enable history handler → verify rows → enable loyalty earn → verify points credit end-to-end
Rollback: disable flag; events accumulate PENDING (current state) without loss

## End-to-end operational flow (operator: ops/finance)

- **Trigger:** system — the scheduled runner fires (route/job mirroring the notifications process-outbox pattern) and claims a batch of PENDING events via `claimBatch`. Operator trigger: ops user opens the outbox health screen; manual retry is a per-event action there.
- **Permissions:** the runner is system-actor. The health screen and the manual-retry action are gated behind an admin/finance-ops permission (code via B27); unauthorized users see the screen entry disabled with reason.
- **API/system action:** processor route (scheduled invocation); ops read endpoints for health counts and event detail; manual-retry endpoint per event id.
- **Backend execution:** each claimed event dispatches to its registered handler (order-history consumer, processEarnPoints, future GL fan-out); handlers are idempotent by event id (D010) — reprocessing a completed event is a no-op; completion recorded via markProcessed inside the handler's transaction.
- **Success path:** event marked processed with attempts count; history rows materialize; loyalty points credit the ledger exactly once; OUTBOX_PROCESSED recon check goes green.
- **Failure handling:** a handler failure schedules a bounded retry with backoff (scheduleRetry); after max attempts the event dead-letters with its error captured — a poison event never blocks the rest of the batch; claim leases expire so a crashed runner's events return to claimable.
- **Retry logic:** automatic bounded retries with backoff; manual retry from the health screen after the operator fixes the cause; both paths reuse event-id idempotency so replays produce zero duplicate effects; two concurrent runners are safe (claim semantics tested).
- **Audit logging:** per-event processed_at/attempts/last_error; manual retry records the acting user; handler effects (history rows, loyalty ledger) carry their own actor/audit fields.
- **Observability:** pending/failed/dead-letter counts and oldest-event age exposed on the health screen and fed into the OUTBOX_STUCK recon check; dead-letter alert threshold pages ops before customers notice.
- **Recovery procedures:** stuck batch → lease expiry re-queues automatically; poison event → dead-letter, fix handler/payload cause, manual retry; systemic handler defect → disable that handler's flag (`order_fin.outbox_processor` is per-handler) while events accumulate PENDING without loss (today's state), then re-enable and drain.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
