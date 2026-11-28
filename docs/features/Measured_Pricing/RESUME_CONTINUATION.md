# Measured Pricing — resume here

1. Read [PLAN.md](PLAN.md) (design + owner decisions D1–D14) and [STATUS.md](STATUS.md) (authoritative progress).
2. Core rules: units come from `org_uom_cf` (seeded from `sys_uom_cd`) via `base_uom_code` (never free-text `product_unit`).
   A product is "measured" when its UoM dimension is not COUNT. `org_order_items_dtl.quantity` stays the integer
   piece/bag count; money multiplies the new `billed_qty`. Conversions are open (multiply + divide rate stored, like FX),
   resolved by a bounded two-leg resolver (PLAN §3.4). Numeric columns follow the precision classes in PLAN §3.1.
   Tenant units live in `org_uom_cf`: seeded copies of system units (`is_to_seed`, synced from HQ by trigger, locked fields
   protected) plus custom units; all tenant tables FK to it (PLAN §3.3). COUNT quantities are whole (D11). Minimum and
   `billing_increment` are optional tenant product fields (§3.6a). Work spans cleanmatex, cleanmatexsaas, cmx_mobile_apps.
3. Load skills before writing: `/database` + `/multitenancy` (P1), `/order-fin` (P2–P6), `/frontend` + `/i18n` (P4–P6).
4. Migration number = live last+1 at write time; stop after writing it for owner apply.
5. Migration A = `0813_uom_units_conversions.sql`, `0814_uom_measured_pricing_cols.sql`, `0815_uom_perms_nav.sql`
   (PLAN §3.6b). Until Migration B, bridge triggers map legacy `product_unit` / `PER_PC` writes; P3 code should write
   `base_uom_code` / `PER_UNIT` directly. DB error messages start with a code (`UOM_*`, `MEASURE_*`) for i18n mapping.
6. Order write path (P3): `LineIntent.measure` → `buildCommercialOrderInput` resolves `resolveBilledMeasure` per line (`ResolvedLinePrice.uom`), `lineUomColumns` writes the snapshot, `CheckoutLineRequest.measure` carries what staff typed. Pinned (Edit) lines are count lines until P5.
7. Next step: see STATUS.md "Next".

## P4 progress — 2026-11-24 (later)

Built: Units page + Conversions tab, `CmxUomSelect`, `CmxQuantityMeasureInput`, product form on `base_uom_code` (+ min/step), `uom.json` EN/AR, access contract, nav config. No new migration needed: the menu row `catalog_units` is in 0815 (0820 was drafted by mistake and deleted). Left in P4: New Order cart `pricedQty` sites and the Measure dialog (use `CmxQuantityMeasureInput`; server computes billed qty, UI only previews via `/api/v1/uom/convert`/quote), `/cmx-ui-design-review`. Use `MSYS_NO_PATHCONV=1` when running `npm run check:ui-access-contract -- --route=/...` from Git Bash.

## P4 cart + Measure dialog — 2026-11-24 (later still)

Flow: `new-order-content.tsx` `handleAddItem(product, measured?)` — a product whose `base_uom_code` unit is not COUNT (from `useUomUnits`) opens `MeasureLineDialog` instead of adding; confirm adds the line with `uom` + `measure` (or re-measures a line already in the cart via `state.updateItemMeasure`). The cart row shows `CartMeasureNote` (server `CartQuoteLine.measure` once quoted, typed measure before) with "Change measure". Money: the client only keeps a pre-quote estimate through `pricedQty(item)` (`lib/utils/order-item-helpers.ts`, calls `resolveBilledMeasure`); the cart/summary/payment figures are the server quote. `checkoutLineOf` and `use-order-submission` send `measure` (`measureOf`). Server: `toCartQuote` maps `quote.prices[].uom` to `CartQuoteLine.measure`; `searchProducts` returns `min_billable_qty`/`billing_increment`.
Decisions: Order Edit (`isEditMode`) refuses a measured add or re-measure with `uom.measure.editNotReady` until P5 (`CHANGE_ITEM_MEASURE`). One cart line per product, so a measured product already in the cart is re-measured, not duplicated. The dialog imports components by file (`@ui/primitives/cmx-button`, `@ui/overlays/cmx-dialog`) because the barrels pull a server action into jest. Not done: `CmxKeypadPopover` in the dialog; inventory add/edit modals now on `CmxUomSelect` (send `base_uom_code`); design review + services table done by owner.
Gates: `next build --webpack` exit 0, tsc 0, eslint clean, i18n pass. Next: P5 (Order Edit `CHANGE_ITEM_MEASURE`). Done: unit decimals in the adjust-stock modal and server check; `product_unit` kept in step with `base_uom_code`.
Known: 10 jest suites under `__tests__/features/orders` (payment dialogs, orders-simple-table, summary-panel ergonomics) fail with `Request is not defined` / parse errors via the `@ui/forms` and `@ui/primitives` barrels — the barrel import chain exists at HEAD (not verified against a clean baseline).

## Session handoff — 2026-11-24

**Done:** P1 migrations 0813–0815 and 0817 applied (local + remote), types and Prisma regenerated. P2 library closed. P3 mostly done: UoM service + 8 routes; order write path (measure intent → billed quantity → `uom_*` snapshot + measure columns); checkout and both request schemas accept `measure`; order split, tax-document items (billed quantity, `uom_code`, `uom_unece_code`), catalog, inventory and `/api/v1/products` (POST/PATCH) on `base_uom_code`, `min_billable_qty`, `billing_increment`. Gates: jest (commercial/uom/services/order-split/tax-document) 414 + `uom-http` 4 pass, tsc 0, eslint clean on changed folders.

**In progress / next:** finish P3 (public APIs; DB-integration tests; route tests for the 8 UoM routes are DONE: `__tests__/uom/uom-routes.test.ts`), then P4 (UI: `CmxUomSelect`, `CmxQuantityMeasureInput`, `/dashboard/catalog/units`, product form, cart `pricedQty` sites, Measure dialog, i18n `uom.errors.*`, access contract + nav check).

**Decisions made this session:** AMOUNT stays `(19,4)` (doc corrected). Tenant writes to units/conversions go through the admin client with explicit `tenant_org_id` (tenants have SELECT only). A measured line with no measure refuses the quote, so the commit (`MEASURE_REQUIRED`). Pinned (Edit) lines are count lines until P5. A sub-order from a split copies the unit snapshot, no measure (money stays on the parent).

**Open questions:** (1) Edit `ADD_ITEM` of a measured product needs the measure in P5 (today the DB trigger fills the unit only). (2) `PER_PC` literals remain in older tests. (3) Dead `requires_item_count`. (4) The `pglast` wheel sits in `supabase/migrations/`. (5) No e-invoice (UBL) builder exists yet; tax print detail carries the unit code for it.

**Uncommitted:** everything above is uncommitted (git status shows about 108 changed files in the repo, including unrelated parallel work: Background_Jobs, cmx-workers, preferences). Measured Pricing files: migrations 0813, 0814, 0815, 0817; `web-admin/lib/{uom,commercial,services,api,validations,types,constants}`, `app/api/v1/{uom,products}`, tests under `__tests__/{uom,commercial,services/commercial}`; the three docs here. HQ and mobile repos: untouched so far.

**Migrations to apply:** none. 0813–0815 and 0817 are applied. The next migration number must be taken at write time (live last+1). P9 (Migration B, dropping legacy `product_unit` bridge) is later and needs your review.

## P5 — Order Edit measure (design, 2026-11-24)
Migration `0821_oc_change_item_measure.sql` written, NOT applied (owner applies; then HQ adds a policy rule for `CHANGE_ITEM_MEASURE`/ITEM and /PIECE in a new draft of each Edit policy, as 0637/0662 did).
Code plan (after 0821 is applied):
1. `lib/constants/order-change.ts`: add `CHANGE_ITEM_MEASURE`; `order-change-priced-ops.ts`: add to `ORDER_CHANGE_PRICED_CODES`.
2. `order-change.schemas.ts`: `measure` ({measuredQty,length,width} decimal text) on the `ADD_ITEM` payload (refine: not with `customItem`); new op `CHANGE_ITEM_MEASURE` (persisted item target, payload `{measure}`).
3. `commercial-edit.loader.ts`: `readEditOrderRecord` selects `uom_code, measured_qty, measure_length, measure_width, billed_qty, min_billable_qty, billing_increment`; `EditStoredItem` carries them; `pinned.product` gets `baseUomCode` (stored `uom_code`, else PC), `minBillableQty`, `billingIncrement` from the stored snapshot; `LineIntent.measure` = projected measure ?? stored measure; `storedSpeed` splits the premium on billed qty, not on `quantity`. `EditProjectedLine.measure`.
4. `order-change-edit-pricing.ts` `editProjectionOf`: `measureChangesOf(operations)` (CHANGE_ITEM_MEASURE by item id; ADD_ITEM payload measure).
5. Apply (`order-change-apply.service.ts`, `order-change-structural-write.ts`): write `measured_qty/measure_length/measure_width/billed_qty` (+ unit snapshot for ADD_ITEM via `lineUomColumns`), same target checks as `CHANGE_ITEM_QUANTITY` (lines 520/555/681). Review fingerprint already covers the money; add measure to the review diff text.
6. Capability + i18n: `orders/edit.json` + `orders/detail.json` op labels (EN/AR), `change-builder.ts` builder `changeItemMeasure`, Edit UI: `new-order-content.tsx` allows measured add/re-measure in Edit (drop `uom.measure.editNotReady`), `use-new-order-state.updateItemMeasure` emits the op.
7. Tests: schema, edit-pricing projection, loader (pinned measured line re-priced, tier/increment/minimum), apply writes, DB-integration parity.
Known limit: a stored measured line keeps its agreed unit price (L24), so a re-measure across a price-tier boundary does not re-tier; document in QA.
**Decision (owner, 2026-11-24): a measure is a LINE fact, like the line price (`CHANGE_ITEM_PRICE` is ITEM-only).** `CHANGE_ITEM_MEASURE` is built for ITEM only; the request schema accepts no piece target, so nothing can be sent for a piece. 0821 (already applied) also registered a PIECE pair in the catalog; it has no writer and no meaning, so HQ must not write a policy rule for it. If a clean-up is wanted, a later migration can set that pair `is_active=false` (do not edit 0821).

**P5 DONE in code (2026-11-24).** 0821 applied. What exists: see STATUS row P5. Files: `order-change-edit-pricing.ts` (`measureChangesOf`), `commercial-edit.loader.ts` (stored unit/measure/min/step, `EditProjectedLine.measure`), `commercial-edit.writer.ts` (measure columns only on stored lines), `order-change-preview.service.ts` (NO_CHANGE for equal measure), `order-change-review-audit.ts`, `order-change-context.service.ts` + `OrderChangeContext` item unit fields, `edit-workspace-adapter.ts`, `edit-order-controller.ts` (`setLineMeasure`), `change-builder.ts`, `use-new-order-state.ts` (`blocked('CHANGE_ITEM_MEASURE','ITEM')`). Real-DB proof: `order-change-edit-parity.db.test.ts` step 12b. Next: P6 (display: order detail, receipts, invoices, Order Fin View line rows, public tracking, booking route via `product_unit`). Open: PIECE pair has no writer; HQ policy rule; no re-tier on re-measure.

## Shared line qualifier with Order Cart Line Grouping (agreed 2026-11-25)

- P6 and `docs/features/Order_Cart_Line_Grouping/` DESIGN §8.1 both add a per-line label on order detail, prints, tracking, booking and the money view. Use ONE helper: `web-admin/lib/orders/line-qualifier.ts`, returning `{ measure?, speedCode?, ordinal? }` per line id. Whoever lands first creates it, the other extends it. The measure is rendered only from this helper, so it is never shown twice. (Not created yet, checked 2026-11-25.)
- Edit merge into a saved measured line (quantity + add piece + measure on one line) is proven: `order-change-edit-parity.db.test.ts` step 12b, merge case. The "one per line" rule (schema) only stops two ops of the same code on one line (price, discount, measure), so `CHANGE_ITEM_QUANTITY` + `ADD_PIECE` + `CHANGE_ITEM_MEASURE` together are accepted. The projection treats measure as a non-structural op. Existing rule to respect: a saved line WITHOUT piece rows takes `CHANGE_ITEM_QUANTITY` alone; adding `ADD_PIECE` there fails with `QUANTITY_DOUBLE_COUNT`. The cart must send `ADD_PIECE` only for lines that have saved pieces (change-builder emits it per local piece). No change needed in my code for §4.5.

## Owned for Order Cart Line Grouping (owner agreed 2026-11-25; DESIGN §0 there)

1. **Free-garment fix (P4 fix): DONE in code 2026-11-25.** A piece-count change on a measured line (card +/-, step 2 +/-, Add piece, pieces manager, Edit quantity/add/remove piece) is held in `state.measureRecheck`; the Measure dialog opens in re-measure mode ("Pieces changed from X to Y. Check the total measure."); Confirm applies the count and the staff-entered total (keeping the total is allowed and explicit); Cancel drops the change; code never changes the measure by itself; removing the line is not held; Edit: a changed total needs the `CHANGE_ITEM_MEASURE` policy cell (else "keep the total" only). Files: `new-order-types.ts` (`measureRecheck`, 2 actions), `new-order-reducer.ts`, `use-new-order-state.ts` (`holdForMeasure`, `confirmMeasureRecheck`, `cancelMeasureRecheck`; `updateItemQuantity/updateItemPieces` now return a boolean), `measure-line-dialog.tsx` (`notice`, `refusal`), `new-order-content.tsx` (second dialog + follow-ups), `uom.json` EN/AR (`measure.recheckNotice`, `recheckBlocked`), test `__tests__/features/orders/measure-recheck.test.tsx` (8). tsc, eslint, check:i18n, check:ui clean. Cart Line Grouping P1 must carry `productId` -> `lineKey` through `MeasureRecheck.productId` and the 3 hook methods.
2. **Line qualifier (P6 / P8):** `lib/orders/line-qualifier.ts` = `orderLineQualifiers(lines, orderSpeed)` -> per line id `{ measure?, speedCode? (only when it differs from the order speed), ordinal? (only when a product has 2+ lines with identical parts) }`, structured, not text; used by receipts, prints, money view, tracking, customer app (Line Grouping DESIGN §8.1 has the surfaces). Not started. Hold: do not edit `new-order-reducer.ts`, `use-new-order-state.ts`, `new-order-content.tsx`, `edit-workspace-adapter.ts` or the measure dialog while Line Grouping P1 runs; they will say when P1 is done.

## P6 - display and public: DONE in code (web), 2026-11-25

**Helper:** `lib/orders/line-qualifier.ts` (`orderLineQualifiers(lines, orderSpeed, speedNames?)` -> per line id `{ measure?, speedCode?, speedName?, ordinal? }`; `qualifierInputOfRow` maps a stored item row), `line-qualifier-format.ts` (`formatLineQualifier`, text "2.5 m² · Express (1)", EN/AR symbol and speed name), `line-qualifier-speed.ts` (`loadSpeedNames`, catalog read). 10 tests. Rules: measure always for a measured unit; speed only when it differs from the order's; ordinal only when a product has 2+ lines whose measure and speed are identical (numeric compare, 2.5 = 2.500000). Cart Line Grouping consumes it.
**Surfaces done:** money view (`items.source` + `normalize.ts` -> `OrderFinLine.qualifier`, added to `orderFinLineSchema` and the public allowlist `publicLine` + schema, classified `public` in `public-projection.test.ts`; statement shows `name · qualifier`); public tracking (`public-order-tracking.service.ts` -> `PublicOrderItem.qualifier`, page renders it; the customer-app order API reuses this service, so it already returns `qualifier`); text and HTML receipts (`receipt-service.ts`); order state API (`app/api/v1/orders/[id]/state`, feeds Ready detail and both prints: `order-receipt-print.tsx`, `order-details-print.tsx` via `ReadyOrderItem.qualifier`); staff order detail (`lib/db/orders.ts` adds `line_qualifier`, `order-items-list.tsx` shows it).
**Fix found on the way:** the order state API listed lines removed by an Edit (rec_status 0); it now lists live lines only (`.eq('rec_status', 1)`).
**Booking route:** a customer cannot send a measure, so a measured product would fail the quote. The catalog hides products whose `base_uom_code` is a measured unit (dimension not COUNT) and submit refuses them with `booking_item_needs_measure` (test added). The route still sends the legacy `unit` text (bridge) for display; the unit migration of the customer app is P8/P9. OWNER DECISION to confirm: hide measured products from the app (current) or later show them as "priced at intake".
**Not done / follow-ups:** tax documents and invoices (not in the Line Grouping surface list; they already carry billed qty and `uom_code`); Flutter customer app rendering of `qualifier` and the booking `unit` (P8); money view draft/Edit sources have no qualifier. Gates: tsc clean, eslint clean on changed files, `check:ui` 0 errors, jest (line-qualifier 10, normalize, public projection, tracking, receipts, booking 7, order-state), DB-integration `order-fin-view-sources` passes. Known unrelated failure: `order-financial-view.ui.test.tsx` "Missing message: common.close" (cmx-dialog, another session's change).

## P7 - HQ (`cleanmatexsaas`): done in code 2026-11-27 (0848, 0849, 0850 applied)

- **P7a Units & Conversions API:** module `platform-api/src/modules/uom-config` (registry `units` / `conversions` on the code-table engine; permissions `uom_config:view` / `uom_config:manage` from 0815). Rules: COUNT = 0 decimals; base unit seeded and not packaging; conversion = two different units of one dimension, never packaging; HQ types `multiply_rate`, server derives `divide_rate`; rate pairs the CHECK would refuse are refused first; a unit that active templates are priced in cannot be switched off. Engine gained `decimals` (rates, 12 places, refused not rounded) and `dbErrors` (database `TAG: message` -> field).
- **P7b Product setup:** templates registry `price_type` FIXED / PER_UNIT, `base_uom_code` (required, ref `sys_uom_cd`) **mirrored into `product_unit`** because `initialize_tenant_product_catalog` / `reseed_missing_products` still copy only `product_unit` (verified on remote 2026-11-27; without the mirror a KG template would seed PC). `requires_weight` / `requires_dimensions` removed from the form (ignored in old bulk files). Bulk: `base_uom_code` wins over `product_unit`; organization products accept `min_billable_qty`, `billing_increment`. Tenant-product edit takes `base_uom_code`; comparison compares it.
- **P7c HQ web:** `/uom-config` hub + units / conversions list and form (shared code-table screens), `lib/api/uom-config.ts`, sidebar + breadcrumbs + icon map, EN/AR `uomConfig.json`, bilingual field errors, per-module "who uses it" sentence, product setup wording and organization product list show the unit code.
- **Migration 0848 `hq_nav_uom_config`** (HQ menu rows): applied (verified on remote 2026-11-27).
- **P7d done in code 2026-11-27:**
  - Tenant maintenance step **Sync units** (HQ organization > Maintenance > Branches & Catalog): `GET check-units` (`uom_config:view`) lists missing seeded units and conversions; `POST fix-units-sync` (`uom_config:manage`) runs `fn_uom_seed_tenant`, writes `hq_audit_logs` (`tenant_units.sync`). Panel `units-sync-panel.tsx`, EN/AR. Jest `units-sync.spec.ts`.
  - Migration **0849 `setup_health_measured_price`** (applied local + remote 2026-11-27; remote run: no ERROR rows): check `MEASURED_PRODUCT_NO_PRICE` (domain CATALOG, WARNING): active measured product with no default price above zero and no active, in-date Standard price-list row above zero. NA without measured products. Its query was run read-only on remote 2026-11-27: 2 measured products, 0 unpriced.
  - **Three planned checks dropped** because the database already blocks the state: product on an inactive unit (`trg_ouom_in_use`, `trg_prod_uom_2_rules`), custom physical unit without a base conversion (`trg_ouom_base_conv`, `trg_ouomc_base_conv`), template on an inactive unit (HQ refuses to switch the unit off; remote has 0). Known gap: restoring a soft-deleted product does not re-check that its unit is still active.
  - Count products without a price are not in this check (remote 2026-11-27: 18 products have no price, none of them measured).
  - Gates: HQ jest 51/51 (tenant-maintenance, uom-config, HQ-only controllers), eslint 0 errors, `check:i18n`, platform-web typecheck; platform-api typecheck only the older `general-config` spec error. Not run: platform-web build, browser QA, 0849 itself.
- **P7e done in code 2026-11-27 (HQ phase complete in code):**
  - Review fixes: (1) switching a unit off in the HQ **edit form** skipped the in-use guard (only Deactivate had it) - now both; (2) nothing refused putting an active template on a switched-off unit - migration **0850 `uom_template_active_unit`** (applied local + remote 2026-11-27): insert, unit change and reactivation raise `UOM_INACTIVE`, shown on the unit field. This corrects the P7d note: the template check was dropped on a guard that was incomplete until (1) and 0850; (3) `template_code` is NOT NULL in the database but optional in the HQ form and bulk file - now required.
  - Bulk: every live column of templates and organization products round-trips through export / import (checked on remote 2026-11-27). An export without rows now lists unit and price columns.
  - HQ organization products show **Minimum billable** and **Billing step** (read-only, when set).
  - Gates: HQ jest (uom, products-items, tenant-maintenance, code tables) 125 tests, one stale fixture fixed and its two suites rerun 20/20, platform-web jest 21/21, tsc (platform-api: only the older `general-config` spec error), eslint, `check:i18n`. Not run: platform-web build, browser QA, 0850 itself.
- **Gates:** platform-api tsc (only the older `general-config` spec error, from another change), jest 142/142 (uom, products-items, file-util), eslint 0 errors; platform-web typecheck, eslint, `check:i18n`, code-table jest. Not run: platform-web build, browser QA.

## P9 - legacy unit columns removed 2026-11-27 (0852 + 0853 applied)

**Apply order (both databases):** 1) `0852_uom_seed_from_base_unit.sql` 2) run the new HQ and tenant code 3) `0853_uom_drop_legacy_unit_cols.sql` 4) regenerate database types in both repositories (`npm run prisma:pull` too).

- **0852** (safe with old and new code): `initialize_tenant_product_catalog` and `reseed_missing_products` copy `base_uom_code` (they copied only `product_unit`); column defaults `base_uom_code = 'PC'`, `price_type = 'PER_UNIT'` replace what the bridge trigger did for an omitted column. Function bodies generated from 0700, whose checksum matched both databases.
- **0853** (destructive): drops `product_unit` (templates, organization products), `requires_weight`, `requires_dimensions`, both bridge triggers, `fn_uom_prod_legacy_bridge`, `fn_uom_legacy_code`; stops if 0852 is missing. Checked on local and remote: every `product_unit` maps to the row's `base_uom_code`, flags all false.
- **Tenant code:** no read or write of the legacy columns (catalog and inventory services, products API now requires `base_uom_code`, booking catalog sends `unit = per_piece` because measured products are hidden, two list screens, two inventory dialogs, types, `schema.prisma`, `scripts/db/check-products.js`). Fixed on the way: the product CSV export wrote unit codes such as `PC` that its own import refused. `lib/uom/legacy.ts` stays only to read the CSV `unit` column.
- **HQ code:** no mirrors; template price type required; bulk files send piece / per unit for a blank unit or price type, ignore the retired columns, and refuse a file whose only unit column is `product_unit`; removed a dependency entry for the non-existent `sys_product_unit_cd`.
- Gates: tenant tsc 0, eslint (changed files), `check:ui` 0/0, jest catalog / inventory / booking / unit 154/154, DB parity test pass, `npm run build` exit 0; HQ jest 126/126, eslint, tsc only the older `general-config` spec error. Not run: 0852 / 0853, browser QA.

## P8 - customer mobile app: done 2026-11-27 (order detail; booking keeps measured products hidden)

- Order detail shows each line's qualifier from the server (measure, own speed, ordinal) and **Billed: {qty}** when a minimum or billing step changed the quantity; Arabic unit symbol, speed and product name (`name2`). New `OrderLineQualifierModel` (`mobile_domain`), `CustomerOrderItemRowVw`, l10n `orders.line.billed` EN/AR.
- Fixed on the way: the app showed `totalPrice` for a line; it now shows `lineTotalAmount` (what the customer pays, as the web tracking page does) and falls back to `totalPrice`.
- No price per unit: the customer order API does not send one (the web tracking page shows none either).
- **Owner decision 2026-11-27: measured products stay hidden in booking** (the server hides and refuses them; staff create those orders). "Book now, price at intake" is not planned.
- Gates: `flutter analyze` clean (mobile_domain, mobile_services, mobile_l10n, customer_app); services tests 3/3; order tests pass incl. 4 new; full customer_app run 24 pass, 1 fail (`customer_login_entry_screen_test`, outside this change; one failure in the run before the change too). Not run: device or emulator QA.

## After 0852 / 0853, custom units and P10 (2026-11-27)

- **0852 and 0853 applied** local and remote (owner); database types and Prisma regenerated. Verified read-only on both: no legacy column, function, trigger or reference left; both seeders copy `base_uom_code`; column defaults present; Setup Health no ERROR rows.
- Local DB tests: `uom-rules` 8/8 (new: seeding copies a KG template, an omitted unit is a piece, custom unit rules); `order-change-edit-parity` passes after its customer fixture got `customer_code`.
- **Bug fixed (from P4):** a custom measured unit could never be created: the screen inserted the unit alone, and the database requires its base conversion at commit. The dialog now asks for the size of one unit in the base unit; `createCustomUnit` writes unit and conversion in one transaction; schema, EN/AR text and tests updated. No migration.
- **P10 docs:** `README.md`, `developer_guide.md`, `user_guide.md` (EN + AR), `CHANGELOG.md`. Platform inventories not rebuilt (permissions and navigation unchanged since they were added).
- Type check: HQ web clean; HQ API only the older `general-config` spec error. Tenant: only 2 errors, both in the customer-app login code of other work; `npm run build` not run after the custom-unit fix.
- **Not from this program, found while testing:** 0855 made `org_customers_mst.customer_code` NOT NULL and about 30 DB-test fixtures insert without it (for example `order-fin-view-sources` 7/7 fail); `setup-health.db` "lets a member run their own tenant" fails because `authenticated` has no execute on `fn_shc_guard_tenant` (the tenant app calls Setup Health on the server connection); the 2 tenant type errors above.
- **Left (owner):** HQ Edit policy rule for `CHANGE_ITEM_MEASURE`/ITEM; manual QA steps 1-71; commit.

## Gap closure 2026-11-28 (PLAN section 6) - code done; owner QA left

| Pkg | State | What |
|---|---|---|
| G1 Documents | done | One formatter (required translator) prints measured, billed, minimum / step and unit price on receipts, prints, tracking, money view, order detail, cart; tax print shows the unit and a 6-dp unit price; customer app shows the reason and price |
| G2 Product form | done | Price per unit, "What will be charged" example, decimals checked, min quantity hidden for measured products, "/ unit" on product cards |
| G3 Conversions | done | Product "Units and packs"; DELETE route (system pairs excluded); dialog result, mismatch message, active switch, allowed units only; rates saved and read as text; resolver loads one product's pairs; duplicate pair / code messages |
| G4 Units and picker | done | Search and filters; product counts (the column always showed 0); packaging flag; UN/ECE and display order; "used by N products"; `CmxCombobox` + grouped `CmxUomSelect` |
| G5 Measure window | done | Keypad; entry in any unit that converts to the product's unit, shown before saving; the line stores the product's unit (no migration) |
| G6 Cleanup | done | `inventory.units.*` removed. Server caching of units not built, by measurement: unit read 2.5 ms on `uq_ouom_tenant_code` (22 rows per Organization), the pricing read runs beside the other reads, and HQ changes units directly in the database, so a cache would only add staleness |
| G7 Proof | done except the browser run | see Verification |

Also fixed on the way: Edit review now shows the re-measure (before / after); the shared keypad no longer pulls
server code into its users; customer-app credential issue failed for an unlinked customer (`customer_code` missing,
0855) and two login type errors.

**Verification:** unit tests for the changed areas pass; DB: measured order created, paid, re-measured, settled and
invoiced (4.5 KGM) in `order-change-edit-parity`; `uom-rules` 11/11; i18n, access contracts (5 routes), eslint on
changed files, customer app analyze + line test pass. `npm run build` passed (exit 0); platform inventories rebuilt, drift 0; 748 unit tests in the changed areas pass. `check:ui` has 2 errors in `erp-lite-exceptions-screen.tsx`
(other work).

**Not verified:** the two `uom-rules` cases that go through the API client print SKIPPED (the local API rejects the
configured key), so rate text round-trip, delete, duplicate messages and UN/ECE edit are proven only by route and
unit tests until QA steps 83-87; `e2e/measured-pricing.spec.ts` is written and listed, not run (it writes data).

**Not from this feature, still failing:** payment / scan / extra-config Jest suites (`Request is not defined`, import
chain through server auth), `tokens-css` (sidebar variables), `orders-simple-table` page-size case, one money-card
case (`common.close` missing from its mock), and DB suites for authenticated-role grants / RLS (`auth-*`, cash
drawer, `setup-health`, `rls-tenant-isolation`, `finance-smoke`, `order-committed-column-guard`).

**Not in this plan:** L2 (purchase units, stock entry units, pack barcodes); a price stated per another unit (D14);
"billed measure by unit" in sales reports.

**Owner:** HQ Edit policy rule for `CHANGE_ITEM_MEASURE` / ITEM; manual QA steps 1-90; commit both repositories.

## What remains (2026-11-28)

- **Area units: done, 0860 applied (local and remote, Owner).** Any area unit, system or custom, can price a
  product. In the measure window staff choose **Enter as**: *Length × width* (typed in any length unit; the line
  keeps the size in metres and the area in the product's unit, worked out with the Organization's conversions) or
  *Area* (typed directly; no size stored). The server charges the area, as it does for a weight typed in pounds.
  `0860_uom_area_any_unit.sql` replaced the 0814 identity check (length and width now come together, only with an
  area, and the area keeps the unit's decimals) and added SQMM, SQCM, SQIN, SQYD, ARE, HA and ACRE to the system
  catalog (not auto-seeded). km2 and mi2 were left out: at 6 decimals a small item rounds to double. The SQM / SQFT
  list, the product-picker filter, `UOM_AREA_UNSUPPORTED` (tenant and HQ) and the 0859 draft are gone (0859 was never
  applied; its file was removed from the folder).
- Checked 2026-11-28: 51 measure/dialog tests, 790 related tests, `uom-guards.db.test.ts` 9/9 with 0860 live,
  ESLint, `check:ui` and `check:i18n` clean on the changed files. `tsc` reports 47 errors, all in another session's
  customer-app files (`public/customer/receipts`, `booking/quote`, `customer-app-profile`, `customer-app-requests`),
  none in this feature. Production build not run: another session's build was running.
- Not run: two API-client database cases (local key refused), browser smoke, any screen in a browser.
- `CHANGE_ITEM_MEASURE` / ITEM rules exist only as DENY in the PILOT policies `QA_OE2_PILOT_V1` and
  `WF_V2_FULL_PATH_EDIT_POLICY`; the PUBLISHED default `ORDER_CHANGE_STANDARD_QA_20261107_V1` has none, so
  re-measuring a saved line is still refused.
- Owner: HQ Edit policy rule `CHANGE_ITEM_MEASURE` / ITEM, QA 1-94, commit both repositories, release the apps.
