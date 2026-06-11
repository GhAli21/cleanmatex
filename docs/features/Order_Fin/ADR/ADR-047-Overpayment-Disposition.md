# ADR-047 — Overpayment Disposition (Explicit Excess Routing)

**Date:** 2026-06-11  
**Status:** Proposed — pending `Approved_By_Jh`  
**Project:** CleanMateX  
**Scope:** Order Fin / Payment Modal V4 / Submit Order / BVM / Stored Value / Cash Drawer  
**Depends on:** [ADR-046](./ADR-046-Payment-Method-Overpayment-Policy.md)

---

## Context

ADR-046 defines **when** cash change and retained non-cash overpayment are allowed via payment-method flags (`supports_change_return`, `supports_overpayment`). It does **not** define **where** retained excess goes after checkout.

Today, when `supports_overpayment = true` on a non-cash method, excess can remain on the payment row and surface as `overpaid_amount` on the order financial snapshot — with no explicit cashier choice and no auditable disposition rows. That creates reconciliation gaps (“extra money hanging nowhere”) and training/compliance risk.

Cash over-tender with change enabled is partially handled (applied amount + `change_returned_amount`), but non-cash over-collection and optional split disposition (part change, part wallet) are not first-class.

---

## Problem Statement

| Gap | Impact |
|-----|--------|
| No mandatory destination for retained excess | Support cannot answer “where did 0.500 go?” |
| Client may cap legs differently than server after promo/gift refresh | Silent mismatch or blocked submit without clear UX |
| Wallet/advance/credit note credit not tied to checkout excess | Partial failure risk if added ad hoc |
| `overpaid_amount` used as business state | Reporting conflates unresolved vs intentionally routed excess |

---

## Considered Options

1. **Auto-credit wallet** when excess exists and customer is linked.  
   - Rejected: no cashier intent, fraud/training issues, wrong for walk-ins.

2. **Keep `overpaid_amount` only** (status quo + docs).  
   - Rejected: audit and reconciliation gaps remain.

3. **Explicit `OverpaymentDisposition` aggregate** — required when excess > 0, executed atomically with order submit.  
   - **Selected.**

4. **Separate async job** for wallet/advance after order created.  
   - Rejected: partial failure (“order exists, wallet not credited”).

---

## Decision

Introduce a first-class **Overpayment Disposition** contract:

1. **Three money layers** (never conflated):
   - **Applied** — amount settling order balance (`PaymentLeg.amount`).
   - **Collected** — what customer paid (cash tendered, card capture, etc.).
   - **Excess** — `collectedAppliedTotal − saleTotal` (after gift/promo/discount credits), server-authoritative.

2. **Submit rule:** If `excessAmount > ε`, request **must** include `overpaymentDisposition` where  
   `sum(lines.amount) === excessAmount` (within money epsilon `0.001`).

3. **Disposition line types** (persisted codes, UPPER_SNAKE_CASE):

   | Code | Meaning |
   |------|---------|
   | `RETURN_CHANGE` | Cash returned to customer; links to cash leg |
   | `TO_WALLET` | Credit customer wallet |
   | `TO_ADVANCE` | Issue customer advance |
   | `TO_CREDIT_NOTE` | Issue open credit note |

4. **Policy matrix** (extends ADR-046, payment config remains source of truth):

   | Scenario | Allowed lines | Default UX |
   |----------|---------------|--------------|
   | Cash + `supports_change_return` | All four + adjust legs | Pre-fill `RETURN_CHANGE` up to change capacity |
   | Cash, change disabled | Wallet/advance/CN (if customer) or adjust legs | Block until adjusted |
   | Non-cash + `supports_overpayment` | Wallet/advance/CN or adjust legs — **not** `RETURN_CHANGE` | Force explicit choice |
   | Walk-in (no `customerId`) | `RETURN_CHANGE` (if cash) or adjust legs only | Stored-value destinations off |
   | Stored-value payment legs | Never source of excess — cap to `remainingDue` and balance | N/A |

5. **Execution:** New `overpayment-disposition.service.ts` runs **inside** the same Prisma transaction as order submit (after settlement plan validation, before/at voucher wiring). Reuses `topUpWalletTx`, `issueAdvanceTx`, credit-note issue, and cash-drawer `CASH_OUT` wiring.

6. **Audit:** New table `org_order_overpay_disp_dtl` records every disposition line with `target_ref` (wallet txn, advance id, credit note id, voucher id for change).

7. **Snapshot:** After successful disposition, `overpaid_amount` on order financial snapshot should be **0** when all excess is routed. Retained overpayment without disposition rows is **deprecated** for new submits once Phase A ships.

8. **Idempotency:** Existing `idempotencyKey` on submit-order replays full disposition (no double wallet credit).

---

## Architecture

```text
Payment Modal V4
  → preview-payment (authoritative saleTotal, giftCardApplied)
  → submit payload: paymentLegs + overpaymentDisposition?
       ↓
POST /api/v1/orders/submit-order
       ↓
order-submit-orchestrator.service.ts
  1. Recompute financials (server)
  2. buildSettlementPlan + validateSettlementPlan
  3. validateOverpaymentDisposition(plan, disposition, customerContext)  ← NEW
  4. Single transaction:
       a. Order + items + voucher lines (applied amounts)
       b. overpayment-disposition.service.execute()  ← NEW
       c. Financial snapshot (overpaid_amount = 0 if fully disposed)
       d. Outbox / history events
```

**Remaining due (authoritative):**

```text
remainingDue(excluding leg i) =
  saleTotal
  − giftCardApplied
  − sum(other legs’ applied amounts)
```

Leg `amount` ≤ `remainingDue` unless overcollection path opens disposition panel. Server rejects `AMOUNT_MISMATCH` and disposition errors.

---

## API / Schema

Submit payload extension (optional until excess > 0, then required):

```typescript
overpaymentDisposition?: {
  excessAmount: number;
  lines: Array<
    | { type: 'RETURN_CHANGE'; legRef: string; amount: number }
    | { type: 'TO_WALLET'; amount: number }
    | { type: 'TO_ADVANCE'; amount: number }
    | { type: 'TO_CREDIT_NOTE'; amount: number; noteReason?: string }
  >;
};
```

`legRef` matches client-generated stable id on each `PaymentLeg` in the modal (not array index).

Zod: `web-admin/lib/validations/new-order-payment-schemas.ts`  
Types/constants: `web-admin/lib/constants/overpayment-disposition.ts`, `web-admin/lib/types/overpayment-disposition.ts`

---

## Error Codes (new)

| Code | When |
|------|------|
| `OVERPAYMENT_DISPOSITION_REQUIRED` | Excess > 0, disposition missing |
| `OVERPAYMENT_DISPOSITION_MISMATCH` | Sum(lines) ≠ excessAmount |
| `OVERPAYMENT_DISPOSITION_NOT_ALLOWED` | Line type forbidden by policy or walk-in |
| `RETURN_CHANGE_EXCEEDS_CAPACITY` | Change > min(cashTendered − applied) per leg |
| `RETURN_CHANGE_LEG_INVALID` | `legRef` not a cash leg with change allowed |

Mapped in `use-order-submission.ts` under `newOrder.payment.errors.*` (EN/AR).

---

## Permissions

New permissions (single migration `0354_order_overpay_disposition.sql`):

| Code | Purpose |
|------|---------|
| `orders:overpayment_dispose` | Base — any disposition on checkout |
| `orders:overpayment_to_wallet` | Route excess to wallet |
| `orders:overpayment_to_advance` | Route excess to advance |
| `orders:overpayment_to_credit_note` | Route excess to new credit note |

Default roles: `super_admin`, `tenant_admin`, `operator` (wallet/advance/CN may be restricted to admin in Phase C via role assignment).

Feature flag (HQ): `overpayment_disposition_v1` — gates UI panel and server validation until rollout complete.

---

## Migration Impact

**New migration:** `0354_order_overpay_disposition.sql`

- Table `org_order_overpay_disp_dtl`
- Permission seeds
- RLS tenant isolation + service_role policy

No changes to existing migration files. No column changes to `org_orders_mst` required for v1 (disposition is detail-table authoritative).

---

## Phased Rollout

| Phase | Deliverable |
|-------|-------------|
| **A** | Server validation + block submit if excess unresolved; UI “Adjust payments” only |
| **B** | Disposition panel + `RETURN_CHANGE` + adjust legs |
| **C** | `TO_WALLET`, `TO_ADVANCE` in same transaction |
| **D** | `TO_CREDIT_NOTE` + split lines + permission gates |
| **E** | Later collection parity + reconciliation report |

**Do not** enable Phase A while still allowing submit with silent `overpaid_amount` retention.

---

## Testing and Verification

| Layer | Focus |
|-------|--------|
| Unit | Disposition sum, policy matrix, change capacity, remaining due with gift/discount |
| Planner + disposition validator | Cash/non-cash, multi-cash `.every()` |
| Integration | Submit → wallet balance, drawer OUT, snapshot overpaid = 0 |
| Idempotency | Double submit same key |
| UI | Modal blocks until disposition complete; EN/AR |
| Regression | Gift+NONE, stored-value caps, terminal/reference |

Extend [test_guide.md](../Order_Payment_Model/test_guide.md) with disposition matrix (minimum 20 scenarios).

---

## Rollback Considerations

- Feature flag off: skip disposition validation; revert to ADR-046 behavior (document as temporary).
- Migration is additive; rollback code path ignores `org_order_overpay_disp_dtl` reads.
- Disposition rows for production orders remain for audit if migration already applied.

---

## Related Documents

- [overpayment-change-contract.md](../Order_Payment_Model/overpayment-change-contract.md)
- [overpayment-contract-implementation-tracker.md](../Order_Payment_Model/overpayment-contract-implementation-tracker.md)
- [ADR-046](./ADR-046-Payment-Method-Overpayment-Policy.md)

---

## Approval

- [ ] `Approved_By_Jh` — product sign-off on policy matrix and phased rollout
