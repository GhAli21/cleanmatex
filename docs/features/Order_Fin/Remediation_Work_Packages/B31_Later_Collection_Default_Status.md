# B31 — Later Collection Default Status

## Metadata
Backlog ID: B31 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: M6, §31.1, §32, §50-B31
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (hard — same path) · Blocks: —
Recommended phase: Seq 4 (with B4/B5)

## Confirmed problem
`collectPaymentTx` never reads `default_creation_status` (column not selected) and hardcodes non-gateway → COMPLETED — a CHECK/BANK method configured PENDING is counted as paid instantly at later collection, before clearing (M6).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:695–703 | method select omits default_creation_status | config invisible |
| order-settlement.service.ts:827 | `gatewayCode ? 'PENDING' : 'COMPLETED'` | hardcode |
| order-settlement-planner.service.ts:90–106 | submit resolves config + explicit status correctly | parity target |

## Required outcome
Collection resolves creation status identically to submit (D9 config beats family fallback; explicit request may force PENDING, never COMPLETED over a PENDING config); PENDING-configured collections land as pending legs feeding the B30 worklist; paid recognition follows verification.

## Scope
Status resolution reuse inside the B4-refactored collect path; response warnings parity (`*_PENDING_CONFIRMATION`).

## Out of scope
BVM path (B4); idempotency (B5); transitions (B30).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (correct initial status) |
| Credit applications | NO |
| BVM | NO (line status via B4 path) |
| Cash drawer | POSSIBLE (with B32 gating) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (pending excluded from paid) |
| Reconciliation | YES |
| Customer receipt | YES (pending shown) |
| Audit/outbox | NO |

## Acceptance criteria
CHECK configured PENDING collected later → leg PENDING, order not PAID, appears in worklist; CASH behavior unchanged.

## Required tests
unit (resolution parity vs submit), integration, regression.

## Dependencies and sequencing
Ships with the B4/B5 wave.

## Delivery surfaces

Backend services: status resolution reuse (planner logic) inside the B4 collect path; method select gains default_creation_status/allow_status_override columns
Database/schema: none
API/endpoints: collect responses include per-leg resolvedPaymentStatus + `*_PENDING_CONFIRMATION` warnings (submit parity)
Frontend page/screen/dialog/action: collect-payment modal shows the resulting leg status before submit ("will be recorded as PENDING until verified") and a post-submit pending notice linking to the worklist (B30)
Reusable components/helpers: status chip; warning banner reuse
Permissions: unchanged
Validation: resolution parity asserted against the submit planner (shared function, not copied logic)
i18n/RTL: EN/AR pending-notice strings
Accessibility: notice announced; not color-only
Audit trail: unchanged (status on the fact row)
Observability: pending-collection counts feed worklist aging
Jobs/workers: none
Feature flag: rides `order_fin.collect_via_bvm` (B4)
Rollout: with the B4/B5 wave
Rollback: with B4 flag

## End-to-end operational flow

1. Cashier collects with a CHECK configured PENDING → modal states the leg will be pending; submit records PENDING; order stays unpaid-for-that-leg.
2. The leg appears in the B30 worklist; verification completes it; the customer receipt shows the pending status honestly.

UI states: standard Cmx state contract — loading, validation errors, permission-denied, duplicate-click protection (B5 keys), processing, success with pending notice, retry on failure; leg status history visible on the order Financial tab.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
