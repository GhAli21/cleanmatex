# B09 — Refund Execution Parity

## Metadata
Backlog ID: B9 · Severity: HIGH · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §8 (destinations table), §34, §40 (cash refund NOT_FOUND), §50-B9
Required decisions: [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: [B01](B01_Refund_Lineage_And_Reopen_Due.md) (hard — classification input); [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) (opt — drawer expected-cash coordination)
Blocks: — · Recommended phase: Seq 7

## Confirmed problem
Cash/original-method refunds are record-only: no drawer OUT movement, no REFUND_VOUCHER (type exists, disconnected), no gateway call — physical money movement is financially invisible (§8.1 process row).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-refund.service.ts:461–489 | wallet/CN execute; CASH/ORIGINAL record-only | no operational execution |
| constants/voucher.ts:60 | REFUND_VOUCHER defined | no production caller |
| refund-voucher-service.ts | exists | orphaned |
| cash-drawer movements | no refund OUT writer | drawer truth diverges on refunds |

## Required outcome
Processing a cash refund creates the REFUND_VOUCHER (+ lines), a drawer CASH_OUT movement wired to it, and POS-session gating; original-method (card/gateway) refunds route to the B8 gateway surface or an explicit manual-settlement record; all keyed (D010).

## Scope
Refund voucher activation + wiring handler; drawer OUT in process flow; execution-method resolution per destination.

## Out of scope
Classification/reopen (B1 — per D002 v2 / D003 v2: execution never alters classification, reason_context, or reopen values; commercial refunds do not reopen due, and B9 must not add any reopen side effect); gateway API itself (B8); GL journal (B6); tax credit note (B14).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | YES (refund voucher) |
| Cash drawer | YES (OUT movement) |
| Gateway or bank | POSSIBLE (via B8) |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (B6 event) |
| Snapshot | NO (facts already correct via B1) |
| Reconciliation | YES (refund-link + cash checks) |
| Customer receipt | YES (refund receipt print) |
| Audit/outbox | YES |

## Acceptance criteria
Cash refund reduces expected drawer cash by exactly the refund amount; refund voucher links to refund row and movement; no execution claim without an actual operational fact.

## Required tests
integration, reconciliation, idempotency, UI (refund receipt), regression.

## Dependencies and sequencing
Hard after B1; coordinates with B16 (drawer filtering) for expected-cash math.

## Delivery surfaces

Backend services: processRefund execution branch (REFUND_VOUCHER creation via voucher-biz/line/posting; drawer CASH_OUT; gateway hand-off to B8 surface); refund-voucher-service activated or retired into the shared path
Database/schema: none new (refund voucher uses existing voucher tables; movement uses existing drawer table)
API/endpoints: existing process endpoint extended — response includes voucher id + movement id
Frontend page/screen/dialog/action: refund receipt print (voucher artifact) reachable from the B34 refunds hub and order Financial tab; drawer session detail shows refund OUT movements
Reusable components/helpers: voucher print component reuse; drawer movement list reuse
Permissions: existing refund codes; cash execution additionally requires an OPEN drawer session (POS gate exists)
Validation: drawer session OPEN for cash; method-capability check for original-method execution
i18n/RTL: EN/AR refund receipt + movement labels
Accessibility: print view semantics per existing report pattern
Audit trail: voucher ↔ refund row ↔ movement backlinks; actor stamped
Observability: refund-link recon checks (REFUND_LINK_EXISTS) extended to voucher/movement
Jobs/workers: none
Feature flag: `order_fin.refund_execution` (record-only fallback until verified)
Rollout: after B1 VERIFIED; staging drawer-parity checks; enable
Rollback: flag off → record-only behavior (today's state), facts remain consistent

## End-to-end operational flow

1. Processor confirms a cash refund (B34 screen) → service executes: refund voucher posted, drawer CASH_OUT written, refund row PROCESSED, snapshot recalc — one tx.
2. Cashier sees drawer expected-cash drop by the refund amount; customer receives the printed refund receipt.
3. Original-method (card/gateway) refunds route to the B8 surface or an explicit manual-settlement record — never silently claimed.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only after B1 VERIFIED (classification correctness) and drawer parity tests green
Required backend gates: B1 VERIFIED
Required decision gates: D004, D007 approved
Required verification gates: drawer-parity tests green; refund voucher ↔ movement ↔ row link assertions passed

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
