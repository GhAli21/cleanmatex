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

Verification includes modal helper tests, right rail tests, Zod payload tests, settlement planner tests, later collection/service tests, typecheck, i18n parity, and production build.

---

## Rollback Considerations

Rollback can revert the shared policy helper and callers. Existing database columns remain compatible because no schema changes were introduced.

