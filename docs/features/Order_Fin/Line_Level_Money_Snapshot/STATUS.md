# Line-Level Money Snapshot — STATUS

**Plan:** [PLAN.md](PLAN.md) · **Discussion:** [DISCUSSION.md](DISCUSSION.md)
**Overall:** APPROVED by owner 2026-10-23 (v2.1). In execution. No migration yet.

## Execution order (approved 2026-10-23)

Both plans run as one sequence, because they change the same files.

| Step | Work | Status |
|---|---|---|
| 1 | Security first: Reusable View BF-09, BF-16 (+ mobile detail route), BF-20 | ✅ Done 2026-10-23 |
| 2 | Combined Phase 0 of both plans + ADR-060 (no code) | ✅ Done 2026-10-23: [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md), [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md) |
| 2b | Hotfix: PF-01 (price override not enforced on Create) + PF-04 (exempt orders taxed) | ✅ Done 2026-10-23 |
| 3 | Characterization tests on Create (this P1-01 = Reusable View P1B-01) | ✅ Done 2026-10-23: [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) (owner sign-off §4 pending) |
| 4 | Reusable View Phase 1 bug fixes (BF-19 moves to this P5-03) | ✅ Done 2026-10-23: [Reusable View STATUS exec-3](../Reusable_Order_Fin_View/STATUS.md) |
| 5 | This P2–P6, then Reusable View P1B-04…12 | In progress: Phase 2 done; Phase 3 M5–M6 applied, M7 drafted (last of P3), awaiting apply |
| 6 | Reusable View P3+ (read model, component) | — |
| 7 | This P7–P8 (incl. HQ), then the releases of both plans | — |
**Downstream dependency:** Reusable Order Fin View Phase 1B builds on this plan (owner L13).

| Phase | Title | Release | Status | Notes |
|---|---|---|---|---|
| P0 | Discovery and ADR-060 | A | ✅ Done 2026-10-23 | 20 findings (PF-01…PF-20), plan changes C1–C14 (PLAN §21), 2 owner items (PLAN §20) |
| P1 | Freeze Create (characterization tests) | A | ✅ Done 2026-10-23 | 55 goldens; owns Reusable View P1B-01; sign-off list in P1_01_CHARACTERIZATION.md §4 |
| P2 | Configuration DB (M1–M4) | A | ✅ Done 2026-10-24 (M1–M4 applied) | All 4 migrations applied local+remote, types regenerated each time. See log entries. |
| P3 | Line-money DB (M5–M7) | A | M5–M6 applied; M7 written, awaiting review (last of P3) | `0645_tax_doc_items_dtl.sql` drafted 2026-10-24; not applied |
| P4 | Domain calculator (`lib/commercial/`, pure, decimal) | A | Not started | Owns and extends Reusable View P1B-03 |
| P5 | Services + Create | A | Not started | One writer |
| P6 | Order Edit V2 write parity | A | Not started | Same release as P5 |
| P7 | Configuration UI (tenant app) + HQ card | A | Not started | Nav dual-write, permissions, access contract |
| P8 | Readers + fiscal item lines | A | Not started | `org_tax_doc_items_dtl` (owner item §20-3) |
| P9 | PIECE level enablement | B | Not started | `PIECE` disabled in HQ until P9-01 |
| P10 | Recompute, tighten (M10), drop (M11) | A / C | Not started | |
| P11 | Verification and docs (both repos) | A–C | Not started | |

## Log

- **2026-10-23 (step 5 started): M1 migration drafted, STOP for review.**
  - File: `supabase/migrations/0639_sys_service_speed_tax_cat.sql` (not applied).
  - **Renumbered from 0638:** at drafting, `0638` had been taken by an in-flight migration from another workstream (`0638_order_change_edit_policy_rename.sql`, Edit Policy namespace rename). Verified against the remote DB and the migrations folder; no other seq collision.
  - **Content:** two global `sys_*` reference tables, no RLS (CLAUDE.md: RLS is for `org_*`), matching the repo's existing bilingual code-table pattern (`0416`):
    - `sys_service_speed_cd`: `STANDARD` (default) and `EXPRESS`, one-default partial unique index.
    - `sys_tax_category_cd`: the 4 categories with `uncl5305_code` (S/Z/E/O) for e-invoicing (ADR-060 §6), `STANDARD` default.
  - Seeds reproduce today's behaviour exactly (L17): `EXPRESS` is the only speed in use; every product stays `STANDARD` tax category until M4 wires real exemptions.
  - **PLAN §12 renumbered:** M2–M9 each shift by +1 (`0640`…`0647`) to stay sequential after the M1 shift.
  - **Not yet applied.** Per CLAUDE.md rule, this is a SQL file only — stopping here for the owner to review and apply. After apply: `npm run prisma:pull`, add `SERVICE_SPEEDS` / `TAX_CATEGORIES` constants (P2-01…04), then M2.

- **2026-10-24 (M1 applied):** the owner applied `0639_sys_service_speed_tax_cat.sql` to local and remote, pulled Prisma and regenerated types in both repos (verified: `sys_service_speed_cd` / `sys_tax_category_cd` present in `web-admin/prisma/schema.prisma`, the generated Prisma client, and HQ's `database.types.ts` in both `platform-api` and `platform-web`; remote rows match the seed exactly).
  - Added `lib/constants/commercial.ts` (`SERVICE_SPEEDS`, `TAX_CATEGORIES`, `TAX_CATEGORY_UNCL5305_CODE`) and `lib/types/commercial.ts` (P2-01, this migration's scope only; the remaining P2-01 constants land with M2–M4).
  - **Gates:** `tsc --noEmit` clean (needed `NODE_OPTIONS=--max-old-space-size=6144`, matching the repo's own build script — plain `tsc` runs out of heap on this codebase regardless of this change), ESLint clean on the new files, characterization goldens 67/67 green, `npm run build` passing.
  - **Next:** M2, `0640_org_speed_price_rules_cf.sql` (the speed price rules table, §6.6).

- **2026-10-24 (M2 drafted, STOP for review):** `0640_org_speed_price_rules_cf.sql` (not applied).
  - **Table `org_speed_price_rules_cf`** per §6.6: scope (tenant/branch/category/product), `speed_price_type` (SELL_PRICE/MULTIPLIER/FIXED_AMOUNT) with a CHECK that exactly the matching value column is set, `NULLS NOT DISTINCT` scope-uniqueness, RLS via `current_tenant_id()`.
  - **FK column order verified against the live schema, not assumed:** `(product_id, tenant_org_id) → org_product_data_mst(id, tenant_org_id)` matches the existing `org_price_history_audit_product_id_tenant_org_id_fkey`; `(branch_id, tenant_org_id) → org_branches_mst(id, tenant_org_id)` matches CLAUDE.md's `0553` example and `fk_org_order_branch`. `ON DELETE SET NULL (branch_id)` uses the PG15+ column-specific form (CLAUDE.md), not whole-row `SET NULL`, which several older FKs to `org_branches_mst` use on a required `tenant_org_id` composite and CLAUDE.md now bans for new work.
  - **Backfill (L17):** one EXPRESS rule per of the 127 active products. Dry-run against the remote DB before writing the file confirms the exact split the plan expects: 95 `SELL_PRICE` rows (unchanged price) and 32 `MULTIPLIER` rows all at exactly `0.00` (30 stored `multiplier_express = 1.00`, 2 `NULL` → both become `0`, i.e. today's "express = normal price" for those products). No figure changes.
  - **Plan correction found:** `org_price_history_audit.entity_type` is CHECK-restricted today to `'price_list_item'` / `'product_default'` (lowercase), not the plan's `'SPEED_RULE'`. Not widened here — nothing writes a speed-rule audit row yet. Deferred to the Phase 7 migration that ships the rules UI/service, which should use lowercase `'speed_rule'` to match the column's existing case convention (DB-mirror rule).
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull`, extend `lib/constants/commercial.ts` with `SPEED_PRICE_TYPES` / `PRICE_BASIS`, then M3 (`0641_commercial_settings.sql`).

- **2026-10-24 (M2 applied):** the owner applied `0640_org_speed_price_rules_cf.sql` to local and remote, regenerated types in both repos. Verified on remote: 127 rows (95 `SELL_PRICE`, 32 `MULTIPLIER` at exactly `0.0000`), RLS enabled, the Prisma relations for both composite FKs (`org_branches_mst`, `org_product_data_mst`) resolved to single objects (not arrays), confirming no P1012 column-order drift. Added `SPEED_PRICE_TYPES`, `PRICE_BASIS` to `lib/constants/commercial.ts` + `lib/types/commercial.ts` (`SpeedPriceRule`). Gates: `tsc`, ESLint, goldens (67) all clean.
  - **Next:** M3, `0641_commercial_settings.sql` (the remaining `org_tenants_mst` commercial settings, §6.6).

- **2026-10-24 (M3 drafted, STOP for review):** `0641_commercial_settings.sql` (not applied).
  - Adds `commercial_level` (`ITEM`/`PIECE`), `disc_alloc_mode` (`ALLOCATE_TO_LINES`/`DOCUMENT_LEVEL`), `disc_alloc_basis` to `org_tenants_mst`. `tax_pricing_mode` / `extra_price_pricing_mode` already exist (an earlier feature); untouched here — HQ becoming their single writer (L18, §10.3) is application work (P7-05), not schema.
  - **`disc_alloc_basis` values are an expert decision**, not in the plan text verbatim: the plan names only the column and its seed (`PROPORTIONAL_NET`), without enumerating the full set. Added `PROPORTIONAL_GROSS` as the second value (proportional to each line's gross before line discounts, vs the seeded net-after-line-discounts default) — the natural complement, matching §8.4's own description of `ALLOCATE_TO_LINES`'s net-proportional split. Recorded here for the owner to confirm or relabel before Phase 4 implements it.
  - Seed (L17): `ITEM` / `DOCUMENT_LEVEL` / `PROPORTIONAL_NET` as column defaults, reproducing today's behaviour on every existing tenant with no figure change.
  - `COMMERCIAL_LEVELS`, `DISC_ALLOC_MODES`, `DISC_ALLOC_BASIS` added to `lib/constants/commercial.ts` ahead of apply (type-only until the migration lands; `tsc`/ESLint clean — these are plain string unions, not yet read from the new columns).
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull`, then M4 (`0642_tax_profile_rounding.sql`).

- **2026-10-24 (M3 applied):** the owner applied `0641_commercial_settings.sql` to local and remote, regenerated types in both repos. Verified on remote: all 3 tenants seeded `ITEM` / `DOCUMENT_LEVEL` / `PROPORTIONAL_NET`. Gates (`tsc`, goldens 67) clean. The owner proceeded with the `disc_alloc_basis` second value (`PROPORTIONAL_GROSS`) as proposed; treated as accepted, revisit only if Phase 4 implementation surfaces a problem with it.
  - **Next:** M4, `0642_tax_profile_rounding.sql` — the last Phase 2 migration.

- **2026-10-24 (M4 drafted, STOP for review — last of Phase 2):** `0642_tax_profile_rounding.sql` (not applied).
  - New table `sys_tax_exempt_reason_cd` (country, code, bilingual name) per ADR-060 §6 / C5, seeded empty — no exempt product exists yet.
  - `org_tax_profiles_cf` gains `rounding_level` / `rounding_mode` / `output_decimal_places` / `rounding_increment_minor`, seeded `DOCUMENT` / `HALF_UP` / `NULL` / `NULL` on all 10 profiles (today's behaviour, no figure change).
  - `org_product_data_mst` gains `tax_category_code` (FK `sys_tax_category_cd`, seeded `STANDARD` on all 127; `is_tax_exempt` stays untouched until M11), `tax_supply_code` (nullable, no default, no FK — none planned), `tax_exempt_reason` (nullable, not an FK — the reason table is keyed by country and the product row carries none; checked at the service layer instead).
  - `price_type` drift fixed: 3 `per_piece` rows → `PER_PC`; added a CHECK (`FIXED`/`PER_PC`/`NULL`). Verified on remote first: 6 rows stay `NULL` (2 retail items, 4 unclassified laundry products) — the plan's seed step only converts `per_piece`, so these are left alone and flagged as a catalog data-quality gap for the owner, not guessed at.
  - **New finding PF-25, fixed immediately (not deferred):** `lib/types/catalog.ts`'s `PriceType` TypeScript union used stale lowercase values (`'fixed' | 'per_piece' | 'per_kg'`), disjoint from the real DB values this migration normalizes to. Traced every consumer (11 files): nothing in `app/`/`src/` actually sets `price_type` (no UI exposes it, consistent with PF-22), so the drift was dead but would have broken the moment something did write through it after this migration's CHECK lands. Fixed the type to `'FIXED' | 'PER_PC'`, dropped unplanned `per_kg`. `tsc`, ESLint and goldens (67) confirmed clean; no behaviour change (nothing exercises the path).
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull` — **this closes Phase 2 (M1–M4)**. Next: Phase 3, M5 (`0643_line_money_items_pieces.sql`).

- **2026-10-24 (M4 applied — Phase 2 closed):** the owner applied `0642_tax_profile_rounding.sql` to local and remote, regenerated types in both repos. Verified on remote: all 127 products `tax_category_code = STANDARD`; `price_type` split 8 `FIXED` / 113 `PER_PC` / 6 `NULL` (unchanged, as planned); all 10 tax profiles seeded `DOCUMENT`/`HALF_UP`/`NULL`/`NULL`. Gates (`tsc`, goldens 67) clean. **Phase 2 (configuration DB, M1–M4) is done.**
  - **Next:** Phase 3, M5 (`0643_line_money_items_pieces.sql`) — line money on items and pieces.

- **2026-10-24 (M5 drafted, STOP for review — Phase 3 starts):** `0643_line_money_items_pieces.sql` (not applied).
  - Widens `org_order_items_dtl.price_per_unit` / `total_price` from `numeric(10,3)` to `DECIMAL(19,4)` (PF-23; pieces already at that scale — verified on remote, no existing value exceeds 3 decimals, so the widen is lossless).
  - Adds the 19-column set from PLAN.md §6.1 to both `org_order_items_dtl` and `org_order_item_pieces_dtl`: `money_basis`, `service_speed`, `ready_by_at`, `price_source`, `price_list_id`, `speed_rule_id`, `list_unit_price`, `speed_premium_amount`, `line_disc_amount`, `order_disc_alloc_amount`, `net_amount`, `tax_pricing_mode`, `tax_profile_id`, `tax_category_code`, `tax_exempt_reason`, `tax_rate`, `taxable_amount`, `tax_amount`, `line_total_amount`. All nullable (per §6/§15: NOT NULL + the I5 CHECK land in M10, after the Phase 10 recompute). No default on any of them — existing rows stay genuinely NULL until recomputed.
  - **Composite FKs, verified against the live schema first:** `org_speed_price_rules_cf` already had a `(tenant_org_id, id)` unique (M2); `org_tax_profiles_cf` and `org_price_lists_mst` did not (only a plain `PK(id)`), so this migration adds one to each, tenant-first, matching the sibling `_cf`/`_mst` convention (`org_currency_cf`, `org_product_data_mst`) — a prerequisite the plan's "composite FK" instruction for `price_list_id`/`speed_rule_id`/`tax_profile_id` needed but didn't call out explicitly.
  - **Indexes deferred:** the plan's `(tenant_org_id, service_speed)` / `(tenant_org_id, tax_category_code)` indexes are gated on "if P0-11 shows a reader needs them" — no reader exists yet (Phase 8), so neither is added now, to avoid an unused index on a hot write table. Revisit in Phase 8.
  - `tax_exempt_reason` again not an FK, same reasoning as M4 (no country column on the line; checked at the service layer).
  - **Owner addition, same day: `ready_at` (20th column, not in the original plan text).** The owner asked why only an expected ready time (`ready_by_at`) was planned, with no actual one. Checked the DB first: `org_orders_mst` already has exactly this expected/actual pair (`ready_by`, `ready_at`), live, used for on-time SLA in `workflow-service.ts`. Added `ready_at` to both tables, mirroring that header pattern. Nullable; the fulfillment workflow is its future writer (the same code that already sets `piece_status` / `is_ready` / `last_step_at`), never the calculator — wiring that write is not part of this plan's phases. `PLAN.md` §6.1 updated.
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull`, then M6 (`0644_line_money_prefs_disc_chg.sql`).

- **2026-10-24 (M5 applied):** the owner applied `0643_line_money_items_pieces.sql` to local and remote, regenerated types in both repos. Verified on remote: `price_per_unit`/`total_price` now `DECIMAL(19,4)`; all 20 new columns present (including `ready_at`) on both tables, all existing rows genuinely `NULL`; all 5 new FKs on `org_order_items_dtl` present. Gates (`tsc`, goldens 67) clean.
  - **Next:** M6, `0644_line_money_prefs_disc_chg.sql` — header, preference, discount and charge columns.

- **2026-10-24 (M6 drafted, STOP for review):** `0644_line_money_prefs_disc_chg.sql` (not applied).
  - **`org_orders_mst`:** the §5.3 commercial-settings snapshot (`commercial_level`, `tax_pricing_mode`, `extra_price_pricing_mode`, `disc_alloc_mode`, `commercial_calc_version`) plus `speed_premium_amount`. `tax_pricing_mode`/`extra_price_pricing_mode` are genuinely new real columns — today's only record of the mode used lives inside a JSON blob (`financial_calculation_snapshot.taxPricingModeAtCalculation`).
  - **Plan gap found and closed:** added `disc_alloc_basis` to the order snapshot even though §5.3's list only names `disc_alloc_mode`. Both are tenant settings that shape a historical order's discount math; snapshotting one but not the other would let a later Edit/recompute silently read today's `disc_alloc_basis` for an old order — exactly the class of bug rule #15 and PF-07 exist to prevent. Flagged rather than silently added.
  - **`org_order_preferences_dtl`:** `extra_price_pricing_mode`, `price_basis` (CHECK restricted to `PER_LINE` only, per §6.3's own wording), `list_extra_price`, `is_price_override`, `bundle_code`, `bundle_discount_amt`, `extra_turnaround_min`.
  - **`org_order_discounts_dtl`:** `discount_level`, composite FKs `order_item_id`/`order_item_piece_id` (the plan explicitly asks for composite here, unlike the plain FKs the older preferences table uses for the same reference — honoured as written, with `ON DELETE RESTRICT` since a discount row is a financial audit record), a CHECK matching level to which reference is set, `disc_alloc_mode`, `tax_category_code`. No new guard needed for the gift-card rule: `discount_type` is already CHECK-restricted to `PERCENTAGE`/`FIXED_AMOUNT`, so `GIFT_CARD` could never be written here.
  - **`org_order_charges_dtl`:** `tax_category_code`, `tax_profile_id` (plain FK — the plan doesn't mark this one composite, unlike items/pieces in M5), `tax_rate`, `taxable_amount`, `tax_amount`.
  - All nullable, no defaults, consistent with the M5 staging rule. Verified no column-name collisions on all 4 tables against the live schema before writing.
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull`, then M7 (`0645_tax_doc_items_dtl.sql`), the last Phase 3 migration.

- **2026-10-24 (M6 applied):** the owner applied `0644_line_money_prefs_disc_chg.sql` to local and remote, regenerated types in both repos. Verified on remote: all 7 new `org_orders_mst` columns present (including `disc_alloc_basis`); all 6 new discount constraints (`fk_ood_*`/`chk_ood_*`) present. Gates (`tsc`, goldens 67) clean.
  - **Next:** M7, `0645_tax_doc_items_dtl.sql` — the last Phase 3 migration.

- **2026-10-24 (M7 drafted, STOP for review — closes Phase 3 once applied):** `0645_tax_doc_items_dtl.sql` (not applied).
  - New table `org_tax_doc_items_dtl` (PLAN.md §6.7): an immutable fiscal-line snapshot, written once per tax document at issue (Phase 8). Unlike M5/M6, this is a brand-new, currently-empty table, so its core columns are `NOT NULL` with real `CHECK`s from day one — there is no legacy-row staging problem to defer past M10 here.
  - Deliberately **no `updated_at`/`updated_by`/`updated_info`** — the plan's own words are "never updated after issue"; those columns would have nothing to ever record. Documented in the migration, not just omitted silently.
  - `line_disc_amount + order_disc_alloc_amount` (the plan's own combined wording) becomes one column, `discount_amount` — a flattened snapshot, matching how a fiscal document shows one discount figure per line.
  - Composite-FK prerequisite: `org_tax_documents_mst` had no `(tenant_org_id, id)` unique either (only `PK(id)`), same situation as `org_tax_profiles_cf`/`org_price_lists_mst` in M5 — added one, tenant-first, same choice.
  - RLS + two indexes added immediately (document read order, reverse item lookup) — unlike M5/M6's deferred indexes, this table's whole purpose from Phase 8 day one *is* being read by document printing, so there's no "wait for a reader" question here.
  - The exact GCC/PINT-OM per-country field list stays Phase 8 scope (P0-12) — this migration implements only the columns PLAN.md §6.7 already names.
  - **Not yet applied.** Stopping for owner review and apply. After apply: `npm run prisma:pull` — **this closes Phase 3 (M5–M7)**. Next: Phase 4, the domain calculator (`lib/commercial/`).

- **2026-10-23 (step 4 done):** Reusable View Phase 1 bug fixes. The order screens read the saved snapshot, zeros included (BF-11 root cause). Voided charges never count (BF-01). Server D005 expected outstanding (BF-02). Snapshot facts in the view (BF-05/06). All linked AR invoices (BF-07). 404 on a missing order (BF-10). Tax-document chain (BF-13). Ready line totals (BF-21). Overpayment allocation goes through the snapshot writer (BF-22). New BF-23 (tenant from `tenants[0]` in 32 routes) is its own package. QA: S8 in [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md). Gates: full Jest 4373/4374 (the one failure is the pre-existing `platform-inventories` drift), ESLint and `tsc` clean on the changed files, `npm run build` passes (exit 0). No migration.

- **2026-10-23 (decisions L22, L23 + PF-21 hotfix):** the owner delegated the P1-01 sign-off ("decide and do your recommendations").
  - **L22 rounding:**
    - exact decimals, no intermediate rounding
    - round once at the end to the currency decimals; the total is the sum of the rounded figures
    - the coin step only on cash tender and change, never on the order total
    - ADR-060 §3 amended; no figure change today
  - **L23 price type and minimum:**
    - FIXED = fixed price per unit (unit × quantity stays); the FIXED products are suits and sarees
    - `min_sell_price` is a floor, rejected with `PRICE_BELOW_MINIMUM` except by an audited override
    - new finding PF-24: 4 products have a default price below their minimum
  - **PF-21 fixed** in `new-order-reducer.ts`: clearing an override restores the price under it, and the express toggle no longer overwrites a typed override (rule #15). Goldens C03 and C03b flipped and added.
  - **Gates:** 84 tests green (goldens + reducer suite), ESLint and `tsc` clean, `npm run build` passes (exit 0).
  - **Concurrency note:** a peer session (`cleanmatex-82`) refactored the checkout pricing path (`getBasePricesForOrder`, `measure`, `checkout-options`). It updated the goldens' mocks only; all money expectations are unchanged and green.

- **2026-10-23 (step 3 done): P1-01 characterization of today's Create money.**
  - **Tests:** 55 goldens in `web-admin/__tests__/characterization/create-money/` (totals with the real tax engine 28, price lookup 10, rows written 8, cart 6, float scan 3). All green; ESLint and `tsc` clean. Exact values only.
  - **Confirmed:** PF-12 (item- and piece-preference charges overwrite each other, both directions).
  - **New findings:**
    - PF-21: clearing an override keeps the overridden price
    - PF-22: FIXED price type and `min_sell_price` are never applied
    - PF-23: item price columns are `numeric(10,3)`; the piece split loses the remainder, 10 ÷ 3 → 9.9999
  - **Float→decimal:** about 1.8% of rate × base results differ by exactly one minor unit (today rounds a true half down). Piece rounding has 0 differences; FD-02 is a remainder issue.
  - **Owner:** sign-off table in [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4.4. No code changed outside tests.

- **2026-10-23 (step 2b done): PF-01 and PF-04 fixed.**
  - **PF-01:**
    - New `lib/services/price-override-policy.service.ts` (`assertPriceOverridesAllowed`): an override requires `pricing:override`, and at submit also a non-blank reason.
    - Called by the submit orchestrator (the use-case layer, so all submit callers are covered) and by `preview-payment` / `preview-financials`.
    - HTTP mapping in `lib/api/price-override-http.ts`: 403 `PRICE_OVERRIDE_NOT_PERMITTED`, 400 `PRICE_OVERRIDE_REASON_REQUIRED`, with line indexes.
    - Create now writes `price_override`, `override_reason`, `override_by`. `override_by` is resolved to the session user's `org_users_mst.id` (tenant-scoped). Verified on the remote DB: the FK targets `org_users_mst.id`, which never equals the auth user id, so writing the auth id would have broken Create.
    - New Order shows bilingual messages for both codes; a coded 403 no longer falls into the generic "cannot create orders" message.
  - **PF-04:** `calculateTaxDetailed` returns `{ lines, exempt }`. `calculateOrderTotals` skips the tenant-VAT fallback when exempt. `calculateTax` keeps its signature.
  - **Tests:** new `price-override-policy.service.test.ts` (6), PF-04 cases in `order-calculation.service.test.ts` (2) and `tax-engine.service.test.ts` (3); all related suites green (Create/preview/tax 64, submission messages 11).
  - **Gates:** ESLint and `tsc` clean on changed files; `check:i18n` passes; `npm run build` passes (exit 0).
  - **QA:** owner scenarios S1–S6 in [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md).
  - **Owner items Q1 and Q2 (PLAN §20):** the owner said "continue" after the recommendations; recorded as accepted (seed product turnaround into the rules; ship the PF-03/04/08 fixes with disclosure). The owner can still override.

- **2026-10-23 (P0 done):** Combined Phase 0 of both plans: four read-only code discovery passes with file:line evidence, remote DB reads and fiscal research.
  - **Findings:** 20 (PF-01…PF-20), including 5 high:
    - PF-01: price override not enforced on Create
    - PF-02: client line prices stored
    - PF-03: double price-list discount in Edit
    - PF-04: exempt orders still taxed
    - PF-07: Edit money model differs from Create
  - **Confirmed** EC-01/02/03/04/08 and LE-01.
  - **ADR-060** accepted.
  - **Plan changes** C1–C14 recorded in PLAN §21, including the hotfix step 2b.
  - **Owner items** Q1 (express turnaround seeding) and Q2 (bug fixes that change figures) in PLAN §20.
  - No code changed.

- **2026-10-23 (v2.1):** Owner resolved all open items.
  - **L18:** HQ is the single writer of `tax_pricing_mode` / `extra_price_pricing_mode` (tenant and branch). The tenant app goes read-only, with server rejection `403 FIELD_MANAGED_BY_HQ`. Branch overrides move to the HQ branch edit page (new §10.3, P7-05).
  - **L19:** speed rule fields are `default_speed_sell_price`, `multiplier_speed`, `turnaround_hh_speed`, chosen by `speed_price_type` (`SELL_PRICE` / `MULTIPLIER` / `FIXED_AMOUNT`).
  - **L20:** the multiplier is an added fraction (10 × 0.30 + 10 = 13). Verified that stored `multiplier_express` values are factors (1.00–2.00), so the seed converts them with `− 1`: 95 `SELL_PRICE` rules and 32 `MULTIPLIER` 0 rules, with no price change.
  - **L21:** `disc_alloc_mode` is tenant-only; fiscal item lines ship in Release A.

  No code changed.

- **2026-10-23 (v2):** Production-readiness audit of v1.2 against the code in both repos. Plan rewritten as v2, closing 17 gaps (PLAN §16):
  - module layers with a pure, domain-agnostic calculator, decimal arithmetic and a calculation version
  - DB integrity (FKs, CHECKs, NOT NULL after recompute)
  - per-line ready-by, tax profile, exemption and reason codes; the gift-card rule
  - line-discount UI, permission and limits
  - fiscal item lines on tax documents
  - missing surfaces: public booking API, custom-item modal, catalog import, bulk pricing; tax profiles are edited in the tenant app, not HQ
  - quote service (no client money math), speed-rule audit, in-use protection and a resolver panel
  - test matrix, releases, rollback and observability

  Verified: HQ reads no order lines; `cmx-api` is unaffected (auth/health only); refunds are amount-level; last ADR is 059 (so ADR-060 is next). No code changed. Three owner items open (PLAN §20).
- **2026-10-23 (v1.2):** Owner decision L17: seed every new setting to today's behaviour. Added the seed table; changed the `disc_alloc_mode` default to `DOCUMENT_LEVEL`; found `multiplier_express` unused in pricing; added P0-07 and extended P0-03. No code changed.
- **2026-10-23 (v1.1):** Owner decision L16: new tenant settings are `org_tenants_mst` columns, edited only in HQ on the Tax & Pricing tab. No code changed.
- **2026-10-23 (v1):** Plan drafted from discussion rounds 1–2 (L1–L15, N1–N3). No code changed.
