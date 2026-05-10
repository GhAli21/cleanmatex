# Gift Cards — Core Concept

Gift cards are stored-value liability instruments, not commercial discounts.

---

## Stored-Value Model

A gift card holds its own balance. Every transaction is a balance movement.

**When sold/issued:**
- Customer pays face value (e.g., 10.000 OMR)
- Gift card balance = 10.000 OMR
- Accounting: Dr Cash/Card → Cr Gift Card Liability

**When redeemed on an order:**
- Order total (post-tax): 3.591 OMR
- Gift card applied: 0.050 OMR
- Customer card payment: 3.541 OMR
- Gift card balance reduces by 0.050 OMR

The gift card affects **amount due**, not the taxable discount base.

---

## Calculation Rule

```
commercialDiscount = manual + rule + promo
taxableBase        = subtotal - commercialDiscount
vat                = taxableBase × vatRate
invoiceAmount      = taxableBase + vat + otherTax
amountDue          = invoiceAmount - giftCardApplied   ← post-tax
```

Gift card is applied **after VAT** — it reduces what the customer owes, not what is taxed.

---

## VAT Treatment

General-purpose gift cards are **multi-purpose vouchers**. VAT is collected on redemption, not on sale:

| Event | VAT |
|---|---|
| Gift card sale | No VAT — liability only |
| Gift card redemption | VAT applies to the underlying laundry service |

The gift card reduces the amount due after VAT has been calculated. It does not alter the VAT base.

> Exception: single-purpose vouchers where the exact taxable service is known at issue time may require VAT at sale in some jurisdictions. This is a V2 tenant setting (`gift_card_vat_on_issue`).

---

## Accounting Treatment

| Event | Debit | Credit |
|---|---|---|
| Gift card sale | Cash / Card Received | Gift Card Liability |
| Promotional / goodwill issue | Marketing Expense | Gift Card Liability |
| Corporate issue | Corporate Receivable | Gift Card Liability |
| Redemption | Gift Card Liability | AR / Invoice Settlement |
| Expiry / breakage | Gift Card Liability | Breakage Revenue |
| Refund / void | Reverse of original entry | — |

---

## UI/UX Rule

Gift card always appears under **Payments / Settlements**, never under Discounts:

```
Subtotal:               XXX
Commercial Discounts:  −XXX   (manual + rule + promo)
─────────────────────────────
Taxable Base:           XXX
VAT (X%):               XXX
─────────────────────────────
Invoice Amount:         XXX
── Settlements ──────────────
Gift Card (CMX-...):   −XXX   ← gift_card_applied_amount
Cash:                   XXX
Card:                   XXX
─────────────────────────────
Amount Due:             XXX
```

The label is **"Gift Card Applied"** (not "Gift Card Discount" — that label is misleading).

---

## Production Requirements Summary

| Area | Requirement |
|---|---|
| Data model | `gift_card_applied_amount` (not discount amount) |
| Accounting | Liability on issue; reduce liability on redemption |
| Lifecycle | Full state machine with audit at every transition |
| Ledger | Every balance movement recorded in `org_gift_card_txn_dtl` |
| Concurrency | `SELECT FOR UPDATE` on every balance mutation |
| Reversal | Safe refund with idempotency key; status revert after refund |
| ERP events | SOLD, REDEEMED, REFUNDED, VOIDED, EXPIRED, BONUS_GRANTED |
| Reports | Outstanding liability, redemptions, refunds, adjustments |
| Security | Dual PIN (bcrypt hash + legacy migration); lockout after 5 failures |
| Constraints | DB: non-negative balance, unique code per tenant, currency match |
