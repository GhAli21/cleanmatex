# ADR-046 — Payment Method Overpayment and Cash Change Policy

**Date:** 2026-06-11  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Payment Modal V4 / Payment Config / BVM / Cash Drawer

---

## Context

Order checkout needs to distinguish cash over-tender from true accounting overpayment. A cashier may receive more cash than the amount applied to the order and return change, while card, gateway, wallet, gift card, and credit methods must not silently over-apply unless explicitly configured.

Existing tenant payment method config already stores `supports_change_return`, `supports_overpayment`, and `requires_cash_drawer`. Branch payment method config already participates in effective method resolution for the columns it owns.

---

## Considered Options

1. Use tenant settings for overpayment behavior.
2. Use per-payment-method flags only.
3. Add new branch override columns immediately for overpayment/change flags.

---

## Decision

Payment config APIs/services are the policy source for cash change and retained overpayment. `org_payment_methods_cf` provides `supports_change_return`, `supports_overpayment`, and `requires_cash_drawer`; branch payment method overrides from `org_branch_payment_methods_cf` take precedence where that table has corresponding override columns.

Tenant settings are intentionally not used for overpayment/change behavior. Cash tendered, applied amount, change returned, and unresolved overpayment are separate accounting concepts. Cash drawer movement records retained cash, not gross tendered cash.

---

## Consequences

Positive: UI, submit-order, later collection, voucher wiring, payment rows, drawer movements, and snapshots now use one contract. Cash change no longer creates `OVERPAID` order status or `overpaid_amount`.

Tradeoff: Branch-level override columns for `supports_change_return` and `supports_overpayment` are not added until there is a product requirement to override those flags per branch.

---

## Migration Impact

No migration is required for this decision. Existing `org_payment_methods_cf` columns are used. Future branch-level override support, if requested, must be implemented through a new immutable migration under `supabase/migrations`.

---

## Testing and Verification

Verification includes:

- Modal helper tests: `payment-modal-v4.utils.test.ts` (caps, multi-cash, CARD auth, check date)
- Right rail tests: `payment-modal-v4.right-rail.test.ts`
- Submit payload: `use-order-submission.price-override.test.ts`
- Orchestrator math: `order-submit-orchestrator.unpaid-balance.test.ts`
- Planner: `order-settlement-planner.service.test.ts` (terminal, reference, cash change)
- Voucher lines: `voucher-line.service.test.ts` (change clamp)
- Integration: `checkout-multi-payment.test.ts`
- Later collection: `settlement.service.test.ts`
- Typecheck, i18n parity (`npm run check:i18n`), production build

Full command list: [Order_Payment_Model/test_guide.md](../Order_Payment_Model/test_guide.md).

---

## Rollback Considerations

Rollback can revert the shared policy helper and callers. Existing database columns remain compatible because no schema changes were introduced.

