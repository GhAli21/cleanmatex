# Payment Modal v4 — Phases 4–6 Manual QA Guide (Simple Mode · Shortcuts · Tablet)

**Purpose:** Behaviorally validate what the green automated gates (eslint 0 · tsc 0 · jest 1586/1586 incl. payload oracle 8/8 · build ✓ · check:i18n ✓) **cannot** cover: the Simple ⇄ Full mode switch, auto-escalation, keyboard shortcuts, and the tablet layout. Run solo; tick each box; add notes under any case. This is verification #9 of the program plan plus the Phase 5/6 surfaces.

**Scope of change being tested:**
- **Phase 4:** modal now **opens in Simple mode** for everyone; `payment-simple-view.tsx` body + `PaymentModeToggle` in the header; auto-escalation via `engine.needsAdvanced`; escalation banner; blocked-submit escalation.
- **Phase 5:** `use-payment-shortcuts.ts` — Enter / F2 / Ctrl(⌘)+Enter submit via the SAME CTA gate.
- **Phase 6:** below `xl` (<1280px) the receipt rail is a slide-over + a docked Final-Total/Change bar in the footer; `md–xl` 2-pane grid.

**Hard invariant:** the submit **payload contract is unchanged**. If any submitted payload differs from the pre-Phase-4 behavior for the same inputs, that is a bug — not a design change.

**Screenshot convention (same as the 2D guide):** name screenshots `SC-<case>-<n>` (e.g. `SC-A3-01`) and reference them in your notes.

---

## Setup

1. Start services / web-admin:
   ```
   cd web-admin && npm run dev
   ```
2. Log in → **New Order** → add a few items (subtotal > 0).
3. You will need, across the cases below:
   - a **walk-in / retail customer** (cash-card fast lane),
   - a **B2B customer** (instant escalation case),
   - a customer with a **gift card** and/or **promo code** available,
   - a branch where you can control **cash-drawer sessions** (0, 1, and 2 open sessions),
   - if available, a **card method with `requires_terminal`** + at least one configured terminal.
4. Do one pass in a **3-dp currency** (OMR/BHD/KWD) for the money displays; spot-check cash cases in a 2-dp currency if available.
5. **How to read "payload":** DevTools → Network/Console on **Submit** — check `legs[]` (`amount`, `cashTendered`, `method`, `legRef`), `outstandingPolicy`, `cashDrawerSessionId`.

---

## 🔴 Critical path A — Simple mode happy path (run first)

### A1 — Default open = Simple
1. Open the Payment modal from New Order (retail/walk-in customer, no gift/promo, exactly **one** open cash-drawer session).
- ✅ Expect: modal opens on the **Simple face** (`payment-simple-view` visible: method chips, one hero amount field, receipt card). Header shows the **Simple | Advanced** toggle with **Simple** selected.
- ✅ Expect: **no escalation banner**.
- [ ] Pass
- My Notes:
1. I choose simple then select Cash it jump to Advanced mode even also jump when click on any number in the keypad????
2. the keypad is big can you make it smaller to look like calculator look and feel???

### A2 — Cash exact, one tap
1. Tap the **Cash** chip. 2. Tap the **Exact** quick-tender chip.
- ✅ Expect: amount = sale total, receipt card shows Paid now = Total due, **Change 0**, status "Fully settled ✓".
- ✅ Expect: cash-drawer line shows the **bound drawer • session** (auto-selected, single session).
- 3. Submit → confirm.
- ✅ Payload: one cash leg, `amount` = sale total, `cashTendered` = `amount`, `cashDrawerSessionId` present.
- [ ] Pass
- My Notes:

### A3 — Cash with change (stays Simple)
1. Reopen modal (fresh order or reopen). Cash chip → type **more** than the total (e.g. 50 → 60), or tap a note chip (e.g. 50/100).
- ✅ Expect: receipt card **Change** shows the difference in emerald; status stays settled; **modal stays in Simple** (cash over-tender is change, NOT overpayment routing).
- ✅ Payload: `amount` = total, `cashTendered` = typed value.
- [ ] Pass
- My Notes:

### A4 — Card flow (+ terminal if configured)
1. Fresh Simple modal → tap the **Card** (or gateway) chip → Exact.
- ✅ Expect: leg created at full amount; if the method **requires a terminal**, a compact **terminal dropdown** appears under the chips — leaving it empty keeps Submit blocked (footer validation lists it), choosing one unblocks.
- ✅ Expect: no cash-drawer line for a pure card payment.
- [ ] Pass
- My Notes:

### A5 — Partial payment → policy line
1. Fresh Simple modal (retail customer) → Cash → type **less** than total (e.g. 30 of 50).
- ✅ Expect: amber **Remaining** line appears: `Remaining: <currency> 20 · Pay on Collection` with a **Change** button; receipt card shows the Remaining row.
- ✅ Submit allowed (deferred remainder is by design); payload `outstandingPolicy` = `PAY_ON_COLLECTION`.
- 2. Tap the policy line's **Change** button.
- ✅ Expect: switches to **Advanced**, Balance-Policy section **expanded and scrolled into view**. No state lost (leg amount still 30).
- [ ] Pass
- My Notes:

### A6 — Open / reopen reset (mode + slices)
1. In Simple, build some state (leg, typed draft). 2. Switch to Advanced manually. 3. Close (discard) → **reopen**.
- ✅ Expect: reopens in **Simple**, empty legs, no draft, no banner, rail slide-over closed — nothing survives.
- [ ] Pass
- My Notes:

---

## 🔴 Critical path B — Auto-escalation matrix (verification #9)

For each case: start in Simple, trigger the condition, and verify **all four**: (1) auto-flip to Advanced, (2) amber **escalation banner** naming the reason, (3) **Simple segment disabled** (hover shows the "Advanced options are in use…" hint), (4) **no state lost** by the flip. When the condition is cleared, the banner logic differs — see B9.

### B1 — B2B customer (instant)
1. New order for a **B2B** customer → open Payment.
- ✅ Expect: lands directly on **Advanced** with banner reason "B2B credit invoice". Simple segment disabled from the start.
- [ ] Pass
- My Notes:

### B2 — Split payment
1. Simple → Cash → partial amount. 2. Toggle to **Advanced** manually (More options) → add a **second leg** (Card).
- ✅ Expect: with 2 settlement legs, the **Simple segment goes disabled** (reason would be "split payment in use"). Banner only appears if the flip was automatic — manual entry into Advanced shows **no banner** (by design).
- 3. Remove the second leg → Simple segment re-enables → switch back to Simple → both remaining values intact.
- [ ] Pass
- My Notes:

### B3 — Gift card / promo applied
1. Simple → Advanced (manually) → apply a **promo code** or **gift card**.
- ✅ Expect: Simple segment disabled while applied ("gift card or promo applied"). Clear it → re-enabled.
- [ ] Pass
- My Notes:

### B4 — Gift-card PIN required
1. Fetch a PIN-protected gift card (details loaded, PIN not yet entered).
- ✅ Expect: Simple disabled ("gift card PIN required") until PIN satisfied/cleared.
- [ ] Pass
- My Notes:

### B5 — Overpayment routing (pay-extra)
1. Advanced → enable **Pay extra** and create an unresolved excess (e.g. card over total).
- ✅ Expect: Simple disabled ("overpayment needs a destination") while unresolved; re-enabled once routed/cleared. Cash change alone must **not** trigger this (see A3).
- [ ] Pass
- My Notes:

### B6 — Drawer ambiguous (2 open sessions)
1. Open a **second** cash-drawer session for the branch. 2. New order → Payment.
- ✅ Expect: opens Simple, but selecting **Cash** escalates (or it opens escalated) with "multiple cash drawer sessions open"; the Advanced drawer section offers the session choice.
- [ ] Pass
- My Notes:

### B7 — Drawer blocked (0 open sessions)
1. Close **all** drawer sessions. 2. New order → Payment → Cash in Simple.
- ✅ Expect: auto-escalates with "cash drawer session required"; Advanced shows the drawer blocking card; opening a session from the dialog clears the block.
- [ ] Pass
- My Notes:

### B8 — FX / rounding (only if you have a tenant with `currencyExRate ≠ 1`)
- ✅ Expect: opens escalated with "currency exchange or rounding active". Skip if not configurable.
- [ ] Pass / [ ] Skipped
- My Notes:

### B9 — Return to Simple after clearing
1. From any case above, clear the condition (remove leg/gift/etc.).
- ✅ Expect: modal **stays in Advanced** (no auto-downgrade — by design), Simple segment becomes **enabled**; clicking it returns to Simple with all state intact and the banner gone.
- [ ] Pass
- My Notes:

### B10 — Blocked submit in Simple escalates
1. Simple → Card requiring a terminal (or any blocked state reachable in Simple) → hit **Submit** while blocked.
- ✅ Expect: flips to **Advanced** and scrolls/focuses the first blocking issue (same "Fix now" behavior as the Full CTA). No submit fired.
- [ ] Pass
- My Notes:

### B11 — Focus across flips
1. In Simple, focus the amount field → trigger an escalation (e.g. B7 flow).
- ✅ Expect: after the flip, focus lands on the **amount editor** in Advanced (not lost to `<body>`); same when returning to Simple.
- [ ] Pass
- My Notes:

---

## C — Phase 5 keyboard shortcuts

Baseline for C1–C4: Simple or Advanced, a valid cash-exact payment ready (Submit enabled), no dialogs open.

### C1 — Enter / F2 / Ctrl+Enter submit
1. Click on neutral whitespace inside the modal (so focus is NOT in an input/button). 2. Press **Enter**.
- ✅ Expect: the submit-confirm dialog opens — identical to clicking the CTA.
3. Cancel. Repeat with **F2**, then **Ctrl+Enter** (⌘+Enter on Mac).
- ✅ Expect: same behavior for each. Exactly **one** confirm per press (no double-fire).
- [ ] Pass
- My Notes:

### C2 — Disabled in editable fields
1. Focus the **amount editor** (or notes textarea) → press Enter, Ctrl+Enter, F2.
- ✅ Expect: **nothing submits** (locked guard: any focus in input/textarea/select/contenteditable disables all three combos).
- [ ] Pass
- My Notes:

### C3 — Enter on buttons defers
1. Tab to any button (e.g. a method chip) → press **Enter**.
- ✅ Expect: the **button activates** (chip selects); NO payment submit. Then press **F2** with the button still focused → F2 **does** submit (it's not Enter).
- [ ] Pass
- My Notes:

### C4 — Disabled while dialogs open / blocked / busy
1. Open the cash-drawer dialog (or submit-confirm, or an allocation drawer) → press Enter/F2.
- ✅ Expect: no second submit fires behind the dialog.
2. Make validation blocking (e.g. terminal missing) → Enter/F2.
- ✅ Expect: nothing fires (no escalation either — shortcuts simply stay silent while blocked).
- [ ] Pass
- My Notes:

---

## D — Phase 6 tablet / responsive (resize DevTools, or a real tablet)

### D1 — `<xl` (< 1280px, e.g. 1024×768) — docked bar + rail slide-over (Advanced)
1. Advanced mode at ~1024px wide.
- ✅ Expect: the right receipt rail is **gone from the grid**; the footer shows the **docked bar** (Final Total, and Change in emerald when cash over-tendered) + a **Receipt Brain** button beside it.
2. Tap the Receipt button.
- ✅ Expect: rail slides in from the end edge over a dimmed backdrop; internal ✕ and backdrop both close it; content = the full rail (customer, balance result, final total).
- [ ] Pass
- My Notes:

### D2 — `md–xl` 2-pane (768–1280px)
1. ~1024px, Advanced.
- ✅ Expect: **2 columns** — tools (methods/credits, ~280px) | workbench. The tools column **scrolls internally** (sticky) while the workbench scrolls; keypad/chips and the footer CTA stay reachable without losing the tools.
- [ ] Pass
- My Notes:

### D3 — Simple face responsive
1. Simple mode at ~1024px and at phone width (~400px).
- ✅ Expect: at md+ the pay/receipt cards sit side-by-side; at phone width they stack; the **docked bar** still shows Final Total (+Change) in the footer; no horizontal scrolling.
- [ ] Pass
- My Notes:

### D4 — `xl+` regression (≥1280px)
1. Full desktop width, Advanced.
- ✅ Expect: original 3-column layout, pinned rail, **no** Receipt toggle / docked bar in the footer (they are `xl:hidden`). Nothing moved vs. Phase 3.
- [ ] Pass
- My Notes:

### D5 — RTL pass (Arabic)
1. Switch to Arabic; repeat A1–A3 quickly, D1 slide-over, and the escalation banner (B7 easiest).
- ✅ Expect: Simple layout mirrors correctly; slide-over enters from the correct (end) edge; toggle/banner/chips read right-to-left; Arabic strings present for: toggle (بسيط/متقدم), banner reasons, Simple labels (طريقة الدفع، المبلغ، الباقي، المتبقي، خيارات إضافية).
- [ ] Pass
- My Notes:

### D6 — Reduced motion (optional)
1. OS "reduce motion" on → open/close the slide-over, settle a payment.
- ✅ Expect: no slide/color animations (instant transitions).
- [ ] Pass / [ ] Skipped
- My Notes:

---

## E — Regression smokes (Full mode must be untouched)

### E1 — Full-mode heavyweight flows still work
Run quickly in **Advanced**: split (cash+card), gift card with PIN, B2B credit-invoice, overpayment allocation (auto-preview + confirm), deferred policy.
- ✅ Expect: identical behavior to the Phase-3 QA pass; payloads match the known shapes.
- [ ] Pass
- My Notes:

### E2 — Collect-Payment modal unaffected
Orders list → an order with outstanding → **Collect Payment**.
- ✅ Expect: no mode toggle there; flow unchanged (it shares `usePayExtraCheckout`, not the mode system).
- [ ] Pass
- My Notes:

### E3 — Escape / close-guard still works
Dirty modal → Esc / ✕ → confirm-close guard appears; Enter while that guard is open does **not** submit the payment.
- [ ] Pass
- My Notes:

---

## Result summary

| Section | Cases | Pass | Fail | Skipped |
|---|---|---|---|---|
| A — Simple happy path | A1–A6 | | | |
| B — Escalation matrix | B1–B11 | | | |
| C — Shortcuts | C1–C4 | | | |
| D — Tablet/RTL | D1–D6 | | | |
| E — Regression | E1–E3 | | | |

**Verdict:** [ ] All green — mark the program's manual gate complete in `Payment_Modal_v4_Engine_Refactor_STATUS.md` · [ ] Bugs logged (list case IDs + screenshots) for a fix pass.
