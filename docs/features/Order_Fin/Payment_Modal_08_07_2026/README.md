# Payment Modal — Amendment Alignment Program (08-07-2026)

**Goal.** Align the shipped Payment Modal v4 code with the amended ADR
[`ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md)
(amended 2026-07-08): **user-controlled Simple/Full**, complications resolved by
**in-Simple dialogs and guards**, `computeNeedsAdvanced` **demoted** from
`force + lock` to a **dismissible suggestion**, and a narrow **restricted** class
that may require Full or an approval gate.

The engine, the single submit contract, and the payload are **frozen** throughout.
This program changes *who controls the view* and *how complications surface* — not
what gets submitted.

## Documents in this folder

| Doc | Purpose |
|-----|---------|
| [`Implementation_Plan.md`](./Implementation_Plan.md) | The phased program: current-state inventory, guardrails, per-phase tasks, condition→handling map, test plan, rollout, risks. |
| [`STATUS.md`](./STATUS.md) | Live progress tracker — one row per phase, updated at each phase close. |

## Source of truth

1. **ADR** — [`../ADR/ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md) (the decision)
2. **Engine architecture** — [`../Payment_Modal_v4_Engine_Architecture.md`](../Payment_Modal_v4_Engine_Architecture.md) (the current shape)
3. **This plan** — the execution path from current code to ADR-aligned behavior

## One-line summary of the change

> Simple stays selected by default. Split, gift card/promo, apply-credit, drawer
> choice, and overpayment routing become **buttons that open focused dialogs**.
> Drawer-blocked becomes a **submit guard**. B2B account-billing and other
> restricted actions become **required dialogs / approval gates**. Auto-escalation
> and the Simple lock are removed; `needsAdvanced` survives only as a dismissible
> suggestion.
