# Line-Level Money Snapshot — developer guide

## The rule

Order money is calculated in one place: `web-admin/lib/commercial/` (ADR-060). Services load facts,
call the calculator, and write its result. Nothing else computes a line price, a discount share,
tax or a total. The UI shows what the server returns (`/order-fin`, `order-fin-rules.md`).

## Boundary

| Layer | Path | May do |
|---|---|---|
| Calculator (pure) | `lib/commercial/` | Decimal math only. No I/O, Prisma, Supabase or i18n (ESLint enforces it). |
| Loaders | `lib/services/commercial/commercial-context.loader.ts`, `commercial-edit.loader.ts` | Read catalog, speed rules, tax profiles, the stored order. Every `org_*` query filters `tenant_org_id`. |
| Quote | `commercial-quote.service.ts` (`quoteCommercialOrder`), `commercial-cart-quote.ts`, `commercial-checkout.service.ts` | Build the input, call the calculator, return a quote. No writes. |
| Writers | `commercial-create.session.ts` → `commercial-line.writer.ts` (Create, booking); `commercial-edit.writer.ts` (Edit Apply) | Write the calculator's rows in the caller's transaction. |
| Header | `order-financial-write.service.ts` (`recalculateOrderFinancialSnapshotTx`) | Sums the stored rows into the header and settlement figures. Locks the order row first. |

## Calculator contract

```ts
import { calculateCommercialOrder } from '@/lib/commercial';
const result = calculateCommercialOrder(input); // CommercialOrderInput → CommercialOrderResult
```

- **Input:** level (`ITEM` / `PIECE`), tax pricing mode, discount allocation mode and basis, rounding
  (currency decimals, tax rounding level and mode), lines (standard price, speed and speed rule,
  modifiers, override, line discounts, tax category / profiles / exemption), document adjustments,
  charges, received time.
- **Steps:** standard price → speed premium → modifiers → override → line discounts → minimum price →
  order discounts (allocated by largest remainder) → tax per row (inclusive extraction or exclusive add,
  `LINE` or `DOCUMENT` rounding) → levels (`PRICED` / `ALLOCATED` / `ROLLUP`) → ready-by.
- **Result:** per line and piece the §6.1 columns (`list_unit_price`, `speed_premium_amount`,
  `line_disc_amount`, `order_disc_alloc_amount`, `net_amount`, `tax_*`, `line_total_amount`), document
  totals, applied adjustments, `calcVersion`. `checkMoneyInvariants` (I1–I6) runs on every result.
- **Errors:** `CommercialRuleError` codes (e.g. a discount larger than what is left is refused, never clamped).

The database enforces the same shape (migration 0699): line money NOT NULL, `net = total − line disc − order alloc`,
`line_total = net + tax` when exclusive, a speed premium names its rule, a list price source names its list.

## Create, booking, Edit

- **Create / booking:** checkout quote → `openCommercialCreateSession` → one writer. The cart total and
  ready-by come from the quote; a price that moved since the cart answers `PRICE_CHANGED` per line.
- **Edit:** `readEditOrderRecord` → `buildEditIntent(record, projection)` → `quoteOrderEdit`. Unchanged
  lines keep their stored prices; a changed speed uses the rule in force on the edit date; recorded tax
  context is reused (never guessed). Orders without `commercial_calc_version` answer `ORDER_NEEDS_RECOMPUTE`.
  Apply writes exactly what Preview reviewed; `assertCommercialSnapshot` checks the rolled-up total.

## Extending

- **New modifier or adjustment:** add it to `lib/commercial/` (`adjustments.ts` / `line-pricing.ts`) with
  unit tests and an invariant check; feed it from the loader; add its row mapping in the writers.
- **New tax rule:** `lib/commercial/tax.ts`; tax categories mirror `sys_tax_category_cd`
  (`TAX_CATEGORIES`); a new category needs a code change before orders use it.
- **New service speed:** add the row in HQ (`sys_service_speed_cd`) **and** `SERVICE_SPEEDS`; prices come
  from Speed Pricing rules (`org_speed_price_rules_cf`).
- Keep constants equal to DB values; never add a second calculator or browser-side money math.

## Tests

- Calculator: `__tests__/commercial/**` (`commercial-order.test.ts`, `commercial-order-piece.test.ts`, `invariants.test.ts`).
- Services: `__tests__/services/commercial/**`.
- Real PostgreSQL: `__tests__/db-integration/order-change-edit-parity.db.test.ts` (Preview = Apply = rollup
  for every Edit operation, PIECE orders), `order-fin-view-sources.db.test.ts`, `order-change-settlement-race.db.test.ts`.
- Run: `npx jest __tests__/commercial __tests__/services/commercial` and `npm run test:db-integration`.
