# D004 — Refund versus Reversal versus Void

## Metadata
Decision ID: D004
Status: APPROVED (Expert)
Approval type: Expert
Selected option: Option B
Approved decision: Option B — refund, reversal, and void are three distinct transaction types (the `transaction_type` facet of D002 v2); the effects table is the binding taxonomy; chargebacks, bounced payments, and rejected payments (B26/B10) are externally-initiated reversals and reopen due via payment-status change per D003 v2
Rationale summary: auditors, drawers, and the GL treat "customer got money back", "we corrected an error", and "the tender never happened" differently; collapsing them creates phantom cash-outs and unexplained variances
Decision type: Transaction-taxonomy policy
Authoritative report sections: §8, §34, §5.1, H4, H8, B10, B13
Blocks: B1, B9, B10, B13
Affects: B26 (chargebacks reuse reversal semantics)
Owner: Expert (see Approval record)
Approval date: 2026-07-16
Supersedes: —

## Problem
The codebase has one refund workflow and a voucher "reversal" that unwinds nothing operationally (H4). Status values `VOIDED`/`REVERSED` exist in the FAILED lifecycle set but no service writes them. Without frozen definitions, B9/B10/B13 would each invent their own semantics for "undo money".

## Current-state evidence

| File or symbol | Current behavior | Why a decision is required |
|---|---|---|
| order-refund.service.ts | only forward "refund" concept exists; CASH/ORIGINAL record-only | boundary between refund and reversal undefined |
| constants/order-financial.ts:468 | FAILED set contains CANCELLED, EXPIRED, VOIDED, REFUSED, REVERSED — no writers | vocabulary ahead of runtime; transitions need meaning first |
| voucher-reversal.service.ts:130 | reversal lines created `wiring_status: NOT_WIRED` — no operational unwind | document reversal ≠ financial reversal must be explicit |
| order-settlement.service.ts:515–517 | verify rejects non-PENDING; no void path for PENDING/AUTHORIZED legs | void concept required for never-effective tenders |
| §34 matrix | PAYMENT_REVERSAL / PAYMENT_VOID / CHARGEBACK = NOT_FOUND | target taxonomy must be decided before building |

## Invariants
1. The three concepts are distinct transaction types with distinct lineage — never a flag on one shared row type.
2. A **VOID** applies only to a leg that never became financially effective (PENDING/PROCESSING/AUTHORIZED); it moves money nowhere.
3. A **REVERSAL** negates a completed transaction as an error correction: original row → REVERSED status, contra fact linked to it, all downstream effects (drawer, voucher, snapshot, GL when wired) compensated.
4. A **REFUND** is a new forward transaction returning value after a valid settlement; the original payment row stays COMPLETED.
5. A BVM voucher reversal document alone proves nothing operationally (H4); operational unwind is mandatory when the concept demands it.
6. Order-balance effect: VOID → outstanding recomputes as if the leg never existed; REVERSAL → same as void, full amount, automatically; REFUND → per D003 reopen rules.

## Options

### Option A — Single "refund" concept covers everything
*Benefits:* no new services. *Risks:* voids create fake cash-out records; corrections pollute refund reporting; chargebacks unmappable; audit cannot distinguish error from business return. Rejected.

### Option B — Three distinct concepts (recommended)

| Aspect | REFUND | REVERSAL | VOID |
|---|---|---|---|
| Commercial meaning | value returned to customer after valid settlement | erroneous transaction negated | never-effective tender cancelled |
| Payment row | original stays COMPLETED; refund row added | original → REVERSED + contra fact | original → VOIDED / CANCELLED |
| BVM | refund voucher (B9) | reversal voucher **with wired unwind** (B13) | line status update only |
| Drawer/gateway | cash-out movement / gateway refund | compensating movement / gateway reversal-void | none (nothing moved) |
| Tax | credit-note territory (B14) when sale reduced | tax facts follow the negated transaction | none |
| GL (target) | REFUND_ISSUED journal | reversal journal of original event | none |
| Order balance | per D003 v2 (commercial refunds do not reopen by default; rebill is explicit) | reopens by full amount automatically via status change (leg leaves COMPLETED set, D005 formula) | reopens by leg amount automatically via status change |
| Timing | after settlement, within refundable balance | same period preferred; approval mandatory | before completion only |

### Option C — Two concepts (merge reversal into void)
*Risks:* completed-transaction corrections would have no home or would masquerade as refunds; period reporting corrupted. Rejected.

## Recommended decision
**Option B.** Refund = business return (D002/D003 govern classification/reopen). Reversal = maker-checker error correction with mandatory operational unwind. Void = pre-completion cancellation of PENDING/PROCESSING/AUTHORIZED legs (the missing half of H8's lifecycle). Chargebacks, bounced payments, and rejected/failed settlements (B26/B10) are externally-initiated reversals — they reopen due automatically via payment-status change (D003 v2), never via refund rows.

## Approved decision (Expert)
**Option B** as recommended — see `Approved decision:` in Metadata for the binding text. Approval type: Expert. Selected for domain correctness (three financially distinct undo semantics) and system integrity (each concept has its own lineage, effects, and reopen mechanism).

## Financial rationale
Auditors, drawers, and the GL treat "customer got money back", "we corrected an error", and "the tender never happened" differently. Only the first touches refund liability reporting; only the second demands contra entries in the original context; only the third is cost-free. Collapsing them is how phantom cash-outs and unexplained variances are born.

## Runtime impact
B10 builds void/reversal transitions + services; B9 builds refund execution; B13 makes voucher reversal drive operational unwind; B30 worklist exposes VOID for pending legs; snapshot already aggregates VOIDED/REVERSED into the FAILED set correctly (§5.1).

## Database impact
Reversal contra facts need lineage columns (`reversed_payment_id` or equivalent) — B10 assesses; refund rows unchanged (B1 scope); no schema change decided here.

## Existing-data compatibility
No historical rows carry VOIDED/REVERSED from these flows; no backfill. Legacy "record-only" cash refunds remain refunds under D002 legacy handling.

## Related decisions
[D002](D002_Refund_Source_Classification.md), [D003](D003_Refund_Reopen_Due_Rules.md), [D001](D001_Payment_Lifecycle_And_Status_Transitions.md) (transition legality), [D006](D006_Credit_Application_Reversal_Rules.md), [D007](D007_BVM_And_ERP_Lite_Responsibilities.md).

## Affected work packages
[B01](../B01_Refund_Lineage_And_Reopen_Due.md), [B09](../B09_Refund_Execution_Parity.md), [B10](../B10_Payment_Reversal_And_Void.md), [B13](../B13_Voucher_Reversal_Operational_Unwind.md), [B26](../B26_Enterprise_FX_Bank_Gateway_And_ECL.md).

## Approval record
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Expert approver | — | APPROVED (Expert) — Option B | 2026-07-16 | Expert-selected option applied for domain correctness and system integrity; rationale summary in Metadata |

## Revision history
| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-07-15 | Initial proposal | Claude (audit follow-up) |
| 0.2 | 2026-07-16 | Delegated approval recorded, then reverted per folder CLAUDE.md; recommendation unchanged | Claude |
| 1.0 | 2026-07-16 | APPROVED — Option B | — |
| 1.1 | 2026-07-16 | Expert correction pass: approval normalized to APPROVED (Expert); bounced/rejected payments added to externally-initiated reversals; order-balance row aligned to D003 v2 (status-change reopen mechanism) | Expert review |
