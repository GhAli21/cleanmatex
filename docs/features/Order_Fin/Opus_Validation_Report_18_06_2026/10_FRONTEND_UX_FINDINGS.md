# 10 — Frontend / UX Findings

## Verified correct

- **Right-panel summary labels** (the brief's required vocabulary) all exist in `messages/en.json`:
  - `realPaymentsReceived` = "Real Payments Received" (5492)
  - `creditsApplied` = "Credits / Stored Value Applied" (5493)
  - `totalSettledNow` = "Total Settled Now" (5487)
  - `remainingBalance` = "Remaining Balance" (5488)
  - `overpaidAmount` = "Overpaid Amount" (5489)
  - `extraReceipt.title` = "Extra Receipt Handling" (5230-5231)
  No "Paid" used where it should read "Settled / Received / Credit applied". ✅
- **Real payment vs credit separation in UI:** gift card / wallet / customer credit are presented as **resolution modes / credit applications**, never as real payment methods. `extra-receipt-handling-card.tsx` offers `adjust_legs`, `RETURN_CASH_CHANGE` (cash-only via `canReturnCashChange`), auto/manual allocate, save-to-advance, save-to-wallet, save-to-credit. ✅
- **Cmx components only** (CmxCard/CmxButton/etc.); RTL handled (`isRTL` → text alignment, `items-end`); EN/AR keys under `newOrder.payment.extraReceipt.*`. ✅
- **RBAC-aware UI:** action buttons gated by `canAllocate / canSaveAdvance / canSaveWallet / canSaveCredit / canReturnCashChange` props. ✅
- **Walk-in handling:** stored-value destinations hidden when `!hasLinkedCustomer`; walk-in hint shown. ✅

## Findings

### UX-01 (🟡, ties to F-03) — No feature-flag gating in the UI
ADR-047 said `overpayment_disposition_v1` should gate the disposition panel; the flag is not referenced in the payment-modal V4 components. The Extra Receipt card renders purely on `excessAmount > 0` + RBAC. **Impact:** no per-tenant staged rollout / kill-switch from the UI side either. **Fix:** gate the panel on the consumed feature flag, or retire the flag requirement (decide with product).

### UX-02 (🔵) — "Save to Wallet" was a live-failing button pre-0378
Until `0378` (now applied), selecting Save-to-Wallet produced a backend 500. **Now resolved.** Confirm via manual QA that the button completes end-to-end (wallet credited, `overpaid_amount` shows 0, receipt reflects it).

### UX-03 (❓ not verified) — Areas not inspected this pass
The following were **not** opened in this pass and should be reviewed for the "UI can't expose broken backend" criterion:
- `order-collect-payment-modal.tsx` (later-collection path) — does it surface the same overpayment/allocation UX and error codes?
- `auto-allocation-preview-drawer.tsx` / `manual-allocation-drawer.tsx` — preview-before-post UX, "submit disabled until remainingUnallocated=0".
- Order detail financial view (`order-details-full-client.tsx`) — does it render canonical fields (AR receivable vs pay-on-collection vs overpaid) without conflating?
- AR/B2B customer balance displays; wallet/gift/advance/credit balance widgets.
- Mobile/responsive + Arabic RTL of the allocation drawers.
**To verify:** open these components and confirm labels, disabled-submit guards, and EN/AR parity (`npm run check:i18n`).

## UX strengths worth keeping

- Labels distinguish **Extra Receipt / Unallocated** from **Change** (only shown when `RETURN_CASH_CHANGE` applies) — prevents the classic "where did the money go" confusion for cashiers and support.
- The card prevents mistakes **before** submit (forces an explicit destination) rather than only erroring after — satisfies the brief's "UI prevents mistakes instead of only showing errors after submit" for the overpayment path.
