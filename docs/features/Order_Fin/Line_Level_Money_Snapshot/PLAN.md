# Line-Level Money Snapshot and Commercial Level — PLAN

**Status:** DRAFT v2.1, 2026-10-23. All owner items resolved (L18–L21). Awaiting approval to start Phase 0. No code, no migration.
**Revision:** v2 is a production-readiness audit of v1.2. It adds:
- module boundaries and a domain-agnostic calculator
- decimal arithmetic
- a calculation version
- DB integrity constraints, with NOT NULL tightened after recompute
- per-line ready-by, per-line tax profile and exemption
- the gift-card rule
- line-discount UI and permissions
- a full surface inventory in both repos (every API, service, screen and print)
- fiscal item lines on tax documents
- releases, observability and a test matrix

The gaps found and how each is closed are in §16.
**Discussion history:** [DISCUSSION.md](DISCUSSION.md) · **Progress:** [STATUS.md](STATUS.md)
**Downstream:** [Reusable_Order_Fin_View/PLAN.md](../Reusable_Order_Fin_View/PLAN.md) Phase 1B depends on this plan (L13).

## 1. Goal

Every commercial fact decided when an order is created is saved on the row where it applies, on items **and** pieces:
- speed and speed premium
- price source
- preference price mode
- line and order discounts
- tax mode, profile, category, rate and amount, rounded per the tax profile
- the promised ready-by

One shared, pure, domain-agnostic calculator produces those values. Create uses it first, and every later flow (Order Edit V2, collection, cancel, refund, tax document, prints, portal, reports) reads what it stored.

A tenant setting selects the **commercial level**:
- **ITEM** (today): the item is priced and its pieces carry an exact split.
- **PIECE**: each piece is priced and the item is the exact sum.

**First release changes no figure for any tenant** (L17). New behaviour starts only when HQ or the tenant changes a setting or a rule.

### Non-goals
- No change to payment, settlement, cash-rounding or loyalty writers. They only read line facts where §11 says so.
- No refund per piece in this plan: refunds stay amount-level, but stored piece money makes it possible later.
- No more than one tax type per line (GCC VAT needs one); known limit, §6.8.
- No changes to `cmx-api`: it has only `auth` and `health` modules.

## 2. Owner decisions

| # | Decision | Source |
|---|---|---|
| L1 | Speed is stored on items and pieces; the UI stays order-wide at first. The premium is configured per tenant, with optional branch, service category and product. | Round 1 |
| L2 | The speed premium is **inside the unit price**, never a separate charge. | Round 1 |
| L3 | Three preference price outcomes; the mode is configured, not chosen by the cashier. | Round 1 |
| L4 | A preference extra is charged once per line now; the basis becomes configurable later. | Round 1 |
| L5 | Order discounts are split across lines when tax is per line; refined by L15. | Round 1 |
| L6 | Tax rounding is configured on tax profiles; extended by L14. | Round 1 |
| L7 | No mixed inclusive/exclusive modes in one order. | Round 1 |
| L8 | Follows pre-configured settings; this plan is the data contract P1B builds on. | Round 1 |
| N1 | Pieces carry the same money columns as items. | Round 1 |
| N2 | Starts from Create; Create, Edit and the rest share one calculator. | Round 1 |
| N3 | Tenant setting `commercial_level` (`ITEM` / `PIECE`). | Round 1 |
| L9 | Premium as a fixed amount or relative to the standard price. The product express fields move into speed rules (names per L19). | Round 2 |
| L10 | `commercial_level` is tenant-only. | Round 2 |
| L11 | PIECE level is available to all tenants (no flag, no plan gate). | Round 2 |
| L12 | Order Edit never changes an order's commercial level. | Round 2 |
| L13 | Separate plan; Reusable View P1B depends on it. | Round 2 |
| L14 | Tax profiles define rounding level, mode and decimal places / increment. | Round 2 |
| L15 | Items and pieces have their own line discounts; splitting order discounts to lines is pre-configured. | Round 2 |
| L16 | New tenant settings are `org_tenants_mst` columns, edited in HQ at `tenants/[id]/order-fin-settings`. | 2026-10-23 |
| L17 | Every new setting and configuration column is seeded to reproduce today's behaviour. | 2026-10-23 |
| L18 | **HQ is the single writer** of `tax_pricing_mode` and `extra_price_pricing_mode`, at tenant level and for branch overrides. The tenant app shows them read-only, and its APIs reject writes to them (§10.3). | 2026-10-23, item 1 |
| L19 | The speed rule fields take the product names with "express" replaced by "speed": `default_speed_sell_price`, `multiplier_speed`, `turnaround_hh_speed`. | 2026-10-23, item 2a |
| L20 | **Multiplier meaning:** the multiplier is the fraction **added** to the normal price. Speed price = normal + normal × `multiplier_speed`; for example normal 10 and 0.30 gives 13. | 2026-10-23, item 2d |
| L21 | `disc_alloc_mode` is tenant-only. Fiscal item lines on tax documents ship in Release A. | 2026-10-23, items 2c, 3 |

## 3. Facts this plan relies on (verified 2026-10-23, remote DB and code)

**Speed**
- `org_orders_mst.service_speed` is the only speed column (`EXPRESS` or null). There is no speed code table; the 7 price lists are all `standard`.
- An express price is `default_express_sell_price`, falling back to `default_sell_price` (`pricing.service.ts`). `multiplier_express` has no effect: `lib/db/orders.ts` passes `expressMultiplier: 1`.
- The express fields reach 26 tenant-app files, including the catalog import, the custom-item modal, the New Order cart and product cards, the Edit screen, and `app/api/v1/public/customer/booking/route.ts`.
- Ready-by is calculated in `order-service.ts` (≈ line 1196) and `preparation/preparation-completion.service.ts` from the product turnaround fields.

**Preference mode and charges**
- `extra_price_pricing_mode` (tenant + branch) has settings UI in both apps and a resolver, but no calculation calls it. All tenants are `INCLUDED_IN_ITEM_PRICE`, all branches null. The rule that actually runs is the hard-coded level rule in `lib/utils/order-charge-money.ts`.
- The header rollup also sums `EXPRESS` charge rows.

**Discounts and tax**
- Discounts are order-level (`org_order_discounts_dtl`, 0 rows) and come off the order subtotal. Tax is calculated on the discounted order total and rounded once per tax line at the currency's decimals, using float `toFixed`.
- All 3 tenants are `TAX_EXCLUSIVE`. Inclusive mode needs the `tax_inclusive_pricing` flag.
- Tax profiles' `applies_to` values: null / empty / `EXEMPT_SERVICE` / `EXPORT` / `TOBACCO`.
- Customer exemptions (3 rows) all have `service_type` null, so they exempt the whole order. `DISCOUNT_SOURCE_TYPE` includes `GIFT_CARD`; the rollup has a `GIFT_CARD_DOUBLE_COUNTED` warning.
- Tax documents store tax lines only (`org_tax_doc_lines_dtl` ← `org_order_taxes_dtl`), and their print has **no item lines** by design (B14).

**Other**
- Refunds are amount-level (`order-refund.service.ts` has no item or piece reference).
- `org_price_history_audit` is generic (`entity_type`, `entity_id`, old/new values, reason).
- Permissions in use: `orders:discount`, `orders:discount_threshold_override`, `pricing:override`, `settings:read`, `settings:update`.
- Tax profiles are edited in the **tenant app** (`/dashboard/settings/tax`, `app/api/v1/settings/tax/profiles`, `app/actions/settings/tax-actions.ts`).
- HQ reads no order lines. HQ's Tax & Pricing tab writes `org_tenants_mst` modes through `platform-api` `tenants.service.ts`, with an audit.
- The last migration is `0637`; the last ADR is `ADR-059`.

## 4. Architecture and separation of concerns

### 4.1 Layers

| Layer | Location (final names fixed in ADR-060) | Rules |
|---|---|---|
| **Domain (pure)** | `web-admin/lib/commercial/` | No I/O, no Prisma, no Supabase, no `server-only`, no i18n. Decimal arithmetic only. Domain-agnostic vocabulary (§4.2). An ESLint `no-restricted-imports` rule enforces this for the folder. |
| **Context loader** | `web-admin/lib/services/commercial/commercial-context.loader.ts` | Reads catalog, rules, settings, profiles and the recorded order context. Every query filters `tenant_org_id` explicitly (CRITICAL RULE #4). Returns plain inputs. |
| **Writer (mapper)** | `web-admin/lib/services/commercial/commercial-line.writer.ts` | Maps calculator output to Prisma data for items, pieces, preferences, discounts, charges, taxes and header, inside the caller's transaction. It is the **only** writer of §6 columns. |
| **Quote service** | `web-admin/lib/services/commercial/commercial-quote.service.ts` | loader → calculator, no write. Serves the New Order cart, Edit Preview and the live quote (Reusable View D20). |
| **Use cases (existing)** | Create submit orchestrator, Order Edit apply/structural write, rollup | Thin: load, calculate, write, then emit the existing events. No money math of their own. |
| **API / actions** | route handlers and server actions | Validate (Zod built from constants), resolve the session tenant, call the use case. No business logic. |
| **UI** | `src/features/**`, Cmx only | Shows server figures. No client money math. |

### 4.2 Domain-agnostic vocabulary (mapped to laundry only in the loader and writer)

| Domain term | CleanMateX mapping |
|---|---|
| `CommercialLine` | order item |
| `SubUnit` | piece |
| `ServiceLevel` | service speed |
| `PriceModifier` (`kind`, `placement` = `INCLUDED` / `SEPARATE`, `basis`) | speed premium (always `INCLUDED`), preference extra (placement from mode) |
| `Adjustment` (`scope` = `LINE` / `DOCUMENT`) | discount |
| `TaxContext` (mode, profiles, categories, rounding) | tax |
| `Charge` | order charge |

### 4.3 Arithmetic and versioning
- The calculator uses `Prisma.Decimal` (decimal.js) end to end; numbers are never floats. It outputs decimal strings, and the writer stores them in `DECIMAL(19,4)`.
- Rounding implements the 7 `sys_rounding_mode_cd` modes plus `rounding_increment_minor`.
- `org_orders_mst.commercial_calc_version` (integer) records the calculator version that wrote the order. A rule change bumps the version. Recompute and reconciliation are aware of the version.
- Moving from float `toFixed` to decimal can differ by one minor unit in rare half-way float cases. P1-01 lists every such case, and the owner signs off on it as a bug fix, disclosed per rule #15.

## 5. Core model

### 5.1 `money_basis`

| Order `commercial_level` | Item row | Piece rows |
|---|---|---|
| `ITEM` | `PRICED` | `ALLOCATED`: exact split of the item |
| `PIECE` | `ROLLUP`: exact sum of the pieces | `PRICED` |

- Both levels are always filled: totals and reports read items, and piece views read pieces.
- **Per-line fallback:** under `PIECE`, a line whose product cannot be priced per piece (`FIXED`; per-kg later) stays `PRICED` on the item, and its pieces are `ALLOCATED`.

### 5.2 Invariants

| # | Invariant |
|---|---|
| I1 | `ALLOCATED`: Σ pieces = item, exactly, for every money column. |
| I2 | `ROLLUP`: item = Σ pieces, exactly. |
| I3 | Header total = Σ item `line_total_amount` + Σ separate charges (with tax) − Σ document-level discounts (with their tax effect). |
| I4 | One home per amount: line, charge or document discount, never two. |
| I5 | Row identity: `net_amount = total_price − line_disc_amount − order_disc_alloc_amount`; `line_total_amount = net_amount + tax_amount` (exclusive) or `= net_amount` (inclusive). |
| I6 | Every line of an order has the order's `tax_pricing_mode`. |

- **Allocation:** one largest-remainder function at output precision, tie-broken by `piece_seq` then `id`.
- **Enforcement:**
  - the calculator rejects any output that breaks an invariant (error code `COMMERCIAL_INVARIANT_FAILED`, no write)
  - DB CHECK constraints for I5 and the code columns (added with NOT NULL in M10, after recompute)
  - reconciliation rules (shared with Reusable View BF-14)
  - DB-integration tests

### 5.3 Snapshots on the order, fixed at creation

`org_orders_mst` stores:
- `commercial_level`
- `tax_pricing_mode`
- `extra_price_pricing_mode`
- `disc_alloc_mode`
- `commercial_calc_version`

Edit, refund and recompute use these, never the current setting (rule #15). The commercial level never changes (L12).

### 5.4 Speed and ready-by
- The item's `service_speed` is the default, and the piece copies it. A piece may differ only under `PIECE` (P9).
- `ready_by_at` is stored per item and per piece, from the resolved `turnaround_hh_speed` (or the product's standard `turnaround_hh`). The order `ready_by` is the latest line ready-by, unless the cashier entered one (the current behaviour stays). Both ready-by services call one resolver.

## 6. Data model

Money is `DECIMAL(19,4)`; strings are `TEXT`; names have 30 characters or fewer; there are no defaults on locale fields. Every object is documented with `COMMENT ON` (`/code-documentation`). There is RLS on every new `org_*` table, and composite FKs follow the Prisma-safe order rule (`/database`). New line columns are **nullable** in M5/M6 and become NOT NULL plus CHECK in M10, after the recompute.

### 6.1 Line money: `org_order_items_dtl` and `org_order_item_pieces_dtl` (identical)

| Column | Meaning |
|---|---|
| `money_basis` | `PRICED` / `ALLOCATED` / `ROLLUP` |
| `service_speed` | FK → `sys_service_speed_cd` |
| `ready_by_at` | Promised ready time of the row |
| `price_source` | `PRICE_LIST` / `PRODUCT_DEFAULT` / `CUSTOMER_PRICE` / `SPEED_RULE` / `MANUAL` |
| `price_list_id` | Price list used (composite FK) |
| `speed_rule_id` | Speed rule used (composite FK, `ON DELETE RESTRICT`) |
| `list_unit_price` | Standard catalog price before speed, override or discount |
| `speed_premium_amount` | Premium inside the price |
| `price_per_unit` *(exists)* | Effective unit price |
| `service_pref_charge` *(exists)* | Included preference extras |
| `total_price` *(exists, meaning fixed)* | Gross before discounts and tax |
| `line_disc_amount` | Σ own line discounts |
| `order_disc_alloc_amount` | Share of order discounts (0 under `DOCUMENT_LEVEL`) |
| `net_amount` | I5 |
| `tax_pricing_mode` | Order's mode (I6) |
| `tax_profile_id` | Profile applied (composite FK) |
| `tax_category_code` | FK → `sys_tax_category_cd` |
| `tax_exempt_reason` | `CUSTOMER_EXEMPTION` / `SERVICE_EXEMPTION` / `PRODUCT_EXEMPT` / … (constants; P0-10) |
| `tax_rate` | Combined rate |
| `taxable_amount` | Base |
| `tax_amount` | Tax |
| `line_total_amount` | I5 |

Indexes:
- `(tenant_org_id, order_id)` exists
- add `(tenant_org_id, service_speed)` and `(tenant_org_id, tax_category_code)` for reports (only if P0-11 shows a reader needs them)

### 6.2 `org_orders_mst`
- The §5.3 snapshot columns.
- `speed_premium_amount`: Σ lines, informational, never an addend.
- The existing `exempt_amount`, `zero_rated_amount`, `out_of_scope_amount` and `non_taxable_amount` become real Σ by category.

### 6.3 `org_order_preferences_dtl`
- `extra_price_pricing_mode` (snapshot)
- `price_basis` (`PER_LINE` only for now)
- `list_extra_price`, `is_price_override`
- `bundle_code`, `bundle_discount_amt`
- `extra_turnaround_min`

ORDER-level preferences are always `SEPARATE_CHARGE`. `is_included_in_base` on the catalog means extra = 0.

### 6.4 `org_order_discounts_dtl`
- `discount_level` (`ORDER` / `ITEM` / `PIECE`)
- `order_item_id`, `order_item_piece_id` (composite FKs, with a CHECK matching the level)
- `disc_alloc_mode` (snapshot on ORDER rows)
- `tax_category_code` (category split for document rows)

**Gift-card rule:** `GIFT_CARD` is settlement, not a price reduction. It is never allocated, never reduces a taxable base, and is never written as a line discount. P0-09 confirms the current path and that the calculator rejects it as an `Adjustment`.

### 6.5 `org_order_charges_dtl`
`tax_category_code`, `tax_profile_id`, `tax_rate`, `taxable_amount`, `tax_amount`.

### 6.6 Configuration

**`sys_service_speed_cd`**
- Columns: code, name/name2, `display_order`, `is_default`, audit.
- Seeded `STANDARD` (default) and `EXPRESS`.
- Names come from the DB, so no i18n keys are needed for codes.

**`sys_tax_category_cd`**
- The 4 categories, bilingual.

**`org_speed_price_rules_cf`** (§7)

| Column | Meaning |
|---|---|
| `tenant_org_id`, `service_speed` | Scope and speed (FK; not `STANDARD`) |
| `branch_id`, `service_category_code`, `product_id` | Nullable dimensions |
| `speed_price_type` | How the speed price is set: `SELL_PRICE` (a full price), `MULTIPLIER` (a fraction added to the normal price), `FIXED_AMOUNT` (a fixed amount added) |
| `default_speed_sell_price` | `DECIMAL(19,4)`. For `SELL_PRICE`: the unit price at this speed (was `default_express_sell_price`) |
| `multiplier_speed` | `NUMERIC(6,4)`. For `MULTIPLIER`: the added fraction (L20), 0.30 = +30%. Wider than the old `NUMERIC(4,2)`, so every old value fits and 0.125 is possible. CHECK ≥ 0. |
| `speed_extra_amount` | `DECIMAL(19,4)`. For `FIXED_AMOUNT`: the amount added per unit or per line |
| `turnaround_hh_speed` | `NUMERIC(6,2)`. Hours at this speed (was `turnaround_hh_express`; wider than `NUMERIC(4,2)`, so slower speeds over 99 hours fit) |
| `price_basis` | `PER_UNIT` / `PER_LINE` (applies to `FIXED_AMOUNT`) |
| | CHECK: exactly the value column of the chosen `speed_price_type` is set; the other two are null |
| `effective_from`, `effective_to`, `is_active`, `rec_status`, audit, `name`/`name2` (optional label) | Validity and audit |

- Unique index (`NULLS NOT DISTINCT`) on (`tenant_org_id`, `service_speed`, `branch_id`, `service_category_code`, `product_id`, `effective_from`).
- Lookup index on (`tenant_org_id`, `service_speed`, `is_active`).
- RLS.
- No hard delete once a line references the rule (`ON DELETE RESTRICT`); soft delete instead.
- Changes are recorded in `org_price_history_audit` with `entity_type = 'SPEED_RULE'`.

**`org_tax_profiles_cf`:** `rounding_level` (`LINE` / `DOCUMENT`), `rounding_mode` (FK → `sys_rounding_mode_cd`), `output_decimal_places`, `rounding_increment_minor`. Null falls back to the currency `ACCOUNTING` rule.

**`org_product_data_mst`:** `tax_category_code` (replaces the integer `is_tax_exempt`). The `price_type` case drift is fixed.

**`org_tenants_mst`:** `commercial_level`, `disc_alloc_mode`, `disc_alloc_basis` — NOT NULL, defaults per §12.1, CHECK on exact codes.

### 6.7 Fiscal item lines (closes the e-invoicing gap)

**`org_tax_doc_items_dtl`** is an immutable copy of each item's line money, written when the tax document is issued:
- columns: `tax_document_id`, `order_item_id`, the name snapshot (`product_name`/`product_name2`), `quantity`, `price_per_unit`, `line_disc_amount + order_disc_alloc_amount`, `net_amount`, `tax_category_code`, `tax_rate`, `tax_amount`, `line_total_amount`
- composite FKs, RLS
- it is never updated after issue; credit notes reference it

The tax-document print gets an item table, so a document never re-reads live order items. GCC simplified tax invoices normally require item lines; P0-12 confirms the per-country field list.

### 6.8 Known limits
- One combined tax per line. More than one tax type per line would need a child table later.
- Line money is in order currency; base-currency values stay header-only (FX program).

## 7. Speed pricing (L1, L2, L9)

- **Resolution:** the most specific **active and effective** rule wins:
  1. product + branch
  2. product
  3. category + branch
  4. category
  5. tenant + branch
  6. tenant

  The unique index makes ties impossible. The resolver is pure (it receives candidate rules) and is unit-tested per level.
- **Price**, by `speed_price_type`:

  | Type | Unit price at speed |
  |---|---|
  | `SELL_PRICE` | `default_speed_sell_price` |
  | `MULTIPLIER` | normal + normal × `multiplier_speed` (L20) |
  | `FIXED_AMOUNT` | normal + `speed_extra_amount` (per unit; or once per line when `PER_LINE`) |

  Premium = speed unit price − normal unit price. `speed_premium_amount` explains it. A manual override (`pricing:override`) replaces the final unit price, and premium is then recorded as 0 with `price_source = MANUAL`.
- **Standard price** stays exactly as today for each speed (P0-07: express today ignores the standard price list).
- **No rule** means no premium. The cart says "No express premium configured for this item": an explanation, never a silent change.
- **Custom items** (New Order custom-item modal): the unit price is entered (`MANUAL`), and the premium comes from category or tenant rules only, shown inline.
- **Catalog import/export:** keeps an "Express price" column (plus an optional "Express multiplier" column), which upserts or removes the product-level `EXPRESS` rule (`SELL_PRICE` or `MULTIPLIER`). Bulk users lose nothing.

## 8. Calculation rules

### 8.1 Steps per priced row
1. Standard price.
2. Speed rule.
3. Override.
4. Preference modifiers by mode.
5. Gross = `total_price`.
6. Line discounts.
7. Order-discount share (`ALLOCATE_TO_LINES`).
8. `net_amount`.
9. Tax per profile and category (§9).
10. `line_total_amount`.

Under `TAX_INCLUSIVE`, the existing B11 extraction runs on `net_amount`.

### 8.2 Tax profile and category per line
- The category comes from product `tax_category_code` → customer exemption (whole order today, `CUSTOMER_EXEMPTION`) → service-type exemption (per line, matching `org_tax_exemptions_cf.service_type`).
- The profile is chosen by matching `applies_to` against the line's category and supply type. P0-10 maps today's selection exactly, so seeded behaviour is unchanged.

### 8.3 Line discounts (L15)
- Rows in `org_order_discounts_dtl` with level ITEM/PIECE, `DISCOUNT_SOURCE_TYPE` sources, and the price-list `discount_percent` as a line discount (Reusable View D23).
- A discount never exceeds the line gross: entry is prevented in the UI and rejected by the server with `LINE_DISCOUNT_EXCEEDS_GROSS`. Nothing is clamped silently.
- Under `ITEM`, the discount is allocated to pieces.
- Permission `orders:discount`. Thresholds reuse `orders:discount_threshold_override` and the existing limit rules (P0-13).

### 8.4 Order discounts (`disc_alloc_mode`)
- **`ALLOCATE_TO_LINES`**: split proportionally to net after line discounts, giving exact line tax.
- **`DOCUMENT_LEVEL`** (seeded; today's behaviour): a document allowance split by tax category only; header tax per category on (Σ line taxable − allowance). Line `tax_amount` stays tax on the line's own net, and I3 covers the difference.

### 8.5 Charges
Taxed by their own profile and category. `EXPRESS` charge rows are no longer written; a reconciliation warning flags any that remain.

## 9. Rounding (L14)

- Per tax line, the profile's level, mode, decimals and increment apply, falling back to the currency `ACCOUNTING` rule.
- **`LINE`:** round per row; header = Σ rows.
- **`DOCUMENT`** (seeded; today): calculate per category on the total, round once, then allocate to rows exactly.
- Money not related to tax rounds at the currency `ACCOUNTING` rule. Intermediate values keep full decimal precision. Cash rounding is unchanged.

## 10. API and contract changes

### 10.1 Tenant app (`web-admin`) — routes follow the repo's existing route-handler and server-action patterns

| Surface | Change |
|---|---|
| Speed rules | `GET/POST /api/v1/catalog/speed-rules`, `GET/PATCH/DELETE /api/v1/catalog/speed-rules/[id]` (soft delete, `409 RULE_IN_USE` → deactivate instead), `GET /api/v1/catalog/speed-rules/resolve?productId&branchId&serviceSpeed` (which rule wins and why). Matching server actions if the catalog screens use actions. |
| Service speeds | Read endpoint or lookup entry for `sys_service_speed_cd`. |
| Tax profiles | `app/api/v1/settings/tax/profiles*` + `tax-actions.ts`: rounding fields, Zod from constants. |
| Products | Catalog service, inventory service, `pricing-bulk.service`, import/export: remove the 3 express fields; add `tax_category_code`; import maps "Express price" to a rule (§7). |
| Commercial quote | The New Order cart's existing totals call is moved to `commercial-quote.service` and returns lines, modifiers, discounts, tax and header. The client does no money math. Shared with Reusable View D20 / P1B-07. |
| Order create | Zod (`order-schema`, `new-order-payment-schemas`):<br>• `isExpress` → `serviceSpeed` (code)<br>• optional per-line `serviceSpeed`<br>• per-line `lineDiscount { type, value, reasonCode }`<br>• per-piece discount and speed (P9)<br>• `confirmedUnitPrice` (Reusable View D26) compares against the resolved effective price<br>Pre-launch: no compatibility alias. |
| Order edit | `CHANGE_SERVICE_SPEED` and price/quantity/preference/discount ops re-price through the calculator. Order snapshots are never re-resolved. |
| Order reads | `GET /api/v1/orders/[id]`, detail/full pages, `receipt-service`, `public-order-tracking.service`, `dashboard.service`: line-money fields added (additive). The public view shows only customer-safe fields (Reusable View D7). |
| Public booking | `app/api/v1/public/customer/booking/route.ts`: speed code + turnaround from rules. |
| Tax documents | `tax-document-write/read.service`: write and read `org_tax_doc_items_dtl` (§6.7). |

### 10.2 HQ (`cleanmatexsaas`)

| Surface | Change |
|---|---|
| `platform-api` tenants DTO + service | Tax-pricing GET/PATCH carries `commercial_level`, `disc_alloc_mode`, `disc_alloc_basis` (`@IsIn` exact codes), with the existing old/new audit. `PIECE` is accepted only after P9. |
| `platform-api` database types | Regenerate after M3. |
| `platform-web` API client and hook | Types extended; same endpoint. |
| `platform-api` branches DTO + service | Branch GET/PATCH carries the overrides `tax_pricing_mode` and `extra_price_pricing_mode`. Null means "inherit from organization". `@IsIn` exact codes, old/new audit (L18). |

### 10.3 Single writer for the existing modes (L18)

| Repo | Surface | Change |
|---|---|---|
| Tenant app | `PATCH /api/v1/tenants/me` | Rejects `tax_pricing_mode` / `extra_price_pricing_mode` with `403 FIELD_MANAGED_BY_HQ`; GET still returns them. Enforced on the server, not only hidden in the UI. |
| Tenant app | `PATCH /api/v1/branches/[id]` | Same rule for the branch overrides. Other branch fields are unchanged. |
| Tenant app | `tenant-settings-screen.tsx`, `branch-settings-screen.tsx` | The selects become read-only values, with the note "Managed by platform administration". If a screen has nothing editable left, it shows the read-only summary, and its Save button and dirty state are removed. |
| HQ | `tenants/[id]/branches/[branchId]/edit` | A "Tax & pricing overrides" section with two selects, including "Inherit from organization". |
| Both | Resolvers | `resolveTaxPricingMode` / `resolveExtraPricePricingMode` are unchanged (branch → tenant → default). |

## 11. Screens and UX (Cmx components only, EN/AR + RTL, `cmxMessage` / `useMessage()`, server figures only)

### 11.1 Tenant app

| Screen | Change | UX rules |
|---|---|---|
| **Catalog › Speed Pricing** (new) | List with filters (speed, branch, category, product, active), editor dialog, effective dates, a "Which rule applies?" resolver panel, bulk create for a category. | Shows the specificity order inline. Duplicate-scope conflicts are prevented before save. Rules in use can only be deactivated. Empty state explains that no rule means no premium. |
| Product form, services pages, add-item modal | Remove the 3 express fields. Add a **Speed pricing** section: this product's rules, with add/edit in place and the resolved price per speed. Add a tax category select. | Inline resolved example: "Express: 3.500 (rule: product)". |
| Custom-item modal (New Order) | Premium from category/tenant rules, shown inline. | |
| Catalog import | Template and validation updated (§7). | Row-level errors. |
| Settings › Tax | Rounding level, mode, decimals, increment, with a live example ("1.2345 → 1.235"). | "Applies to new orders only." |
| **New Order** | Order-wide speed selector driven by `sys_service_speed_cd`; product cards and cart show the resolved price for the chosen speed. Each line shows "incl. Express +0.500". Line-discount control (permission-gated), with prevention, not clamping. Expandable line breakdown (gross, discounts, net, tax). Totals from the quote. | Rule #15: when the speed change re-prices the cart, an inline note lists the changed lines. Disabled controls explain why. |
| **Edit Order** | Same line controls; the speed change re-prices through the calculator; Review disclosure via Reusable View P1B-11. | |
| Order detail, full page, items list, pieces, workflow item list, preparation form | Read line columns (`line_total_amount`, breakdown). Built on the Reusable View items section; its line contract (D30) is sourced from §6.1. | |
| Receipt print, invoices/receipts tabs | Line net and tax per the order's tax mode. | |
| Tax-document print | Item table from `org_tax_doc_items_dtl`. | |
| Public tracking / customer portal | Customer-safe line totals. | |
| Reports | Tax summary by category from header buckets; existing order and invoice reports read the new header facts. | |

Navigation (dual-write): Speed Pricing under Catalog, in `config/navigation.ts` + `sys_components_cd` migration. Permissions: P0-05 decides between new `speed_pricing:read` / `speed_pricing:manage` and reusing existing catalog codes. If new, they get a migration plus role grants via `/update-rbac-role`. Access contract golden path, then a platform-inventory refresh.

### 11.2 HQ

**Tenants › Order Fin Settings › Tax & Pricing:** a new **Commercial calculation** card:
- **Commercial level:** `PIECE` disabled with an explanation until P9.
- **Order discount allocation.**
- **Allocation basis:** read-only.
- An inline note: "Changes apply to new orders only."
- EN/AR, `useMessage()`.

The existing selects stay.

## 12. Migrations (one per concern; stop and wait after each; sequence re-checked before writing)

| # | File | Content |
|---|---|---|
| M1 | `0638_sys_service_speed_tax_cat.sql` | `sys_service_speed_cd`, `sys_tax_category_cd`, seeds |
| M2 | `0639_org_speed_price_rules_cf.sql` | Rules table, RLS, indexes, constraints, seed from product fields (§12.1) |
| M3 | `0640_commercial_settings.sql` | `org_tenants_mst` settings |
| M4 | `0641_tax_profile_rounding.sql` | Tax profile rounding; product `tax_category_code` backfill; `price_type` fix |
| M5 | `0642_line_money_items_pieces.sql` | §6.1 (nullable) |
| M6 | `0643_line_money_prefs_disc_chg.sql` | §6.2–§6.5, header snapshots |
| M7 | `0644_tax_doc_items_dtl.sql` | §6.7 |
| M8 | `0645_speed_pricing_permissions.sql` | Only if P0-05 needs new codes; role grants included or separate per `/update-rbac-role` |
| M9 | `0646_speed_pricing_navigation.sql` | `sys_components_cd` |
| M10 | later (after P10-02) | NOT NULL + CHECK (I5, code values) on §6.1–§6.5 |
| M11 | later (after P10) | Drop product `default_express_sell_price`, `multiplier_express`, `turnaround_hh_express`, `is_tax_exempt` (`RESTRICT`) |

After each applied migration: `npm run prisma:pull`, then update constants and types (DB-mirror). After M3: regenerate HQ types.

### 12.1 Seed values (L17)

| Mig | Target | Seed | Equals today because |
|---|---|---|---|
| M1 | speeds / categories | `STANDARD` (default), `EXPRESS`; 4 categories | `EXPRESS` is the only header value |
| M2 | speed rules | One product-level `EXPRESS` rule per product with any express field:<br>• `default_express_sell_price > 0` → `SELL_PRICE`, `default_speed_sell_price` = that price (95 products)<br>• otherwise → `MULTIPLIER`, `multiplier_speed` = `multiplier_express − 1`, null → 0 (the other 32 products hold 1.00 or null, so 0)<br>• `turnaround_hh_speed` = `turnaround_hh_express` in both cases | **Prices:** today express = express price, else normal price. A `SELL_PRICE` rule gives the same price; a `MULTIPLIER` 0 rule gives normal + 0.<br>**Conversion:** stored multipliers are written as factors (1.00, 1.36, 1.50, 1.80, 2.00; express/normal = 2.000 on the 2.00 products), so `− 1` turns them into L20's added fraction (1.50 → 0.50, i.e. +50%). |
| M3 | tenants | `ITEM`, `DOCUMENT_LEVEL`, `PROPORTIONAL_NET` | Items priced; discounts and tax at order level |
| M4 | tax profiles | `DOCUMENT`, `HALF_UP`, decimals/increment NULL | One rounding per tax line on the order base, at currency decimals |
| M4 | products | `tax_category_code = STANDARD` (no exempt products); `per_piece` → `PER_PC` | `is_tax_exempt` 0/null on all 127 |
| M5 | existing items/pieces | `PRICED`/`ALLOCATED`, order speed, recorded tax mode | Order's own facts; amounts come from the P10-02 recompute |
| M6 | existing prefs/discounts/header | ORDER prefs → `SEPARATE_CHARGE`, else `INCLUDED_IN_ITEM_PRICE`; discounts `ORDER`/`DOCUMENT_LEVEL`; header `ITEM`/`DOCUMENT_LEVEL`/recorded modes/`commercial_calc_version = 1` | The rules that run today |

**Proof:** P1-01 runs before and after every migration and code step. Any difference stops the work for owner review.

## 14. Phases and tasks

Legend: (S) STATUS.md, (D) docs, (Q) QA guide. Skills are loaded before each task's first line (`/database`, `/multitenancy`, `/backend`, `/frontend`, `/i18n`, `/navigation`, `/rebuild-ui-access-contract`, `/update-rbac-role`, `/code-documentation`, `/testing`).

### Phase 0 — Discovery and ADR (no code)
| ID | Task |
|---|---|
| P0-01 | Inventory every money calculator (`order-calculation`, `pricing`, `pricing-calculator`, `lib/db/orders.ts`, Order Edit calculation/apply/structural/commercial-write, rollup, `order-preference-charge-recalc`, `order-charge.service`). |
| P0-02 | Reader inventory of item/piece money, express fields and the `EXPRESS` charge type, completing §10/§11 (26 express files are listed already). |
| P0-03 | Whether `total_price` includes `service_pref_charge`, and whether `lib/db/orders.ts` is a live Create path and whether its `total_price` includes tax. |
| P0-04 | Settings pattern confirmed against `docs/dev/rules/integration-contracts.md` (tenant columns written by HQ). |
| P0-05 | Permission codes for Speed Pricing (new vs existing catalog codes) and the access-contract route. |
| P0-06 | **ADR-060**: line money, `money_basis`, commercial level, layers (§4), allocation/rounding, calculator version, fiscal item lines. Shared with Reusable View P0-06. (S)(D) |
| P0-07 | Express price when a standard price-list price exists. |
| P0-08 | The New Order cart's current totals call (the call that will be moved to the quote service). |
| P0-09 | Gift-card path: confirm it never acts as a discount in the calculation. |
| P0-10 | Today's tax-profile selection (`applies_to`) and exemption logic, mapped exactly to the per-line rules (§8.2); `tax_exempt_reason` codes. |
| P0-11 | Report readers that need the new indexes. |
| P0-12 | Required fiscal item fields per target country (OM/SA). |
| P0-13 | Existing discount limit/threshold rules for line discounts. |

### Phase 1 — Freeze Create (owns Reusable View P1B-01)
| ID | Task |
|---|---|
| P1-01 | Characterization tests on today's Create: every Reusable View P1B-01 case plus express with/without express price, a standard price list under express, piece preferences, ORDER preference, FIXED product, customer exemption, a 3-decimal (OMR) and a 2-decimal (SAR) currency. Float→decimal differences are listed for sign-off. (S) |

### Phase 2 — Configuration DB (M1–M4)
| ID | Task |
|---|---|
| P2-01…04 | One migration at a time; stop and wait; Prisma pull; constants in `lib/constants/` (`SERVICE_SPEEDS`, `TAX_CATEGORIES`, `COMMERCIAL_LEVELS`, `DISC_ALLOC_MODES`, `MONEY_BASIS`, `PRICE_SOURCES`, `SPEED_PREMIUM_TYPES`, `TAX_ROUNDING_LEVELS`) and types in `lib/types/`. (S) |

### Phase 3 — Line-money DB (M5–M7)
| ID | Task |
|---|---|
| P3-01…03 | Same procedure. (S) |

### Phase 4 — Domain calculator (owns and extends Reusable View P1B-03)
| ID | Task |
|---|---|
| P4-01 | `lib/commercial/` primitives: decimal money, the 7 rounding modes + increment, largest-remainder allocation. Property tests. |
| P4-02 | Speed resolver (pure) + standard price resolution contract. |
| P4-03 | Modifiers (speed, preferences by mode), line and document adjustments, gift-card exclusion. |
| P4-04 | Tax per line (profile, category, exemption, inclusive extraction, LINE/DOCUMENT rounding). |
| P4-05 | Levels, `money_basis`, fallback, ready-by. |
| P4-06 | Invariant checker (I1–I6); golden and property suites; ESLint boundary rule. (S)(D) |

### Phase 5 — Services and Create
| ID | Task |
|---|---|
| P5-01 | Context loader + writer + quote service (§4.1); unit tests with the Prisma mock; tenant filter on every query. |
| P5-02 | Create submit writes all §6 columns in one transaction; both ready-by services use the resolver; the rollup reads lines (I3); `EXPRESS` charge writes stop; the level rule in `order-charge-money.ts` is retired; the preference-mode resolver is wired in; `commercial_calc_version` is written. |
| P5-03 | New Order UI (§11.1), including the quote-driven cart, the line-discount control and the speed note; custom item. (S)(Q) |

### Phase 6 — Order Edit V2 write parity (same release as P5)
| ID | Task |
|---|---|
| P6-01 | Every Edit write path persists calculator output for touched rows, from the order's snapshots. An ALLOCATED piece set is re-allocated when its item changes. |
| P6-02 | Edit UI line controls (§11.1). **Boundary:** discount re-evaluation, recorded-instruction loader, preview/quote wiring and the Review disclosure stay in Reusable View P1B-04…12, on this calculator. (S)(D)(Q) |

### Phase 7 — Configuration UI and HQ
| ID | Task |
|---|---|
| P7-01 | Speed Pricing screen + APIs + resolver panel; navigation dual-write (M9); permissions (M8) + role grants; access contract golden path; inventories refresh. |
| P7-02 | **HQ:** Tax & Pricing card + `platform-api` DTO/service + types (§10.2, §11.2); branch edit page overrides section + branches DTO/service (§10.3); HQ lint/typecheck/build/i18n; update HQ `docs/features/Order_Fin/progress_status.md`. |
| P7-05 | **Tenant app single-writer (L18):** server rejection in `tenants/me` and `branches/[id]`, read-only selects in both settings screens, EN/AR note, tests for `403 FIELD_MANAGED_BY_HQ`. Ships in the same release as P7-02, so there is never a window with no writer. |
| P7-03 | Tax settings rounding fields + API/action + Zod. |
| P7-04 | Product form / services pages / add-item modal / import-export / bulk pricing (§7, §11.1). (S)(Q) |

### Phase 8 — Readers and fiscal lines
| ID | Task |
|---|---|
| P8-01 | Order reads, receipt, public tracking/portal, dashboard, workflow/preparation views, prints, reports and the header category buckets (§10.1, §11.1). |
| P8-02 | Tax-document issuance writes `org_tax_doc_items_dtl`; read service and print show the item table. (S)(D)(Q) |

### Phase 9 — PIECE level enablement (L11)
| ID | Task |
|---|---|
| P9-01 | Per-piece line discount and speed override in Create and Edit (piece preferences exist already). |
| P9-02 | Enable `PIECE` in the HQ card and the `platform-api` DTO; QA at PIECE level, including the FIXED fallback. (S)(Q) |

### Phase 10 — Recompute, tighten, clean up
| ID | Task |
|---|---|
| P10-01 | Remove `order-preference-charge-recalc` if it is made obsolete, after confirming nothing calls it. |
| P10-02 | Idempotent recompute command for existing (demo) orders through the calculator, run per tenant with a dry-run report first (pre-launch, no compatibility code). |
| P10-03 | M10 (NOT NULL + CHECK), then M11 (drop retired product columns). (S) |

### Phase 11 — Verification and docs
| ID | Task |
|---|---|
| P11-01 | Tenant app: `npx eslint . --quiet`, `tsc`, targeted jest, DB-integration (local harness), `npm run build`, `npm run check:i18n`, `npm run check:platform-info-inventories`. HQ: lint, typecheck, build, i18n check. |
| P11-02 | QA guide (sidebar path + URL + clicks) for each §15 scenario. |
| P11-03 | `/documentation`: feature pack (permissions, navigation, settings, i18n keys, APIs, migrations, constants, env vars: none), the Order Fin rules file pointer, and Reusable View cross-links. (S)(D)(Q) |

## 15. Test matrix

| Layer | Cases |
|---|---|
| Domain unit / property | Allocation exactness (random n, amounts, 2/3 decimals); 7 rounding modes + increments; I1–I6 for random orders; resolver precedence (6 levels, effective dates, inactive); SELL_PRICE / MULTIPLIER (L20: 10 × 0.30 + 10 = 13) / FIXED_AMOUNT per unit and per line; seed conversion (factor − 1); inclusive extraction; DOCUMENT vs LINE rounding; gift card rejected as an adjustment; discount > gross rejected. |
| Characterization | P1-01 identical before and after (except signed-off float fixes). |
| Service | Loader tenant filters; writer maps every column; quote = create for the same input. |
| DB-integration | RLS isolation on speed rules and fiscal items; FK RESTRICT on a rule in use; M10 CHECKs; Create + Edit + recompute keep I1–I6; snapshot unchanged after a settings change. |
| API | Zod rejects invalid codes; `RULE_IN_USE`; `LINE_DISCOUNT_EXCEEDS_GROSS`; `PRICE_CHANGED`; HQ DTO rejects `PIECE` before P9. |
| UI / QA | Express premium note; speed change disclosure; line discount prevention; resolver panel; HQ card; rounding example; tax-document item table; EN/AR + RTL. |
| Performance | Create and quote with 200 pieces: allocation O(n), one write batch per table. |

## 16. Gap audit (v1.2 → v2)

| # | Gap in v1.2 | Closed by |
|---|---|---|
| G1 | No module boundaries; the calculator could leak I/O | §4.1 layers + ESLint boundary |
| G2 | Calculator vocabulary was laundry-specific | §4.2 |
| G3 | Float `toFixed` arithmetic | §4.3 decimal + sign-off |
| G4 | No record of which rules wrote an order | `commercial_calc_version` |
| G5 | No DB integrity beyond types | FKs, CHECKs, M10 NOT NULL |
| G6 | Turnaround moved to rules, but ready-by was not addressed | §5.4 `ready_by_at` + both services |
| G7 | Per-line tax profile, exemption and reason codes undefined | §8.2, P0-10 |
| G8 | Gift card listed as a discount source | §6.4 rule, P0-09 |
| G9 | Line discounts had columns but no UI, permission or limits | §8.3, §11.1, P0-13 |
| G10 | Tax documents have no item lines, so line tax had no fiscal consumer | §6.7, P8-02 |
| G11 | Public booking API, custom-item modal, catalog import and bulk pricing were missing | §7, §10.1, P7-04 |
| G12 | Cart could compute money client-side | Quote service (§4.1, §10.1) |
| G13 | Speed rules had no audit, no in-use protection and no "which rule wins" UX | §6.6, §11.1 |
| G14 | Tax profile screen was assumed to be in HQ | Tenant app (§3, P7-03) |
| G15 | No test matrix, performance or observability | §15, §17 |
| G16 | Reusable View line contract (D30) not tied to the columns | §11.1 |
| G17 | No rollback or release order | §17 |

## 17. Releases, rollout and observability

| Release | Contains | Customer-visible change |
|---|---|---|
| A — Foundation | P0–P8, P10-01/02 | None (L17 seeds). New screens are available; behaviour changes only when a rule or setting changes. |
| B — Piece level | P9 | `PIECE` option in HQ |
| C — Tighten | P10-03 (M10, M11) | None |

- **Deploy order:** additive migrations first (old code ignores new nullable columns), then code, then recompute, then tighten.
- **Rollback:** before M10/M11, code can be rolled back with no data loss; new columns are ignored. M10/M11 are applied only after Release A has been stable.
- **Observability:**
  - structured log on `COMMERCIAL_INVARIANT_FAILED` (order, tenant, version, invariant)
  - reconciliation warning codes for leftover `EXPRESS` charges and I3 mismatches
  - the recompute dry-run report

## 18. Risks

| Risk | Mitigation |
|---|---|
| Create and Edit write different values | One writer; P5 and P6 in one release; invariant guard before write. |
| Silent figure changes | P1-01 runs first; seeds per L17; signed-off differences disclosed (rule #15). |
| Rounding drift | Decimal + one allocation function + property tests. |
| Settings change rewrites old orders | Order snapshots; Edit never re-resolves them. |
| A rule edit changes old orders | Lines store amounts + rule id; rules in use cannot be deleted. |
| Express double count | `EXPRESS` charges stop; reconciliation flags them. |
| Scope overlap with Reusable View | Ownership in §14 (P1, P4, P6-02); pointer in that plan. |

## 19. Definition of done

- Every new order stores the §6 facts at both levels; I1–I6 hold; Create, Edit, tax documents, prints, portal and reports read them.
- Speed rules, discount allocation, tax rounding and commercial level are configurable in the right app (tenant app or HQ), EN/AR, with full CRUD.
- The unused preference-mode setting is wired in; the hard-coded level rule, the `EXPRESS` charge path and the product express fields are gone.
- All P11-01 gates are green in both repos; the QA guide, ADR-060 and the feature docs are updated.

## 20. Open items for owner

**Resolved 2026-10-23 as recommended** (the owner continued after the recommendations; can still be overridden). Two items were raised by Phase 0 ([PHASE0_FINDINGS.md](PHASE0_FINDINGS.md) §6):

1. **Q1:** seed product express turnaround into the speed rules (changes ready-by for about 120 products; recommended), or seed it only where it equals today's category value.
2. **Q2:** accept that the bug fixes PF-03, PF-04 and PF-08 change figures toward the correct value (recommended, disclosed in the P1-01 sign-off).

## 21. Phase 0 outcome (2026-10-23): changes to this plan

Phase 0 is done: [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md) and [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md). These changes apply on top of §1–§19 and win on conflict.

| # | Change | Affects |
|---|---|---|
| C1 | **Hotfix step 2b, before P1:** PF-01 (enforce `pricing:override` on Create and preview-payment, and write the override audit fields) and PF-04 (an exempt order must not fall back to tenant VAT). Both get regression tests. | Execution order |
| C2 | The server is the only price authority (ADR-060 §2). Create stops storing client prices; P5-01 resolves every line on the server. | P5 |
| C3 | Price-list `discount_percent` becomes a **line discount** with source `PRICE_LIST`, applied once. `get_product_price` is replaced by a resolver that returns list price and discount separately. M6 adds `PRICE_LIST` to the discount source codes (DB-mirror; check any CHECK constraint on `source_type`). | §6.4, §8.3, P4-01, M6 |
| C4 | The speed premium is independent of the customer (b2b/vip) list (PF-08). `service_speed` is the only speed signal; Create sets it; M6 backfills it from `priority = 'express'`; readers of `priority_multiplier` / `priority` for price move in P8 (PF-09). | §7, P5, P8 |
| C5 | Tax: profile selection by **supply code** (ADR-060 §6). Add `org_product_data_mst.tax_supply_code` (nullable; no default). Add `sys_tax_category_cd.uncl5305_code`. Add a new code table `sys_tax_exempt_reason_cd` (country, code, name/name2) that `tax_exempt_reason` references. All in M1/M4. | §6, §8.2, M1, M4 |
| C6 | Exemption per line; never a VAT fallback (PF-04, PF-05). | P4-04 |
| C7 | Order charges: Release A reproduces today's treatment exactly as pinned by P1-01 (PF-19); explicit charge tax categories come with M6. | §8.5 |
| C8 | Every applied promo (typed or auto) records usage and `promotion_id` (PF-15). | P5 |
| C9 | The **public booking API** prices through the same calculator, and its `total_price` follows the line contract (PF-11). Booking gains speed support behind the same rules. | P5, §10.1 |
| C10 | Ready-by: one resolver used by the Create estimate, the server Create and preparation completion. Today it is category-based with an extra ×0.5 for express (PF-13); target per owner Q1. | §5.4, P5 |
| C11 | Piece money: one allocation rule for Create, Edit ADD_PIECE and preferences. Verify and fix the suspected piece-preference replace bug (PF-12) inside P1-01/P4-05. | P4-05 |
| C12 | Quote routes per ADR-060 §9: `POST /api/v1/orders/quote` (draft) and `POST /api/v1/orders/[id]/changes/quote` (edit); `preview-payment` moves onto the quote service. | §10.1, P5-03 |
| C13 | Golden fixtures are **synthetic** (no charges, discounts, refunds, credits or tax documents exist in remote data). | P1-01 |
| C14 | `integration-contracts.md` gets the documented exception for HQ-written `org_tenants_mst` order-finance settings (ADR-060 §8). | P7-02 / P11-03 |
