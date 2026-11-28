# Measured Pricing on a UoM platform — STATUS

| Phase | Repo | State | Notes |
|---|---|---|---|
| Plan | — | ✅ v5 written 2026-11-23 | [PLAN.md](PLAN.md); D1–D14; v5: seeded copies + real FKs, COUNT whole numbers, optional tenant minimum + billing_increment |
| Gemini UoM review | — | ✅ 2026-11-23 | PLAN §2a |
| P0 Re-verify | both | ✅ 2026-11-23 | PLAN §2.3; plan amended (retail stock deduction, seed trigger on tenant insert, cart `pricedQty`, tier readers, `get_product_price` NUMERIC, price_type backfill) |
| P1 Precision rule + Migration A | both | ✅ applied local + remote 2026-11-24 (owner); QA §P1 checks 1–6 + resolver verified on remote; Prisma + types regenerated (web-admin tsc 0 errors) | `docs/dev/rules/numeric-precision.md` + pointers (CLAUDE.md, AGENTS.md, database skill, sql-migration doc, .cursor/.claude/.codex convention docs, HQ CLAUDE.md/AGENTS.md/.claude/.codex docs); migrations 0813, 0814, 0815 (PLAN §3.6b); pglast parse OK |
| P2 UoM lib + calculator | tenant | ✅ 2026-11-24 | `lib/uom/*`, `lib/commercial/measure.ts`, `lib/validations/uom-schemas.ts`, `lib/constants/uom.ts`; calculator prices measured lines on billed qty (ITEM basis, 6-dp unit price); tiers compare decimals; jest 397/23 suites, tsc 0, eslint clean. Mig 0817 (COUNT-target whole check at 6 dp) applied by owner |
| P3 Server + APIs | tenant | 🟡 mostly done | DONE: `uom.service.ts`, `uom-http.ts`, routes `/api/v1/uom/*` (perm `uom:view`/`uom:manage`); order write path: `LineIntent.measure` → loader reads product `base_uom_code`/`min_billable_qty`/`billing_increment` + `org_uom_cf`, resolves the billed measure (tiers, speed and money use `billedQty`; `MEASURE_REQUIRED` / `MEASURE_NOT_ALLOWED` / `UOM_QTY_SCALE` refuse the quote and so the commit), writer stores the `uom_*` snapshot + measure columns (`lineUomColumns`), checkout request + both request schemas accept `measure`; order split copies the unit snapshot; tax document items store billed quantity + `uom_code`/`uom_unece_code` (print detail too); catalog + inventory + `/api/v1/products` (POST/PATCH) accept `base_uom_code`, `min_billable_qty`, `billing_increment`, DB `UOM_*` errors surface as `UomRuleError`. Tests: jest commercial/uom/services 414 + `uom-http`, tsc 0, eslint clean. Route tests for all 8 UoM routes done 2026-11-24 (`__tests__/uom/uom-routes.test.ts`, 17 pass: permission gate, 400 validation, session tenant, error mapping). DB-integration tests done (`__tests__/db-integration/uom-rules.db.test.ts`, 5 pass on the local DB, rolled back, covers convert, whole-count, qty scale, unknown unit, reserved code). Public APIs: `/api/v1/public/customer/booking` still reads legacy `product_unit` through the 0814 bridge; moved to P6 (display/public). TODO: Order Edit (pinned lines keep a count unit until P5 `CHANGE_ITEM_MEASURE`; ADD_ITEM of a measured product needs the measure there), cart `pricedQty` sites (UI, with P4), public APIs, DB-integration tests |
| P4 UI | tenant | 🟡 in progress 2026-11-24 | DONE: `CmxUomSelect`, `CmxQuantityMeasureInput` (+ stories), `/dashboard/catalog/units` (Units + Conversions tabs, `src/features/uom/`), `uom.json` EN/AR incl. `uom.errors.*`, access contract + registry (wire check PASS), nav config (DB menu row already in 0815), product form on `base_uom_code` + optional minimum/billing step. DONE 2026-11-24 (later): New Order cart — `pricedQty` (uses the server's own `resolveBilledMeasure`), reducer + `UPDATE_ITEM_MEASURE`, `checkoutLineOf`/submit send `measure`, `MeasureLineDialog` (opens for a measured product, re-measure from the cart row), `CartMeasureNote` on the cart row (server billed figure from the cart quote `lines[].measure`), product list returns `min_billable_qty`/`billing_increment`; Edit mode refuses measured add/re-measure until P5. Tests: `measure-line-dialog` 6, helpers +6, `toCartQuote` +1. Gates 2026-11-24: `next build --webpack` exit 0, tsc 0, eslint clean on touched folders, `check:i18n` pass (`npm run build` itself still stops at the locked Prisma DLL). DONE 2026-11-24 (latest): inventory add/edit modals use `CmxUomSelect` and send `base_uom_code` (edit starts from the item's `base_uom_code`, else the legacy map); list type/service return `base_uom_code`; stock table and adjust modal show it; tsc 0, eslint clean. `/cmx-ui-design-review` and the `services/page.tsx` table fix done by the owner. Risk fixes 2026-11-24: legacy `product_unit` now follows `base_uom_code` on inventory + catalog create/update (the 0814 bridge only derives the unit when the text changes alone); adjust-stock modal takes step and validation from the unit's `qty_decimals`, and `adjustStock` refuses extra decimals (`UOM_QTY_SCALE`). TODO: `CmxKeypadPopover` in the dialog (skipped; the Measure input already has a numeric keyboard) |
| P5 Order Edit measure op | tenant | 🟢 code done 2026-11-24 (owner: HQ policy rule + QA) | Migration 0821 applied (local + remote): `CHANGE_ITEM_MEASURE` for ITEM and PIECE in the Edit catalogs and history CHECKs. DONE: constants, priced-ops, schemas (`measure` on `ADD_ITEM`, new `CHANGE_ITEM_MEASURE`, one per line, never on a custom item); Edit loader reads the stored unit, measure, billed qty, minimum and step and prices the line on them (snapshot, not today's product; stored premium split on billed qty); `editProjectionOf` + `measureChangesOf`; Preview says NO_CHANGE for an equal measure; Apply writes `measured_qty/measure_length/measure_width/billed_qty` (a stored line keeps its unit symbol/decimals, a new line gets the full unit snapshot); review audit signs the measure (Preview = Apply digest); context carries the unit and measure; Edit cart shows the unit and re-measures (`CHANGE_ITEM_MEASURE` via controller) and adds measured products (measure on `ADD_ITEM`); i18n EN/AR. Tests: schema, controller, workspace adapter, loader (+5), review audit, apply fixture, real-DB parity step 12b (add 3.2 kg, re-measure 4.1 and 1, minimum, history rows, count line refused) pass. DECIDED: a measure is a line fact like the line price, so ITEM only (0821's PIECE catalog pair is unused; HQ writes no rule for it); HQ must add a policy rule for `CHANGE_ITEM_MEASURE`/ITEM to a new draft of each Edit policy; a re-measure keeps the agreed unit price (L24), so it does not re-tier |
| P6 Display / prints / public | tenant | 🟢 code done 2026-11-25 | section P6 |
| P7 HQ uom-config + product config | HQ | 🟢 code done 2026-11-27 | 0848-0850 applied |
| P8 Mobile customer app | mobile | 🟢 done 2026-11-27 | booking keeps measured products hidden |
| P9 Migration B (drops) | both | ✅ applied 2026-11-27 | 0852, 0853 verified |
| P10 Docs | both | ✅ 2026-11-27 | [README.md](README.md) |

Follow-ups outside this plan: dead `requires_item_count` column (HQ templates); FX rate column precision; "billed measure by unit" in sales reports; 
UoM L2 with ERP Lite PO.

**Owner (2026-11-24):** 0821 applied; HQ adds the policy rule for `CHANGE_ITEM_MEASURE`/ITEM; manual QA steps 25-30. **Next:** P5 (design in RESUME_CONTINUATION, section P5); P4 is closed apart from the two TODOs above; start P5 (Order Edit measure op). Earlier note: P3 is closed except Order Edit (P5) and cart `pricedQty` (P4); public APIs moved to P6. Start P4 (UI: unit picker, measure input, Units page). AMOUNT precision settled: `(19,4)` (doc corrected 2026-11-24).

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

**Open security finding (another session's customer-app code, not changed):** issuing a temporary app password can
link to an existing global customer by phone / email and reset their password, and returns it to staff: one
Organization could sign in as another's customer. Launch blocker; needs an Owner decision.

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
## After 0852 / 0853, custom units and P10 (2026-11-27)

- **0852 and 0853 applied** local and remote (owner); database types and Prisma regenerated. Verified read-only on both: no legacy column, function, trigger or reference left; both seeders copy `base_uom_code`; column defaults present; Setup Health no ERROR rows.
- Local DB tests: `uom-rules` 8/8 (new: seeding copies a KG template, an omitted unit is a piece, custom unit rules); `order-change-edit-parity` passes after its customer fixture got `customer_code`.
- **Bug fixed (from P4):** a custom measured unit could never be created: the screen inserted the unit alone, and the database requires its base conversion at commit. The dialog now asks for the size of one unit in the base unit; `createCustomUnit` writes unit and conversion in one transaction; schema, EN/AR text and tests updated. No migration.
- **P10 docs:** `README.md`, `developer_guide.md`, `user_guide.md` (EN + AR), `CHANGELOG.md`. Platform inventories not rebuilt (permissions and navigation unchanged since they were added).
- Type check: HQ web clean; HQ API only the older `general-config` spec error. Tenant: only 2 errors, both in the customer-app login code of other work; `npm run build` not run after the custom-unit fix.
- **Not from this program, found while testing:** 0855 made `org_customers_mst.customer_code` NOT NULL and about 30 DB-test fixtures insert without it (for example `order-fin-view-sources` 7/7 fail); `setup-health.db` "lets a member run their own tenant" fails because `authenticated` has no execute on `fn_shc_guard_tenant` (the tenant app calls Setup Health on the server connection); the 2 tenant type errors above.
- **Left (owner):** HQ Edit policy rule for `CHANGE_ITEM_MEASURE`/ITEM; manual QA steps 1-71; commit.

## P9 - legacy unit columns removed 2026-11-27 (0852 + 0853 applied)

**Apply order (both databases):** 1) `0852_uom_seed_from_base_unit.sql` 2) run the new HQ and tenant code 3) `0853_uom_drop_legacy_unit_cols.sql` 4) regenerate database types in both repositories (`npm run prisma:pull` too).

- **0852** (safe with old and new code): `initialize_tenant_product_catalog` and `reseed_missing_products` copy `base_uom_code` (they copied only `product_unit`); column defaults `base_uom_code = 'PC'`, `price_type = 'PER_UNIT'` replace what the bridge trigger did for an omitted column. Function bodies generated from 0700, whose checksum matched both databases.
- **0853** (destructive): drops `product_unit` (templates, organization products), `requires_weight`, `requires_dimensions`, both bridge triggers, `fn_uom_prod_legacy_bridge`, `fn_uom_legacy_code`; stops if 0852 is missing. Checked on local and remote: every `product_unit` maps to the row's `base_uom_code`, flags all false.
- **Tenant code:** no read or write of the legacy columns (catalog and inventory services, products API now requires `base_uom_code`, booking catalog sends `unit = per_piece` because measured products are hidden, two list screens, two inventory dialogs, types, `schema.prisma`, `scripts/db/check-products.js`). Fixed on the way: the product CSV export wrote unit codes such as `PC` that its own import refused. `lib/uom/legacy.ts` stays only to read the CSV `unit` column.
- **HQ code:** no mirrors; template price type required; bulk files send piece / per unit for a blank unit or price type, ignore the retired columns, and refuse a file whose only unit column is `product_unit`; removed a dependency entry for the non-existent `sys_product_unit_cd`.
- Gates: tenant tsc 0, eslint (changed files), `check:ui` 0/0, jest catalog / inventory / booking / unit 154/154, DB parity test pass, `npm run build` exit 0; HQ jest 126/126, eslint, tsc only the older `general-config` spec error. Not run: browser QA.

## P8 - customer mobile app: done 2026-11-27 (order detail; booking keeps measured products hidden)

- Order detail shows each line's qualifier from the server (measure, own speed, ordinal) and **Billed: {qty}** when a minimum or billing step changed the quantity; Arabic unit symbol, speed and product name (`name2`). New `OrderLineQualifierModel` (`mobile_domain`), `CustomerOrderItemRowVw`, l10n `orders.line.billed` EN/AR.
- Fixed on the way: the app showed `totalPrice` for a line; it now shows `lineTotalAmount` (what the customer pays, as the web tracking page does) and falls back to `totalPrice`.
- Unit price: not sent at P8; sent in the line qualifier since 2026-11-28 and shown by the web and the app.
- **Owner decision 2026-11-27: measured products stay hidden in booking** (the server hides and refuses them; staff create those orders). "Book now, price at intake" is not planned.
- Gates: `flutter analyze` clean (mobile_domain, mobile_services, mobile_l10n, customer_app); services tests 3/3; order tests pass incl. 4 new; full customer_app run 24 pass, 1 fail (`customer_login_entry_screen_test`, outside this change; one failure in the run before the change too). Not run: device or emulator QA.

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

## P6 - display and public: DONE in code (web), 2026-11-25

**Helper:** `lib/orders/line-qualifier.ts` (`orderLineQualifiers(lines, orderSpeed, speedNames?)` -> per line id `{ measure?, speedCode?, speedName?, ordinal? }`; `qualifierInputOfRow` maps a stored item row), `line-qualifier-format.ts` (`formatLineQualifier`, text "2.5 m² · Express (1)", EN/AR symbol and speed name), `line-qualifier-speed.ts` (`loadSpeedNames`, catalog read). 10 tests. Rules: measure always for a measured unit; speed only when it differs from the order's; ordinal only when a product has 2+ lines whose measure and speed are identical (numeric compare, 2.5 = 2.500000). Cart Line Grouping consumes it.
**Surfaces done:** money view (`items.source` + `normalize.ts` -> `OrderFinLine.qualifier`, added to `orderFinLineSchema` and the public allowlist `publicLine` + schema, classified `public` in `public-projection.test.ts`; statement shows `name · qualifier`); public tracking (`public-order-tracking.service.ts` -> `PublicOrderItem.qualifier`, page renders it; the customer-app order API reuses this service, so it already returns `qualifier`); text and HTML receipts (`receipt-service.ts`); order state API (`app/api/v1/orders/[id]/state`, feeds Ready detail and both prints: `order-receipt-print.tsx`, `order-details-print.tsx` via `ReadyOrderItem.qualifier`); staff order detail (`lib/db/orders.ts` adds `line_qualifier`, `order-items-list.tsx` shows it).
**Fix found on the way:** the order state API listed lines removed by an Edit (rec_status 0); it now lists live lines only (`.eq('rec_status', 1)`).
**Booking route:** a customer cannot send a measure, so a measured product would fail the quote. The catalog hides products whose `base_uom_code` is a measured unit (dimension not COUNT) and submit refuses them with `booking_item_needs_measure` (test added). The route still sends the legacy `unit` text (bridge) for display; the unit migration of the customer app is P8/P9. OWNER DECISION to confirm: hide measured products from the app (current) or later show them as "priced at intake".
**Not done / follow-ups:** tax documents and invoices (not in the Line Grouping surface list; they already carry billed qty and `uom_code`); Flutter customer app rendering of `qualifier` and the booking `unit` (P8); money view draft/Edit sources have no qualifier. Gates: tsc clean, eslint clean on changed files, `check:ui` 0 errors, jest (line-qualifier 10, normalize, public projection, tracking, receipts, booking 7, order-state), DB-integration `order-fin-view-sources` passes. Known unrelated failure: `order-financial-view.ui.test.tsx` "Missing message: common.close" (cmx-dialog, another session's change).

## Owned for Order Cart Line Grouping (owner agreed 2026-11-25; DESIGN §0 there)

1. **Free-garment fix (P4 fix): DONE in code 2026-11-25.** A piece-count change on a measured line (card +/-, step 2 +/-, Add piece, pieces manager, Edit quantity/add/remove piece) is held in `state.measureRecheck`; the Measure dialog opens in re-measure mode ("Pieces changed from X to Y. Check the total measure."); Confirm applies the count and the staff-entered total (keeping the total is allowed and explicit); Cancel drops the change; code never changes the measure by itself; removing the line is not held; Edit: a changed total needs the `CHANGE_ITEM_MEASURE` policy cell (else "keep the total" only). Files: `new-order-types.ts` (`measureRecheck`, 2 actions), `new-order-reducer.ts`, `use-new-order-state.ts` (`holdForMeasure`, `confirmMeasureRecheck`, `cancelMeasureRecheck`; `updateItemQuantity/updateItemPieces` now return a boolean), `measure-line-dialog.tsx` (`notice`, `refusal`), `new-order-content.tsx` (second dialog + follow-ups), `uom.json` EN/AR (`measure.recheckNotice`, `recheckBlocked`), test `__tests__/features/orders/measure-recheck.test.tsx` (8). tsc, eslint, check:i18n, check:ui clean. Cart Line Grouping P1 must carry `productId` -> `lineKey` through `MeasureRecheck.productId` and the 3 hook methods.
2. **Line qualifier (P6 / P8):** `lib/orders/line-qualifier.ts` = `orderLineQualifiers(lines, orderSpeed)` -> per line id `{ measure?, speedCode? (only when it differs from the order speed), ordinal? (only when a product has 2+ lines with identical parts) }`, structured, not text; used by receipts, prints, money view, tracking, customer app (Line Grouping DESIGN §8.1 has the surfaces). Not started. Hold: do not edit `new-order-reducer.ts`, `use-new-order-state.ts`, `new-order-content.tsx`, `edit-workspace-adapter.ts` or the measure dialog while Line Grouping P1 runs; they will say when P1 is done.

## Remaining to close the plan (2026-11-24, after P5)

Code phases left: **P6** display/public (order detail, receipts, invoices, Order Fin View line rows, public tracking, public booking route still on `product_unit`); **P7** HQ uom-config + product config (`cleanmatexsaas`); **P8** mobile app (`cmx_mobile_apps`); **P9** Migration B, drop the legacy `product_unit` bridge (owner review, stop-and-wait); **P10** docs.
Owner tasks: HQ policy rule `CHANGE_ITEM_MEASURE`/ITEM in each Edit policy draft; manual QA steps 1-30; commit.
Open/minor: 10 `__tests__/features/orders` suites fail via barrel imports (pre-existing); `next build --webpack` not run for P5; optional migration to set the unused 0821 PIECE pair `is_active=false`; `CmxKeypadPopover` in the Measure dialog; non-base-unit entry (lb/ft); UoM L2 with ERP Lite PO. Decided: measure is line-level (ITEM only), no per-piece lengths.

**Coordination (2026-11-25):** P6 and Order Cart Line Grouping share `lib/orders/line-qualifier.ts` (`{measure?, speedCode?, ordinal?}`, first to land creates it). Edit merge (quantity + add piece + measure on one line) proven on the real DB; no change needed for their §4.5. See RESUME_CONTINUATION.

## Session handoff — 2026-11-24

**Done:** P1 migrations 0813–0815 and 0817 applied (local + remote), types and Prisma regenerated. P2 library closed. P3 mostly done: UoM service + 8 routes; order write path (measure intent → billed quantity → `uom_*` snapshot + measure columns); checkout and both request schemas accept `measure`; order split, tax-document items (billed quantity, `uom_code`, `uom_unece_code`), catalog, inventory and `/api/v1/products` (POST/PATCH) on `base_uom_code`, `min_billable_qty`, `billing_increment`. Gates: jest (commercial/uom/services/order-split/tax-document) 414 + `uom-http` 4 pass, tsc 0, eslint clean on changed folders.

**In progress / next:** finish P3 (public APIs; DB-integration tests; route tests for the 8 UoM routes), then P4 (UI: `CmxUomSelect`, `CmxQuantityMeasureInput`, `/dashboard/catalog/units`, product form, cart `pricedQty` sites, Measure dialog, i18n `uom.errors.*`, access contract + nav check).

**Decisions made this session:** AMOUNT stays `(19,4)` (doc corrected). Tenant writes to units/conversions go through the admin client with explicit `tenant_org_id` (tenants have SELECT only). A measured line with no measure refuses the quote, so the commit (`MEASURE_REQUIRED`). Pinned (Edit) lines are count lines until P5. A sub-order from a split copies the unit snapshot, no measure (money stays on the parent).

**Open questions:** (1) Edit `ADD_ITEM` of a measured product needs the measure in P5 (today the DB trigger fills the unit only). (2) `PER_PC` literals remain in older tests. (3) Dead `requires_item_count`. (4) The `pglast` wheel sits in `supabase/migrations/`. (5) No e-invoice (UBL) builder exists yet; tax print detail carries the unit code for it.

**Uncommitted:** everything above is uncommitted (git status shows about 108 changed files in the repo, including unrelated parallel work: Background_Jobs, cmx-workers, preferences). Measured Pricing files: migrations 0813, 0814, 0815, 0817; `web-admin/lib/{uom,commercial,services,api,validations,types,constants}`, `app/api/v1/{uom,products}`, tests under `__tests__/{uom,commercial,services/commercial}`; the three docs here. HQ and mobile repos: untouched so far.

**Migrations to apply:** none. 0813–0815 and 0817 are applied. The next migration number must be taken at write time (live last+1). P9 (Migration B, dropping legacy `product_unit` bridge) is later and needs your review.
