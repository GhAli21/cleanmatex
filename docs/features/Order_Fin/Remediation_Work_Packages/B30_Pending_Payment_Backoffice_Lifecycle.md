# B30 — Pending-Payment Back-office Lifecycle

## Metadata
Backlog ID: B30 · Severity: HIGH · Classification: BLOCKS_FEATURE / CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: H8, §31.1 (current vs required tables), §50-B30
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D009](00_Phase_0_Financial_Semantics/D009_Pending_Payment_Failure_Fallback.md), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: [B07](B07_Financial_Outbox_Processor.md) **only for outbox-based durable history; the pending-payment worklist and lifecycle transitions are independent** · [B27](B27_Financial_Permissions_And_Approvals.md) (impl — cancel/fail permission codes)
Blocks: [B08](B08_Gateway_Lifecycle_Integration.md) (impl — shares transition service)
Recommended phase: Seq 6

## Confirmed problem
Pending-payment lifecycle is verify-only: no cancel/fail/bounce/reject transition, no reason capture, no cross-order worklist (per-order Verify button only), no durable actor audit (`verified_by` exists only in the unconsumed outbox payload), PROCESSING gateway legs have no completion path, and a failed leg would strand outstanding with `outstandingPolicy='NONE'` (H8, §31.1).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:515–533 | verify PENDING→COMPLETED only; generic updated_by | no other transitions; no dedicated audit columns |
| order-payments-credits-tables.tsx:283 | per-order Verify button | no cross-order worklist |
| order-settlement-planner.service.ts:36, 169–181 | PROCESSING creation; pending counted in plan settlement | no completion path; no failure fallback |

## Required outcome
Per §31.1 target-state table: tenant/branch pending/authorized worklist (method, amount, age, reference, order link); actions VERIFY / CANCEL / FAIL-BOUNCE with mandatory reason and per-action permissions; completion path for PROCESSING legs; on cancel/fail — snapshot recalc + D009 outstanding-policy fallback + drawer/gateway compensation where a movement existed; dedicated actor-audit columns (verified_by/at, cancelled_by/at, reason) or working history via B7; replay-safe transitions.

## Scope
Transition service (D001 graph subset), worklist API + screen (Cmx components, EN/AR), audit columns migration assessment, action permissions wiring (B27 codes).

## Out of scope
Gateway webhooks (B8); reversal of COMPLETED legs (B10); warning-code fix (B33); plan-time counting change (D009 scope note).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (new transitions) |
| Credit applications | NO |
| BVM | POSSIBLE (line status sync) |
| Cash drawer | POSSIBLE (compensation on cancel of moved cash) |
| Gateway or bank | POSSIBLE (B8 later) |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (failed set aggregation live) |
| Reconciliation | YES |
| Customer receipt | POSSIBLE (status display) |
| Audit/outbox | YES (durable actions log) |

## Acceptance criteria
Accountant finds an aged pending check in the worklist, marks it BOUNCED with reason → leg FAILED, outstanding reclassified per D009 choice, durable audit row exists; PROCESSING leg completable; every action replay-safe and permission-gated.

## Required tests
unit (transitions), integration, API, UI, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
After D001/D009 approval + B27 codes; independent of B7 except durable-history option.

## Delivery surfaces

Backend services: payment transition service (D001 graph subset: verify/cancel/fail-bounce; PROCESSING completion path); worklist query service; D009 fallback executor
Database/schema: actor-audit columns on org_order_payments_dtl (verified_by/at, cancelled_by/at, transition_reason) — assess additive
API/endpoints: GET pending-payments worklist (filters: branch, method, age, status); POST transition endpoints per action (reason required, replay-safe)
Frontend page/screen/dialog/action: pending-payments worklist screen (tenant/branch scope, age badges from B19 sweep, order links); per-row actions VERIFY / CANCEL / MARK FAILED-BOUNCED with reason dialog; D009 fallback chooser on cancel/fail; loading/empty/error/retry/success/disabled states per Cmx patterns
Reusable components/helpers: transition service shared with B8/B10; reason dialog (B27 pattern); status chips
Permissions: `orders:verify_payment` (exists) + cancel/fail codes (B27)
Validation: transition legality; maker identity recorded; fallback choice from the D009 allowed set
i18n/RTL: EN/AR worklist + actions + fallback labels; RTL table
Accessibility: keyboard row actions; dialog focus; status as text
Audit trail: dedicated actor columns or B7 history (both acceptable per B7-optional dependency); every action durable and user-visible
Observability: worklist aging metrics; transition failure counts
Jobs/workers: aging sweep (B19) feeds the list
Feature flag: `order_fin.pending_worklist`
Rollout: worklist read-only first → verify action (parity with existing button) → cancel/fail actions with D009 flow
Rollback: flag off → per-order Verify button remains (current state)

## End-to-end operational flow

1. Accountant opens the worklist → filters aged pending checks → opens a row.
2. Bank confirms: VERIFY with note → leg COMPLETED, paid_at set, snapshot recalc, audit row; check bounced: MARK FAILED with reason → leg FAILED → D009 fallback chooser (re-tender / POC / AR) → outstanding reclassified.
3. Every action is permission-gated, replay-safe, and visible in the order history; the list refreshes with success feedback; failures show retryable errors.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: verify-parity mode anytime; cancel/fail actions only after D001 + D009 approval (transitions must have defined financial consequences before operators can trigger them)
Required backend gates: transition service implemented; B27 cancel/fail codes seeded
Required decision gates: D001, D009, D010 approved (cancel/fail actions); none for verify-parity mode
Required verification gates: transition test suite green (legality, replay, concurrency, D009 fallback outcomes)

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
