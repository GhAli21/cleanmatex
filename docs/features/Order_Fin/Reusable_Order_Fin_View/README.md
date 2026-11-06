# Reusable Order Financial View

One component, one read model, one set of routes for every screen that shows an
order's money: order detail, the full page, prints, handovers, the collect-payment
modal, the order workspace, delivery, AR invoices, the payment modal (unsaved
order), the Order Edit live card, the public tracking link and the customer app.
It shows the server's figures and never computes money in the browser.

| Doc | What it is |
|---|---|
| [PLAN.md](PLAN.md) | Approved plan, decisions D1–D36, task list P0–P9 |
| [DESIGN.md](DESIGN.md) | Data flow, statement layout, states (mockup signed off 2026-10-30) |
| [STATUS.md](STATUS.md) | Progress log per increment |
| [developer_guide.md](developer_guide.md) | How to use, extend and test it |
| [user_guide.md](user_guide.md) | What each part of the statement means (EN/AR terms) |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner-runnable scenarios, screen by screen |
| [followups_by_user.md](followups_by_user.md) | Everything left for the owner (QA, E2E, commit) |
| [CHANGELOG.md](CHANGELOG.md) · [version.txt](version.txt) | Release notes |
| Rules | [`docs/dev/rules/order-fin-rules.md`](../../../dev/rules/order-fin-rules.md) · skill `/order-fin` · `.cursor/rules/order-fin.mdc` |

Runs as one sequence with [Line-Level Money Snapshot](../Line_Level_Money_Snapshot/STATUS.md) (the commercial calculator it shows).

## Implementation checklist (P9-03)

| Area | This feature |
|---|---|
| Permissions | **None new.** Staff routes: `orders:read` (view, batch headers), `orders:edit` (Edit quote). Public routes: tracking token / verified customer session. Void-charge panel keeps `orders:manual_charge`. |
| Navigation | None (no new menu entry; existing screens show the view). |
| Tenant settings | None. |
| Feature flags | None (pre-launch; the view replaced the old panels directly). |
| Plan limits | None. |
| API routes | `GET /api/v1/orders/[id]/financial-view` · `POST /api/v1/orders/financial-headers` · `POST /api/v1/orders/[id]/changes/quote` · `GET /api/v1/public/track/[token]/financial-view` · `GET /api/v1/public/customer/orders/[orderNo]/financial-view` · server action `getOrderFinancialViewAction`. One error envelope, `Cache-Control: no-store`. |
| Rate limits (Upstash) | `editQuoteUser` 120/min per user · `publicFinancialView` 60/min per IP |
| Migrations | 0679 (receipts index), 0681 (vouchers / invoice-orders tenant-first indexes), 0686 (`chk_scrr_acct_minor_unit`: ACCOUNTING rounding = one minor unit) — all applied local + remote |
| Constants / types | `lib/constants/order-fin-view.ts` (sections, groups, modes, presets, metrics, public allowlists, `ORDER_FIN_API_ERRORS`, `ORDER_FIN_HEADERS_MAX`, `ORDER_FIN_PUBLIC_MAX_BYTES`) · `lib/types/order-fin-view.ts` · `lib/validations/order-fin-view-schemas.ts` |
| i18n | `messages/{en,ar}/orders/finView.json` (namespace `orders.finView.*`); reused `orders.detail.financial.warning.*`, `paymentConfig.methods.settlementTypeCodes.*`; `invoices.ar.detailTabs.columns.orderBalance`; mobile `orders.statement.*` |
| Shared UI | `CmxCollapsibleSection`, `CmxMoneyText`, `CmxStatement*` (`@ui/data-display`, `.clauderc`) |
| Env vars | None for the app. E2E only: `E2E_FIN_ORDER_ID` (+ the usual `E2E_LOGIN_*`). |
| HQ | No HQ settings, flags or permissions. HQ rounding-rule service and form refuse a coarse ACCOUNTING rule (`ACCOUNTING_ROUNDING_TOO_COARSE`). |
| Mobile | `cmx_mobile_apps` customer app: order detail payment summary (P6-12). |
