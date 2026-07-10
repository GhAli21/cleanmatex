---
title: No Silent Money Mutation
last_updated: 2026-07-10
owner: CleanMateX Team
---

# No Silent Money Mutation

This document is the canonical source of truth for the repo-wide rule
previously referenced as CRITICAL RULE #15 in `CLAUDE.md` and `AGENTS.md`.

## Rule

The system must never auto-change a user-editable amount or money field unless
that adjustment is an explicit, documented, user-expected default of the field.

Example of an allowed default:

- Cash tendered derives change returned.

## Required order of behavior

1. **Prevent** invalid entry first.
   Gate the capability or disable the affordance with a clear reason that tells
   the user what is blocked, why, and how to proceed.
   When permission-gated, include the permission name and code.
2. **Explain** any unavoidable adjustment inline at the moment it happens.
   If a cap, rounding rule, reconciliation, or default derivation is applied,
   surface that explanation exactly where and when it occurs.
3. **Never rewrite money as a side effect** of a toggle, mode switch, dialog
   close, or state transition.
   If a transition would require changing money the user typed, block that
   transition with guidance instead.

## Allowed

- Read-only derived totals, balances, and change values.
- Inline-capped or adjusted values only when the adjustment is explicit,
  documented, user-expected, and explained at the moment it occurs.
- Read-only mirrors of user-entered amounts.

## Forbidden

- Silent capping, snapping, or rebalancing of typed amounts.
- Flipping user money intent controls automatically.
- Rewriting money when changing mode, closing a dialog, or toggling a setting.
- Any money mutation triggered by something other than direct user editing of
  that field, unless it is a documented default and is explained inline.

## Scope

Apply this rule anywhere a user can enter, confirm, or interpret money:

- Payment entry and settlement flows
- Order totals and adjustments
- Discounts, promo codes, and surcharge flows
- Wallet, advance, stored value, and credit application
- Refunds, vouchers, and disposition flows
- Any UI that surfaces `DECIMAL(19,4)` values as editable or confirmable money

## Implementation guidance

### Frontend and UX

- Prefer blocking or disabling invalid actions over auto-correcting money.
- Keep explanations inline near the edited field or blocked action.
- When permission-gated, use a clear message that includes the permission name
  and code.
- Preserve user-entered values across mode switches whenever possible.

### Business logic and backend

- Do not silently normalize or mutate requested money values after receipt.
- Return explicit validation or business-rule responses when entered values are
  not allowed.
- Keep canonical totals distinct from editable UI amounts.

### Testing and review

Add tests and review checks for:

- No silent rewriting of entered money
- Blocked transitions when a mode/toggle change would require money rewrite
- Inline explanation when an allowed adjustment or cap occurs
- Permission-gated money actions showing permission name + code

## Origin

This rule was formalized during the Payment Modal composable-capabilities
program and QA round 4 on 2026-07-10.

Related docs:

- `CLAUDE.md` CRITICAL RULE #15
- `AGENTS.md` CRITICAL RULE #15
- `.cursor/rules/no-silent-money-mutation.mdc`
- `docs/features/Order_Fin/Payment_Modal_08_07_2026/Manual_QA_Checklist.md`
