# B13 — Voucher Reversal Operational Unwind

## Metadata
Backlog ID: B13 · Severity: HIGH · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-09-17 (v2 payment + credit + SV funding unwind + preview)** — flag `order_fin_voucher_unwind` default OFF; migrations **0506 + 0507 APPLIED (owner, 2026-09-17)** local + remote. Not VERIFIED until Preview enable + §30 QA.
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
Posting a reversal voucher drives reverse wiring per line role: payment reversal (B10 primitive), credit-application reversal + ledger restore (D006), drawer compensating movement, snapshot recalc — atomic, keyed, permission-gated (`fin_vouchers:reverse`; no maker≠checker — the same user may reverse if they hold the permission).

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
Frontend page/screen/dialog/action: voucher detail screen — Reverse action gains a consequence preview (which payments/credits/movements will unwind) + reason confirm; reversal outcome shown per line. **2026-09-17:** reversal/original voucher, order, customer, branch, and cash-drawer session links plus linked effects on the reverse pair.
Reusable components/helpers: reason dialog; linked-effects viewer (getVoucherLinkedEffects reuse)
Permissions: `fin_vouchers:reverse` (permission is the only gate; same user may reverse — no maker≠checker)
Validation: line-role reversibility; drawer session for cash compensation; already-reversed guard
i18n/RTL: EN/AR consequence preview + statuses
Accessibility: preview table semantics; destructive confirm
Audit trail: reversal voucher ↔ original lineage; per-effect unwind records
Observability: recon no-duplicate-effect + drawer checks post-reversal
Jobs/workers: none
Feature flag: `order_fin_voucher_unwind` (flat snake_case; spec's `order_fin.voucher_unwind` is invalid — catalog never uses dots)
Rollout: migration 0506 APPLIED (owner, 2026-09-17) → Preview enable per tenant → cash receipt reverse QA → then HQ default/override
Rollback: flag off → reverse stays document-only (pre-B13). Do not delete the flag row while code still references it.

## End-to-end operational flow

1. Finance user opens a posted voucher → Reverse → preview lists every operational effect to be unwound.
2. User confirms with reason → one tx: reversal lines wired, payment REVERSED + contra, credits restored to ledgers, drawer compensated, snapshot recalc.
3. Order due and drawer expected-cash reflect the unwind; recon green; replay-safe.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind flag
Production activation allowed: only with full unwind verified — a reversal that touches documents but not money must remain impossible
Required backend gates: B10 VERIFIED (reversal primitive)
Required decision gates: D004, D006, D007 approved
Required verification gates: full-unwind scenarios green per line role (payment, credit, drawer, snapshot)

## Completion evidence

**IMPLEMENTED 2026-09-17 (v2).** B10 is VERIFIED. Cancel no longer auto-unwinds (ADR_CANCEL_RETURN_RULES). D006 restore is shared (`credit-application-reversal.service.ts`) and is driven by voucher reverse, not cancel.

**Migration `0506_add_feature_flag_order_fin_voucher_unwind.sql` — APPLIED (owner, 2026-09-17) local + remote.** Flag default FALSE. **Migration `0507_credit_app_loyalty_restore_pending.sql` — APPLIED (owner, 2026-09-17) local + remote.** Adds `LOYALTY_RESTORE_PENDING` to `chk_org_order_credit_apps_dtl_status`.

**Backend (flag ON):** per original line — `ORDER_PAYMENT` → B10 VOID/REVERSE (cash needs OPEN drawer); `ORDER_CREDIT_APPLICATION` → D006 restore (wallet/GC/advance/CN; loyalty → restore or `LOYALTY_RESTORE_PENDING`); `WALLET_TOPUP` / `GIFT_CARD_SALE` / `CUSTOMER_ADVANCE_RECEIPT` / `CUSTOMER_CREDIT_ISSUE` → claw back unused funding (insufficient/used balance aborts). Successful unwind marks reversal line `WIRED`. Flag OFF remains document-only.

**Frontend:** voucher Reverse dialog shows consequence preview (`getVoucherLinkedEffects`, including funding tenders). Document-only copy when the flag is off.

**Tests:** voucher-reversal (payment + credit + wallet-topup); credit-application-reversal (wallet restore + loyalty pending); workflow-cancel-guard (no unwind).

**§30.2 expected-cash fix (2026-09-17):** cash reverse over-decremented expected cash (1.070 → −1.070) because B10 `PAYMENT_REVERSAL` OUT was counted as a MANUAL movement after the payment already left COMPLETED. B35 MANUAL term now also excludes `reversed_payment_id` / `PAYMENT_REVERSAL`. Retest §30.2 expecting **0.000** when that cash was the only session fact.

**Reversal document completeness (2026-09-17):** reverse copies header/line operational fields (date, party, amounts, method facts) and writes `ref_voucher_id` on the new voucher. Migrations **0508 + 0509 APPLIED** (owner, 2026-09-17) local + remote. Remote verified: `RV-2026-000087` now has ref `RV-2026-000086`, date, party, customer/order, paid/outstanding.

**Commit:** pending owner · **Preview QA:** enable `order_fin_voucher_unwind` on Preview only; retest §30.2 expected-cash (code-fixed 2026-09-17) · **Verification:** not VERIFIED until §30 PASSes.
