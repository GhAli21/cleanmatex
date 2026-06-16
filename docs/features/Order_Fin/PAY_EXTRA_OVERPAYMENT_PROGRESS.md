# Pay-Extra Overpayment — Implementation Progress

**Program:** ADR-050 Global Pay-Extra Intent  
**Started:** 2026-06-16  
**Status:** COMPLETE  
**Plan:** Pay-Extra Overpayment Production Implementation Plan (v2)

---

## Phase status

| Phase | Description | Status | Updated |
|-------|-------------|--------|---------|
| 0 | ADR-050 + progress shell | Complete | 2026-06-16 |
| 1 | Migration `0368_fin_overpay_save_to_wallet.sql` | Complete (await user apply) | 2026-06-16 |
| 2 | checkout-excess-metrics + catalog + Zod | Complete | 2026-06-16 |
| 3 | Backend wallet, validator, planner, voucher | Complete | 2026-06-16 |
| 4 | Reusable UI + Payment Modal V4 | Complete | 2026-06-16 |
| 5 | Collect-payment parity | Complete | 2026-06-16 |
| 6 | Tests + build + i18n | Complete | 2026-06-16 |
| 7 | Full documentation | Complete | 2026-06-16 |

---

## Deliverables checklist

- [x] ADR-050
- [x] Migration 0368 (user review/apply)
- [x] `checkout-excess-metrics.ts`
- [x] `SAVE_TO_CUSTOMER_WALLET` end-to-end
- [x] `pay-extra/` UI kit
- [x] Payment Modal V4 integration
- [x] Collect modal parity
- [x] Tests green + build green
- [x] User guide + CHANGELOG

---

## Notes

- Migration seq after `0367` → `0368` (0366–0367 taken by NTF/HQ work).
- Do not apply migrations via agent — user applies locally.
- `payExtraIntent` is UI-only; server infers pay-extra mode from resolution lines + tender surplus.

---

## Key files

| Area | Path |
|------|------|
| ADR | `docs/features/Order_Fin/ADR/ADR-050-Global-Pay-Extra-Intent.md` |
| Migration | `supabase/migrations/0368_fin_overpay_save_to_wallet.sql` |
| Metrics | `web-admin/lib/payments/checkout-excess-metrics.ts` |
| Hook | `web-admin/src/features/orders/hooks/use-pay-extra-checkout.ts` |
| UI kit | `web-admin/src/features/orders/ui/payment-modal/pay-extra/` |
| User guide | `docs/features/Order_Fin/user_guide_pay_extra_overpayment.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG_pay_extra.md` |
