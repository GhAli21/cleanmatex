# ADR-053 — Order Cancellation Financial Disposition

**Status:** Accepted
**Area:** Order Financial Platform / Cancellation
**Date:** 2026-07-04
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
     existing maker-checker refund flow (`initiateRefund`,
     `reason=CANCELLED`, `method=ORIGINAL_METHOD`, lineage on
     `original_payment_id`).
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
