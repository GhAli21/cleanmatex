# Payment Modal v4 — UX/UI Review & `usePaymentEngine` Refactor Plan

**Date:** 2026-06-26
**Author:** Architecture/UX review session (Claude Opus 4.8)
**Scope:** `web-admin/src/features/orders/ui/payment-modal-v4.tsx` and its supporting modules
**Status (2026-07-03):** **IMPLEMENTED — program complete (Phases 0–7).** Engine extracted (`usePaymentEngine`, Phases 1–2G), view split (`payment-full-view.tsx` + thin shell), Phase 3 UX quick wins (findings **1.1, 1.2, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11** + polish), **Phase 4 Simple mode + auto-escalation** (`payment-simple-view.tsx`, `PaymentModeToggle`, `needsAdvanced` consumed), **Phase 5 keyboard shortcuts** (finding **1.3** — `use-payment-shortcuts.ts`), **Phase 6 tablet layout** (finding **1.5** — 2-pane, rail slide-over, `PaymentDockedSummaryBar`), **Phase 7 docs** (`Payment_Modal_v4_Engine_Architecture.md`). Progress tracker: `happy-doodling-volcano.md`.

---

## 0. Files reviewed

| File | Lines | Role |
|---|---|---|
| `payment-modal-v4.tsx` | 5,886 | Main modal component (logic + JSX) |
| `payment-modal-v4.utils.ts` | 669 | Pure money/leg helpers |
| `payment-modal-v04-sections-definition.ts` | 233 | Section/tab visibility derivation |
| `payment-modal-v4.right-rail.ts` | 225 | Right-rail view-model (balance status, required action) |
| `payment-modal-v4-credit-note-picker.tsx` | 98 | Credit-note picker dialog |
| `payment-workbench-section.tsx` | 132 | Collapsible section shell |

**Architecture note:** the engineering underneath is strong — derived view-models, testable section/tab derivation, skeletons, inline errors, focus trap, thorough RTL. The problem is **altitude**, not correctness: the screen is built as a finance-analyst console when ~80% of usage is "take cash → give change → submit."

---

## 1. UX/UI Review — findings by severity

### 🔴 High-impact

#### 1.1 The same balance numbers repeat 4–6 times → visual hierarchy collapses
"Remaining balance" appears in: Section A's 4 stat cards (`:3886-3906`), Section C's "after this payment" trio (`:4205-4216`), the right-rail Balance Result card (`:5399`), the Settlement-Now card (`:5495`), the submit-confirm dialog, and the submit button label. **The Balance Result card prints the status label twice** — as a badge (`:5386`) and again as a full row (`:5417-5423`).

**Fix:** One canonical home per metric. Keep Remaining/Change/Status in the right rail (source of truth). Demote Section A to a single hero line. Delete the duplicated status row at `:5417-5423`. Collapse Section C's trio to just the live "after this payment" delta.

#### 1.2 No fast lane for cash — the #1 transaction takes the most taps
No quick-tender chips (Exact, round-up to 5/10, denominations 5/10/20/50/100). Every amount is keypad-entered (`:4121`). "Fill remaining" exists (`:4112`) but the dominant "customer hands a 50 for a 37.50 order" flow requires manual typing.

**Fix:** Add a `CmxQuickTenderChips` row above the keypad: `[Exact] [Next 5] [Next 10] [50] [100]`, each calling existing `updateLeg(activeLegIndex, 'amount', …)`. Derive denominations from tenant currency. Highest-ROI single addition.

#### 1.3 No keyboard shortcuts for a high-frequency POS surface
Only keyboard handling is the focus trap (`:700`) + Enter-on-specific-inputs. No Enter-to-submit, no hotkey to jump methods, no "exact cash" key.

**Fix:** Scoped `keydown` handler (guarded to modal, ignoring text inputs): `Enter`/`F2`/`Ctrl+Enter` → submit (reuse `submitHasBlockingIssues` gate at `:2832`); number keys focus amount. Surface a small shortcuts hint.

#### 1.4 No `aria-live` for live financial values — critical a11y gap
Remaining/Change/Status update continuously but live in static DOM. Screen-reader users never hear "Fully settled, change 12.50." (Zero `aria-live` regions in the file.)

**Fix:** Wrap the right-rail Balance Result in `role="status" aria-live="polite"`; announce status transitions via the `rightRailState.balanceStatus` machine (`right-rail.ts:152`).

#### 1.5 Below `xl` (≤1280px) the layout becomes an unusable long scroll
Grid is `xl:grid-cols-[320px_minmax(720px,1fr)_360px]` (`:3528`) — below `xl` it stacks to one column: 3 tool cards, then 7 workbench sections, then 5 right-rail cards. Keypad and balance summary end up far apart. No tablet layout, yet POS hardware is often a 10–13" tablet.

**Fix:** Add `md`/`lg` 2-pane layout with a docked bottom bar (Final Total + CTA + change); make the right rail a slide-over on tablet. Pin keypad + submit within thumb reach on touch widths.

### 🟠 Medium-impact

#### 1.6 Accent-color overload dilutes the primary CTA
Cyan, teal, purple, amber, rose, emerald, slate used simultaneously, plus gradients on header (`:3512`), Balance Snapshot (`:3865`), Final Total (`:350`), and the submit button (`:5601`). Four gradient surfaces → CTA stops reading as "the action."

**Fix:** Reserve the teal→cyan gradient exclusively for the primary CTA. Flat/tonal everywhere else. Keep semantic colors strict: rose=blocking, amber=warning, emerald=settled.

#### 1.7 The "required action" message renders in two places at once
Blocking-action banner appears in Section C (`:4170-4191`, amber) **and** the right rail (`:5429-5452`, rose) — same `requiredActionCopy`, two colors, two "Fix" buttons → ambiguity.

**Fix:** One blocker surface (keep right rail, next to the disabled CTA). Standardize on rose for blocking.

#### 1.8 Too much expanded by default → long initial scroll
Default-expanded: A, B, C, F, D — 5 of 7 sections (`sections-definition.ts:96-146`).

**Fix:** Open only A (snapshot) + B (amount) by default. Auto-expand C/F/D contextually when relevant. Extend the visibility deriver to also drive default-expansion.

#### 1.9 Weak/ambiguous empty + failure states for payment methods
Empty methods render a single muted line (`:3558`). A failed checkout-options API is **indistinguishable** from "tenant has no methods configured" — both yield `realPaymentOptions.length === 0`.

**Fix:** Thread `isError`/`refetch` from the checkout-options query; render three distinct states: loading (skeletons ✅), error (icon + Retry), genuinely-empty (guidance + settings link). Use `CmxEmptyState`.

#### 1.10 `SummaryRow` breaks the design-token palette
`SummaryRow` uses `text-gray-*`/`border-gray-*`/`text-red-700` (`:308-313`) while the rest is `slate`/`rose`. It is the most-reused row in the modal → drift is visible everywhere.

**Fix:** Switch to `slate`/`rose`.

#### 1.11 Touch targets & label semantics
- Required fields use a literal `*` appended to the label string (`:4361`, `:4340`) — not `required`/`aria-required`; screen readers don't announce requiredness.
- Several `size="xs"`/`sm` buttons ("Fill remaining" `:4110`) likely < 44px on touch POS.
- Low-contrast hint text: `text-slate-400` method hint (`:3598`) ≈ 3:1 on white — fails WCAG AA.

**Fix:** Add `required`/`aria-required` to conditionally-required inputs; bump touch-critical buttons to 44px min on touch breakpoints; raise hint text to `slate-500/600`.

### 🟡 Lower-impact / polish

- **RTL typography:** heavy `uppercase tracking-[0.18em]` on section labels (`:3545`) is meaningless/harmful for Arabic. Gate behind `!isRTL`.
- **Radius sprawl:** `rounded-xl/2xl/3xl/[28px]/full` coexist. Pick a 3-step scale.
- **No completion moment:** when remaining hits 0 the number just changes color (`:4213`). Add a brief success transition keyed off `FULLY_SETTLED`, respecting `prefers-reduced-motion`.
- **Initial focus** not placed on the amount field on open. Focus amount (or first method) when `open` flips true.
- **"Add method" context jump:** scrolls left rail to top (`:3815`) instead of an inline picker near the legs list.
- **Hardcoded English fallbacks** (`|| 'Remaining'`, `|| 'Backspace'`): per i18n rules every string needs a key. Run `npm run check:i18n` and backfill.

### Scalability / maintainability

A **5,886-line single component** is the structural risk. Supporting extraction is excellent, but the JSX is monolithic — each of the 7 sections is impossible to test/storybook/reuse in isolation. **Fix:** promote each section into its own component receiving a typed view-model, rendered by iterating `deriveVisiblePaymentSections(...)`.

---

## 2. Decision: Simple + Full experience — **one engine, two faces**

**Question raised:** "Two modals — one full, one simplified for the common case?"

**Recommendation:** Yes to two experiences. **No** to two modals that each own their own logic.

The danger is not the second UI — it is a second copy of the business logic (totals, legs, validation, cash-drawer, allocation, submit payload, RTL/i18n). Forking that produces drift; every finance bug must be fixed twice.

**Direct evidence this hurts:** `payment-modal-v3` and `payment-modal-enhanced-02` were retired to `.bak` on 2026-06-25 precisely because maintaining parallel payment modals became a burden. Two independent modals re-creates that.

### The reframe — split engine from view

```
usePaymentEngine()              ← single source of truth
   ├─ totals, legs, validation, cash drawer, allocation, submit payload
   │
   ├─► <PaymentSimpleView/>     (cash/card · quick-tender · change · submit)
   └─► <PaymentFullView/>       (split, B2B AR, gift card, allocation, inspector)
```

### Preferred face arrangement: **one modal, two modes**

Over two separately-launched modals — for three reasons:

1. **No state-handoff problem.** If a cashier types `50.00` then needs a split, two modals lose state or need a state bridge (= the shared engine anyway). One modal + mode flag keeps every keystroke.
2. **Auto-escalation is free.** `deriveVisiblePaymentSections(...)` + the right-rail required-action machine already know when complexity exists; derive a single `needsAdvanced` boolean from the same inputs.
3. **One submit contract, one confirm dialog, one set of tests.**

Two *launch points* (a "Quick Pay" button vs "Payment") are fine — both mount the same component with a different initial `mode` prop.

### When two fully-independent modals WOULD be justified

Only if Simple and Full diverge so much they barely share a payload (e.g., Simple is a true kiosk/self-checkout with a different submit endpoint and no cashier concepts). Not the case here — both produce the same order-payment payload. Shared-engine wins.

### What each mode holds

| Simple (the 80%) | Escalate to Full when… |
|---|---|
| One method (Cash/Card), quick-tender chips, change, balance policy if remainder, submit | split payment · B2B/AR or credit invoice · gift card/promo · overpayment allocation · gift-card PIN · ambiguous cash-drawer session · multi-currency/rounding |

The right column ("receipt brain") is identical in both — already a pure view-model.

---

## 3. `usePaymentEngine` boundary sketch

**Guiding cut:** everything that computes money, talks to the server, or builds the submit payload → engine (headless). Everything about *where the eye goes* — refs, scroll, focus, which section is open, which dialog is visible → stays in the view.

~40% is already extracted: `usePayExtraCheckout` (`:1857`), `usePaymentWorkbenchSectionState` (`:495`), the right-rail deriver, the sections deriver.

### What moves INTO the engine

```
usePaymentEngine(props)            // props = total, items, customerId/type, branchId, userId, tenantOrgId, csrf…
│
├── usePaymentForm()               // RHF: paymentMethod, discounts, promo, giftCard fields,
│      (wraps existing useForm)    //      outstandingPolicy, b2b fields, notes  → INPUT contract
│
├── usePaymentCatalog()            // server config, read-only
│      checkoutOptions / realPaymentOptions / creditMethodCodes / optionByMethodKey   [:748,1183,1193,1208]
│      cardBrands / paymentTerminals / branchPaymentTerminals                          [:707,728,740]
│      currencyConfig / decimalPlaces / moneyEpsilon                                   [:702]
│      → ADDS: isError + refetch (fixes 1.9 API-fail vs no-config)
│
├── usePaymentLegs()               // heart of the cashier flow
│      paymentLegs, activeLegIndex, activeAmountDraft                                  [:619,620,637]
│      handleMethodSelect, handleCustomerCreditSelect, upsertSettlementLeg             [:1534,1554,1388]
│      updateLeg, removeLegAt, fillLegRemaining, cycleActiveLeg, handleKeypadPress     [:1343,1334,2633,2621,3429]
│      settlementLegEntries / realPaymentEntries / editableLegEntries                  [:1648,1656,1895]
│      → ADDS: quickTender(kind) for cash chips (1.2) — pure leg math
│
├── usePaymentTotals()             // server tax/totals engine (debounced)
│      fetchPreview, serverTotals, totalsLoading, taxRate, taxProfileEntries           [:902,652,673,604,616]
│      afterDiscountsForTax, profilesTaxAmount, totals, orderValueBreakdownModel       [:1060,1113,1118]
│
├── useMoneyDerivations()          // pure selectors over legs+totals (memoized)
│      saleTotal, payNowAmount, settledNowAmount, amountAppliedToOrder                 [:1669,1679]
│      remainingBalance, displayChangeAmount, cashTenderedAmount, customerCreditAmount [:1674,1690]
│      unresolvedOverpaymentAmount (from payExtra)                                     [:1889]
│
├── useCashDrawer()                // session binding
│      cashDrawers query, cashDrawerSessionChoices, selectedCashDrawerChoice           [:764,1236,1942]
│      cashDrawerRequired, cashDrawerBlockingMessage                                   [:1929,1950]
│      handleOpenCashDrawerDialog, handleCreateCashDrawerSession, preferred-id storage [:2025,2043,1250]
│
├── useGiftCardAndPromo()          // stored-value instruments
│      promo: validating/result/applied (+handlers)                                    [:579-583]
│      giftCard: validating/result/details/applied/pin/visible/error (+handlers)       [:586-597]
│      storedValueSummary query                                                        [:801]
│
├── usePayExtraCheckout()          // ✅ ALREADY A HOOK — overpayment/allocation        [:1857]
│
├── usePaymentValidation()         // single source of "can we submit?"
│      validationItems, submitHasBlockingIssues, submitBusy                            [:2698,2832,2831]
│      hasCheckLegWithInvalidDate, creditNoteLegsMissingReference,                     [:2548,2556]
│      terminalRequiredLegs, legsMissingRequiredReference                              [:2563,2571]
│      rightRailState, requiredActionCopy, balanceStatusLabel, warningMessages         [:2833,2889,2873,3056]
│      → ADDS: needsAdvanced  ← the Simple/Full escalation trigger
│
└── usePaymentSubmit()             // payload + confirm flow
       onSubmitForm, handleConfirmPaymentSubmit, buildPaymentPayload                   [:2240,3488]
       pendingSubmission, submitConfirmOpen                                            [:625,624]
       submitButtonLabel                                                               [:3370]
```

### What STAYS in the view (Simple *or* Full)

| Stays in view | Lines |
|---|---|
| All scroll/focus refs (`amountInputRef`, section refs, `methodsAnchorRef`, card refs) | `:678–699` |
| `scrollToWorkbenchSection`, `focusAmountEditor`, `focusFirstBlockingIssue`, `scrollAndFocusTarget` | `:3135,1325,3160,2679` |
| Section expand/collapse (`usePaymentWorkbenchSectionState`) | `:495` |
| Dialog visibility toggles (cash-drawer dialog, credit-note picker, confirm-close) | `:630,635,623` |
| `isDirtySinceOpen`, `closeWithGuard` | `:622,3480` |
| i18n label maps, RTL flips | `:496` |

### Resulting contract

```ts
// One import, both faces consume it identically:
const engine = usePaymentEngine({ total, items, customerId, customerType, branchId, userId, tenantOrgId });

<PaymentModalShell open={open} onClose={onClose}>
  {engine.mode === 'simple'
    ? <PaymentSimpleView engine={engine} />
    : <PaymentFullView   engine={engine} />}
</PaymentModalShell>
```

- **Single submit contract** — `engine.submit.*` is the only path that builds the payload, so `onSubmit(paymentData, payload)` (`:3493`) can never diverge between modes.
- **State survives mode switches** — Simple→Full keeps every leg/keystroke (state lives in the engine).
- **Each sub-hook is independently unit-testable** — impossible today.

### Migration order (each step ships green, no behavior change)

1. `usePaymentValidation` + `useMoneyDerivations` (pure, zero-risk)
2. `usePaymentLegs`
3. `usePaymentTotals`
4. `useCashDrawer` / `useGiftCardAndPromo`
5. `usePaymentSubmit`

The current v4 JSX becomes `PaymentFullView` **unchanged**, just reading from `engine.*`. Only then add `PaymentSimpleView`.

---

## 4. The escalation rule

`needsAdvanced` lives in `usePaymentValidation`, `true` when **any** hold — all already computed today:

| Trigger | Source signal |
|---|---|
| More than one settlement leg | `settlementLegEntries.length > 1` (`:1648`) |
| B2B / credit invoice / AR | `isB2BCustomer` / `outstandingPolicy==='CREDIT_INVOICE'` (`:503,576`) |
| Gift card or promo applied | `appliedGiftCard` / `appliedPromoCode` (`:591,581`) |
| Overpayment needs routing | `payExtra.overpaymentNeedsResolution` (`:1891`) |
| Gift-card PIN required | `pinRequired` (`:595`) |
| Ambiguous drawer session | `cashDrawerSessionChoices.length > 1` (`:1236`) |
| FX / rounding active | `rightRailState.showCurrencyRounding` (`right-rail.ts:130`) |

Simple shows the same disclosures (`deriveVisiblePaymentSections`) — they just start collapsed and auto-open contextually instead of being a wall.

---

## 5. Before / After mockups (target shape)

### BEFORE — current v4 (single dense face, ~15 cards)

```
┌─ Payment  [Express] [BHD]                                              ✕ ┐
├──────────────┬───────────────────────────────────────┬──────────────────┤
│ PAYMENT TOOLS│ PAYMENT WORKBENCH                    7 │ RECEIPT BRAIN    │
│              │                                         │                  │
│ ┌ Methods ─┐ │ ▾ A · Balance Snapshot      [settled]  │ ┌ Customer ────┐ │
│ │ ● Cash   │ │   ┌Remain┐┌Change┐┌Due┐┌Overpaid┐      │ │ 👤 Ahmed  B2B│ │
│ │ ○ Card   │ │   │ 0.00 ││12.50 ││50 ││  0.00  │      │ └──────────────┘ │
│ │ ○ Check  │ │   └──────┘└──────┘└───┘└────────┘      │ ┌ Balance Res ─┐ │  ← Remaining
│ │ ○ Bank   │ │ ▾ B · Amount Editor · Cash             │ │ Total   50.00│ │     shown in
│ └──────────┘ │   ┌─────────────────┐  ┌ keypad ─────┐ │ │ Paid    50.00│ │     BOTH A
│ ┌ Credits ─┐ │   │     50.00       │  │ 7 8 9  ⌫    │ │ │ Remain   0.00│ │     and here
│ │ 💳 Wallet│ │   └─────────────────┘  │ 4 5 6  C    │ │ │ Change  12.50│ │
│ │ 🎁 CredNt│ │                        │ 1 2 3       │ │ │ Status: ✓    │ │
│ └──────────┘ │ ▾ C · Active Payment   (dup of A+rail) │ │ Status: ✓    │ │  ← status
│ ┌ Split ───┐ │   ┌Selected┐┌Amount┐┌After┐            │ └──────────────┘ │     TWICE
│ │ 1. Cash  │ │   │  Cash  ││50.00 ││0.00 │            │ ┌ Settlement ──┐ │
│ │ +Add     │ │ ▾ F · Cash Drawer        [bound]       │ │ Cash    50.00│ │
│ └──────────┘ │ ▸ E · Discounts & Credits              │ │ Total   50.00│ │
│              │ ▸ G · Financial Inspector            6 │ └──────────────┘ │
│              │ ▾ D · Balance Policy                   │ ┌ FINAL  50.00 ┐ │
├──────────────┴───────────────────────────────────────┴──────────────────┤
│ [ Cancel ]                    [ Charge 50.00 · Give 12.50 change ]       │
└──────────────────────────────────────────────────────────────────────────┘
  Pain: Remaining ×6 · Status ×2 · 5 of 7 sections open · no cash chips ·
        no shortcuts · collapses to 1 long column below 1280px
```

### AFTER — Simple mode (default, the 80%)

```
┌─ Payment · Order #1042 · Ahmed                          [ Advanced ▸ ]  ✕ ┐
├───────────────────────────────────────────────┬──────────────────────────┤
│  PAY                                           │  RECEIPT                 │
│                                                │  ┌──────────────────────┐│
│  Method   [ ● Cash ] [ ○ Card ] [ More ▾ ]     │  │ Total due ...... 50.00││
│                                                │  │ Paid now ....... 50.00││
│  Amount                                        │  │ ──────────────────────││
│  ┌──────────────────────────────────────────┐ │  │ CHANGE ......... 12.50││ ← one
│  │             50.00              BHD        │ │  │ ✓ Fully settled       ││   home
│  └──────────────────────────────────────────┘ │  └──────────────────────┘│   per
│                                                │   (role="status",        │   number
│  [ Exact ] [ 40 ] [ 50 ] [ 100 ]   [ ⌨ pad ]   │    aria-live="polite")    │
│   ▲ quick-tender chips (NEW 1.2)               │                          │
│                                                │  ⌨ Enter to charge        │
│  ▸ Discounts & credits                         │                          │
│  ▸ Cash drawer            (auto-opens if cash) │                          │
│  ▸ Balance policy         (auto-opens if owed) │                          │
├───────────────────────────────────────────────┴──────────────────────────┤
│ [ Cancel ]                    [ Charge 50.00 · Give 12.50 change ]  (Enter)│
└────────────────────────────────────────────────────────────────────────────┘
   1 hero number · cash in 1 tap · keyboard-first · advanced collapsed
```

### AFTER — Full mode (auto-engaged when `needsAdvanced`)

```
┌─ Payment · Order #1042 · Ahmed  [B2B]              [ ◂ Simple ]         ✕ ┐
│  ⚠ Advanced mode: split payment + credit-limit override in play          │ ← why it
├──────────────┬──────────────────────────────────┬────────────────────────┤   escalated
│  METHODS     │  WORKBENCH (only what's needed)   │  RECEIPT (same VM)     │
│  ● Cash      │  ▾ Amount + quick-tender + keypad  │  Total ........ 200.00 │
│  ● Card      │  ▾ Split legs (2)                  │  Paid now ..... 200.00 │
│  ○ …More     │     1 Cash  120.00  [fill]         │  CHANGE .......... 0.00 │
│  ┌ Credits ┐ │     2 Card   80.00  [fill]         │  ✓ Settled             │
│  │ Wallet  │ │  ▾ Cash Drawer  [Drawer-2 ▾]       │  ┌ ⚠ Action ────────┐  │ ← ONE
│  └─────────┘ │  ▸ Discounts & credits            │  │ Credit-limit over │  │   blocker
│  ┌ Legs ───┐ │  ▸ Financial Inspector  (B2B/AR)   │  │ [ Fix ]           │  │   surface
│  │ 1 Cash  │ │  ▾ Balance Policy                  │  └───────────────────┘  │   (1.7)
│  │ 2 Card  │ │                                    │  Final ........ 200.00 │
│  └─────────┘ │                                    │                        │
├──────────────┴──────────────────────────────────┴────────────────────────┤
│ [ Cancel ]                              [ Charge 200.00 ]                  │
└────────────────────────────────────────────────────────────────────────────┘
   Same engine · same submit · escalation banner explains the switch
```

---

## 6. Suggested sequencing

| Priority | Item | Effort | Payoff |
|---|---|---|---|
| 1 | Quick-tender cash chips (1.2) | S | Huge — median txn speed |
| 2 | Dedupe balance numbers + kill double status row (1.1) | S | Clarity |
| 3 | `aria-live` on Balance Result (1.4) | S | A11y compliance |
| 4 | Keyboard shortcuts / Enter-to-submit (1.3) | M | Power-user speed |
| 5 | Tablet/≤xl layout + docked CTA bar (1.5) | M | Unblocks POS hardware |
| 6 | Single blocker surface (1.7) + color discipline (1.6) | S | Less ambiguity |
| 7 | Default-collapse extra sections (1.8) | S | Shorter scroll |
| 8 | Method API error state (1.9) | S | Trust |
| 9 | Section componentization + engine extraction (3) | L | Maintainability |

---

## 7. Open decisions / next steps

1. **ADR** — record "single-engine, two-mode" decision (alternatives: two independent modals; consequences; migration steps) in `docs/features/Order_Fin/ADR/` before code.
2. **First extraction PR** — lift `usePaymentValidation` + `useMoneyDerivations` (pure, zero behavior change).

**Skill gate reminder:** before any code, load `/frontend` (and `/i18n` for quick-tender + escalation strings) per `CLAUDE.md`.

### Constraints honored

- No change to the order-payment submit payload contract or `onSubmit(paymentData, payload)`.
- v3 / enhanced-02 remain retired (`.bak`); this plan does **not** re-introduce parallel modals — it consolidates to one engine.
- All new user-facing strings must be i18n keys (EN/AR), validated via `npm run check:i18n`.