# Payment Modal V4 Center Workbench Walkthrough

Last updated: 2026-06-11

## Overview

Payment Modal V4 follows the approved target image at `docs/features/Order_Payment_Model/new_payment_modal_v4.png`.

The redesign separates the modal into three clear responsibilities:

- **Left rail:** payment tools, method selection, customer credits, and payment legs.
- **Center workbench:** all cashier actions and editable payment work.
- **Right rail:** read-only receipt brain with final outcome and shortcuts.

## Center Workbench

- **Section A — Balance Snapshot:** remaining, change, and total due visible at the top.
- **Section B — Amount Editor:** active amount field and keypad when an active pay-now leg exists.
- **Section C — Payment Workspace:** active leg details, validation fixes, method-specific fields (card brand, check number/date, bank reference, gateway refs, **payment terminal**, **credit note selection**), and required-action handling.
- **Section E — Discounts & Credits:** manual discounts, promo code, gift-card code/PIN/apply/remove.
- **Section F — Cash Drawer:** drawer/session selection, open-session actions, cash retained, change returned.
- **Section G — Financial Inspector:** Cmx tabs for Order Value (tax skeleton until preview loads), Tax Breakdown, Discount Breakdown, Warnings, B2B/AR, Payment Notes.
- **Section D — Balance Policy:** appears when a remaining balance needs a settlement policy.

## Customer Credits (left rail)

| Method | Behavior |
|--------|----------|
| WALLET | Live balance from stored-value summary; refresh button; capped to balance and remaining due |
| ADVANCE | Uses advance balance from stored-value summary |
| CREDIT_NOTE | Opens credit-note picker dialog; leg stores `creditReferenceId`; amount capped to note balance |
| LOYALTY_POINTS | Uses option `available_balance` |
| Other credits with `requires_credit_reference_selection` | Hint shown; selection flow TBD per method |

## Receipt Brain

The right rail is compact and read-only except for jump/focus shortcuts:

- Customer
- Sticky Balance Result
- Required Action summary
- Settlement Now
- Workbench Shortcuts

## Implementation Notes

### Money and policy

- Cash legs submit separate `amount` (applied) and `cashTendered` (physical cash).
- Change and overpayment behavior comes from `org_payment_methods_cf` flags, resolved via payment config services.
- **Multi-cash:** all cash legs must allow change for aggregate change display; otherwise excess is unresolved overpayment.
- Stored-value legs are capped via `getStoredValueCapForLeg()` unless the method explicitly supports retained overpayment (non-cash only).

### Submit flow

1. Modal validates locally (references, check date, terminal, stored-value balance, credit note, overpayment).
2. Hook builds create/edit payload; maps server `errorCode` to EN/AR messages.
3. Orchestrator computes unpaid balance (including gift-card credit before NONE check).
4. Planner validates settlement plan; voucher lines and cash drawer wiring persist applied amounts and change.

### Checkout options

- Query uses `checkoutEligibilityAmount = preview saleTotal ?? checkoutAmount ?? subtotal`.
- Retail-only orders exclude `INVOICE` and `PAY_ON_COLLECTION` from real payment methods.

### Key files

| Concern | File |
|---------|------|
| Modal UI | `web-admin/src/features/orders/ui/payment-modal-v4.tsx` |
| Utils / caps / change | `web-admin/src/features/orders/ui/payment-modal-v4.utils.ts` |
| Credit note picker | `web-admin/src/features/orders/ui/payment-modal-v4-credit-note-picker.tsx` |
| Right rail state | `web-admin/src/features/orders/ui/payment-modal-v4.right-rail.ts` |
| Section visibility | `web-admin/src/features/orders/ui/payment-modal-v04-sections-definition.ts` |
| Submit hook | `web-admin/src/features/orders/hooks/use-order-submission.ts` |
| Payload schema | `web-admin/lib/validations/new-order-payment-schemas.ts` |
| Orchestrator | `web-admin/lib/services/order-submit-orchestrator.service.ts` |
| Planner | `web-admin/lib/services/order-settlement-planner.service.ts` |

### i18n

New keys under `newOrder.payment` include:

- `customerCredits.creditNotePicker*`, `creditNoteRequired`, `storedValueBalanceExceeded`
- `splitPayment.paymentTerminal*`, `validation.terminalRequired*`
- `errors.outstandingPolicyRequired`, `paymentTerminalRequired`, etc. (EN + AR)

## Validation

See [test_guide.md](./test_guide.md) for the current automated and manual QA checklist.
