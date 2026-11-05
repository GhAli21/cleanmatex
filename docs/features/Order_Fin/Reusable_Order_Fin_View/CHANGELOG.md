# Changelog — Reusable Order Financial View

## 1.0.0 — 2026-11-01

- **Read model:** one normalized source set for saved orders, unsaved orders (payment modal) and Order Edit quotes; pure builders; statement adds up (rounding, tax-inclusive, extras and speed premium included); shared aggregation checks as warnings; batch header reader; server-only public allowlist projection.
- **APIs:** staff view, batch headers, server action, Order Edit live quote, public tracking and customer-portal views; one error envelope, `no-store`, rate limits, uniform public 404; customer portal matched on tenant and customer.
- **Component:** `OrderFinancialView` (sources `order` / `data` / `draft` / `edit`, presets badge → audit and public, preset switcher), header with status word and reconciliation badge, statement rows, Edit live card, payment-modal summary, print report; shared `CmxMoneyText`, `CmxStatement*`, `CmxCollapsibleSection`; EN/AR.
- **Screens:** order detail, full page, prints, ready, delivery, workspace, collect-payment, AR invoice linked orders, payment modal, Order Edit, public tracking, customer app.
- **Removed:** five legacy financial panels and the full-page financial tab with its own arithmetic; four browser/app balance computations (one ignored credits in the customer app).
- **Guard:** an ACCOUNTING rounding rule can no longer round coarser than the currency's minor unit (migration 0686, HQ API and form).
- **Rules:** `docs/dev/rules/order-fin-rules.md`, skill `/order-fin`, Cursor rule.
