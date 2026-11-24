# Remaining test guide — Order Edit V2

**As of:** 2026-11-24
**Index:** [Remaining_Work_Index.md](Remaining_Work_Index.md)
**Gate this proves:** [Remaining_Before_Operators_Rely_on_Edit.md](Remaining_Before_Operators_Rely_on_Edit.md)

This guide is the open human proof. It does not replace the scenario catalog. Full steps for MAN-UI-001 to MAN-UI-014 stay in [Manual UI Test Guide](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md). Objective rows stay in [Test Guide and Scenario Matrix](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md) §15 (OC-UI-001 to OC-UI-012). No Playwright spec exists for these rows yet. A pass here is the evidence until that spec exists.

## Setup

| Need | Value |
|---|---|
| Tenant app | Edit on a committed calculator order (`commercial_calc_version` set). Pre-calculator orders must refuse money edits with `ORDER_NEEDS_RECOMPUTE` and still allow a header-only edit. |
| Actor | A user with `orders:edit`. A second user without it, for MAN-UI-002. A supervisor with `orders:edit_override` if any cell is `REQUIRE_OVERRIDE`. |
| Flag | `order_edit_v2` on for the organization. |
| Policy | The order’s organization resolves to a **Pilot** override (owner decision 2026-11-24: do not publish). For line-control rows, the five cells in the operator-gate file are saved on that Pilot policy. |
| Languages | English and Arabic. Arabic is mandatory for MAN-UI-009 and for any row that shows money or a reason. |
| Widths | Desktop, tablet (~768px), and a narrow POS width for MAN-UI-011. |
| Money | Use the organization’s real currency. Do not treat a rounded change as a failure when the note says it was rounded. |

Record one line per row: date, tester, order number, locale, result (`PASS` / `FAIL` / `EXCEPTION`), and a short note. A fail blocks the operator gate until it is fixed and re-run.

## A. Manual UI set

Walk each section in the Manual UI Test Guide. The companion column is the objective scenario.

| Row | Proves | Companion |
|---|---|---|
| MAN-UI-001 | Context bar and workspace load the order, not a blank editor | OC-UI-001 |
| MAN-UI-002 | A user without `orders:edit` never enters the editor | OC-UI-002 |
| MAN-UI-003 | A denied operation stays disabled and cannot be applied | OC-UI-003 |
| MAN-UI-004 | Warning and override ask for acknowledgement or a reason before Apply | — |
| MAN-UI-005 | Review names each operation and shows the financial result | OC-UI-005 |
| MAN-UI-006 | A stale revision reloads. Nothing is merged into the other editor’s change | OC-UI-006 |
| MAN-UI-007 | Reducing quantity on a tracked line is understandable | — |
| MAN-UI-008 | Leaving with unsaved edits warns. Discard restores the saved order | OC-UI-008 |
| MAN-UI-009 | Arabic layout, alignment, and money read correctly | OC-UI-009 |
| MAN-UI-010 | Keyboard reaches Review, Discard, and Apply. Focus is visible | OC-UI-010 |
| MAN-UI-011 | Desktop, tablet, and narrow width stay usable | OC-UI-011 |
| MAN-UI-012 | A balance or extra amount is a follow-up. Edit does not take the payment or the refund | OC-UI-012 |
| MAN-UI-013 | Two lines of the same product stay distinct in Review | OC-UI-004 |
| MAN-UI-014 | A long warning, reason, or error does not break the dialog | — |

OC-UI-007 (same idempotency key after a lost response) is already covered by the database concurrency proof. Do not block the operator gate on a browser replay of it.

## B. Line controls

The Manual UI Test Guide predates these controls. Run them in Edit after the five policy cells are saved on the Pilot organization override. Review, then Apply, unless the row says the server must refuse.

| Check | Expected |
|---|---|
| Order speed | Catalog speeds, not a hard-coded express flag. Review lists each line’s price and ready-by before and after. |
| Line speed | One line changes. Other lines keep their speed. |
| Piece speed | One piece changes. The parent line’s other pieces stay. |
| `LINE_SPEED_LOCKED` | A line that is ready or later refuses a speed change, with an English and Arabic reason. |
| Line price | Override plus reason. Review shows before and after. Clearing the override returns the stored price path. |
| Line discount and piece discount | Amount or percent, with a reason. Invalid money is refused, not rewritten. Needs `orders:discount`. |
| Custom line | Add a line with no catalog product (name, service category, unit price). Review shows the price. Apply stores it. |
| Price confirmation | When the quoted unit price differs from what the cart showed, Review lists that line before Apply. |
| Disabled cell | With the cell deny or missing, the control stays disabled and the side panel names the operation. |

## C. Retest the 13 November fixes

| Check | Expected |
|---|---|
| Preference on a new item | Add an item, put a preference on it, Review → Apply. The preference is saved on the new line. |
| Preference on a new piece | Same, on one new piece. |
| Preference whose parent is not in this change | Refused. A local row that is not added in the same change is not attached. |
| Edit header | Title and Review result on the start side. Exit, Discard, and Review on the end side, above the financial card. No empty band beside the card. |
| Policy notes | The side panel names the operations (“Change service speed…”, “Add an item, Remove an item…”). It does not show two unlabeled lines under Speed. |
| New Order cash change | “Change returned” matches the summary, including rounding (example: SAR 2.20, not the unrounded 2.17). |
| Rounded change on every cash tender | Split payment cash leg, Collect (Ready, Financial tab, Delivery), wallet top-up, and customer receipt show the rounded change and the “rounded from … to …” note. The saved amount is that figure. |
| Cash prefill when coins cannot pay the balance | Example OMR, 5-baisa step, balance 17.532: Cash or Exact leaves the amount empty and says it cannot be paid exactly in cash. Enter 17.535 and the 0.003 change rounds to 0.000. Collect keeps 17.532 as the amount due and requires cash tendered. A balance of 17.500 still prefills. |
| HQ permission routes | `/tenants/<id>/permissions/<code>` and `/edit` open (Next.js 16 `params`). |

The two rows that block operators are the new-item or new-piece preference, and any change figure that does not match the saved amount. The header, the policy-note labels, and the HQ permission pages are usability.

## D. Already proved — do not re-open as missing work

These passed on local PostgreSQL on 2026-11-07. Evidence: [WP18_Release_Proof_v3.0.md](WP18_Release_Proof_v3.0.md) and [WP17_Postponed_Committed_Column_Guard_v3.0.md](WP17_Postponed_Committed_Column_Guard_v3.0.md).

| Area | Proof |
|---|---|
| Same key, same payload | One Change; the second call replays |
| Same key, different payload | `IDEMPOTENCY_CONFLICT` |
| Two editors, one revision | One commit, one `VERSION_CONFLICT` |
| Workflow version moved after Review | `WORKFLOW_VERSION_CONFLICT`, no Change row |
| Settlement moved after Review | `REVIEW_CHANGED` under the order lock |
| Other organization’s id | Order unchanged |
| Direct data-API price or quantity on a committed order | Refused `42501` for `authenticated`. Workflow fields and the Prisma writers still succeed |
| Missing `orders:edit` | Preview and Apply return 403 |

The seven-step HQ versus tenant policy check is a later gate. Steps are in [Remaining_Before_Production_Path.md](Remaining_Before_Production_Path.md). It is not required to let a trained operator use Edit on one Pilot organization override. Version-default and profile-default steps in that check need a Published policy, so they stay out of this pilot.

## Pass rule

The operator gate passes when every section A and B row is `PASS` or `EXCEPTION`, and both blocking rows in section C are `PASS`. An exception names the owner and the date it will be retested.

---

## Financial_Expert_Tester Results — run oe1 (observe pass) 2026-11-24

**Tester:** Financial_Expert_Tester (Grok Bot), for Jehad. **Run id:** `oe1` (view-only; nothing applied, saved, published or assigned).
**Environment:** remote only — tenant https://cmx.cleanmatex.com (Demo Laundry LLC, OMR 3 dp; Demo Saudi Riyadh Dry Clean for the no-permission check), HQ https://hqsaas.cleanmatex.com. Time 07:06–07:28 Asia/Muscat.
**Order used:** ORD-20261123-00002 (Demo Laundry, status processing, Revision 1, total 2.354 OMR, 1 × Blouse 2.200 OMR), order id `f0d4c1d4-9212-443e-84d9-a6a12ced9cf8`. ORD-20261023-0003 from the 2026-10-24 runbook was not used.
**Edit URL pattern:** `/dashboard/orders/<orderId>/edit`.
**Accounts:** Demo Laundry admin, Demo SAR `qa.k5.accountant@saudiriyadhdemo.com` (role accountant), HQ SaaS admin. Credentials: see CREDENTIALS_AND_ENVIRONMENTS.md (never in this file). Demo Laundry operator sign-in failed twice ("Invalid user code, email or password. Please try again.") so the operator check was stopped to avoid lockout.
**Policy in force (HQ, read-only):** Demo Laundry LLC → organization override, All profiles, `ORDER_CHANGE_STANDARD_V1`, lifecycle **Pilot**, revision 3, "In effect". Tenant banner/side panel agree.
**Screenshots:** `C:\Users\JHNLP\qa-20261124\oe2\shots\` (zip `shots_oe1.zip`); file name named at each row.
**Writes still awaiting owner approval:** (1) HQ Pilot clone + five cells + org override, (2) Apply on `QA-OE` test orders, (3) cash-rounding payments, (4) parity check incl. Publish (conflicts with the 2026-11-24 "do not publish" decision — proposed BLOCKED).

### Prerequisite status (Remaining_Before_Operators_Rely_on_Edit.md)

| Gate item | oe1 observation | State |
|---|---|---|
| 1. Five cells on a Pilot policy | `ORDER_CHANGE_STANDARD_V1` (Pilot, rev 3), Processing: 15 rules (4 Allow with warning: Change Customer Snapshot, Change Order Notes, Change Priority, Change Ready By; 11 Require override: Add Item, Add Preference, Change Service Speed on Order; Add Piece, Add Preference, Change Item Quantity, Remove Item on Item; Add Preference, Remove Piece on Piece; Change/Remove Preference). **No cell** for CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE, CHANGE_ITEM_PRICE ITEM (`oe1-HQ-PolicyCells-1.png`, `oe1-HQ-PolicyCells-2.png`). | **NOT DONE** |
| 2. Who can edit | HQ tenant permissions list: `orders:edit` "Edit Order V2" and `orders:edit_override` "Override Edit Order V2 Policy" both show **0 roles**; only tenant_admin / super_admin hold them through "all 351 permissions" (`oe1-HQ-Perm-orders-edit-1.png`). | **NOT DONE** (see FET-OE2-Nov24-OrdersEditZeroRoles) |
| 3. Human tests | This run (below). | IN PROGRESS |

### A. Manual UI set

| Row | Result | Evidence |
|---|---|---|
| MAN-UI-001 | **PASS** | Edit opened on ORD-20261123-00002 with context bar (Main Branch 2, customer "Jh Test dev21", "Standard"), title "Edit Order #ORD-20261123-00002", "Revision 1 · Workflow status: processing · 0 unsaved changes", step tabs 1–5, item catalog and side panel; money card "No money change / Total 2.354 OMR". Not a blank editor. (`oe1-MAN-UI-001-1.png`) |
| MAN-UI-002 | **PARTIAL** | Demo SAR accountant: `/dashboard/orders` shows "Access Denied — You do not have permission to view this page. Contact your administrator if you need access."; a pasted Edit URL shows "Edit was not opened from the order screen" / "Open Edit from the order screen. A copied address does not start an edit." with "Back to the order" — never enters the editor (`oe1-MAN-UI-002-accountant-1.png`). Note: this used a Demo Laundry order id on the SAR tenant, so it proves the copied-URL guard rather than the `orders:edit` 403 itself. Demo Laundry operator not run (sign-in failed twice; no shot). |
| MAN-UI-003 | **PASS** (for the cells present) | Red banner "Change Item Price is not allowed at the current status." / "Change Discount is not allowed at the current status."; no line price / discount control offered; side panel names each gated operation (`oe1-MAN-UI-003-1.png`). Line-control version of this check is in section B (blocked). |
| MAN-UI-004 | **PARTIAL** | Review after Qty 1→2 + Add a piece shows "Review asks for a reason before Apply." and "Needs an override · CAPABILITY_POLICY_OVERRIDE_REQUIRED"; Apply not offered, only "Review again" (`oe1-MAN-UI-005-1.png`). Acknowledgement/reason entry then Apply not exercised (write). Raw codes shown — see FET-OE2-Nov24-RawReviewCodes. |
| MAN-UI-005 | **PASS** (content) / finding | Review dialog lists "Change item quantity · Blouse" (Quantity Before 1 → After 2; Line total Before OMR 2.200 → After OMR 4.400; Total Before OMR 2.354 → After OMR 4.708; Tax Before OMR 0.154 → After OMR 0.308) and "Add a piece · Blouse" (Piece number 2, Unit price OMR 2.200), header "Current total: 2.354 · Estimated total: 4.7080 · Financial result: OUTSTANDING"; money card "New total 4.708 OMR, Was 2.354 OMR +2.354 OMR, Balance after change 3.354 OMR, To collect" (`oe1-MAN-UI-005-1.png`). Issues: "4.7080" has 4 decimals vs OMR 3 dp; raw codes `REASON_REQUIRED`, `OUTSTANDING`, `CAPABILITY_POLICY_OVERRIDE_REQUIRED`; "Updating…" chip stays on the card. |
| MAN-UI-006 | NOT RUN | Needs two editors and an Apply (write). |
| MAN-UI-007 | NOT RUN | Needs a tracked-line reduction + Apply (write). |
| MAN-UI-008 | **PARTIAL** | With 1 unsaved change, "Review result: REASON_REQUIRED" banner kept (`oe1-MAN-UI-008-1.png`); Discard changes returned the editor to "Revision 1 · 0 unsaved changes", Qty 1, Total 2.200 / 2.354 OMR (`oe1-MAN-UI-008-2.png`) — PASS for Discard. Leaving via sidebar later raised the browser's native "Leave site? Changes you made may not be saved." even with **0 unsaved changes** (no shot) — false warning, and the warning is the generic browser dialog, not an in-app one. |
| MAN-UI-009 | **PARTIAL** | Arabic: RTL, title "تعديل الطلب #ORD-20261123-00002", card "الإجمالي 2.354 OMR". English left: page header "Edit Order", status "processing", item "Blouse" in side list, "Public tracking link". Currency position inconsistent: card "2.354 OMR" vs side list "OMR 2.200" (`oe1-MAN-UI-009-AR-1.png`, `oe1-MAN-UI-011-zoom150-AR-1.png`). |
| MAN-UI-010 | **PASS** (partial path) | Keyboard focus ring visible on Review (`oe1-MAN-UI-010-1.png`) and Discard changes (`oe1-MAN-UI-010-2.png`). Apply not reached because Review requires a reason/override first. |
| MAN-UI-011 | **PARTIAL** | 150%: header, Exit, Discard changes, Review and the money card usable; step tabs scroll, tab 3 clipped (`oe1-MAN-UI-011-zoom150-1.png`). 175%: header wraps. 200%: mobile layout with hamburger; Review/Exit/Discard and money card visible, but item workspace and side panel (with the bottom Review) clipped at the right edge and not scrollable into view (`oe1-MAN-UI-011-zoom200-1.png`). Remote adaptation: browser zoom used for tablet/narrow width. |
| MAN-UI-012 | NOT RUN | Needs Apply that creates a balance (write). Observed: money card says "Balance after change 3.354 OMR / To collect"; no payment control inside Edit (consistent with expected). |
| MAN-UI-013 | NOT RUN | Needs two lines of the same product (write). |
| MAN-UI-014 | NOT RUN | Needs a long warning/reason entry (write path). |

### B. Line controls

| Check | Result | Evidence |
|---|---|---|
| Order speed | NOT RUN | Speed dropdown "Standard" visible; side note "Change service speed: needs an override before it can be saved." Apply needed. |
| Line speed / Piece speed / `LINE_SPEED_LOCKED` / Line price / Line + piece discount / Custom line / Price confirmation | **BLOCKED** | The five cells are not on `ORDER_CHANGE_STANDARD_V1` (gate item 1). Waiting for owner approval of write (1). A per-line "Order speed (Standard)" dropdown is shown in the side list. |
| Disabled cell | **PASS** | With price/discount cells missing, the banner names "Change Item Price" and "Change Discount" (`oe1-MAN-UI-003-1.png`). |

### C. Retest the 13 November fixes

| Check | Result | Evidence |
|---|---|---|
| Preference on a new item / new piece / parent not in change | NOT RUN | Needs Apply (write 2). |
| Edit header | **PARTIAL** | Title + revision line on the start side; Exit, Discard changes, Review on the end side above the financial card — as specified. Empty band remains to the left of the money card, under the title (`oe1-C-EditHeader-1.png`). |
| Policy notes | **PASS** | Side panel: "Change service speed: needs an override before it can be saved." and "Add an item, Remove an item, Change item quantity, Add a piece, and Remove a piece: needs an override before it can be saved." No unlabeled lines under Speed. "Edit Policy Info" dialog lists each operation with level (Change customer details / notes / priority / ready by: Allowed with a warning; Add an item: Needs an override) (`oe1-C-PolicyNotes-1.png`, `oe1-C-PolicyNotes-2.png`). |
| New Order cash change / Rounded change on every cash tender / Cash prefill | NOT RUN | Needs New Order and payments (write 3). |
| HQ permission routes | **FAIL** | `/tenants/11111111-1111-1111-1111-111111111111/permissions/orders:edit` and `/permissions/orders:edit/edit` both render "Permission with code orders%3Aedit not found" (`oe1-HQ-Perm-orders-edit-2.png`, `oe1-HQ-PermRoute-edit-1.png`). No crash, but the page does not open the permission. |

### HQ observations (subject-related)

- Edit Policies list: ORDER_CHANGE_ASSEMBLY_QA_V1 Draft r4; ORDER_CHANGE_ISSUE_REPROCESS_V1 Draft r1; ORDER_CHANGE_OUTSOURCE_V1 Draft r1; ORDER_CHANGE_PICKUP_DELIVERY_V1 Draft r1; ORDER_CHANGE_STANDARD_QA_20261107_V1 Published r6; ORDER_CHANGE_STANDARD_V1 Pilot r3; QA_EPPR_CLONE_V1 Draft r19; WF_V2_FULL_PATH_EDIT_POLICY Pilot r8 (`oe1-HQ-EditPolicies-1.png`).
- Org Assignments, Demo Laundry LLC: override ORDER_CHANGE_STANDARD_V1, Pilot, rev 3, In effect (`oe1-HQ-OrgAssign-1.png`).
- Effective Preview (Demo Laundry, Standard V2 workflow, v2 PILOT, Processing, ADD_ITEM / ORDER): "Decision: Require override", "Resolution level: Organization override", "Policy code: ORDER_CHANGE_STANDARD_V1", "Deny reason: NONE", "Reason code: CAPABILITY_POLICY_OVERRIDE_REQUIRED" — matches tenant side panel. Same result lists "Uncovered statuses" including processing, preparing, packing, ready although Processing has 15 rules. Preview spun ~15 s (`oe1-HQ-EffectivePreview-1.png`).

### Recount (oe1)

Rows assessed: A 14, B 8 (grouped as 3 lines above), C 8. **PASS 6** (MAN-UI-001, 003, 005, 010, B Disabled cell, C Policy notes) · **FAIL 1** (C HQ permission routes) · **PARTIAL 7** (MAN-UI-002, 004, 008, 009, 011, C Edit header, gate item 2 observation) · **BLOCKED** B line controls (7 checks) · **NOT RUN (write-gated)** MAN-UI-006, 007, 012, 013, 014, Order speed, C preference ×3, C cash ×3. Operator gate: **not passed**.

### Financial_Expert_Tester suggestions (oe1)

- **FET-OE2-Nov24-OrdersEditZeroRoles (P1)** — HQ shows `orders:edit` and `orders:edit_override` on 0 roles for Demo Laundry; only admin-wildcard roles can edit. Cashier/operator roles will get permission denied. Fix: grant `orders:edit` to the counter roles and `orders:edit_override` to the named supervisor roles (gate item 2), then record them in this guide. Evidence `oe1-HQ-Perm-orders-edit-1.png`.
- **FET-OE2-Nov24-LineCellsMissing (P1, prerequisite)** — `ORDER_CHANGE_STANDARD_V1` (the live Pilot override) has no CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE, CHANGE_ITEM_PRICE ITEM cells, so section B cannot run. Fix: gate item 1 steps 1–6 (Smart fill missing, set the five cells, keep Pilot). Note: this guide's section B and "Before operators" §3 still say "published"; owner decision 2026-11-24 says Pilot — wording conflict to align. Evidence `oe1-HQ-PolicyCells-1.png`, `oe1-HQ-PolicyCells-2.png`.
- **FET-OE2-Nov24-HqPermissionRouteNotFound (P2)** — `/tenants/<id>/permissions/orders:edit` and `/edit` show "Permission with code orders%3Aedit not found". The `:` in the code arrives URL-encoded and is looked up without `decodeURIComponent`. Fix: decode `params.code` in the permission detail/edit pages (Next.js 16 async `params`) before the lookup. Evidence `oe1-HQ-Perm-orders-edit-2.png`, `oe1-HQ-PermRoute-edit-1.png`.
- **FET-OE2-Nov24-RawReviewCodes (P2, user-advocate)** — Review shows raw codes to cashiers: "Review result: REASON_REQUIRED", "Financial result: OUTSTANDING", "CAPABILITY_POLICY_OVERRIDE_REQUIRED"; and "Estimated total: 4.7080" (4 dp for OMR). Fix: map codes to EN/AR messages ("A reason is needed before Apply", "Balance to collect", "Needs a supervisor override") and format estimated total with tenant currency decimals. Evidence `oe1-MAN-UI-005-1.png`, `oe1-MAN-UI-008-1.png`.
- **FET-OE2-Nov24-ArabicLeftovers (P2)** — Arabic Edit still shows "Edit Order", "processing", "Blouse", "Public tracking link"; currency placement differs ("2.354 OMR" vs "OMR 2.200"). Fix: translate header/status/link keys, use the product's Arabic name, and one money formatter for card and side list. Evidence `oe1-MAN-UI-009-AR-1.png`.
- **FET-OE2-Nov24-Zoom200Clipped (P2)** — At 200% (narrow width) the item workspace and side panel with the bottom Review are clipped at the right edge and cannot be scrolled into view. Fix: stack the side panel below the workspace under the mobile breakpoint, allow horizontal overflow scroll. Evidence `oe1-MAN-UI-011-zoom200-1.png`.
- **FET-OE2-Nov24-EffectivePreviewUncoveredStatuses (P2)** — HQ Effective Preview lists processing/preparing/packing/ready as "Uncovered statuses" while the policy has 15 Processing rules and returns a decision for Processing. Either the coverage check reads another version/profile or the label is wrong. Fix: compute coverage against the same profile/version the preview resolved; label it. Also ~15 s spinner (P3). Evidence `oe1-HQ-EffectivePreview-1.png`.
- **FET-OE2-Nov24-EmptyBandHeader (P3)** — 13 Nov header retest: empty band still beside the money card under the title at 100–150%. Evidence `oe1-C-EditHeader-1.png`.
- **FET-OE2-Nov24-LeaveWarningNoChanges (P3)** — Browser "Leave site? Changes you made may not be saved." appears with 0 unsaved changes. Fix: register `beforeunload` only while the draft is dirty; prefer the in-app discard dialog for in-app navigation.
- **FET-OE2-Nov24-StalePolicySubtitle (P3)** — HQ policy page for `ORDER_CHANGE_STANDARD_V1` says "Unassigned Draft starter matrix. HQ must review, promote, and assign it before any tenant can use it." while it is Pilot and assigned. Fix: derive the subtitle from lifecycle + assignment.
- **FET-OE2-Nov24-PermanentDenyBanner (P3, user-advocate)** — The red "Change Item Price / Change Discount is not allowed at the current status." banner shows on every Edit open before the cashier tries anything, in error styling. Fix: show it as a neutral info note or only when the control is used.

### Retest plan

After owner approval/prerequisites: re-sign the Demo Laundry operator (credentials file needs current value), set the five cells (Pilot), grant `orders:edit`, then run MAN-UI-002 (operator), 004, 006, 007, 012–014, all section B checks, the C preference ×3 and cash rounding ×3 on `QA-OE` test orders; recheck every FET bullet above.

### Test data left behind (oe1)

None. No order, policy, assignment, role or payment was changed. UI language returned to English, zoom reset to 100%.

### Screenshot index — run oe1

Folder `C:\Users\JHNLP\qa-20261124\oe2\shots\`, zip `shots_oe1.zip`.

| Point | Result | Screenshot(s) | What the screenshot shows |
|---|---|---|---|
| MAN-UI-001 | PASS | `oe1-MAN-UI-001-1.png` | Edit Order #ORD-20261123-00002, Revision 1, processing, 0 unsaved changes; catalog, side panel, "No money change / Total 2.354 OMR"; red price/discount banner |
| C Edit header | PARTIAL | `oe1-C-EditHeader-1.png` | Title on the left, Exit / Discard changes / Review on the right above the money card; empty band left of the card |
| C Policy notes | PASS | `oe1-C-PolicyNotes-1.png` | "Edit Policy Info" dialog: Change customer details / notes / priority / ready by "Allowed with a warning", Add an item "Needs an override" |
| C Policy notes | PASS | `oe1-C-PolicyNotes-2.png` | Side panel notes "Change service speed: needs an override…" and "Add an item, Remove an item, …: needs an override…" |
| MAN-UI-003 | PASS | `oe1-MAN-UI-003-1.png` | Order Items tab (Blouse, Qty 1, 2.200 OMR), banner naming Change Item Price / Change Discount |
| MAN-UI-005 / 004 | PASS / PARTIAL | `oe1-MAN-UI-005-1.png` | Review dialog: reason required, Current 2.354 / Estimated 4.7080 / OUTSTANDING, Change item quantity before/after, Needs an override CAPABILITY_POLICY_OVERRIDE_REQUIRED, Add a piece; "Review again" only |
| MAN-UI-008 | PARTIAL | `oe1-MAN-UI-008-1.png` | Editor with 1 unsaved change, banner "Review result: REASON_REQUIRED", card New total 4.708 OMR, "Updating…" |
| MAN-UI-008 | PASS | `oe1-MAN-UI-008-2.png` | After Discard: Revision 1, 0 unsaved changes, Qty 1, Total 2.354 OMR |
| MAN-UI-010 | PASS | `oe1-MAN-UI-010-1.png` | Keyboard focus ring on Review |
| MAN-UI-010 | PASS | `oe1-MAN-UI-010-2.png` | Keyboard focus ring on Discard changes |
| MAN-UI-009 | PARTIAL | `oe1-MAN-UI-009-AR-1.png` | Arabic RTL Edit with English "Edit Order", "processing", "Blouse", "Public tracking link"; "2.354 OMR" vs "OMR 2.200" |
| MAN-UI-011 / 009 | PARTIAL | `oe1-MAN-UI-011-zoom150-AR-1.png` | Arabic Edit at 150% |
| MAN-UI-011 | PASS (150%) | `oe1-MAN-UI-011-zoom150-1.png` | English Edit at 150%: buttons and money card usable, step tabs scroll |
| MAN-UI-011 | PARTIAL | `oe1-MAN-UI-011-zoom200-1.png` | English Edit at 200%: mobile bar; workspace and side panel clipped at right |
| MAN-UI-002 | PARTIAL | `oe1-MAN-UI-002-accountant-1.png` | SAR accountant on pasted Edit URL: "Edit was not opened from the order screen" |
| HQ policies | info | `oe1-HQ-EditPolicies-1.png` | 8 Edit Policies with lifecycle and revision |
| HQ org override | info | `oe1-HQ-OrgAssign-1.png` | Demo Laundry LLC override ORDER_CHANGE_STANDARD_V1, Pilot r3, In effect |
| Gate item 1 | NOT DONE | `oe1-HQ-PolicyCells-1.png` | Standard V1, Processing rules, top (Order target) |
| Gate item 1 | NOT DONE | `oe1-HQ-PolicyCells-2.png` | Standard V1, Processing rules, Item/Piece/Preference; no speed-item/piece, discount or price cells |
| Effective Preview | info / finding | `oe1-HQ-EffectivePreview-1.png` | Require override, Organization override, ORDER_CHANGE_STANDARD_V1, reason CAPABILITY_POLICY_OVERRIDE_REQUIRED, Uncovered statuses list |
| Gate item 2 | NOT DONE | `oe1-HQ-Perm-orders-edit-1.png` | Permission list: orders:edit and orders:edit_override, 0 roles each |
| C HQ permission routes | FAIL | `oe1-HQ-Perm-orders-edit-2.png` | "/permissions/orders:edit" → "Permission with code orders%3Aedit not found" |
| C HQ permission routes | FAIL | `oe1-HQ-PermRoute-edit-1.png` | "/permissions/orders:edit/edit" → same not-found message |

Points with no screenshot: MAN-UI-002 operator (sign-in failed), MAN-UI-008 leave-warning dialog, all NOT RUN / BLOCKED rows.

---

## Financial_Expert_Tester — oe2 approved-writes run (2026-11-24)

**Tester:** Financial_Expert_Tester (Grok Bot), for Jehad. **Run id:** `oe2` (approved writes). The oe1 section above is unchanged; this section adds to it.
**Environment:** remote only. Tenant https://cmx.cleanmatex.com, Demo Laundry LLC (OMR, 3 dp, tenant `11111111-1111-1111-1111-111111111111`), signed in as the Demo Laundry admin (`admin@demo-laundry.example`). HQ https://hqsaas.cleanmatex.com as the HQ SaaS admin (`admin@cleanmatex.com`). Time 07:32–08:18 Asia/Muscat. Credentials: see CREDENTIALS_AND_ENVIRONMENTS.md (never in this file).
**Owner approvals (2026-11-24):** (1) clone the policy, set the five cells, keep it on Pilot and assign it as the org override: approved. (2) Create `QA-OE` test orders and apply edits: approved. (3) Cash-rounding tests with payments on the test orders: approved. (4) Parity check with Publish: **not approved**, so it is **BLOCKED** (see Remaining_Before_Production_Path.md).
**Test orders (created in this run):**
- **ORD-20261124-00001.** Note "QA-OE-1". Customer Jh Test dev21. Items: 2 × Blouse and 1 × Pants. Payment plan PAY_ON_COLLECTION. Status Processing. Starting total 5.778 OMR. Order id `fdd6d1d7-0cd6-4f05-b843-38f908e19812`. Edit URL `/dashboard/orders/fdd6d1d7-0cd6-4f05-b843-38f908e19812/edit`.
- **ORD-20261124-00002.** New Order cash sale, 1 × Blouse, total 2.354 OMR. Order id `abaddf7e-856e-4156-bfc2-cdf5e16ae42c`.
- **ORD-20261124-00003.** New Order split payment, total 3.424 OMR. Order id `b2908661-6dc4-4299-9283-3f5fb6418134`.

**Screenshots:** `C:\Users\JHNLP\qa-20261124\oe2\shots\` (zip `shots_oe2.zip`). Each file is named at the row it proves.

### Step A — HQ: gate item 1 (07:32–07:37) — PASS

| Step | Result | Evidence |
|---|---|---|
| Clone | **PASS** | Edit Policies → `ORDER_CHANGE_STANDARD_V1` → clone. Toast "Draft copy created." The copy opened as Draft, Revision 1, "230 of 738 rules set". It was renamed to `QA_OE2_PILOT_V1` "QA OE2 Pilot line controls". The starter was not changed (`oe2-Gate1-Clone-1.png`). |
| Smart fill | **PASS** | "Fill missing only" added 508 rules: 16 Allow with warning, 34 Require override and 458 Deny. Result: 738 of 738 rules set. |
| Five cells | **PASS** | 20 edits: CHANGE_SERVICE_SPEED ITEM/PIECE, CHANGE_DISCOUNT ITEM/PIECE and CHANGE_ITEM_PRICE ITEM set to **Allow** at each of Preparing, Processing, Packing and Ready. The status list shows "Edited" on those four, and the footer shows "20 unsaved changes" before Save (`oe2-Gate1-Cells-1.png`, Ready status, Item target). After saving and starting the pilot: toast "Lifecycle updated.", **Pilot**, Revision 5, "738 of 738 rules set". The Publish button was **not** pressed (`oe2-Gate1-Cells-2.png`). |
| Org override | **PASS** | Organization Assignments → Demo Laundry LLC: the override was replaced from `ORDER_CHANGE_STANDARD_V1` to `QA_OE2_PILOT_V1`. Toast "Override replaced." Active overrides: Organization override · All profiles · QA_OE2_PILOT_V1 · QA OE2 Pilot line controls · Pilot · 5 · In effect. No version default or profile default was set (`oe2-Gate1-OrgAssign-1.png`). |
| Effective Preview | **PASS** | Demo Laundry LLC · Standard V2 workflow WF_V2_STANDARD · v2 PILOT · Processing. Change Discount / Item gives "Decision: Allow · Resolution level: Organization override · Policy code: QA_OE2_PILOT_V1 · Deny reason: NONE · Reason code: CAPABILITY_POLICY_ALLOWED · Uncovered statuses: —" (`oe2-Gate1-EffectivePreview-1.png`). Change Item Price / Item gives the same result (`oe2-Gate1-EffectivePreview-2.png`). Uncovered statuses is now "—" (oe1 listed processing, preparing, packing and ready), so the coverage list follows a fully filled policy. |

Policy record for the gate (Remaining_Before_Operators_Rely_on_Edit.md §1): **`QA_OE2_PILOT_V1`, Pilot, revision 5, organization Demo Laundry LLC (override, all profiles). The five cells are Allow at Preparing, Processing, Packing and Ready.**
The policy subtitle still says "Unassigned Draft starter matrix. HQ must review, promote, and assign it before any tenant can use it." even though the policy is Pilot and assigned. FET-OE2-Nov24-StalePolicySubtitle (oe1) is still reproduced (`oe2-Gate1-Cells-2.png`).

### Step B — Edit on ORD-20261124-00001 (07:42–08:02)

Order history on this order: revision 1→2 order speed Standard→Express (5.778 → 7.223), revision 2→3 line speed Pants Express→Standard (7.223 → 6.955), revision 3→4 Blouse line discount 10% (6.955 → 6.367), revision 4→5 order speed back to Standard (→ 5.307), and revision 5→6 Blouse quantity 2→1 (Step E, → 3.189).

| Check | Result | Evidence |
|---|---|---|
| B Order speed | **PARTIAL** | The speed dropdown lists catalog speeds (Standard, Express), not a hard-coded flag. Review "Change service speed": "Service speed: Before: Standard → After: Express", "Change in total: Before: OMR 0.000 → After: OMR 1.445", "Total: Before: OMR 5.778 → After: OMR 7.223", "Tax: Before: OMR 0.378 → After: OMR 0.473", "Blouse · Unit price: Before: OMR 2.200 → After: OMR 2.750", "Pants · Unit price: Before: OMR 1.000 → After: OMR 1.250", "Needs an override · CAPABILITY_POLICY_OVERRIDE_REQUIRED" (`oe2-B-OrderSpeed-1.png`). After a reason: "Review result: READY", then Apply (`oe2-B-OrderSpeed-1b-ready.png`). Saved: Total 7.223 OMR, Paid 0.000, Balance Due 7.223 (`oe2-B-OrderSpeed-2.png`). **Gap:** Review shows unit prices only. It has **no per-line ready-by before/after**, which Expected requires (FET-OE2-Nov24-OrderSpeedNoPerLineReadyBy). |
| B Line speed | **PASS** | Pants line speed Express → Standard while Blouse stays "Order speed (Express)". Review "Change service speed · Pants": Change in total −OMR 0.268, Total 7.223 → 6.955, Tax 0.473 → 0.455, "Pants · Unit price: Before: OMR 1.250 → After: OMR 1.000", "Review result: READY", then Apply (`oe2-B-LineSpeed-1.png`). Only that line changed. |
| B Piece speed | **BLOCKED** | A piece-level speed change was not reached in Edit on this order in this run. Needs a pointer to where the piece speed control lives, then a retest. |
| B `LINE_SPEED_LOCKED` | NOT RUN | Needs a line that is Ready or later. Non-QA orders were not advanced. Retest on a QA order moved to Ready. |
| B Line price | **FAIL** | The pencil icon beside the line price in the Order Items side list does nothing when clicked (no dialog, no inline field, no message), even though CHANGE_ITEM_PRICE ITEM = Allow (FET-OE2-Nov24-LinePricePencilNoop). No shot of the no-op. |
| B Line discount | **PASS** | Line discount dialog on Blouse ("Line price: 5.500 OMR"), Percent of the line. Entering 150 is refused inline with "A percent discount can be at most 100%." and "Apply discount" stays disabled. The value is not rewritten (`oe2-B-Discount-Invalid-1.png`). 10% with reason "QA disc": Review "Change Discount · Blouse": "Line discount type: Before: None → After: Percent", "Line discount: Before: None → After: 10", "Line discount reason: Before: None → After: QA disc", "Total: Before: OMR 6.955 → After: OMR 6.367", "Tax: Before: OMR 0.455 → After: OMR 0.417", "Review result: READY", then Apply (`oe2-B-LineDiscount-1.png`). The order later shows Blouse "After discount" (1.980 per unit at qty 1). The Reason field says "Required. Saved with the order for the audit trail." |
| B Piece discount | **BLOCKED** | A piece-level discount was not reached in this run. Same need as piece speed. |
| B Custom line | **FAIL** | The "+ Custom item" dialog takes name, quantity and unit price but **has no service category** field (Expected: name, service category, unit price). Review "Add an item · QA custom line": "Will be added", Quantity 1, Unit price OMR 1.250, Line total OMR 1.250, "Service: WASH_AND_IRON" (raw code), Total OMR 6.645, Tax OMR 0.435, "Needs an override · CAPABILITY_POLICY_OVERRIDE_REQUIRED" (`oe2-B-CustomLine-1.png`). After a reason, Apply gives "The server could not finish this save. · Code: INTERNAL_ERROR · Request: 7ab6924c-ceb5-49a5-9daa-0299ca9ecb5f · Server message: Unable to apply this order change" (07:56, `oe2-B-CustomLine-2-ApplyError.png`). Second try, request id `b7e22657…`, same error. Nothing saved (FET-OE2-Nov24-AddItemInternalError). |
| B Add catalog item (supporting) | **FAIL** | Add Poncho (2.000 OMR) gives Review "Add an item · Poncho", "Review result: READY", Estimated total 7.4470. Apply gives "The server could not finish this save. · Code: INTERNAL_ERROR · Request: 4866297d-c96b-4208-9239-0b918795dea7 · Server message: Unable to apply this order change", with toast "The review could not be completed." (08:00, `oe2-B-AddItemCatalog-ApplyError-1.png`). Add item cannot be applied at all on this order. |
| B Price confirmation | **BLOCKED** | No quoted-vs-cart price difference came up, so the price-confirmation list was not observed. Needs a fixture where the catalog price changes after the cart loads. |
| B Disabled cell | PASS (oe1) | Not re-run. On the new Pilot override the cells are Allow, so the side panel no longer shows the price/discount deny banner. |

### A. Manual UI rows run in oe2

| Row | Result | Evidence |
|---|---|---|
| MAN-UI-004 | **PASS** (oe1 PARTIAL) | Review on order speed: "Review asks for a reason before Apply." with "Needs an override · CAPABILITY_POLICY_OVERRIDE_REQUIRED". Only "Review again" is offered (`oe2-B-OrderSpeed-1.png`). Typed reason "QA-OE oe2 test" → Review again (`oe2-MAN-UI-004-1.png`) → "Review result: READY" with **Apply** offered (`oe2-B-OrderSpeed-1b-ready.png`) → Apply saved. Raw codes are still shown (FET-OE2-Nov24-RawReviewCodes, oe1). |
| MAN-UI-006 | **BLOCKED** | Tab 2 opened the same order while tab 1 was in Edit. Pressing **Edit** in tab 2 shows the toast "Close the other edit window before opening this order again." (twice, `oe2-MAN-UI-006-1.png`, about 08:16). The tab 2 order screen still showed Total 5.307 after tab 1 had saved. Pasting `/dashboard/orders/<id>/edit` gives "Edit was not opened from the order screen. Open Edit from the order screen. A copied address does not start an edit." The single-window lock stops a second editor, so `VERSION_CONFLICT` cannot be reached through the UI (it is proved in DB tests, section D). The lock also stayed after tab 1 navigated away, until a reload (FET-OE2-Nov24-EditLockStale). There is no tab 2 editor shot, because the editor never opened. |
| MAN-UI-007 | **FAIL** (Apply PASS, clarity FAIL) | Blouse quantity 2 → 1. The first Review showed "Review asks for a reason before Apply." with CAPABILITY_POLICY_OVERRIDE_REQUIRED. After reason "QA-OE oe2 test": "Review result: READY · Current total: 5.307 · Estimated total: 3.1890 · Financial result: OUTSTANDING". Review text: "Change item quantity · Blouse. Quantity: Before: 2 → After: 1. Line total: Before: OMR 4.400 → After: OMR 2.200. Total: Before: OMR 5.307 → After: OMR 3.189. Tax: Before: OMR 0.347 → After: OMR 0.209." (08:14, `oe2-MAN-UI-007-1.png`). **The Review does not say which piece will be removed.** Change History afterwards shows that piece `ORD-20261124-00001-1-2` was removed (FET-OE2-Nov24-QtyReduceNoPieceDetail). Apply gives the toast "The change was saved." and the dialog "Balance after this change · Collect 3.1890 OMR on the existing collection screen. This screen does not take payment." (4 dp, 08:16, `oe2-MAN-UI-007-2.png`). Order afterwards: Total 3.189, Blouse 1 × 2.200 "After discount: 1.980", Pants 1 × 1.000, revision 5 → 6. The editor kept showing "Revision 5 · 1 unsaved changes" after the save, until the page was left (FET-OE2-Nov24-StaleRevisionAfterSave). |
| MAN-UI-012 | **PASS** / finding | After the order-speed Apply: "Balance after this change · Collect 7.2230 OMR on the existing collection screen. This screen does not take payment." with only "Back to the order". There is no payment control in Edit (`oe2-MAN-UI-012-1.png`). The amount is shown with **4 dp** for OMR (FET-OE2-Nov24-FourDecimalBalance). |
| MAN-UI-013 | **BLOCKED** | Needs two separate lines of the same product. The test order has no second separate Blouse line, so there was nothing to compare. Needs a fixture order with two Blouse lines that have different speeds or preferences. |
| MAN-UI-014 | **PASS** | A reason of about 400 characters ("QA long reason text …") wraps inside the Review dialog. The textarea scrolls, and Cancel / Review again stay visible and usable. "Needs an override" and Change history lines are not overlapped (08:00, `oe2-MAN-UI-014-1.png`). |
| MAN-UI-002 operator | NOT RUN | The Demo Laundry operator sign-in failed twice in oe1 and was stopped to avoid a lockout. The owner needs to update the operator entry in CREDENTIALS_AND_ENVIRONMENTS.md. |
| MAN-UI-009 Arabic on Review | NOT RUN | Arabic was not re-checked on the Review / Apply dialogs in oe2. Still needed, because those dialogs show money and a reason. |

### C. Retest the 13 November fixes (write rows)

| Check | Result | Evidence |
|---|---|---|
| Preference on a new item | **FAIL** (blocking row) | Added Poncho with packing preference "Hang on Hanger +0.100 OMR" (Poncho line 2.100 OMR). Review gives "Review result: OPERATION_NOT_AVAILABLE · Current total: 5.307 · Estimated total: 5.307", with toast "The review could not be completed." The preference is not carried and Apply is not offered (07:58, `oe2-C-PrefNewItem-1-OPERATION_NOT_AVAILABLE.png`). The 13 November blocking row is still open (FET-OE2-Nov24-PrefNewItemNotAvailable). |
| Preference on a new piece | **FAIL** (blocking row) | Added a second Pants piece (Pants - Piece 2) with "Hang on Hanger +0.100 OMR". Review gives the same "Review result: OPERATION_NOT_AVAILABLE", with Estimated total 5.307 unchanged and the toast "The review could not be completed." (08:02, `oe2-C-PrefNewPiece-1-OPERATION_NOT_AVAILABLE.png`). |
| Preference whose parent is not in this change | **PARTIAL** | Stains → Coffee on the existing Blouse Piece 1 (revision 6). Review gives "Review result: OPERATION_NOT_AVAILABLE · Current total: 3.189 · Estimated total: 3.189", with toast "The review could not be completed.", so the preference was refused (08:18, `oe2-C-PrefParentNotInChange-1.png`). The refusal is a generic code with no plain reason. The same code also refuses every preference, so this does not prove the specific "local row not attached" guard. The dialog also says "Change history: No applied changes yet." although the order already had 5 applied changes (FET-OE2-Nov24-ReviewHistoryEmpty). |
| Cash prefill when coins cannot pay the balance | **FAIL** | On ORD-20261124-00001, balance 5.307: Collect Payment → Cash. The message "5.307 OMR cannot be paid exactly in cash (no coin for it)…" appears, but **Amount is still prefilled 5.307** (Expected: empty). Cash Tendered empty shows "Cash tendered must be at least 5.307 OMR." (08:04, `oe2-C-CashPrefill-1.png`). Tender 5.310 gives "Change due 0.010 OMR · Change rounded to the nearest cash increment, from OMR 0.003 to OMR 0.010" (`oe2-C-CashPrefill-2.png`). Expected with a 5-baisa step: 0.003 → 0.000. The rounding step appears to be **0.010**, not 0.005 (FET-OE2-Nov24-CashRoundingStep). |
| Rounded change on every cash tender | **FAIL** | **Collect (Financial tab)** on ORD-20261124-00001: Collect failed twice. First: "Failed to collect payment · Invalid `prisma.org_order_items_dtl.aggregate()` invocation: Transaction API error: Transaction already closed: A batch query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5025 ms passed since the start of the transaction. Consider increasing the interactive transaction timeout or doing less work in the transaction." (08:04, `oe2-C-CashCollect-Saved-1.png`). Second: "Invalid `prisma.org_domain_events_outbox.create()` invocation: Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting." (08:05, `oe2-C-CashCollect-Saved-2-error.png`). The order is unchanged: Paid 0.000, Balance 5.307 (FET-OE2-Nov24-CollectTxnTimeout, P0). **Split payment cash leg** on ORD-20261124-00003: cash leg change rounded "from 0.576" to 0.580 and saved as "Tendered: 2.000 OMR · Change returned: 0.580 OMR", which is correct for the cash leg. But the split total is wrong (next row). Ready and Delivery collect, wallet top-up and the customer receipt change note were **not run**. |
| New Order cash change | **PASS** | ORD-20261124-00002, total 2.354. Choosing Cash does **not** prefill: Amount 0.000, with toast "OMR 2.354 cannot be paid exactly in cash (no coin for it). Enter the cash the customer hands over." (08:06, `oe2-C-NewOrderCash-Prefill-1.png`). Tender 3.000 gives "Change OMR 0.650 · Change rounded to the nearest cash increment, from OMR 0.646 to OMR 0.650 · Fully Settled", and Change Returned 0.650 matches the summary (08:07, `oe2-C-NewOrderCash-1.png`). Saved: Paid Amount 2.354, Balance 0.000, payment "2.354 OMR · Tendered: 3.000 OMR · Change returned: 0.650 OMR · CASH COMPLETED" (08:08, `oe2-C-NewOrderCash-Saved-1.png`). Receipt voucher **RV-2026-000131**, RECEIPT_VOUCHER, Posted, Total 2.354 OMR, order ORD-20261124-00002 (`oe2-C-Receipt-1.png`). The 0.005 step is consistent here (0.646 → 0.650). |
| Split payment (supporting) | **FAIL** | ORD-20261124-00003, total 3.424. Legs: "CASH::" 2.000 tendered (Change Returned 0.580, 1.424 applied) and "BANK_TRANSFER::" 2.000, Bank Reference QA-OE-3-TEST. "Legs Total 3.424 · Fully Allocated". The receipt panel showed Cash OMR 1.424, Bank Transfer OMR 2.000, Total Settled Now 3.424 (08:11, `oe2-C-SplitCash-1.png`). The confirm dialog said **Remaining 0.000**. Saved: **Paid Amount 1.424, Balance 2.000**. Cash leg 1.424 COMPLETED. Bank leg 2.000 **BANK_TRANSFER PENDING**, Bank reference QA-OE-3-TEST (08:12, `oe2-C-SplitCash-Saved-1.png`). The checkout counted a pending leg as paid (FET-OE2-Nov24-SplitPaymentRemainingMismatch). |

Other things seen during C:
- Payments tab instrument labels are raw keys: "orders.detailFull.cardBrand: —" and "orders.detailFull.cardLastFour: —". The split legs show "CASH::" and "BANK_TRANSFER::".
- A stray "0" appears above "Tax (VAT)" in Payment Details. The tax lines are wrong too: ORD-20261124-00002 shows "Tax (VAT) 0.044 OMR" while VAT is 0.110 and the municipal fee is 0.044 (`oe2-C-NewOrderCash-Saved-1.png`, `oe2-C-SplitCash-Saved-1.png`).
- The Collect dialog shows tax lines as "Tax LEGACY_05 2% 0.079 OMR" (raw code) (`oe2-C-CashPrefill-1.png`).
- New Order was slow: Ready By took about 10 s and submit about 15 s. Editor Apply took 7–40 s.

### Step E — history and remaining rows (08:13–08:18)

| Check | Result | Evidence |
|---|---|---|
| Change History tab | **PASS** / findings | ORD-20261124-00001 → Change History shows "5 changes · Showing 5 of 5". Change #5 "Applied at: Nov 24, 2026, 8:16 AM · Applied by: **Unknown user** · Operations: 1", Reason "QA-OE oe2 test", Source "order-edit", Edit revision 5 → 6, Financial result "Balance required", Commercial difference "−2.118 OMR (Decrease)". Before: Total 5.307. After: Tax 0.209, Total 3.189. The Before block has no Tax line while the After block has one. Operation "Sequence 1 · Change quantity · Target: Item · Blouse" lists raw fields: orderId `fdd6d1d7-…`, Product `2ef37ec0-…`, "totalPrice 4.4000" / "2.2000" (4 dp) (08:18, `oe2-History-1.png`). All 5 changes show "Applied by: Unknown user" (FET-OE2-Nov24-UnknownUserInHistory). Raw ids are shown (FET-OE2-Nov24-RawIdsInHistory). |

Other user-advocate notes (Step B/E): raw codes "WASH_AND_IRON", "PAY_ON_COLLECTION", "READY" and "CHANGE_SERVICE_SPEED" (Review "Change history" lines) are shown to cashiers. The New Order notes field was not visible. The order screen shows the customer **Name** as blank while the header shows "Jh Test dev21" (`oe2-B-OrderSpeed-2.png`). After New Order submit the screen stays on a reset form, with no confirmation or redirect to the order.

### Recount (oe2, and oe1 + oe2 combined)

**oe2 rows run (21):** **PASS 6** (MAN-UI-004, 012, 014; B line speed, line discount; C New Order cash change) · **FAIL 7** (MAN-UI-007; B line price, custom line; C preference new item, new piece, cash prefill, rounded change on every tender) · **PARTIAL 2** (B order speed; C parent not in change) · **BLOCKED 5** (MAN-UI-006, 013; B piece speed, piece discount, price confirmation) · **NOT RUN 1** (B `LINE_SPEED_LOCKED`). Supporting checks outside the guide rows: add catalog item FAIL, split payment FAIL, Change History PASS with findings.

**Combined latest state (33 rows = A 14 + B 10 + C 9):** **PASS 12** (MAN-UI-001, 003, 004, 005, 010, 012, 014; B line speed, line discount, disabled cell; C policy notes, New Order cash change) · **FAIL 8** (MAN-UI-007; B line price, custom line; C preference new item, new piece, cash prefill, rounded change on every tender, HQ permission routes) · **PARTIAL 7** (MAN-UI-002, 008, 009, 011; B order speed; C parent not in change, edit header) · **BLOCKED 5** (MAN-UI-006, 013; B piece speed, piece discount, price confirmation) · **NOT RUN 1** (B `LINE_SPEED_LOCKED`). Section B is counted as 10 rows here: line discount and piece discount are split, and oe1 grouped them.

**Gate status:**
- Gate item 1, five cells on a Pilot override: **DONE**. The cells are on `QA_OE2_PILOT_V1` Pilot rev 5 as the Demo Laundry override.
- Gate item 2, who can edit: **NOT DONE**. FET-OE2-Nov24-OrdersEditZeroRoles is not retested.
- Gate item 3, human tests: **not passed**. Both section C blocking rows fail: the preference on a new item or piece, and a change figure that does not match what is saved (Collect fails; the split payment saves less than the confirm showed).

Parity check: **BLOCKED** (Publish not approved). WP19 and WP20: not runnable. **Operator gate: not passed.**

### Financial_Expert_Tester suggestions (oe2)

- **FET-OE2-Nov24-CollectTxnTimeout (P0)**
  - **Where:** tenant Order → Financial Summary → Collect Payment (Cash) on ORD-20261124-00001, `/dashboard/orders/fdd6d1d7-0cd6-4f05-b843-38f908e19812`. 08:04 and 08:05 Asia/Muscat.
  - **What happens:** Collect fails with "Invalid `prisma.org_order_items_dtl.aggregate()` invocation: Transaction API error: Transaction already closed: … The timeout for this transaction was 5000 ms, however 5025 ms passed since the start of the transaction." On retry it fails with "Invalid `prisma.org_domain_events_outbox.create()` invocation: Transaction API error: Transaction not found." The raw Prisma text is shown to the cashier, both in the dialog and in a toast. No payment is saved. Cash collection on an edited order is impossible.
  - **Evidence:** `oe2-C-CashCollect-Saved-1.png`, `oe2-C-CashCollect-Saved-2-error.png`.
  - **Likely cause:** the collect service runs inside a Prisma interactive `$transaction` with the default 5 s timeout. The item aggregate and the outbox insert run inside it after slow work (locks, recalculation), so the transaction expires. The retry then reuses a closed transaction handle.
  - **Fix:** raise `timeout` / `maxWait` on that `$transaction`. Move the read-only aggregate before the transaction and write the outbox row in a short final step. Make Collect idempotent (a client request key) so a retry cannot double-post. Map Prisma errors to "Payment could not be saved. Nothing was charged. Try again." in EN and AR, with a request id.
  - **Retest:** Collect 5.310 cash on ORD-20261124-00001 (balance 3.189 after oe2), then confirm one receipt voucher, Paid = balance and no duplicate.
- **FET-OE2-Nov24-SplitPaymentRemainingMismatch (P1)**
  - **Where:** New Order → Payment → Split payment, ORD-20261124-00003, 08:11–08:12.
  - **What happens:** the split dialog says "Legs Total 3.424 · Fully Allocated" and the confirm dialog says Remaining 0.000. But the saved order is Paid 1.424 / Balance 2.000 with the bank-transfer leg PENDING. The cashier is told the order is settled when it is not.
  - **Evidence:** `oe2-C-SplitCash-1.png`, `oe2-C-SplitCash-Saved-1.png`.
  - **Likely cause:** the checkout summary treats every leg as settled, while the server books non-instant methods (bank transfer) as PENDING.
  - **Fix:** in the summary and the confirm dialog, show pending legs separately ("Bank transfer 2.000 — pending confirmation; Balance after confirmation 0.000; Balance now 2.000"), or settle instant legs only. Keep the same math on screen and on the server.
  - **Retest:** repeat the split with cash plus bank transfer and check that the confirm and the saved Paid/Balance agree.
- **FET-OE2-Nov24-CashRoundingStep (P1)**
  - **Where:** Collect Payment (Cash) on ORD-20261124-00001, 08:04.
  - **What happens:** two problems.
    - Balance 5.307 with tender 5.310 gives "Change due 0.010 OMR · Change rounded to the nearest cash increment, from OMR 0.003 to OMR 0.010". With the guide's 5-baisa step, 0.003 should round to 0.000 (or 0.005), not up to 0.010. The step in use looks like 0.010.
    - The Amount is still prefilled 5.307 even though the "cannot be paid exactly in cash (no coin for it)" message shows. New Order does this correctly (amount empty).
  - **Evidence:** `oe2-C-CashPrefill-1.png`, `oe2-C-CashPrefill-2.png`; contrast `oe2-C-NewOrderCash-Prefill-1.png`.
  - **Likely cause:** the Collect path reads a different cash increment from New Order, or a tenant/branch setting of 0.010 or a hard-coded default, and the prefill skips the "no coin" check.
  - **Fix:** use one tenant cash-rounding setting for every tender (Demo Laundry OMR smallest coin 0.005), with the rounding mode documented. Leave Amount empty on Collect when the balance is not payable in coins, as New Order already does.
  - **Retest:** Collect on a balance like 17.532 with tender 17.535 → change 0.000, and amount due kept at 17.532.
- **FET-OE2-Nov24-AddItemInternalError (P1)**
  - **Where:** Edit on ORD-20261124-00001 (revision 5), Apply of "Add an item". It fails for a custom line ("QA custom line" 1.250, 07:56, requests `7ab6924c-ceb5-49a5-9daa-0299ca9ecb5f` and `b7e22657…`) and for a catalog item (Poncho 2.000, 08:00, request `4866297d-c96b-4208-9239-0b918795dea7`).
  - **What happens:** "The server could not finish this save. · Code: INTERNAL_ERROR · Server message: Unable to apply this order change." The Review before it is READY.
  - **Evidence:** `oe2-B-CustomLine-2-ApplyError.png`, `oe2-B-AddItemCatalog-ApplyError-1.png`.
  - **Likely cause:** the Apply writer for ADD_ITEM fails after Preview. The order has line discount and speed changes, so it could be the new line's price/tax snapshot or a missing service category on insert. The custom dialog has no service category field, so the custom line may insert a null category.
  - **Fix:** check the server logs for those request ids, then fix the insert. Add a service category field to the custom line dialog (Expected: name, service category, unit price). Show "Service: Wash & Iron", not `WASH_AND_IRON`.
  - **Retest:** add the catalog item and the custom line on a QA order → Apply → Change History shows ADD_ITEM.
- **FET-OE2-Nov24-PrefNewItemNotAvailable (P1, blocking row)**
  - **Where:** Edit on ORD-20261124-00001 → Edit Items Preferences, 07:58 and 08:02.
  - **What happens:** a preference ("Hang on Hanger +0.100 OMR") on a new item (Poncho) or on a new piece (Pants piece 2) makes Review return "Review result: OPERATION_NOT_AVAILABLE", with toast "The review could not be completed." The 13 November fix is not effective on cmx, so the blocking row stays open.
  - **Evidence:** `oe2-C-PrefNewItem-1-OPERATION_NOT_AVAILABLE.png`, `oe2-C-PrefNewPiece-1-OPERATION_NOT_AVAILABLE.png`.
  - **Likely cause:** the ADD_PREFERENCE (ITEM/PIECE) operation is not mapped or enabled in the Edit engine/catalog for this workflow version, or the preference step sends a target the resolver does not know. Cell `ADD_PREFERENCE` was Require override, not Deny, so this is not a policy deny.
  - **Fix:** wire ADD_PREFERENCE for new lines and new pieces into Preview/Apply. Replace OPERATION_NOT_AVAILABLE with a plain EN/AR reason.
  - **Retest:** C rows 1–2 on a QA order.
- **FET-OE2-Nov24-OrderSpeedNoPerLineReadyBy (P2)**
  - **Where:** Edit Review for order speed, 07:45.
  - **What happens:** Review lists unit price before/after per line, but not each line's ready-by before/after, which section B Expected requires.
  - **Evidence:** `oe2-B-OrderSpeed-1.png`.
  - **Fix:** add a "Ready by: Before → After" line per item and for the order.
  - **Retest:** B Order speed.
- **FET-OE2-Nov24-LinePricePencilNoop (P2)**
  - **Where:** Edit side list → line price pencil, ORD-20261124-00001, during Step B.
  - **What happens:** clicking does nothing, although CHANGE_ITEM_PRICE ITEM = Allow on the Pilot override.
  - **Evidence:** no shot (no visible change).
  - **Fix:** open the line price override dialog (price + reason, and "clear override") or hide the icon when disabled, with a tooltip.
  - **Retest:** B Line price.
- **FET-OE2-Nov24-QtyReduceNoPieceDetail (P2, MAN-UI-007)**
  - **Where:** Review on a quantity reduction, 08:14.
  - **What happens:** Review says only "Quantity: Before: 2 → After: 1". It does not say which tracked piece is removed. History later shows piece `ORD-20261124-00001-1-2` removed.
  - **Evidence:** `oe2-MAN-UI-007-1.png`, `oe2-History-1.png`.
  - **Fix:** show "Removes piece ORD-…-1-2 (tag/barcode)" and let the cashier pick which piece.
  - **Retest:** MAN-UI-007.
- **FET-OE2-Nov24-FourDecimalBalance (P2)**
  - **Where:** "Balance after this change" after Apply ("Collect 7.2230 OMR…", 07:46; "Collect 3.1890 OMR…", 08:16). Also Review "Estimated total: 7.2230 / 6.9550 / 3.1890" and History "totalPrice 4.4000".
  - **Evidence:** `oe2-MAN-UI-012-1.png`, `oe2-MAN-UI-007-2.png`, `oe2-History-1.png`.
  - **Fix:** format with the tenant currency decimals (OMR 3, SAR 2) through the shared money formatter.
  - **Retest:** MAN-UI-012.
- **FET-OE2-Nov24-RawPaymentLabels (P2)**
  - **Where:** Order → Payments tab and New Order split dialog, 08:08–08:12.
  - **What happens:** raw labels are shown: "orders.detailFull.cardBrand:", "orders.detailFull.cardLastFour:" (missing i18n keys), split leg selectors "CASH::" / "BANK_TRANSFER::", "PAY_ON_COLLECTION" and "WASH_AND_IRON".
  - **Evidence:** `oe2-C-NewOrderCash-Saved-1.png`, `oe2-C-SplitCash-1.png`, `oe2-C-SplitCash-Saved-1.png`.
  - **Fix:** add the EN/AR keys, and render method/plan/service names from the catalog.
  - **Retest:** reopen both orders' Payments tab.
- **FET-OE2-Nov24-PaymentDetailsTaxLine (P2, added from screenshot review)**
  - **Where:** Payments tab → Payment Details on ORD-20261124-00002 and -00003.
  - **What happens:** a stray "0" line appears above "Tax (VAT)". "Tax (VAT)" shows 0.044 OMR (00002) and 0.064 OMR (00003), which are the municipal-fee amounts. VAT is 0.110 / 0.160, and Subtotal + shown tax ≠ Total (2.200 + 0.044 ≠ 2.354). The Collect dialog shows "Tax LEGACY_05 2% 0.079 OMR" (raw tax code).
  - **Evidence:** `oe2-C-NewOrderCash-Saved-1.png`, `oe2-C-SplitCash-Saved-1.png`, `oe2-C-CashPrefill-1.png`.
  - **Fix:** list each tax line (VAT standard 5%, Municipal Fee 2%) with its own label, as the New Order receipt panel does, and drop the unlabeled "0".
  - **Retest:** reopen Payment Details on 00002.
- **FET-OE2-Nov24-UnknownUserInHistory (P2)**
  - **Where:** Order → Change History, all 5 changes on ORD-20261124-00001, 08:18.
  - **What happens:** every change shows "Applied by: Unknown user", although the admin applied them. The audit trail loses who changed money.
  - **Evidence:** `oe2-History-1.png`.
  - **Fix:** resolve `applied_by` to the user's display name (the join or lookup across the tenant user table), and fall back to the email.
  - **Retest:** reopen Change History.
- **FET-OE2-Nov24-StaleRevisionAfterSave (P3)**
  - **Where:** editor header after Apply on MAN-UI-007, 08:16.
  - **What happens:** the header still says "Revision 5 · 1 unsaved changes" after "The change was saved.", until the page is left.
  - **Evidence:** `oe2-MAN-UI-007-2.png`.
  - **Fix:** refetch the order and reset the draft after a successful Apply.
- **FET-OE2-Nov24-EditLockStale (P3)**
  - **Where:** order screen tab 2, about 08:16.
  - **What happens:** "Close the other edit window before opening this order again." still showed after tab 1 had navigated away from Edit, until a reload. A stale lock can block the next cashier.
  - **Evidence:** `oe2-MAN-UI-006-1.png`.
  - **Fix:** release the lock on unmount/`pagehide`, use a heartbeat with a short TTL, and offer "Take over this edit" to a supervisor.
- **FET-OE2-Nov24-ReviewHistoryEmpty (P3)**
  - **Where:** Review dialog on revision 6, 08:18.
  - **What happens:** "Change history: No applied changes yet." while the order has 5 applied changes. Earlier Reviews listed them.
  - **Evidence:** `oe2-C-PrefParentNotInChange-1.png`.
  - **Fix:** load history independently of the Review result, or hide the block when it is not loaded.
- **FET-OE2-Nov24-RawIdsInHistory (P3)**
  - **Where:** Change History operation detail.
  - **What happens:** it shows the raw orderId UUID, the Product UUID and "totalPrice 4.4000 / 2.2000". The Before block lacks Tax while After has it. "Source order-edit" is raw.
  - **Evidence:** `oe2-History-1.png`.
  - **Fix:** show the product name, order number and formatted money. Hide ids behind "Technical details".
- **Still reproduced from oe1:** FET-OE2-Nov24-RawReviewCodes (`oe2-B-OrderSpeed-1.png`: REASON_REQUIRED, OUTSTANDING, CAPABILITY_POLICY_OVERRIDE_REQUIRED, OPERATION_NOT_AVAILABLE), FET-OE2-Nov24-StalePolicySubtitle (`oe2-Gate1-Cells-2.png`).
- **Changed from oe1:** FET-OE2-Nov24-EffectivePreviewUncoveredStatuses. With a fully filled policy, the preview shows "Uncovered statuses: —" (`oe2-Gate1-EffectivePreview-1.png`). The oe1 list may be correct for the partly filled Standard V1. Recheck on Standard V1 before closing.
- **FET-OE2-Nov24-LineCellsMissing (oe1):** resolved for the pilot by `QA_OE2_PILOT_V1`. `ORDER_CHANGE_STANDARD_V1` itself still lacks the cells.

### Retest plan (after oe2)

1. **P0 Collect:** after the timeout fix, Collect cash on ORD-20261124-00001 (balance 3.189). Check rounding with the 0.005 step, one voucher, and no duplicate on a retry.
2. **Split payment:** check that the confirm and the saved Paid/Balance agree when a leg is pending. Confirm or cancel the 2.000 PENDING bank leg on ORD-20261124-00003 (owner decision).
3. **Add item:** apply a catalog item and a custom line (with service category), then a preference on the new item and on a new piece (C blocking rows).
4. **Line price:** pencil → override + reason → clear. Also piece speed and piece discount, once the control location is known.
5. **Remaining rows:**
   - `LINE_SPEED_LOCKED` on a QA order moved to Ready.
   - MAN-UI-013 with a two-line fixture.
   - MAN-UI-009 Arabic on Review/Apply.
   - MAN-UI-002 as operator, after the owner updates CREDENTIALS_AND_ENVIRONMENTS.md.
   - Collect from Ready and Delivery, wallet top-up, and the customer receipt change note.
6. **Recheck every oe2 FET bullet above.** Gate item 2 (roles) is still open. Parity check: only on an explicit Publish go-ahead.

### Test data left behind (oe2)

- **HQ:** `QA_OE2_PILOT_V1` "QA OE2 Pilot line controls", Pilot rev 5, **is still the Demo Laundry LLC organization override**. It replaced `ORDER_CHANGE_STANDARD_V1` (Pilot r3), which is untouched and can be re-assigned. The owner should decide whether to restore it or keep the pilot policy. Nothing was published, and no version default or profile default was set.
- **ORD-20261124-00001** (QA-OE-1): total 3.189 OMR, unpaid (Paid 0.000), revision 6, 5 applied changes. Blouse 1 (10% line discount), Pants 1, all Standard. No payment was saved (both Collect tries failed).
- **ORD-20261124-00002:** paid cash 2.354 (tendered 3.000, change 0.650), receipt voucher RV-2026-000131.
- **ORD-20261124-00003:** cash 1.424 COMPLETED and bank transfer 2.000 **PENDING** (ref QA-OE-3-TEST). Balance 2.000.
- Cash drawer session SES-20261028-0001 (Branch 2 Cash Drawer 2) holds the cash from 00002 and 00003.

### Screenshot index — run oe2

Folder `C:\Users\JHNLP\qa-20261124\oe2\shots\`, zip `shots_oe2.zip` (35 files).

| Point | Result | Screenshot(s) | What the screenshot shows |
|---|---|---|---|
| Gate 1 clone | PASS | `oe2-Gate1-Clone-1.png` | HQ "Standard Order Change V1 copy", Draft, QA_OE2_PILOT_V1, Revision 1, 230 of 738 rules; toast "Draft copy created."; Add rules 508 / Fill missing only |
| Gate 1 cells | PASS | `oe2-Gate1-Cells-1.png` | Ready status, Item target: Change Discount / Change Item Price / Change Service Speed = Allow (Edited); Preparing/Processing/Packing/Ready "Edited"; "20 unsaved changes" + Save changes |
| Gate 1 cells | PASS | `oe2-Gate1-Cells-2.png` | "QA OE2 Pilot line controls", Pilot, Revision 5, 738 of 738 rules; toast "Lifecycle updated."; Processing rules; stale "Unassigned Draft starter matrix" subtitle |
| Gate 1 org override | PASS | `oe2-Gate1-OrgAssign-1.png` | Demo Laundry LLC active override QA_OE2_PILOT_V1, Pilot, 5, In effect; toast "Override replaced." |
| Gate 1 preview | PASS | `oe2-Gate1-EffectivePreview-1.png` | Processing · Change Discount · Item → Decision Allow, Organization override, QA_OE2_PILOT_V1, CAPABILITY_POLICY_ALLOWED, Uncovered statuses — |
| Gate 1 preview | PASS | `oe2-Gate1-EffectivePreview-2.png` | Processing · Change Item Price · Item → same Allow result |
| B Order speed / MAN-UI-004 | PARTIAL / PASS | `oe2-B-OrderSpeed-1.png` | Review "Review asks for a reason before Apply", Standard→Express, total 5.778→7.223, unit prices, Needs an override; empty Reason; "Review again" only |
| MAN-UI-004 | PASS | `oe2-MAN-UI-004-1.png` | Same Review with reason "QA-OE oe2 test" typed |
| B Order speed / MAN-UI-004 | PASS | `oe2-B-OrderSpeed-1b-ready.png` | "Review result: READY", Estimated total 7.2230, Apply button offered |
| MAN-UI-012 | PASS / finding | `oe2-MAN-UI-012-1.png` | "Balance after this change · Collect 7.2230 OMR on the existing collection screen. This screen does not take payment." |
| B Order speed | PARTIAL | `oe2-B-OrderSpeed-2.png` | Order ORD-20261124-00001 after Apply: Total 7.223 OMR, Paid 0.000, Balance Due 7.223, PAY_ON_COLLECTION, Name blank |
| B Line speed | PASS | `oe2-B-LineSpeed-1.png` | Review "Change service speed · Pants", total 7.223→6.955, Pants 1.250→1.000; Blouse stays Express; READY |
| B Line discount | PASS | `oe2-B-Discount-Invalid-1.png` | Line discount dialog, Percent 150 → "A percent discount can be at most 100%."; Apply discount disabled |
| B Line discount | PASS | `oe2-B-LineDiscount-1.png` | Review "Change Discount · Blouse", Percent 10, reason "QA disc", total 6.955→6.367, READY |
| B Custom line | FAIL | `oe2-B-CustomLine-1.png` | Review "Add an item · QA custom line", unit price 1.250, "Service: WASH_AND_IRON", Needs an override |
| B Custom line | FAIL | `oe2-B-CustomLine-2-ApplyError.png` | "The server could not finish this save. Code: INTERNAL_ERROR, Request: 7ab6924c-…" |
| C Pref new item | FAIL | `oe2-C-PrefNewItem-1-OPERATION_NOT_AVAILABLE.png` | Poncho with Hang on Hanger +0.100; Review "OPERATION_NOT_AVAILABLE"; toast "The review could not be completed." |
| B Add catalog item | FAIL | `oe2-B-AddItemCatalog-ApplyError-1.png` | Review "Add an item · Poncho" READY; "INTERNAL_ERROR, Request: 4866297d-…, Unable to apply this order change" |
| MAN-UI-014 | PASS | `oe2-MAN-UI-014-1.png` | ~400-char reason wraps in Review; Cancel / Review again visible; change history 4 lines |
| C Pref new piece | FAIL | `oe2-C-PrefNewPiece-1-OPERATION_NOT_AVAILABLE.png` | Pants Piece 2 with Hang on Hanger +0.100; Review "OPERATION_NOT_AVAILABLE" |
| C Cash prefill | FAIL | `oe2-C-CashPrefill-1.png` | Collect Payment, Cash: Amount prefilled 5.307, "Cash tendered must be at least 5.307 OMR."; tax lines "LEGACY_05 2%" |
| C Cash prefill | FAIL | `oe2-C-CashPrefill-2.png` | Tender 5.310 → "Change due 0.010 OMR · rounded … from OMR 0.003 to OMR 0.010" |
| C Rounded change (Collect) | FAIL | `oe2-C-CashCollect-Saved-1.png` | "Failed to collect payment · Invalid prisma.org_order_items_dtl.aggregate() … timeout 5000 ms, however 5025 ms passed" |
| C Rounded change (Collect) | FAIL | `oe2-C-CashCollect-Saved-2-error.png` | Retry: "Invalid prisma.org_domain_events_outbox.create() … Transaction not found" |
| C New Order cash | PASS | `oe2-C-NewOrderCash-Prefill-1.png` | New Order payment, Cash: Amount 0.000 (not prefilled); toast "OMR 2.354 cannot be paid exactly in cash (no coin for it)…" |
| C New Order cash | PASS | `oe2-C-NewOrderCash-1.png` | Tender 3.000 → Change OMR 0.650 "rounded … from OMR 0.646 to OMR 0.650", Fully Settled, Submit — OMR 2.354 |
| C New Order cash | PASS | `oe2-C-NewOrderCash-Saved-1.png` | ORD-20261124-00002 Payments: Paid 2.354, Balance 0.000, CASH COMPLETED tendered 3.000 change 0.650; raw cardBrand/cardLastFour keys; stray "0", Tax (VAT) 0.044 |
| C New Order cash | PASS | `oe2-C-Receipt-1.png` | Business Voucher RV-2026-000131, RECEIPT_VOUCHER, Posted, OMR, Total 2.354, order ORD-20261124-00002 |
| Split payment | FAIL | `oe2-C-SplitCash-1.png` | Split dialog: CASH:: 2.000 (change 0.580) + BANK_TRANSFER:: 2.000 ref QA-OE-3-TEST, Legs Total 3.424 Fully Allocated |
| Split payment | FAIL | `oe2-C-SplitCash-Saved-1.png` | ORD-20261124-00003 Payments: Paid 1.424, Balance 2.000; CASH 1.424 COMPLETED; BANK_TRANSFER 2.000 PENDING |
| MAN-UI-007 | FAIL (clarity) | `oe2-MAN-UI-007-1.png` | Review "Change item quantity · Blouse" 2→1, total 5.307→3.189, no piece named; READY, Apply |
| MAN-UI-007 | PASS (Apply) | `oe2-MAN-UI-007-2.png` | Toast "The change was saved."; "Collect 3.1890 OMR…"; header still "Revision 5 · 1 unsaved changes" |
| MAN-UI-006 | BLOCKED | `oe2-MAN-UI-006-1.png` | Tab 2 order screen with two toasts "Close the other edit window before opening this order again."; total still 5.307 (not an applied tab) |
| C Parent not in change | PARTIAL | `oe2-C-PrefParentNotInChange-1.png` | Stains → Coffee on Blouse Piece 1, revision 6; Review "OPERATION_NOT_AVAILABLE"; "Change history: No applied changes yet." |
| Change History | PASS / findings | `oe2-History-1.png` | Change History 5 changes; #5 8:16 AM, Applied by Unknown user, revision 5→6, −2.118 OMR, raw orderId/Product ids, totalPrice 4.4000→2.2000 |

Points with no screenshot: B line price pencil no-op, custom line second INTERNAL_ERROR (`b7e22657…`), MAN-UI-006 direct-URL message and the editor in tab 2 (never opened, so there is no second MAN-UI-006 shot), split-payment confirm dialog "Remaining 0.000", New Order submit staying on the reset form, the Smart fill count (508), and all NOT RUN / BLOCKED rows.
