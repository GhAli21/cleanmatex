# Pay-Extra Overpayment — Changelog

## 2026-06-16 — v1.0.0 (ADR-050)

### Added

- Global **Customer is paying extra** toggle (Payment Modal V4 + Collect Payment).
- **Validate payment** → Extra Receipt dialog flow when intent is ON.
- Pooled checkout excess via `computeCheckoutExcessMetrics()`.
- `SAVE_TO_CUSTOMER_WALLET` catalog row (migration `0368_fin_overpay_save_to_wallet.sql`).
- Wallet disposition executor + validator branch.
- Cash tender surplus enters disposition when pay-extra intent is inferred server-side.
- Explicit voucher `change_returned_amount` for RETURN_CASH_CHANGE resolutions.
- Reusable UI kit under `web-admin/src/features/orders/ui/payment-modal/pay-extra/`.
- EN/AR cashier guidance keys under `newOrder.payment.payExtraIntent`, `validatePayment`, `extraReceipt.*`.

### Unchanged

- Intent OFF: legacy overpayment / cash change behavior.
- Allocation remainder rules (auto fallback destination, manual 100% cover).

### Migration required

Apply `0368_fin_overpay_save_to_wallet.sql` before using wallet option in production.
