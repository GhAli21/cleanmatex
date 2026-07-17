# B10 — Payment Reversal and Void

## Metadata
Backlog ID: B10 · Severity: HIGH · Classification: BLOCKS_FEATURE · Status: NOT_STARTED
Authoritative report sections: §34, §5.1, §50-B10
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D004](00_Phase_0_Financial_Semantics/D004_Refund_Vs_Reversal_Vs_Void.md)
Dependencies: none · Blocks: [B13](B13_Voucher_Reversal_Operational_Unwind.md) (hard)
Recommended phase: Seq 7

## Confirmed problem
PAYMENT_REVERSAL and PAYMENT_VOID do not exist as transactions; VOIDED/REVERSED status values exist with no writers; error corrections must masquerade as refunds (§34).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| constants/order-financial.ts:468 | VOIDED/REVERSED in FAILED set | no transition services |
| order-settlement.service.ts:515–517 | verify-only lifecycle | no void for PENDING/PROCESSING/AUTHORIZED |
| §34 matrix | reversal/void NOT_FOUND | taxonomy per D004 Option B |

## Required outcome
Void service (never-effective legs → VOIDED/CANCELLED, no money movement, outstanding recomputes) and reversal service (COMPLETED leg → REVERSED + contra fact with lineage, drawer/voucher compensation via B13 wiring, maker-checker), both keyed and audited.

## Scope
Transition services + APIs; contra-fact lineage columns assessment; snapshot interaction tests (FAILED-set aggregation already correct).
**Frontend surface (rule 7):** VOID action on pending/authorized legs surfaces in the B30 worklist and order Financial tab; REVERSAL action (maker-checker dialog with reason) on the order Financial tab payments table and voucher detail — no API-only transitions.

## Out of scope
Voucher-side unwind mechanics (B13); gateway void/reversal calls (B8); chargebacks (B26).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (status + contra rows) |
| Credit applications | NO |
| BVM | YES (via B13) |
| Cash drawer | YES (reversal compensation) |
| Gateway or bank | POSSIBLE (B8) |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (reversal journal, B6) |
| Snapshot | YES (outstanding reopens) |
| Reconciliation | YES |
| Customer receipt | POSSIBLE |
| Audit/outbox | YES |

## Acceptance criteria
Voided PENDING leg reopens outstanding by leg amount with zero cash effects; reversed COMPLETED cash leg produces contra fact + drawer compensation + PAID→due flip; both replay-safe.

## Required tests
unit, integration, idempotency, concurrency, reconciliation, regression.

## Dependencies and sequencing
Blocks B13; co-designed with B30 transitions (shared graph from D001).

## Delivery surfaces

Backend services: void service (PENDING/PROCESSING/AUTHORIZED → VOIDED/CANCELLED) + reversal service (COMPLETED → REVERSED + contra fact), both on the shared D001 transition graph
Database/schema: contra-fact lineage column (`reversed_payment_id` or equivalent) on org_order_payments_dtl — assess; additive
API/endpoints: POST /orders/[id]/payments/[paymentId]/void and .../reverse (reason required; reverse = maker-checker)
Frontend page/screen/dialog/action: VOID action in B30 worklist + order Financial tab; REVERSAL maker-checker dialog (reason, approver step) on the payments table and voucher detail
Reusable components/helpers: transition service shared with B30/B8; reason-dialog component reuse
Permissions: new codes via B27 (payment void; payment reversal request/approve)
Validation: status legality per D001; reversal amount = full original; drawer/voucher compensation preconditions
i18n/RTL: EN/AR for actions, reasons, statuses
Accessibility: confirm dialogs focus-trapped; destructive action labeled
Audit trail: actor + reason on transition; contra lineage; outbox events
Observability: reversal/void counts; recon no-duplicate-effect checks
Jobs/workers: none
Feature flag: `order_fin.payment_reversal_void`
Rollout: void first (money-free), then reversal with B13 voucher unwind
Rollback: flag off; statuses written remain valid in the FAILED aggregation set

## End-to-end operational flow

1. Operator voids a pending check from the worklist with reason → leg VOIDED, snapshot recalc reopens outstanding by the leg amount, D009 fallback prompt follows.
2. For a completed erroneous cash leg: requester opens Reverse (reason), approver confirms → contra fact + drawer compensation (via B13 wiring) + snapshot flip PAID→due — atomic, replay-safe.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: void after D001 approval; reversal only with B13 unwind verified (a reversal without operational unwind is H4 again)
Required backend gates: B13 verified (reversal activation only; void has none)
Required decision gates: D001, D004 approved
Required verification gates: void/reversal test matrix green incl. concurrency + snapshot flips

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
