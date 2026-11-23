# Measured Pricing on a UoM platform — price by kg, m, m² (and any unit), both repos

Status: **PLAN v5 — awaiting owner approval** (2026-11-23). Progress lives in [STATUS.md](STATUS.md).

History: v1 hard-coded `PER_KG/PER_M/PER_SQM` · v2 unit catalog · v3 open multiply/divide conversions + numeric precision
policy · v4 tenant units (custom + copy-on-write override of system units), full both-repo coverage
(tenant web-admin, HQ platform-api/platform-web, mobile customer app), performance and test strategy · **v5** system units
and conversions are **copied** into each tenant (real FKs, no overlay), COUNT quantities are whole numbers, minimum and
`billing_increment` are optional tenant product fields.

## 1. Goal

1. A **UoM platform** used by sales, inventory and (later) purchasing: system unit catalog (HQ), tenant units (custom and
   seeded system units), open conversions (system / tenant / product), UN/ECE codes for e-invoicing.
2. **Measured pricing**: a product priced per kg / m / m² (any non-count unit) bills `unit price × billed measure`,
   with an optional per-product minimum and billing step, captured at intake and editable through Order Edit.
3. A **numeric precision policy** by value class.

### Owner decisions

| # | Decision (2026-11-23) |
|---|---|
| D1 | Linear meter and square meter both supported; m² entered as length × width. |
| D2 | Measure captured at intake; re-weigh/re-measure via **Order Edit V2**. No "final weigh" workflow step. |
| D3 | Per-product minimum billable measure, always shown when set. **Tenant-only and optional** (D12). |
| D4 | Real UoM system, layered. |
| D5 | House naming, not Gemini's. |
| D6 | Precision per value class instead of one `DECIMAL(19,4)` rule. |
| D7 | Open conversions: *UoM → UoM To* with **Multiply rate** and **Divide rate** (reference: LB → KG, 0.453592909436 / 2.20462). |
| D8 | Tenants add their own units (`org_uom_cf`); system units are copied to org and edited there (D10). |
| D9 | Plan covers everything in both repos. |
| D10 | System units flagged `is_to_seed` (and their system conversions) are **copied into each tenant**, so tenant tables use real composite FKs to `org_uom_cf`. Replaces the v4 overlay. |
| D11 | Quantities in a `COUNT` unit are whole numbers; physical units allow decimals up to the unit's `qty_decimals` (1.5 m, 2.375 kg). |
| D12 | `min_billable_qty` lives on the tenant product only (not HQ templates) and is optional (NULL = no minimum). |
| D13 | `billing_increment` is in v1, optional per tenant product (NULL = bill the exact measure). |
| D14 | Prices are stated per the product's base unit only; "price per another unit" is a follow-up. |

## 2. Findings

### 2.1 Tenant repo (`cleanmatex`)

| Area | Finding | Consequence |
|---|---|---|
| `org_product_data_mst.product_unit` | Free-text; sales values `PC/piece/unit/UNIT/SUIT/PAIR/SET`; **inventory** writes the same column from its own list (`piece/liter/kg/gram/box/bottle/pack/roll`, i18n `inventory.units.*`). | Replace with `base_uom_code` (FK to tenant units). |
| `price_type` | CHECK `FIXED`, `PER_PC` (mig 0642). | `FIXED` / `PER_UNIT`. |
| `org_order_items_dtl.quantity` | INTEGER piece count; pieces, tags, workflow, Order Edit (`int 1..999`). | Unchanged; measure columns beside it. |
| Calculator `lib/commercial/` | Decimal quantity already supported. | Feed billed measure; no new formula. |
| `levels.ts` | PIECE fallbacks for FIXED / mismatch. | Add `MEASURED_UOM`. |
| Price-list tiers | INTEGER; `get_product_price(p_quantity integer)`. | `QUANTITY` class, base UoM. |
| Precision | Amounts 19,4; product prices/cost `10,3` (off-rule); `org_inv_stock_tr.unit_cost 19,4` (+2.2% on 45/20,000 mL); ERP Lite `unit_cost 19,8`; FX rates mixed. | §3.1 policy. |
| FX module | `sys_currency_exchange_rate_mst` + `org_fx_rate_mst`, `rate_value` + `inverse_rate_value`. | Shape for conversions. |
| Tenant-overlay precedent | `org_fin_exp_cat_cf` (`sys_cat_code` + tenant `custom_name*`); `org_customer_category_cf`, `org_service_preference_cf` (seeded copies). | Seeded-copy pattern for units (D10); `sys_service_prod_templates_cd.is_to_seed` is the flag-name precedent. |
| Mobile customer app (`cmx_mobile_apps`) | `order_item_model.dart`, booking items step/card, `customer_order_detail_screen.dart`, booking + tracking services show item quantity. | Show measure + "priced after weighing" in booking. |
| `cmx-api` (NestJS) | Exists; P0 checks whether it serves order lines. | Update DTOs if so. |

### 2.2 HQ repo (`cleanmatexsaas`)

| Area | Finding | Consequence |
|---|---|---|
| Code-table engine | `platform-api/src/common/code-tables/` (registry-driven REST + shared screens, audited); field types incl. `ref`, `select`, `number`. | `sys_uom_cd`, `sys_uom_conv_cd` become registry entries. Needs a `RATE`-precision number field check (12 dp). |
| Products & Items Config | `code-tables.registry.ts`: `price_type` select `['FIXED','PER_PC']`, `product_unit` select `['PC','PAIR','SET','SUIT','UNIT']`, bools `requires_weight`, `requires_dimensions`, `requires_item_count`. | Replace with `base_uom_code` ref (no minimum on templates — D12); derive the `requires_*` flags from the unit dimension, then drop them. |
| Bulk import | `bulk/bulk.columns.ts` carries `price_type`, `product_unit`, `requires_*`. | New columns, validation against units. |
| Tenant products (HQ view of tenant catalog) | `tenant-products.repository.ts` copies `price_type`/`product_unit` from templates; `product-comparison.service.ts` compares `product_unit`. | Copy/compare `base_uom_code`. |
| Setup health | `tenant-setup-health` module (registry of checks). | New checks (§3.10). |
| Docs | `docs/features/Products_Items_Config/`. | HQ doc updates live there + a UoM section. |

## 2a. External review — Gemini (2026-11-23)

Adopted: system + tenant split (as separate `sys_*`/`org_*` tables), unit-cost precision, factor snapshots, catch-weight (L2).
Superseded by D7: star topology / rational factors (bounded two-leg resolver keeps their goals). Rejected: nullable-tenant
single table, per-unit rounding mode (product-level `billing_increment` instead, D13), categories table + UUID ids, its SQL style.
Deferred to L2: pack barcodes, logistics fields, channel flags.

## 3. Design

### 3.1 Numeric precision policy (new rule — replaces "money = DECIMAL(19,4)")

| Class | Type | Use |
|---|---|---|
| `AMOUNT` | `DECIMAL(19,4)` (unchanged) | totals, payments, balances, GL, tax amounts |
| `UNIT_PRICE` | `DECIMAL(21,6)` | sell/list/min price per unit, price-list price, line `price_per_unit`, `list_unit_price`, `price_override` |
| `UNIT_COST` | `DECIMAL(23,8)` | cost per base unit (inventory, costing, purchasing) |
| `QUANTITY` | `DECIMAL(21,6)` | measured, billed, stock, tier quantities (piece counts stay INTEGER) |
| `RATE` | `DECIMAL(28,12)` | UoM conversion rates |
| `PERCENT` | unchanged | tax %, discount % |

Applied to new columns and columns this plan touches. Rule doc `docs/dev/rules/numeric-precision.md`; pointers in
`CLAUDE.md`, `AGENTS.md`, `.claude/skills/database/SKILL.md`, `.claude/skills/code-documentation/sql-migration.md`,
`.cursor/rules/databaseconventions.mdc` **and** the HQ repo's `CLAUDE.md` / `AGENTS.md` / DB rules (same rule both repos).

### 3.2 System units — `sys_uom_cd` (HQ-owned)

| Column | Notes |
|---|---|
| `uom_code TEXT PK` | seeded: `PC PAIR SET SUIT KG G LB OZ M CM MM IN FT YD SQM SQFT L ML GAL BOX PACK ROLL BTL DRUM BAG HR MIN` |
| `name`, `name2`, `symbol`, `symbol2` | EN/AR |
| `uom_dimension TEXT` | CHECK `COUNT MASS LENGTH AREA VOLUME TIME` |
| `is_base_unit BOOLEAN` | one per dimension (partial UNIQUE): `PC KG M SQM L HR` |
| `is_packaging BOOLEAN` | `BOX PACK ROLL BTL DRUM BAG SET SUIT` (size is product-specific) |
| `qty_decimals SMALLINT` | 0–6; CHECK `uom_dimension <> 'COUNT' OR qty_decimals = 0` (D11). Seeds: KG 3, G 0, M 2, SQM 2, L 3, HR 2 |
| `is_to_seed BOOLEAN NOT NULL DEFAULT true` | copied into every tenant (D10); base units forced `true` (CHECK `NOT is_base_unit OR is_to_seed`). Seeded `false` for rarer units (`DRUM GAL YD SQFT OZ`) — tenants add them on demand |
| `unece_code TEXT` | UN/ECE Rec 20 (`H87 PR SET KGM GRM LBR ONZ MTR CMT MMT INH FOT YRD MTK FTK LTR MLT GLL BX PK RO BO DR BG HUR MIN`) |
| `display_order`, `is_active`, `rec_status`, 14 audit columns | conventions |

`BAG` added for laundry-by-bag pricing (count dimension, packaging).

### 3.3 Tenant units — `org_uom_cf` (D8, D10)

Every unit a tenant can use is a row in `org_uom_cf`. Two kinds of row:

| Kind | `sys_uom_code` | Meaning |
|---|---|---|
| **System unit (seeded copy)** | = the system code | Copied from `sys_uom_cd` (all `is_to_seed` units at tenant creation; others on demand via "Add from system catalog"). Tenant may edit presentation fields. |
| **Custom unit** | NULL | A unit only this tenant has (`BASKET`, `HANGER_PACK`, `JUG_5L`). All fields owned by the tenant. |

Columns: `id`, `tenant_org_id`, `uom_code`, `sys_uom_code` (FK `sys_uom_cd`, nullable), `name`, `name2`, `symbol`, `symbol2`,
`uom_dimension`, `is_base_unit`, `is_packaging`, `qty_decimals`, `unece_code` (nullable for custom → e-invoice falls back to
`H87`/`C62` per dimension rule, documented), `is_customized` (tenant changed presentation fields), `display_order`,
`is_active`, `rec_status`, 14 audit columns. UNIQUE `(tenant_org_id, uom_code)` = the FK target for every tenant table.
Same CHECKs as `sys_uom_cd` (COUNT ⇒ `qty_decimals = 0`; one base unit per dimension per tenant, partial UNIQUE).

Field ownership on a system row:

| Editable by tenant | Locked (owned by `sys_uom_cd`, refreshed by sync) |
|---|---|
| names, symbols, `qty_decimals` (physical units only), `display_order`, `is_active` | `uom_code`, `uom_dimension`, `is_base_unit`, `is_packaging`, `unece_code` |

- A BEFORE UPDATE trigger rejects tenant changes to locked fields on system rows (the sync fn bypasses it via a
  transaction-local setting). Editing a presentation field sets `is_customized = true`.
- **Reset to system** (replaces v4 "Revert"): copies the system presentation values back, `is_customized = false`.
- Custom units cannot be base units; custom units in a physical dimension need a conversion to that dimension's base
  (enforced on save). Base units cannot be deactivated.
- Code collisions: a custom code must not equal any system code (tenant save fn). HQ creating a system code that a tenant
  already uses as a custom code is rejected by the HQ save path with the list of tenants. No magic prefixes.

**Seeding and sync** — one idempotent function `fn_uom_seed_tenant(p_tenant_org_id, p_uom_codes TEXT[] DEFAULT NULL)`:
1. Inserts missing system units (`is_to_seed`, or the given codes) and the system conversions whose two units the tenant has.
2. Refreshes locked fields of every system row; refreshes presentation fields only where `is_customized = false`.
3. Never deletes, never touches custom rows or customized names.

Called from: tenant creation (same place as `seed_tenant_customer_categories`, P0 confirms), Migration A backfill for all
existing tenants, "Add from system catalog" (with codes), and an AFTER INSERT/UPDATE trigger on `sys_uom_cd` /
`sys_uom_conv_cd` that runs the sync for every tenant, so an HQ fix reaches tenants with no manual step. HQ cannot change a
system unit's `uom_dimension` or `is_base_unit` once any tenant uses it (HQ save rejects).

Referential integrity: products, conversions, order lines, price lists and stock reference units through composite FKs
`(tenant_org_id, uom_code) → org_uom_cf (tenant_org_id, uom_code)` `ON DELETE RESTRICT` (Prisma-safe column order). Units are
never deleted, only deactivated; deactivating a unit in use is blocked with "used by N products". Order lines still snapshot
symbol/name/UN code (§3.6) so prints reproduce exactly after a rename.

Why copy rather than overlay (v4): real FKs instead of a validation trigger on every table; one table for every read
(no merge function, simpler and faster queries); matches the seeded `org_customer_category_cf` / `org_service_preference_cf`
precedent. Cost: ~30 rows per tenant, and HQ changes travel through the sync — handled by the trigger above.

### 3.4 Open conversions — `sys_uom_conv_cd` + `org_uom_conv_cf` (D7)

| Table | Scope | Editor |
|---|---|---|
| `sys_uom_conv_cd` | global standard, same dimension (G→KG, LB→KG, OZ→KG, CM/MM/IN/FT/YD→M, ML/GAL→L, SQFT→SQM, MIN→HR) | HQ |
| `org_uom_conv_cf` | `product_id NULL` = tenant-wide (seeded copies of system pairs with `sys_conv_from/to` set, plus tenant pairs for custom units); `product_id` set = that product only (BOX→PC 12, DRUM→L 200, ROLL→M 50). Cross-dimension only with `product_id`. Units FK to `org_uom_cf`. | tenant |

Columns: `from_uom_code`, `to_uom_code`, `multiply_rate`, `divide_rate` (`RATE`, `> 0`), `is_active`, `rec_status`,
audit; `org_*` adds `id`, `tenant_org_id`, `product_id` (composite FK `(product_id, tenant_org_id)`, `ON DELETE RESTRICT`).

- `qty_to = qty_from × multiply_rate`; reverse `qty_from = qty_to × divide_rate` (both stored, like FX).
- CHECK `from <> to`; CHECK `ABS(multiply_rate × divide_rate − 1) <= 0.000001`.
- One row per unordered pair per scope: UNIQUE on `(tenant_org_id, LEAST(from,to), GREATEST(from,to))` WHERE `product_id IS NULL`
  and `(tenant_org_id, product_id, LEAST, GREATEST)` WHERE `product_id IS NOT NULL`; system table the same without tenant.
- Same-dimension rule (system + tenant-wide) and packaging-only-per-product rule enforced in save functions.
- Seeded system pairs are copied with `is_customized`; tenant edits the rates (sets `is_customized`), "Reset to system"
  restores them; sync refreshes non-customized pairs (§3.3).

**Resolver** `fn_uom_convert(tenant, product, qty, from, to)` + TS mirror `lib/uom/convert.ts` (Decimal) — reads
`org_uom_conv_cf` only:
1. `from = to` → qty.
2. Direct pair, most specific first: product → tenant-wide; either direction (reverse uses `divide_rate`).
3. Two legs through the dimension's base unit, each leg by step 2.
4. Else `UOM_CONVERSION_MISSING`.
5. Target unit is `COUNT` and the result is not a whole number → `UOM_QTY_NOT_WHOLE` (30 PC → 2.5 BOX is refused in
   transactions; display-only callers may ask for the raw value).

At most two stored rates multiplied; data cycles cannot loop. Converting transactions snapshot the factor used.

**Whole-number rule (D11)** — one rule in one place: a quantity in a unit may have at most that unit's `qty_decimals`
decimals (COUNT units always 0). Enforced by `assertQtyScale()` in `lib/uom/` (Zod refinement + services) and by
`fn_uom_assert_qty_scale(tenant, uom, qty)` in the DB save functions (stock moves, price tiers, product minimum/increment,
order measures). Examples: 1.5 M ✓, 2.375 KG ✓, 2.3755 KG ✗, 1.5 PC ✗. Order `quantity` stays an INTEGER column.

### 3.5 Layers

| Layer | What | When |
|---|---|---|
| **L1** | System units, tenant units (seeded copies + custom), open conversions, resolver, product base unit, measured pricing (minimum + increment), precision policy | **This plan** |
| **L2** | Purchase unit per product; stock moves `entered_uom + entered_qty + factor + base_qty`; catch-weight `tracking_mode` + `secondary_qty`; pack barcodes | With ERP Lite PO / inventory consumption |

### 3.6 Products, templates, order lines, price lists, stock

`org_product_data_mst`
- `base_uom_code TEXT NOT NULL`, composite FK to `org_uom_cf`. Backfill: `PC/piece/unit/UNIT→PC`, `SUIT`, `PAIR`, `SET`,
  `liter→L`, `kg→KG`, `gram→G`, `box→BOX`, `bottle→BTL`, `pack→PACK`, `roll→ROLL`, NULL→`PC`; unknown value raises.
- `price_type` `PER_PC → PER_UNIT`; CHECK `FIXED | PER_UNIT`; `FIXED` only on COUNT units.
- `min_billable_qty` (`QUANTITY`, **nullable** = no minimum; measured only; `> 0`; scale rule) — D12.
- `billing_increment` (`QUANTITY`, **nullable** = exact measure; measured only; `> 0`; scale rule) — D13.
- Prices → `UNIT_PRICE`; `product_cost`, `last_purchase_cost` → `UNIT_COST`; `qty_on_hand` → `QUANTITY`.
- Measured product ≙ unit dimension ≠ `COUNT`.

`sys_service_prod_templates_cd` (HQ templates): `base_uom_code` (FK `sys_uom_cd`; seeding a template also seeds that unit
into the tenant), prices per policy; **no minimum or increment** (tenant-only, D12); `requires_weight` /
`requires_dimensions` derived from dimension (dropped in Migration B; `requires_item_count` stays — different meaning, P0
confirms). Seeding fn (0700 lineage) copies `base_uom_code`.

`org_order_items_dtl` (measure columns NULL for COUNT lines)
- `uom_code` (composite FK) + snapshots `uom_dimension`, `uom_unece_code`, `uom_symbol`, `uom_symbol2`, `price_type`,
  `min_billable_qty`, `billing_increment` (invoices and prints reproduce exactly even if the unit or product changes later).
- `measured_qty`, `measure_length`, `measure_width`, `billed_qty` (`QUANTITY`); billed formula in §3.6a.
- CHECKs: measured ⇒ `measured_qty > 0`, `billed_qty >= measured_qty`, `billed_qty >= COALESCE(min_billable_qty, 0)`;
  AREA ⇒ L/W set, `measured_qty = ROUND(L×W, unit qty_decimals)` (half-up; server computes, client only previews).
- `price_per_unit`, `list_unit_price`, `price_override` → `UNIT_PRICE` (items and pieces). `quantity` unchanged.

`org_price_list_items_dtl`: tiers → `QUANTITY` (base unit), price → `UNIT_PRICE`; `get_product_price` numeric (P0: callers).
`org_inv_stock_tr`: quantities → `QUANTITY`, `unit_cost` → `UNIT_COST`.

Shortcut recorded: in v1 the measure is entered in the product's base unit (m² as L×W in metres). Entering in another unit
(lb, ft) uses the resolver and is a UI follow-up.

**Why `requires_weight` / `requires_dimensions` go.** They are hand-set booleans on HQ templates that duplicate what the unit
already says and can contradict it (unit `KG` with `requires_weight = false`). After this plan:
`requires_weight` ≙ dimension `MASS`, `requires_dimensions` ≙ dimension `AREA` (L×W) — read from the unit, never stored.
`LENGTH` (curtain metres) needs one measure, which neither flag covered. Readers switch to the dimension in P7; columns drop
in Migration B. `requires_item_count` is a different question (count pieces inside a bag) and stays.

### 3.6a Pricing rules (one place)

| Rule | Detail |
|---|---|
| Price is per base unit | `default_sell_price` / price-list `unit_price` on a KG product = price per kg; on SQM = per m²; on M = per metre. No new price columns. |
| `price_type` | `PER_UNIT`: amount = billed measure × unit price (COUNT: × quantity, as today). `FIXED`: one price per line, COUNT units only. |
| Billed measure | `m = GREATEST(measured_qty, COALESCE(min_billable_qty, 0))`; `billed_qty = billing_increment IS NULL ? m : CEIL(m / billing_increment) × billing_increment`. Always rounds **up**; order of minimum vs increment doesn't change the result. Examples (min 3 kg, increment 0.5 kg): 2.4 → 3 · 3.2 → 3.5 · 4.5 → 4.5. Both optional: no minimum and no increment bills the exact measure. Print shows "3.2 kg · billed 3.5 kg (per 0.5 kg)" / "2.4 kg · billed 3 kg (minimum)". |
| Price list resolution | Unchanged order: customer list → standard list → product default (`standard-price.ts`, `get_product_price`). Only the tier quantity changes: measured lines match `min/max_quantity` against **billed_qty** in the base unit (e.g. 0–9.999 kg 0.900/kg, ≥10 kg 0.750/kg). Same tier semantics as today: the whole line gets the deepest qualifying tier's price (not graduated). |
| Line amount | `billed_qty × unit_price`, rounded once at line level to currency decimals (existing `priceLine`). |
| Speed / express | Unchanged — the speed rule applies to the line amount; per-unit speed fees multiply billed_qty (`speed.ts` already takes `Decimal` qty). |
| Discounts, promotions, tax, price-list discount % | Unchanged — they act on the line amount; no measure-specific logic. |
| Piece-level money | A measured line can't split a per-kg price across pieces → money basis falls back to the line (`PIECE_FALLBACK_REASONS.MEASURED_UOM`), like `FIXED` today. |
| Intake / estimate | Staff enter the measure at intake (D2). Customer app booking shows "price per kg — final after weighing" (no charge until measured). |
| Change after intake | Order Edit V2 op `CHANGE_ITEM_MEASURE` re-prices through the same calculator; the money delta is shown and confirmed, never silent (`no-silent-money-mutation.md`). |
| Precision | Unit price `UNIT_PRICE 21,6` (0.045/g possible), measures `QUANTITY 21,6`, line amounts `AMOUNT 19,4` (§3.1). |
| Not in v1 | Price stated per another unit (price per lb on a KG product) — follow-up via resolver (D14). |

### 3.7 Calculator and UoM library (tenant `web-admin`)

- `lib/constants/uom.ts` (DB-mirror codes, dimensions, error codes), `lib/types/uom.ts`, Zod in `lib/validations/uom-schemas.ts`.
- `lib/uom/convert.ts` (resolver), `lib/uom/scale.ts` (`assertQtyScale`, D11), `lib/uom/format.ts` (`formatQty`, locale digits, `qty_decimals`).
- `lib/commercial/measure.ts` → `resolveBilledMeasure()`; `commercial-order.ts` priced qty = billed measure; `speed.ts` same;
  `levels.ts` `MEASURED_UOM`; `standard-price.ts` tiers on billed measure; `invariants.ts` measured-line identity.

### 3.8 Tenant server / API (thin routes, logic in services, explicit `tenant_org_id` everywhere)

| Route | Purpose | Permission |
|---|---|---|
| `GET /api/v1/uom/units` | tenant units (`org_uom_cf`), badges System / Customized / Custom | `uom:view` |
| `GET /api/v1/uom/catalog` | system units not yet in the tenant (for "Add from system catalog") | `uom:view` |
| `POST /api/v1/uom/units` | create custom unit, or add system units by code (`fn_uom_seed_tenant` with codes) | `uom:manage` |
| `PATCH /api/v1/uom/units/[code]` | edit (presentation fields only on system rows) | `uom:manage` |
| `POST /api/v1/uom/units/[code]/reset` | reset a customized system unit to system values | `uom:manage` |
| `GET/POST/PATCH/DELETE /api/v1/uom/conversions` | tenant-wide + per-product conversions (filter `productId`) | `uom:view` / `uom:manage` |
| `POST /api/v1/uom/convert` | preview conversion (used by dialogs) | `uom:view` |

- Services: `uom-units.service.ts`, `uom-conversions.service.ts`, writes through DB save functions (single source of rules).
- Orders: schema accepts `measuredQty` / `measureLength` / `measureWidth` only; server decides billed qty; errors
  `MEASURE_REQUIRED`, `MEASURE_NOT_ALLOWED`, `UOM_CONVERSION_MISSING` (i18n `uom.errors.*`).
- Checkout writes snapshots; Order Edit V2 op **`CHANGE_ITEM_MEASURE`** (schemas, constants, priced-ops, preview, apply,
  structural write, review audit, capability, history/print of the change).
- Tax lines / e-invoice: quantity = billed measure, unit = snapshot `uom_unece_code`.
- Inventory service + catalog service: `base_uom_code`; hard-coded unit list removed.
- Public/customer APIs (`/api/v1/public/customer/*`, tracking, booking): expose measure fields through the public allowlist.

### 3.9 Tenant UI (Cmx only, EN/AR, RTL, theme tokens, a11y, all states)

- Shared in `src/ui/`: **`CmxUomSelect`** (grouped by dimension, shows symbol + badge, searchable), **`CmxQuantityMeasureInput`**
  (value or L × W, unit suffix, keypad-friendly, decimals from unit). Stories for both.
- **Units & Conversions** page (`/dashboard/catalog/units`):
  - *Units* tab: `CmxDataTable` with System / Customized / Custom badges, dimension filter, search; actions Add custom unit,
    Add from system catalog (multi-select), Edit (locked fields shown read-only on system rows), Reset to system,
    Activate/Deactivate (blocked with "used by N products" when in use; base units cannot be deactivated).
  - *Conversions* tab: list + dialog matching the reference (*UoM*, *UoM To*, *Multiply rate*, *Divide rate*, *Active*),
    reciprocal pre-fill, inline consistency message, live preview ("1 LB = 0.453593 KG"); Reset to system on customized pairs.
  - Empty, loading, error, permission-denied states; confirm dialogs via `cmxMessage`.
- **Product form**: Unit (`CmxUomSelect`), price type, "Price per kg/m/m²", optional "Minimum billable" and "Bill in steps of"
  (shown for measured units only, with a live example "3.2 kg → billed 3.5 kg"); **Units tab** = that product's conversions.
- **Inventory** add/edit/adjust modals: `CmxUomSelect`; decimals from unit.
- **New order**: measured product → **Measure dialog** (`CmxQuantityMeasureInput` + `CmxKeypadPopover`), bag/piece count,
  billed preview, inline minimum note; cart line "5.35 kg × 1.200 = 6.420".
- **Order Edit**: "Change weight/size" action → quote → confirm.
- **Display**: items list, order detail, receipt/invoice/statement prints, Order Fin View line rows, public tracking:
  "5.35 kg × 1.200"; "measured 1.8 kg · billed 3 kg (minimum)".
- i18n `messages/{en,ar}/uom.json` + keys in catalog/orders/inventory; `inventory.units.*` removed.

### 3.10 HQ (`cleanmatexsaas`)

- **platform-api**: new module `uom-config` on the code-table engine — registry entries `sys_uom_cd`, `sys_uom_conv_cd`;
  validation (one base per dimension, UN/ECE code format, reciprocal check, same-dimension, collision check against tenant
  custom codes, no dimension/base change on a unit tenants use), `is_to_seed` field; tenant sync runs via the DB trigger
  (§3.3); `number` field precision support for `RATE` (12 dp) in the engine; permissions `uom_config.view` /
  `uom_config.manage` (HQ dot format, verified in P0); audit via the engine.
- **Products & Items Config**: registry `price_type` options `FIXED/PER_UNIT`; `product_unit` select → `base_uom_code` ref
  (`sys_uom_cd`); remove `requires_weight` / `requires_dimensions` fields; bulk columns + validation;
  tenant-products repository + comparison service use `base_uom_code` (and show the tenant's optional minimum/increment
  read-only in the tenant product view).
- **platform-web**: "Units & Conversions" screens (shared code-table screens), nav entry, template editor changes,
  bulk template download updated.
- **Tenant setup health** checks: products on an inactive unit; measured products with no price; custom physical units
  without a base conversion; templates referencing inactive units.
- HQ docs: `docs/features/Products_Items_Config/` update + new `docs/features/UoM_Config/`.

### 3.11 Mobile customer app (`cmx_mobile_apps`)

- `mobile_domain/order_item_model.dart`: measure fields + unit symbol; `order_booking_draft_model.dart` unchanged in money.
- Booking: measured products show "price per kg — final amount after weighing" (+ minimum / step when set); customer enters bag count only.
- Order detail + tracking: "5.35 kg × 1.200"; minimum / step note. l10n EN/AR in `mobile_l10n`.

### 3.12 Performance

- Units + conversions per tenant are small (< 200 rows): loaded once per request through one query each, cached
  server-side with tag invalidation on save (`revalidateTag('uom:<tenant>')`); resolver runs in memory — no per-line queries.
- Indexes: `org_uom_cf (tenant_org_id, uom_code)` unique; `org_uom_conv_cf` pair indexes above + `(tenant_org_id, product_id)`;
  `org_product_data_mst (tenant_org_id, base_uom_code)` for "used by" checks.
- Order lines carry snapshots, so lists/prints/reports never join unit tables.
- Unit references are plain composite FKs (index on each referencing `(tenant_org_id, uom_code)`); no validation triggers.
- HQ sync trigger touches ~1 row per tenant per HQ edit (rare, set-based single statement).

### 3.13 Security and gating

- RLS on `org_uom_cf`, `org_uom_conv_cf`; every query filters `tenant_org_id` explicitly; no `anon`/`authenticated` grants on new
  objects; `sys_*` reads via `catalogReadClient`.
- Tenant permissions `uom:view`, `uom:manage` (seeding migration + `lib/constants/permissions/uom-perm.ts`), default roles via `/update-rbac-role`.
- Navigation dual-write (`navigation.ts` + `sys_components_cd`), access contract golden path, `requirePermission` on every route.
- No feature flag, no tenant setting (pre-launch).

### 3.14 Testing

| Level | Coverage |
|---|---|
| Unit (jest) | resolver (direct, reverse, two legs, precedence, missing, not-whole COUNT), scale rule, billed measure (none / minimum / increment / both), m² rounding, PIECE fallback, speed on kg, kg tiers, formatter (AR digits) |
| DB integration | tenant isolation on both org tables; seed idempotency + sync (locked refresh, customized names kept); reset; locked-field trigger; collision rules; in-use deactivation blocked; FK RESTRICT; scale fn; reciprocal CHECK; billed CHECKs; backfill mapping |
| API | permission matrix, Zod errors, error codes |
| Order flows | create measured order → pay → edit measure → settlement; invoice/e-invoice unit code |
| HQ (jest) | registry validation, collision check, template copy |
| UI | `check:ui`, `/cmx-ui-design-review`, Storybook stories; Playwright smoke: create unit → conversion → kg product → order |
| Mobile | widget tests for item card / detail line |

## 4. Phases

Every phase ends with: STATUS.md + PLAN progress, QA_TEST_GUIDE.md, RESUME_CONTINUATION.md (both repos when touched).

| Phase | Repo | Scope | Gate |
|---|---|---|---|
| P0 | both | Re-verify §2: distinct `product_unit` values (products + templates); readers of every column changing type; `get_product_price` callers; `cmx-api` order DTOs; HQ permission format; `requires_item_count` meaning. | findings in STATUS |
| P1 | both | Precision rule doc + pointers in both repos. **Migration A**: `sys_uom_cd` + seed, `org_uom_cf`, `sys_uom_conv_cd` + seed, `org_uom_conv_cf`, save fns, `fn_uom_seed_tenant` + HQ sync triggers + backfill all tenants, locked-field trigger, `fn_uom_convert`, `fn_uom_assert_qty_scale`, product/template/item/price-list/stock columns + composite FKs + backfill, permissions, nav component. **STOP for owner apply**, then `/pull-prisma`. | owner applied |
| P2 | tenant | `lib/uom/*`, constants/types/Zod, calculator changes + unit tests. | jest green |
| P3 | tenant | UoM services + routes; order schema/loader/checkout; tax/e-invoice unit; inventory + catalog services; public APIs. | jest + DB integration |
| P4 | tenant | `CmxUomSelect`, `CmxQuantityMeasureInput` (+stories); Units & Conversions page; product form + Units tab; inventory modals; Measure dialog + cart; access contract, nav. | build, eslint, check:i18n, check:ui, check:ui-access-contract, design review |
| P5 | tenant | Order Edit `CHANGE_ITEM_MEASURE`. | jest order-change + build |
| P6 | tenant | Display: items list, detail, prints, Order Fin View, public tracking (allowlist test). | tests + build |
| P7 | HQ | `uom-config` module + screens; Products & Items Config registry, bulk, tenant-products, comparison; setup-health checks. | HQ jest + build |
| P8 | mobile | Customer app model, booking, detail, tracking, l10n. | flutter analyze + tests |
| P9 | both | **Migration B**: drop `product_unit` (products + templates), `requires_weight`, `requires_dimensions` after grep shows no readers. STOP for apply. | owner applied |
| P10 | both | Docs: UoM developer guide (seed + sync, resolver, scale rule, layers, precision), user guides EN/AR, QA guide, CHANGELOG, HQ docs; `/documentation`; platform inventories rebuild. | docs complete |

## 5. Risks

- Column type changes ripple into Prisma + TS readers (P0 lists them); INTEGER → DECIMAL on tiers changes the TS type.
- Seeded copies can drift from HQ if the sync trigger is bypassed — DB integration test asserts every tenant's system rows match `sys_uom_cd` on locked fields; setup-health check reports drift.
- HQ adding a system code equal to a tenant custom code is rejected; HQ must pick another code.
- Backfill stops on unknown `product_unit` values by design.
- Reports summing `quantity` count bags, not kg → follow-up column.
- FX rate columns use mixed precision → separate follow-up under the new rule.
- Scale hardware out of scope.
