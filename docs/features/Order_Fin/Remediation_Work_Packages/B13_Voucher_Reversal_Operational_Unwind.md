# B13 — Voucher Reversal Operational Unwind

## Metadata
Backlog ID: B13 · Severity: HIGH · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: H4, §11, §38, §50-B13
Required decisions: [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md), [D006](00_Phase_0_Financial_Semantics/D006_Credit_Application_Reversal_Rules.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: [B10](B10_Payment_Reversal_And_Void.md) (hard — payment reversal primitive)
Blocks: — · Recommended phase: Seq 8

## Confirmed problem
`reverseBizVoucher` creates reversal document rows with `wiring_status: NOT_WIRED` — payments, credit applications, stored-value ledgers, drawer movements, and order due remain untouched (H4): a reversed voucher is paperwork, not an unwind.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| voucher-reversal.service.ts:130 | reversal lines NOT_WIRED | no operational effects |
| wiring handlers | forward-only | no reverse handlers |
| org_fin_voucher_trx_lines_dtl.reversed_line_id | lineage column exists | consumers missing |

## Required outcome
Posting a reversal voucher drives reverse wiring per line role: payment reversal (B10 primitive), credit-application reversal + ledger restore (D006), drawer compensating movement, snapshot recalc — atomic, keyed, permission-gated (`fin_vouchers:reverse` + maker-checker per D004).

## Scope
Reverse wiring handler family; partial-reversal semantics; PARTIALLY_REVERSED status handling; audit.

## Out of scope
GL reversal journal (B6); gateway reversal call (B8); refund flows (B1/B9).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (REVERSED + contra) |
| Credit applications | YES (restore) |
| BVM | YES |
| Cash drawer | YES |
| Gateway or bank | POSSIBLE |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (B6) |
| Snapshot | YES |
| Reconciliation | YES (no-duplicate-effect checks) |
| Customer receipt | POSSIBLE |
| Audit/outbox | YES |

## Acceptance criteria
Reversing a cash receipt voucher restores drawer expected-cash, reopens order due, restores stored-value balances, and reconciliation stays green; a NOT_WIRED reversal can no longer claim financial effect.

## Required tests
integration (full unwind per line role), concurrency, idempotency, reconciliation, regression.

## Dependencies and sequencing
Hard after B10; uses D006 shared reversal operation.

## Delivery surfaces

Backend services: reverse wiring handler family (per line role) driven by voucher-reversal.service; uses B10 reversal primitive + D006 credit reversal
Database/schema: none new (reversed_line_id exists)
API/endpoints: existing voucher reverse endpoint extended to run operational unwind; partial-reversal payload
Frontend page/screen/dialog/action: voucher detail screen — Reverse action gains a consequence preview (which payments/credits/movements will unwind) + maker-checker confirm with reason; reversal outcome shown per line
Reusable components/helpers: reason dialog; linked-effects viewer (getVoucherLinkedEffects reuse)
Permissions: `fin_vouchers:reverse` retained + approver step (B27)
Validation: line-role reversibility; drawer session for cash compensation; already-reversed guard
i18n/RTL: EN/AR consequence preview + statuses
Accessibility: preview table semantics; destructive confirm
Audit trail: reversal voucher ↔ original lineage; per-effect unwind records
Observability: recon no-duplicate-effect + drawer checks post-reversal
Jobs/workers: none
Feature flag: `order_fin.voucher_unwind`
Rollout: after B10; staging full-unwind scenarios per line role; enable
Rollback: flag off → reversal action disabled entirely (never document-only reversal again)

## End-to-end operational flow

1. Finance user opens a posted voucher → Reverse → preview lists every operational effect to be unwound.
2. Approver confirms with reason → one tx: reversal lines wired, payment REVERSED + contra, credits restored to ledgers, drawer compensated, snapshot recalc.
3. Order due and drawer expected-cash reflect the unwind; recon green; replay-safe.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only with full unwind verified — a reversal that touches documents but not money must remain impossible
Required backend gates: B10 VERIFIED (reversal primitive)
Required decision gates: D004, D006, D007 approved
Required verification gates: full-unwind scenarios green per line role (payment, credit, drawer, snapshot)

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
