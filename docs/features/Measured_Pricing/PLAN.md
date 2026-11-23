# Measured Pricing on a UoM foundation — price by kg, m, m² (and any unit)

Status: **PLAN v2 — awaiting owner approval** (2026-11-23). Progress lives in [STATUS.md](STATUS.md).
v1 of this plan used hard-coded price types (`PER_KG`, `PER_M`, `PER_SQM`). v2 replaces that with a real
Unit of Measure (UoM) catalog, because the platform already has three conflicting unit vocabularies (§2).

## 1. Goal

1. One **UoM system** for the whole platform (sales, inventory, later purchasing), ERP-style: units grouped by
   dimension, exact conversion inside a dimension, one base unit per product, UN/ECE codes for e-invoicing.
2. On top of it, **measured pricing**: a product priced per kg / m / m² (or any non-count unit) bills
   `unit price × billed measure`, with a per-product minimum.

### Owner decisions (2026-11-23)

| # | Decision |
|---|---|
| D1 | Both meter kinds: linear meter (curtains, fabric) and square meter (carpets, rugs). m² is entered as length × width; the area is computed and shown. |
| D2 | Measure is captured at intake. A later re-weigh/re-measure goes through **Order Edit V2** (quote → confirm → audited settlement). No "final weigh" workflow step. |
| D3 | Per-product minimum billable measure. Receipt shows "measured 1.8 kg · billed 3 kg (minimum)". |
| D4 | Build a real UoM system, in layers: Layer 1 now, Layers 2–3 designed now and built with their first consumer (§3.1). |

## 2. What exists today (exploration findings)

| Area | Finding | Consequence |
|---|---|---|
| `org_product_data_mst.product_unit` | Free-text VARCHAR. Sales products hold `PC`, `piece`, `unit`, `UNIT`, `SUIT`, `PAIR`, `SET`. **Inventory** writes into the same column from its own hard-coded list (`piece`, `liter`, `kg`, `gram`, `box`, `bottle`, `pack`, `roll`; i18n `inventory.units.*`). | Three vocabularies, one column, no validation. Replace with an FK to a UoM catalog. |
| `price_type` | CHECK allows only `FIXED`, `PER_PC` (mig 0642 removed `per_kg`). | Becomes `FIXED` / `PER_UNIT`; *which* unit comes from the UoM, not from the price type. |
| `org_order_items_dtl.quantity` | INTEGER = piece count; drives pieces, tags, `quantity_ready`, workflow, Order Edit (`int 1..999`). | **Keep it as the piece/bag count.** Add measure columns beside it. |
| Item snapshot | No `price_type` / unit snapshot on the item. | Snapshot both, so Edit re-prices by what was sold. |
| Calculator `lib/commercial/` | `priceLine` and `speed.ts` already take Decimal quantity. | No new pricing formula; feed it the billed measure. |
| `levels.ts` | PIECE level falls back to item pricing for `FIXED` and piece-count mismatch. | Add fallback `MEASURED_UOM`. |
| Price-list tiers | `min_quantity/max_quantity` INTEGER; `get_product_price(p_quantity integer)` mirrored in `standard-price.ts`. | Widen to `DECIMAL(19,4)`, expressed in the product's base UoM. |
| Inventory | `qty_on_hand DECIMAL(19,4)`, `org_inv_stock_tr.unit_cost`; no unit on stock moves. | Layer 1 gives stock a real unit; per-product packaging conversions are Layer 2. |
| ERP Lite | V2 plans PO → AP (ADR-007). No UoM design yet. | PO needs purchase-unit conversions → Layer 2's first consumer. |
| HQ templates | `sys_service_prod_templates_cd.product_unit` (free text), unused `requires_weight`. HQ has a registry-driven code-table engine (Products & Items Config). | HQ manages the UoM catalog through that engine; templates move to the FK. |

## 3. Design

### 3.1 UoM system — layers

| Layer | What | When |
|---|---|---|
| **L1 Catalog + base unit** | Global `sys_uom_cd`; every product has one `base_uom_code`; exact conversions inside a dimension (g↔kg, cm↔m). Sales, pricing, stock and e-invoice all speak it. | **Now** (this plan) |
| **L2 Product alternate units** | `org_product_uom_cf`: per-product packaging conversions (1 BOX = 12 BOTTLE, 1 DRUM = 200 L), `purchase_uom_code`, stock moves store `entered_uom + entered_qty` and the base qty. Conversion function `fn_uom_to_base()`. | With the first consumer: ERP Lite PO or inventory consumption. Designed here so L1 needs no rework. |
| **L3 Tenant custom units** | `org_uom_cf` for tenant-only units. | Only if a tenant asks; the global catalog should cover GCC laundry. |

Why not build L2/L3 now: nothing reads a packaging conversion today; unexercised conversion code is untested
money/stock risk. L1 is the part every later layer stands on, so it is built now and correctly.

### 3.2 `sys_uom_cd` (global catalog, HQ-managed, seeded)

| Column | Notes |
|---|---|
| `uom_code TEXT PK` | `PC`, `PAIR`, `SET`, `SUIT`, `KG`, `G`, `M`, `CM`, `SQM`, `L`, `ML`, `BOX`, `PACK`, `ROLL`, `BTL`, `HR` |
| `name`, `name2`, `symbol`, `symbol2` | bilingual: "Kilogram"/"كيلوغرام", "kg"/"كغ" |
| `uom_dimension TEXT` | CHECK `COUNT`, `MASS`, `LENGTH`, `AREA`, `VOLUME`, `TIME` |
| `is_base_unit BOOLEAN` | one base per dimension (partial UNIQUE): `PC`, `KG`, `M`, `SQM`, `L`, `HR` |
| `to_base_factor DECIMAL(28,12)` | exact: `G = 0.001`, `CM = 0.01`, `ML = 0.001`; base = 1. NULL for packaging units (their factor is per product, L2). |
| `is_packaging BOOLEAN` | `BOX`, `PACK`, `ROLL`, `BTL`, `SET`, `SUIT`: count units whose size is product-specific |
| `qty_decimals INT` | input/display precision: PC 0, KG 3, M 2, SQM 2, L 3 |
| `unece_code TEXT` | UN/ECE Rec 20: `H87`, `PR`, `SET`, `KGM`, `GRM`, `MTR`, `CMT`, `MTK`, `LTR`, `MLT`, `BX`, `PK`, `RO`, `BO`, `HUR` (ZATCA / e-invoice line unit) |
| display order, `is_active`, `rec_status`, full audit columns | per conventions |

Read through `catalogReadClient` (sys_* rule); no `anon`/`authenticated` grants.

### 3.3 Products

`org_product_data_mst`
- `base_uom_code TEXT NOT NULL` FK → `sys_uom_cd` (backfill map: `PC/piece/unit/UNIT → PC`, `SUIT`, `PAIR`, `SET`;
  inventory `liter → L`, `kg → KG`, `gram → G`, `box → BOX`, `bottle → BTL`, `pack → PACK`, `roll → ROLL`; NULL → `PC`).
  Unmapped values stop the migration (raise), never guessed.
- `price_type`: `PER_PC → PER_UNIT` (price per base unit); CHECK `FIXED | PER_UNIT`.
  `FIXED` is only valid on a COUNT unit (CHECK via trigger or app rule — decided in P1).
- `min_billable_qty DECIMAL(19,4) NULL`, in base UoM; only for non-COUNT units, `> 0`.
- **Measured product** ≙ base UoM dimension ≠ `COUNT`. No measure flag column; it is derived.
- `product_unit` is dropped in a **later** migration once no code reads it (P8), so P1 is not destructive.

`sys_service_prod_templates_cd`: same `base_uom_code` + `min_billable_qty`; the 0700 seeding function copies them
(new `CREATE OR REPLACE` migration). `requires_weight` becomes redundant (derived) and is dropped with `product_unit`.

### 3.4 Order lines (all measure columns NULL for COUNT lines)

`org_order_items_dtl`
- `uom_code TEXT` FK → `sys_uom_cd`, `price_type TEXT` — snapshots at sale (backfill from product).
- `measured_qty DECIMAL(19,4)` — scale/tape value in the line UoM (AREA: length × width).
- `measure_length`, `measure_width DECIMAL(19,4)` — AREA only, in metres, kept for print/audit.
- `min_billable_qty DECIMAL(19,4)` — snapshot.
- `billed_qty DECIMAL(19,4)` — `GREATEST(measured_qty, min_billable_qty)`; money multiplies this.
- CHECKs: measured ⇒ `measured_qty > 0 AND billed_qty >= measured_qty`; AREA ⇒ length/width set and
  `measured_qty = ROUND(length × width, 4)`.
- `quantity` unchanged (pieces/bags). Pieces table unchanged; piece money is allocated from the item.

Shortcut recorded: AREA entry is always length × width in metres (the only area unit seeded is `SQM`).

`org_price_list_items_dtl.min_quantity/max_quantity` → `DECIMAL(19,4)` in base UoM; replace
`get_product_price(... p_quantity integer ...)` with a `NUMERIC` version (P0 lists callers first).

### 3.5 Calculator (`lib/commercial/`)

- Constants `lib/constants/uom.ts`: `UOM_DIMENSIONS`, seeded `UOM_CODES` (DB-mirror), `isMeasuredDimension()`.
- New pure `measure.ts`: `resolveBilledMeasure({ dimension, measuredQty?, length?, width?, minBillableQty, qtyDecimals })`
  → `{ measuredQty, billedQty, minimumApplied }`; `CommercialRuleError` on missing/invalid measure.
- `uom.ts`: `convertWithinDimension(qty, fromUom, toUom)` using `to_base_factor` (exact Decimal) — used by display and inventory now, by L2 later.
- `commercial-order.ts`: priced quantity = `billedQty` for measured lines, else `quantity`; speed premium the same.
- `levels.ts`: `PIECE_FALLBACK_REASONS.MEASURED_UOM`. `standard-price.ts`: tiers match the billed measure.
- Tests: 5.35 kg × 1.200, minimum applied, m² L×W rounding, g→kg conversion exactness, PIECE fallback, speed on kg, kg tiers.

### 3.6 Server / API

- UoM catalog read service (cached, `catalogReadClient`) + `GET /api/v1/uom` for the UI.
- `order-schema.ts` item: optional `measuredQty`, `measureLength`, `measureWidth` (positive, bounded, decimals ≤ `qty_decimals`).
  The client never sends `billedQty`, `uom_code` or `price_type`; the server reads the product.
- `commercial-context.loader.ts`: load `base_uom_code` (+ dimension, decimals) and `min_billable_qty`, tenant-filtered;
  errors `MEASURE_REQUIRED` / `MEASURE_NOT_ALLOWED`.
- `commercial-checkout.service.ts` / item writer: persist snapshots.
- Order Edit V2: new op **`CHANGE_ITEM_MEASURE`** (schemas, constants, priced-ops, preview, apply, structural write, audit,
  capability). Re-prices from the item snapshot. `CHANGE_ITEM_QUANTITY` on a measured line changes piece count only.
- Tax lines / e-invoice: line quantity = billed measure, unit = `unece_code`.
- Inventory service + screens: read/write `base_uom_code`; drop the hard-coded 8-unit list and `inventory.units.*` keys
  (names come bilingual from the catalog).

### 3.7 Frontend (Cmx only, EN/AR, RTL, theme tokens)

- Shared `CmxUomSelect` (in `src/ui/`, catalog-backed, grouped by dimension) — used by product form, inventory, HQ.
- Shared formatter `formatQty(qty, uom, locale)` → "5.35 kg", "3.20 m²", "2 pcs".
- **Catalog product form**: Unit select + price type; for measured units "Price per kg/m/m²" and "Minimum billable".
- **New order**: a measured product opens a **Measure dialog** (Cmx dialog + `CmxKeypadPopover`): single value, or
  length × width for AREA with live area; shows billed measure and an inline "minimum 3 kg applies" note.
- **Cart / items list / prints / Order Fin View lines / public tracking**: "5.35 kg × 1.200"; "measured 1.8 kg · billed 3 kg".
- **Order Edit workspace**: "Change weight/size" → `CHANGE_ITEM_MEASURE` quote → confirm.
- **Inventory** add/edit/adjust modals: `CmxUomSelect`, decimals from the unit.

### 3.8 Not needed (checked)

No new permission (catalog manage, inventory, order create/edit cover it), no navigation, no tenant setting, no feature
flag (pre-launch, demo data). HQ edits `sys_uom_cd` through the existing code-table engine (registry entry only).

## 4. Phases

Every phase ends with: STATUS.md + this PLAN's progress, QA_TEST_GUIDE.md, RESUME_CONTINUATION.md.

| Phase | Scope | Gate |
|---|---|---|
| P0 | Re-verify §2 on remote DB: all distinct `product_unit` values (both tables), callers of `get_product_price`, readers of `product_unit` and price-list `min_quantity`. | findings in STATUS |
| P1 | Migration A: `sys_uom_cd` + seed; product `base_uom_code` backfill; `price_type` rename; `min_billable_qty`; item snapshot + measure columns; price-list decimals; template columns + seeding fn. **STOP for owner apply**, then `/pull-prisma`. | owner applied |
| P2 | Constants, `uom.ts`, `measure.ts`, calculator changes + tests (`/order-fin`). | jest commercial green |
| P3 | Server: UoM read service/API, order schema, loader, checkout write, tax/e-invoice unit, inventory service. | jest + DB integration (tenant isolation) |
| P4 | `CmxUomSelect` + formatter (`/storybook`), product form, inventory modals, New-order Measure dialog, cart. | build, eslint, check:i18n, check:ui, `/cmx-ui-design-review` |
| P5 | Order Edit `CHANGE_ITEM_MEASURE` end-to-end. | jest order-change + build |
| P6 | Display: items list, prints, Order Fin View, public tracking (allowlist test). | tests + build |
| P7 | HQ (`cleanmatexsaas`): `sys_uom_cd` code-table registry entry; template editor uses `CmxUomSelect` + minimum. | HQ build |
| P8 | Migration B: drop `product_unit` (both tables) and `requires_weight` after grep shows no readers. STOP for apply. | owner applied |
| P9 | Docs: UoM developer guide (layers + how L2 plugs in), user guide EN/AR, QA guide, CHANGELOG (`/documentation`). | docs complete |

## 5. Risks

- **Backfill mapping**: unknown `product_unit` values raise and stop Migration A; P0 lists every distinct value first.
- **`PER_PC → PER_UNIT` rename** touches every reader of `PRODUCT_PRICE_TYPES` (catalog, inventory, levels). Pre-launch, so done cleanly, no alias.
- **Prisma Int → Decimal** on price-list tiers ripples into TS callers (P0 lists them).
- **Reports** summing `quantity` count bags, not kg; a "billed measure by unit" column in sales-by-product is a follow-up.
- **Scale hardware** integration is out of scope; measures are typed.
- L2 is designed, not built: the first PO/consumption feature must implement `org_product_uom_cf` before using packaging units in stock math.
