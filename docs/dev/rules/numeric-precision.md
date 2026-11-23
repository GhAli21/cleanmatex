# Numeric precision by value class

Applies to both repos (cleanmatex owns the migrations; cleanmatexsaas reads the same schema).
Replaces the old single rule "money = `DECIMAL(19,4)`". Adopted 2026-11-23 (owner decision D6,
[Measured Pricing PLAN](../../features/Measured_Pricing/PLAN.md) §3.1).

## The classes

| Class | Type | Use it for | Examples |
|---|---|---|---|
| `AMOUNT` | `DECIMAL(19,4)` | Totals and anything posted or paid | line/order totals, payments, balances, tax amounts, GL, `total_cost` |
| `UNIT_PRICE` | `DECIMAL(21,6)` | A price for one unit | `default_sell_price`, `min_sell_price`, price-list `price`, line `price_per_unit` / `list_unit_price` / `price_override`, speed `default_speed_sell_price` |
| `UNIT_COST` | `DECIMAL(23,8)` | A cost for one base unit | `product_cost`, `last_purchase_cost`, stock `unit_cost` |
| `QUANTITY` | `DECIMAL(21,6)` | A measured or stocked quantity | `measured_qty`, `billed_qty`, stock quantities, price-list tiers, `min_billable_qty`, `billing_increment` |
| `RATE` | `DECIMAL(28,12)` | A conversion factor | UoM `multiply_rate` / `divide_rate` |
| `PERCENT` | unchanged (`DECIMAL(5,2)` etc.) | Percentages | tax %, discount % |
| FX rate | `DECIMAL(22,10)` | Exchange rates (see the multi-currency standard) | `fx_rate`, `rate_value` |

Piece counts stay `INTEGER` (order line `quantity`, piece `quantity`). Whether a quantity may have
decimals at all is decided by its unit (`qty_decimals`; COUNT units are always whole), not by the column type.

## Why

A price or cost per small base unit (per gram, per mL, per cm) needs more than 4 decimals:
45.000 for 20,000 mL is 0.00225 per mL, which `DECIMAL(19,4)` stores as 0.0023 (+2.2 %). Totals are
rounded to the currency once, at line level, so they keep 4 decimals.

## Rules

1. Pick the class from what the value **is**, not from the table it lives in.
2. A column computed from others is stored at its own class (a line total is `AMOUNT` even though it
   is `UNIT_PRICE × QUANTITY`). Round once, at the documented point (line level), never in between.
3. Never `FLOAT` / `REAL` / `DOUBLE PRECISION` for any of these.
4. TypeScript reads them as `Prisma.Decimal` / `decimal.js`, never `number` arithmetic for money.
5. New columns use this rule. Existing columns move to it when a feature touches them, in a reviewed
   migration (the Measured Pricing program moved the product, price-list, order-line, stock and tax-document columns).
6. Comment the class on the column (`COMMENT ON COLUMN … 'UNIT_PRICE precision (21,6).'`).

## Related

- Multi-currency standard: `.claude/skills/database/SKILL.md` → "Multi-Currency Transaction Standard".
- Money behaviour in the UI: [no-silent-money-mutation.md](no-silent-money-mutation.md).
