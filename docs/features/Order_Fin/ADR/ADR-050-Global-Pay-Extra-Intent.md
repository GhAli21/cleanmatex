# ADR-050 — Global Pay-Extra Intent (Checkout Overpayment UX)

**Date:** 2026-06-16  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Payment Modal V4 / Collect Payment / Submit Order / Overpayment Resolution  
**Depends on:** [ADR-046](./ADR-046-Payment-Method-Overpayment-Policy.md), [ADR-047](./ADR-047-Overpayment-Disposition.md)

---

## Context

Cashiers sometimes collect **more than the order total** across **multiple payment methods** (cash + card + mobile transfer). The existing overpayment contract (Phases 0–6) resolves excess reactively but does not provide:

- A global **customer is paying extra** intent toggle
- A **Validate Payment** step before submit when intent is ON
- **SAVE_TO_CUSTOMER_WALLET** as a direct disposition option
- **Cash tender surplus** routing to disposition (not auto-change) when intent is ON

---

## Decision

1. **Global pay-extra intent** is **UI-only** — not sent in submit payload. Server derives excess from leg amounts, tendered amounts, and `overpaymentResolution`.

2. **Pooled excess** — one `unresolvedExcessAmount` across all pay-now legs, computed by shared `computeCheckoutExcessMetrics()`.

3. **Intent OFF** — legacy behavior unchanged (cash change auto-resolves applied excess).

4. **Intent ON** — tender surplus `(cashTendered − applied)` enters disposition pool; explicit `RETURN_CASH_CHANGE` or adjust-legs resolves change; wallet/advance/credit/allocate routes surplus.

5. **New resolution code:** `SAVE_TO_CUSTOMER_WALLET` (catalog migration `0368`).

6. **Validate loop:** Validate Payment → Extra Receipt dialog → adjust legs or pick destination → re-validate until `validationPhase === 'ready'` or zero excess.

7. **UI:** single destination for full excess; API supports multi-line `overpaymentResolution.lines[]` for future split.

8. **Allocation remainder:**
   - Auto allocate: remainder → tenant `fallback_destination` (default advance; can be wallet).
   - Manual allocate: must cover 100% or return to Extra Receipt.
   - Direct wallet/advance/credit: full excess via disposition.

---

## Appendix — Gap register (implementation)

| # | Gap | Fix |
|---|-----|-----|
| G1 | Server cannot read toggle | Shared metrics function |
| G2–G3 | Wallet validator/executor missing | Phase 3 backend |
| G4 | Voucher auto-change | Explicit change from plan |
| G5 | V4 RBAC | Wire permissions |
| G6 | Duplicate Extra Receipt UI | Dialog-only when intent ON |
| G7 | Stale validation phase | Reset on leg change |
| G8–G9 | Error mapping / collect schema | Phase 3–5 |
| G10 | Types drift | Catalog test + Prisma generate after migration |
| G11–G12 | Allocation UX | Fallback labels + guidance banners |
| G13 | Toggle too strict | Enable for overpayment OR cash change |
| G14 | RETURN_CASH_CHANGE builder | build-overpayment-resolution |
| G15 | Progress tracking | PAY_EXTRA_OVERPAYMENT_PROGRESS.md |

---

## Consequences

Positive: Clear cashier guidance; multi-method extra; wallet disposition; backward compatible.

Tradeoff: Additional validate step when intent ON; cash drawer/voucher must honor explicit change when surplus routed to wallet.

---

## References

- [PAY_EXTRA_OVERPAYMENT_PROGRESS.md](../PAY_EXTRA_OVERPAYMENT_PROGRESS.md)
- [overpayment-change-contract.md](../../Order_Payment_Model/overpayment-change-contract.md)
