# Developer guide: units of measure and measured pricing

## 1. Layers

| Layer | Table | Owner | Notes |
|---|---|---|---|
| System units | `sys_uom_cd` | HQ (`uom-config`) | One base unit per dimension: `PC KG M SQM L HR` |
| System conversions | `sys_uom_conv_cd` | HQ | Same dimension only, never packaging |
| Organization units | `org_uom_cf` | Organization | Seeded copy of a system unit (`sys_uom_code`) or a custom unit |
| Organization conversions | `org_uom_conv_cf` | Organization | `product_id` NULL = whole organization; set = that product only |

Dimensions: `COUNT MASS LENGTH AREA VOLUME TIME`. Every product, order line and conversion references
`org_uom_cf (tenant_org_id, uom_code)`. Units are switched off, not deleted.

## 2. Seeding and sync

`fn_uom_seed_tenant(tenant, codes)` is idempotent. It adds missing seeded units (`is_to_seed`, or the given
codes) and conversions, refreshes the HQ-owned fields (dimension, base and packaging flags, UN/ECE code), and
refreshes names, symbols, decimals and rates only where the organization has not customized them. It never
deletes and never touches custom rows.

It runs: when an organization is created, from both catalog seeders, from "Add from system catalog", from HQ
maintenance "Sync units", and by trigger whenever HQ changes a system unit or conversion.

## 3. Rules the database enforces

- COUNT units have 0 decimals; quantities must fit the unit's `qty_decimals` (`fn_uom_assert_qty_scale`).
- A tenant cannot change the locked fields of a system unit.
- A custom unit cannot reuse a system code.
- A **custom measured unit needs an active conversion to its base unit**. The check is deferred to commit, so
  the unit and its conversion are written in one transaction (`createCustomUnit` in `uom.service.ts`).
- A unit used by a product cannot be switched off; a product cannot take a switched-off unit.
- A FIXED price needs a COUNT unit. Minimum and billing step apply to measured units only.
- An active HQ template cannot use a switched-off unit (0850).

Errors are raised as `UOM_<CODE>: message`; `parseUomErrorCode` / `UomRuleError` map them, and
`uom.errors.<CODE>` is the screen text. A unique violation loses the message through Prisma, so check first.

## 4. Conversion resolver

`fn_uom_convert` and its TypeScript mirror `lib/uom/convert.ts` (`createUomResolver`):

1. Same unit: unchanged.
2. Direct pair, product first, then organization-wide; either direction (reverse uses `divide_rate`).
3. Two legs through a base unit.
4. Otherwise `UOM_CONVERSION_MISSING`.

`loadUomResolver(tenant, productId)` loads the organization-wide pairs and that product's only. The conversion
service reads and writes rates as text, so no digit of `numeric(28,12)` is lost. An organization's own pair can be
deleted (`deleteConversion`); a system pair is only switched off, or the next sync would add it again.

A COUNT target must come out whole at 6 decimals (`UOM_QTY_NOT_WHOLE`). `qty_to = qty_from × multiply_rate`;
`multiply_rate × divide_rate` is 1 within 0.000001.

## 5. Precision

Classes are defined in [numeric-precision.md](../../dev/rules/numeric-precision.md): amounts 19,4; unit prices
21,6; unit costs 23,8; quantities 21,6; conversion rates 28,12. Use decimal strings and `lib/commercial/money`,
never floating-point arithmetic.

## 6. Pricing a measured line

A product is measured when its `base_uom_code` dimension is not COUNT.

| Column on the order line | Meaning |
|---|---|
| `quantity` | Piece count (integer); unchanged by measuring |
| `measured_qty` (+ `measure_length`, `measure_width`) | What was measured for the whole line |
| `billed_qty` | What is charged |
| `uom_*` | Unit snapshot for prints |

`resolveBilledMeasure` (`lib/commercial/measure.ts`): measured (an area line too: its area in the line's unit;
length and width are an optional pair in metres that record the size and are not multiplied there. The measure
window works the area out with `sizeMeasure` and `squareMetreRate` in `features/orders/model/measure-entry.ts`:
sides in metres to 6 decimals, area = L × W × (one m² in the unit), rounded half-up to the unit's decimals; 0860), raised to `min_billable_qty`, then rounded **up** to `billing_increment`. Money = unit price ×
`billed_qty`; price-list tiers, speed prices and tax use the billed quantity. The client previews with the same
function; the server computes the stored value. Refusals: `MEASURE_REQUIRED`, `MEASURE_NOT_ALLOWED`,
`UOM_QTY_SCALE`.

Changing the piece count on a measured line asks staff to confirm the measure again; the measure is never changed
automatically.

## 7. Order Edit

`ADD_ITEM` carries `measure`; `CHANGE_ITEM_MEASURE` re-measures a saved line (one per line, ITEM level). A saved
line keeps its agreed unit price and stored minimum and step; a new line uses today's product. The review digest
signs the measure. HQ must publish an Edit policy rule for `CHANGE_ITEM_MEASURE` / ITEM.

## 8. Showing the line

`lib/orders/line-qualifier.ts` returns, per stored line, the measure, the speed when it differs from the order's,
and an ordinal only when a product has 2+ identical lines. The measure carries the billed quantity, the line's
minimum and step, and the unit price. Used by the money view, tracking, receipts, prints, order detail and (as
structured data) the customer app. It never affects money.

`formatLineQualifier(qualifier, { t, locale, formatUnitPrice })` words it: "1.8 kg · billed 3 kg (minimum) × 1.200
OMR". `t` (the `uom` namespace) is required, so no renderer can drop the billed quantity; pass `formatUnitPrice`
only where the page has no unit-price column, and use `formatUnitPriceWithCode` (up to 6 decimals). A server
renderer builds `t` with `createTranslator` and `loadLocaleMessages` for the document's language (receipts).
Format quantities with `formatQty` (`lib/uom/format.ts`).

## 9. UI building blocks

- `CmxCombobox` (`src/ui/forms`): searchable, grouped single choice; use it where people type to find an option.
- `CmxUomSelect`: the unit picker on it (grouped by dimension, custom units tagged).
- `CmxQuantityMeasureInput`: measure or length × width, with the shared keypad popover.
- Measure dialog: `useMeasureEntryUnits` lists every unit that converts to the product's unit (lengths for area);
  `model/measure-entry.ts` converts what was typed (lengths keep 4 decimals) and shows it before saving. No unit
  entered this way is stored.
- `src/features/uom`: Units and Conversions screen; `UomConversionsPanel` also serves the product page
  (`ProductUnitsSection`).
- Product form: `billingExamples` (`lib/commercial/measure.ts`) shows what the minimum and step will charge.

## 10. Tests

`__tests__/uom`, `__tests__/commercial` and, on a local database, `__tests__/db-integration/uom-rules.db.test.ts`
(rules, seeding, custom unit) and `order-change-edit-parity.db.test.ts` (Edit measure, and a measured order from
creation through payment, re-measure, settlement and tax document). Two cases in `uom-rules` call the API client and
print `SKIPPED` when the local API does not accept its key. Browser smoke: `e2e/measured-pricing.spec.ts` (writes
data; needs `E2E_ALLOW_WRITES=1`).

`lib/uom/legacy.ts` reads the free-text `unit` column of the product CSV import; it has no database counterpart.
