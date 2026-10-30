# Line-Level Money Snapshot — STATUS

**Plan:** [PLAN.md](PLAN.md) · **Discussion:** [DISCUSSION.md](DISCUSSION.md)
**Overall:** APPROVED by owner 2026-10-23 (v2.1). In execution. Migrations 0639–0645 (M1–M7) applied 2026-10-24; 0646 (exempt-reason seed) applied 2026-10-24; next free number 0647.

## Remaining work (consolidated 2026-10-24, re-checked 2026-10-30)

Repos: **T** = `cleanmatex` (tenant app), **HQ** = `cleanmatexsaas`, **M** = `cmx_mobile_apps`. Order: P6-02 → P6-03 → P6-04 → Reusable View P1B-05/11/15/10/12/13 → P7 → P8 → P9 → P10 → P11, with Reusable View P2–P9 after its P1B (execution order below).

The one place that lists everything left in this plan and in Reusable Order Fin View (they run as one sequence). Update it with every increment.

**This plan (Line-Level):**

| Phase | Left |
|---|---|
| P4 calculator | ✅ Done 2026-10-24 (P4-01…P4-06) |
| P5 services + Create | ✅ P5-01 done 2026-10-24 · ✅ P5-02 done 2026-10-25 (payment quote + submit + Create on the calculator) · P5-03 New Order UI, split into steps: ✅ **P5-03a** done 2026-10-27 (cart totals and ready-by from the server quote, BF-19/D33, L25 note) · ✅ **P5-03b** done 2026-10-28 (speed selector from `sys_service_speed_cd`, per-line speed + "Apply to all lines", quoted line prices, re-price note) · ✅ **P5-03c** done 2026-10-28 (line discount gated by `orders:discount`, with reason; expandable line breakdown) · ✅ **P5-03d** done 2026-10-28 (per-line `PRICE_CHANGED`, G15 promo note, in-place re-price) · ✅ **P5-03e** done 2026-10-28 (custom items with no catalog product). **P5 complete.** ← **next** P6-01 (Order Edit writes on the calculator) |
| P6 Edit parity | P6-01 every Edit write path, in steps: ✅ **P6-01a** done 2026-10-28 (Edit facts loader on the calculator) · ✅ **P6-01b** done 2026-10-28 (Preview on the calculator) · ✅ **P6-01c** done 2026-10-28 (Apply writes the calculated order) · ✅ **P6-01d** done 2026-10-28 (older orders and the legacy update) · ✅ **P6-01e** done 2026-10-28 (real-database proof and docs) — **P6-01 complete** · ← **next** P6-02 Edit UI line controls |
| P6-03 VAT setting retirement | Right after P6-02: run [VAT_Settings_Fallback_Retirement_Plan.md](VAT_Settings_Fallback_Retirement_Plan.md) (owner approved in principle, "retire all"; scheduled 2026-10-28). Remove the `TENANT_VAT_RATE` fallback from the old calculator and every reader (its R3 list), including the booking bootstrap `vatRate` field. Per that plan, steps that need a migration stop and wait. |
| P6-04 mobile booking codes | After P6-03, in the separate `cmx_mobile_apps` project: map the new booking errors (`booking_piece_invalid`, `SERVICE_SPEED_INVALID` and the calculator codes) to EN/AR messages; show the returned `totalAmount` on the booking confirmation; optional speed choice through `serviceSpeed`. |
| P7 configuration | P7-01 Speed Pricing screen + M8 permissions (0647) + M9 navigation (0648) + access contract · **P7-02 HQ repo:** Tax & Pricing card, `platform-api` DTO/service, branch overrides, HQ progress doc · P7-03 tax rounding fields · P7-04 product form / import / bulk pricing · P7-05 tenant-app single writer (`403 FIELD_MANAGED_BY_HQ`) |
| P8 readers | P8-01 all order reads, receipt, portal, prints, reports · P8-02 tax-document issuance writes `org_tax_doc_items_dtl` |
| P9 (Release B) | P9-01 per-piece discount/speed · P9-02 enable `PIECE` in HQ |
| P10 | P10-01 remove obsolete recalc and the legacy money services: `preview-financials` (legacy `calculateOrderTotals`), `estimate-ready-by`, the legacy `express` boolean update API, `order-preference-charge-recalc` · P10-02 recompute or delete the demo orders made before the calculator (dry-run first) · P10-03 M10 NOT NULL + CHECK, M11 drop retired columns |
| P11 | Gates in both repos, QA guide per scenario, feature documentation pack, final docs in this folder (README, developer and user guides EN/AR, CHANGELOG), Order_Fin root docs + glossary + ADR-060 status, HQ docs (P11-03…06) |

### P6-01 plan (approved by owner 2026-10-28)

**Approved 2026-10-28:** both recommendations. P6-01 takes Reusable View P1B-04, 06, 07, 08 and 09. Orders from before the calculator are refused for money edits (`ORDER_NEEDS_RECOMPUTE`); the owner will delete the demo test orders, so P10-02 has nothing to convert on remote.

**Finding (why the steps are cut this way):** P6-01 cannot be done on the write side only. Apply writes exactly what Preview reviewed (the proof binds the fingerprint, and `assertCommercialSnapshot` compares the header total with the reviewed total). So the calculator has to produce Preview's figures first. That work is Reusable View P1B-04 (recorded-instructions loader), P1B-06 (recorded tax), P1B-07 (new-line price), P1B-08 (wire Preview and Apply) and P1B-09 (header-only edits). These steps change the same seven Edit files that PHASE0_FINDINGS gives to both programs. **Proposal:** do them here as P6-01a–e. Reusable View keeps P1B-05 (discount re-evaluation), P1B-10 (loyalty), P1B-11 (Review disclosure) and P1B-12 (parity suite). P1B-14 (Edit `confirmedUnitPrice`) moves to P6-02.

**Facts checked:**
- Remote: 13 orders, 25 items, all from before the calculator: no `commercial_calc_version`, no `list_unit_price`, no `net_amount`.
- The only writer of money on a committed order is Edit V2 Apply (`order-change-apply.service.ts`). The legacy routes are retired for committed orders by `order-change-legacy-writer-guard.ts`.
- The legacy full-replacement update (`app/api/v1/orders/[id]/update`, `edit-order-schemas.ts` `express` boolean) still writes uncommitted orders.

| Step | Work |
|---|---|
| P6-01a | **Edit facts loader** (`commercial-edit.loader.ts`). It reads the order snapshots (level, tax mode, extra-price mode, allocation mode and basis, calculator version, order speed, received time, branch, customer). It also reads the active items and pieces with their stored line money (list price, price list, speed rule and premium, speed, price source, override), the active preferences with their stored price, the active order discount rows and the recorded tax profiles and rates. Every query filters `tenant_org_id`. It builds the calculator input from the projected structure (L24):<br>• An unchanged line keeps its list price and speed premium, and its ready-by is unchanged.<br>• A line whose speed changed uses the speed rule in force on the edit date, applied to its stored list price, and its ready-by is counted again from the order's received time.<br>• A changed quantity keeps the line's unit list price.<br>• A new line uses the catalog price on the edit date, from the same loader as Create.<br>• Stored preferences keep their price. New preferences come from the catalog.<br>• Recorded order discounts are kept as recorded: a percentage is applied again, a fixed amount is kept. Re-evaluation stays in P1B-05.<br>• Tax uses the order's recorded profiles and rates (D22). An order with no recorded tax context is refused, never guessed.<br>This needs a "pinned price" input in `buildCommercialOrderInput` (the loader resolves prices only for new or re-speeded lines); no second calculator. |
| P6-01b | **Preview on the calculator:** projected total, tax and lines come from the calculator result, and so does the fingerprint. A header-only edit is not re-priced: the projected total stays the current total (EC-08, P1B-09). The speed audit lists each line's price and ready-by before and after. `order-change-calculation.service.ts` (today's single VAT rate, float tax) loses its last caller and is deleted. |
| P6-01c | **Apply writes calculator output** (`commercial-edit.writer.ts` on `lineMoneyColumns` and `buildCommercialChildRows`):<br>• the §6.1 columns on each touched item and piece; an ALLOCATED piece set is re-allocated when its item changes (fixes PF-12, PF-26);<br>• the discount, charge and tax rows of the order are replaced: the old rows are voided or inactivated, never deleted, so the audit keeps them;<br>• the header comes from the rollup, and `assertCommercialSnapshot` stays as the last guard;<br>• `writeOrderSpeedCharge` (`EXPRESS` charges), `syncReviewedTaxLine` and `allocateReviewedTax` are removed;<br>• the operation audit reads the written figures (PF-26). |
| P6-01d | **Orders from before the calculator and the legacy update:**<br>• Edit V2 refuses a money operation on an order with no `commercial_calc_version`, with the code `ORDER_NEEDS_RECOMPUTE` and an EN/AR message. Header-only edits (notes, ready-by, priority) still work. P10-02 converts the 13 demo orders. No second Edit money writer is kept (pre-launch, PLAN P10-02).<br>• The legacy full-replacement update refuses money fields (`express`, prices, quantity, products) on an order with `commercial_calc_version`, so only Edit V2 writes its money. |
| P6-01e | **Tests and docs:**<br>• Create, then an Edit preview with no operations, gives exactly the Create figures.<br>• Preview = Apply = rollup for: add a line, remove a line, change a quantity, change the speed (PF-26 regression), add and remove a preference, change an override, and a header-only edit.<br>• No `EXPRESS` charge is written.<br>• Pieces are re-allocated.<br>• An order from before the calculator is refused.<br>• Gates: jest, `tsc`, ESLint, `check:i18n`, build. Docs: STATUS, PLAN, Reusable View STATUS, the Order Edit V2 pointer, and memory. |

No migration is expected: every column exists since M3–M7. If P6-01a finds a missing column, I stop and write the SQL only.

**Reusable Order Fin View (T):**
- Phase 1B, done: P1B-01 (here P1-01), P1B-03 (here P4), P1B-04/06/07/08/09 (here P6-01), P1B-14 Create part (here P5-03d).
- Phase 1B, left:
  - P1B-14 Edit part (`confirmedUnitPrice` in Edit) → here P6-02.
  - P1B-05 discount re-evaluation on Edit (D21). Today recorded discounts are re-applied as recorded.
  - P1B-11 review dialog: every discount change line by line, acknowledgment for removals (rule #15).
  - P1B-15 one loyalty-earn reconciliation for every settle path (D27), then P1B-10 Edit Apply calls it (D24).
  - P1B-12 full parity suite: Preview = quote = Apply = snapshot. The Edit part is proved by `order-change-edit-parity.db.test.ts`.
  - P1B-13 Order Edit V2 docs. The WP08 pointer is done; Open Decisions D21–D24 and the Test Guide parity scenarios are left.
- Then: P2 indexes/permission seed → P3 read model → P4 APIs/access → P5 shared component (**owner mockup sign-off first**) → P6 page migration → P7 hardening → P8 rules/skill → P9 docs.

**Owner decisions and actions:**
- Sign off the P1-01 characterization table ([P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4.4).
- Tax adviser (SA, OM): does redeeming the shop's own loyalty points lower the VAT base (Q3)?
- Catalog cleanup: 6 products with NULL `price_type`; PF-24 (4 products priced below their minimum).
- Delete the demo orders made before the calculator (agreed 2026-10-28).
- Approve and apply each migration as it comes (P6-03 if needed, M8/M9 in P7-01, M10/M11 in P10-03).
- Reusable View mockup sign-off before its P5.
- Commit the work: nothing from 2026-10-24 on is committed yet.

**Follow-ups found along the way (not in a phase yet):**
- BF-23: 30 routes skip session validation and permission checks (tenant is correct: one membership per user). Its own package: [API_Route_Auth_Hardening](../../API_Route_Auth_Hardening/PLAN.md).
- `org_price_history_audit.entity_type` must accept `'speed_rule'` (lowercase): in the P7-01 migration.
- `ready_at` on items/pieces has no writer yet: the fulfillment workflow should set it (outside this plan).
- Owner catalog cleanup: 6 products with NULL `price_type`, PF-24 (4 products priced below their minimum).
- Owner: P1-01 sign-off table ([P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4.4) is still open for review (decisions were delegated and recorded).
- Pre-existing, not ours: `platform-inventories` test drift.
- Not ours (2026-10-30): `order-change-edit-policy-resolution` and `order-change-reviewed-snapshots` DB suites fail in the Edit Policy resolver after the parallel Edit Policy work (migrations 0654–0658, `order-change-context.service.ts`, `order-change-policy-revalidation.service.ts`). Their fixtures are updated there.
- Owner: ask the tax adviser (SA, OM) whether redeeming the shop's own loyalty points lowers the VAT base. Q3 was approved 2026-10-24: keep it as a payment for Release A; if the adviser confirms, it becomes an ORDER adjustment.
- After Release A: promos on some lines only, promo stacking groups, buy-X-get-Y (PLAN §8.6).
- `app/api/v1/orders/preview-financials` still prices through the legacy `calculateOrderTotals` (no screen calls it today). Retire it with the legacy service in P10-01, or move it to `quoteCheckout` if a caller appears.
- ✅ Resolved 2026-10-28 (P6-01c): Order Edit no longer writes `EXPRESS` charges or legacy totals; it stores the calculated order.
- Product cards show the standard price (with "Express price is shown in the cart" when the order speed is not Standard): a per-speed card price needs the speed-rule resolver endpoint of P7-01 (`/api/v1/catalog/speed-rules/resolve`). Revisit in P7-01.
- Order Edit sets the order speed through the same menu, but its change contract (`setServiceSpeed`, Edit view model) still types speeds as `STANDARD | EXPRESS`, and it has no per-line speed: P6-02 widens it to the catalog and adds the line menu. The legacy Edit update API still takes an `express` boolean, but since P6-01d it refuses every order written by the calculator; only draft or pre-calculator orders reach it, and it retires with the legacy services in P10-01.
- ✅ **Resolved 2026-10-28 (owner approved):** the order-level manual discount now needs `orders:discount` like a line discount (log entry below). Cashier and receptionist roles do not hold it by default; grant it per user or role if a shop wants cashiers to discount.
- Line discount reasons are free text (stored in `org_order_discounts_dtl.rec_notes`, like the price override reason). A reason-code catalog would need a new `sys_*` table: add it only if reporting by reason is wanted.
- **Custom items (P5-03e):** the custom-item modal still uses raw `<input>` fields (pre-existing); move it to `CmxInput` / `CmxMoneyField` with the next UI pass on New Order. The `.env.local` variables `NEXT_PUBLIC_CUSTOM_ITEM_DEFAULT_PRODUCT_ID` and `NEXT_PUBLIC__CUSTOM_IIEM_USE_DEFAULT_ID_OR_CREATE_NEW_PRODUCT` are no longer read and can be deleted. Order Edit cannot add a custom line yet, and its change contract assumes a product id: P6-02.
- `POST /api/v1/orders/estimate-ready-by` (legacy `OrderService.estimateReadyBy`, tenant from `get_user_tenants()[0]`, no permission check) has no screen caller since P5-03a. Retire it with the legacy services in P10-01 (with `lib/api/orders.ts` `estimateReadyBy`).

## Execution order (approved 2026-10-23)

Both plans run as one sequence, because they change the same files.

| Step | Work | Status |
|---|---|---|
| 1 | Security first: Reusable View BF-09, BF-16 (+ mobile detail route), BF-20 | ✅ Done 2026-10-23 |
| 2 | Combined Phase 0 of both plans + ADR-060 (no code) | ✅ Done 2026-10-23: [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md), [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md) |
| 2b | Hotfix: PF-01 (price override not enforced on Create) + PF-04 (exempt orders taxed) | ✅ Done 2026-10-23 |
| 3 | Characterization tests on Create (this P1-01 = Reusable View P1B-01) | ✅ Done 2026-10-23: [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) (owner sign-off §4 pending) |
| 4 | Reusable View Phase 1 bug fixes (BF-19 moves to this P5-03) | ✅ Done 2026-10-23: [Reusable View STATUS exec-3](../Reusable_Order_Fin_View/STATUS.md) |
| 5 | This P2–P6, then Reusable View P1B-04…12 | In progress: Phases 2–3 done (M1–M7 applied); Phase 4 done; Phase 5 done (P5-01, P5-02, P5-03a–e); P6-01 next |
| 5b | VAT setting retirement (P6-03), then the mobile booking codes (P6-04); both after P6-02 | Scheduled 2026-10-28 (owner) |
| 6 | Reusable View P3+ (read model, component) | — |
| 7 | This P7–P8 (incl. HQ), then the releases of both plans | — |
**Downstream dependency:** Reusable Order Fin View Phase 1B builds on this plan (owner L13).

| Phase | Title | Release | Status | Notes |
|---|---|---|---|---|
| P0 | Discovery and ADR-060 | A | ✅ Done 2026-10-23 | 20 findings (PF-01…PF-20), plan changes C1–C14 (PLAN §21), 2 owner items (PLAN §20) |
| P1 | Freeze Create (characterization tests) | A | ✅ Done 2026-10-23 | 55 goldens; owns Reusable View P1B-01; sign-off list in P1_01_CHARACTERIZATION.md §4 |
| P2 | Configuration DB (M1–M4) | A | ✅ Done 2026-10-24 (M1–M4 applied) | All 4 migrations applied local+remote, types regenerated each time. See log entries. |
| P3 | Line-money DB (M5–M7) | A | ✅ Done 2026-10-24 (M5–M7 applied) | All 3 migrations applied local+remote, types regenerated each time |
| P4 | Domain calculator (`lib/commercial/`, pure, decimal) | A | ✅ Done 2026-10-24 (P4-01…P4-06) | Owns and extends Reusable View P1B-03 |
| P5 | Services + Create | A | ✅ Done 2026-10-28 (P5-01, P5-02, P5-03a–e) | One writer |
| P6 | Order Edit V2 write parity | A | In progress: ✅ P6-01 done 2026-10-28; P6-02 next | Same release as P5 |
| P7 | Configuration UI (tenant app) + HQ card | A | Not started | Nav dual-write, permissions, access contract |
| P8 | Readers + fiscal item lines | A | Not started | `org_tax_doc_items_dtl` (owner item §20-3) |
| P9 | PIECE level enablement | B | Not started | `PIECE` disabled in HQ until P9-01 |
| P10 | Recompute, tighten (M10), drop (M11) | A / C | Not started | |
| P11 | Verification and docs (both repos) | A–C | Not started | |

## Log

- **2026-10-30 (remaining work re-checked, docs only):** The owner asked for everything left to close both plans in both repos. "Remaining work" now names the repo of each item, the order (P6-02 → P6-03 → P6-04 → Reusable View P1B → P7–P11), the Reusable View Phase 1B items still open, the owner decisions, and the legacy services P10-01 removes. The phase table's P6 row was stale ("Not started") and is corrected. PLAN Phase 6 gains P6-03 and P6-04. Reusable View STATUS gets the same list. No code changed.

- **2026-10-28 (one Create writer: booking on the calculator, PF-11 / C9 closed; old Create paths removed):**
  - **Audit (owner asked):** three old Create writers were still reachable.
    - `POST /api/v1/orders` (`orders:create`) stored the prices, totals and tax the client sent. Nothing in the app called it.
    - The customer mobile booking (`POST /api/v1/public/customer/booking`) priced the order itself. It used `TENANT_VAT_RATE` × subtotal, the catalog default price, and extra × quantity; it had no speed support. PF-11 / C9 had been assigned to P5 but was not done.
    - Server action `app/actions/orders/create-order.ts` → `lib/db/orders.ts` `createOrder`: a third writer with no callers.
  - **Owner approved all three steps; done the same day.**
  - **New `lib/services/order-create-from-checkout.service.ts`:** the shared quoted-create steps.
    - `checkoutCreateTotals` and `checkoutBreakdown` (moved out of the submit orchestrator).
    - `issueSubmitTaxDocumentTx`: the tax-document trigger now runs inside a **savepoint**. Before, a failing statement inside the try/catch would have aborted the whole Postgres transaction although the code meant it as non-blocking.
    - `commitInitialOrderTx`: the conditional initial commitment; `committedBy` may be null.
    - `createUnpaidOrderFromCheckout[Tx]`: quote → `createOrderInTransaction` → `settleOrderTx` (no legs) → tax document → commit, in one transaction.
    - The submit orchestrator uses the same helpers (no behaviour change).
  - **Booking now prices through `quoteCheckout`** and creates through `createUnpaidOrderFromCheckout`.
    - It sends codes and quantities only; tenant preference prices, price lists, tax profiles and speed rules all apply as at the counter.
    - New optional request field `serviceSpeed` (a `sys_service_speed_cd` code; it is part of the duplicate signature and stored in `customer_details`). An unknown speed answers 400 `SERVICE_SPEED_INVALID`. Every quote error uses the shared `checkoutQuoteErrorResponse`.
    - Pieces are placed by `pieceSeq`. Before, they were placed in array order, so a piece could land on the wrong slot. A `pieceSeq` above the quantity, a repeated one, or pieces split over two lines of the same item answers 400 `booking_piece_invalid`.
    - The response adds `totalAmount` and `currencyCode` (additive). `promisedWindow` stays the pickup time, else the order's ready-by.
    - Booking orders are now **committed** at creation (`committed_by` NULL: it references `auth.users`, and a customer is not one). Before, they stayed uncommitted, so Order Edit refused them, and the legacy writers now refuse calculator orders too, so they could not have been edited at all.
    - `ready_by` comes from the calculator. Before, the pickup time was stored as the ready-by.
    - The bootstrap shows the tenant's packing surcharge (it showed 0 though the order charges it).
  - **Retail guard widened in `createOrderInTransaction`:** a retail-only order is refused when it is paid later, by method (`PAY_ON_COLLECTION`) or by payment type (`PAY_ON_COLLECTION` / `PAY_ON_DELIVERY`). Booking answers with its existing `booking_item_unavailable`. A staff retail sale partly paid with the rest "on collection" is now also refused on the server; the New Order screen already blocked it (T03).
  - **Removed:** the `POST` handler of `app/api/v1/orders/route.ts` (the list `GET` stays; Next.js answers 405), `CreateOrderRequestSchema` and its piece and totals schemas, `OrderService.createOrder`, the server action `create-order.ts`, `lib/db/orders.ts` `createOrder`, `createOrderSchema`, `orderTypeSchema`, `CreateOrderInput`, and `lib/api/orders.ts` `createOrder`, plus the imports only they used. **`OrderService.createOrderInTransaction` is now the only order writer**, always given a checkout quote.
  - **Tests:**
    - New `__tests__/api/public-customer-booking-submit.test.ts` (5): priced through the quote with codes only; pieces by `pieceSeq`; bad pieces refused before pricing; quote error code passed through; retail refused; duplicate returned.
    - Retail guard +2 (payment type, no method). Orders route: `POST` not exported. Submit harness: savepoint statements are not the commitment.
    - DB `order-change-edit-parity.db.test.ts` now creates its order through `createUnpaidOrderFromCheckoutTx`. On real PostgreSQL it proves: committed with `committed_by` NULL, `edit_state_version` 1, outstanding = total, and all 9 Edit scenarios on that order. It also keeps the Create-alone tax check.
  - **Gates:**
    - Full Jest: 4,610 of 4,611 pass; the one failure is the pre-existing `platform-inventories` navigation drift (the same 6 routes).
    - `tsc` 0 errors; `npx eslint . --quiet` clean; `npm run build` passes.
    - Order-change DB suites: 8 of 10 pass, including the parity proof. `order-change-edit-policy-resolution` and `order-change-reviewed-snapshots` fail in the policy resolver (`WORKFLOW_CONTEXT_INVALID`, "two live workflow families"). The cause is the parallel Edit Policy work (migrations 0654–0658, changes to `order-change-context.service.ts` and `order-change-policy-revalidation.service.ts`), not this change; their fixtures need updating there.
    - Platform inventories rebuilt: the removed route is gone and no new drift appeared.
  - **For the mobile app (`cmx_mobile_apps`, a separate project):** the request and response are backward compatible. It may show `totalAmount` after booking and send `serviceSpeed`. New error codes (`booking_piece_invalid`, `SERVICE_SPEED_INVALID` and the other calculator codes) fall back to its generic submit message until it maps them.
  - **Still open:** the bootstrap's `vatRate` display field reads `TENANT_VAT_RATE`; it is listed in [VAT_Settings_Fallback_Retirement_Plan.md](VAT_Settings_Fallback_Retirement_Plan.md) R3.

- **2026-10-28 (P6-01e done: real-database proof and docs; P6-01 complete):**
  - **New `__tests__/db-integration/order-change-edit-parity.db.test.ts`** (local PostgreSQL, one transaction, always rolled back). The order is made by the real Create path (`quoteCheckout` + `OrderService.createOrderInTransaction`, then the settlement rollup). Each edit then goes through the same chain as the routes: `getOrderChangeContext` → `loadOrderChangePreviewFacts` → `previewOrderChange` → `applyOrderChange`. The shared `prisma` client is routed to the fixture transaction; only the HQ flag read, the Supabase cookie client and the currency setting are stubbed.
  - **Proved, in order:**
    1. Create parity: re-pricing the unchanged order gives Create's total, tax and stored line columns exactly.
    2. Header-only edit (notes): no calculator quote, total unchanged (EC-08).
    3. Quantity + new piece: the item is re-allocated over its pieces.
    4. New line, priced from today's catalog.
    5. Add a priced preference, then remove it: the total goes up, then back to the same figure.
    6. Speed to EXPRESS (PF-26 regression): the rule prices the line (2 × 3.000), the pieces add up, the line ready-by is counted again (6 h), and the order ready-by is the latest line's.
    7. Remove a line.
    8. New line at an override price (4.500).
    9. Order from before the calculator: a money edit is refused with `ORDER_NEEDS_RECOMPUTE`; a notes edit still applies.
  - **After every Apply:** the header total equals the reviewed total; every item equals the sum of its pieces (I1); the active tax lines equal the header tax; no active `EXPRESS` charge exists.
  - **Found while writing it, fixed the same day:** Create's first insert stored `total_tax_amount` as the CUSTOM-profile tax only (`additionalTaxAmount`), leaving VAT out, although the VAT was in `org_order_taxes_dtl`. (`org_orders_mst.vat_amount` was dropped in 0335; the `vatAmount` passed to Create was ignored.) Every Create path runs the rollup afterwards (the submit flow's `settleOrderTx` in the same transaction; the older `createOrder` at its end), so no stored order kept a wrong figure, but the first insert was wrong.
    - **Fix:** `createOrderInTransaction` stores the calculator's whole tax (`quote.result.totals.taxTotal`) when the order comes from the calculator. The orchestrator no longer passes `additionalTaxAmount` as `tax`. The unused `vatAmount` totals field is removed from `CreateOrderParams`, the orchestrator, the customer booking route and the tests.
    - `additionalTaxAmount` stays on the payment quote: the payment screen shows it as the non-VAT tax.
    - The DB test checks that the header tax equals the calculator total and the tax lines straight after Create, before any rollup.
    - **Gates:** Create, submit, commercial and payment-quote suites 187 pass; order-change DB suites 10 pass; `tsc` 0; ESLint clean.
  - **Docs:** Order Edit V2 active index has an "Edit money" pointer; WP08 is marked replaced; Reusable View STATUS records P1B-04/06/07/08/09 as done here and P1B-12/13 as partly done.
  - **Gates:** the 6 order-change DB suites pass (10 tests); `tsc` 0 errors; ESLint clean. No production code changed in this step, so the P6-01d build still stands.
  - **Next:** P6-02, the Edit UI line controls.
- **2026-10-28 (P6-01d done: older orders and the legacy update):**
  - **One money writer per calculator order:** `legacyCommittedReplacementDecision` returns RETIRED for any order with `commercial_calc_version`, whatever the Edit V2 flag or commit state. Every legacy money route already calls this guard: the full-replacement update and its server action, batch update, the item and piece preference and packing routes, apply-bundle, fix-order-data and preparation items.
  - **Orders from before the calculator:** Edit V2 refuses a money edit with `ORDER_NEEDS_RECOMPUTE` (P6-01a/b). Header-only edits still work. The owner will delete the demo orders.
  - **EN/AR messages:**
    - `orders.edit.legacyUpdateRetired` is shown by both legacy save paths in `use-order-submission.ts` (before, it was raw English server text).
    - `orders.edit.workspace.pricingError.*` (13 codes) covers `ORDER_NEEDS_RECOMPUTE`, `OVERRIDE_REQUIRED`, and the calculator and loader codes. The Edit V2 workspace shows them for a failed preview (before, a generic "review failed") and for a failed Apply (before, "unknown code"). They are worded for an existing order, separate from the cart's `orderSummary.quote.errors`.
  - **Tests:** guard +1 (a calculator order is retired with the flag off, uncommitted). Edit and order feature suites: 710 pass. `check:i18n`, `tsc` and ESLint pass.
  - **Next:** P6-01e, the closing tests and docs for P6-01 (Order Edit V2 docs pointer, Reusable View STATUS), then P6-02.
- **2026-10-28 (P6-01c done: Edit Apply stores the calculated order; Reusable View P1B-08 Apply part):**
  - **New `lib/services/commercial/commercial-edit.writer.ts`:**
    - `editMoneyColumns` maps the reviewed result to the §6.1 columns of every active item and piece, through `lineMoneyColumns`. Untouched rows move too (an order discount re-split, tax rounding, piece re-allocation), so all of them are written. It also returns the header speed premium, and the order ready-by when a line's time was counted again.
    - `replaceEditChildRows` voids the old discount rows and every non-kept charge row (legacy `EXPRESS` included) and inactivates the old tax lines. Nothing is deleted. It then writes the calculated rows through `buildCommercialChildRows`. Each preference charge points at its preference row, and a charge with no row is refused. Every write filters `tenant_org_id` and `order_id`.
  - **Apply (`order-change-apply.service.ts`):**
    - A priced edit must carry the reviewed `commercial` (otherwise `REVIEW_NOT_READY`).
    - The calculated columns ride on new item and piece inserts, and on updates of every other active row.
    - The header gets `speed_premium_amount`, and the ready-by moves when a line's time was recounted and the edit does not set it.
    - `assertCommercialSnapshot` (the real rollup) stays as the last guard.
  - **Removed:** `writeOrderSpeedCharge`, `writePreferenceCharges`, `syncReviewedTaxLine`, `allocateReviewedTax` (with its test), `speedPriceUpdates`, the order-charge bookkeeping in the preference plan and its extra read.
  - **Review audit:** a new piece's signed `total_price` is its calculated share, extras included, so the stored row matches the signature.
  - **Tests:**
    - `commercial-edit.loader.test.ts` +3 on a real Create order: the written rows add up to the reviewed total (I3); pieces add up to their item (I1, re-allocated on a quantity change); old rows are retired for this order only; the order charge points at its preference row; the recorded 10% is re-stored on the new base; an unchanged order writes back exactly what Create stored.
    - The apply tests were rebuilt on a calculated quote: no `EXPRESS` charge and no raw-SQL money write; the existing line is rewritten; tax lines are replaced; ready-by moves on a speed change.
    - **Local PostgreSQL (`test:db-integration`, order-change: 9 pass):** the snapshot proof now uses a calculator order and the real pricer. The quantity edit stores 20.000 with the list price kept, and the rollup rebuilds the header to 20. OC-SEC-002 uses an unchanged total so it still reaches the row guard.
    - **Gates:** the full unit suite passes 4,609 of 4,610; the only failure is the known pre-existing `platform-inventories` drift. `tsc` and ESLint are clean.
  - **Next:** P6-01d, the EN/AR messages for the new codes in the Edit screen, plus the legacy full-replacement update refusing money fields on a calculator order.
- **2026-10-28 (P6-01b done: Edit Preview on the calculator; Reusable View P1B-08 Preview part, P1B-09):**
  - **New `lib/services/order-change/order-change-edit-pricing.ts`:**
    - `editProjectionOf` maps the projected structure, preferences and speed to the calculator's projection. An order-wide speed change moves every line; per-line speed comes in P6-02.
    - `reviewedLinesOf` maps the result back to the reviewed lines Apply reads.
    - `editCalculationFingerprint` covers every row figure, ready-by, charge, discount, tax line and the total. The digest domain is now `v2`.
    - `editPricingErrorCode` returns the calculator and Edit error codes as 422.
    - `reviewedItemTotal` and the digest moved here.
  - **Preview (`order-change-preview.service.ts`):**
    - An edit that changes money calls the injected `priceEdit`. The projected total and tax, the lines and the fingerprint come from the result, and the calculated order rides on the review as server-only `commercial` (the HTTP response strips it, as it does `reviewBinding`).
    - A header-only edit (notes, ready-by, priority, customer) is not priced: the projected total is the stored total (EC-08). This also covers orders from before the calculator.
    - A new line's cashier price still needs `orders:edit_override`.
  - **Reads (`order-change-preview-reads.ts`):**
    - `priceEdit` reads the order record once, lazily, in its own tenant context.
    - Removed: the per-item `pricingService` quotes (PF-03's second discount), today's VAT rate, the tax-mode resolver and the `EXPRESS` charge read.
  - **Deleted:** `order-change-calculation.service.ts` and its test.
  - **Tests:**
    - The preview tests now use a stub pricer that runs the real calculator.
    - New tests: a header-only edit never prices; `ORDER_NEEDS_RECOMPUTE` is returned; the calculated order rides on the review and the fingerprint follows the price.
    - The preview route test checks that `commercial` and `reviewBinding` never leave the server.
    - Edit, route and commercial suites: 264 pass. `tsc` and ESLint are clean.
  - **Not yet (P6-01c):**
    - Apply still writes the reviewed lines the old way (`price_per_unit` / `total_price`, the tax-line sync, the `EXPRESS` void). It writes the calculator's rows in P6-01c, so P6-01b and P6-01c must ship together.
    - `__tests__/db-integration/order-change-reviewed-snapshots.db.test.ts` (separate DB suite) quantity-edits an order from before the calculator with a stub pricer. It is rebuilt on a calculator order in P6-01c.
- **2026-10-28 (P6-01a done: the Edit facts loader on the calculator):**
  - **New `lib/services/commercial/commercial-edit.loader.ts`:**
    - `readEditOrderRecord` reads the order snapshots and the active items (with their §6.1 money), pieces, preferences, discounts, charges and tax lines. It also reads the line products and the recorded tax profiles without the active filter. Every query filters `tenant_org_id`.
    - `buildEditIntent` turns the stored order plus the projected edit into calculator intents. `quoteOrderEdit` runs the same `quoteCommercialOrder` that Create uses.
  - **Rules (L24, D22):**
    - A stored line keeps its list price, price list, price-list discount, speed premium (split back into its unit and per-line parts), ready-by and recorded tax category. A later minimum price does not block it, and neither does a speed retired since.
    - A changed speed reads today's rule and counts the ready-by again from the order's received time.
    - A new line is priced from the catalog on the edit date. Stored lines keep their tie-break order and new lines follow.
    - Preferences keep their row price. Recorded line and order discounts are kept: a percentage is applied again, an amount is kept.
    - Non-preference charges are kept as recorded charges.
    - Tax uses the order's tax lines (rate as recorded; rounding and scope from the profile row).
    - An order with no `commercial_calc_version` or no line list price is refused with `ORDER_NEEDS_RECOMPUTE`.
  - **Shared loader (no Create change):**
    - optional `LineIntent.pinned`, `PreferenceIntent.amount` / `rowId`, `intent.readyByStartAt` and `intent.recordedCharges`;
    - `deps.recorded`: the order snapshots and recorded tax; tenant settings, mode resolvers and tenant profiles are then not read;
    - `PRICED_PREFERENCE_SYS_KINDS` moved here from the Create session;
    - calculator: `RECORDED` speed outcome and turnaround source, and `ReadyByLineInput.recordedReadyByAt`.
  - **Tests:** new `commercial-edit.loader.test.ts` (9).
    - An order made by the real Create path, re-priced with no change, gives the same item and piece columns, tax lines, discount, charge and total.
    - Also covered: a catalog price raise; a quantity change (10% applied again); a new line; an express line whose rule was removed (premium and ready-by kept); express back to standard; refusal of a pre-calculator order; recorded tax rate.
    - The Create characterization suites (218) still pass. `tsc` and ESLint are clean.
  - **Next:** P6-01b, Edit Preview on `quoteOrderEdit`.
- **2026-10-28 (P5-03e done: custom items; Phase 5 complete):**
  - **Found:** the custom-item button was never rendered (the product grid discarded `onOpenCustomItemModal`), and the modal created a new catalog product for every custom item (`POST /api/v1/products`); its other mode (a shared default product id from `.env.local`) would have charged that product's price, not the typed one, since P5-02 prices only from server facts.
  - **Now (PLAN §7):** a custom item is a line with no catalog product. The request line carries `customItem { name, name2, unitPrice, serviceCategoryCode }` instead of `productId` (schema refine: exactly one of the two). The loader prices it from the entered price (no list rows, the entered price is the SELL_PRICE reference), adds speed premiums from category or tenant rules only (a product rule never matches), uses the category turnaround, and taxes it in the standard category with no supply code. Create writes `product_id` NULL, the entered name as `product_name`, and `price_source` MANUAL (its speed rule is still recorded). Readers already fall back to the line name (checked: public tracking, order detail).
  - **Permission:** an entered price is a price decision: a custom line needs `pricing:override` in the line money policy (403 on every pricing route); its name stands for the reason. The "Custom item" button in the product grid header shows only with that permission, and only on New Order.
  - **Client:** the cart keys a custom line `custom:<uuid>` (never sent); `checkoutLineOf` builds every request line (cart quote, payment window, submit) so a cart key can never reach the server as a product id. The modal adds a hint: charged at the entered price, speed premiums still apply, taxed as a standard service (EN/AR).
  - **Tests:** checkout +1 (custom priced MANUAL next to a catalog line, only the catalog product read), Create +1 (product_id NULL, MANUAL, name), policy +1, new `custom-item-line.schema.test.ts` (5). 2,967 tests in 299 suites, `tsc`, ESLint, `check:i18n` pass.
  - **Phase 5 is complete.** Next: P6-01, every Order Edit write path on the calculator (it still uses the legacy totals and writes `EXPRESS` charges).
- **2026-10-28 (P5-03d done: per-line price confirmation and the promo note):**
  - **D26 (Reusable View PLAN §6.5):** every submitted line carries `confirmedUnitPrice`, the unit price the cart showed, taken from the cart quote only while it matches the cart on screen (none is sent while the cart is being re-priced; the totals guard still applies). The server never prices with it: `lib/services/commercial/price-confirmation.ts` (`findPriceChanges`) compares it with the calculated unit price within half a minor unit (B15). A cashier override is honoured as entered and never compared. Any difference throws `PriceChangedError` before the `AMOUNT_MISMATCH` guard and before the transaction: the submit route answers 409 `PRICE_CHANGED` with `lines [{ index, productId, shownUnitPrice, currentUnitPrice }]`. Nothing is saved.
  - **Cashier:** new `PriceChangedDialog` lists each line (shown price struck through, current price). "Use current prices" re-prices the cart and the payment window in place (React Query invalidation of the cart and payment quotes); the cashier submits again, never automatically (rule #15). "Back" changes nothing.
  - **Fixed along the way:** the `AMOUNT_MISMATCH` dialog's "Refresh Page" reloaded the browser and lost the whole cart. It now re-prices in place ("Refresh amounts"), keeping the cart.
  - **One cart quote for New Order:** `useNewOrderCartQuote` builds the request once; the cart, the summary rail and submit share one React Query entry.
  - **G15:** when a promo code the cashier typed is valid but a non-combinable discount rule gives more, `quoteCheckout` returns `promoNotice { code: PROMO_NOT_APPLIED_RULE_WINS, promoCode, ruleName, ruleName2 }`, the payment quote carries it, and the payment window shows under the applied code: "Promo code AUTUMN was not applied: the automatic discount "Weekday" gives more and cannot be combined with promo codes." (EN/AR). An automatic promo that loses gets no note (not the cashier's choice).
  - **Not done here:** a reason code per changed line (D26 table) needs the shown price's parts (list price, speed premium) on the client; the shown and current prices are listed instead. Order Edit's `confirmedUnitPrice` belongs to P6-02 / Reusable View P1B-14.
  - **Tests:** `price-confirmation.test.ts` (3: tolerance, changed line, override and no shown price skipped); submit protection +1 (PRICE_CHANGED before the totals guard, no transaction, no Create); checkout +1 (G15 notice for a typed code, none for an automatic promo). 2,840 tests in 286 suites, `tsc`, ESLint and `check:i18n` pass.
  - **Next:** P5-03e custom items.
- **2026-10-28 (owner decision: order manual discount needs `orders:discount`):**
  - The owner approved the P5-03c recommendation. `assertOrderDiscountAllowed` (in `price-override-policy.service`) rejects a percent or amount manual discount without `orders:discount` with 403 `ORDER_DISCOUNT_NOT_PERMITTED`, on the payment quote, the totals preview, the legacy `preview-financials` route and submit (`order-submit-orchestrator`, before any pricing). Discount rules and promos are not manual and stay ungated.
  - Payment window (Full and Simple): without the permission the discount fields are replaced by "You need the Order discount permission (orders:discount) to give an order discount. Ask a manager." (EN/AR), never shown disabled without a reason.
  - Role impact: admin, branch_manager, operator, supervisor, tenant_admin keep it; cashier and receptionist no longer can give an order discount unless granted. No migration: the permission and its grants already exist.
  - Tests: policy +2 (percent and amount need it; no discount, no check); the payment-quote route mock updated. `tsc`, ESLint, `check:i18n` pass; 2,828 tests pass (two suites that failed to start under parallel load pass on their own).
- **2026-10-28 (P5-03c done: line discount and line breakdown):**
  - **Contract (PLAN §10.1):** every cart and submit line may carry `lineDiscount { type: PERCENTAGE | FIXED_AMOUNT, value, reason }` (`lineDiscountSchema`, mirrors `DISCOUNT_CALC_TYPE`; a percent is 0 < rate <= 100). `quoteCheckout` turns it into an ITEM `MANUAL` adjustment (`L{i+1}:manual`) that the calculator already prices: it comes off the line before the order discounts, an amount above the line gross is `LINE_DISCOUNT_EXCEEDS_GROSS` (422), never clamped.
  - **Policy:** `price-override-policy.service` now covers both line money decisions. A line discount needs `orders:discount` (403 `LINE_DISCOUNT_NOT_PERMITTED`) on the cart quote, the previews, the payment quote and submit; at submit its reason is required (400 `LINE_DISCOUNT_REASON_REQUIRED`). The same single call per route checks both, so no channel can skip it.
  - **Stored:** one ITEM `org_order_discounts_dtl` row on its line (`source_type` MANUAL, `source_name` "Line Discount" / "خصم سطر", the reason in `rec_notes`); the line's `line_disc_amount` carries it, and I3 still holds (test).
  - **UI:** a % button on each cart line (only with `orders:discount`, via the new `lineDiscount` action in the New Order access contract) opens `LineDiscountDialog`: percent or amount, the line's quoted price, a required reason. A zero value, a percent above 100, an amount above the line price or a blank reason disable Apply with an inline message; switching the type clears the typed value instead of converting it (rule #15). Each line also has an expandable breakdown from the server figures: line price, each discount (price list / line, with its rate), share of order discount, after discounts, tax, line total.
  - **Cart quote:** lines now carry `discounts[]` and `orderDiscountAllocAmount`; error explanations added for the three new codes.
  - **Owner item found:** the order-level manual discount has no permission check today (follow-ups). Not changed without a decision.
  - **Tests:** policy +3 (permission per code, reason at submit only, no check without a discount); checkout +2 (line discount priced before order discounts, labelled with its reason; an amount above the gross rejected); Create +1 (ITEM row with reason, rows add up); cart reducer +1. 2,668 tests in 257 suites, `tsc`, ESLint, `check:i18n` and the access contract pass.
  - **Next:** P5-03d per-line `PRICE_CHANGED` (D26) and the G15 promo note.
- **2026-10-28 (P5-03b done: speed is a catalog code, per order and per line):**
  - **Request contract (PLAN §10.1, pre-launch, no alias):** `isExpress` / `express` are replaced by `serviceSpeed` (a `sys_service_speed_cd.code`, `serviceSpeedCodeSchema`) in the preview, payment-quote, cart-quote and submit schemas, and every item may carry its own `serviceSpeed` (null follows the order). `quoteCheckout` maps both to the intents the calculator already supported; the loader rejects an inactive speed (`SERVICE_SPEED_INVALID`). Create writes the order and each line's `service_speed` from the quote; the legacy `priority_multiplier` is derived from the order speed.
  - **Speed catalog:** `GET /api/v1/lookups/service-speeds` (auth-only, HQ read-only lookup `listActiveServiceSpeeds`, active rows by `display_order`) and the client hook `useServiceSpeeds` (`labelOf(code)` in EN/AR). Remote has STANDARD (default) and EXPRESS. Added to the New Order and Edit Order `apiDependencies`; both contract checks pass.
  - **New Order UI:** `ServiceSpeedSelect` replaces the Express switch in the top bar and the summary rail. Each cart line has a compact speed menu ("Order speed (Standard)" or a speed); "Apply to all lines" appears when a line has its own speed. Cart lines show the quoted line gross and "incl. Express +0.500" from the quote's speed premium; before a line's first quote they show "…", never a client sum. The client-summed "Total" under the cart list was removed (BF-19).
  - **Rule #15:** a speed change keeps the figures from just before it; when the new quote arrives, an info note lists each re-priced line ("Shirt: 3.000 → 4.000"), until dismissed or the cart changes otherwise. A cashier price override is never touched by a speed change.
  - **No client speed pricing:** the reducer no longer re-prices lines on a speed change, and add-item uses the standard catalog price. The product's `default_express_sell_price` is no longer shown or used on New Order (it was not what Create charged since P5-02; the fields retire in P7-04).
  - **Order Edit:** loads `service_speed` (legacy `is_express` fallback); the workspace adapter and the dirty check compare speed codes. Per-line speed in Edit is P6-02 (follow-ups).
  - **i18n:** new `newOrder.serviceSpeed.*` (EN/AR, ICU plural for the re-price title); `check:i18n` passes.
  - **Tests:** cart golden C02 rewritten (speed is a code, no client re-pricing) + C02b (line speed, apply to all) + C03b (override untouched); reducer `SET_SERVICE_SPEED`; dirty check speed fallback; intent mapping keeps the line speed; route and Edit adapter tests moved to `serviceSpeed`. Affected suites 878/878 (109 suites), `tsc` and ESLint clean, both access contracts pass.
  - **Next:** P5-03c line discount + expandable line breakdown.
- **2026-10-27 (P5-03a done: the cart shows the server's figures):**
  - **Why:** since P5-02 the cart summed client prices while the payment window showed the calculator, so the two could differ (order-wide preference VAT, PF-12 preferences, one-minor-unit rounding). The Add Order / Review button also showed a pre-tax "Total" (BF-19).
  - **New route `POST /api/v1/orders/quote`** (C12, `orders:create`, CSRF, PF-01 override check): runs the same `quoteCheckout` as the payment quote and submit, and returns the cart view from `lib/services/commercial/commercial-cart-quote.ts` (`toCartQuote`):
    - header totals (subtotal, order discounts, order charges, tax, cash rounding, sale total);
    - one entry per cart line by position (unit price, speed premium, included extras, gross, line discount, net, tax, line total, line ready-by), for P5-03b/c;
    - the resolver's order ready-by (the screen's own ready-by is never sent, so the answer is always the estimate);
    - disclosures: `ORDER_CHARGE_TAXED` with the tax on order-wide preferences (L25).
    - Types in `lib/types/cart-quote.ts`; request schema `cartQuoteRequestSchema` (cart only: no discounts, promo or gift card, which belong to the payment step).
  - **Shared error mapping:** `checkoutQuoteErrorResponse` in `lib/api/commercial-http.ts` (commercial, currency, unknown product, tax selection, bad id). The preview route uses it too, so both explain a bad cart the same way.
  - **Client:** `useCartQuote` (300 ms debounce like the payment quote, tenant in the query key, the last figures kept but marked "Updating" while a changed cart is priced, Retry on failure, disabled in Order Edit). `CartQuoteTotals` in the summary rail shows Subtotal / Discounts / Order charges / Tax (or "Tax (included)") / Rounding / Total, plus the L25 note. Each error code has its own EN/AR explanation.
  - **BF-19 / D33:** the Add Order and Review buttons carry no money. New Order shows the server total above the button; the mobile bar shows it only when it matches the cart on screen. Order Edit shows no cart total (its live card is Reusable View P6-13).
  - **Ready-by:** the "Calculate" button refetches the quote and uses the resolver's ready-by (PLAN §5.4), replacing the legacy `estimate-ready-by` call. `use-ready-by-estimation.ts` was removed; the route is a P10-01 retirement (follow-ups).
  - **Access contract:** `/api/v1/orders/quote` added to the `/dashboard/orders/new` `apiDependencies`.
  - **i18n:** `newOrder.orderSummary.{discounts, charges, taxIncluded, rounding, quote.*}` EN/AR; `check:i18n` passes.
  - **Tests:** cart-view mapping +2 (same figures as the payment quote, lines by position, L25 disclosure); new `cart-quote.route.test.ts` (5: session tenant, no ready-by sent, 400, 403, coded 400, 500 without internals). Commercial suites 35/35, orders feature suites 576/576, `tsc` and ESLint clean.
  - **Next:** P5-03b speed selector and quoted line prices.
- **2026-10-25 (P5-02 done: payment quote, submit and Create run on the calculator):**
  - **One use case for both sides:** new `lib/services/commercial/commercial-checkout.service.ts` (`quoteCheckout`). The payment quote (`payment-quote.service`, `/api/v1/orders/payment-quote`), the preview route (`/api/v1/orders/preview-payment`) and submit (`order-submit-orchestrator`) all call it, so what the cashier sees is what is stored.
    - The cart request is mapped to intents (`checkoutIntentOf`): line `i` is `L{i+1}`, pieces are `ceil(quantity)` with the cart's piece `k` preferences, `express` → `EXPRESS`, the screen's ready-by → override.
    - Client prices are ignored: `pricePerUnit`, `totalPrice`, `servicePrefCharge`, `packingPrefCharge` and every preference `extra_price` (C2, PF-02, PF-12). Only codes are read; a code the tenant has not enabled is rejected (`PREFERENCE_NOT_AVAILABLE`). Remote check: every code on recent orders is enabled.
    - Order discounts keep today's rules: manual first (percent wins over amount), then the best rule, then the typed or automatic promo; a non-stackable rule competes with the promo on the after-manual base. Each service amount is rounded once and capped at what is left. The resolver gets `netAfter(...)`, which runs the pure calculator, so no discount math is duplicated.
    - Gift card stays settlement (capped at the sale total); cash rounding B17 is unchanged.
    - The legacy totals shape is kept for the payment modal and the `AMOUNT_MISMATCH` check. `subtotal` = the lines after their own discounts (a price-list discount is shown inside it, as before); the stored order shows it as gross − PRICE_LIST discount.
  - **Tax panel:** the payment quote no longer reads tax profiles a second time; its list comes from the same read the tax used (`taxProfileEntries`). A cashier selection (`taxProfileIds`) replaces the defaults in the loader; an unknown or inactive id is `INVALID_TAX_PROFILE_SELECTION` (same code as before).
  - **Create (`createOrderInTransaction`, `commercial` param):** new `commercial-create.session.ts` hands each row its money and collects the created ids.
    - Items and pieces: every §6.1 column from the calculator (pieces ALLOCATED, Σ pieces = item).
    - Preference rows: the server price. Charges: from the writer, each linked to its preference row (order, line or piece); a charge with no row is an error, never written.
    - Discount rows (line PRICE_LIST, ORDER per tax category under DOCUMENT_LEVEL), charge rows with their own tax (L25), header tax lines: all from `buildCommercialChildRows`. Settlement now receives no tax or discount rows, so nothing is stored twice.
    - Header: §5.3 snapshots, `commercial_calc_version` = 1, `service_speed`, `speed_premium_amount`, `ready_by` from the resolver (the screen's value wins when sent).
    - PF-15 / C8: promo usage is logged for the applied promo, typed or automatic.
  - **Rollup (`recalculateOrderFinancialSnapshotTx`):** for an order with `commercial_calc_version`, every active charge adds to the total (the preference-level rule of `order-charge-money.ts` is kept only for older orders until P6/P10), and the order's own `tax_pricing_mode` snapshot is used.
  - **Errors:** new `lib/api/commercial-http.ts` maps context and rule errors to 400/422 with the code and figures; `COMMERCIAL_INVARIANT_FAILED` is logged with its figures and answered 500 (PLAN §17).
  - **Client (no UI change):** `src/features/orders/model/checkout-line-intent.ts` sends the line, piece and packing codes to the quote under the same tenant gates submit uses (`trackByPiece`, `packingPerPieceEnabled`); the request schema accepts them (`servicePrefCharge` / `packingPrefCharge` are deprecated and ignored).
  - **Remote check:** all 3 tenants have seeded EXPRESS speed rules (127), so express orders keep a price source.
  - **Figure changes (rule #15, disclosed in P5-03):** order charges now carry VAT (L25); FD-01…FD-04 one-minor-unit corrections (signed off); a preference the cart had overwritten (PF-12) is now charged.
  - **Tests:** new `commercial-checkout.service.test.ts` (7) and `commercial-create.write.test.ts` (5: every column, server preference prices, child rows, header snapshots, rows add up to the quoted total, SEPARATE_CHARGE links); loader +2, quote resolver updated; submit harness, payment-quote and tax-snapshot tests moved to the new path. 410/410 in the affected suites, rollup/settlement 39/39, `tsc`, ESLint and `npm run build` clean.
  - **Carried to P5-03:** cart totals and the on-screen ready-by from the quote; per-line `PRICE_CHANGED` (D26); disclosure lines for the taxed order charge and for a typed promo that loses to a rule (G15).
  - **Next:** P5-03 New Order UI.
- **2026-10-24 (L25: order charges are taxed):**
  - Owner asked whether untaxed order charges are legal.
  - **Answer:** no. Under the GCC VAT laws, the taxable value includes incidental charges for the same supply, so an order-wide preference extra (and delivery or service fees later) must carry VAT like the service.
  - **Decision L25 (PLAN §2):** taxed like a standard line, with the default profiles; a customer exemption covers the charge too. The charge stays separate and is never discounted.
  - **Code:** the loader now gives order preference charges a tax input; loader test updated (0.200 starch → 0.010 VAT). 168/168 tests, ESLint and `tsc` clean.
  - **Data:** remote has 0 charge rows, so no stored order changes. New orders show the charge as taxed from P5-02 (rule #15 disclosure in the cart and receipt).
  - The ADR-060 §6 "until a charge has a category" wording is superseded.
- **2026-10-24 (P5-01 done: whole-order calculation, loader, quote, writer):**
  - **`lib/commercial/commercial-order.ts`** — `calculateCommercialOrder(input)` runs one order through every step in a fixed order and checks I1–I6 before it returns:
    1. price the PRICED rows;
    2. order discounts;
    3. tax on the lines, then a separate tax pass for charges, so an order allowance never lands on a charge;
    4. split items into pieces (ITEM) or add pieces up to the item (PIECE);
    5. ready-by;
    6. totals.

    `COMMERCIAL_CALC_VERSION = 1`.
    - **Rules decided while building it:**
      - **SEPARATE extra:** a line's SEPARATE extra becomes a charge taxed like its line.
      - **Order charges:** an order charge with no tax input stays untaxed (PF-19).
      - **Piece preferences at ITEM level:** they become line modifiers, and each piece is weighted by one unit plus its own extras, so its gross carries them.
      - **At PIECE level:**
        - Anything charged once per line (a per-line speed premium, a line preference) goes on the first piece.
        - Line discounts are rejected; they belong on pieces (P9).
  - **`lib/commercial/allocation.ts` `allocateMatrix`** — new. An exact two-way split, used for DOCUMENT_LEVEL order discount rows per tax category: each discount adds up to its amount, each category to its allowance, and each cell is within one minor unit of its exact share. It uses augmenting paths. Splitting one way at a time would miss a margin by a unit.
  - **`lib/services/commercial/commercial-context.loader.ts`:**
    - `loadCommercialFacts`: about 17 reads, two rounds in parallel. Every `org_*` query has an explicit `tenant_org_id`; the test checks each call.
    - `buildCommercialOrderInput`: maps intents and facts to the calculator input.
    - **Server-only prices (C2):** standard price (customer list, then standard list, then product default; the list discount becomes a PRICE_LIST line discount), speed rule, preference extras (tenant price, else system default; codes the tenant has not enabled are rejected), tax category and profiles by supply code, customer and per-line service exemptions, business date in the branch or tenant time zone (a missing zone is an error, never a guess), ACCOUNTING rounding mode, and the tenant VAT fallback profile only when the tenant has no profile (as today).
    - **Kept from today:**
      - the customer list-type rule;
      - `is_included_in_base` on preferences is still not read (nothing reads it today).
  - **`commercial-quote.service.ts`** — `quoteCommercialOrder`: load → calculate, no write. An optional resolver receives Σ line net, so discount rules and promos are still evaluated in `discount-service`, then applied.
  - **`commercial-line.writer.ts`:**
    - `lineMoneyColumns`: every §6.1 column, the same for items and pieces. An override is `MANUAL`, with no list or rule link.
    - `orderSnapshotColumns`: the §5.3 snapshots plus `commercial_calc_version`, `service_speed`, `speed_premium_amount` and `ready_by`.
    - `buildCommercialChildRows`:
      - ITEM/PIECE line-discount rows (PRICE_LIST included, `source_id` = price list item);
      - ORDER rows: one per discount (ALLOCATE_TO_LINES), or per discount and category (DOCUMENT_LEVEL);
      - charge rows with tax columns;
      - header tax lines (the fallback writes a NULL profile id, as today);
      - `promotion_id` from the caller's metadata (C8).
    - Header totals are left to the P5-02 rollup (I3).
  - **Prisma client regenerated** (`prisma generate`, no DB change): the generated client lagged behind `schema.prisma` for the M3–M7 columns.
  - **Tests (all green):**
    - calculator suite 145, of which 9 are new for the whole-order function plus 4 for `allocateMatrix`;
    - loader + quote 13 and writer 6, under `__tests__/services/commercial/`;
    - existing Create goldens and order-calculation tests: 95 still pass.
    - ESLint and `tsc` are clean on every touched file.
  - **For P5-02 to decide:**
    - Today the client can send `taxProfileIds`. Recommendation: keep them as an intent, checked against the tenant's active profiles.
    - Custom items (no product) are not loaded yet (P5-03).
    - The `discount-service` evaluation must be moved behind the quote's resolver.
  - **Next:** P5-02, Create writes through the loader, calculator and writer in one transaction.
- **2026-10-24 (Q3 approved):** Owner approved the PLAN §20 Q3 recommendation. Loyalty redemption stays a payment (`LOYALTY_POINTS` credit application) in Release A, with no calculator or writer change. The tax adviser question is now an owner follow-up.
- **2026-10-24 (promotions / gift cards / loyalty Q&A):**
  - New PLAN §8.6. Price reductions (price-list, manual, rule, promo) are adjustments and lower the tax base. Gift card, wallet, advance, credit note and loyalty redemption are settlement and are unchanged by this plan.
  - Promo evaluation stays in the existing services; P5 writes usage and `promotion_id` for every promo (PF-15).
  - Not supported today and kept out of scope: promos on some lines only, stacking groups, buy-X-get-Y.
  - New owner item **Q3** (PLAN §20): should redeeming the shop's own loyalty points lower the VAT base? Recommendation: keep it as a payment for Release A and ask the tax adviser.
  - No code change.
- **2026-10-24 (P4-06 done; Phase 4 closed):**
  - **`lib/commercial/invariants.ts`:** `checkMoneyInvariants(order)` returns every broken invariant; `assertMoneyInvariants(order)` throws `COMMERCIAL_INVARIANT_FAILED` (first violation's figures + `violationCount`). The P5 writer calls it on the whole calculated order before any write.
    - I1/I2: item basis vs piece basis (an item is never ALLOCATED; a ROLLUP item needs pieces) and Σ pieces = item on all 9 money columns.
    - I3: header = Σ item totals + Σ charge totals − allowance − its tax effect (exclusive only; inclusive prices hold the tax).
    - I4: no line share under DOCUMENT_LEVEL, no allowance under ALLOCATE_TO_LINES, no row id twice.
    - I5: net, taxable and total follow from the amounts, on items, pieces and charges.
    - I6: every item and piece has the order's pricing mode.
  - **Tests, `__tests__/commercial/invariants.test.ts` (11):** a golden OMR order (3 lines, speed, line discount, order discount 1.000, VAT 5% DOCUMENT rounding, delivery) with every item, piece and header figure pinned against a hand calculation; one violation per invariant; a 400-run property suite that runs random orders through the whole calculator (both levels, both pricing modes, both allocation modes and bases, LINE/DOCUMENT rounding, charges) and finds I1–I6 hold every time. Its header is worked out independently of I3. The only rejection allowed is `DOCUMENT_DISCOUNT_EXCEEDS_LINE` (gross basis).
  - Gates: calculator suite 135/135, ESLint clean, `tsc` clean for `lib/commercial` and its tests.
  - **Next:** P5-01, the context loader, writer and quote service.
- **2026-10-24 (order-discount share Q&A):** Owner asked how each line's share is found. Answer recorded here: one largest-remainder split of the total discount, weighted by each line's net after its line discounts (or gross, by tenant setting); shares are rounded down to the currency decimals and the leftover minor units go to the largest dropped fractions, ties to the earlier line, so the shares always add up exactly. Under DOCUMENT_LEVEL the same split runs by tax category. At ITEM level a line's share is then split across its pieces the same way. No code change (PLAN §8.4 already states this).
- **2026-10-24 (order-discount Q&A):** PLAN §8.4 now says why an order discount is split (tax by category, refunds, reports, minimum price and piece shares), why `DOCUMENT_LEVEL` stays the default, and that in Edit a fixed-amount discount is re-split across the lines. No code change.
- **2026-10-24 (pricing lifecycle Q&A):** The 3 items whose pieces do not add up are all on `ORD-20261015-0001` (Demo Saudi Riyadh Dry Clean). The cause is new finding **PF-26** (PHASE0_FINDINGS): an order-wide speed change in Edit raised the items by 1.5 but left the pieces, the line speed, the express charge field and the ready-by unchanged. PF-26 is fixed by P6 and P10-02. New decision **L24** (PLAN §2): Edit keeps each existing line's stored list price; a speed change uses the rule in force at the edit; a new line uses the catalog price on the edit date.
- **2026-10-24 (levels Q&A):** Owner asked what the commercial level changes. PLAN §5.1 now records how pieces were priced before this plan (checked on remote), market practice, and the guard-rails: ITEM stays the default, piece tax is never an invoice line, and piece screens show the unit price, not the allocated share. No code change.
- **2026-10-24 (0646 applied; P4-05 done):**
  - **0646 verified on remote:** SA 16 codes (3 EXEMPT, 12 ZERO_RATED, 1 OUT_OF_SCOPE with free text), OM 28 (12 EXEMPT, 16 ZERO_RATED), all with Arabic; FK + CHECK present; Prisma model and types in both repos updated.
  - **P4-05, `lib/commercial/levels.ts`:**
    - `resolveMoneyBasis`: ITEM → item PRICED / pieces ALLOCATED; PIECE → pieces PRICED / item ROLLUP; fallback reasons FIXED, piece-count mismatch, no pieces.
    - `allocateItemToPieces` (I1): chained largest-remainder splits.
    - `rollupPiecesToItem` (I2).
    - `buildRowMoney`: derives net, taxable and total (I5).
  - **P4-05, `ready-by.ts`:** `resolveTurnaround` / `resolveReadyBy`, one resolver for both ready-by services.
  - Constants: `MONEY_BASIS` (mirrors `chk_oid_money_basis`) and `PRODUCT_PRICE_TYPES`. Error code `COMMERCIAL_INVARIANT_FAILED` added.
  - **Bug avoided:** splitting every amount with the same weights can leave a piece with a negative net, because largest remainder is not monotone. The splits are now chained (PLAN §5.1), and a 300-run property test checks that no piece goes below zero.
  - **Ready-by changes to disclose in P5** (no money change):
    - product hours for standard lines;
    - no second express halving;
    - preference minutes per line;
    - retail-only orders ready at once.
    Recorded in PLAN §5.4.
  - Verified on remote: 121/127 active products have both turnaround fields; every category has both hours (RETAIL_ITEMS = 0).
  - Tests: `__tests__/commercial/levels-ready-by.test.ts`, 20 new (calculator suite 124). Gates: ESLint, `tsc` clean, goldens 67/67.
  - **Next:** P4-06, the invariant checker I1–I6, plus the golden and property suites that close Phase 4.

- **2026-10-24 (owner questions: existing services; exemption reason seed):**
  - **Existing services:** new PLAN §4.1a lists, file by file, what is reused (DB loading in `tax-engine.service`, `pricing.service`, `tax.service`, the mode resolver), changed (`order-calculation.service` becomes a thin use case) and retired (the float math, Edit's own calculator, the float helpers). `lib/commercial/` is the pure rules and arithmetic layer (ADR-060 §1); it is not a second engine.
  - **Migration `0646_tax_exempt_reason_seed.sql` written, waiting for the owner to apply it.**
    - Adds `tax_category_code` (FK, never STANDARD) and `allows_free_text` to `sys_tax_exempt_reason_cd`.
    - Seeds the official codes from a web search: Saudi Arabia ZATCA 16 (`VATEX-SA-29` … `VATEX-SA-OOS`) and Oman PINT OM 28 (`VATEX-OM-01..12`, `VATZR-OM-01..16`).
    - Not seeded:
      - 3 ZATCA codes announced in 2025 (DUTYFREE, 32(bis), ROYALDECREE). Their exact code and category are not confirmed against the ZATCA SDK.
      - UAE and Bahrain: no verified official list.
      - Kuwait and Qatar have no VAT.
    - Arabic names are our translation and need tax-adviser review.
  - **Numbering:** M8 permissions and M9 navigation move to 0647 / 0648.
  - **Gap found:** an e-invoice line needs the **official** code, but a customer or service exemption today records no code. Our internal reasons (`CUSTOMER_EXEMPTION`, …) say *why*; the official code must come from the product's `tax_exempt_reason` or the exemption row. **To do in P5/P8:** the context loader validates the code against this table for the tenant's country and the line's category, and `org_tax_exemptions_cf` gets an official-code column (migration with P8-02).

- **2026-10-24 (P4-04 done):** tax per row, pure, `web-admin/lib/commercial/tax.ts`. Not wired yet (P5), so no figure changes.
  - `selectTaxProfiles`: supply-code profiles replace the defaults; otherwise every default general profile stacks; compound profiles go last (PF-06).
  - `resolveTaxCategory`: customer, then service (per line, PF-05), then product category, with reasons.
  - `calculateTax`: per-row taxable/tax/total (I5); header tax line per profile; category buckets.
    - `LINE` or `DOCUMENT` rounding by each profile's rule (decimals, mode, increment).
    - `TAX_INCLUSIVE` extraction with the combined rate.
    - `DOCUMENT_LEVEL` allowance taxed at the header only (I3).
    - Exempt rows never fall back to the tenant rate (PF-04); the tenant-rate fallback profile is stored with no profile id.
  - Constants: `TAX_ROUNDING_LEVELS` (mirrors `chk_org_tax_prof_rounding_level`), `TAX_EXEMPT_REASONS` (`CUSTOMER_EXEMPTION`, `SERVICE_EXEMPTION`, `PRODUCT_EXEMPT`). `sys_tax_exempt_reason_cd` is still empty on remote; country reason codes are a seed task for P7/P8 (fiscal documents).
  - **Decisions (PLAN §8.2, §9):** supply-code profiles replace the defaults; non-standard rows carry no tax; `tax_rate` is the combined effective rate; DOCUMENT rounding per (category, profile set) group; compound profiles chain on exact prior tax (one minor unit can differ from today's engine; no compound profile exists on remote).
  - Verified on remote: the 9 active profiles are all `DOCUMENT` / `HALF_UP` and none is compound; tenant 1111 stacks VAT 5% + municipal 2%, reproduced by test.
  - Tests: `__tests__/commercial/tax.test.ts`, 21 new (calculator suite 104). Gates: ESLint and `tsc` clean, goldens 67/67.
  - **Next:** P4-05, levels (`ITEM`/`PIECE`), `money_basis`, PIECE fallback, ready-by.

- **2026-10-24 (P4-03 done):** line pricing and order discounts, pure, in `web-admin/lib/commercial/`. Not wired yet (P5), so no figure changes.
  - `line-pricing.ts` `priceLine`: unit price = list + speed premium (L2), or the override (no premium, no list discount). Gross = unit × quantity + PER_LINE premium + INCLUDED extras. Extras placed by `placementForExtraPrice` (order `extra_price_pricing_mode`; order-level extras always SEPARATE). The `PRICE_LIST` discount comes first, on the list part only (PF-03). Then line discounts in sequence on what is left. `min_sell_price` floor (L23) on the item's own net unit price; an override may go below it, with a notice.
  - `document-adjustments.ts` `applyDocumentAdjustments`: order discounts in sequence on Σ line net. `ALLOCATE_TO_LINES` (net or gross basis) or `DOCUMENT_LEVEL` (split by tax category); one largest-remainder split, exact (I1).
  - `adjustments.ts`: the shared sequential rule, plus the gift-card rejection (`GIFT_CARD_NOT_ADJUSTMENT`). `errors.ts`: `CommercialRuleError` with stable codes for the API layer to map to EN/AR messages (`PRICE_NOT_RESOLVED` now uses it).
  - `lib/constants/discount-source-type.ts`: `PRICE_LIST` added (the column has no CHECK; display order 0). The label for it is added with the P8 readers.
  - **Decisions (PLAN §8.3, §8.4):**
    - Every stored figure is rounded once by the currency rule; the rest are sums and differences, so the row identities hold exactly.
    - Over-limit discounts are rejected, never clamped. **Today Create silently caps a manual order discount at the subtotal; the new rule is a rule #15 change, disclosed for P5**, where the UI prevents the entry first.
    - Order discounts never touch separate charges, as today.
    - `min_sell_price` was said to be enforced in P4-02; it belongs here, after line discounts (P1_01 doc corrected).
  - Tests: `__tests__/commercial/line-pricing.test.ts`, 23 new (calculator suite 83/83), including invariant properties for line net and exact allocation. ESLint and `tsc` clean, goldens 67/67.
  - **Next:** P4-04, tax per line (profile, category, exemption, inclusive extraction, LINE/DOCUMENT rounding).

- **2026-10-24 (P4-02 done):** standard price and speed premium resolvers, pure, in `web-admin/lib/commercial/`. Nothing calls them yet (wired in P5), so no figure changes.
  - `standard-price.ts`: `resolveStandardPrice` — customer list (b2b/vip) → standard list → product default; effective dates, quantity tiers, priority then deepest tier then item id (deterministic, unlike the SQL `LIMIT 1`). Returns the list discount **separately** (PF-03, applied once in P4-03). Keeps 4 decimals (the SQL function returned `NUMERIC(10,3)`). No price → `PRICE_NOT_RESOLVED`, never a silent 0.
  - `speed.ts`: `selectSpeedRule` (6 levels, every set scope must match, active + effective) and `resolveSpeedPricing` (SELL_PRICE / MULTIPLIER / FIXED_AMOUNT per unit or per line; outcomes `STANDARD_SPEED` / `RULE_APPLIED` / `NO_RULE` for the cart note; rule turnaround). Speed is an open string, so a new `sys_service_speed_cd` row needs no code change.
  - `lib/constants/commercial.ts`: `PRICE_SOURCES` (mirrors `chk_oid_price_source`).
  - **Decisions (recorded in PLAN §7):**
    - SELL_PRICE premium = rule price − product default price, added to the customer's standard price. That is what keeps PF-08's fix (B2B price + premium) and today's express price for standard customers.
    - A SELL_PRICE rule below the normal price gives premium 0 with warning `SELL_PRICE_BELOW_STANDARD`, never a hidden discount.
    - **Plan correction:** the scope unique index includes `effective_from`, so same-scope rules can overlap; the later `effective_from` wins, then the lower id.
    - Customer → standard list → default fallback (ADR-060 §5). Today a b2b customer with no b2b row skips the standard list.
    - **Verified on remote:** only `standard` lists exist, and no `SELL_PRICE` product has a list price different from its default, so none of these decisions changes a current figure.
  - Tests: `__tests__/commercial/resolvers.test.ts`, 31 new (each level wins over the less specific ones, scope matching, dates/inactive, overlap tie-break, order independence property, all price types, L20 example, PF-08, custom item, per-kg quantity, invariants property). Gates: commercial suite 60/60, ESLint and `tsc` clean, goldens 67/67.
  - **Next:** P4-03, modifiers (speed, preferences by mode), line and document adjustments, gift-card exclusion.

- **2026-10-24 (plan clarifications from the owner):**
  - **Speed selection on New and Edit Order:** already planned as an order-wide selector, now explicit for Edit as well. Each line can also override the order speed, so one order can mix Standard and Express lines (`org_orders_mst.service_speed` = default, `org_order_items_dtl.service_speed` = per line, both columns exist). "Apply to all lines", options from `sys_service_speed_cd`, and the selector replaces the Express toggle. PLAN §5.4, §11.1, P5-03, P6-02 updated. No schema change needed.
  - **Documentation tasks:** the rule that every phase ends with STATUS + docs + QA is now stated in the PLAN §14 legend for every phase. New P11-04 (final docs in this folder), P11-05 (Order_Fin root docs, ADR-060 status, glossary, memory), P11-06 (HQ docs). Reusable View already has the same rule and its own docs phase (P9-01…08).
- **2026-10-24 (M7 applied — Phase 3 closed; P4-01 done):**
  - **M7:** owner applied `0645_tax_doc_items_dtl.sql` local+remote, types regenerated. Verified: table, all 12 constraints, Prisma model present. **Phases 2 and 3 (M1–M7) are done.**
  - **P4-01 primitives** in `web-admin/lib/commercial/` (pure; no I/O, Prisma, Supabase, i18n):
    - `money.ts`: a dedicated decimal.js clone (precision 40, isolated from global Decimal settings), `toMoney` (rejects NaN/Infinity), `sumMoney`, `toStorageString` (formats for `DECIMAL(19,4)` and refuses to silently drop digits; rounding is always an explicit step).
    - `rounding.ts`: the 7 `sys_rounding_mode_cd` modes (DB-mirror; `UP`/`DOWN` = away from/towards zero, `CEILING`/`FLOOR` = towards +/- infinity) plus an optional coin increment in minor units.
    - `allocation.ts`: largest-remainder allocation; shares sum to the total exactly (I1); ties go to the earlier row, so callers fix the tie-break by ordering (pieces by `piece_seq`, then `id`); all-zero weights split equally; negative totals supported.
  - **Dependencies declared** (both were only installed transitively, a silent-breakage risk on any dependency bump): `decimal.js@^10.6.0` (dependency), `fast-check@^3.23.2` (devDependency).
  - **ESLint boundary (ADR-060 §1; part of P4-06, delivered early):** a `files: ['lib/commercial/**']` block bans `@prisma/client/**`, `@/lib/db/**`, Supabase, `server-only`, `next-intl`, `next/server`, and imports of services, routes, features and UI. Proven with a probe file (3 violations caught, probe removed). The block repeats the global `@/messages` pattern, because a later flat-config block replaces the rule rather than merging it.
  - **Tests:** `__tests__/commercial/primitives.test.ts`, 29 pass. Exact examples pin P1-01's FD-01 (3.3335 → 3.334 under HALF_UP), FD-02 (10 ÷ 3 = 3.3334 + 3.3333 + 3.3333 = 10) and FD-03 (0.4 + 0.8 = 1.2), every mode on positive and negative values, and coin increments. Property tests (fast-check): rounding stays within one unit and is idempotent; increments land on multiples; allocation always sums exactly, each share is within one unit of its exact proportion, and it is deterministic.
  - **Gates:** `tsc` clean, ESLint clean on the folder, goldens 67/67. No migration and no figure change (nothing calls the calculator yet).
  - **Next:** P4-02, the speed resolver and the standard price resolution contract.

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
