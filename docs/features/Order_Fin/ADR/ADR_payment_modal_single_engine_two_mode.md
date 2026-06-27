# ADR — Payment Modal: Single Headless Engine, Two Views (Simple / Full)

- **Status:** Accepted (2026-06-27)
- **Area:** Order Financial Platform — `web-admin` checkout / payment
- **Supersedes:** ad-hoc parallel payment modals (v3, enhanced-02 — retired to `.bak`)
- **Related:** `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_UX_Review_and_Engine_Plan.md`

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
- `PaymentSimpleView` — a streamlined cash/card view for the common case.
- One modal shell selects the view by `mode`. **Default Simple; auto-escalate to Full** when complexity is detected.

We explicitly **reject** building two independent modals.

## `needsAdvanced` — escalation conditions (normative)

Open in **Simple**; flip to **Full** (and block manual return to Simple) when **any** hold:

**Be Flexible in implementation because maybe one or more of this conditions maybe change or disabled in the future**

1. More than one settlement leg (split payment).
2. A customer advance / stored credit is being applied.
3. B2B credit-invoice / AR policy (`outstandingPolicy === 'CREDIT_INVOICE'` or B2B customer).
4. A gift card or promo code is applied.
5. Overpayment needs routing (`payExtra.overpaymentNeedsResolution`).
6. Gift-card PIN is required.
7. Ambiguous cash-drawer session (more than one open session to choose from).
8. A cash-drawer blocking message is present.
9. FX / rounding is active (exchange rate ≠ 1 or non-zero rounding).

Exact-cash or a single card swipe with none of the above **stays Simple**.
Manual escalation to Full mode is always permitted via a toggle button, but returning to Simple mode is disabled if any needsAdvanced conditions are met.

## Consequences

**Positive**
- Single submit contract — `onSubmit(paymentData, payload)` can never diverge between modes.
- State survives mode switches (engine owns state, not the views).
- Each sub-hook is independently unit-testable — impossible today.
- No logic fork; the `.bak` maintenance trap is not repeated.
- The input values (like a partially typed amount in the keypad) must also survive the mode switch. If a user types "50" in Simple mode, and then clicks "Advanced" to split the payment, that "50" must persist in the Full view.

**Negative / risks**
- Large refactor of payment-critical code → mitigated by **engine-first, zero-behavior-change** extraction, a **baseline payload fixtures** regression oracle, and incremental dependency-ordered sub-phases (each green before the next).
- Hooks are a **param-threaded dependency graph**, not a clean layered stack (e.g. totals reads applied promo/gift card) — the engine wires them in dependency order.

**Constraints**
- No payload-contract change. Behavior freeze through extraction + UX phases.
- `usePayExtraCheckout` is shared with `order-collect-payment-modal.tsx`; extraction must not regress Collect Payment.

## Alternatives considered

1. **Two independent modals (rejected).** Forks finance logic; proven maintenance burden (`.bak` history); state hand-off problem on escalation.
2. **Keep the monolith, add progressive disclosure only (rejected as insufficient).** Improves UX but leaves the code untestable and the Simple path still paying full-console cost.
3. **Full rewrite (rejected).** Unacceptable risk for payment-critical code; no regression oracle.

## Migration order

Phase 0 (ADR + payload fixtures) → Phase 1 (pure derivations + validation) → Phase 2A–2G (catalog → gift/promo → totals → legs → cash drawer → submit → engine+Full-view split) → Phase 3 (Full-view UX) → Phase 4 (Simple mode + escalation) → Phase 5 (keyboard) → Phase 6 (responsive) → Phase 7 (docs). See the program plan for per-phase detail and the per-step closeout.
