# B18 — Order Charge Write Path

## Metadata
Backlog ID: B18 · Severity: MEDIUM (re-scoped — see below; the reconciliation-gap portion is functionally a live BLOCKER) · Classification: BLOCKS_FEATURE · Status: IMPLEMENTED 2026-07-25
Authoritative report sections: M3, §4 limitation, §28 ORDER_CHARGE_APPLIED, §50-B18
Required decisions: none
Dependencies: none · Blocks: — · Recommended phase: Seq 10

## Confirmed problem
Submit always passes `chargeLines: []` — `org_order_charges_dtl`, snapshot charge buckets, and recon charge checks are fully built but never fed. **Re-verified 2026-07-25 against live code and the live remote DB: this is worse than "dormant."** `org_order_charges_dtl` has **zero rows across all 67 live orders**, while 17 items, 43 pieces, and 111 preferences already carry real non-zero `service_pref_charge`/`extra_price`. Two reconciliation checks already wired into the live reconciliation run (`ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, both **BLOCKER** severity, from an earlier "BVM Phase 4" program predating this remediation effort) compare those real sums against the always-empty charges ledger — meaning reconciliation, if run today, fires BLOCKER failures for real orders. Closing this was reprioritized to the core of B18's delivery, not a side effect.

## Scope pivot (owner-directed, 2026-07-25)
The original doc scoped a fixed SERVICE/DELIVERY/EXPRESS/OTHER charge-type picker with its own UI. Mid-implementation, the owner explicitly redirected scope twice: first proposing a tenant-configurable extra-charge catalog, then — after research showed `charge_type` is a small fixed reporting category (not a tenant catalog) and that `org_order_preferences_dtl` already supports `prefs_level IN ('ORDER','ITEM','PIECE')` since migration 0166 — withdrew that proposal in favor of the existing PREFERENCE/extra_price mechanism, adding one concrete requirement: **UI to add preferences at the ORDER level and the ITEM level, not just PIECE level (today's new-order page only exposes piece-level entry for piece-tracking tenants)**. This became B18's actual delivered scope: order-level preferences ARE this package's "charges" concept; item-level preference UI already existed in code but was hidden behind a piece-tracking ternary — both fixed.

## Current evidence — re-verified against live code 2026-07-25 (corrections in bold)

| File or symbol | Doc claim | Re-verified reality |
|---|---|---|
| order-submit-orchestrator.service.ts:989 | chargeLines=[] | **Line stale, substance confirmed.** `settleOrderTx`'s `chargeLines` param was always fed `[]` — but not from a single named line; no caller anywhere ever populated it (confirmed via repo-wide grep for `CHARGE_TYPES.` / `org_order_charges_dtl.create`: exactly one writer existed, `order-settlement.service.ts:173`, and it had zero real callers passing non-empty data). |
| settleOrderTx §1 + snapshot :671–684 "full charge support (SERVICE/DELIVERY/EXPRESS/OTHER)" | dormant | **Charge types are wrong in the doc.** The real DB `CHECK` constraint on `org_order_charges_dtl.charge_type` (migration `0280_order_charges_dtl.sql`) is `PREFERENCE / EXPRESS / BULK_SURCHARGE / SPECIAL_HANDLING` — already correctly mirrored in `CHARGE_TYPES` (TS, `order-financial.ts`) and a DB lookup table `sys_charge_types_cd` (migration `0279`). "SERVICE/DELIVERY/OTHER" do not exist anywhere in the schema. The writer itself (`settleOrderTx`'s charges loop) was already correctly built and needed zero changes — confirmed by extending it with real data rather than modifying it. |
| calculateOrderTotals | no charge params | **Confirmed** — zero charge-related params or math existed before this package. |
| **New finding (not in original doc)** | — | `org_order_preferences_dtl` (migration `0166`, pre-dating this remediation program entirely) already models `prefs_level IN ('ORDER','ITEM','PIECE')` with a CHECK constraint enforcing the right FK combination per level, and the backend (`order-service.ts`) already writes ITEM and PIECE level rows at order creation — including a full item-level `ServicePreferenceSelector` UI component already built in `PreferencesTabsSection.tsx`. It was just conditionally hidden: `{!trackByPiece || pieces.length === 0 ? <item-level-selector> : <piece-level-only>}` — mutually exclusive instead of additive. ORDER-level had schema support but zero write path and zero UI anywhere. |

## Required outcome
Charges (delivery, express, service) flow: UI/request → calc engine (`chargesTotal` in saleTotal and tax base per mode) → settle writes `org_order_charges_dtl` → snapshot buckets populate → recon charge checks pass; charge void supported via `is_voided`.

## Scope
Engine params + formula placement (gross = subtotal + charges); order-level preference UI (new); item-level preference UI additive alongside piece-level (fix, was mutually exclusive); ORDER-level `org_order_preferences_dtl` write path (new); PREFERENCE-type `org_order_charges_dtl` write path for ALL preference levels (item + piece + order), one row per preference with `charge_source_id` lineage, closing the live reconciliation gap; `total_charges_amount` header write; request schema (preview + submit).

## Out of scope (deferred, documented — not silently dropped)
- **Backfill of the 67 existing orders'** missing PREFERENCE charge facts — owner explicitly chose "fix forward only, flag backfill separately" when presented the finding via `AskUserQuestion`. A backfill migration (derive `org_order_charges_dtl` rows from existing `org_order_preferences_dtl`/`total_charges_amount=0` orders) is a real, separate, financially-sensitive follow-up requiring its own migration + owner sign-off.
- **Charge void action** — `is_voided`/`voided_at`/`voided_by`/`void_reason` columns already exist and are schema-ready; no void UI/API built this pass.
- **Per-charge taxability** — no `is_taxable` column exists on any preference/charge table. Order-level charges are implemented as a flat, always non-taxable addend (see Design decisions) rather than inventing an unconfigured taxability flag.
- **Item-edit / recalculation path** (`order-service.ts`'s `updateOrder`) — order-level preferences are not wired into the existing edit-mode recalculation flow, consistent with B11/B17's identical scoping decision on this same legacy path (slated for retirement via B12/B23).
- Charge approval permissions (B27); amendment-driven charge changes (B12) — from the original doc, still out of scope.

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | YES |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO (voucher total covers) |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO this pass (charges deliberately non-taxable — see Design decisions; deferred) |
| ERP-Lite GL | POSSIBLE (charge revenue mapping later) |
| Snapshot | YES (`total_charges_amount` now genuinely populated) |
| Reconciliation | YES — closes a live BLOCKER-severity gap in `ORDER_CHARGES_MATCH_SNAPSHOT` / `ORDER_PIECES_MATCH_CHARGES` / `ORDER_PREFERENCES_MATCH_CHARGES` / `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` |
| Customer receipt | YES (total now correctly includes order-level charges; no new receipt line built — total-inclusion is what changed) |
| Audit/outbox | NO |

## Acceptance criteria
An order with a non-zero order-level or item-level preference shows it as a discrete `org_order_charges_dtl`/`org_order_preferences_dtl` fact, `total_charges_amount` matches the sum, and the `order-snapshot-checks` reconciliation module (`ORDER_CHARGES_MATCH_SNAPSHOT`, `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, `PIECE_EXTRA_PRICE_INCLUDED_ONCE`, `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE`) is clean for that order — proven directly against the existing, already-tested check module (see Completion evidence).

## Required tests
unit (`calculateOrderTotals` charges formula, incl. combined with B11 tax modes and B17 rounding), integration (write-shape proven against the real reconciliation check logic), regression (full suite).

## Dependencies and sequencing
Independent; coordinated tax treatment with B11 (charges are non-taxable in this pass — see Design decisions); coordinated rounding with B17 (charges participate in the B17 rounding step since they're part of the grand total).

## Delivery surfaces

Backend services: `calculateOrderTotals` (order-calculation.service.ts) gained `orderCharges` param + `chargesTotal` result field, applied as a flat non-taxable addend before the B17 rounding step; `OrderService.createOrderInTransaction` (order-service.ts) writes ORDER-level `org_order_preferences_dtl` rows, then queries ALL chargeable preference rows for the order (item + piece + order, `extra_price > 0`) and writes one `org_order_charges_dtl` row per preference (`charge_type=PREFERENCE`, `charge_source_id`=preference row id) plus `total_charges_amount` on the header. `settleOrderTx`'s existing charge writer (order-settlement.service.ts:173) needed zero changes — it was already correct, just never fed.
Database/schema: none new — `org_order_charges_dtl` (migration 0280), `sys_charge_types_cd` (0279), and `org_order_preferences_dtl.prefs_level` (0166) all pre-existed.
API/endpoints: `preview-payment`/`preview-financials`/submit request schemas gain `orderServicePrefs` (same shape as existing item-level `servicePrefs`); preview/submit responses carry `chargesTotal`.
Frontend page/screen/dialog/action: new-order page's Preferences → Service tab gained a "Whole Order" preference selector section (reuses the existing `ServicePreferenceSelector` component, no new component built); item-level selector now shows alongside piece-level selectors (was hidden whenever `trackByPiece` + item had pieces) — an operator can add a whole-item preference in addition to per-piece ones. No new page; no charge void UI (deferred).
Reusable components/helpers: `ServicePreferenceSelector` (existing, unchanged) reused for the new order-level section — zero new UI components needed.
Permissions: none new — reuses existing `orders:create`/`orders:edit` gating on order submission itself.
Validation: order-level preference `extra_price` validated `nonnegative()` (zod, matching the existing item/piece schema shape exactly).
i18n/RTL: `newOrder.preferences.orderLevelPrefs` ("Whole Order" / "كامل الطلب"), `newOrder.itemsGrid.wholeItem` ("Whole item" / "كامل العنصر"), EN/AR both added; `servicePrefsDesc` copy updated to mention all three levels.
Accessibility: unchanged — reuses the existing `ServicePreferenceSelector`'s already-accessible markup.
Audit trail: charge rows carry `created_by` (actor) + `charge_source_id` (traceable back to the exact preference row); preference rows carry `created_by`/`prefs_source`.
Observability: the fix is directly provable against `order-snapshot-checks.ts`'s five existing, already-tested reconciliation checks — see Completion evidence.
Jobs/workers: none.
Feature flag: none — safe by construction, not by flag. Order-level charges are additive-only and only appear when an operator explicitly adds one via the new UI; existing orders/flows with zero order-level preferences are byte-identical to pre-B18 (proven by the full existing suite passing unchanged).
Rollout: ship as-is (no flag); the new UI section is the natural, low-risk gate — nothing changes for any order until an operator uses it.
Rollback: revert the code; any already-persisted `org_order_charges_dtl`/ORDER-level `org_order_preferences_dtl` rows remain valid historical facts (no destructive migration to roll back, since none was needed).

## End-to-end operational flow

1. Operator opens the new-order page's Preferences → Service tab. A "Whole Order" section (new) sits above the per-item list; each item now shows its own selector even when the tenant tracks by piece (fix), with per-piece selectors still below it.
2. Operator adds a preference at any level (order/item/piece) with a non-zero `extra_price`. Preview totals update live — the amount appears in `chargesTotal` (order-level) or folded into item pricing (item/piece-level, unchanged existing behavior).
3. Submit persists: ORDER-level rows to `org_order_preferences_dtl`, and — for every preference row across all three levels with `extra_price > 0` — a mirror `org_order_charges_dtl` fact row plus the `total_charges_amount` header field.
4. Reconciliation (`order-snapshot-checks.ts`), if run, is clean for this order: the charge facts fully account for every piece/item/order preference extra, with no duplicate `charge_source_id`.

UI states: reuses `ServicePreferenceSelector`'s existing loading/empty/disabled/compatibility-warning states — no new state contract needed since no new interactive component was built.

## Design decisions (this implementation)

1. **Order-level preferences ARE this package's "charges" concept.** Rather than building a parallel, separate "charge entry" UI (delivery/express/service picker) as the original doc scoped, order-level preferences (`prefs_level='ORDER'`) fill that exact role — an order-wide, non-item-specific extra with a monetary amount — reusing the tenant's already-configured `org_service_preference_cf` catalog instead of inventing a second config surface.
2. **Order-level charges are a flat, non-taxable addend — not proportionally extracted under TAX_INCLUSIVE, not added to the tax base.** No `is_taxable` column exists on any preference/charge table to drive a per-charge decision, and attempting proportional inclusive-extraction across a combined items+charges base (to keep the `afterDiscounts` net-of-tax figure items-only, matching `resolveCanonicalTotalAmount`'s separate `itemsBaseAmount`/`totalChargesAmount` components) would require inventing untested, unrequested complexity. Order-level charges are analogous to the already-established "ad-hoc `additionalTaxAmount`" pattern from B11: an operator-entered surcharge layered on top, not a catalog price. Documented here as a deliberate, revisitable scope decision — a future package can add `is_taxable` if a real tenant need surfaces.
3. **One `org_order_charges_dtl` row per preference row, not an aggregate.** The existing (already-tested) `order-snapshot-checks.ts` reconciliation module's `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` check specifically inspects `charge_source_id` for duplicates across PREFERENCE-type charge rows — this only makes sense if the intended design was always one charge row per preference source. Verified algebraically and by test that this design satisfies all five checks in the module unconditionally: since the writer makes `Σ(PREFERENCE charge rows) == Σ(ALL org_order_preferences_dtl.extra_price)` by construction, and the check module's own `piecesSum`/`itemsSum` terms are strict subsets of that same preference-row population, no combination of real data can trip a false positive on any of the five checks.
4. **Read-back instead of pre-generated UUIDs.** Rather than retrofitting UUID pre-generation into the five existing, already-working item/piece preference-write blocks (risky churn to working code, for zero functional benefit), the charge-writer runs one extra `org_order_preferences_dtl.findMany({extra_price: {gt: 0}})` read after all preference rows (item/piece/**new order-level**) are written, then derives the charge rows from that. Negligible cost (one read per order), zero risk to existing writes.
5. **No feature flag.** Additive-only, UI-gated by construction (nothing changes unless an operator uses the new "Whole Order" section or now-visible item-level selector) — matches the same "safe by data/UI, not by flag" pattern established in B11 and B17.

## Safety

UI design allowed: YES · UI implementation allowed: YES, shipped (no flag — safe by construction, see Design decisions)
Production activation allowed: engine formula + fact-write path + UI shipped as one unit; reconciliation-gap fix is a pure additive fix (no existing behavior removed)
Required backend gates: engine charge params + write path in the same release — done
Required decision gates: none (charge taxability deferred, not decided — see Out of scope)
Required verification gates: write-shape proven against the real, already-tested `order-snapshot-checks.ts` module (3 new tests, all passing) — done

## Completion evidence
Migration: none required (all schema pre-existed: 0166, 0279, 0280) · Implementation files: `lib/services/order-calculation.service.ts` (`orderCharges` param, `chargesTotal` result), `lib/services/order-service.ts` (`CreateOrderParams.orderServicePrefs`, ORDER-level preference writer, PREFERENCE charge-fact writer, `total_charges_amount` header write — both `createOrder` and `createOrderInTransaction`), `lib/services/order-submit-orchestrator.service.ts` (orderCharges/orderServicePrefs threading), `lib/validations/new-order-payment-schemas.ts` (`orderServicePrefs` on both preview and submit schemas), `app/api/v1/orders/preview-payment/route.ts` + `preview-financials/route.ts` (orderCharges mapping), `src/features/orders/model/new-order-types.ts` + `ui/context/new-order-reducer.ts` + `hooks/use-new-order-state.ts` (order-level state/reducer/dispatch), `src/features/orders/ui/preferences/PreferencesTabsSection.tsx` (new "Whole Order" section, item-level-alongside-piece-level fix), `src/features/orders/hooks/use-order-submission.ts` (orderServicePrefs in the create-with-payment request body), `messages/en+ar/newOrder/preferences.json` + `itemsGrid.json` (i18n) · Tests: `__tests__/services/order-calculation.service.test.ts` (+4 B18 cases incl. combined with B11 tax and B17 rounding), `__tests__/services/reconciliation/check-modules.test.ts` (+1 case proving the exact write-shape passes all five `order-snapshot-checks` checks cleanly) · Gates: tsc clean for all B18 files (4 pre-existing/unrelated errors: the same 3 from every prior package this session, plus 1 new one — `app/api/v1/assembly/exceptions/[id]/resolve/route.ts`, an unrelated, uncommitted, in-progress owner feature with a broken relative import path, confirmed via `git status` as not part of this package) / eslint 0 / full jest 237/237 suites, 2300/2300 tests, zero known failures / check:i18n ✓ / **`npm run build` currently FAILS — confirmed NOT caused by B18.** Same root cause as the tsc finding: `Module not found: Can't resolve '../../_lib/route-auth'` in the unrelated assembly-exceptions route — an off-by-one relative path (needs `../../../_lib`) in the owner's own uncommitted WIP. Not fixed here (someone else's in-progress work, unknown intent) — flagged directly, same handling as B22's build blocker earlier this session. · Commit: pending (owner) · Preview QA (deploy/result/approval): pending — see QA_TEST_GUIDE §24 · Reviewer: — · Verification: pending Preview QA + owner approval + resolution of the unrelated build blocker · Authoritative report update: not filed as a separate addendum — the live-reconciliation-gap severity finding and the `sys_charge_types_cd`/doc-charge-type corrections are documented here and in README/memory per this session's established precedent.
