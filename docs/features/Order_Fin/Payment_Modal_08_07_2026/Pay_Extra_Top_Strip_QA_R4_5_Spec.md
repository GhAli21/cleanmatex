# Pay-Extra Top Strip + Hard Overpayment Gate (QA-R4.5 / strangler 4g)

**Status:** DONE (2026-07-10)  
**Parent:** [Payment_Modal_Implementation_STATUS.md](./Payment_Modal_Implementation_STATUS.md) · [Manual_QA_Checklist.md](./Manual_QA_Checklist.md)  
**Naming:** **QA-R4.5** = approved design in checklist “QA round 4 findings §4.5”. Do **not** confuse with checklist **table row 4.5** (“Generic errors”).

## Goal

1. Move **Customer is paying extra** to a clear **top strip** under the dialog header.
2. **Hard gate:** non-cash retained overpay is impossible while the toggle is OFF (even if method `supports_overpayment`), with amber inline explanation when capped.
3. Toggle ON requires `orders:overpayment_allocate` (`aria-disabled` + name+code message).
4. Toggle OFF blocked while excess > ε (no silent money rewrite).
5. Cash over-tender (change) remains exempt.

## Layout order

`Header (title + Simple/Advanced) → PayExtraTopStrip → mode banners → body`

Strip is shared chrome (visible in Simple and Advanced). Amber while extra unresolved; emerald when resolved; never red.

## Engine rule

```ts
resolveSupportsRetainedOverpayment({ payExtraIntent, policy }) =>
  payExtraIntent &&
  (policy.isCash ? policy.supportsChangeReturn : policy.supportsOverpayment)
```

When intent OFF → `deriveLegAppliedAmount` always caps non-cash to remaining.

**Cash change:** tendered/change via `deriveCashTenderedAmount` + `supports_change_return` without toggle.

### Call-site checklist (must use helper)

- `use-payment-legs.ts` — updateLeg / upsertSettlementLeg / addLeg
- `use-payment-engine.ts` — keypad + `notifyIfLegAmountCapped` (non-cash branch)
- `payment-full-view.tsx` — amount editor
- `use-money-derivations.ts` — cash change capacity always order-capped applied (`supportsOverpayment: false`); retained path uses checkout excess when intent ON
- Collect Payment amount onChange
- Split tender — via `updateLeg` only; surface cap hint in dialog

**Safe as-is:** `fillLegRemaining`, `quickTender` (false), `reconcilePaymentLegAmounts` (totals-change exception to money rule).

## RBAC

| State | Control | Message |
|-------|---------|---------|
| No method allows retained overpay/cash-change | native `disabled` | `disabledNoMethods` |
| Methods allow, missing allocate | `ariaDisabled` | `permissionRequired` (static name + `orders:overpayment_allocate`) |
| Methods + allocate | enabled | — |
| ON + excess > ε, try OFF | `ariaDisabled` | `cannotDisableWhileExtra` |
| ON + excess ≤ ε | can OFF | — |

Static i18n mirrors DB: EN “Allocate Overpayment to Balances” / AR “توزيع فائض الدفع على الأرصدة”.

Access action: `payExtraIntentEnable` (distinct from `payExtraAllocateOverpayment`).

## Legacy ExtraReceiptHandlingCard

Show only when `!payExtraIntent && excess > ε` (stuck excess). Intentional path = strip ON → Validate → dialog. Never auto-reduce legs.

## Server trust model

UI toggle is **not** a security boundary (no `payExtraIntent` in payload this slice). Server: `METHOD_OVERPAYMENT_NOT_ALLOWED` + `OVERPAYMENT_RESOLUTION_*` + disposition perms.

## Epsilon

UI gates use engine `moneyEpsilon`. Server uses `SETTLEMENT_MONEY_EPSILON` (0.001). Pass `moneyEpsilon` into Collect’s `usePayExtraCheckout`.

## Money rule (CLAUDE.md #15)

Cap on amount edit when intent OFF + amber explain. Never rewrite money on toggle/mode/dialog close — block OFF. Totals reconcile is the documented exception.

## Test matrix

- Toggle OFF + card supports_overpayment → capped + amber
- Toggle ON + allocate → uncapped retained path
- Cash over-tender OFF → change, no toggle required
- Permission click → name+code; state stays OFF
- OFF while extra → blocked; amounts unchanged
- Collect / Simple / Split parity
- Oracle: non-overpay payloads unchanged; capped-at-remaining fixture
