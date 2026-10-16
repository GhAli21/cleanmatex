# CleanMateX Edit Order V2 / Order Change v3.0 — Manual UI Test Guide

**Version:** 3.0  
**Date adopted:** 2026-10-14 (Asia/Muscat)  
**Status:** ACTIVE — manual-only UI validation companion  
**Parent test guide:** `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md`  
**Governance:** `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md`

## 1. Purpose

This file contains **only tests that genuinely require human/manual UI judgement** after objective behavior has been automated where practical.

It is intentionally not a duplicate of the automated test suite.

Manual testing is reserved for visual clarity, usability, final EN/AR/RTL quality, keyboard/focus experience, responsive/touch ergonomics, clipping/overlap, and other human-observable behavior that automation cannot adequately prove.

A test must not remain manual merely because automation has not been written yet.

## 2. Mandatory scenario-writing standard

No manual scenario is acceptable if the tester has to guess which page, route, screen, panel, button, dialog, menu, field or action is intended.

Every scenario must include:

- Scenario ID and name;
- purpose;
- owning WP / availability state;
- exact preconditions/test data;
- exact navigation path;
- direct page route when known;
- exact page/screen name;
- exact UI area/section;
- exact UI control(s);
- numbered interaction steps;
- expected result for each important step;
- visual/human checks;
- EN/AR/RTL instructions when applicable;
- responsive/device instructions when applicable;
- expected final state;
- evidence to capture;
- automation status and why manual validation is still needed.

If an exact route/control does not yet exist because the owning WP is not implemented, mark the scenario `NOT_EXECUTABLE_YET`. Before execution, replace any planned control label with the implemented label/path from the active UI contract/code; never guess.

## 3. Standard manual scenario template

```text
Scenario ID:
Name:
Owning WP:
Execution status: MANUAL_REQUIRED / PARTIALLY_AUTOMATED / NOT_EXECUTABLE_YET

Purpose:

Preconditions:
- environment:
- tenant:
- user/role/permissions:
- feature flag/cohort:
- workflow/policy state:
- order/test data:
- locale:
- browser/device:

Exact navigation path:
Dashboard -> ... -> ...

Direct route:
`/exact/route/{id}`

Screen/page:

UI area/section:

UI control(s):

Steps:
1. ...
   Expected: ...
2. ...
   Expected: ...

Human/visual checks:
- ...

EN/AR/RTL checks:
- ...

Responsive/device checks:
- ...

Expected final state:
- ...

Evidence to capture:
- screenshot(s) where useful;
- locale;
- viewport/device/browser;
- order/test-data reference;
- PASS/FAIL;
- defect/reference if failed.

Automation coverage:

Why manual judgement is still required:
```

## 4. Shared navigation baseline for Edit Order scenarios

Where the implemented UI follows the active v3.0 route contract, use:

```text
Login
-> Dashboard
-> Orders
-> Open the prepared test order
-> Order Details
-> Actions
-> Edit Order
```

Direct Edit route:

```text
/dashboard/orders/{orderId}/edit
```

The current plan identifies this route as the existing Edit page. If the visible navigation/control label changes during WP14/WP15, update this guide to match the implemented UI before executing tests.

## 5. Manual scenarios

### MAN-UI-001 — Edit Order context bar and workspace clarity

**Owning WP:** WP14  
**Execution status:** `PARTIALLY_AUTOMATED`. The shared workspace is implemented. A human visual pass is still required because no committed order was opened in the browser.

**Purpose:** Verify a staff user can edit through the same New Order workspace, with Edit-only context, and can tell Review from a new-order submit.

**Preconditions:**
- V2 Edit feature enabled for the test cohort;
- committed editable order;
- user has `orders:edit`;
- Edit entry decision allows access;
- execute once in English and once in Arabic.

**Exact navigation path:**

```text
Login -> Dashboard -> Orders -> Open test order -> Order Details -> Actions -> Edit Order
```

**Direct route:** `/dashboard/orders/{orderId}/edit`

**Screen/page:** Shared New Order workspace on `/dashboard/orders/{orderId}/edit`  
**UI area:** Edit context bar above the shared catalog, item, piece, preference, customer, and summary presentation  
**Controls/content:** order identifier, workflow status, Revision N, unsaved count, Discard, Review. Customer name, mobile, email, branch, and currency are locked. The primary action is Review.

**Steps:**
1. Open the prepared order from Dashboard -> Orders.  
   **Expected:** Order Details clearly identifies the order used for the test.
2. Use Actions -> Edit Order, or open `/dashboard/orders/{orderId}/edit` directly.  
   **Expected:** The existing New Order workspace opens with the Edit context bar. It is not a second form.
3. Inspect the context bar before changing anything.  
   **Expected:** order number, workflow status, and revision are visible; the unsaved count is zero. Catalog, items, pieces, preferences, customer, and summary are the shared New Order components. Two lines for the same product stay separate. Piece and preference rows show their saved identities.
4. Confirm customer name, mobile, email, and branch cannot be changed.  
   **Expected:** those identity fields stay locked. There is no currency selector and no second Save button.
5. Change internal notes when the order is open for edit.  
   **Expected:** the unsaved count changes. The primary action is Review. Choosing Review does not commit the order.

**Human/visual checks:**
- same workspace presentation as New Order, with the Edit context bar;
- no duplicate/conflicting primary actions and no legacy Save;
- revision/status text is readable;
- no clipped labels or overlapping controls;
- Discard and Review are discoverable;
- Arabic layout uses the start edge and does not mirror the meaning of Review or Discard.

**EN/AR/RTL:** Repeat in Arabic; confirm correct RTL alignment and icon/action placement without mirrored semantics errors.

**Expected final state:** discard the local change; no Change/revision mutation should occur. Objective no-mutation behavior must be automated separately.

**Evidence:** screenshots of clean and dirty states in EN/AR.

**Automation coverage:** route/context load and dirty-state behavior should be Playwright-covered.  
**Why manual remains:** final hierarchy/readability/RTL clarity requires human judgement.

---

### MAN-UI-002 — Edit entry DENY message clarity

**Owning WP:** WP14  
**Execution status:** `NOT_EXECUTABLE_YET` until WP14.

**Purpose:** Verify a denied user understands why Edit cannot open and what to do next without seeing a generic technical error.

**Preconditions:** committed order; entry capability decision `DENY`; authenticated user; prepared stable reason/message.

**Navigation:** `Dashboard -> Orders -> Open order -> Order Details -> Actions -> Edit Order`  
**Direct target route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Order Details / Edit-entry feedback surface  
**Control:** Actions -> Edit Order

**Steps:**
1. Open Order Details.
2. Select Edit Order.
3. Observe the denial feedback.

**Expected:** editor does not open; feedback is clear, non-technical, and identifies the business reason according to the approved message contract.

**Human checks:** prominence, wording clarity, no misleading retry/save control, no raw error code shown as the only explanation.

**EN/AR/RTL:** repeat in Arabic and verify complete readable RTL message.

**Automation coverage:** access denial and no editor/no mutation must be automated.  
**Why manual remains:** comprehension and visual clarity.

---

### MAN-UI-003 — Operation-level DENY inside an open editor

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until operation-capability UI exists.

**Purpose:** Verify one denied operation does not make the whole editor unusable and the reason is discoverable.

**Preconditions:** Edit entry `ALLOW`; `REMOVE_ITEM` returns `DENY`; at least one persisted item.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Edit Order Workspace  
**UI area:** Order Items panel  
**Control:** target persisted item row -> action/menu -> Remove Item

**Steps:**
1. Open Edit Order.
2. Locate the persisted target item in Order Items.
3. Open the item's actions/menu.
4. Inspect Remove Item and its denial explanation.
5. Interact with another allowed edit control.

**Expected:** Remove Item is clearly denied/disabled according to approved UX; a useful reason is accessible; allowed controls still work.

**Human checks:** disabled state is obvious, reason is discoverable, tooltip/dialog does not clip, allowed vs denied states are visually distinguishable.

**Automation coverage:** server denial, crafted request denial and inability to commit denied op must be automated.  
**Why manual remains:** discoverability and usability of denied-state presentation.

---

### MAN-UI-004 — WARN and OVERRIDE review usability

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until review UI exists.

**Purpose:** Verify WARN and OVERRIDE are visually distinct from DENY and from ordinary ALLOW, and that reason/acknowledgement requirements are understandable.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order -> make governed change -> Review Changes`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Review Changes dialog/sheet  
**UI controls:** warning section, acknowledgement control, reason field, override requirement/permission feedback, Apply button.

**Steps:**
1. Prepare a change that evaluates to WARN and open Review Changes.
2. Inspect warning presentation and acknowledgement requirement.
3. Repeat with an OVERRIDE scenario using a user with and without required override permission.

**Expected:** WARN, OVERRIDE and DENY are not visually confused; required reason/acknowledgement is clear; Apply availability matches server rules.

**Human checks:** wording, visual severity hierarchy, reason-field discoverability, focus order, no fear-inducing generic error styling for normal warnings.

**Automation coverage:** decision/proof/permission enforcement must be automated.  
**Why manual remains:** human comprehension and visual distinction.

---

### MAN-UI-005 — Review Changes dialog tells the complete story

**Owning WP:** WP15  
**Execution status:** `PARTIALLY_AUTOMATED`. The Review dialog, proof-bound Apply, and history labels have Jest coverage. A human visual pass was not run because the local database has no committed order to open.

**Purpose:** Verify the final pre-Apply review clearly communicates exactly what will change.

**Navigation:** Login → Dashboard → Orders → Open the test order → Order Details → Actions → Edit Order → change notes or another supported header field → Review  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Review dialog on the shared New Order workspace  
**UI areas:** operation list, current and estimated totals, preview status, acknowledgement checkbox, reason field, history labels, Apply when status is READY, Review again, Reload when the review is stale.

**Steps:**
1. Make at least two supported changes affecting different target types where possible.
2. Open Review Changes.
3. Read the operation groups without referring to backend/debug data.
4. Inspect before/after values and financial summary.

**Expected:** a staff user can identify each operation, the current and estimated totals, and any acknowledgement or reason before Apply. Apply is shown only when the preview status is READY. Before/after money snapshots are not shown.

**Human checks:** grouping, scanability, money readability, no ambiguous product-only identity for duplicate same-product lines, no hidden warnings below unreachable scroll area.

**EN/AR/RTL:** repeat in Arabic; verify groups, amounts and action buttons remain readable and logically placed.

**Automation coverage:** exact values/operation counts/Apply payload should be automated.  
**Why manual remains:** readability and information hierarchy.

---

### MAN-UI-006 — Stale revision/policy/calculation conflict recovery clarity

**Owning WP:** WP15  
**Execution status:** `PARTIALLY_AUTOMATED`. Controller tests cover a cleared proof and one retry key. A human visual pass of the conflict message was not run.

**Purpose:** Verify the user understands that reviewed data became stale and that the system did not silently merge/apply new values.

**Navigation:** Login → Dashboard → Orders → Open the test order → Order Details → Actions → Edit Order → Review → Apply after the order revision changed  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Review dialog conflict message  
**Controls:** Reload. Review again stays available. Discard is on the Edit context bar.

**Steps:**
1. Open Edit and prepare a change.
2. Obtain a Preview/Review result.
3. Cause the controlled stale condition using the automated/test setup for another Change, workflow version or policy/calculation drift.
4. Attempt Apply.
5. Inspect recovery guidance.

**Expected:** clear stale/re-review message; no success impression; no automatic merge; user can understand next safe action.

**Human checks:** language avoids technical jargon, preservation/discard expectations are clear, primary next action is obvious.

**Automation coverage:** stale detection and zero unintended mutation must be automated.  
**Why manual remains:** recovery-message comprehension.

---

### MAN-UI-007 — Piece-selection quantity decrease usability

**Owning WP:** WP14  
**Execution status:** `NOT_EXECUTABLE_YET` until tracked-piece Edit UI exists.

**Purpose:** Verify users can understand which exact pieces will be removed when reducing quantity.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order -> Order Items -> tracked item -> quantity decrease / piece editor`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Edit Order Workspace  
**UI area:** tracked item / piece-selection panel or dialog  
**Controls:** quantity control, eligible piece selector, protected/disabled pieces, confirm/cancel.

**Steps:**
1. Choose an item with multiple persisted pieces and at least one ineligible/protected piece if supported by test data.
2. Reduce quantity.
3. Inspect the required piece-selection UI.
4. Select eligible pieces and observe protected pieces.

**Expected:** exact-piece selection is understandable; protected pieces clearly explain why they cannot be removed; no blind automatic trimming is implied.

**Automation coverage:** exact IDs, eligibility enforcement and final quantity must be automated.  
**Why manual remains:** interaction ergonomics and clarity.

---

### MAN-UI-008 — Unsaved changes navigation warning

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until dirty/navigation behavior exists.

**Purpose:** Verify accidental navigation does not silently discard prepared edits and the warning is understandable.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order -> make local change -> navigate away/back`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Edit Order Workspace / navigation confirmation  
**Controls:** browser/back/nav link, confirmation dialog/sheet, Stay/Discard actions.

**Steps:**
1. Make one local unreviewed change.
2. Attempt normal in-app navigation away.
3. Attempt browser Back/close behavior according to supported browser conventions.
4. Inspect warning and choices.

**Expected:** user can distinguish Stay versus Discard; no suggestion that data was already saved.

**Automation coverage:** dirty-state/nav guard should be Playwright-covered where feasible.  
**Why manual remains:** wording and decision clarity.

---

### MAN-UI-009 — Arabic / RTL full Edit and Review visual quality

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until UI exists.

**Purpose:** Human visual validation of Arabic/RTL beyond automated key/direction assertions.

**Navigation:** switch application language to Arabic -> `Dashboard -> Orders -> Order Details -> Edit Order -> Review Changes`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screens:** Edit Order Workspace and Review Changes  
**Areas:** context bar, item rows, preferences, dialogs, totals, warning/deny messages, action buttons.

**Checks:**
- natural RTL flow;
- no clipped/overlapping Arabic text;
- icons remain semantically correct;
- numeric/money display readable;
- mixed Arabic/English codes do not break layout;
- dialog alignment and focus order feel correct;
- long reason/warning text remains readable.

**Automation coverage:** missing-key and core functional flow must be automated.  
**Why manual remains:** final visual quality.

---

### MAN-UI-010 — Keyboard and focus usability

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until UI exists.

**Purpose:** Verify real keyboard use is practical for counter/POS staff and modal focus behavior is understandable.

**Navigation:** `Dashboard -> Orders -> Order Details -> Edit Order`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screens:** Edit workspace, item actions, preference controls, Review dialog.

**Steps/checks:**
1. Navigate primary controls with keyboard only.
2. Open/close action menus and dialogs.
3. Verify visible focus indicator.
4. Verify focus is trapped/restored appropriately in dialogs.
5. Verify Enter/Space/Escape behavior does not accidentally Apply/Discard.

**Expected:** no keyboard trap; logical focus order; dangerous actions are not triggered accidentally.

**Automation coverage:** some focus assertions can be Playwright automated.  
**Why manual remains:** practical keyboard usability judgement.

---

### MAN-UI-011 — Responsive / POS / small viewport visual usability

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until UI exists.

**Purpose:** Verify the shared workspace and review UI remain usable at representative widths.

**Navigation:** same Edit path.  
**Route:** `/dashboard/orders/{orderId}/edit`

**Required representative viewports:**
- normal desktop: approximately 1440 px width;
- tablet/POS-like: approximately 1024 px width;
- smaller supported viewport defined by the frontend contract/test environment.

**Checks:**
- no horizontal clipping that hides primary actions;
- review dialog/sheet remains reachable;
- item/piece controls do not overlap;
- sticky/fixed areas do not cover content;
- scroll behavior is understandable;
- touch targets are usable where touch/POS is supported.

**Automation coverage:** Playwright viewport tests should cover objective overflow/selectors.  
**Why manual remains:** final ergonomics and visual usability.

---

### MAN-UI-012 — Financial outcome presentation does not imply automatic settlement

**Owning WP:** WP15/WP16  
**Execution status:** `NOT_EXECUTABLE_YET` until Review/financial-follow-up UI exists.

**Purpose:** Verify users understand that Order Change commits commercial edits separately from later payment/refund/overpayment resolution.

**Precondition example:** original total 20, paid 20, reviewed new total 15.

**Navigation:** `Dashboard -> Orders -> Order Details -> Edit Order -> change total -> Review Changes -> Apply -> financial follow-up surface`  
**Route:** `/dashboard/orders/{orderId}/edit` for Edit/Review; use the implemented follow-up surface/route from WP16 and update this guide with its exact path before execution.  
**Screens:** Review Changes; post-Apply financial outcome/resolution UI.

**Expected visible facts:**
- old total 20;
- new total 15;
- difference -5;
- paid remains 20;
- overpayment 5;
- no wording/animation implies an automatic refund occurred;
- financial resolution is visibly separate after Change commit.

**Human checks:** money labels are unambiguous; next action is understandable; manual/unsupported gateway behavior is not over-promised.

**Automation coverage:** persisted financial facts, no refund side effect, and follow-up API behavior must be automated.  
**Why manual remains:** business-message comprehension.

---

### MAN-UI-013 — Duplicate same-product lines are visually distinguishable during review

**Owning WP:** WP13–WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until V2 identity-aware UI exists.

**Purpose:** Verify staff can tell which one of two identical-product committed lines was edited.

**Navigation:** `Dashboard -> Orders -> Order Details -> Edit Order -> modify one of two same-product lines -> Review Changes`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**UI areas:** Order Items panel and Review Changes grouping.

**Expected:** edited line is distinguishable using approved contextual information without exposing raw UUID as the only human clue; untouched line is not visually implied to have changed.

**Automation coverage:** exact UUID targeting must be automated.  
**Why manual remains:** line-identification usability.

---

### MAN-UI-014 — Long warning/reason/error text does not break UI

**Owning WP:** WP14/WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until UI exists.

**Purpose:** Verify realistic long EN/AR policy/reason text remains usable.

**Navigation:** Edit Order -> trigger a warning/deny/override reason with approved long test text.  
**Route:** `/dashboard/orders/{orderId}/edit`  
**UI areas:** inline reason, tooltip/popover/dialog, Review Changes warning section.

**Checks:** wrapping, scrolling, no overlap, no inaccessible hidden action, Arabic shaping/RTL, readable contrast and spacing.

**Automation coverage:** content presence can be automated.  
**Why manual remains:** visual rendering quality.

## 6. Manual execution rules

1. Do not execute a manual scenario until its owning UI exists and exact controls/labels/routes have been verified against the current code/UI contract.
2. Do not manually “prove” server-side authorization, RLS, transaction rollback, idempotency or financial formulas; those require automation/DB evidence.
3. If a manual scenario reveals an objective reproducible bug, add/extend automated regression coverage whenever feasible.
4. A manual PASS must record the tested locale/browser/device/viewport and test-data reference.
5. Capture screenshots only when they materially prove visual state; avoid unnecessary customer PII.
6. If a scenario becomes reliably automatable later, move objective coverage to automation and keep only the human-judgement portion here.

## 7. Manual execution evidence template

```text
Scenario ID:
Execution date:
Build/commit:
Environment:
Tester:
Tenant/test account:
Order/test-data reference:
Browser/version:
Device/viewport:
Locale:

Preconditions verified: YES / NO
Exact navigation path used:
Actual implemented control labels:

Result: PASS / FAIL / BLOCKED

Human observations:

Screenshots/evidence:

Defect/reference if failed:

Automated companion scenario/test:
```

## 8. Completion rule

Manual UI testing is complete only when every applicable `MANUAL_REQUIRED` or manual portion of `PARTIALLY_AUTOMATED` scenarios for the release cohort is executed and recorded, or explicitly marked not applicable with a valid reason.

A WP/release must not be held manual-only for objective behavior that should be automated.

> **P0 for developer (latest = Retest r2, Saudi Demo SAR):** set `ORDER_CHANGE_REVIEW_PROOF_SECRET` + `ORDER_CHANGE_REVIEW_PROOF_KEY_ID` (unblocks **005/006/012**); fix sidebar Link unsaved-nav guard (**008 FAIL**); fix Remove item `productId` mismatch (**003**). Full P0 block at start of Retest r2 section below.

## Financial_Expert_Tester Results — Round 1 (2026-10-16)

### Environment / build
| Field | Value |
|---|---|
| App | Preview tenant web-admin `https://cmx.cleanmatex.com` |
| Tenant | Demo Laundry LLC · `11111111-1111-1111-1111-111111111111` |
| User / role | Admin Demo Laundry (tenant admin / `orders:edit` cohort) — password not recorded here (see CREDENTIALS_AND_ENVIRONMENTS.md) |
| Locale | EN then AR (restored to EN after AR pass) |
| Browser / viewport | Box agent Chromium UI session; desktop layout (~1280+ wide from screenshots) |
| Time zone | Asia/Muscat (UTC+4) · run window ~2026-10-16 01:40–02:00 |
| Product chrome | CleanMateX v1.0 · shell title EN "Edit Order" |
| Repo (read-only git) | `F:\jhapp\cleanmatex` HEAD `b7933b0e11a9330f388ed6cf7a374866629d929e` (2026-10-15 23:29 +04, Order Edit V2 + Notification Hub). Docs path last touched `cdbf36ec33ebd4d214fb4b331d5f69744ebe38b1` (2026-10-15 20:47 +04). |
| UI notes | `/workspace/oe2/MAN-UI-001_run_notes_2026-10-16.md` |
| Screenshots | `/workspace/oe2/shots/02_edit_clean_EN.png`, `03_edit_clean_AR.png`, `04_edit_policy_info_dialog_EN.png`, `05_edit_order_items_tab_EN.png` |

### Test-data inventory (Demo Laundry — only 3 orders, all Processing)
| Order no | Order id | Status | Lines / pieces (UI) | Total (DB) |
|---|---|---|---|---|
| ORD-20261014-0001 | `10012a76-ca6d-4fd5-ac2c-014a7723d311` | processing | 1 line: Boxer Shorts (Single) · Wash & Iron · Qty 2 · 3.000 OMR unit · 6.000 OMR line · Pieces (2); Packing=None | **6.4200** OMR |
| ORD-20261009-0001 | `b3dab91c-b5a6-42cd-8ab6-2f2459292bbb` | processing | 1 piece (not opened for edit this run) | **3.2100** OMR |
| ORD-20261003-0001 | `3a2a07d6-1613-4754-83c6-c59098acba65` | processing | 1 piece (not opened for edit this run) | **3.2100** OMR |

Primary test order for MAN-UI-001: **ORD-20261014-0001**. Customer shown on Edit: **Jh Test dev21**. Branch chrome: Main Branch 2. Ready-by picker visible: 16/10/2026 11:56 PM (display only; not changed).

### MAN-UI-001 — per-step evidence (guide steps 1–7 / visual)

**Direct route used:** `/dashboard/orders/10012a76-ca6d-4fd5-ac2c-014a7723d311/edit` · document title `"Edit Order - CleanMateX"`.

| Step | What was done | Result / exact UI |
|---|---|---|
| 1 Open prepared order | Dashboard → Orders → ORD-20261014-0001 → Order Details `/full` | Order Details identifies ORD-20261014-0001, Processing, Normal, Total **6.420 OMR**. |
| 2 Enter Edit | Guide path Actions → Edit Order **not present**. Actions tab (`tab=actions`) shows only **Quick Actions: Fix order data**. Actual entry: header control label **"Edit"** → `/edit`. Direct route also works. | Shared New Order workspace opens with Edit context bar (not a second form). |
| 3 Inspect clean context bar | EN before any change | **EN context bar:** `Edit Order #ORD-20261014-0001` · `Revision 1 · Workflow status: processing · 0 unsaved changes`. Controls: **"Edit Policy Info"**, **"Discard changes"** (disabled), **"Review"** (enabled). Stepper: Select Items / Order Items (1) / Edit Items Preferences (2) / Edit Item Notes (2) / Customer Details. Categories: Wash & Iron (active), Dry Cleaning, Laundry, Ironing Only, Repairing, Alterations, Retail Items. Summary: Pieces 2, Bags 0, Express off. |
| 3b Edit Policy Info | Opened dialog | Exact fields: Edit policy name **Not assigned**; lifecycle **Not assigned**; WF profile version status **PILOT**; version **4**; Edit policy revision **Not assigned**; Order workflow status **processing**; profile code **WF_V2_SIMPLE**; profile version id `a1000000-0000-4000-8000-000000000014`. Dialog copy: *"No edit policy is assigned for this status, so changes stay blocked until an administrator assigns one."* Controls: Copy all, Close. Shot: `04_edit_policy_info_dialog_EN.png`. |
| 3c Closed banners | Observed across workspace + summary | Exact EN banner (repeated ~8×): **"No edit policy is assigned for this status, so this change stays closed."** (`messages/en/orders/edit.json` key `capability.missing`). Shots: `02_edit_clean_EN.png`, `05_edit_order_items_tab_EN.png`. |
| 3d Order Items tab | Opened Order Items (1) | Boxer Shorts (Single) \| Wash & Iron \| Qty 2 \| 3.000 OMR \| 6.000 OMR \| Pieces (2) subrow \| Preferences Packing select (None) \| Actions trash. Card qty titles **"Decrease quantity"** / **"Increase quantity"**. Row button `title` attrs: **"Edit notes / pieces"**, **"Override price"**, **"Remove item"** — enabled in DOM (not clicked). Shot: `05_edit_order_items_tab_EN.png`. |
| 4 Identity locks | Customer Details | Notices: **"Changes apply to this order only, not to customer profile."** and **"Customer, branch, and currency stay locked on this screen."** Name / Phone / Email inputs have `readonly`. No currency selector. No second Save (primary remains Review). |
| 5 Dirty via notes | Typed `" QA-test"` into Customer notes | Textarea has no `readonly` attr but value stayed empty (typing rejected). **No Internal notes field** on Edit Customer Details (guide expects internal notes). Unsaved count stayed **0**. Discard stayed disabled. → dirty path **not executable**. |
| 6 Review @ 0 changes | Clicked Review | **No Review dialog opened**; no reliable on-screen toast observed. Code path: `edit-shared-workspace.tsx:151-153` should `cmxMessage.info('No changes to save')` when `operationCount()===0` and `editAccess` is OPEN — toast may have been missed or suppressed. |
| 7 Discard / leave | Discard disabled (dirtyCount 0). Attempted leave | **beforeunload** not meaningfully exercised (no dirty state). Language restored to **English** (verified). |
| AR pass | Same order, locale Arabic | Context: **"تعديل الطلب #ORD-20261014-0001"** · **"المراجعة 1 · حالة سير العمل: processing · 0 تغييرات غير محفوظة"** · buttons **"تجاهل التغييرات"** + **"مراجعة"**. Closed banner AR: **«.لا توجد سياسة تعديل معينة لهذه الحالة، لذلك يبقى هذا التغيير مغلقاً»**. Shell/browser title stays English **"Edit Order"**. Status code **"processing"** untranslated. Header org clipped (**"…Demo Laundry"** / Demo Laundry LLC). Shot: `03_edit_clean_AR.png`. |
| Post-run verify | Totals / notes | Order total still **6.420 OMR**; notes empty; **nothing committed**. |

**MAN-UI-001 verdict: PARTIAL** — clean-state EN/AR context, locks, policy-missing UX, nav mismatch, and screenshots captured; dirty/Review/Discard/nav-guard steps blocked by missing edit policy.

### Results table (MAN-UI-001…014)

| # | Result | Evidence |
|---|---|---|
| MAN-UI-001 | PARTIAL | See per-step table above. Primary blocker: edit policy MISSING for `processing` on WF_V2_SIMPLE v4. |
| MAN-UI-002 | NOT RUN | Guide `NOT_EXECUTABLE_YET` until WP14 deny-at-entry UX. Order **opens** Edit; closed state is MISSING-policy banners, not an entry DENY gate. Code: entry allow + `editAccess` OPEN vs policy MISSING are separate (`edit-shared-workspace.tsx:211` vs `edit-control-capability.ts:64-65`). |
| MAN-UI-003 | NOT RUN | Guide `NOT_EXECUTABLE_YET`. Code **exists**: `resolveEditControlCapability` DENIED + `EditControlNotice` (`edit-control-capability.ts`, `edit-control-notice.tsx`). Needs assigned policy with per-op DENY + attempt that op. |
| MAN-UI-004 | NOT RUN | Guide `NOT_EXECUTABLE_YET`. Code **exists**: WARNING / OVERRIDE states (`edit-control-capability.ts:72-76`) + Review dialog. Needs policy rules + dirty edits. |
| MAN-UI-005 | BLOCKED | Review UI **exists** (`edit-review-dialog.tsx`, `edit-review-view.ts`) but non-empty ops impossible while policy MISSING closes CHANGE_*/ADD_*/REMOVE_* (`edit-control-capability.ts:64-65`). |
| MAN-UI-006 | BLOCKED | Conflict UX **exists** (`POLICY_CHANGED_REVIEW_REQUIRED` in `edit-shared-workspace.tsx:135,173`). Needs open policy + review cycle + concurrent policy change. |
| MAN-UI-007 | NOT RUN | Guide `NOT_EXECUTABLE_YET` for tracked-piece UX. Piece ops marked SUPPORTED in capability map (`ADD_PIECE`/`REMOVE_PIECE`) but blocked without policy / dirty path. |
| MAN-UI-008 | BLOCKED | Nav guard **exists** (`use-unsaved-changes.ts` beforeunload). Dirty state unreachable while notes/qty/actions no-op under MISSING policy. |
| MAN-UI-009 | BLOCKED | Clean AR checked (MAN-UI-001). Full Edit+Review RTL needs dirty/review → blocked by missing policy. Known AR defects: shell title EN, raw `processing`, clipped org name. |
| MAN-UI-010 | NOT RUN | Guide `NOT_EXECUTABLE_YET` — keyboard/focus needs interactive editor (policy assigned). |
| MAN-UI-011 | NOT RUN | Guide `NOT_EXECUTABLE_YET` — responsive/POS needs interactive editor. |
| MAN-UI-012 | NOT RUN | Guide `NOT_EXECUTABLE_YET`. Follow-up UI **exists** in code (`order-change-follow-up-dialog.tsx`) but needs Apply success path. |
| MAN-UI-013 | NOT RUN | Guide `NOT_EXECUTABLE_YET` — duplicate same-product review identity needs real review payload. |
| MAN-UI-014 | NOT RUN | Guide `NOT_EXECUTABLE_YET` — long warning/error layout needs WARN/DENY policy messages with content. |

**Counts:** PASS 0 · FAIL 0 · PARTIAL 1 · BLOCKED 4 · NOT RUN 9 · (total 14)

**Test data left behind:** none — nothing committed; ORD-20261014-0001 total remained 6.420 OMR; notes empty; locale restored to EN. No password changes.

### Diagnosis (read-only) — file:line, cause, bug vs by-design, fix

| ID | Finding | File:line | Root cause | Bug / by-design | One-line fix |
|---|---|---|---|---|---|
| D1 | Edit closed: "No edit policy is assigned…" | Resolver `lib/services/order-change/order-change-edit-policy-resolver.service.ts:35-91`; banner `messages/en/orders/edit.json` `capability.missing`; gate `edit-control-capability.ts:64-65` | No row in `org_wf_edit_policy_asg_cf` for Demo × profile version; bindings empty → status MISSING | By-design gate until assigned; **data gap** for Demo | Assign PILOT/PUBLISHED policy to Demo for WF_V2_SIMPLE v4 including status `processing` (see path below) |
| D2 | Customer notes typing ignored | `order-customer-details-section.tsx:171-179`; `use-new-order-state.ts:250-252` | `setCustomerNotes` returns early when `blocked('CHANGE_ORDER_NOTES')` under MISSING; textarea not disabled | **Bug (UX)** — looks editable | Bind `readOnly`/`disabled` to `!interactive` + `EditControlNotice` for CHANGE_ORDER_NOTES |
| D3 | No internal notes field | Customer Details only has customer notes; `setNotes` at `use-new-order-state.ts:245-247` unused in that section | Internal notes UI not wired on Edit Customer Details | **Bug / gap** vs guide step 5 | Add Internal notes textarea wired to `setNotes` with same capability gate |
| D4 | Row Edit notes / Override price / Remove look enabled | `summary-cart-item.tsx:224-284`; parent `order-summary-panel.tsx:309` | Parent uses `pointer-events-none opacity-60` but buttons lack `disabled`/`aria-disabled` | **Bug (a11y/UX)** | Pass `disabled={!interactive}` into SummaryCartItem actions |
| D5 | AR shell title + status + org clip | Context uses `orders.edit` `pageTitle` (AR OK); shell/"Edit Order" + `edit-order-context-bar.tsx:22` raw `workflowStatus` | Document/shell title not localized; status code not mapped to label; header overflow | **Bug** | Localize document title; translate status codes; fix header truncation |
| D6 | Guide nav Actions → Edit Order missing | `order-details-full-client.tsx` ~1499 header Edit link; Actions = Fix order data only | Product entry is header Edit, not Actions menu | Guide mismatch (product OK) | Update guide Expected path; optional add Actions → Edit Order |
| D7 | Review @ 0 changes — no dialog | `edit-shared-workspace.tsx:148-153`, `117` | Zero ops: toast intended, dialog suppressed (`NO_CHANGE`); Review still enabled when dirtyCount=0 | **Bug (UX clarity)** | Disable Review when `dirtyCount===0`; always surface `noChangesToSave` toast |
| D8 | DB assignment empty | Read-only SELECT on Preview DB | Demo assignments **0**; active PILOT/PUBLISHED policies **1** | Data | Assign the existing active policy (or create rules for `processing`) to Demo |

### How to assign an edit policy (HQ — exact path)

1. Open HQ `https://hqsaas.cleanmatex.com`.
2. **Workflow Engine Config** → **Profiles** → open **WF_V2_SIMPLE** → version **4** → **Studio**.
3. Direct route pattern: `/workflow-engine-config/profiles/{profileId}/versions/4/studio` → tab **Edit Policy** (`WfEditPolicyPanel` in `platform-web/.../wf-edit-policy-panel.tsx`).
4. Ensure matrix is **PILOT** or **PUBLISHED** and includes workflow status **`processing`** (and other statuses as needed). Profile version id seen in dialog: `a1000000-0000-4000-8000-000000000014`.
5. Assign card: select organization **Demo Laundry** (`11111111-1111-1111-1111-111111111111`) → **Assign** (API `POST .../edit-policies/assignments` → table `org_wf_edit_policy_asg_cf`).
6. Reload tenant Edit Order; Edit Policy Info should show policy name/lifecycle; MISSING banners should clear for ALLOWED ops.

**DB evidence (read-only, 2026-10-16):** `org_wf_edit_policy_asg_cf` for Demo = **0 rows**; `sys_wf_edit_policy_mst` with lifecycle PILOT|PUBLISHED active = **1**.

### Tester suggestions — Financial_Expert_Tester (FET-EOV2-S#)

- **P0 FET-EOV2-S1:** Assign Edit Policy to Demo Laundry for WF_V2_SIMPLE v4 / status `processing`. **Evidence:** MISSING banners + Edit Policy Info "Not assigned"; DB 0 assignments / 1 active policy. **Where:** HQ Studio Edit Policy Assign (`wf-edit-policy-panel.tsx` assign ~L431-437); resolver `order-change-edit-policy-resolver.service.ts:35-91`. **Fix:** Assign existing active policy (or publish matrix with `processing` rules) to tenant `11111111-…`.
- **P0 FET-EOV2-S2:** Customer notes looks editable but rejects input. **Evidence:** typed ` QA-test`, value stayed empty. **Where:** `order-customer-details-section.tsx:171-179` + `use-new-order-state.ts:250-252` + `edit-control-capability.ts:64-65`. **Fix:** disable/readOnly when `!interactive`; show capability notice.
- **P0 FET-EOV2-S3:** Missing Internal notes on Edit. **Evidence:** Customer Details has only Customer notes; guide step 5 expects internal notes. **Where:** `setNotes` `use-new-order-state.ts:245-247` unused in Customer Details UI. **Fix:** add Internal notes field gated like CHANGE_ORDER_NOTES.
- **P1 FET-EOV2-S4:** Row actions appear enabled while editing closed. **Evidence:** titles "Edit notes / pieces", "Override price", "Remove item" enabled in DOM. **Where:** `summary-cart-item.tsx:224-284`; wrapper `order-summary-panel.tsx:309`. **Fix:** `disabled={!interactive}` / aria-disabled on those buttons.
- **P1 FET-EOV2-S5:** Review with zero changes gives no clear feedback. **Evidence:** click Review → no dialog. **Where:** `edit-shared-workspace.tsx:151-153` (toast) / context bar enables Review regardless of dirtyCount (`edit-order-context-bar.tsx:31`). **Fix:** disable Review when dirtyCount=0; guarantee visible `noChangesToSave` message.
- **P1 FET-EOV2-S6:** Guide nav mismatch. **Evidence:** Actions has only "Fix order data"; real control is header **"Edit"**. **Where:** `order-details-full-client.tsx` ~1499. **Fix:** update Manual UI guide path; optionally add Actions → Edit Order.
- **P2 FET-EOV2-S7:** AR quality. **Evidence:** shell "Edit Order" EN; `processing` raw; org name clipped. **Where:** `edit-order-context-bar.tsx:22`; app shell title/metadata. **Fix:** localize title + status labels; fix header overflow.
- **P2 FET-EOV2-S8:** Guide execution-status accuracy. **Evidence:** Review/follow-up/capability/unsaved hooks exist in code while many scenarios still say `NOT_EXECUTABLE_YET`. **Fix:** reclassify to BLOCKED-by-policy/data where UI exists (005/006/008/012 partial).

### Retest prerequisites and plan
1. **P0 data:** HQ assign Edit Policy to Demo Laundry for WF_V2_SIMPLE v4 with `processing` rules (S1). Confirm Edit Policy Info shows name/lifecycle ≠ Not assigned.
2. **Retest MAN-UI-001 steps 5–7:** change internal + customer notes → dirty count > 0 → Review opens dialog (no commit) → Discard restores → beforeunload when navigating away dirty → verify totals/notes unchanged after discard.
3. **AR retest:** dirty + Review dialog RTL; confirm title/status/org fixes if shipped.
4. Then MAN-UI-005 (complete Review story), 008 (nav guard), 009 (full AR). With DENY/WARN/OVERRIDE rules: 003/004. Remaining 002/007/010–014 per guide when WP/UI ready.
5. Keep write-back rules: re-pull F: before merge; only FET section; no passwords in guide.

## Financial_Expert_Tester Results — Retest r2 (2026-10-16)

### P0 for developer (Retest r2 2026-10-16)
Ship these before any Apply-path FET retest on Preview:

1. **P0 — Review signer / Apply unreachable (`SIGNER_UNAVAILABLE`).** Preview is missing `ORDER_CHANGE_REVIEW_PROOF_SECRET` and `ORDER_CHANGE_REVIEW_PROOF_KEY_ID` → `proofKey=null` → Review never reaches `READY` → **Apply never shows**. This **blocks MAN-UI-005 (complete), MAN-UI-006, and MAN-UI-012**. **Where:** `order-change-preview-reads.ts:198-223`, `order-change-preview.service.ts:306-336`, `edit-review-dialog.tsx:51,116-123`. **Fix:** set both env vars on Preview (and Apply) and redeploy. See FET-EOV2-S9.
2. **P0 — Silent loss of unsaved edits on in-app sidebar nav.** Dirty Edit → sidebar **All Orders** leaves with **no in-app confirm** (only browser `beforeunload` on Back). **Where:** `use-unsaved-changes.ts:49-84`. **Fix:** guard Next `<Link>` / soft nav. See FET-EOV2-S10 / MAN-UI-008 **FAIL**.
3. **P0 — Remove item no-op.** Policy ALLOW_WITH_WARNING but click does nothing (passes `persistedItemId`, reducer filters `productId`). **Where:** `item-cart-list.tsx:137` vs `new-order-reducer.ts:218-221`. **Fix:** delete by `productId` + toast. See FET-EOV2-S11 / MAN-UI-003.

### Environment / build (r2)
| Field | Value |
|---|---|
| App | Preview tenant web-admin `https://cmx.cleanmatex.com` |
| Tenant | **Saudi Demo SAR** / Demo Saudi Riyadh Dry Clean · `c9ac29d1-219c-4a3a-8887-f860550c32be` (edit policy assigned **only** to this tenant; Demo Laundry was Round 1) |
| User / role | **Saudi Tenant Admin User Demo** · role label **`tenant_admin`** (tenant admin; no password recorded here) |
| Policy | **WF_V2_FULL_PATH_EDIT_POLICY** · lifecycle **PILOT** · revision **5** (owner assigned edit policy only to this tenant) |
| Locale | EN then AR (RTL); language control shows **العربية** when AR |
| Browser | Box agent Chromium UI session |
| Zoom emulation | CSS zoom emulation (not a physical device): **100%** (~1920px), **175%**, **200%** (css ~960), **250%** (css ~768). Note: layout findings for 011 are zoom-emulation only. |
| Time zone | Asia/Muscat (UTC+4) · run window **~02:55–03:08** 2026-10-16 |
| Repo (read-only git) | `F:\jhapp\cleanmatex` HEAD **`b7933b0e11a9330f388ed6cf7a374866629d929e`** (2026-10-15 23:29 +04, Order Edit V2 + Notification Hub) |
| Product chrome | CleanMateX v1.0 · shell/document title stays English **"Edit Order"** even in AR |
| Primary order | **ORD-20261015-0001** id `44f5cd1d-2c58-4d2a-80b2-1d887612413b` — **Processing** / Normal; 2 lines **Cotton Pants** 15.50 SAR + **Fitness Leggings** 10.30 SAR; UI total **29.670** / **29.67 SAR**; paid **11.670** / **11.67 SAR**; balance due **18.00 SAR**; payment CASH |
| Secondary | **ORD-20261010-0001** id `1683ffa4-…` — **"Unknown Product"** lines + warning **"Ready by date must be in the future"** in editor |
| Editable-status finding | On this tenant, **only Processing orders exist** for Edit Entry; no Ready / other statuses available to compare editable vs non-editable gates this run |
| Screenshots | **24** files under `/workspace/oe2/shots/` — full list below |
| Diagnosis | Table a–m in this section (+ `/workspace/oe2/diagnosis_r2.md`) |

### Exact EN / AR texts observed (r2)
**EN (Edit / Review / shell)**
- Context bar: `Edit Order #ORD-20261015-0001` / `Revision 1 · Workflow status: processing · 0 unsaved changes` (dirty → `2 unsaved changes`).
- Controls: **Discard** / **Discard changes** (disabled when clean); **Review**; Order Details header **Edit**.
- Review status (yellow): **`SIGNER_UNAVAILABLE`**; current **`29.67`**; estimated **`41.1700`**; outcome **`OUTSTANDING`**.
- Ops (raw codes): `CHANGE_ORDER_NOTES` (target `ORDER`); `CHANGE_ITEM_QUANTITY`; `ADD_PIECE`.
- History empty: **"No applied changes yet."**
- Review footer when not READY: **Cancel** + **Review again** (no **Apply**).
- Express path: status **DENIED** (red); op `CHANGE_SERVICE_SPEED`; amber **"Not allowed: CHANGE_REASON_REQUIRED · DENY"** (no reason field). DENY banner persists after closing dialog.
- Sidebar: **"All Orders"** (silent leave when dirty). Browser Back: native **"Leave site?"**.
- Pieces panel: **"No multi-piece items"** (full fallback copy may include toggle hint).
- Row action titles: **"Edit notes / pieces"**, **"Remove item"**.
- Ready-by (EN, ORD-20261010): **"Ready by date must be in the future"**.
- Shell/document title: **"Edit Order"** (EN even when AR locale).
- Untranslated in AR UI (left in English): **Edit Order**, **Dashboard**, **Orders**, **Help**, **JWT Test**, **`tenant_admin`**, **Free Trial**; Review codes **`SIGNER_UNAVAILABLE`**, **`OUTSTANDING`**, **`CHANGE_*`**, **`processing`**, **`ADD_PIECE`**, etc.
- Org header clipped: **`…emo Saudi Riyadh`** (full org **"Demo Saudi Riyadh Dry Clean"**).

**AR (localized strings that did appear)**
- Page/context: **تعديل الطلب** / **تعديل الطلب #ORD-20261015-0001** (and variants with order no).
- Buttons: **مراجعة** (Review); **تجاهل التغييرات** (Discard changes); dialog **إلغاء** (Cancel); **مراجعة مرة أخرى** (Review again).
- Stepper (seen): **اختر العناصر** (Select Items) … **تفاصيل العميل** (Customer Details).
- Search placeholder: **بحث...**
- Language chip: **العربية**
- Cart/product samples: **بنطلون قطني**, **ليقينقز (رياضي)**; Add **إضافة**; Express toggle label **مستعجل**.
- Review dialog title: **مراجعة**; status line pattern **نتيجة المراجعة: SIGNER_UNAVAILABLE** (code still EN).
- Ready-by capability banner (AR): **"تغيير موعد الجاهزية غير مسموح في الحالة الحالية"**.

### Tab / stepper order (Edit workspace)
EN order observed: **Select Items** → **Order Items** → **Edit Items Preferences** → **Edit Item Notes** → **Customer Details**.  
AR first/last confirmed: **اختر العناصر** → … → **تفاصيل العميل**.  
Order Details page tabs (entry context, EN): Order Master Data · Items & Pieces · Preferences · Order History · Edit History · Invoices · Receipt Vouchers · Payments · Actions · Stock Transactions · Receipt Sending · Financial · Customer · Notes. Entry control remains header **"Edit"** (Actions has no Edit Order).

### Zoom / layout observations (emulation)
| Zoom / css width | Observation | Shot |
|---|---|---|
| 100% ~1920px | Editor usable; cart visible | `r2_12a_layout_100pct_1920px_dirty.png` |
| 175% | OK (usable) | (session note; kbd zooms `r2_10b`/`r2_10c`/`r2_11b`) |
| 200% css ~960 | Editor dirty still usable; layout tight | `r2_12_layout_zoom200_css960_editor_dirty.png` |
| 250% css ~768 | **Cart pushed off-screen**; Review dialog footer needs scrolling | `r2_13_layout_zoom250_css768_editor_dirty.png`, `r2_14_review_dialog_zoom250_css768.png` |

### Draft-drift numbers
Fitness Leggings line after qty **+1** then **−1**: display line total drops **10.30 → 10.00** while the **+0.30** preference chip remains. Intermediate dirty: Piece 2 at **10.00**; draft total **35.50** (notes + qty +1). Diagnosis **i**.

### Customer-name mismatch
Order Details (`/full`, `r2_02`): customer **Name blank**; phone `+96896662624`; email `jhtest.dev21@gmail.com`.  
Edit workspace: customer chip **"Guest Guest"**. Diagnosis **j**.

### ORD-20261010-0001 issues
Secondary order id `1683ffa4-…`: editor shows **"Unknown Product"** line names; ready-by warning **"Ready by date must be in the future"**. Diagnosis **k**.

### Editable-status finding
Saudi Demo SAR inventory for this run: **only Processing** orders available. Edit was exercised only on Processing (`ORD-20261015-0001`, `ORD-20261010-0001`). No Ready/other status existed to validate status-gated entry DENY vs open Edit.

### r2 session narrative (chronological)
- Entry: Order Details header **Edit** → context bar EN exact above; Discard disabled when clean; Review enabled. Customer fields read-only; customer notes editable. No Internal notes field (still).
- Dirty: customer notes + qty +1 → dirty count **2** (Piece 2 at 10.00; draft total 35.50).
- Review: **SIGNER_UNAVAILABLE** (yellow); current 29.67; est **41.1700**; **OUTSTANDING**; ops listed; **no before/after**; history "No applied changes yet."; **Cancel** + **Review again** only. Shot `r2_07`.
- Express on: **DENIED** + `CHANGE_SERVICE_SPEED` + amber `Not allowed: CHANGE_REASON_REQUIRED · DENY` — **no reason field**. Banner persists after close. Shot `r2_15`.
- Sidebar **All Orders** with 2 unsaved → **no in-app warning** (`r2_08`). Back → **"Leave site?"**.
- Discard → **no confirm**. Remove on Fitness Leggings → **no effect** (`r2_09a`/`r2_09b`). Qty decrease silently removes new piece; **"Edit notes / pieces"** → **"No multi-piece items"**.
- Keyboard: focus ring visible; dialog traps focus; Escape closes; focus lands on background **Add** (not Review). Shots `r2_10*`–`r2_11*`.
- Zoom: table above. AR: RTL OK; untranslated list above; org `…emo Saudi Riyadh`. Shots `r2_16`–`r2_18`.
- Draft drift / Guest mismatch / ORD-20261010: as above.
- Final: Discard → clean; order verified unchanged at **29.670 SAR** (`r2_19`). **Test data left behind: none.**

### Screenshot inventory (all 24 r2 files)
- `/workspace/oe2/shots/r2_01_edit_ORD-20261015_clean.png`
- `/workspace/oe2/shots/r2_02_order_details_edit_entry.png`
- `/workspace/oe2/shots/r2_03_edit_clean_EN_ORD-20261015.png`
- `/workspace/oe2/shots/r2_04_edit_customer_details_section_clean.png`
- `/workspace/oe2/shots/r2_05_edit_dirty_customer_notes_QA-r2.png`
- `/workspace/oe2/shots/r2_06_edit_dirty_two_changes_qty_plus1.png`
- `/workspace/oe2/shots/r2_07_review_dialog_SIGNER_UNAVAILABLE.png`
- `/workspace/oe2/shots/r2_08_sidebar_nav_with_unsaved_no_warning_FINDING.png`
- `/workspace/oe2/shots/r2_09a_draft_after_remove_click.png`
- `/workspace/oe2/shots/r2_09b_cart_zoom_after_remove_click.png`
- `/workspace/oe2/shots/r2_10_kbd_focus_on_Review_button.png`
- `/workspace/oe2/shots/r2_10b_kbd_focus_context_zoom.png`
- `/workspace/oe2/shots/r2_10c_kbd_focus_review_zoom.png`
- `/workspace/oe2/shots/r2_11_kbd_review_dialog_focus_on_ReviewAgain.png`
- `/workspace/oe2/shots/r2_11b_kbd_review_dialog_zoom.png`
- `/workspace/oe2/shots/r2_12_layout_zoom200_css960_editor_dirty.png`
- `/workspace/oe2/shots/r2_12a_layout_100pct_1920px_dirty.png`
- `/workspace/oe2/shots/r2_13_layout_zoom250_css768_editor_dirty.png`
- `/workspace/oe2/shots/r2_14_review_dialog_zoom250_css768.png`
- `/workspace/oe2/shots/r2_15_review_dialog_express_DENIED.png`
- `/workspace/oe2/shots/r2_16_AR_edit_clean.png`
- `/workspace/oe2/shots/r2_17_AR_edit_dirty_2changes.png`
- `/workspace/oe2/shots/r2_18_AR_review_dialog_SIGNER_UNAVAILABLE.png`
- `/workspace/oe2/shots/r2_19_final_editor_clean_EN_after_discard.png`

### Results table — Retest r2 lines (Round-1 text kept in Round 1 section above)

| # | Round-1 | Retest r2 2026-10-16 (Saudi Demo SAR, edit policy assigned) |
|---|---|---|
| MAN-UI-001 | PARTIAL (policy MISSING Demo) | **PASS** — context bar, locks, dirty count, Review open, Discard restore, evidence on ORD-20261015-0001. Notes: still no Internal notes field; AR untranslated shell strings (Edit Order, Dashboard/Orders/Help/JWT Test, tenant_admin, Free Trial); org name clipped (`…emo Saudi Riyadh`). Shots `r2_01`–`r2_06`, `r2_16`–`r2_19`. |
| MAN-UI-002 | NOT RUN | *(unchanged — not retested; only Processing exists — no entry-DENY status sample)* |
| MAN-UI-003 | NOT RUN | **PARTIAL/FAIL** — Remove item allowed with warning by policy but click has **no effect and no feedback** (persistedItemId vs productId). Shots `r2_09a`/`r2_09b`. Diagnosis **c**. |
| MAN-UI-004 | NOT RUN | **PARTIAL** — DENY shown red/amber (`CHANGE_REASON_REQUIRED · DENY`) on Express; **no reason field / acknowledgement**; no WARN case seen this run. Shot `r2_15`. Diagnosis **g**. |
| MAN-UI-005 | BLOCKED | **PARTIAL** — dialog readable (ops, totals, history empty); **no before/after**; **no Apply** (`SIGNER_UNAVAILABLE`); no ack/reason field; est total **4 decimals** (`41.1700`). Shot `r2_07` / AR `r2_18`. Diagnosis **a,b,g,h**. Unblocked when proof env set (see retest plan). |
| MAN-UI-006 | BLOCKED | **BLOCKED** — Apply unreachable because of `SIGNER_UNAVAILABLE`. Diagnosis **a**. Unblocked when proof env set. |
| MAN-UI-007 | NOT RUN | **BLOCKED/FAIL** — no persisted multi-piece selection UI; qty decrease silently trims; panel **"No multi-piece items"**. Diagnosis **l**. |
| MAN-UI-008 | BLOCKED | **FAIL** — in-app sidebar nav loses unsaved edits **silently**; only browser beforeunload **"Leave site?"** on Back. Shot `r2_08`. Diagnosis **d**. Discard also has no confirm (**e**). |
| MAN-UI-009 | BLOCKED | **PARTIAL** — RTL works; untranslated EN strings listed above; org clipped; Review codes EN. Shots `r2_16`–`r2_18`. Diagnosis **h**. |
| MAN-UI-010 | NOT RUN | **PARTIAL** — focus ring + trap OK; Escape closes; **focus restore to Review trigger fails** (lands on Add). Shots `r2_10`/`r2_10b`/`r2_10c`/`r2_11`/`r2_11b`. Diagnosis **f**. |
| MAN-UI-011 | NOT RUN | **PARTIAL** — zoom emulation only; at 250%/css768 **cart off-screen**; dialog footer scrolls. Shots `r2_12`/`r2_12a`/`r2_13`/`r2_14`. Diagnosis **m**. |
| MAN-UI-012 | NOT RUN | **BLOCKED** — no Apply → follow-up/settlement UI not reachable. Diagnosis **a**. Unblocked when proof env set + Apply path exercised. |
| MAN-UI-013 | NOT RUN | **NOT RUN** — no same-product duplicate lines on test orders. |
| MAN-UI-014 | NOT RUN | **PARTIAL** — long/raw codes and DENY banner persist after close; layout mostly holds; clipped org + untranslated codes. Diagnosis **h**. |

**r2 counts:** PASS **1** · PARTIAL **6** · PARTIAL/FAIL **1** · FAIL **1** · BLOCKED **2** · BLOCKED/FAIL **1** · NOT RUN **1** · (MAN-UI-002 unchanged NOT RUN from Round 1) · executed rows **13**/14

**Test data left behind:** **none**. Nothing applied; ORD-20261015-0001 verified unchanged at **29.670 SAR**.

### Diagnosis a–m (r2) — file:line / cause / one-line fix
| ID | Finding | File:line | Cause | One-line fix |
|---|---|---|---|---|
| a | Review `SIGNER_UNAVAILABLE` → Apply never shows | `order-change-preview-reads.ts:198-223` builds `proofKey` only when `ORDER_CHANGE_REVIEW_PROOF_SECRET` + `ORDER_CHANGE_REVIEW_PROOF_KEY_ID` set; `order-change-preview.service.ts:306-336` sets status `SIGNER_UNAVAILABLE` when `reviewProof` null; `edit-review-dialog.tsx:51,116-123` shows Apply only when `status==='READY'` | Preview env missing both proof env vars (confirmed absent in local `.env` / `.env.local`; no `.env.preview`) → `proofKey=null` → no HMAC proof → not READY | Set `ORDER_CHANGE_REVIEW_PROOF_SECRET` + `ORDER_CHANGE_REVIEW_PROOF_KEY_ID` on Preview (and Apply path) and redeploy |
| b | Estimated total shows 4 decimals (`41.1700`) | `order-change-preview-reads.ts:52-57` `decimalText`/`money4` (toFixed(4)); preview returns `projectedTotal` as 4-dp string (`preview.service.ts:343`); dialog prints raw (`edit-review-dialog.tsx:69`) | Preview money serialized at 4 dp; Review UI does not format with tenant `decimalPlaces` | Format `projectedTotal`/`originalTotal` with tenant money formatter (2 dp for SAR) before display |
| c | Remove item no effect / no feedback despite ALLOW_WITH_WARNING | `item-cart-list.tsx:137` passes `item.id` (=`persistedItemId`); `new-order-content.tsx:353-355` → `removeItem(productId)`; `new-order-reducer.ts:218-221` filters by `productId`; capability WARN is interactive (`edit-control-capability.ts:75-76`) so not blocked | Delete passes line UUID; reducer matches `productId` → filter no-op; no toast | Pass `item.productId` to `onDeleteItem`, or resolve persisted id → productId inside `removeItem`; toast on success/failure |
| d | Sidebar link navigates away with no in-app guard | `use-unsaved-changes.ts:49-84` only patches `router.push`/`replace` + `beforeunload`; sidebar uses Next `<Link>` (no patched push) | In-app Link bypasses confirm; only hard leave hits beforeunload | Intercept Link / use `usePathname`+block or `window.history` guard; confirm via `cmxMessage.confirm` for dirty Edit |
| e | Discard has no confirmation | `edit-shared-workspace.tsx:197-205` `onDiscard` reloads immediately; context bar wires it (`edit-order-context-bar.tsx:28`) | V2 Discard skips confirm (Create path has `showDiscardConfirm` in `new-order-content.tsx:488-974` but Edit session uses V2 `onDiscard`) | Wrap V2 `onDiscard` in `cmxMessage.confirm` before `reloadKey++` |
| f | After Escape, focus not restored to Review trigger | `edit-review-dialog.tsx:53` `CmxDialog`/`onOpenChange` with no `onCloseAutoFocus` / return-focus target | Dialog closes without restoring focus to opener | Pass return-focus ref to Review button / `onCloseAutoFocus` preventDefault + `.focus()` on trigger |
| g | DENY `CHANGE_REASON_REQUIRED` offers no reason field | `order-change-capability.service.ts:239-247` `denial()` always `requiresReason:false`; L287-288 returns `denial('CHANGE_REASON_REQUIRED',…)`; UI gates textarea on `warning.requiresReason` (`edit-review-dialog.tsx:89-90`) | Reason-required DENY clears `requiresReason`, so textarea never mounts | On `CHANGE_REASON_REQUIRED`, set `requiresReason:true` (or show reason field whenever reasonCode is that) |
| h | Raw codes + untranslated AR + clipped org | Dialog shows raw `review.status`, `operation.code`, `financialOutcome`, `reasonCode` (`edit-review-dialog.tsx:66-83`); AR shell/nav keys missing (Edit Order, Dashboard/Orders/Help/JWT Test, tenant_admin, Free Trial); org header overflow | Missing i18n maps for status/ops/outcome; incomplete AR message catalogs; header CSS truncates | Add `orders.edit` maps for status/ops/outcome; fill AR shell strings; fix org name overflow CSS |
| i | Draft total drifts after qty +1 then −1 (10.30→10.00, +0.30 chip stays) | `edit-workspace-adapter.ts:62-84` omits `servicePrefCharge`; qty update rewrites `totalPrice` via `itemLineBasePlusPrefCharges` using `servicePrefCharge` (`new-order-reducer.ts:271-275`); cart display uses `calculateItemTotal` / chips from `servicePrefs` | Hydrate drops charge; qty path zeros it while prefs chips remain | Set `servicePrefCharge` from prefs sum in `projectEditVisualOrder`; recalc charge with prefs on qty change |
| j | Order Details customer name blank vs editor "Guest Guest" | Editor loads `customerSnapshot.name` (`edit-shared-workspace.tsx:78`, context `order-change-context.service.ts:219` from `order.customer_name`); Details likely uses live customer profile name | Snapshot has "Guest Guest"; profile/display path empty for default guest | Unify Details to show order snapshot name (or same fallback as Edit) |
| k | ORD-20261010 "Unknown Product" + ready-by-must-be-future | Fallback `productName \|\| 'Unknown Product'` (`new-order-content.tsx:527`); names from context `item.productName` (`edit-workspace-adapter.ts:65`); ready-by validation (`order-summary-panel.tsx:191-208`) treats past/now readyBy as invalid | Stale/missing `product_name` on lines; committed `ready_by` already past when reopened | Join product name on context load; skip or soften future-check for committed Edit readyBy |
| l | Qty decrease shows no piece-selection UI | `new-order-reducer.ts:259-264` silently `pieces.slice(0, quantity)`; pieces panel empty copy (`order-pieces-notes-section.tsx:134`) | Decrease auto-trims last pieces; no picker for which piece to remove | When `quantity < pieces.length`, open piece-selection UI before trimming |
| m | Narrow widths push cart off-screen | Desktop cart fixed `w-[28rem] shrink-0` (`new-order-content.tsx:911`); zoom/narrow keeps desktop flex instead of bottom sheet | Fixed-width sidebar exceeds viewport under zoom/narrow | Collapse to bottom sheet / stack below breakpoint or allow cart to shrink/reflow |

### Evidence pack (r2)
- Orders: **ORD-20261015-0001** (`44f5cd1d-2c58-4d2a-80b2-1d887612413b`); **ORD-20261010-0001** (`1683ffa4-…`).
- Policy: **WF_V2_FULL_PATH_EDIT_POLICY** PILOT rev **5** (assigned to Saudi Demo SAR only).
- Exact Review texts: `SIGNER_UNAVAILABLE`; `OUTSTANDING`; ops `CHANGE_ORDER_NOTES (ORDER)`, `CHANGE_ITEM_QUANTITY`, `ADD_PIECE`; Express path `Not allowed: CHANGE_REASON_REQUIRED · DENY`; history `No applied changes yet.`; est `41.1700`; buttons Cancel / Review again (EN) and إلغاء / مراجعة مرة أخرى (AR).
- Screenshot paths: all **24** files listed above under `/workspace/oe2/shots/r2_*.png`.

### Tester suggestions — FET-EOV2-S# (extend S9+)
- **P0 FET-EOV2-S9:** `SIGNER_UNAVAILABLE` blocks Apply (unblocks **005/006/012** when fixed). **Evidence:** Review yellow `SIGNER_UNAVAILABLE`; only Cancel/Review again; Apply absent; env SECRET+KEY_ID absent on Preview. **Where:** `order-change-preview-reads.ts:198-223`, `order-change-preview.service.ts:306-336`, `edit-review-dialog.tsx:51,116-123`. **Fix:** provision `ORDER_CHANGE_REVIEW_PROOF_SECRET` + `ORDER_CHANGE_REVIEW_PROOF_KEY_ID` on Preview/Apply and redeploy.
  - Dev note (2026-10-16): local `web-admin/.env.local` now has both names. Preview and Apply already share that reader. Restart web-admin before Retest r3. The secret stays out of git. A deployed host still needs the same two names set there before a retest on that host.
- **P0 FET-EOV2-S10:** Silent loss of unsaved edits on sidebar Link. **Evidence:** dirty count 2 → **All Orders** → left with no in-app confirm (`r2_08`); Back shows **"Leave site?"**. **Where:** `use-unsaved-changes.ts:49-84` (push/replace only). **Fix:** guard Next Link / soft nav with `cmxMessage.confirm`.
  - Dev note (2026-10-16): an in-app same-origin link click now opens the existing leave confirm before navigation. New-tab, external, and unmodified-click exceptions stay open. Browser Back still uses the existing page-leave prompt.
- **P0 FET-EOV2-S11:** Remove item no-op (id mismatch). **Evidence:** Fitness Leggings **Remove item**; cart unchanged (`r2_09a`/`r2_09b`); policy ALLOW_WITH_WARNING. **Where:** `item-cart-list.tsx:137` vs `new-order-reducer.ts:218-221` (+ `new-order-content.tsx:353-355`). **Fix:** delete by `productId` (or map persisted id → productId) + toast.
  - Dev note (2026-10-16): the cart now removes by `productId`. A successful removal shows "Item removed from the order." A blocked or missing line stays silent.
- **P1 FET-EOV2-S12:** `CHANGE_REASON_REQUIRED` DENY hides reason field. **Evidence:** Express → amber `Not allowed: CHANGE_REASON_REQUIRED · DENY`; no textarea (`r2_15`). **Where:** `order-change-capability.service.ts:247,287-288` + `edit-review-dialog.tsx:89-90`. **Fix:** set `requiresReason:true` for that denial (or show field when reasonCode matches).
- **P1 FET-EOV2-S13:** Discard without confirm (V2). **Evidence:** Discard restores immediately with no confirm dialog. **Where:** `edit-shared-workspace.tsx:197-205` (wired `edit-order-context-bar.tsx:28`). **Fix:** `cmxMessage.confirm` before `reloadKey++`.
- **P1 FET-EOV2-S14:** Review totals 4-dp + raw codes untranslated. **Evidence:** est `41.1700`; codes `SIGNER_UNAVAILABLE`/`OUTSTANDING`/`CHANGE_*` in EN and AR Review (`r2_07`/`r2_18`). **Where:** `order-change-preview-reads.ts:52-57`, `edit-review-dialog.tsx:66-83`. **Fix:** tenant money format (2 dp SAR) + i18n maps for status/ops/outcome.
- **P1 FET-EOV2-S15:** Draft line total drift after qty +1/−1. **Evidence:** Fitness Leggings **10.30→10.00** while **+0.30** chip stays. **Where:** `edit-workspace-adapter.ts:62-84` missing `servicePrefCharge`; `new-order-reducer.ts:271-275`. **Fix:** hydrate charge from prefs sum; keep charge consistent on qty change.
- **P1 FET-EOV2-S16:** Focus not restored after Escape from Review. **Evidence:** Escape closes dialog; focus lands on background **Add** (`r2_10`–`r2_11`). **Where:** `edit-review-dialog.tsx:53`. **Fix:** return focus to Review trigger (`onCloseAutoFocus` / opener ref).
- **P2 FET-EOV2-S17:** Qty decrease lacks piece-selection UI. **Evidence:** qty −1 silently removes new piece; panel **"No multi-piece items"**. **Where:** `new-order-reducer.ts:259-264`, `order-pieces-notes-section.tsx:134`. **Fix:** piece picker before trim when `quantity < pieces.length`.
- **P2 FET-EOV2-S18:** Narrow/zoom cart off-screen. **Evidence:** 250%/css768 cart off-screen; dialog footer scrolls (`r2_13`/`r2_14`). **Where:** `new-order-content.tsx:911` `w-[28rem] shrink-0`. **Fix:** reflow/bottom-sheet below breakpoint.
- **P2 FET-EOV2-S19:** Details blank customer vs Edit **"Guest Guest"**; ORD-20261010 **"Unknown Product"** + **"Ready by date must be in the future"**. **Evidence:** `r2_02` blank Name vs Edit chip; secondary order editor. **Where:** snapshot `edit-shared-workspace.tsx:78` / `order-change-context.service.ts:219` vs Details profile; `new-order-content.tsx:527`; `order-summary-panel.tsx:191-208`. **Fix:** unify name source; join product names on context load; soften Edit readyBy future check for committed dates.
- **P2 FET-EOV2-S20:** AR shell strings + clipped org (still open from S7). **Evidence:** EN **Edit Order**/Dashboard/Orders/Help/JWT Test/`tenant_admin`/Free Trial; org `…emo Saudi Riyadh` (`r2_16`). **Where:** app shell title/metadata; header overflow CSS; `edit-order-context-bar.tsx:22` raw `processing`. **Fix:** complete AR catalogs; localize document title + status; fix header overflow.

### Retest plan (post-r2)
1. **P0 env (unblocks MAN-UI-005, MAN-UI-006, MAN-UI-012):** Set Preview `ORDER_CHANGE_REVIEW_PROOF_SECRET` + `ORDER_CHANGE_REVIEW_PROOF_KEY_ID`; redeploy; confirm Review status **READY** and **Apply** visible (no commit in FET unless explicitly authorized). Then complete **005** (before/after, 2-dp money, ack/reason), exercise **006** conflict/recovery with Apply reachable, and **012** follow-up after a controlled Apply.
2. **P0 nav:** Ship Link/soft-nav unsaved guard; retest MAN-UI-008 dirty → sidebar All Orders → in-app confirm → stay/leave.
3. **P0 remove:** Fix productId wiring; retest MAN-UI-003 Remove on Fitness Leggings with WARN policy → line removed in draft + feedback.
4. Retest **004** WARN path + reason field; **007** with a true multi-piece tracked item; **010** focus restore; **011** real narrow viewport (not zoom-only); **009/014** after i18n; **013** when same-product duplicate lines available; **002** when a non-Processing / entry-DENY status exists (currently **only Processing** on this tenant).
5. Keep write-back rules: re-pull F: before merge; FET section only; no passwords; verify hash/size/mtime on F:.
