# Overpayment Contract Implementation Tracker

**Last updated:** 2026-06-11 (test guide v2.0 — 35 scenarios)  
**Plan status:** [Payment Settlement & Receipt Allocation](../Order_Fin/Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) — **Phases 0–6 complete** (Approved_By_Jh)  
**Pending backlog:** [Pending_Payment_Settlement_Follow_Ups.md](../Order_Fin/Pending_Payment_Settlement_Follow_Ups.md)

---

## ADR-050 Pay-Extra Intent (2026-06-16)

| Item | Status |
|------|--------|
| ADR-050 | ✅ |
| Migration `0368_fin_overpay_save_to_wallet` | ✅ file ready — user apply |
| `checkout-excess-metrics.ts` + tests | ✅ |
| `SAVE_TO_CUSTOMER_WALLET` executor + validator | ✅ |
| Pay-extra UI kit + V4 + Collect parity | ✅ |
| EN/AR guidance + `check:i18n` | ✅ |
| Docs: user guide, CHANGELOG, progress | ✅ |

See: [PAY_EXTRA_OVERPAYMENT_PROGRESS.md](../Order_Fin/PAY_EXTRA_OVERPAYMENT_PROGRESS.md)

---

## Program completion summary

| Phase | Status | Key deliverables |
|-------|--------|------------------|
| 0 — Discovery & ADR | ✅ | ADR-047 finalized, product defaults |
| 1 — Catalogs | ✅ | `0357`, `0354`, `settlement-catalog.ts` |
| 2 — Basic disposition | ✅ | Validator, extra-receipt UI, cash change |
| 3 — Stored-value disposition | ✅ | Advance + credit in submit TX |
| 4 — Customer receipt allocation | ✅ | Services, APIs, drawers, wiring handlers |
| 5 — Later collection | ✅ | Collect modal, account receipt screen, nav `0359` |
| 6 — Legacy cleanup | ✅ | `0360`, silent retention removed, V4 hook refactor |

**Automated tests (payment/settlement scope):** 124/124 pass (2026-06-12) · `npm run build` green

---

## Completed changes

### Core overpayment contract (baseline)

- UI: Payment Modal V4 models CASH `cashTendered` separately from applied `amount`; shows Applied, Cash Tendered, Change Returned, Unresolved Overpayment.
- API/schema: Structural checks in Zod; method-policy in settlement services.
- Policy: `resolvePaymentOverpaymentPolicy()` for frontend and backend.
- Services: Submit-order planner enforces cash change and retained overpayment before voucher creation.
- BVM wiring: `tendered_amount` / `change_returned_amount` on voucher lines and order payments.
- Cash drawer: Retained cash amount (not gross tendered); `CASH_OUT` links `fin_voucher_id` only.
- Later collection: `collectPaymentTx()` parity with submit-order disposition + allocation.
- Gateway methods: Metadata legs only; no redirect integration ([ADR-049](../Order_Fin/ADR/ADR-049-Online-Payment-Gateway-Integration.md) deferred).
- Snapshot: `overpaid_amount` = unresolved excess only after Phase 6.

### Payment Modal V4 production fixes (2026-06-11)

| Area | Primary files |
|------|---------------|
| Price override on create | `use-order-submission.ts` |
| Gift + NONE policy | `order-submit-orchestrator.service.ts` |
| Change clamp | `voucher-line.service.ts` |
| Check due date | `payment-modal-v4.tsx`, `new-order-payment-schemas.ts`, `check-date.ts` |
| Stored-value caps | `payment-modal-v4.utils.ts`, `payment-modal-v4.tsx` |
| Multi-cash change | `payment-modal-v4.utils.ts` (`.every()` on cash legs) |
| Submit error mapping | `use-order-submission.ts`, `messages/en.json`, `messages/ar.json` |
| Credit note picker | `payment-modal-v4-credit-note-picker.tsx` (one note per leg — MVP) |
| Terminal required | `payment-modal-v4.tsx`, `order-settlement-planner.service.ts` |
| CARD auth reference | `payment-modal-v4.utils.ts`, planner |
| Overpayment allocation hook | `use-overpayment-allocation.ts` shared with collect + account receipt |

### Phase 4–5 UI surfaces

| Surface | Path / component |
|---------|------------------|
| Payment Modal V4 | Extra receipt card + auto/manual allocation drawers |
| Order collect | `OrderCollectPaymentModal` on order detail + ready screen |
| Account receipt | `/dashboard/customers/account-receipt` (nav `0359`, permission `0358`) |

---

## Tests

| Suite | Coverage |
|-------|----------|
| `payment-modal-v4.utils.test.ts` | Cash, caps, multi-cash, CARD auth, check date, gateway state helpers |
| `order-settlement-planner.service.test.ts` | Change, overpayment, terminal, explicit `paymentStatus` |
| `settlement.service.test.ts` | Later collection + disposition |
| `collection-overpayment.test.ts` | Collect metrics parity |
| `customer-receipt-allocation.service.test.ts` | Auto oldest-due, fallback |
| `overpayment-resolution-validator.service.test.ts` | Resolution gates |
| `settlement-catalog.test.ts` | DB constant parity |

Run: [test_guide.md § Automated validation](./test_guide.md#automated-validation)

---

## Migrations (applied)

| Migration | Purpose |
|-----------|---------|
| `0357_fin_settlement_catalogs_v1_1.sql` | Catalog tables + BVM seed extensions |
| `0354_order_overpay_disposition.sql` | `org_fin_overpay_disp_dtl` audit |
| `0358_permissions_customer_receipt_allocate.sql` | `customers:receipt_allocate` |
| `0359_nav_customers_account_receipt.sql` | Account receipt nav dual-write |
| `0360_order_fin_phase6_legacy_cleanup.sql` | Disp table align + `overpaid_amount` backfill |

---

## Expected numbers (QA)

- Cash exact: Applied = Tendered, Change = 0, Unresolved = 0
- Cash over-tender (allowed): Change = tendered − applied, Unresolved = 0
- Cash over-tender (blocked): `CASH_CHANGE_NOT_ALLOWED`
- Card overpayment (blocked): `METHOD_OVERPAYMENT_NOT_ALLOWED` unless policy allows retention
- Gift + NONE: Orchestrator unpaid balance excludes gift from cash requirement correctly

---

## Deferred / pending (not plan blockers)

See **[Pending_Payment_Settlement_Follow_Ups.md](../Order_Fin/Pending_Payment_Settlement_Follow_Ups.md)** for full backlog:

- HQ feature flags (`customer_receipt_allocation_v1`, `overpayment_disposition_v1`)
- Reconciliation check: unallocated excess = 0
- Online payment gateway ([ADR-049](../Order_Fin/ADR/ADR-049-Online-Payment-Gateway-Integration.md))
- Credit note multi-note split; branch policy overrides

---

## Related documentation

| Doc | Role |
|-----|------|
| [overpayment-change-contract.md](./overpayment-change-contract.md) | Money concepts |
| [test_guide.md](./test_guide.md) | Manual + automated QA |
| [walkthrough.md](./walkthrough.md) | Cashier UI flow |
| [tech_settlement_catalogs.md](../Order_Fin/technical_docs/tech_settlement_catalogs.md) | Catalog tables + vocabulary |
| [tech_customer_receipt_allocation.md](../Order_Fin/technical_docs/tech_customer_receipt_allocation.md) | Allocation services + APIs |
| [ADR-046](../Order_Fin/ADR/ADR-046-Payment-Method-Overpayment-Policy.md) | Method overpayment policy |
| [ADR-047](../Order_Fin/ADR/ADR-047-Overpayment-Disposition.md) | Disposition model |
| [ADR-048](../Order_Fin/ADR/ADR-048-Canonical-Payment-Gateway-Method-Model.md) | Gateway canonical model |
| [ADR-049](../Order_Fin/ADR/ADR-049-Online-Payment-Gateway-Integration.md) | Gateway integration (deferred) |
