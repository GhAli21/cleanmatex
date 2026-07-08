# ADR — Payment Modal: Single Engine with User-Controlled Simple / Full Views

- **Status:** Amended (2026-07-08) — originally Accepted (2026-06-27)
- **Area:** Order Financial Platform — `web-admin` checkout / payment
- **Supersedes:** ad-hoc parallel payment modals (v3, enhanced-02 — retired to `.bak`)
- **Related:** `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_UX_Review_and_Engine_Plan.md`

> **2026-07-08 amendment (summary).** The engine/views split and the single submit
> contract are unchanged and remain the accepted decision. What changed is **who
> controls the view** and **how complications are handled**. The modal no longer
> auto-escalates and locks the cashier into Full. Simple is the default, stays
> selected, and resolves complications through **focused dialogs launched from
> buttons**. Full is a **user-chosen** power view (one toggle): it is **never
> forced for routine cashier actions** and **never locks** the cashier out of
> Simple. Full (or a required dialog / approval gate) may still be required for a
> narrow, separately-defined class of **restricted** transactions — see
> [When Full or an approval gate may still be required](#when-full-or-an-approval-gate-may-still-be-required-normative).
> `computeNeedsAdvanced` is retained but demoted from a hard *force + lock* to a
> **dismissible suggestion**. See
> [Amendment rationale (2026-07-08)](#amendment-rationale-2026-07-08).

## Context

`web-admin/src/features/orders/ui/payment-modal-v4.tsx` is a single 5,886-line component that owns payment methods, order totals, tax, legs, cash drawer, gift card, promo, overpayment allocation, B2B credit, validation, the submit payload, and all JSX. It is functionally correct but:

- **Untestable in isolation** — business logic is entangled with JSX; no unit seams.
- **High-altitude UX** — built as a finance-analyst console, while ~80% of real usage is "take cash → give change → submit."
- A team instinct surfaced to build a **second, simpler modal** for the common case.

History matters: two earlier parallel payment modals (`payment-modal-v3`, `payment-modal-enhanced-02`) were retired to `*.tsx.bak` on 2026-06-25 because maintaining parallel modals — each with its own copy of finance logic — became a burden and a drift risk.

## Decision

Adopt **one headless engine, two views**:

- `usePaymentEngine()` — the single source of truth for all payment state, derivations, validation, and the submit payload. Composed from focused sub-hooks (`use-payment-catalog`, `use-gift-card-and-promo`, `use-payment-totals`, `use-payment-legs`, `use-cash-drawer`, `use-payment-submit`, `use-money-derivations`, `use-payment-validation`) plus the existing `usePayExtraCheckout`.
- `PaymentFullView` — the current full workbench, rendered verbatim from `engine.*`.
- `PaymentSimpleView` — a streamlined cash/card view for the common case, extended with **buttons that launch focused dialogs** for each complication (split, apply credit, gift card/promo, drawer selection, overpayment routing).
- One modal shell selects the view by `mode`. **Default Simple; the user controls the view.** Full is reached by an always-available toggle. The engine **never forces the view for routine cashier actions** and **never locks** the cashier out of Simple. The only exception is the narrow, separately-defined **restricted** class below, where Full or a required dialog / approval gate may be mandated to protect accounting controls.

We explicitly **reject** building two independent modals.

## Complication handling (normative)

The modal opens in **Simple** and **stays in Simple** unless the user chooses Full.
Complications are resolved **in place** — a button in Simple launches a focused
dialog for the one decision that complication requires. The view is not replaced.

**Guiding principle**

> A **routine** complication is a **decision**, and a decision is a **dialog** —
> not a mode. Simple is the default and stays selected. Full is a **user-chosen**
> power view (one toggle), never forced for routine actions, never locked. The
> engine surfaces routine complications as **available actions and guards**, not
> as a mode switch. A separate, narrow class of **restricted** transactions may
> require Full or an approval gate — this is not "escalation for complexity," it
> is an accounting-control requirement.

**Be flexible in implementation — one or more of these conditions may change,
be disabled, or be re-mapped in the future. The mapping below is the intent,
not a frozen switch statement.**

| # | Condition | Handling in Simple |
|---|-----------|--------------------|
| 1 | More than one settlement leg (split payment) | **Split** button → legs editor dialog (this is "cash **and** card"). |
| 2 | Customer advance / stored credit applied | **Apply credit** button → available-balance dialog, applies one leg. |
| 4 | Gift card or promo code applied | **Add gift card / promo** button → dialog. |
| 6 | Gift-card PIN required | PIN field **inside** the gift-card dialog — not a top-level condition. |
| 7 | Ambiguous cash-drawer session (>1 open) | **Drawer selector** (dialog/select) — the cashier chooses. |
| 5 | Overpayment needs routing (`payExtra.overpaymentNeedsResolution`) | **"Handle extra"** dialog — change / store as credit / tip. |
| 9 | FX / rounding active (rate ≠ 1 or non-zero rounding) | Read-only line in Simple; dialog **only** if the rate is editable. |
| 3 | B2B credit-invoice / AR policy (`outstandingPolicy === 'CREDIT_INVOICE'` or B2B customer) | **B2B pay-now** finishes in Simple. **B2B account billing** stays in Simple **only when all required contract fields are already resolved**; when a PO number, cost center, department, credit approval, or invoice allocation is required and missing, a **required dialog** (or Full) must capture it before submit. Otherwise a **non-blocking suggestion** to open Full. |
| 8 | Cash-drawer blocking message present | **Submit guard**, not a mode — blocks submit with the message; switching to Full does not unblock it. |

Notes:

- **#6 (PIN)** and **#8 (drawer blocked)** were never modes. #6 is a sub-field of
  the gift-card dialog; #8 is a submit guard. The prior ADR mis-classified both
  as escalation reasons.
- **#3 (B2B)** is not a blanket reason to force Full. B2B **pay-now** can finish in
  Simple. B2B **account billing** may require a dialog, approval gate, or Full **only
  when** required contract / accounting fields (PO number, cost center, department,
  credit approval, invoice allocation) are missing.

**`computeNeedsAdvanced` is retained, demoted.** The pure predicate, its stable
reason codes (`NEEDS_ADVANCED_REASON`), and its unit tests stay. Its **consequence**
changes: instead of forcing Full and locking Simple, it drives a **dismissible
suggestion** ("This order is complex — open Full?") and decides **which buttons /
guards appear** in Simple. Reason codes remain the single, testable source of the
"why is this complex" message.

Exact-cash or a single card swipe with none of the above **stays Simple** and shows
no suggestion.

### When Full or an approval gate may still be required (normative)

The nine conditions above are **routine** and are never a reason to force the view.
Separately from them, a **narrow, explicitly-enumerated** class of transactions may
legitimately require Full **or a required approval/allocation dialog** before submit
— not because they are "complex," but because Simple cannot safely capture the
required information or authority. This exists to protect accounting controls; it is
**not** a re-introduction of complexity-based auto-escalation.

Candidates for this restricted class (subject to the same "be flexible" caveat):

- Credit-limit **override** beyond the customer's approved limit.
- **Manual FX rate** entry (as opposed to a system rate merely being displayed).
- **Restricted overpayment routing** that Simple's "handle extra" dialog does not cover.
- **Refund / reversal** of a captured payment.
- **B2B account billing** missing required contract fields (PO number, cost center,
  department, credit approval, invoice allocation) — see condition 3.
- **Gateway investigation** / disputed or held authorization.
- **Audit exception** paths that require an explicit, logged approval.

For this class the requirement is expressed as a **guard or required dialog** tied to
that specific action — with an **explicit, auditable reason** — never as a blanket
"this order looks complicated, go to Full." Where a manager/approval role is needed,
the guard enforces the permission; it does not silently switch modes.

## Consequences

**Positive**
- Single submit contract — `onSubmit(paymentData, payload)` can never diverge between modes.
- State survives mode switches (engine owns state, not the views).
- Each sub-hook is independently unit-testable — impossible today.
- No logic fork; the `.bak` maintenance trap is not repeated.
- The input values (like a partially typed amount in the keypad) must also survive the mode switch. If a user types "50" in Simple mode, and then clicks "Advanced" to split the payment, that "50" must persist in the Full view. The same guarantee applies to values entered in a Simple dialog before it is committed.
- Normal cashier actions (split, gift card, drawer choice) no longer eject the cashier from the fast path into a finance-analyst console.

**Negative / risks**
- Large refactor of payment-critical code → mitigated by **engine-first, zero-behavior-change** extraction, a **baseline payload fixtures** regression oracle, and incremental dependency-ordered sub-phases (each green before the next).
- Hooks are a **param-threaded dependency graph**, not a clean layered stack (e.g. totals reads applied promo/gift card) — the engine wires them in dependency order.
- Simple now hosts several dialogs; each is a small surface but they must all round-trip through the same engine state (no dialog-local finance logic) to preserve the single-contract guarantee.

**Constraints**
- No payload-contract change. Behavior freeze through extraction + UX phases.
- `usePayExtraCheckout` is shared with `order-collect-payment-modal.tsx`; extraction must not regress Collect Payment.
- Dialogs read and write **engine state only** — no complication may be resolved with logic that lives outside the engine.

## Amendment rationale (2026-07-08)

The 2026-06-27 decision auto-escalated to Full and **locked** the cashier out of
Simple whenever any of nine conditions held. In practice this fired for **routine
cashier actions** — splitting between cash and card, applying a gift card, or
merely having more than one open drawer to choose from. The result was that the
"80% common case" fast path was abandoned the moment anything slightly non-trivial
happened, dropping the cashier into a finance-analyst console to perform what is a
single, well-scoped decision.

The objections that drove the change:

- **Splitting cash + card is common, not advanced.** It is the second most frequent
  checkout after exact cash; it deserves a button, not a mode change.
- **Choosing a drawer or entering a PIN is a prompt, not a workbench.** Forcing the
  full view to pick one item from a list, or to type a PIN, is disproportionate.
- **A blocking drawer message is an error guard, not complexity.** Switching to Full
  does not unblock the drawer, so escalation there is meaningless.
- **Locking the user out of Simple removes agency.** The cashier, not the engine,
  should decide which view to work in.

The fix preserves everything the original ADR got right — one engine, one submit
contract, state survival, no `.bak` fork — and changes only **who controls the
view** (the user) and **how complications surface** (dialogs and guards, plus a
demoted, dismissible suggestion). No submit-contract or engine-boundary change is
implied.

## Alternatives considered

1. **Two independent modals (rejected).** Forks finance logic; proven maintenance burden (`.bak` history); state hand-off problem on escalation.
2. **Keep the monolith, add progressive disclosure only (rejected as insufficient).** Improves UX but leaves the code untestable and the Simple path still paying full-console cost.
3. **Full rewrite (rejected).** Unacceptable risk for payment-critical code; no regression oracle.
4. **Auto-escalate and lock into Full (rejected — was the 2026-06-27 decision, now amended).** Ejects the cashier from the fast path for routine actions and removes the user's control over the view. Replaced by user-controlled mode + in-Simple dialogs + a demoted suggestion.

## Migration order

Phase 0 (ADR + payload fixtures) → Phase 1 (pure derivations + validation) → Phase 2A–2G (catalog → gift/promo → totals → legs → cash drawer → submit → engine+Full-view split) → Phase 3 (Full-view UX) → Phase 4 (Simple mode + dialogs + suggestion/guards) → Phase 5 (keyboard) → Phase 6 (responsive) → Phase 7 (docs). See the program plan for per-phase detail and the per-step closeout.

> **Terminology note.** The historical Phase 4 was named "Simple mode + escalation."
> It is renamed here to "Simple mode + dialogs + suggestion/guards" to match this
> amendment. The word "escalation" is deliberately avoided so the implementation is
> not misread as re-introducing auto-escalation.

> **Follow-up (post-amendment).** The shipped implementation (`payment-full-view.tsx`,
> `payment-mode-toggle.tsx`, engine wiring, `payment-needs-advanced.ts` call sites)
> still auto-escalates and locks per the 2026-06-27 behavior. Aligning the code with
> this amendment — user-controlled mode, in-Simple dialogs, demoted suggestion, #6
> folded into the gift-card dialog, #8 as a submit guard — is tracked as a separate
> implementation program and is **not** yet done.
