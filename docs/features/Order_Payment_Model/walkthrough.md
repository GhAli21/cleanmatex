# Payment Modal V4 Center Workbench Walkthrough

## Overview
Payment Modal V4 now follows the approved target image at `docs/features/Order_Payment_Model/new_payment_modal_v4.png`.

The redesign separates the modal into three clear responsibilities:
- Left rail: payment tools, method selection, customer credits, and payment legs.
- Center workbench: all cashier actions and editable payment work.
- Right rail: read-only receipt brain with final outcome and shortcuts.

## Center Workbench
- Section A: Balance Snapshot keeps remaining, change, and total due visible at the top.
- Section B: Amount Editor shows the active amount field and keypad only when an active pay-now leg exists.
- Section C: Payment Workspace keeps active leg details, validation fixes, method-specific fields, and required action handling.
- Section E: Discounts & Credits owns manual discounts, percent discount, promo code, gift-card code/PIN/apply/remove, and live effect.
- Section F: Cash Drawer owns drawer/session selection, open-session actions, cash retained, and change returned.
- Section G: Financial Inspector uses Cmx tabs for Order Value, Tax Breakdown, Discount Breakdown, Warnings, B2B/AR, and Payment Notes.
- Section D: Balance Policy appears last when a remaining balance needs a settlement policy.

## Receipt Brain
The right rail is intentionally compact and read-only except for jump/focus shortcuts:
- Customer
- Sticky Balance Result
- Required Action summary
- Settlement Now
- Workbench Shortcuts

## Implementation Notes
- Payment Modal V4 submits cash legs with separate `amount` and `cashTendered` values. `amount` is the portion applied to the order; `cashTendered` is the physical cash received.
- Cash change and retained overpayment behavior is driven by effective payment method configuration from `org_payment_methods_cf`, with branch-level payment method overrides applied by the payment config service where those override columns exist.
- Stored value legs, gift cards, wallets, customer credit, advances, and loyalty credit remain capped to the remaining order balance unless a configured method explicitly supports retained overpayment.
- The section order and visibility rules live in `payment-modal-v04-sections-definition.ts`.
- New EN/AR keys were added under `newOrder.payment.sections`.
- The old right-rail edit surfaces were moved into the center to reduce scrolling and avoid duplicate cashier work areas.

## Validation
- Typecheck passed.
- i18n parity passed.
- Targeted payment modal Jest tests passed.
- Focused ESLint passed.
- Production build passed.
