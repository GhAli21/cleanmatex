# Pay-Extra Overpayment — Cashier User Guide

**Feature:** ADR-050 Global Pay-Extra Intent  
**Audience:** Front-desk / POS cashiers  
**Surfaces:** Payment Modal V4, Collect Payment modal

---

## When to use

Turn on **Customer is paying extra** when the customer intentionally pays more than the order total (across one or more payment methods). Examples:

- Cash + card combined over the order total
- Cash tendered above the applied cash leg amount
- Card/mobile leg with a method that allows retained overpayment

When the toggle is **off**, checkout behaves exactly as before (cash change auto-resolves excess where allowed).

---

## Workflow

1. Enter payment leg amounts (and cash tendered if applicable).
2. Turn on **Customer is paying extra**.
3. Click **Validate payment**.
4. If there is extra to route, the **Extra Receipt** dialog opens — pick **one** destination for the full extra amount:
   - Adjust payment amounts (go back and reduce legs)
   - Return as cash change
   - Auto / manual allocate to open balances (linked customer, permission required)
   - Save as customer advance / credit / wallet (linked customer + permission)
5. Confirm in the dialog, then submit the order or collection.

Submit is blocked until validation completes and a destination is chosen when excess remains.

---

## Permissions

| Action | Permission |
|--------|------------|
| Allocate to balances | `orders:overpayment_allocate` |
| Advance / credit dispose | `orders:overpayment_dispose` |
| Wallet top-up | `orders:overpayment_to_wallet` |

---

## Walk-in customers

Without a linked customer, wallet/advance/credit/allocation options are hidden. Reduce payment amounts or return cash change.

---

## Walkthrough — Cash + card overpay → wallet (demo)

Use tenant [https://cmx.cleanmatex.com/](https://cmx.cleanmatex.com/) after migration `0368` is applied.

| Step | Action |
|------|--------|
| 1 | **Dashboard → Orders → New order** — add line items (e.g. total **10.000 OMR**). |
| 2 | Attach a **registered customer** (wallet option requires linked customer). |
| 3 | Proceed to checkout → open **Payment** modal. |
| 4 | Add **two pay-now legs**: Card **6.000**, Cash **6.000** (methods must allow retained overpayment or cash change). |
| 5 | In **center workbench**, below the balance snapshot cards, turn on **Customer is paying extra**. |
| 6 | Click **Validate payment** (appears directly under the toggle). |
| 7 | Extra Receipt dialog → **Add to customer wallet** → **Confirm**. |
| 8 | **Submit** order. |
| 9 | Verify wallet balance increased by excess (**2.000** in example). |

**Collect Payment modal:** same toggle + Validate under amount fields when collecting on an existing order.

---

## Related docs

- ADR-050: `docs/features/Order_Fin/ADR/ADR-050-Global-Pay-Extra-Intent.md`
- Test scenarios 36–45: `docs/features/Order_Payment_Model/test_guide.md`
- Walkthrough: `docs/features/Order_Payment_Model/walkthrough.md`
