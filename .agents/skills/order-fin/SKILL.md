---
name: order-fin
description: Order money in CleanMateX — reading, showing or calculating an order's totals, payments, credits, balance, tax, discounts, refunds; the Order Financial View component, its routes and presets; the commercial calculator; Order Edit money. Use for any order financial read, display or calculation.
user-invocable: true
effort: medium
agents:
---

# Order Fin

**Rules (authoritative, read first):** `docs/dev/rules/order-fin-rules.md`.
Program docs: `docs/features/Order_Fin/Reusable_Order_Fin_View/` (PLAN, DESIGN, STATUS, QA_TEST_GUIDE) and `docs/features/Order_Fin/Line_Level_Money_Snapshot/`.

## When to load

Any change that reads, shows or calculates an order's money: a screen, report, print, API, the payment modal, Order Edit, the customer app statement, reconciliation.

## Show money: the one component

```tsx
import { OrderFinancialView } from '@features/orders/order-fin-view/ui/order-financial-view';

<OrderFinancialView source={{ kind: 'order', orderId }} config={{ preset: 'detailed', presetSwitcher: ['detailed', 'full'] }} />
<OrderFinancialView source={{ kind: 'data', view }} config={{ preset: 'public' }} />      // server-built (public, print)
<OrderFinancialView source={{ kind: 'draft', draft }} config={{ preset: 'detailed' }} />   // unsaved order (payment modal)
<OrderFinancialView source={{ kind: 'edit', orderId, quote }} config={{ preset: 'detailed' }} /> // Order Edit quote
```

| Preset | Use |
|---|---|
| `badge` | one pill (till, modal headers) |
| `totals` | header + section totals (handovers, workspace) |
| `summary` / `detailed` | order detail |
| `full` / `audit` | full page, finance review (records, timeline, reconciliation, debug) |
| `public` | customer-facing; data must come from the server projection |

Config: `sections` (per-key mode `hidden|total|expandable|expanded|detail`), `header` (metrics ≤ 3 beside the hero, `emphasize`, `layout`), `layout` (`card|plain|sheet|print`), `density`, `columns`, `lineCap`, `presetSwitcher`. Resolution: `resolveOrderFinDisplayConfig(config, sourceKind)`; hidden sections are never fetched.

Other pieces: `OrderEditFinancialCard` + `useOrderEditFinancialQuote` (Edit live card), `OrderDraftFinancialSummaryButton` (payment modal), `OrdersFinancialStatementRprt` (print), `OrderFinBalanceBadge` + `useOrderFinancialHeaders` (lists, one request), `useOrderMoneyRefresh` (after money writes). Shared UI: `CmxMoneyText`, `CmxStatement*`, `CmxCollapsibleSection` (`@ui/data-display`).

## Routes and services

| Need | Use |
|---|---|
| One saved order (staff) | `GET /api/v1/orders/[id]/financial-view` · `getOrderFinancialViewAction` · server: `getOrderFinancialView` |
| Many orders' headers | `POST /api/v1/orders/financial-headers` · `getOrderFinancialHeaders` (≤ 100) |
| Edit live quote | `POST /api/v1/orders/[id]/changes/quote` · `getOrderEditQuoteView` |
| Customer tracking / portal | `/api/v1/public/track/[token]/financial-view` · `/api/v1/public/customer/orders/[orderNo]/financial-view` · `getPublicOrderFinancialView` |

Errors: `{ success:false, error:{ code, messageKey: orders.finView.errors.<code>, reason? } }`, `Cache-Control: no-store` (`lib/api/order-fin-view-http.ts`).

## Data flow (server)

`loadOrderCore` → `loadOrderFinSources(requiredSources)` → `normalizeOrderFinSources` (+ `computeOrderFinChecks`: shared aggregation) → builders (`vwbuilders/`) → `assembleOrderFinancialView` → (public) `projectOrderFinancialViewForPublic`.
Draft: `mapDraftToSourceSet`. Edit: `editQuoteFromPreview` → `mapEditQuoteToSourceSet`.

## Checklists

**Add a data source:** loader in `lib/services/order-fin-view/sources/` (tenant filter in every query) → register in `registry.ts` → add to `ORDER_FIN_DATA_SOURCES` → map rows in `normalize.ts` (state from stored status; never compute money) → `section-sources.ts` → DB test (owning tenant only, other tenant empty).
**Add a section:** key in `ORDER_FIN_SECTION_KEYS` + group → preset matrix (`presets.ts`) → builder (`build-sections.ts` / `build-special-sections.ts`) → i18n `orders.finView.sections.<key>` (EN/AR) → classify in the public allowlist test → statement-identity test if it is a value section.
**Add a header metric:** `ORDER_FIN_HEADER_METRICS` → `buildHeader` (from the snapshot, no math) → `orders.finView.metrics.<key>` → classify public/private.

## Pitfalls (lessons)

- A balance computed in the browser (total − paid) ignored credits: always show the server's balance.
- `||` on money turned a real 0 into a fallback: use `??`.
- The tenant's currency was shown for a foreign-currency order: use the order's currency and minor unit.
- The public view leaked fields when a new one was added: the projection is an allowlist; the classification test must be updated.
- Quoting through the Review controller cleared the issued proof: the Edit card uses its own controller.
- A component calling `useAuth` for every source crashed public pages: only the `order` source fetches.
- `derive:ui-access-contract --apply` rewrote existing requirement permissions and misread template-string paths: always review its diff (permission diff against HEAD) before keeping it.
