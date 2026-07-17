# B24 — AR Allocation, Write-off, and Period Controls

## Metadata
Backlog ID: B24 · Severity: MEDIUM · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: §36, §50-B24
Required decisions: [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) (hard — GL events) · Blocks: —
Recommended phase: Seq 12

## Confirmed problem
AR payment unallocation/reallocation NOT_FOUND; write-off routes exist but GL posting and reversal are unproven/absent; invoice adjustment mutability via legacy math; AR documents are not period-gated; ECL absent (§36).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| ar-invoice.service.ts (allocate :576) | allocation exists; no unallocate | reallocation impossible |
| /ar/invoices/[id]/write-off + approve-sensitive | workflow routes | GL effect NOT_FOUND (report UNVERIFIED depth) |
| org_fin_period_mst | ERP periods exist | AR not gated |

## Required outcome
Unallocation/reallocation with lineage and caps; write-off posts the approved GL event with reversal path; AR document mutations period-gated; invoice adjustments via governed path only.

## Scope
Allocation reversal service, write-off GL wiring (AR_WRITE_OFF event via B6), period gate middleware for AR writes.
**Frontend surface (rule 7):** unallocate/reallocate actions on the AR invoice detail (allocations tab) with reason + maker-checker where thresholds apply; write-off flow completed end-to-end on screen (request → approve → posted state visible); period-blocked actions show the period status instead of a raw error.

## Out of scope
ECL and bad-debt recovery (B26); dunning/statements (implemented); tax documents (B14).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | POSSIBLE (allocation voucher lines) |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | POSSIBLE (write-off credit note per policy) |
| ERP-Lite GL | YES |
| Snapshot | YES (ar_receivable mirror on linked orders) |
| Reconciliation | YES (AR link checks extended) |
| Customer receipt | POSSIBLE (statement) |
| Audit/outbox | YES |

## Acceptance criteria
Misallocated receipt can be unallocated and reallocated with full lineage; approved write-off produces a balanced journal and is reversible; closed-period AR write rejected.

## Required tests
integration, accounting, database, concurrency (allocation races), regression.

## Dependencies and sequencing
After B6.

## Delivery surfaces

Backend services: allocation-reversal service (unallocate/reallocate with lineage); write-off GL wiring (via B6 event); AR period-gate middleware
Database/schema: allocation-reversal lineage columns on org_invoice_payments_dtl — assess additive
API/endpoints: POST invoice allocations/[id]/unallocate + reallocate; write-off endpoints extended with posting result
Frontend page/screen/dialog/action: AR invoice detail allocations tab — Unallocate/Reallocate actions with reason (+ approval above threshold); write-off flow shows request → approve → posted states; period-blocked writes show period status inline
Reusable components/helpers: approval dialog pattern; allocation table reuse
Permissions: existing `invoices:write_off` + approve-sensitive; unallocation code via B27
Validation: reallocation caps; period OPEN check; maker≠checker
i18n/RTL: EN/AR for actions/states/period messages
Accessibility: action confirmation semantics
Audit trail: reversal lineage + actors; write-off posting log
Observability: AR link recon checks extended; unallocation counts
Jobs/workers: none
Feature flag: `order_fin.ar_controls_v2`
Rollout: after B6; staging allocation-race and period scenarios
Rollback: flag off (actions hidden); posted journals reversed via engine policy

## End-to-end operational flow

1. Finance user finds a misallocated receipt → Unallocate with reason → allocation reversed with lineage → Reallocate to the correct invoice.
2. Write-off request → approver confirms → balanced journal posts → invoice state + GL agree; screen shows the posted state.
3. Any AR write into a closed period is rejected with the period shown; recon ties invoice, allocations, and journals.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (actions disabled with reason), duplicate-click protection (in-flight disable + idempotent replay), processing, success, retry on failure; allocation/write-off history visible on the invoice detail.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
