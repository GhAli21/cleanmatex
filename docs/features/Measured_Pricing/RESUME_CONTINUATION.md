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
Decisions: Order Edit (`isEditMode`) refuses a measured add or re-measure with `uom.measure.editNotReady` until P5 (`CHANGE_ITEM_MEASURE`). One cart line per product, so a measured product already in the cart is re-measured, not duplicated. The dialog imports components by file (`@ui/primitives/cmx-button`, `@ui/overlays/cmx-dialog`) because the barrels pull a server action into jest. Not done: `CmxKeypadPopover` in the dialog; inventory modals still on `product_unit`; `/cmx-ui-design-review`.
Gates: `next build --webpack` exit 0, tsc 0, eslint clean, i18n pass. Next: inventory modals → `/cmx-ui-design-review` → fix `services/page.tsx` raw table → P5.
Known: 10 jest suites under `__tests__/features/orders` (payment dialogs, orders-simple-table, summary-panel ergonomics) fail with `Request is not defined` / parse errors via the `@ui/forms` and `@ui/primitives` barrels — the barrel import chain exists at HEAD (not verified against a clean baseline).

## Session handoff — 2026-11-24

**Done:** P1 migrations 0813–0815 and 0817 applied (local + remote), types and Prisma regenerated. P2 library closed. P3 mostly done: UoM service + 8 routes; order write path (measure intent → billed quantity → `uom_*` snapshot + measure columns); checkout and both request schemas accept `measure`; order split, tax-document items (billed quantity, `uom_code`, `uom_unece_code`), catalog, inventory and `/api/v1/products` (POST/PATCH) on `base_uom_code`, `min_billable_qty`, `billing_increment`. Gates: jest (commercial/uom/services/order-split/tax-document) 414 + `uom-http` 4 pass, tsc 0, eslint clean on changed folders.

**In progress / next:** finish P3 (public APIs; DB-integration tests; route tests for the 8 UoM routes are DONE: `__tests__/uom/uom-routes.test.ts`), then P4 (UI: `CmxUomSelect`, `CmxQuantityMeasureInput`, `/dashboard/catalog/units`, product form, cart `pricedQty` sites, Measure dialog, i18n `uom.errors.*`, access contract + nav check).

**Decisions made this session:** AMOUNT stays `(19,4)` (doc corrected). Tenant writes to units/conversions go through the admin client with explicit `tenant_org_id` (tenants have SELECT only). A measured line with no measure refuses the quote, so the commit (`MEASURE_REQUIRED`). Pinned (Edit) lines are count lines until P5. A sub-order from a split copies the unit snapshot, no measure (money stays on the parent).

**Open questions:** (1) Edit `ADD_ITEM` of a measured product needs the measure in P5 (today the DB trigger fills the unit only). (2) `PER_PC` literals remain in older tests. (3) Dead `requires_item_count`. (4) The `pglast` wheel sits in `supabase/migrations/`. (5) No e-invoice (UBL) builder exists yet; tax print detail carries the unit code for it.

**Uncommitted:** everything above is uncommitted (git status shows about 108 changed files in the repo, including unrelated parallel work: Background_Jobs, cmx-workers, preferences). Measured Pricing files: migrations 0813, 0814, 0815, 0817; `web-admin/lib/{uom,commercial,services,api,validations,types,constants}`, `app/api/v1/{uom,products}`, tests under `__tests__/{uom,commercial,services/commercial}`; the three docs here. HQ and mobile repos: untouched so far.

**Migrations to apply:** none. 0813–0815 and 0817 are applied. The next migration number must be taken at write time (live last+1). P9 (Migration B, dropping legacy `product_unit` bridge) is later and needs your review.
