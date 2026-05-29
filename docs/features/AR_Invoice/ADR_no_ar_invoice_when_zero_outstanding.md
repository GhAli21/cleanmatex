# ADR — Do NOT create an AR invoice when post-settlement outstanding is zero

**Status:** Accepted
**Date:** 2026-05-29
**Supersedes / extends:** [`ADR_ar_invoice_is_receivable_only.md`](./ADR_ar_invoice_is_receivable_only.md)
**Decided in:** BVM Wiring Phase 3 Round 2 (after manual QA of scenario M1 surfaced the inflated-invoice / constraint-violation defect).

---

## Context

CleanMateX submit-order can mix real payments (cash / card / gateway / bank-transfer / check) with credit-application legs (gift-card / wallet / customer-advance / customer-credit / loyalty-credit) plus an optional outstanding policy that decides what happens to any unpaid remainder.

Before this ADR the orchestrator's gate for creating an `org_invoice_mst` AR invoice row was:

```ts
const shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE';
```

That rule fires the AR invoice path whenever the caller / policy normaliser picks `CREDIT_INVOICE` — **even when there is nothing actually owed on terms** (the upfront cash + credit-application legs already covered the full sale). Combined with the pre-Round-2 sizing (invoice total = full sale) this produced inflated AR invoices that were forced to allocate cash against themselves via the legacy `org_payments_dtl_tr` path — which then violated `chk_payments_voucher_required`.

Even after Round 2 sizes the invoice to `plan.outstandingAmount`, creating a zero-amount AR invoice still produces noise: an OPEN-status header with `total=0`, an INVOICE_ISSUED outbox event with `amount=0`, an AR ledger DEBIT of 0, and an extra row in `org_invoice_mst` that downstream collection / aging / statement reports must ignore.

## Decision

**Create an AR invoice only when BOTH of the following are true:**

1. The order's effective outstanding policy is one of the receivable-on-terms policies:
   - `CREDIT_INVOICE` (B2B / invoice-to-account)
   - any future equivalent receivable-on-terms policy
2. The post-settlement outstanding receivable is strictly greater than the orchestrator's `TOLERANCE` constant:
   - `plan.outstandingAmount > TOLERANCE`
   - where `plan.outstandingAmount = max(0, finalTotal - realPaymentAmount - creditAppliedAmount)`

The invoice's `total` MUST equal that outstanding amount (Round 2's `expected_total_amount` rule).

## Consequences

### Positive

- **No zero-amount AR invoices.** A fully-paid `CREDIT_INVOICE` submit (cash + credit-apps cover the full sale) produces a voucher only — no `org_invoice_mst` row, no AR ledger debit, no AR_INVOICE_ISSUED outbox event.
- **No constraint trap.** The TX4 AR-allocation path (which violated `chk_payments_voucher_required`) is fully dead; the AR invoice represents the outstanding, and there is no cash to allocate against it.
- **Reports stay clean.** AR aging, statements, dunning queues, and the AR invoice hub list don't have to filter out `total=0` rows.
- **Idempotency simpler.** The `${orderId}_ar` key is only consumed when an invoice is actually needed; full-payment replays don't reserve a key for no work.

### Negative / trade-offs

- The orchestrator must compute and pass `plan.outstandingAmount` into the gate decision. It already does (since Round 2 also feeds it into `expected_total_amount`).
- B2B reporting can no longer assume "every CREDIT_INVOICE order has an `org_invoice_mst` row". The link is now: order has an AR invoice **iff** there was an actual receivable. Reporting must use `org_invoice_mst.order_id` joins (it already does) rather than assuming presence.

### Non-goals

- This ADR does NOT change the behavior of the multi-order API route `POST /api/v1/ar/invoices/from-orders`. That entry point still admits creating an AR invoice header for record-keeping (e.g. a B2B consolidator that needs a numbered document for multiple already-paid orders). The gate is enforced only at the submit-order orchestrator boundary.
- This ADR does NOT change the receivable-only invoice sizing rule from [`ADR_ar_invoice_is_receivable_only.md`](./ADR_ar_invoice_is_receivable_only.md). It extends it with a zero-outstanding short-circuit.

## Implementation

### Orchestrator gate (`web-admin/lib/services/order-submit-orchestrator.service.ts`)

```ts
// Phase 3 Round 2 — see ADR_no_ar_invoice_when_zero_outstanding.md.
// Create an AR invoice only when there is an actual receivable remaining
// after settling cash + every credit-application leg.
const shouldCreateArInvoice =
  effectiveOutstandingPolicy === 'CREDIT_INVOICE'
  && plan.outstandingAmount > TOLERANCE;
```

### Edge cases

| Scenario | `effectiveOutstandingPolicy` | `plan.outstandingAmount` | AR invoice? |
|---|---|---|---|
| B2B order, cash 30 + gift 10 + outstanding 60 | `CREDIT_INVOICE` | 60 | ✅ Created with total=60 |
| B2B order, cash 90 + gift 10 + no outstanding | `NONE` (normaliser flips to NONE) | 0 | ❌ Not created |
| B2B order, cash 0 + outstanding 100 | `CREDIT_INVOICE` | 100 | ✅ Created with total=100 |
| Retail cash sale, fully paid | `NONE` | 0 | ❌ Not created (already correct) |
| Retail with PAY_ON_COLLECTION | `PAY_ON_COLLECTION` | >0 | ❌ Not created — PAY_ON_COLLECTION never produces AR invoices |
| Hypothetical: caller forces `CREDIT_INVOICE` policy but covers full sale upfront | `CREDIT_INVOICE` | 0 | ❌ Not created (new rule) |

The last row is exactly the failure mode this ADR closes: previously it created a zero-amount AR invoice + a constraint-violating allocation row; now it correctly creates only the voucher.

### Tests

Pinned in `web-admin/__tests__/services/ar-invoice.service.test.ts` (Round 2 cases) and `web-admin/__tests__/services/order-settlement-planner.service.test.ts`. A focused orchestrator-gate test would be added when an orchestrator-level test fixture exists (currently deferred per Phase 2 close — needs broader mocking scaffold).

### Migration

None required. The gate is a pure code change in the orchestrator and the AR writer. Existing AR invoice rows in the DB are unaffected.

## References

- Surfacing incident: M1 manual QA, 2026-05-29 — order `d9a306fc-e3d7-4b40-9205-a1e5f21e5dcf` produced an inflated AR invoice (`total=2.04`) and a `chk_payments_voucher_required` violation on the legacy TX4 allocation path.
- Constraint: `chk_payments_voucher_required` on `org_payments_dtl_tr` (migration `0132_voucher_id_constraint_and_refund_backfill.sql`).
- Companion ADR: [`ADR_ar_invoice_is_receivable_only.md`](./ADR_ar_invoice_is_receivable_only.md).
- Phase 3 implementation log: [`../Order_Fin/bvm_wiring_phase3_implementation.md`](../Order_Fin/bvm_wiring_phase3_implementation.md).
