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

## Session handoff — 2026-11-24

**Done:** P1 migrations 0813–0815 and 0817 applied (local + remote), types and Prisma regenerated. P2 library closed. P3 mostly done: UoM service + 8 routes; order write path (measure intent → billed quantity → `uom_*` snapshot + measure columns); checkout and both request schemas accept `measure`; order split, tax-document items (billed quantity, `uom_code`, `uom_unece_code`), catalog, inventory and `/api/v1/products` (POST/PATCH) on `base_uom_code`, `min_billable_qty`, `billing_increment`. Gates: jest (commercial/uom/services/order-split/tax-document) 414 + `uom-http` 4 pass, tsc 0, eslint clean on changed folders.

**In progress / next:** finish P3 (public APIs; DB-integration tests; route tests for the 8 UoM routes are DONE: `__tests__/uom/uom-routes.test.ts`), then P4 (UI: `CmxUomSelect`, `CmxQuantityMeasureInput`, `/dashboard/catalog/units`, product form, cart `pricedQty` sites, Measure dialog, i18n `uom.errors.*`, access contract + nav check).

**Decisions made this session:** AMOUNT stays `(19,4)` (doc corrected). Tenant writes to units/conversions go through the admin client with explicit `tenant_org_id` (tenants have SELECT only). A measured line with no measure refuses the quote, so the commit (`MEASURE_REQUIRED`). Pinned (Edit) lines are count lines until P5. A sub-order from a split copies the unit snapshot, no measure (money stays on the parent).

**Open questions:** (1) Edit `ADD_ITEM` of a measured product needs the measure in P5 (today the DB trigger fills the unit only). (2) `PER_PC` literals remain in older tests. (3) Dead `requires_item_count`. (4) The `pglast` wheel sits in `supabase/migrations/`. (5) No e-invoice (UBL) builder exists yet; tax print detail carries the unit code for it.

**Uncommitted:** everything above is uncommitted (git status shows about 108 changed files in the repo, including unrelated parallel work: Background_Jobs, cmx-workers, preferences). Measured Pricing files: migrations 0813, 0814, 0815, 0817; `web-admin/lib/{uom,commercial,services,api,validations,types,constants}`, `app/api/v1/{uom,products}`, tests under `__tests__/{uom,commercial,services/commercial}`; the three docs here. HQ and mobile repos: untouched so far.

**Migrations to apply:** none. 0813–0815 and 0817 are applied. The next migration number must be taken at write time (live last+1). P9 (Migration B, dropping legacy `product_unit` bridge) is later and needs your review.
