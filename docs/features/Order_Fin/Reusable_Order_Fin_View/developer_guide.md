# Reusable Order Financial View — developer guide

Rules first: [`docs/dev/rules/order-fin-rules.md`](../../../dev/rules/order-fin-rules.md). Quick reference: skill `/order-fin`.

## 1. Architecture

```
saved order ─ loadOrderCore → loadOrderFinSources(requiredSources) → normalizeOrderFinSources ─┐
unsaved     ─ mapDraftToSourceSet(OrderFinDraftInput) ────────────────────────────────────────┤→ OrderFinSourceSet
Order Edit  ─ editQuoteFromPreview(preview) → mapEditQuoteToSourceSet(saved, quote) ──────────┘
                     ↓ builders (vwbuilders/: build-sections, build-special-sections, build-warnings)
                     ↓ assembleOrderFinancialView(set, resolved, generatedAt)  → OrderFinancialView
public ── projectOrderFinancialViewForPublic(view)  (server only, allowlist)
```

- **Server** (`lib/services/order-fin-view/`): `order-fin-view.service.ts` (`getOrderFinancialView`, `loadSavedOrderFinSourceSet`), `order-fin-headers.service.ts` (batch ≤ 100, snapshot only), `edit-quote.ts` + `edit-view.service.ts` (Edit quote), `public-view.service.ts` (public, ownership), `projections/public.projection.ts`, `sources/*` (one loader per table group, `tenant_org_id` in every query), `normalize.ts` (rows → facts; statuses → line states; `computeOrderFinChecks` runs the shared aggregation).
- **Pure / isomorphic** (`src/features/orders/order-fin-view/`): `config/` (presets, `resolveOrderFinDisplayConfig`, section sources), `vwbuilders/`, `draft/`, `edit/`.
- **Client:** `api/order-fin-view-api.ts`, `hooks/` (`useOrderFinancialView`, `useOrderFinancialHeaders`, `useOrderEditFinancialQuote`, `useOrderMoneyRefresh`, `order-fin-view-cache.ts`), `ui/` (`OrderFinancialView`, header, statement, labels, money, edit card, draft button, balance badge, print report).

## 2. Using the component

```tsx
<OrderFinancialView source={{ kind: 'order', orderId }} config={{ preset: 'detailed', presetSwitcher: ['detailed', 'full'] }} />
```

| Source | Fetch | Notes |
|---|---|---|
| `order` | `GET …/financial-view` (TanStack, `staleTime: 0`) | needs the staff session |
| `data` | none | a view built on the server (public, print) — no session needed |
| `draft` | none | payment modal figures; "Preview — not yet saved" |
| `edit` | none (the quote hook fetched it) | Order Edit; falls back to the saved order before the first quote |

Header-only: hide every section (`sections` all `hidden`) — only the snapshot row is read. Lists: `useOrderFinancialHeaders(ids)` + `OrderFinBalanceBadge` (one request).

After any money write: `const refresh = useOrderMoneyRefresh(); refresh(orderId);`.

## 3. Extending

**New data source:** loader in `sources/` (tenant filter) → `registry.ts` → `ORDER_FIN_DATA_SOURCES` → rows in `normalize.ts` → `section-sources.ts` → DB test (owning tenant, other tenant empty).
**New section:** `ORDER_FIN_SECTION_KEYS` + group → preset matrix → builder → `orders.finView.sections.<key>` EN/AR → classify in `public-projection.test.ts` → statement-identity test if it is a value section.
**New header metric:** `ORDER_FIN_HEADER_METRICS` → `buildHeader` (snapshot value, no math) → `orders.finView.metrics.<key>` → classify public/private.
**New public field:** add it to the allowlist and the strict public schema explicitly; the classification test fails until you do.

## 4. API contract

Success `{ success: true, data }`; error `{ success: false, error: { code, messageKey: 'orders.finView.errors.<code>', reason? } }`; always `Cache-Control: no-store`. Codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `CSRF_REJECTED`, `ORDER_NOT_FOUND`, `ORDER_CHANGED`, `EDIT_SESSION_INVALID`, `QUOTE_REJECTED` (+ `reason`), `RATE_LIMITED` (+ `Retry-After`), `INTERNAL_ERROR`. Query: `preset=<preset>&sections=items:detail,taxes:total` (known keys/modes only).

## 5. Tests

| Test | Proves |
|---|---|
| `__tests__/features/orders/order-fin-view/*` | config, builders, draft and edit mappers, statement identity, UI (real EN catalog), quote hook |
| `__tests__/services/order-fin-view/*` | normalizer, public projection allowlist |
| `__tests__/api/v1/orders/order-fin-view.routes.test.ts` | routes and action: guards, envelope, no-store, CSRF, rate limits, uniform public 404, ownership |
| `__tests__/db-integration/order-fin-view-sources.db.test.ts` | sources per tenant, golden fixture (writer = view = reconciliation), timing (audit p95 < 300 ms), public view and ownership |
| `__tests__/db-integration/order-change-edit-parity.db.test.ts` | Edit card = Review = saved order after Apply, on every edit |
| `e2e/order-financial-view.spec.ts` | live app (needs `E2E_FIN_ORDER_ID`) |

## 6. Observability

`Order fin view sources loaded` (debug: per-source ms), `Order edit quote served` (info: latency, status, outcome), `Order fin view figures differ` (warn: warning codes). Ids only, no customer data.
