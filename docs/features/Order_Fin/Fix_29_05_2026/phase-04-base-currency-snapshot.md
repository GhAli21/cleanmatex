# Phase 4 — Base-Currency Snapshot

**Status:** Done
**Date:** 2026-06-05
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md) §Phase 4
**Status tracker:** [order-fin-v1_1-implementation-status.md](order-fin-v1_1-implementation-status.md)

---

## Problem

Phase 4 closes the v1.1 multi-currency reporting gap. Orders already store transaction-currency amounts and the historical `currency_ex_rate`, but the financial snapshot did not persist base-currency projections for reporting, reconciliation, and downstream finance views.

The implementation deliberately uses the clearer `base_cur_*` prefix so these fields are understood as **base currency** reporting projections, not a generic base table or baseline value.

---

## Schema state after 0338

[`supabase/migrations/0338_order_fin_base_currency_snapshot.sql`](../../../supabase/migrations/0338_order_fin_base_currency_snapshot.sql) **was applied on 2026-06-05**.

Effective runtime/schema outcome on `org_orders_mst`:

| Column | Meaning |
|---|---|
| `base_cur_currency_code` | Nullable tenant base-currency code resolved from HQ-managed tenant config. |
| `base_cur_total_amount` | Base-currency projection of `total_amount`. |
| `base_cur_tax_amount` | Base-currency projection of `tax_amount`. |
| `base_cur_paid_amount` | Base-currency projection of `paid_amount`. |
| `base_cur_credit_applied_amount` | Base-currency projection of `total_credit_applied_amount`. |
| `base_cur_outstanding_amount` | Base-currency projection of `outstanding_amount`. |
| `base_cur_ar_receivable_amount` | Base-currency projection of `ar_receivable_amount`. |

The numeric columns are `DECIMAL(19,4) NOT NULL DEFAULT 0`. The migration backfills them from stored historical exchange rates:

```text
base_cur_amount = transaction_amount * currency_ex_rate
```

`base_cur_currency_code` is intentionally nullable. Its source of truth is HQ-managed `TENANT_CURRENCY` consumed via HQ API, and this tenant app must not invent a SQL default or directly query `sys_stng_*`.

---

## Runtime behavior

The write path now projects transaction-currency snapshot amounts into base currency whenever the canonical order financial snapshot is recalculated. The calculation uses the order's stored historical `currency_ex_rate`; it does not fetch or overwrite historical rates.

Base-currency code resolution happens through the HQ API in the non-transactional wrapper. Transaction-safe recalculation callers preserve any existing `base_cur_currency_code` value and keep it nullable if no resolved value is available.

Read-time summaries and view models expose a dedicated base-currency block so UI/reporting layers can show the transaction-currency and base-currency snapshots without recomputing finance math.

---

## Files modified

### Schema, constants, and types
- [`web-admin/prisma/schema.prisma`](../../../web-admin/prisma/schema.prisma) — added the seven `base_cur_*` order snapshot columns.
- [`web-admin/lib/types/order-financial.ts`](../../../web-admin/lib/types/order-financial.ts) — added `OrderFinancialBaseCurrencySnapshot` and extended `CanonicalOrderFinancialSnapshot`.
- [`web-admin/lib/constants/order-financial.ts`](../../../web-admin/lib/constants/order-financial.ts) — reserved the base-currency reconciliation check names.

### Write and read paths
- [`web-admin/lib/services/order-financial-write.service.ts`](../../../web-admin/lib/services/order-financial-write.service.ts) — projects base-currency amounts from transaction amounts and stored exchange rate, resolves `TENANT_CURRENCY` via HQ API, and persists the `base_cur_*` snapshot.
- [`web-admin/lib/services/order-financial-summary.service.ts`](../../../web-admin/lib/services/order-financial-summary.service.ts) — selects and returns the base-currency snapshot fields.
- [`web-admin/lib/utils/order-financial-effective-snapshot.ts`](../../../web-admin/lib/utils/order-financial-effective-snapshot.ts) — derives read-time fallback values when stored base-currency amounts are absent.

### View model and mapper
- [`web-admin/src/features/orders/model/order-financial-summary-view.ts`](../../../web-admin/src/features/orders/model/order-financial-summary-view.ts) — added the `baseCurrency` view-model block.
- [`web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`](../../../web-admin/src/features/orders/lib/map-order-financial-summary-view.ts) — maps base-currency snapshot values into the order financial summary view.

### Reconciliation
- [`web-admin/lib/services/reconciliation/order-checks.ts`](../../../web-admin/lib/services/reconciliation/order-checks.ts) — added exchange-rate presence and base-vs-order amount consistency checks.
- [`web-admin/lib/services/reconciliation.service.ts`](../../../web-admin/lib/services/reconciliation.service.ts) — executes the new checks in the reconciliation run.

### i18n
- [`web-admin/messages/en.json`](../../../web-admin/messages/en.json) — added `OrderFinancial.baseCurrency.*`.
- [`web-admin/messages/ar.json`](../../../web-admin/messages/ar.json) — matching Arabic keys.

### Tests and docs
- [`web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts`](../../../web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts) — base-currency fallback coverage.
- [`web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts`](../../../web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts) — view-model mapping coverage.
- [`web-admin/__tests__/services/reconciliation/check-modules.test.ts`](../../../web-admin/__tests__/services/reconciliation/check-modules.test.ts) — new reconciliation coverage.
- Phase plan/status/ADR/comparison docs were updated to use the final `base_cur_*` naming.

---

## Reconciliation behavior

Phase 4 adds two checks:

- `BASE_CURRENCY_RATE_PRESENT` — flags orders in the reconciliation window with missing or non-positive `currency_ex_rate`.
- `BASE_VS_ORDER_AMOUNT_CONSISTENCY` — verifies each stored `base_cur_*` amount equals its transaction-currency source amount multiplied by `currency_ex_rate`, rounded to 4 decimals.

These checks make the base-currency snapshot auditable without changing the canonical transaction-currency math.

---

## Verification gates

| Gate | Status |
|---|---|
| `npm run prisma:generate` | ✓ clean |
| `npm run typecheck` | ✓ clean |
| `npm run check:i18n` | ✓ EN/AR parity OK |
| Targeted Jest (4 suites / 54 tests) | ✓ green |
| `npm run build` | ✓ green |

---

## Phase 5 handoff

Phase 5 is next: tax-inclusive pricing build (ADR-017).

Next migration to draft:

- `supabase/migrations/0339_tax_pricing_mode_config.sql`

Per repo rule, create the Phase 5 migration file and then **stop for user review/apply before writing any Phase 5 code**.
