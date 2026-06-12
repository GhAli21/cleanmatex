# Pending — Payment Settlement & Receipt Allocation Follow-Ups

**Created:** 2026-06-11  
**Status:** Backlog (post–plan completion)  
**Parent plan:** [Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md](./Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) (Phases 0–6 **complete**)

This document tracks work **outside** the approved implementation plan that was intentionally deferred, spans a sibling project, or depends on a product decision not yet made.

---

## Summary

| # | Item | Project | Priority | Blocker |
|---|------|---------|----------|---------|
| 1 | HQ feature flags | cleanmatexsaas + cleanmatex | Medium | Product rollout policy |
| 2 | Reconciliation: unallocated excess = 0 | cleanmatex | Medium | None |
| 3 | Optional TS alias cleanup | cleanmatex | Low | None |
| 4 | Online payment gateway program | cleanmatex | **Parked** | Provider not chosen |
| 5 | Credit note multi-note split | cleanmatex | Low | Product |
| 6 | Branch overpayment/change overrides | cleanmatex | Low | Product |
| 7 | HQ catalog admin UI | cleanmatexsaas | Low | Phase 2+ |

---

## 1. HQ feature flags (cleanmatexsaas)

**Why:** Gradual tenant rollout and kill-switch without code deploy.

| Flag (planned) | Consumer | Current state |
|----------------|----------|---------------|
| `customer_receipt_allocation_v1` | Checkout-options, allocation APIs, account receipt screen | **Not defined in HQ; not consumed in web-admin** |
| `overpayment_disposition_v1` | Submit-order / collect-payment disposition paths | **Not defined in HQ; not consumed in web-admin** |

**Tasks:**

- [ ] cleanmatexsaas: seed flags in `sys_feature_flags_*` (per integration contract)
- [ ] cleanmatex: consume via HQ API in `checkout-config.service.ts`, allocation routes, account receipt page
- [ ] Document env / fallback when HQ API unavailable (fail closed vs allow)

**Reference:** Plan § Phase 5, [integration-contracts.md](../../dev/rules/integration-contracts.md)

---

## 2. Reconciliation — unallocated excess = 0

**Why:** Ops visibility when a voucher posted with excess but allocation preview was incomplete or failed silently.

**Tasks:**

- [ ] Add check to reconciliation service (e.g. `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` or extend `GATEWAY_PENDING_INTEGRITY` pattern)
- [ ] Compare `org_orders_mst.overpaid_amount` > ε with open allocation preview rows / disposition audit
- [ ] Surface in `GET /api/v1/finance/vouchers/{id}/reconciliation` response
- [ ] Manual test scenario in test_guide

**Effort:** ~1–2 days  
**Reference:** Plan § Phase 5 (deferred row)

---

## 3. Optional code hygiene (cleanmatex)

Not blocking production. Safe to batch in a small PR.

| Item | Location | Action |
|------|----------|--------|
| Legacy gateway **method** codes in wiring | `order-payment-wiring.handler.ts` | Branch on `PAYMENT_GATEWAY` + `gateway_code`, not `HYPERPAY`/`PAYTABS`/`STRIPE` as method |
| `CUSTOMER_CREDIT` vs `CREDIT_NOTE` aliases | `lib/types/order-financial.ts` | Document or narrow exports |
| `CUSTOMER_CREDIT_RECEIPT` line role | `voucher.ts` | Keep compat; no new usage (already deprecated) |
| `RETURN_CHANGE` naming confusion | Comments only | Documented in [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md) — **do not rename** fallback dest without DB migration |

**Bundle with:** Gateway Phase 0 when ADR-049 resumes, or standalone cleanup PR.

---

## 4. Online payment gateway (parked)

**Decision (2026-06-11):** Defer until payment provider is chosen (HyperPay / PayTabs / Stripe / other).

| Doc | Status |
|-----|--------|
| [ADR-048](./ADR/ADR-048-Canonical-Payment-Gateway-Method-Model.md) | Canonical model accepted; DB clean |
| [ADR-049](./ADR/ADR-049-Online-Payment-Gateway-Integration.md) | Full program **deferred** |

**To resume:**

1. Product picks provider
2. Approve ADR-049 for that provider only
3. Phase 0 code contract → Phase 1 session table → provider adapter

**No action** on `org_payment_methods_cf` gateway seed rows until then. Keep gateway submit blocked in Payment Modal V4.

---

## 5. Credit note picker — MVP limit

**Current:** One credit note per `CREDIT_NOTE` leg in Payment Modal V4.

**Future:** Multi-note split in a single checkout (product + UX design required).

**Files:** `payment-modal-v4-credit-note-picker.tsx`, allocation schemas.

---

## 6. Branch policy overrides

**Current:** `supports_change_return` / `supports_overpayment` resolved at **tenant** level via `org_payment_methods_cf`.

**Future:** Use `org_branch_payment_methods_cf` columns when branch admins need local overrides.

**Blocker:** Product request only.

---

## 7. HQ catalog administration (cleanmatexsaas)

**Future:** HQ UI to view/edit global `sys_fin_*` catalog rows and tenant policy templates.

**Not required** for tenant operations — catalogs seeded via migrations in cleanmatex.

---

## Documentation maintenance

When any item above ships:

1. Move it to the parent plan changelog or IMPLEMENTATION_STATUS
2. Remove or check off the row in this file
3. Update [overpayment-contract-implementation-tracker.md](../Order_Payment_Model/overpayment-contract-implementation-tracker.md)

---

## Related

- [tech_settlement_catalogs.md](./technical_docs/tech_settlement_catalogs.md)
- [tech_customer_receipt_allocation.md](./technical_docs/tech_customer_receipt_allocation.md)
- [overpayment-change-contract.md](../Order_Payment_Model/overpayment-change-contract.md)
- [test_guide.md](../Order_Payment_Model/test_guide.md)
