# Measured Pricing — price by weight (kg), linear meter (m) and square meter (m²)

Status: **PLAN — awaiting owner approval** (2026-11-23). Progress lives in [STATUS.md](STATUS.md).

## 1. Goal

A product can be priced per kilogram, per linear meter or per square meter, not only per piece / fixed.
Staff weigh or measure at intake; the line bills `unit price × billed measure`. A per-product minimum
(e.g. "minimum 3 kg") applies and is always shown, never silent.

### Owner decisions (2026-11-23)

| # | Decision |
|---|---|
| D1 | Both meter kinds: `PER_M` (curtains, fabric) and `PER_SQM` (carpets, rugs). SQM is entered as length × width; the area is computed and shown. |
| D2 | Measure is captured at intake. A later re-weigh/re-measure goes through **Order Edit V2** (quote → confirm → audited settlement). No separate "final weigh" workflow step. |
| D3 | Per-product minimum billable measure. Receipt shows "measured 1.8 kg · billed 3 kg (minimum)". |

## 2. What exists today (exploration findings)

| Area | Finding | Consequence |
|---|---|---|
| `org_product_data_mst.price_type` | CHECK `chk_org_product_price_type` allows only `FIXED`, `PER_PC` (mig 0642 removed `per_kg` on purpose). Live data: 157 PER_PC/PC, 9 FIXED/SUIT, … | Extend the CHECK. |
| `product_unit` | VARCHAR, drifted values (`PC`, `piece`, `unit`, `SUIT`…). | **Do not** use it for pricing. The unit is derived from `price_type`. No UOM table needed. |
| `org_order_items_dtl.quantity` | INTEGER, = piece count. Drives pieces, tags, `quantity_ready`, workflow, Order Edit (`int 1..999` in `order-schema.ts`, `edit-order-schemas.ts`, `order-change.schemas.ts`). | **Keep `quantity` as the piece/bag count.** Add separate measure columns. Changing `quantity` to decimal would ripple through ~50 workflow/piece files for no gain. |
| Item snapshot | Item has `money_basis` but no `price_type` snapshot. | Add `price_type` snapshot on the item, so Edit re-prices by what was sold, not by today's product. |
| Calculator `lib/commercial/` | `priceLine` and `speed.ts` already take Decimal quantity ("may be fractional, e.g. kilograms"). | Pricing math needs no new formula: feed it the billed measure. |
| `levels.ts` `resolveMoneyBasis` | PIECE level falls back to item pricing for `FIXED` and piece-count mismatch. | Add fallback reason `MEASURED_PRICE_TYPE`: measured lines are item-priced, pieces get allocated shares (largest remainder, already built). |
| Price-list tiers | `org_price_list_items_dtl.min_quantity/max_quantity` INTEGER; TS `standard-price.ts` mirrors `get_product_price(p_quantity integer)`. | Widen to `DECIMAL(19,4)`; for measured lines tier eligibility uses the billed measure. |
| HQ templates | `sys_service_prod_templates_cd.price_type` (no CHECK) + unused `requires_weight`; copied into tenant products by the 0700 seeding function. | HQ template editor + seeding must carry the new types and the minimum. |
| Catalog UI | Product form does not expose `price_type` at all today. | Add the field. |

## 3. Design

### 3.1 Price types (DB-mirror constants)

`PRODUCT_PRICE_TYPES` in `web-admin/lib/constants/commercial.ts`:
`FIXED`, `PER_PC`, **`PER_KG`, `PER_M`, `PER_SQM`** + `MEASURED_PRICE_TYPES` set + unit map
(`PER_KG → kg`, `PER_M → m`, `PER_SQM → m²`) and the UN/ECE Rec 20 code for e-invoicing (`KGM`, `MTR`, `MTK`; pieces `H87`).

### 3.2 Data model (one migration, number = live last+1 at write time)

`org_product_data_mst`
- CHECK → `price_type IN ('FIXED','PER_PC','PER_KG','PER_M','PER_SQM')`.
- `min_billable_qty DECIMAL(19,4) NULL` — CHECK `> 0`, and NULL unless price_type is measured.

`org_order_items_dtl` (all NULL for piece/fixed lines)
- `price_type TEXT NULL` — snapshot at sale (backfill: from product, else `PER_PC`).
- `measured_qty DECIMAL(19,4) NULL` — what the scale/tape showed (SQM: length × width).
- `measure_length DECIMAL(19,4) NULL`, `measure_width DECIMAL(19,4) NULL` — SQM only, kept for print/audit.
- `billed_qty DECIMAL(19,4) NULL` — `GREATEST(measured_qty, min_billable_qty)` snapshot; this is what money multiplies.
- `min_billable_qty DECIMAL(19,4) NULL` — snapshot of the minimum used.
- CHECKs: measured ⇒ `measured_qty > 0 AND billed_qty >= measured_qty`; PER_SQM ⇒ length/width set and
  `measured_qty = ROUND(length × width, 4)`; non-measured ⇒ all measure columns NULL.

`org_price_list_items_dtl`: `min_quantity`, `max_quantity` → `DECIMAL(19,4)` (integers preserved).
`get_product_price(... p_quantity integer ...)` → new overload/replacement with `NUMERIC` (keep old signature only if a caller still uses it — verify first).

`sys_service_prod_templates_cd`: add `min_billable_qty`, CHECK on price_type (normalize drift first), and update the
0700 seeding function (new `CREATE OR REPLACE` migration) to copy both.

Pieces table: unchanged (`quantity` integer; money is allocated from the item).
Comments + `COMMENT ON` for every new column; no defaults on money; full audit columns already exist.

### 3.3 Calculator (`lib/commercial/`)

- New pure `measure.ts`: `resolveBilledMeasure({ priceType, measuredQty?, length?, width?, minBillableQty })`
  → `{ measuredQty, billedQty, minimumApplied }`. Throws `CommercialRuleError` for missing/invalid measure.
- `commercial-order.ts`: priced quantity = `billedQty` for measured lines, else `quantity`. Speed premium uses the same.
- `levels.ts`: `PIECE_FALLBACK_REASONS.MEASURED_PRICE_TYPE`.
- `standard-price.ts`: tier match on the billed measure for measured lines.
- Invariant (`invariants.ts`): measured line `total = round(unit × billedQty)`; pieces sum to item.
- Unit tests: kg fractional (5.35 kg × 1.200), minimum applied, SQM L×W rounding, PIECE fallback, speed premium on kg, tier by kg.

### 3.4 Server / API

- `order-schema.ts` item: optional `measuredQty`, `measureLength`, `measureWidth` (positive, bounded, ≤ 3/2 decimals in UI).
  Client **never** sends `billedQty` or `price_type`; the server reads the product and decides.
- `commercial-context.loader.ts`: load `price_type` + `min_billable_qty` (tenant-filtered); reject a measured product without a measure (`MEASURE_REQUIRED`) and a measure on a non-measured product.
- `commercial-checkout.service.ts` / item writer: persist the snapshot columns.
- Order Edit V2: new op **`CHANGE_ITEM_MEASURE`** (`order-change.schemas.ts`, `lib/constants/order-change.ts`,
  `order-change-priced-ops.ts`, preview, apply, structural write, review audit, capability). Edit re-prices from the item snapshot
  (`price_type`, `min_billable_qty`), not from the current product. `CHANGE_ITEM_QUANTITY` on a measured line changes piece count only (no money).
- Tax lines / e-invoice line: quantity = billed measure, unit code from §3.1 (`tax-lines.writer.ts`, F-05 builder).

### 3.5 Frontend (Cmx only, EN/AR, RTL, theme tokens)

- **Catalog product form**: Price type select; when measured: "Price per kg / m / m²" label and "Minimum billable" field.
- **New order**: tapping a measured product opens a **Measure dialog** (Cmx dialog + existing `CmxKeypadPopover`):
  kg / m single input, or length × width for m² with live area. Shows `billed = max(measured, minimum)` with an inline
  "minimum 3 kg applies" note (no silent money mutation). Piece/bag count stepper stays.
- **Cart / summary / order items list / receipt & invoice prints / Order Fin View line rows / public tracking**:
  one shared formatter `formatLineMeasure()` → "5.35 kg × 1.200" and "measured 1.8 kg · billed 3 kg".
- **Order Edit workspace**: "Change weight/size" action → `CHANGE_ITEM_MEASURE` quote → confirm.
- i18n: `catalog.priceType.*`, `orders.measure.*`, unit labels (kg/كغ, m/م, m²/م²) in `messages/en` and `messages/ar`.

### 3.6 Not needed (checked)

- No new permission (catalog manage, order create, order edit already gate these screens).
- No navigation change, no new setting (D3 is a product column), no feature flag (pre-launch; demo data only).
- No UOM master table, no change to pieces/workflow/tags.

## 4. Phases

Every phase ends with: update STATUS.md + this PLAN's progress, refresh QA_TEST_GUIDE.md, RESUME_CONTINUATION.md.

| Phase | Scope | Gate |
|---|---|---|
| P0 | Re-verify findings §2 on remote DB; grep callers of `get_product_price` and of price-list `min_quantity`. | findings noted in STATUS |
| P1 | Migration (§3.2) — `/database`, `/multitenancy`, `/code-documentation`. **STOP for owner apply.** Then `/pull-prisma`. | owner applied |
| P2 | Constants + calculator (§3.1, §3.3) + unit tests — `/order-fin`. | jest commercial green |
| P3 | Server: schema, loader, checkout write, tax/e-invoice qty+unit (§3.4 minus Edit). | jest + DB integration test (tenant isolation) |
| P4 | Catalog form + New-order Measure dialog + cart display (§3.5) — `/frontend`, `/i18n`. | build, eslint, check:i18n, check:ui, `/cmx-ui-design-review` |
| P5 | Order Edit `CHANGE_ITEM_MEASURE` end-to-end (service + workspace UI). | jest order-change + build |
| P6 | Display everywhere: items list, prints, Order Fin View, public tracking (allowlist test). | public-allowlist test, build |
| P7 | HQ side (`cleanmatexsaas`): template editor price type + minimum; seeding carries them. | HQ build |
| P8 | Docs: developer_guide, user_guide (EN/AR), QA_TEST_GUIDE, CHANGELOG; `/documentation`. | docs complete |

## 5. Risks

- **Prisma type change** on price-list `min_quantity/max_quantity` (Int → Decimal) ripples into TS callers — P0 lists them.
- **Reports** summing `quantity` will count bags, not kg. Sales-by-product report needs a "billed measure" column — follow-up, not in v1.
- Scale integration (USB/Bluetooth scale) is **out of scope**; weight is typed. Keypad input is the v1.
- Rounding: measure stored at 4 dp; UI accepts kg to 3 dp, m/m² to 2 dp; money rounding unchanged (tenant rule).
