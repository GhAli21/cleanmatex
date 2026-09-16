# ADR-053 — Order Cancellation Financial Disposition

**Status:** Superseded for auto-unwind (2026-09-17) · Historical Accepted 2026-07-04
**Area:** Order Financial Platform / Cancellation
**Date:** 2026-07-04

> **Superseded 2026-09-17 (owner):** Order cancellation is **operational only**. It must **not** auto-unwind payments, credits, or stored value. Money moves only through explicit Fin screens (B13 voucher reverse, B09 refunds, stored-value clawback). Canonical product rule: [`ADR_CANCEL_RETURN_RULES.md`](../../Workflow_Order_Advance/ADR_CANCEL_RETURN_RULES.md). Workflow Engine V2 already behaved this way; the Enhanced cancel path and cancel dialog now match. `unwindOrderFinancialsOnCancel` is **deprecated** and is not invoked from cancel.

> **Amended 2026-09-17 (owner):** REFUND disposition still uses `initiateRefund` → `approveRefund` → `processRefund`, but **maker≠checker is not required**. Holding `orders:approve_refund` is enough even when the actor is the requester. Many tenant laundries have a single employee. Canonical rule: [Remediation_Work_Packages/CLAUDE.md](../Remediation_Work_Packages/CLAUDE.md). Historical REFUND/STORE_CREDIT/KEEP_ON_ACCOUNT chooser is retired from cancel UI.

**Source:** Order-Fin validation 2026-07-03 finding FN-02 + Remediation Phase 4
(`docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md`)

## Context

Before this decision, order cancellation performed **no canonical financial
unwind**: the cancel RPC (`cmx_ord_canceling_transition`, migration 0130)
touches nothing financial, and the only app-side handling operated on the
deprecated `org_payments_dtl_tr` ledger (ADR-002), i.e. it did nothing. A
cancelled paid order kept COMPLETED payment rows and APPLIED credit
applications — the customer's money silently stranded.

## Decision

1. **Disposition is mandatory for collected money.** Cancelling an order with
   canonical `total_paid_amount > 0` requires an explicit
   `cancellation_disposition`:
   - `REFUND` — one idempotency-keyed refund per COMPLETED payment row via the
     existing three-stage refund flow (`initiateRefund` → `approveRefund` →
     `processRefund`; permission-gated, same user may approve),
     `reason=CANCELLED`, `method=ORIGINAL_METHOD`, lineage on
     `original_payment_id`.
   - `STORE_CREDIT` — the net collected total (payments minus change already
     returned) becomes one active credit note
     (`issueCreditNoteTx`, key `cancel-<orderId>-store-credit`).
   - `KEEP_ON_ACCOUNT` — funds retained (e.g. cancellation charge); gated by
     `orders:approve_refund`; no financial mutation, decision recorded in the
     audit event.
   Missing/invalid disposition → `CANCEL_DISPOSITION_REQUIRED` (server) and a
   forced choice in the cancel dialog (client).
2. **Applied stored-value credit is always reversed** — independent of the
   disposition. Each APPLIED `org_order_credit_apps_dtl` row is flipped to
   `REVERSED` via a compare-and-set (`updateMany` guarded by the current
   status) and restored to its source ledger: gift card (`refundGiftCardTx`),
   wallet (`topUpWalletTx`), advance (`issueAdvanceTx`), credit note
   (fresh note via `issueCreditNoteTx`). Types without an automated restore
   (e.g. `LOYALTY_POINTS`) are still flipped but surfaced as warnings — never
   silent.
3. **One unwind owner.** `unwindOrderFinancialsOnCancel`
   (`lib/services/order-cancel-financials.service.ts`) is the single financial
   unwind: credit reversal + disposition + promo-usage reversal
   (`reversePromoUsageTx`) + snapshot recalc
   (`recalculateOrderFinancialSnapshotTx`) + outbox audit event
   (`ORDER_CANCEL_FINANCIAL_UNWIND`). The workflow layer only sequences it —
   on **both** the old and new workflow code paths.
4. **Retry-safe by construction.** The status transition (RPC) and the unwind
   cannot share one DB transaction (Supabase RPC vs Prisma). Order: transition
   first, unwind second. Every unwind step is CAS- or idempotency-key-guarded,
   so a failed unwind surfaces `CANCEL_UNWIND_FAILED` and is safe to repeat.
5. **Returns** (`cmx_ord_returning_transition`) will reuse the same unwind
   service when return-refund automation lands (tracked follow-up; the legacy
   `_tr` return-refund loop was removed as dead code).

## Consequences

- Cancelling a paid order always answers "where did the money go" with an
  auditable record (refund rows / credit note / approved retention + outbox
  payload listing amounts, reversals, and warnings).
- The cancel dialog gains an amount-aware disposition chooser (EN/AR); unpaid
  and credit-only orders cancel exactly as before (credit reversal is
  automatic).
- No schema change: statuses (`REVERSED`), tables, and services already
  existed; only the flow was missing. No new permission codes.

## Rejected alternatives

- **Blocking cancellation of paid orders permanently** (the Phase-1 interim
  guard) — operationally unacceptable; kept only as the transitional state.
- **Auto-refunding without operator choice** — GCC laundry operations
  legitimately convert to store credit or retain cancellation charges;
  forcing refunds would push staff to workarounds.
- **Unwinding inside the cancel RPC (SQL)** — would duplicate stored-value
  ledger logic that lives in the service layer (BVM ownership, ADR-004).
