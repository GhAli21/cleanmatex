# Line-Level Money Snapshot — STATUS

**Plan:** [PLAN.md](PLAN.md) · **Discussion:** [DISCUSSION.md](DISCUSSION.md)
**Overall:** ✅ COMPLETE in code 2026-11-07 (v1.0.0, see [README](README.md) and [CHANGELOG](CHANGELOG.md)). Left for the owner: QA ([QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)), HQ Edit policy rules, commit. Approved 2026-10-23 (v2.1); migrations 0639–0646, 0661–0665, 0673, 0691–0694, 0698–0700 (+ 0702 Order Edit V2) applied.

## Remaining work (consolidated 2026-10-24, re-checked 2026-10-30)

Repos: **T** = `cleanmatex` (tenant app), **HQ** = `cleanmatexsaas`, **M** = `cmx_mobile_apps`. Order: P6-02 → P6-03 → P6-04 → Reusable View P1B-05/11/15/10/12/13 → P7 → P8 → P9 → P10 → P11, with Reusable View P2–P9 after its P1B (execution order below).

The one place that lists everything left in this plan and in Reusable Order Fin View (they run as one sequence). Update it with every increment.

**This plan (Line-Level):**

| Phase | Left |
|---|---|
| P4 calculator | ✅ Done 2026-10-24 (P4-01…P4-06) |
| P5 services + Create | ✅ P5-01 done 2026-10-24 · ✅ P5-02 done 2026-10-25 (payment quote + submit + Create on the calculator) · P5-03 New Order UI, split into steps: ✅ **P5-03a** done 2026-10-27 (cart totals and ready-by from the server quote, BF-19/D33, L25 note) · ✅ **P5-03b** done 2026-10-28 (speed selector from `sys_service_speed_cd`, per-line speed + "Apply to all lines", quoted line prices, re-price note) · ✅ **P5-03c** done 2026-10-28 (line discount gated by `orders:discount`, with reason; expandable line breakdown) · ✅ **P5-03d** done 2026-10-28 (per-line `PRICE_CHANGED`, G15 promo note, in-place re-price) · ✅ **P5-03e** done 2026-10-28 (custom items with no catalog product). **P5 complete.** ← **next** P6-01 (Order Edit writes on the calculator) |
| P6 Edit parity | P6-01 every Edit write path, in steps: ✅ **P6-01a** done 2026-10-28 (Edit facts loader on the calculator) · ✅ **P6-01b** done 2026-10-28 (Preview on the calculator) · ✅ **P6-01c** done 2026-10-28 (Apply writes the calculated order) · ✅ **P6-01d** done 2026-10-28 (older orders and the legacy update) · ✅ **P6-01e** done 2026-10-28 (real-database proof and docs) — **P6-01 complete** · P6-02 Edit UI line controls (plan approved 2026-10-30 below): ✅ **P6-02a–f** done 2026-10-30 (migrations 0662 and 0664 applied) — **P6-02 complete** |
| P6-03 VAT setting retirement | ✅ **Done 2026-10-30:** R1–R7 (migrations 0665 and 0673 applied by the owner, local and remote; verified: the three codes, their profile values and overrides inactive, `TAX_PRICING_MODE` active). ← **next** P6-04. Right after P6-02: run [VAT_Settings_Fallback_Retirement_Plan.md](VAT_Settings_Fallback_Retirement_Plan.md) (owner approved in principle, "retire all"; scheduled 2026-10-28). Remove the `TENANT_VAT_RATE` fallback from the old calculator and every reader (its R3 list), including the booking bootstrap `vatRate` field. Per that plan, steps that need a migration stop and wait. |
| P6-04 mobile booking codes | ✅ **Done 2026-10-30** in `cmx_mobile_apps` (customer app): new booking codes mapped to EN/AR messages, the confirmation shows the server's `totalAmount`; speed choice not built (the booking bootstrap returns no speed list; needs a server field first). Then Reusable View ✅ **P1B-05** and ✅ **P1B-11** done 2026-10-30 (recorded discounts re-checked on Edit; Review lists each change and asks to acknowledge a removal). ← **next** Reusable View P1B-15. |
| P7 configuration | P7-01 Speed Pricing screen + M8 permissions (0647) + M9 navigation (0648) + access contract · **P7-02 HQ repo:** Tax & Pricing card, `platform-api` DTO/service, branch overrides, HQ progress doc · P7-03 tax rounding fields · P7-04 product form / import / bulk pricing · P7-05 tenant-app single writer (`403 FIELD_MANAGED_BY_HQ`) |
| P8 readers | ✅ Done: P8-02 2026-11-01, P8-01 2026-11-05 |
| P9 (Release B) | ✅ P9-01 per-piece discount/speed done 2026-11-05 (migration 0692 applied, proved on PostgreSQL) · P9-02 enable `PIECE` in HQ |
| P10 | P10-04 (added 2026-10-31): remove Create's order-total rounding step (always 0 since 0686). (Demo orders were all deleted by the owner 2026-10-30, so P10-02 only fixes the demo catalog: NULL `price_type`, PF-24.) P10-01 remove obsolete recalc and the legacy money services: `preview-financials` (legacy `calculateOrderTotals`), `estimate-ready-by`, the legacy `express` boolean update API, `order-preference-charge-recalc` · P10-02 recompute or delete the demo orders made before the calculator (dry-run first) · P10-03 M10 NOT NULL + CHECK, M11 drop retired columns |
| P11 | ✅ Done 2026-11-07: gates (tenant `tsc`, ESLint, jest, DB suite, build, `check:i18n`; HQ builds 2026-11-06), README / developer / user guides / CHANGELOG / version in this folder, Order_Fin root docs, ADR-060 Implemented, glossary, integration contracts, HQ progress doc. |

### P6-02 plan (approved by owner 2026-10-30)

**Progress:** ✅ P6-02a done 2026-10-30 · ✅ migration 0662 applied by the owner 2026-10-30 (local and remote; types and Prisma regenerated) · ✅ P6-02b done 2026-10-30 · ✅ P6-02c done 2026-10-30 · ✅ P6-02d done 2026-10-30 · ✅ P6-02e done 2026-10-30 · ✅ migration 0664 applied by the owner 2026-10-30 (local and remote; types and Prisma regenerated) · ✅ P6-02f done 2026-10-30 — **P6-02 complete**; next P6-03.

**Goal:** Order Edit gets the same line controls as New Order: order speed from the catalog, a per-line speed, the line discount, the price override, custom lines and the price confirmation (`confirmedUnitPrice`, Reusable View P1B-14 Edit part). The calculator side already exists: the Edit facts loader (P6-01a) takes a per-line speed, keeps recorded line discounts and prices a line without a product (`customItem`).

**Facts checked (remote DB and code, 2026-10-30):**
- The Edit grammar is `sys_oc_order_edit_ops_cd` + `sys_oc_order_edit_op_tgt_cd`. Policy rules (`sys_oc_edit_policy_rule_dtl`) are keyed by status, operation and **target type**.
- `CHANGE_SERVICE_SPEED` has only the `ORDER` target. `CHANGE_DISCOUNT` has only `ORDER`. `CHANGE_ITEM_PRICE` has `ITEM`.
- `CHANGE_DISCOUNT` and `CHANGE_ITEM_PRICE` have only DENY rules (10 each) and are in `ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES` (no writer).
- A missing rule is refused (`CAPABILITY_POLICY_BINDING_MISSING`). So every new operation or target needs HQ policy rules before staff can use it; until then the control shows disabled with its reason.
- The change schema types the order speed as `STANDARD | EXPRESS`. `ADD_ITEM` requires a `productId` and has no `confirmedUnitPrice`.
- Items have `item_status`, `quantity_ready` and `ready_at`, enough to block a speed change on a line that is already ready.

| Step | Work | Migration |
|---|---|---|
| P6-02a | **Order speed from the catalog.** `CHANGE_SERVICE_SPEED` accepts any speed code; the server checks it against active `sys_service_speed_cd` (`SERVICE_SPEED_INVALID`). The view model, controller and adapter use `ServiceSpeed` codes; the cast in the adapter goes. | None |
| P6-02b | **Per-line speed.** `CHANGE_SERVICE_SPEED` on target `PERSISTED_ITEM` (and a speed on `ADD_ITEM`). An order-wide change still moves every line, except lines with their own speed in the same request. A line that is ready or later is refused with `LINE_SPEED_LOCKED` (EN/AR reason). Preview's speed audit lists each line's price and ready-by before and after; Review shows it (rule #15). Edit gets the New Order line speed menu. | Adds target `ITEM` to `CHANGE_SERVICE_SPEED` (stop and wait) |
| P6-02c | **Line price override and line discount.** `CHANGE_ITEM_PRICE` gets its writer (override and reason through the calculator, permission as on Create). The line discount becomes `CHANGE_DISCOUNT` on target `ITEM` (amount or percent, reason, `orders:discount`), prevented, never clamped. Both leave the "unavailable" list. | Adds target `ITEM` to `CHANGE_DISCOUNT` (same migration as b) |
| P6-02d | **Custom lines.** `ADD_ITEM` takes exactly one of `productId` or `customItem` (name, name2, service category, unit price), stored like Create (P5-03e). Policy: the existing `ADD_ITEM` rules. | None |
| P6-02e | ✅ **Price confirmation in Edit (P1B-14).** `ADD_ITEM` carries `confirmedUnitPrice`; Preview compares it after the calculator and lists the changed lines (`findEditPriceChanges` in `price-confirmation.ts`); Review shows them. Changed from the first plan: no `PRICE_CHANGED` reject in Edit (see the 2026-10-30 log). | None |
| P6-02f | ✅ **Tests and docs.** Found and fixed: Apply refused every line speed, price and discount (migration 0664, see the 2026-10-30 log). Unit tests per step, the DB parity proof extended (line speed, line discount, custom line: Preview = Apply = rollup), gates (jest, `tsc`, ESLint, `check:i18n`, build), STATUS, PLAN, QA guide, Reusable View STATUS, memory. | None |

**HQ action after the migration (not a decision):** add policy rules for `CHANGE_SERVICE_SPEED`/`ITEM`, `CHANGE_DISCOUNT`/`ITEM` and `CHANGE_ITEM_PRICE`/`ITEM` to each profile's Edit policy (a new draft version, then publish). Until then those three controls stay disabled with the reason; a, d and e work at once.

**Recommendation (the one choice in this plan):** per-line speed and line discount use the `ITEM` target, not an extra field on the order-level operation. That keeps one operation per changed line in the audit, lets a policy allow the order speed but not a line speed (or the reverse), and matches how `CHANGE_ITEM_PRICE` is already modelled. The cost is the HQ rules above.

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
  - ~~P1B-15~~ and ~~P1B-10~~ done 2026-10-31 (loyalty follows the order; Edit Apply's request is traced to the change).
  - ~~P1B-12~~ done 2026-10-31 (parity suite: cart quote = Create snapshot, removed promo with real usage rows; booking now records promo usage).
  - ~~P1B-13~~ done 2026-10-31 (Open Decisions D21–D24, Test Guide OC-CALC-011–018 + §21 evidence). **Phase 1B complete.**
- Then: ~~P2 indexes~~ (migration 0679 applied 2026-10-31) → P3 read model → P4 APIs/access → P5 shared component (mockup signed off by the owner 2026-10-30) → P6 page migration → P7 hardening → P8 rules/skill → P9 docs.

**Owner decisions and actions (answered 2026-10-30):**
- ✅ Commit, push and deploy: done by the owner (everything up to 2026-10-30).
- ✅ Demo orders deleted by the owner (all orders), so P10-02 has nothing left to recompute.
- ✅ The 2 Edit Policy DB suites: fixed by the owner.
- ✅ BF-23 / API route auth hardening: implemented 2026-10-30 in its own package ([API_Route_Auth_Hardening/STATUS.md](../../API_Route_Auth_Hardening/STATUS.md)); migration 0660 applied.
- ✅ P6-04 may change `cmx_mobile_apps` (follow its own CLAUDE.md).
- ✅ Reusable View mockup: signed off; its P5 is unblocked.
- ✅ Q3 (own loyalty points and the VAT base): keep it as a payment, as recommended; the owner revisits if an adviser says otherwise.
- ✅ Retail paid later (decision 8, done 2026-10-30, log entry below): only customer-app orders, paid on collection, starting before handover.
- ✅ Online booking on arrival (decision 9): already supported, nothing to change (log entry below).
- ✅ P1-01 characterization sign-off: done 2026-10-23 (delegated, recorded in [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4.4). No owner action.
- ✅ Demo catalog cleanup (6 products with NULL `price_type`; PF-24, 4 products below their minimum): delegated; done by Claude as demo-data work in P10-02. No owner action.
- ✅ Migrations up to **0661** applied by the owner (2026-10-30).
- **No owner decision is open.** One HQ action remains: add `INIT_MOBILE_RETAIL` (create preset `RETAIL_SOLD`) to each workflow profile in HQ (new draft version → publish). Until then, online retail starts at `intake` (safe). Later migrations (0691 in P7-01; M8 is not needed, P0-05 reuses `pricing:*`; M10/M11 in P10-03) are applied as they come.

**Follow-ups found along the way (not in a phase yet):**
- BF-23: done 2026-10-30 ([API_Route_Auth_Hardening](../../API_Route_Auth_Hardening/STATUS.md)). Its follow-ups (Gap C session revoke, BF-24 legacy routes) live there.
- ✅ `org_price_history_audit.entity_type` accepts `'speed_rule'`: migration 0691 (P7-01), once applied.
- `ready_at` on items/pieces has no writer yet: the fulfillment workflow should set it (outside this plan).
- Demo catalog cleanup (6 products with NULL `price_type`, PF-24): delegated to Claude, done in P10-02.
- ✅ P1-01 sign-off table ([P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) §4.4): done 2026-10-23 (delegated and recorded).
- Pre-existing, not ours: `platform-inventories` test drift.
- ✅ Fixed by the owner 2026-10-30. Was: `order-change-edit-policy-resolution` and `order-change-reviewed-snapshots` DB suites fail in the Edit Policy resolver after the parallel Edit Policy work (migrations 0654–0658, `order-change-context.service.ts`, `order-change-policy-revalidation.service.ts`). Their fixtures are updated there.
- ✅ Q3 (own loyalty points and the VAT base): decided 2026-10-24 and confirmed 2026-10-30. It stays a payment. The owner revisits it only if a tax adviser says otherwise; nothing is pending.
- After Release A: promos on some lines only, promo stacking groups, buy-X-get-Y (PLAN §8.6).
- `app/api/v1/orders/preview-financials` still prices through the legacy `calculateOrderTotals` (no screen calls it today). Retire it with the legacy service in P10-01, or move it to `quoteCheckout` if a caller appears.
- ✅ Resolved 2026-10-28 (P6-01c): Order Edit no longer writes `EXPRESS` charges or legacy totals; it stores the calculated order.
- ✅ Product cards show the price at the order speed (P7-04), through the cart quote rather than the resolver, so a card matches the line it adds. While the answer is pending or failed, a card keeps the catalog price and says the cart prices it.
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
| 3 | Characterization tests on Create (this P1-01 = Reusable View P1B-01) | ✅ Done 2026-10-23: [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) (sign-off §4.4 done 2026-10-23, delegated) |
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
| P7 | Configuration UI (tenant app) + HQ card | A | ✅ Done 2026-11-05 (P7-02, P7-03, P7-05 2026-11-01; P7-01 + migration 0691 applied, P7-04 2026-11-05). Next P8-01 | Nav dual-write, access contract |
| P8 | Readers + fiscal item lines | A | ✅ Done 2026-11-05 (P8-02 2026-11-01, P8-01 2026-11-05) | `org_tax_doc_items_dtl` (owner item §20-3) |
| P9 | PIECE level enablement | B | ✅ Done 2026-11-05 (P9-01 migs 0692/0694 applied; P9-02 HQ offers `PIECE`) | Edit piece speed/discount need HQ policy rules (owner) |
| P10 | Recompute, tighten (M10), drop (M11) | A / C | ✅ Done 2026-11-06 (0698, M10 = 0699, M11 = 0700 applied; HQ cleanup done) | |
| P11 | Verification and docs (both repos) | A–C | ✅ Done 2026-11-07 (gates, docs pack, related docs, HQ docs) | Owner QA remains |

## Log

- **2026-11-07 (P11 docs done — plan complete in code):**
  - **This folder:** new [README.md](README.md) (doc map + implementation checklist: permissions none new, navigation, HQ-owned settings, APIs added / removed, migrations, constants, i18n, shared UI, HQ, mobile), [developer_guide.md](developer_guide.md) (calculator boundary and contract, Create / Edit flow, extending, tests), [user_guide.md](user_guide.md) EN/AR, [CHANGELOG.md](CHANGELOG.md), `version.txt` 1.0.0.
  - **Related:** Order_Fin `README.md`, `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md`; ADR-060 status Accepted and Implemented; glossary terms `service_speed`, `speed_premium`, `tax_category`, `line_net` (EN/AR, taken from the existing UI copy); `integration-contracts.md` (both repos) records the HQ-owned order-finance settings exception (C14); HQ `docs/features/Order_Fin/progress_status.md` HQ part.
  - **Gates:** `check:i18n` passes. `check:platform-info-inventories` reports the same 6 navigation-vs-contract drift warnings as before (delivery, catalog preferences, roles, permissions, payment settings; none from this plan); it only refreshed the DRIFT_REPORT timestamp.
- **2026-11-07 (P11: legacy pricing code removed):** no runtime caller was left for the pre-calculator money path, so it is deleted (pre-launch, no compat):
  - `POST /api/v1/pricing/calculate` (route), `lib/services/pricing.service.ts`, `lib/services/order-calculation.service.ts` (legacy `calculateOrderTotals`, `toFinancialBreakdownSnapshot`), `lib/services/tax.service.ts` (only the pricing service used it);
  - `lib/db/orders.ts` `deleteOrderItem` + `recalculateOrderTotals` (a legacy header-totals writer with no caller); `lib/db/order-discounts.ts` `insertDiscountLinesInternal` (no caller);
  - tests of the deleted code: `create-totals.golden`, `create-pricing.golden`, `order-calculation.service.test`, `tax.service.test`; stale mocks removed from 4 commercial/payment tests; the b15 guard now asserts `lib/db/orders.ts` has no totals recalculation.
  - Kept: the `OrderCalculationResult` shape (the checkout quote's totals) moved to `lib/types/order-financial.ts`.
  - Found while checking: after today's Prisma pull `discount_level` is required (M10); `commercial-line.writer.ts` always set it, now its type says so.
  - Checks: `tsc` 0; ESLint 0; affected suites 13/13 (115 tests); full jest 531/543 suites — the 12 failures are not from this change (6 need `NEXT_PUBLIC_SUPABASE_*` env and pass with placeholders; labels / receipt print / receipt page are other uncommitted work in the tree; `overpayment-disposition.wallet` mock lacks `findMany`, pre-existing since P8; `platform-inventories` nav drift); DB suite 55/56 (only local wf SIMPLE v2 stage-sequence drift); `npm run build` exit 0.
  - Also 2026-11-07, Order Edit V2 WP17: migration 0702 (committed-order column guard) applied and proved, see the [WP17 note](../../Order_Edit_V2/CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY/WP17_Postponed_Committed_Column_Guard_v3.0.md).
- **2026-10-31 (Reusable View speed premium):** the express premium inside item prices is shown as its own "included" line (saved: item `speed_premium_amount` on calculator orders; draft: optional quote `speedPremiumIncludedAmount`). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View extras fix):** one "Extras included" line from the calculator's `includedModifierAmount` (saved: item `service_pref_charge` on calculator orders; draft: new optional `extrasIncludedAmount` on the checkout quote). The old piece/preference lines overlapped. Draft overpayment now passed through. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-11-01 (P7-03 done: tax rounding fields):** one Zod schema `lib/validations/tax-profile-rounding-schema.ts` (level `LINE`|`DOCUMENT` from `TAX_ROUNDING_LEVELS`, mode from `CURRENCY_ROUNDING_MODES` = `sys_rounding_mode_cd`, output decimals 0–6, increment 1–1000 minor units; null = currency default) used by `createTaxProfileAction` / `updateTaxProfileAction` (now validated at the boundary), `POST /api/v1/settings/tax/profiles` and `PATCH …/[profileId]`. Tax setup form → **Rounding** fieldset (round at, method with "Currency default", decimals, increment; EN/AR `taxSetup.rounding.*`). **Found and fixed:** `PATCH /api/v1/settings/tax/profiles/[profileId]` wrote `tax_rate` / `secondary_tax_rate`, columns that do not exist — every rate change through that route failed; it now writes `rate` (`secondaryTaxRate` removed: no column). Test `__tests__/validations/tax-profile-rounding-schema.test.ts` (3). `tsc`, ESLint, `check:i18n` ✓.
- **2026-11-01 (P7-02 + P7-05 done together — single writer, L18):**
  - **HQ API (`cleanmatexsaas/platform-api`):** tenant tax-pricing GET/PATCH now carries `commercial_level` (only `ITEM` accepted until P9), `disc_alloc_mode` (`DOCUMENT_LEVEL` | `ALLOCATE_TO_LINES`) and read-only `disc_alloc_basis`; the new fields are optional on PATCH (an older client leaves them unchanged), audited old → new through the existing order-fin audit. Branch DTO: `tax_pricing_mode` / `extra_price_pricing_mode` overrides (null = inherit, `@IsIn` exact codes), audited old → new (`tenant_branch:pricing_overrides:update`; `AuditModule` imported). `tsc` clean, `nest build` ✓.
  - **HQ web:** Tax & Pricing tab → card **Commercial calculation** (level disabled with "Per-piece pricing is not available yet", allocation select, read-only basis, "Changes apply to new orders only"); branch edit page → card **Pricing overrides** (Inherit from organization / modes; Inherit sends null). EN/AR `tenants.orderFinSettings.taxPricing.commercial.*`, `branchOverrides.*`; `check:i18n` ✓. (The 8 ESLint errors in `edit-branch-screen.tsx` predate this change: `any` in old catch blocks, unescaped quotes.)
  - **Tenant app:** `PATCH /api/v1/tenants/me` refuses `tax_pricing_mode`, `extra_price_pricing_mode`, `commercial_level`, `disc_alloc_mode`, `disc_alloc_basis`; `PATCH /api/v1/branches/[id]` refuses the two overrides (even null) — both answer `403 { code: 'FIELD_MANAGED_BY_HQ', fields }` before anything is written (`HQ_MANAGED_PRICING_FIELDS`, `FIELD_MANAGED_BY_HQ` in `lib/constants/order-financial.ts`). Organization and branch settings screens show the modes read-only with "Managed by platform administration" (EN/AR `settings.pricingMode.managedByPlatform`, `inheritFromOrganization`); their Save/Cancel and draft state are gone. Test `__tests__/api/v1/hq-managed-pricing-fields.route.test.ts` (7). `tsc`, ESLint clean.
- **2026-11-01 (P8-02 done: tax-document item lines):** `createTaxDocumentTx` copies each active item's line money into `org_tax_doc_items_dtl` in the same transaction as the document (line no, name EN/AR snapshot, quantity, unit price, discount = line + allocated order discount, net, tax category, rate, tax, line total); the rows are never updated (credit notes reference them). An order written before the calculator has no line money: no item lines are written and a warning is logged, never invented figures. `getTaxDocumentPrintDetail` returns `items`; the tax-document print shows an **Items** table above the tax lines (EN/AR `taxDocuments.print.itemColumns.*`, `itemsTitle`). DB test (`order-fin-view-sources.db.test.ts`): a calculator order's two lines copied and read back exactly; a legacy order → no lines. `tsc`, `check:i18n` ✓.
- **2026-11-05 (P9-02 code done; P10-02 and P10-03 code done; migration 0698 waiting for the owner):**
  - **P9-02:** HQ offers `PIECE` (DTO, Tax & Pricing card, EN/AR). The card now shows the stored level; it always showed Item before. HQ web and API build pass. Piece speed and discount in Edit still need the HQ policy rules (`CHANGE_SERVICE_SPEED`/`PIECE`, `CHANGE_DISCOUNT`/`PIECE`).
  - **Legacy writers retired:** every order is now on the calculator, so the guard already refused these. Removed the orphan page `/dashboard/orders/[id]/prepare`, `addOrderItems`, `completePreparation` (`lib/db`), their actions, `find-or-create-product`, `/api/v1/preparation/[id]/items` (POST, PATCH, DELETE), `insertDiscountLines*`. The Preparation screen's Delete button, which always got 409, is gone; its Edit Order button does this. Create now requires a quote. A split sub-order is refused by the legacy guard too, copies the parent's commercial settings and writes zero line figures.
  - **Bug fixed:** the Preparation price panel recalculated tax from one default rate; it now reads the stored header.
  - **Legacy update removed (owner asked to close the risks):** the edit-a-draft mode did not exist any more (only Edit Order V2 enters edit mode, and it never called `/update`). Removed `PATCH /api/v1/orders/[id]/update`, the `update-order` action, `OrderService.updateOrder` (~800 lines), the unused `EditOrderScreen`, New Order's legacy save and amendment-reason dialogs, `POST /api/v1/orders/[id]/items/[itemId]/pieces` and `createPiecesForItem*`, with their tests (`order-service.edit-boundary`, `order-amendment-governed-flow` DB test). Amendment settlement history and its route stay. The orphan `/prepare` page had no menu row (`sys_components_cd` has only `/dashboard/preparation`).
  - **Migration 0698 applied by the owner (local + remote), verified: 0 empty price types, 0 minimums above price. Migration 0699 (M10) written, waiting for the owner:** items and pieces NOT NULL + I5 CHECK; discount level NOT NULL; `fix_order_data` skips calculator orders and sub-orders. DB fixtures updated (one legacy no-figures case removed: such a line can no longer exist).
  - **0699 owner review (before apply), changes:** a piece can no longer be ROLLUP; `SPEED_RULE` dropped from `price_source` (never written; DB and constant); a list source must name its list and other sources none; a speed premium must name its rule, Standard has none (ROLLUP items exempt: the parity proof found a piece-priced item at Standard summing an Express piece's premium); money columns never negative (speed premium excepted: a speed sell price may be below the normal price); a PIECE discount names its line too. **Security fix:** `fix_order_data` was SECURITY DEFINER and executable by `anon` and PUBLIC with an optional organization, so anyone could run it across all organizations; now anon/PUBLIC lose EXECUTE and a signed-in user must name an organization they belong to (the service role keeps all). The split sub-order line copies `price_list_id`/`speed_rule_id`. The parity DB proof now checks every 0699 rule on the rows Create and Edit store.
  - **2026-11-06: 0699 applied by the owner (local + remote), types and Prisma regenerated in both repos.** Remote has all 8 new CHECKs; tenant `tsc` clean. The rules caught two test fixtures (an EXEMPT rewrite that zeroed tax but kept the line total; a speed premium with no rule): fixed, DB proofs 11/11. Full DB suite: 44/55 suites pass; the 11 failures are unrelated environment/fixture issues (missing Supabase URL in the test env, RLS JWT, user code, cash drawer), none touch line money. Next: M11 (0700).
  - **2026-11-06: M11 `0700_retire_product_express_cols.sql` applied by the owner (local + remote), types and Prisma regenerated in both repos.** Remote: the 4 columns are gone, `service_category_code` is NOT NULL, the key is `uq_org_prod_tenant_ctg_code`, and `get_product_price_with_tax` is gone. HQ cleanup and seeder proof: see the next entry.
    - New `seed_product_speed_rules`: gives each product a catalog seeder just created its EXPRESS rule, taken from the template. With pricing and an Express price that differs from the normal price, the rule is SELL_PRICE. Otherwise, a factor above 1 gives MULTIPLIER (factor − 1). Turnaround comes from the template. It never creates a rule that adds nothing (the 0694 lesson) and never a second rule for a product. It creates none when the organization's own active, in-date, all-branch rule for all products or for the product's category already covers it, so a template rule never overrides the organization's pricing. `get_product_price` keeps its NUMERIC(10,3) precision, so its results don't change.
    - **Production review pass (same day), existing seeder bugs fixed:**
      - An unknown organization id seeded every template; it now raises.
      - Products are unique on (tenant, `product_code`), but the seeders skipped only active products. One inactive product made the whole run fail; any existing row is now skipped (a product switched off stays off), with `ON CONFLICT` for concurrent runs.
      - A second run created a second default price list.
      - The price-history trigger cast free-text `updated_by` (e.g. `system_migration`) into a UUID column, which made default-price updates by such actors fail.
      - Seeded rules now get the same history row the Speed Pricing screen writes (`created_by` is a UUID column, so it is NULL for a system seed).
      - Rule inserts use `ON CONFLICT` on the scope index.
      - `DROP TRIGGER ... RESTRICT`.
      - Deploy note: HQ catalog screens that select the dropped columns by name must deploy with the HQ cleanup, right after 0700. Existing products and rules are untouched, so no price changes silently.
    - **Product key changed (owner request, 2026-11-06):** `org_product_data_mst.service_category_code` is now NOT NULL, and the table is unique on (tenant, `service_category_code`, `product_code`) (`uq_org_prod_tenant_ctg_code`), replacing `org_product_data_mst_tenant_org_id_product_code_key`. The same item can now be offered in several categories, as the templates already allow. Every writer already sets a category: seeders copy the template's (NOT NULL), tenant create requires an enabled one, inventory uses `RETAIL_ITEMS`. Checked:
      - no foreign key uses the old key;
      - no NULL categories (remote 0/127, local 0/53);
      - after regenerating types, `service_category_code` is required on insert. HQ `|| null` fallbacks in `tenants.service.ts` (initializeCatalogCustom) and `catalog.repository.ts` (`addProductsFromTemplates`) must be removed in the HQ cleanup;
      - no other function has a conflict target on it;
      - Postgres 17.
      - The seeders match existing products on category + code and use `ON CONFLICT ON CONSTRAINT uq_org_prod_tenant_ctg_code`.
      - Tenant pricing CSV import (`lib/services/pricing-bulk.service.ts`, `app/api/v1/pricing/import/route.ts`): it accepts an optional `category_code`. A code found in several categories is reported as ambiguous instead of failing `.single()`.
      - After `prisma:pull` the compound unique becomes `@@unique([tenant_org_id, service_category_code, product_code])`. No code uses the old Prisma name.
      - **HQ follow-up (M11 cleanup):** these places still match tenant products on code alone and must match on category + code:
        - `platform-api/src/modules/catalog/catalog.repository.ts`: available templates (~1514) and `addProductsFromTemplates` (~1612; it also skips only `rec_status <> 0` rows);
        - `services/tenant-catalog.service.ts:123` (missing products);
        - `services/product-comparison.service.ts:90-91, 203` (comparison maps and the single-product lookup).

        Templates have no code in two categories today, so nothing breaks yet.
    - `initialize_tenant_product_catalog` and `reseed_missing_products` stop writing the retired columns and call the helper. Their result gains `speed_rules_created`. They are now service-role only: anon and signed-in users had EXECUTE before.
    - `get_product_price`: the Express fallback is gone, and the missing tenant predicate is added on the price-list join. anon loses EXECUTE.
    - `get_product_price_with_tax`: dropped. It had no caller and a hard-coded 5% tax fallback.
    - Price-history trigger rebuilt without the Express column; the old version wrote the invalid `NEW.id || '_express'`.
    - The 4 product columns are dropped with RESTRICT.
    - Remote check before writing: no views, constraints or indexes on the 4 columns, and no other function calls them. Tenant code no longer reads them. SQL and PL/pgSQL parse offline with pglast; the migration was not executed.
    - **After apply:** an HQ cleanup (product screens/types/bulk ops/`product.dto`; the custom catalog path calls `seed_product_speed_rules` for the products it inserts), then build and `tsc` in both repos. Done; see the next entry.
  - **2026-11-06: M11 HQ cleanup (`cleanmatexsaas`) done.**
    - `platform-api/src/modules/tenants/tenants.service.ts`, `initializeCatalogCustom` (onboarding with picked templates). It was broken: it inserted a column that does not exist (`created_at2`), so every custom initialization failed. Now:
      - it enables the template categories for the tenant first (`fk_org_prod_ctg`), as the RPC does;
      - it upserts products on the new key, ignoring duplicates, so a re-run is safe;
      - the product code is the template `item_code`;
      - `??` instead of `||` on prices, so a 0 price stays 0;
      - the minimum price is copied only with pricing;
      - it calls `seed_product_speed_rules` for the inserted ids and returns the real inserted count, plus `speed_rules_created` (additive).
    - `platform-api/src/modules/catalog/catalog.repository.ts`, available templates and `addProductsFromTemplates`:
      - existence is keyed on category + code, counting any status (an inactive product blocks re-adding, as in the seeders);
      - the code is `item_code` (it used `template_code`, equal today, with a `PROD-…` fallback that would never match a template again);
      - upsert ignoring duplicates; `??` on prices;
      - Express rules seeded.
    - `services/tenant-catalog.service.ts` (catalog status, missing products) and `services/product-comparison.service.ts` (comparison maps): keyed on category + code. Result rows keep the real `product_code` and gain `service_category_code` (additive).
    - `dto/tenant-product.dto.ts`: `UpdateTenantProductDto.service_category_code` can be left out but not null or empty (the DB now rejects null).
    - `platform-web/lib/api/catalog.ts` (`TenantProduct`) and `src/features/tenants/ui/tenant-products-screen.tsx`: the retired Express price is removed.
    - Left as is, because these are template or category fields that stay: the template and category screens/DTOs (`product.dto.ts`, `product-template.dto.ts`, `service-category.dto.ts`, `catalog.types.ts`), and the template express price in bulk import/export.
    - Checks:
      - HQ API `tsc`: 0 errors outside test files (the spec-file errors predate this);
      - ESLint: only errors that predate this, on lines not changed;
      - `nest build` exit 0; `platform-web` `next build` exit 0;
      - tenant `tsc` 0; tenant catalog unit suites 36/36; DB proofs `order-change-edit-parity` + `order-fin-view-sources` 8/8.
    - Seeder proof on local, in a block that always rolls back (nothing kept):
      - a fresh organization got 59 products, 44 Express SELL_PRICE rules with 44 history rows, and 1 default price list;
      - a second initialize created 0 products and no second list;
      - an inactive product was not re-added by reseed (`already_exists` 59);
      - a default-price change by `system_migration` wrote a history row (`created_by` NULL, actor in `created_info`);
      - the demo organization reseed added its 13 missing retail items with 0 rules (retail templates have no Express price or factor).
    - The P10-03 items above are resolved: the 5 functions were replaced, a new tenant gets Express rules, and `addOrderItems` no longer exists.
    - **Found, not changed (pre-existing, unrelated to 0700):** the old HQ template-by-code methods filter `sys_service_prod_templates_cd` on a `product_code` column that does not exist: `getProductByCode`/`createProduct`/`updateProduct`/`deleteProduct` in `catalog.repository.ts`, and `compareSingleProduct` in `product-comparison.service.ts`. Templates are keyed by `item_code` + `service_category_code` (the newer composite-key template methods work). Listed in the owner follow-ups.
    - **Found for P11:** `/api/v1/pricing/calculate`, `pricing.service` and the legacy `calculateOrderTotals` have no runtime caller and should be deleted.
  - **2026-11-06: HQ Products & Items Config workspace built (owner request).** All HQ product setup moved out of `/catalog` into `/products-items-config` (API module `products-items-config`, own screens, `catalog.view` / `catalog.manage`, audited). The HQ catalog paths named in the M11 cleanup above moved with it (`modules/catalog/*` product code is now `modules/products-items-config/*`); the template-by-code bugs listed there are gone (dead `catalog/products` removed, single compare re-keyed). 19 pre-existing HQ bugs fixed on the way, including onboarding custom catalog picks that always failed. No migration; tenant app unchanged. Detail, QA list and owner follow-ups: HQ repo `docs/features/Products_Items_Config/STATUS.md`.
  - **Checks:** `tsc` clean; `npx eslint . --quiet` clean; 19 related suites (156 tests) pass; DB proofs 11/11; `npm run build` exit 0; inventories synced.
  - **Migration 0698 (P10-02):** demo organization only. 6 empty price types become `PER_PC`; 41 minimums above the sale price are cleared (PF-24 was recorded as 4). New products default to `PER_PC`.
  - **M10 scope decided:** items and pieces NOT NULL + I5 CHECK; discount `discount_level` NOT NULL. Not constrained: order headers (20 DB test fixtures and 68 local rows have none, sub-orders stay without a calc version), charge tax columns (nullable by design), preference §6.3 columns (no writer sets them; review whether to drop).
- **2026-11-05 (P9-01 proved on real PostgreSQL; migrations 0692 and 0694 applied by the owner, local and remote):** The Edit parity proof now runs a PIECE order: Create with a piece on its own speed, a piece discount and a line discount shared across pieces; then Edit changing a piece's speed and discount. It checks the item equals the sum of its pieces, a new rule price reaches only the piece being changed (L24), the slowest piece sets the ready time, history rows name the piece and its line, and a ready line refuses a piece speed change.
  - **Bugs this proof found and fixed, none of which the mocked tests caught:**
    1. A piece's own speed was refused as inactive, because the loader only read the speeds of the order and its lines.
    2. Edit answered `NO_CHANGE` for a piece's speed or discount: change detection looked only at the order and its lines.
    3. Apply refused a piece speed change: the speed audit was not built for it.
    4. Apply refused a piece discount as `REVIEW_CHANGED`: Preview and Apply recorded different "before" facts for it.
  - **Bug found in the financial view, not from P9 (fixed):** the tax source had no `rec_status` filter. An Edit retires the old tax rows, so after any Edit the detailed statement listed the old tax lines beside the new ones (the order total stayed right), and raised `SECTION_LINES_MISMATCH`. The tax report had the same gap and overstated tax after an Edit. Both now read live rows only; the proof asserts the warning no longer appears after an Edit, and the route test checks the filter.
  - **Test note:** `order-change-mutation.service.test.ts` cannot load without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: it imports the outbox processor, which now reaches the Supabase browser client through `stored-value.service.ts` (changed by other work, not this plan). It passes with placeholder values.
  - **Next:** P9-02 (enable `PIECE` in HQ), P10-02, P10-03, P11.
- **2026-11-05 (bulk retire, retail exemption, zero-rule cleanup; migration 0694 waiting for the owner):** The owner asked whether a general multiplier rule works (yes, already), then asked for a way to retire product rules in bulk, a cleanup of the 32 zero-multiplier rules, and why there is no master table.
  - **Finding that changed the cleanup:** 28 of the 32 zero rules are retail goods, and the calculator had no retail exemption. Those rules were all that kept a rule for all products off retail: tenant `11111111…` has an active all-products Express rule (+25%, 6 hours, created 2026-11-05), so deleting them first would have priced bleach at +25% and moved it from ready at once to 6 hours.
  - **Retail exemption (new rule):** `speedRulesForProduct` (`lib/commercial/speed.ts`) leaves a rule for all products out for a retail item; a rule naming its category or product still applies. The calculator (Create and Edit) and the resolver both use it, so "Which rule applies?" still matches what is charged.
  - **Bulk retire:** Speed Pricing › **Retire product rules**, `POST /api/v1/catalog/speed-rules/bulk-status` (`pricing:bulk`, CSRF). Pick a speed and optionally a category. The server counts first (`dryRun`) and warns when no general rule would take over, because those products would then cost the same as Standard. Rules are deactivated, not deleted, one history row each (`BULK_RETIRE`, `BULK_RESTORE`), and can be restored from the same dialog. Restoring also brings back any rule retired one at a time in that choice; the dialog says so.
  - **Migration 0694 `0694_retire_zero_speed_rules.sql` (written, not applied):** deletes the seeded zero-multiplier product rules (only rows with 0640's mark, and no order line using them), with one history row each. **Deploy the code first.** On remote: 0 orders, 32 rows, none used. Effect on new orders: retail unchanged; SAREE and TUXEDO_PRM follow a general rule, and their Express time moves from the seeded 0 hours to the general rule's or the category's.
  - **Master table decision (recommendation, owner can overrule): not now.** The owner asked why not `org_speed_price_rules_cf_mst` as master with the rules as detail. It would match the price lists (`org_price_lists_mst` + items) and add named rule sets switched on and off as one (for example seasonal rates). The cost is not the code (6 files read the table, and the pre-launch data is small) but a second selection question: with two active sets holding a rule for the same product, one must win, so sets need a priority on top of today's specificity and start date, and "Which rule applies?" must explain both. Nothing requested needs it: bulk retire works by filter, and start and end dates cover scheduled changes. Revisit if seasonal rate sets become a real request. If built, the names should be `org_speed_price_sets_mst` and `org_speed_price_rules_dtl` (one suffix per table).
  - **Also seen on remote:** migration 0692's pairs are present, so the PIECE database proof (P9-01) can run once the owner confirms local too. Migration `0693` belongs to other work (label printing flag).
  - **Checks:** `tsc` clean; ESLint clean on the changed code; `check:i18n` passes; 33 suites, 443 tests pass (service, routes, calculator, Edit). **Not run:** the dialog in a browser, migration 0694 against a database.
- **2026-11-05 (P9-01 code written; migration 0692 waiting for the owner):** Inert until P9-02 enables `PIECE` in HQ.
  - **Calculator:** a piece has its own discount and speed on a piece-priced line. A line discount no longer throws at PIECE level: a percent applies to each piece, an amount is split exactly by what each piece costs. A per-line premium goes on the first piece following the line's speed. The item is ready when its slowest piece is; each piece keeps its own time. A piece discount or speed on an item-priced line answers `PIECE_PRICING_UNAVAILABLE` (it was a raw 500).
  - **Loader, writer, requests:** `pieces[].serviceSpeed` and `pieces[].lineDiscount` on the quote and create requests; speed checked against active speeds; `orders:discount` and the reason checked for a piece discount as for a line; the piece row stores its own speed, rule and ready-by.
  - **Cart:** the quote returns each piece's figures for a piece-priced line, and the line breakdown shows each piece with its speed and discount controls, when pieces are tracked. With pieces not tracked, the line controls still work.
  - **Edit, written and tested with mocks only (needs migration 0692 for a real Apply):** a stored piece discount and a piece on its own speed survive a re-price: its premium and ready time stay as agreed (L24), and the pieces following the line are priced from their own stored figures, not the item's rollup. `CHANGE_SERVICE_SPEED` and `CHANGE_DISCOUNT` accept a `PERSISTED_PIECE` target; a ready line's pieces keep their speed (`LINE_SPEED_LOCKED`). The cart shows the piece rows in Edit too, for a line stored as `ROLLUP`.
  - **Changed reading:** `manualLineDiscounts` now reads only ITEM rows, and the new `manualPieceDiscounts` reads PIECE rows. So on a piece-priced line a line discount shows on each piece in Edit, not as one line discount; setting one on the line replaces the manual discounts of all its pieces.
  - **Migration 0692 `0692_oc_edit_piece_speed_discount.sql` (written, not applied):** adds the two PIECE pairs to the operation catalog and widens `oc_op_target_ck` so Apply can store a piece operation.
  - **After applying (owner):** tell me; I then extend the real-database parity proof to a PIECE order and do P9-02. **HQ action, later:** add policy rules for `CHANGE_SERVICE_SPEED`/`PIECE` and `CHANGE_DISCOUNT`/`PIECE` to each Edit policy, a new draft version and publish, as for P6-02. Until then those controls are refused with their reason.
  - **Known wording limit:** a piece's speed menu says "Order speed (Express)" for "follows its line".
- **2026-11-05 (P8-01 done; P8 complete):** The readers now use the line figures.
  - **Bug found and fixed: the header tax buckets were always 0.** `recalculateOrderFinancialSnapshotTx` hard-coded `exempt_amount`, `zero_rated_amount` and `out_of_scope_amount` to 0, so e-invoice decomposition and the financial view never saw them. They now come from the stored rows (`lib/commercial/tax-category-buckets.ts`): lines and charges add their taxable amount, and a DOCUMENT_LEVEL discount comes off its category. A unit test compares this with the calculator's own `categoryTaxable`. `non_taxable_amount` stays 0: no tax category maps to it.
  - **Second bug in the same place:** a calculator order with no tax lines stored its whole amount as `taxable_amount`, even when every line was exempt. It now stores the standard-rated total.
  - **Tax report:** adds the taxable amount per category (`categories`, additive) and shows it on Reports › Financial › Tax. It also counted cancelled orders; it no longer does. Its figures, and the rest of that screen, use the currency's decimals instead of a fixed 3. The CSV is unchanged.
  - **Receipt:** each line shows `line_total_amount` (after its discounts, with tax), formatted in the currency; it printed the raw gross number before.
  - **Public tracking and portal:** items gain `lineTotalAmount` (additive), and the page shows it. `totalPrice` stays, so the mobile app is unaffected.
  - **Dashboard:** top services are summed from `net_amount`, so a line discount lowers revenue.
  - **Order items list, workflow item list, Ready screen:** the gross stays, with "After discount: X" under it when the line has a discount (`OrderLineNetNote`). `GET /orders/[id]` already returned the new columns (the route spreads the row), so it did not change. Prints and the invoices and receipts tabs were already on the Reusable View.
  - **Must be handled in P10-03 (adds to the list under P7-04):** M10's NOT NULL needs every writer of order lines to set the line figures. `addOrderItems` (Preparation) does not; check the others (split, piece writers) before writing M10.
  - **Checks:** `tsc` clean; ESLint clean on the changed code; `check:i18n` passes; new `tax-category-buckets.test.ts` and `finance-tax-report.route.test.ts`; on real local PostgreSQL the Edit parity proof passes, now also asserting the buckets, and `order-fin-view-sources`, `order-change-reviewed-snapshots` and `e-invoice-decomposition` pass. **Not run:** these screens in a browser.
- **2026-11-05 (P7-04 done; P7 complete):** The owner applied migrations up to 0691 (local and remote; checked on remote: navigation row, RLS, CHECK, DECIMAL(19,4)), regenerated types and Prisma, and committed.
  - **Retired fields out of the code:** `default_express_sell_price`, `multiplier_express`, product `turnaround_hh_express` and `is_tax_exempt` are no longer read or written by the tenant app, except that `get_product_price` (DB function) still reads the first one until M11. The category's own `turnaround_hh_express` and `multiplier_express` (`sys_service_category_cd`) stay.
  - **Product form:** the express fields are gone; a **Tax category** select and a **Speed pricing** section are added (price per speed with the rule behind it, this product's rules, add and edit in place). The section saves separately from the form, so it sits outside it, and it is hidden without `pricing:read`. A new product shows a note: speed prices come after saving. `GET .../speed-rules/resolve` gains `price` (additive).
  - **Inventory add-item modal:** the 3 express fields are gone; Tax category added. Speed prices for an inventory item are set in Speed Pricing.
  - **Import/export:** `price_express` and the new `express_multiplier` (0.30 adds 30%) create the product's EXPRESS rule; `turnaround_hh_express` goes on that rule; new `tax_category_code` column. A row with an express column needs `pricing:create` on top of `products:create` (row error, nothing written). Refusals are row errors in EN/AR. The export fills these columns from the rules.
  - **Changed from PLAN §7:** the plan says the columns "upsert or remove" the rule, but import is insert-only (`products:create` is its gate, BF-23), so they only create a rule on a new product. A row with an existing code is refused, as it was. Bulk users lose nothing: an existing product's express price was never editable by import; "Add for a category" on Speed Pricing covers bulk changes. A FIXED_AMOUNT rule exports blank (`shortcut:` comment).
  - **Bug found and fixed:** the advanced template could never import. Its column is `price_regular`, the validator read only `price` ("Price is required" on every row). It also ignored `min_qty`, `turnaround_hh` and `is_active`; these are now read.
  - **Bulk pricing:** a generated list always starts from the normal price (an `express` or `vip` list used the express price before).
  - **New Order cards:** `useProductSpeedPrices` quotes one unit of each service product on the page at the order speed (customer, branch, speed rule; one debounced request, none at Standard or in Edit). If any product on the page cannot be priced, the whole page falls back to the catalog price and the note.
  - **Removed dead code:** `useOrderState.ts` (no importer; it did client pricing), `getOrderForPreparation` (no caller), the `defaultExpressSellPrice` cart field.
  - **Must be handled in P10-03 (found here, recorded so M11 does not break them):**
    1. Five DB functions read the retired columns: `get_product_price`, `get_product_price_with_tax`, `initialize_tenant_product_catalog`, `reseed_missing_products`, and the trigger function `log_product_default_price_change`. M11 must replace them.
    2. **A new tenant gets no Express rules.** `initialize_tenant_product_catalog` copies the template's express price into the column the calculator no longer reads; migration 0640 only seeded existing products. So every new tenant's Express costs the same as Standard until this is fixed.
    3. **Items added in Preparation are not on the calculator.** `addOrderItems` (`lib/db/orders.ts`, preparation form and `/api/v1/preparation/[id]/items`) still prices through `pricing.service` and `get_product_price`, whose express branch reads the retired column. When M11 removes it, an item added to an Express order in Preparation loses its premium unless this moves to the speed rules first.
  - **Left as is:** the Pricing page still offers an `express` price list type, but the calculator reads only customer and standard lists, so such a list has no effect on an order. No such list exists on remote.
  - **Checks:** `tsc` clean; ESLint clean on the changed code; the 91 affected suites ran with 798 passed and 1 failed (golden P03, which expected the removed express fallback; updated). After that fix and the new tests (`catalog-import-express.test.ts`, `use-product-speed-prices.test.ts`, resolver price cases), the 5 changed suites pass (56 tests); `check:i18n` passes; inventories synced (6 drift warnings, unchanged); `npm run build` exit 0. The contract check does not look at API gates on `[id]` routes (`audit-wire.ts` route regex), so those gates were checked by reading each route. **Not run:** these screens in a browser, a real import against a database.
- **2026-11-05 (P7-01 code done; migration 0691 waiting for the owner):**
  - **P0-05 decided:** Speed Pricing reuses the existing `pricing:read/create/update/delete/bulk` codes (already seeded and granted to roles), so no permission migration (M8) is needed.
  - **Migration 0691 `0691_speed_pricing_nav_audit.sql` (written, not applied):** navigation row `catalog_speed_pricing` after Pricing; `org_price_history_audit` accepts `speed_rule`, `old_price`/`new_price` widened from (10,3) to DECIMAL(19,4) so a 4-decimal rule value stays exact, and RLS turned on with a tenant policy (it was off on this `org_*` table: found while writing this, 0 rows on remote). **Until it is applied, saving a rule fails on the audit CHECK.** After applying, run `npm run prisma:pull` and regenerate types.
  - **Service and APIs:** `lib/services/catalog/speed-rules.service.ts`, routes under `app/api/v1/catalog/speed-rules` (list, create, `[id]`, `bulk`, `resolve`). Every change writes its history row in the same transaction (PLAN §6.6). The resolver uses the calculator's own `selectSpeedRule`.
  - **Delete behaviour:** a rule an order line used answers 409 `RULE_IN_USE` (deactivate it instead). An unused rule is really deleted, not soft-deleted: the scope unique index covers every row, so a soft-deleted rule would block creating the same scope again. Its history row stays.
  - **Screen:** Catalog › Speed Pricing (`/dashboard/catalog/speed-pricing`): list with filters, order-of-rules card, editor dialog, "Which rule applies?" panel, bulk create for a category, EN/AR. Typed amounts are sent exactly as written; changing the price type clears the amount and says so at the field (rule #15).
  - **Shared UI:** `CmxListOfValuesDialog` gained optional `onSearchChange` for server search (backward compatible).
  - **Also changed:** `GET /api/v1/pricing/history` leaves speed-rule rows out unless asked for them, because that timeline shows prices and a rule's value may be a multiplier. There is no screen for reading speed-rule history yet (it can be read with `entityType=speed_rule`).
  - **Checks:** `tsc` clean; ESLint clean on the changed files; 23 new tests pass (service + routes, mocked DB); `check:i18n` passes; access contract wire check passes for the route (page and API gates); inventories synced (6 drift warnings, pre-existing count); `npm run build` exit 0. **Not run:** the screen in a browser, or any write against a real database (needs 0691).
- **2026-11-01 (P10-04 and P10-01 done):**
  - **P10-04:** the checkout quote no longer looks up or applies the `ACCOUNTING` rounding rule (one minor unit since 0686, so it always gave 0); `roundingAdjustmentAmount` stays in the response, always 0 (no contract change; the modal and cart hide a zero rounding row). One DB lookup less per quote. Older orders keep their stored `rounding_adjustment_amount`, and the view still shows it.
  - **P10-01 (only what has no caller):** removed `POST /api/v1/orders/preview-financials`, `POST /api/v1/orders/estimate-ready-by` (+ `lib/api/orders.ts estimateReadyBy`, `OrderService.estimateReadyBy` and its types), `POST /api/v1/orders/recalc-preference-charges` + `order-preference-charge-recalc.service.ts`, their tests and 7 access-contract entries (removed one entry at a time, never a whole route). **Kept:** `calculateOrderTotals` (still called by `pricing/calculate`, `order-service` legacy paths, the payment engine and the snapshot writer) and `PUT /orders/[id]/update` (New Order's edit-a-draft mode uses it). 74 commercial + 64 related tests pass; `tsc` clean.
- **2026-11-01 (Reusable View P7–P9 done — Reusable View plan complete):** hardening (security cases, timing p95 42 ms, observability, E2E spec), rules file + `/order-fin` skill + Cursor rule, full docs pack. P4-05 access contracts done (a `derive --apply` that rewrote 18 permissions was found and repaired). Next in the combined order: Line-Level P7 (configuration). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-11-01 (Reusable View P6 done):** every order money screen now shows the one view (detail, full, prints, handovers, collect-payment, workspace, delivery, AR invoice, payment-modal summary, Edit live card, public tracking, customer app); four browser/app computations removed (one a real credits bug in the customer app). QA scenarios: Reusable View `QA_TEST_GUIDE.md`. Next: Reusable View P7–P9.
- **2026-10-31 (Reusable View P5 done):** shared statement / money-text / collapsible components, `OrderFinancialView`, live Edit quote hook + card, print report, EN/AR. Next: Reusable View P6 (screens). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P4 done):** staff view, batch headers, server action, public tracking and customer-portal views, Edit quote route (shares Preview's calculation), one error envelope + no-store + rate limits. Next: Reusable View P5 (the shared component). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-05 done — its Phase 3 complete):** normalizer unit tests and a golden DB fixture (view = writer snapshot = reconciliation). Next: Reusable View P4. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (rounding guard, owner-approved "both"):** cash rounding stays a payment concern (change on a cash tender only). Guard so the order total can never be rounded coarser than the currency's minor unit: migration **0686** `chk_scrr_acct_minor_unit` (ACCOUNTING rules: increment NULL or 1, `output_decimal_places` NULL; all 181 remote rows comply) — **applied by the owner 2026-10-31 (local + remote; verified validated + commented; types and Prisma regenerated in both repos)**; HQ `platform-api` `RoundingRuleService` refuses the same with `ACCOUNTING_ROUNDING_TOO_COARSE` on create and update (4 unit tests, build ✓); HQ rule form validates the increment at the field (EN/AR `currencyRounding.fields.accountingIncrementInvalid`, ESLint, `tsc`, `check:i18n` ✓). The now-dead Create rounding step is P10-04.
- **2026-10-31 (Reusable View P3-08 done):** `mapEditQuoteToSourceSet` + server `editQuoteFromPreview` for the Order Edit live card; the edit parity DB test now proves card = Review = saved order after Apply on every edit. (A cash-rounding finding was first logged here and then withdrawn: cash rounding applies only to the change, by design.) Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-03b done):** the statement adds up: rounding line, tax-inclusive tax shown as included (mode from the order or the writer record), and the writer's own total formula as a view check (`ORDER_TOTAL_COMPONENT_MISMATCH`). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-07 done):** `mapDraftToSourceSet` for payment-modal-v4 (quote + engine figures, no recomputation); found the view has no rounding line yet (P5). Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-06 done):** public projection (allowlist, per-method tender totals, healthy snapshots only) and its strict schema; every view field must be classified public or private by test. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-04 done):** `getOrderFinancialHeaders` batch reader (one query, snapshot only, cap 100) for list and handover screens. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).
- **2026-10-31 (Reusable View P3-03 done):** `getOrderFinancialView` covers every section, the timeline and the warnings; BF-14 resolved (view warnings and reconciliation share the aggregation module). Migration 0681 applied. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (Reusable View P3-03 part 1):** `getOrderFinancialView` returns the value and settlement sections and the header. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (DB integrity findings handed off):** the schema-wide issues found during P2/P3-02 (87 composite tenant FKs with `ON DELETE SET NULL`, 105 single-column FKs between tenant tables, 318 FKs without an index, 128 prefix-redundant + 36 duplicate index sets, dead charge-type aliases, no delivery-fee capability) are written up for a separate package in [DB_Integrity_Hardening/FINDINGS.md](../../DB_Integrity_Hardening/FINDINGS.md). Not part of this program.

- **2026-10-31 (Reusable View P3-02 done):** all view sources written; migration 0681 (tenant-first order indexes on vouchers and invoices) waiting for the owner to apply. Finding: 89 composite tenant FKs use `ON DELETE SET NULL` (banned pattern), to be its own package. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (migration 0680, owner request):** charge-type catalog gains DELIVERY, SERVICE, OTHER; the hard-coded `charge_type` CHECK is replaced by an FK to `sys_charge_types_cd`. Waiting for the owner to apply. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (Reusable View P3-01):** view contract types, constants and Zod schema added. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (Reusable View P2 done):** migration 0679 applied local + remote, types and Prisma regenerated. Next: Reusable View P3.

- **2026-10-31 (Reusable View P2-01):** migration 0679 (receipts tenant-first order index) written; waiting for the owner to apply. Details in the [Reusable View STATUS log](../Reusable_Order_Fin_View/STATUS.md#log).

- **2026-10-31 (Reusable View P1B-13 done: Phase 1B complete):**
  - Order Edit V2 Open Decisions doc: D21–D24 rows, each marked decided and implemented with the rule as built (D24 written as built in P1B-15, not the earlier "only if already earned" wording).
  - Order Edit V2 Test Guide: OC-CALC-011–018 parity scenarios and a §21 evidence table naming each test file and command. OC-CALC-018 (live card = Review) stays `NOT_APPLICABLE_YET` until Reusable View P3-08/P4-08.
  - Docs only; no code, no migration.

- **2026-10-31 (Reusable View P1B-12 done: parity suite complete):**
  - `order-change-edit-parity.db.test.ts` now also proves: the cart quote (`toCartQuote`, what `POST /orders/quote` returns) equals the stored header total, tax and each line total; and an Edit that drops a promo order below the promo's minimum returns `ACKNOWLEDGEMENT_REQUIRED` with the removal (`MIN_ORDER_NOT_MET`), then, acknowledged, voids the promo row, voids the usage row and lowers `current_uses` by one.
  - **Bug found and fixed:** the unpaid Create path (`createUnpaidOrderFromCheckoutTx`, used by customer booking) never logged promo usage, so an automatic promo on a booking did not count, and an Edit could not give it back. It now calls `applyPromoCodeTx` like the staff submit (PF-15, C8). The proof fails without the fix.
  - The Edit live quote route (`.../changes/quote`) is P4-08; its parity test ships with it (P3-08: card = Review).
  - Gates: full unit run 498/499 suites pass (the 1 failure is `platform-inventories` nav-vs-contract drift, nothing touched here); Edit and loyalty DB suites pass; ESLint clean; `tsc` clean for touched files; `check:i18n` passes; `npm run build` passes.

- **2026-10-31 (Reusable View P1B-10 done: Edit Apply's loyalty change is traced to the change):**
  - `recalculateOrderFinancialSnapshotTx` takes an optional `loyaltySource`; Edit Apply passes `ORDER_EDIT` + the order change id, so the ledger row's key is `loyalty-ORDER_EDIT-<changeId>` (PR-16).
  - `finalizeOperations` now receives the order change id (it already existed before the callback ran).
  - Proof: `order-change-edit-parity.db.test.ts` checks that a quantity edit writes the `LOYALTY_EARN` request with that trigger and source.
  - Gates: 256 unit suites (2,696 tests), Edit DB suites pass, ESLint clean, `tsc` clean for touched files.

- **2026-10-31 (Reusable View P1B-15 done: loyalty points follow the order, LE-01 closed):**
  - The owner applied migration 0676 and regenerated types and Prisma.
  - `recalculateOrderFinancialSnapshotTx` calls `reconcileOrderLoyaltyEarn` (trigger `ORDER_FIN_RECALC`, source = calculation trace id) when the order has a customer and its settled flag, total or refunded amount changed. Workflow cancel calls it after the cancel RPC (trigger `ORDER_CANCEL`). `queueEarnPoints` and the checkout-only call in `settleOrderTx` are gone.
  - The `LOYALTY_EARN` handler calls `reconcileOrderLoyaltyEarnTx`: locks the order, reads earned-so-far from the ledger, posts the delta as designed below. The idempotency key is `loyalty-<trigger>-<sourceId>`.
  - Tests: unit tests for paid later, edit up at the recorded rate, edit down, refund clawback with a shortfall, a request after a shortfall, redelivery, double click, still owing; a new DB proof `loyalty-order-earn-reconcile.db.test.ts` runs the same story on the real tables.
  - Found and fixed: four order-change DB suites crashed at import since P1B-05 (Apply now loads `discount-service`, whose settings service builds a browser Supabase client). They mock the client like the other DB suites.
  - Gates: 256 unit suites (2,696 tests) pass; order-change, refund and cancel DB suites pass; ESLint clean; `tsc` clean for the touched files.
  - QA guide: S17.

- **2026-10-31 (Reusable View P1B-15 started: migration 0676 written, STOP):**
  - P0-08(d) re-checked on the remote DB: ledger types are EARN, REDEEM, EXPIRE, ADJUST, BONUS; the earn rate is not stored; `idx_loyalty_txn_order` already exists.
  - Migration `0676_loyalty_order_earn_reconcile.sql` adds `org_loyalty_txn_dtl.earn_rate` (rate at the order's first earn) and `unreversed_points` (clawback shortfall when points were already spent). No new type: a clawback is a negative ADJUST row with `order_id`.
  - Design (code after the migration is applied):
    - **One trigger point:** `recalculateOrderFinancialSnapshotTx` (16 callers: checkout, later collection, credit application, refunds, edit, split, vouchers, adjustments…) emits the reconcile request when the order has a customer and its settled flag, total or refunded amount changed. Every current and future settle path is covered without wiring each caller. Workflow cancel (a DB RPC) emits it right after the RPC succeeds.
    - **Consumer** (`LOYALTY_EARN` handler, same event type): locks the order row, computes the target, posts the delta. Target = 0 when the order is cancelled or has no customer; no change while the order still owes money; otherwise `floor(max(0, total − refunded) × rate)`. Rate = the first EARN row's `earn_rate`, else the current program rate.
    - Positive delta → EARN row (a new FIFO lot). Negative delta → ADJUST row for what the balance covers, the rest in `unreversed_points`. Earned so far = Σ points − Σ unreversed over the order's EARN and ADJUST rows, so redelivery or a double click gives delta 0.
    - `queueEarnPoints` and the direct call in `settleOrderTx` are removed.

- **2026-10-30 (Reusable View P1B-11 done: Review shows each discount change):**
  - The Review dialog has a **Discounts recalculated** box: one line per changed discount ("Weekday 10%: −0.430 → −0.630") and per removed one ("… removed (was −…): the order is below its minimum amount"). Kept discounts are not listed. Amounts are in the order's currency with its decimals; names use `source_name2` in Arabic.
  - Each removal has its own checkbox; ticking it sends `DISCOUNT_REMOVED:<key>` and the cashier reviews again. Apply is offered only after every removal is acknowledged.
  - Edit controller fix: acknowledgements are kept per `seq` + `gateCode` (before, a second gate on the same step replaced the first).
  - EN/AR keys under `orders.edit.review.discounts.*`.
  - Tests: controller (two gates on one step), view mapping (kept is hidden), dialog render (lines, one checkbox, the right gate code). 39 order-change UI tests pass; `check:i18n`, ESLint, `tsc` (my files) and `npm run build` pass.

- **2026-10-30 (Reusable View P1B-05 done: recorded discounts re-checked on Edit, D21):**
  - New pure module `lib/services/commercial/edit-discount-reevaluation.ts`. Each recorded ORDER discount, in its recorded order (manual → rule → promo):
    - manual percent: the recorded rate again; manual amount: kept, capped at the base;
    - rule: the same recorded rule (`source_id`, never "best rule today"); its percent on the new base, else the recorded amount capped;
    - promo: never redeemed again; percent on the new base within its maximum, amount kept and capped.
  - A rule or promo is removed when the edited order no longer meets a condition an edit can change: minimum or maximum order amount, minimum line count, service categories. Dates, usage limits, customer tier and day/time were met at drop-off and are not checked again.
  - `quoteOrderEdit` returns `discountChanges[]` (KEPT / CHANGED / REMOVED, reason code, before and after amount). `readEditOrderRecord` reads the referenced rules and promotions (tenant-filtered).
  - The calculator's order-discount context now also carries the lines' service categories.
  - Preview: each removal needs a `gateDecisions` entry with `gateCode` `DISCOUNT_REMOVED:<key>`; until then the status is `ACKNOWLEDGEMENT_REQUIRED` and no review proof is issued. A discount acknowledgement never stands in for a policy warning.
  - Apply: a removed promo gives its use back (`reversePromoUsageTx`).
  - **Before P1B-11 ships**, a removal blocks Apply (the Review UI cannot send the acknowledgement yet). That is safe, never silent. P1B-11 adds the list and the acknowledgement, and fixes the Edit controller so an acknowledgement is kept per `seq` + `gateCode` (today it is per `seq`).
  - Tests: 13 unit tests, an end-to-end loader test (rule kept, re-applied, removed), 3 Preview tests, 1 Apply test. 272 in commercial, order-change and golden pass; the DB parity proof passes. `tsc` has no errors in these files, and ESLint is clean. No migration.
  - ~~Not done: a DB parity step for a removed promo with real usage rows~~ done in P1B-12 (2026-10-31).

- **2026-10-30 (P6-04 done: customer app booking on the server calculator):**
  - **Where:** `cmx_mobile_apps` (`packages/mobile_services`, `packages/mobile_l10n`, `apps/customer_app`). No server change, no migration.
  - **Error codes:** `OrderBookingService` maps `booking_piece_invalid`, `SERVICE_SPEED_INVALID`, `PRODUCT_NOT_FOUND`, `PREFERENCE_NOT_AVAILABLE`, `PRICE_NOT_RESOLVED` to customer messages; laundry setup failures the customer cannot fix (`TIMEZONE_NOT_CONFIGURED`, `MISSING_TENANT_CURRENCY`, `MISSING_CURRENCY_CODE`, every `PROFILE_*`) show "Online booking is not available for this laundry right now. Please contact the laundry." 4 new EN/AR keys plus `booking.successTotal`.
  - **Confirmation:** the success card shows "Total: 5.250 OMR" from the response's `totalAmount`/`currencyCode`; decimals from the currency's ISO rule; display only, the line is omitted when no total came back.
  - **Not built:** the optional speed choice. The bootstrap returns no speeds or speed prices, so the app has nothing to offer; it needs a bootstrap field first (server work). Recorded as a follow-up.
  - **Checks:** new tests pass (3 service, 2 formatter); booking provider tests pass; `flutter analyze` clean on `mobile_services`, `mobile_l10n`, `customer_app`; touched files formatted. One booking screen test ("shows grouped preferences on booking step two") fails, and fails the same on the committed code without this change (checked by setting the change aside); not caused here.

- **2026-10-30 (P6-03 done):** owner applied 0673 on both databases. Verified read-only: remote catalog `TENANT_VAT_RATE`, `TAX_RATE`, `TENANT_VAT_ENABLED` inactive, both profile values and both `TAX_RATE` overrides inactive; local `TAX_RATE` catalog and overrides inactive (local had no `TENANT_VAT_RATE`); `TAX_PRICING_MODE` active on both. Tax now comes from tax profiles only.

- **2026-10-30 (P6-03 R2–R7: tax from tax profiles only):**
  - **R1 verified:** remote BlueWave has `VAT 5%` (default, from 2025-12-16). Local inserted nothing: the local catalog has no `TENANT_VAT_RATE`, so local BlueWave already paid 0%.
  - **R2 calculator:** `getTenantVatRate` removed from the loader inputs and the branch that built a profile from the setting deleted (`commercial-context.loader.ts`, checkout, quote, Edit loader, preview reads). **Kept on purpose:** `TENANT_RATE_PROFILE_ID` / `isTenantRateFallback` for tax lines **recorded** on older orders (NULL profile id), so Edit still re-prices those orders at their recorded rate. The plan said to delete these; doing so would have broken Edit of old orders.
  - **R3 readers:** legacy `calculateOrderTotals` has no fallback; `pricing.service` (both lookups), booking bootstrap `vatRate` and the preparation preview read `getDefaultVatRate` (new in `tax-engine.service.ts`: sum of active, effective, general default VAT/GST profiles, as a fraction; 0 with none). The preparation preview also assumed 5% when unset (B15 breach); gone. `checkoutBreakdown` lost a dead fallback branch.
  - **R4:** `TaxService.getTaxRate`, its 5-minute cache, `clearCache`/`clearAllCache` removed; TaxService keeps `calculateTax`/`isTaxExempt`.
  - **R5:** the Finance settings page now explains that tax rates are tax profiles and links to Tax Setup (EN/AR, Cmx, server component); its contract has `settings:read` (from navigation) and no API dependencies; `check:ui-access-contract --wire` passes; inventories rebuilt.
  - **Found:** the plan assumed a "tax readiness" check would show a missing default profile; none exists. Added a warning on Tax Setup (`CmxSummaryMessage`, EN/AR) when no active, effective, general default profile exists (`hasDefaultTaxProfile`, tested).
  - **R6 (code part):** `SETTING_CODES.TENANT_VAT_RATE` removed. Migration 0673 deactivates the catalog codes `TENANT_VAT_RATE`, `TAX_RATE`, `TENANT_VAT_ENABLED`, their profile values and tenant overrides (kept for history). No reader left in either repo (HQ checked). Waiting for the owner.
  - **Goldens (R7):** G25 flipped (no profile means no tax), listed in `P1_01_CHARACTERIZATION.md`; G30–G32 and the price-lookup goldens take the same rate from a profile and keep every figure. 69 characterization tests pass.
  - **Gates:** related suites 32/32; full jest 4,687 of 4,688 (the one failure is the existing navigation drift on delivery, catalog preferences, roles, permissions and payments; the finance page adds none). `tsc` 0, ESLint clean on changed files, `check:i18n` passes. `next build` passes.

- **2026-10-30 (P6-03 R1: tax profile backfill written):**
  - **Rechecked on remote:** BlueWave Laundry Co. is still the only tenant with no tax profile; its `TENANT_VAT_RATE` resolves to 0.05 (profile GCC_OM_MAIN). The other two tenants have default profiles and never reach the fallback.
  - **Condition matched to the code:** the calculator falls back only when a tenant has **no active, currently effective profile at all** (`commercial-context.loader.ts`), not "no default VAT profile" as the plan worded it. The migration uses that exact condition, so a tenant with only a non-VAT default would not get a new VAT line.
  - **Migration 0665:** inserts one default `VAT` profile per such tenant at `TENANT_VAT_RATE × 100` (the profile rate is a percent), DOCUMENT/HALF_UP like the existing profiles, effective from the tenant's creation date. Reads the JSON value as number or numeric string; skips 0, unset or unreadable. Idempotent. Dry-run SELECT on remote: one row, BlueWave, 5.00%, from 2025-12-16.
  - **Waiting:** the owner applies 0665 (local and remote). Then: verify BlueWave's quote stays at 5% through a real profile, R2–R5 + R7, and R6 (settings deactivation) last.

- **2026-10-30 (P6-02f done: real-database proof of the line controls; P6-02 complete):**
  - **Proof:** `order-change-edit-parity.db.test.ts` now runs 14 steps on local PostgreSQL. New: a line back to STANDARD (shirt line 2 × 2.000 = 4.000); a line price set to 4.000 with its reason (stored `price_override`, `override_reason`, line 8.000) and returned to standard (both cleared, line 10.000); a 10% line discount (one MANUAL row on the line, rate 10, amount 0.400, order total lower) and its removal (no active row, total back); a custom line (no product, its name, 7.250); a stale shown price (Preview lists 4 → 5, Apply charges 5). After every Apply the header equals the reviewed total, pieces add up to their line, the tax lines add up to the header tax.
  - **Bug fixed on the way:** see part 1 below; migration 0664 applied by the owner, the proof then passed first time.
  - **Gates:** DB proof passes; full jest 4,689 of 4,690 pass. The one failure is `platform-inventories` navigation drift, which predates this step (no navigation changed). Other DB proofs that fail (auth session registry, auth admin config, legacy `updateOrder` amendment, finance smoke RLS, cash-drawer attribution, workflow issue-catalog seed counts) fail on fixture or seed data and do not touch the change history; not caused by this step. `tsc` 0 errors, ESLint clean on the changed files, no i18n change. `next build` passes.
  - **Not done:** the HQ policy rules for `CHANGE_SERVICE_SPEED`/`CHANGE_ITEM_PRICE`/`CHANGE_DISCOUNT` on ITEM (HQ owner action, unchanged); browser QA S9–S13.

- **2026-10-30 (P6-02f, part 1: the real-database proof found a shipped bug):**
  - **Found:** the extended Edit parity proof (line speed, line price, line discount, custom line, shown price) failed at the first line control. Apply records every operation in `org_order_change_ops_dtl`, and both its code check (`ITEM_CODES` in `order-change-mutation.service.ts`) and its two database CHECKs (`oc_op_catalog_ck`, `oc_op_target_ck`, last set in 0622) still listed only the V1 catalog. So every Apply of `CHANGE_SERVICE_SPEED` on a line, `CHANGE_ITEM_PRICE` and `CHANGE_DISCOUNT` was refused (`OPERATION_INVALID`), in P6-02b and P6-02c alike. The unit tests mock this writer, so they never reached it.
  - **Fix:** `ITEM_CODES` now takes the three codes as line rows; migration `0664_oc_change_ops_line_targets.sql` widens both CHECKs the same way (rows already stored are unaffected). Unit test added (line rows accepted, a line operation without its line still refused).
  - **Waiting:** the owner applies 0664 (local and remote) and regenerates types and Prisma; then the proof is rerun and P6-02f finishes (full gates, docs).

- **2026-10-30 (P6-02e done: price confirmation in Order Edit, Reusable View P1B-14 Edit part):**
  - **Decision (changed from the plan row):** Edit does not reject with `PRICE_CHANGED` or open the New Order dialog. Why: in Edit, Preview is the quote and nothing is saved until Apply. The Edit cart is not server-quoted (it shows the catalog price the client picked), so a hard reject would bounce every added line on a customer price list or a speed rule, and "Use current prices" has no cart quote to refresh. Review already shows the server price and Apply needs a fresh review proof, which is what PLAN §6.5 asks for Order Edit ("a price change after Preview makes the preview proof stale, and Review shows the same per-line list").
  - **Contract:** `ADD_ITEM.confirmedUnitPrice` (money text), only on a catalog line with no price override (an entered price is the one charged); the schema refuses it with `customItem` or `priceOverride`.
  - **Preview:** `priceChanges: [{ seq, orderItemId, shownUnitPrice, currentUnitPrice }]` for added lines whose calculated unit price differs by half a minor unit or more (same rule as Create, shared `samePrice` helper). The response passes it to the client.
  - **Audit (PR-16):** the `ADD_ITEM` snapshot records `shownUnitPrice` from the request next to `pricePerUnit`, so the change history keeps both. It is taken from the request, so Preview and Apply produce the same digest.
  - **Review:** a changed line gets a warning ("Prices changed", reused from New Order, plus a hint that Apply charges the price shown) and a "Price shown in the cart" row beside the unit price. Lines whose price held do not show the row.
  - **After Preview:** a price that moves between Review and Apply changes the signed snapshot, and Apply answers `REVIEW_CHANGED` (existing proof check; new test proves the snapshot moves).
  - **i18n:** `orders.edit.review.priceChangedHint`, `orders.edit.review.fields.shownUnitPrice` (EN/AR). No migration, no HQ action.
  - **Tests:** schema, Preview (changed, unchanged, digest moves), Review view (row shown only on a changed line), workspace adapter (catalog line sends the shown price, an overridden line does not). Related suites: 29 suites, 279 tests pass. `tsc` 0 errors, ESLint clean on the changed files, `check:i18n` passes, `next build` passes.

- **2026-10-30 (P6-02d done: custom lines in Order Edit):**
  - **Found first:** an order with a custom line (Create P5-03e, `product_id` NULL) could not be edited at all: the Edit baseline refused a line without a product and the cart projection dropped it. Both now take it: the line keeps a cart key of its own (`custom:<item id>`), shows its stored name and price, and is edited like any other line (quantity, preferences, speed, price, discount). It never sends a product change.
  - **Contract:** `ADD_ITEM` takes exactly one of `productId` or `customItem` (`name`, `name2`, `unitPrice` as money text, `serviceCategoryCode`); a custom item takes no `priceOverride` (its price is the entered one).
  - **Policy and permission:** the existing `ADD_ITEM` rule; on top, `pricing:override` as on Create (`PRICE_OVERRIDE_NOT_PERMITTED`). The New Order "custom item" button now shows in Edit when the user has `pricing:override` and `ADD_ITEM` is allowed.
  - **Pricing and writer:** the projection passes the custom item to the Edit loader, which prices it like Create (entered price, `price_source` MANUAL). Apply inserts it with `product_id` NULL, its name, name2 and service category, and reads no catalog row for it. Its audit records no product and its name.
  - **Tests:** schema (product or custom, not both, not neither, no override on a custom item, blank name), Preview (custom line with and without `pricing:override`), loader (priced at its entered price, no product), Apply (inserted with no product, no catalog read), workspace adapter (an order with a stored custom line loads, sends nothing when untouched, sends a new custom line by name and price). Related suites: 130 suites, 1,080 tests pass. `tsc` 0 errors, ESLint clean on the changed files, `check:i18n` passes (no new keys), `next build` passes.

- **2026-10-30 (P6-02c done: line price override and line discount in Order Edit):**
  - **Contract:** `CHANGE_ITEM_PRICE` on a stored line (`PERSISTED_ITEM`): `{ priceOverride: money text | null, overrideReason }`; a set price needs its reason, null returns the line to its standard price. `CHANGE_DISCOUNT` on a stored line: `{ lineDiscount: { type, value, reason } | null }`; a percent has at most 2 decimals (`discount_rate` is NUMERIC(5,2)), the reason is required, null removes the discount. `ADD_ITEM` takes an optional `lineDiscount`. One price and one discount operation per line per request. Both codes left `ORDER_CHANGE_UNAVAILABLE_OPERATION_CODES`; an order-level `CHANGE_DISCOUNT` (target `ORDER`) is still not accepted (no writer).
  - **Policy and permission:** both use the `ITEM` policy cell (`CHANGE_DISCOUNT` now resolves its target like the speed). On top of the policy, Preview asks the Create permissions: `pricing:override` for a line price (`PRICE_OVERRIDE_NOT_PERMITTED`), `orders:discount` for a line discount, also on a new line (`LINE_DISCOUNT_NOT_PERMITTED`). A price or discount on a line that is not on the order after the edit is refused (`UPDATE_NOT_ACTIVE`). The same price or discount entered again is no change.
  - **Pricing:** the Edit loader takes a stored line's `overrideUnitPrice` (absent keeps the stored one, null clears it; a cleared price reads the speed rule again) and `lineDiscount` (replaces only the line's `MANUAL` rows; price-list and other discounts stay). The new discount row is labelled as on Create (`MANUAL_LINE_DISCOUNT_LABEL`) and carries the reason in `rec_notes`. A discount above the line price is refused by the calculator (`LINE_DISCOUNT_EXCEEDS_GROSS`), never clamped.
  - **Apply:** writes `price_override`, `override_reason` and `override_by` (the session user's `org_users_mst.id`, null when the price is cleared); the price itself comes with the calculated money columns (`price_source` MANUAL under an override). The history row is recorded against the line (target `ITEM`).
  - **Audit:** a price operation records the price, its reason, the unit price and the line total before and after; a discount operation records the type, value and reason before and after (read from the line's `MANUAL` rows by `manualLineDiscounts`, the same way in Preview and Apply, so the reviewed audit digest matches the stored one). A new line's discount is in its `ADD_ITEM` audit.
  - **Screen:** the Edit context gives each line its stored price, reason and discount. The cart's price pen and the line discount button now work in Edit, each gated by its own `ITEM` cell and permission; the discount dialog caps an amount at the stored line total (the server checks again). The adapter sends a price or discount operation only where it differs from the stored one. Review shows the discount type, value and reason (EN/AR), and explains the three new refusals.
  - **Tests:** schema (price reason, percent decimals, blank reason, null clears, one per line, no `ORDER` target), Preview (price on its cell, missing permission, discount with audit, same discount is no change, removed line), loader (price and discount set, stored price kept or cleared, only the `MANUAL` discount replaced), Apply (price columns written, history on the line), context (discount read tenant-scoped), controller (operations only where they differ). Related suites: 131 suites, 1,087 tests pass. `tsc` 0 errors, ESLint clean on the changed files, `check:i18n` passes, **`npm run build` passes** (it caught a client import of the Decimal money helper; the comparison helpers moved to `order-change-line-money-compare.ts`, which has no imports).
  - **Not in this step:** an order-level discount change in Edit (still no writer); the real-database proof for line price and discount is in P6-02f.
  - **HQ action (unchanged):** add `CHANGE_ITEM_PRICE`/`ITEM` and `CHANGE_DISCOUNT`/`ITEM` rules (with `CHANGE_SERVICE_SPEED`/`ITEM`) to each Edit policy; until then those controls show disabled with the reason.

- **2026-10-30 (P6-02b done: per-line speed in Order Edit):**
  - **Migration 0662** applied by the owner on local and remote (types and Prisma regenerated). Remote check: `CHANGE_SERVICE_SPEED` and `CHANGE_DISCOUNT` each have targets `ORDER` and `ITEM`. The `PIECE` rows the owner tried were removed before apply: per-piece speed and discount belong to the `PIECE` commercial level (P9).
  - **Contract:** `CHANGE_SERVICE_SPEED` takes target `PERSISTED_ITEM` (one line) as well as `ORDER`; `ADD_ITEM` takes an optional `serviceSpeed`. The policy target is `ITEM` for a line, so a policy can allow the order speed and not a line speed, or the reverse (`CAPABILITY_POLICY_BINDING_MISSING` until HQ adds the `ITEM` rules).
  - **Rule:** an order speed change moves every line except a line with its own speed operation in the same request. A line that is ready (`quantity_ready` > 0 or `ready_at` set) keeps its speed: the operation that would move it is refused with `LINE_SPEED_LOCKED` (EN/AR in the Review dialog). Staff can still move the other lines one by one.
  - **Server:** the Edit context loads each line's `service_speed`, `quantity_ready` and `ready_at`. `speedChangesOf` and `lockedSpeedLineIds` (`order-change-edit-pricing.ts`) feed the projection (each line's own speed, a new line's speed, else the order speed) and the lock. A line-only speed change now creates a Change and is priced. Apply writes the order speed only for the `ORDER` target; each line's speed and ready-by are already stored from the calculated money columns. The speed audit lists each line's speed before and after; a line operation's history row carries its item id and target `ITEM`.
  - **Screen:** Edit shows the New Order line speed menu (and "Apply to all lines") on the stored line prices; Review re-prices. A line shows its own speed only where it differs from the order speed. The adapter sends a line operation only where the line's chosen speed differs from what the server would give it. The order and line speed controls read their own policy target (`resolveEditControlCapability(..., targetType)`).
  - **Tests:** Preview (line speed on its own cell, missing `ITEM` rule refused, ready line refused by the order or line operation, order speed with the ready line kept), controller (operations only where needed), workspace adapter (projection and change count), capability target filter, Apply fixture updated for the line speed in the audit. Related suites: 125 suites, 1,073 tests pass. `tsc` 0 errors, ESLint clean on the changed files, `check:i18n` passes.
  - **Build not run:** `npm run build` stopped at `prisma generate` (the query engine file is locked by a running process), and `next build` reported another build already running. Re-run it once the other build finishes.
  - **Not in this step:** a per-line ready-by in the audit (the order ready-by is there; each line's ready-by is stored by the calculator); the real-database proof for line speed is in P6-02f.

- **2026-10-30 (P6-02 approved; P6-02a done; migration 0662 written):**
  - **P6-02a, order speed from the catalog:** `CHANGE_SERVICE_SPEED` takes any speed code (`serviceSpeedCodeSchema`, the same shape check as New Order); the calculator refuses an inactive speed (`SERVICE_SPEED_INVALID`, already shown by the Edit workspace). The Edit view model, controller and baseline mapper keep any stored speed code; the adapter's `ServiceSpeed` cast is gone. No server writer change: a speed change always goes through the calculator before Apply writes `service_speed`.
  - **Tests:** schema test for the speed code shape. Order-change suites (validation, Edit feature, preview, apply): 87 of 87 pass. `tsc` 0 errors; ESLint clean on the changed files.
  - **Migration `0662_oc_edit_line_speed_discount_targets.sql` (written, not applied):** adds the `ITEM` target to `CHANGE_SERVICE_SPEED` and `CHANGE_DISCOUNT` in `sys_oc_order_edit_op_tgt_cd` and updates both descriptions. No rules are seeded (published policies are immutable; 0637 added its pairs the same way). Checked against `sys_oc_edit_catalog_guard`: `ITEM` is an allowed target and both operations exist.
  - **After apply, HQ action:** add rules for `CHANGE_SERVICE_SPEED`/`ITEM`, `CHANGE_DISCOUNT`/`ITEM` and `CHANGE_ITEM_PRICE`/`ITEM` to each Edit policy (new draft version, then publish). Until then those line controls are refused (`CAPABILITY_POLICY_BINDING_MISSING`).
  - **Next:** P6-02b, after the owner applies 0662 and regenerates types and Prisma.

- **2026-10-30 (owner decisions recorded everywhere, docs only):** every decision the owner gave on 2026-10-30 is now closed in STATUS, PLAN, QA_TEST_GUIDE and the Reusable View PLAN, DESIGN and STATUS. Out-of-date "owner pending" lines were corrected: the P1-01 sign-off was already done on 2026-10-23, and Q3 is settled. The demo catalog cleanup is delegated to Claude (P10-02). Migrations up to 0661 are applied. **No owner decision is open**; the only owner action left is the HQ profile rule `INIT_MOBILE_RETAIL` (checked 2026-10-30: in the catalog, in 0 profiles).

- **2026-10-30 (owner decisions 8 and 9: online retail paid on collection; booking arrival flow):**
  - **Decision 8:** a retail order may be paid later only when it comes from the customer app. It must not be delivered or closed; it waits at `ready` until the customer pays on collection.
  - **Code (`OrderService.createOrderInTransaction`):** a retail-only order paid later is now allowed only when the source is `customer_mobile_app`, the payment type is `PAY_ON_COLLECTION`, and no staff pay-later method is given. Every other retail pay-later is still refused (`RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED`), including `PAY_ON_DELIVERY`, which no collection gate holds. If the workflow profile would start such an order at or past handover (`out_for_delivery`, `delivered`, `closed`), Create refuses with the new code `RETAIL_PAY_LATER_STARTS_HANDED_OVER`; the booking answers `booking_item_unavailable` and logs a warning.
  - **Collecting the money:** already enforced for `PAY_ON_COLLECTION`. The gates `pickup_collection_settled` and `delivery_collection_settled`, plus pickup and delivery completion (`PICKUP_COLLECTION_REQUIRED`, `DELIVERY_COLLECTION_REQUIRED`), refuse handover while a balance is outstanding.
  - **Start status (found in the DB):** no live profile has a customer-app retail rule, so such an order falls to `INIT_DEFAULT` and starts at `intake`. That is safe, but not `ready`. The catalog also holds `INIT_RETAIL_DELIVERED` (any source → `delivered`); no live profile uses it, and the new code check refuses it for online retail.
  - **Migration 0661 (applied by the owner 2026-10-30):** adds catalog rule `INIT_MOBILE_RETAIL` (customer app, retail → `ready`, priority 35). Profile rules reference catalog codes by FK, and published versions are immutable, so **HQ** then adds the rule to a new draft version of each profile (create preset `RETAIL_SOLD`) and publishes it.
  - Stock for online retail is deducted at booking (unchanged), which holds the goods; cancelling the order is how they return.
  - **Decision 9 (reception confirms or edits on arrival):** already supported. A booking starts at `draft` (`INIT_MOBILE_DRAFT`, preset `REMOTE_DRAFT`, `pending_dropoff`). Since 2026-10-28 it is committed at creation, so Order Edit opens it, and every live Edit policy allows edits in `draft` and `intake`. Reception then uses "confirm physical intake" (`draft → intake`). Manual QA: book from the app, edit the draft to match the real items, then confirm intake.
  - **Tests:** retail guard +3 (online passes, online starting handed over refused, online pay on delivery refused); booking test now covers the new code. `tsc` 0, eslint clean on changed files.

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
