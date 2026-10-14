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
**Execution status:** `NOT_EXECUTABLE_YET` until WP15.

**Purpose:** Verify the final pre-Apply review clearly communicates exactly what will change.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order -> make multiple changes -> Review Changes`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Review Changes dialog/sheet  
**UI areas:** grouped operations, before/after values, totals, financial outcome, warnings/reason, Apply/Cancel.

**Steps:**
1. Make at least two supported changes affecting different target types where possible.
2. Open Review Changes.
3. Read the operation groups without referring to backend/debug data.
4. Inspect before/after values and financial summary.

**Expected:** a staff user can identify what row/target changes, old/new value, total difference and any follow-up requirement before Apply.

**Human checks:** grouping, scanability, money readability, no ambiguous product-only identity for duplicate same-product lines, no hidden warnings below unreachable scroll area.

**EN/AR/RTL:** repeat in Arabic; verify groups, amounts and action buttons remain readable and logically placed.

**Automation coverage:** exact values/operation counts/Apply payload should be automated.  
**Why manual remains:** readability and information hierarchy.

---

### MAN-UI-006 — Stale revision/policy/calculation conflict recovery clarity

**Owning WP:** WP15  
**Execution status:** `NOT_EXECUTABLE_YET` until WP15.

**Purpose:** Verify the user understands that reviewed data became stale and that the system did not silently merge/apply new values.

**Navigation:** `Dashboard -> Orders -> Order Details -> Actions -> Edit Order -> Review Changes -> trigger stale condition -> Apply`  
**Route:** `/dashboard/orders/{orderId}/edit`  
**Screen:** Review/conflict feedback surface  
**Controls:** Reload/Refresh/Re-review/Discard options as implemented.

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
