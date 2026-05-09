Gift card should be managed as a stored-value payment feature, not as normal discount.

Recommended model:

Core Concept
A gift card has its own balance.

When issued/sold:

Customer pays 10.000
Gift card balance becomes 10.000
Accounting: cash/card received, gift-card liability created
When redeemed on an order:

Order total before gift card: 3.591
Gift card applied:           0.050
Customer card payment:       3.541
Gift card balance reduces by 0.050
So gift card affects amount due, not taxable discount.

Gift Card Lifecycle
Use clear statuses:

draft / issued / active / partially_used / fully_used / expired / voided / refunded
Typical actions:

issue: create gift card number/PIN, initial balance.
activate: after payment is confirmed.
redeem: apply amount to order/invoice.
void redemption: reverse gift usage if order/payment is cancelled.
refund: return balance/payment according to policy.
expire: close remaining balance after expiry date.
adjust: admin correction with reason and audit.
Tables Needed
You already have some of this:

org_gift_cards_mst: gift card master, original amount, current balance, status, expiry.
org_gift_card_transactions: every balance movement.
org_orders_mst.gift_card_id
org_orders_mst.gift_card_discount_amount currently used, but conceptually should mean gift card applied amount.
org_invoice_mst.gift_card_discount_amount
org_payments_dtl_tr.gift_card_applied_amount
Long term, I recommend adding clearer columns like:

gift_card_applied_amount
gift_card_redemption_amount
Then keep old gift_card_discount_amount only for compatibility or migrate it.

Accounting Treatment
Gift card sale:

Dr Cash/Card
Cr Gift Card Liability
Gift card redemption:

Dr Gift Card Liability
Cr Accounts Receivable / Sales Settlement
Normal sale still records revenue and VAT based on the real sale amount after commercial discounts, before gift card redemption.

UI/UX Rule
In the order/payment screen, show gift card under payment/tender section, not mixed with commercial discounts.

Good layout:

Subtotal
Manual Discount
Rule Discount
Promo Discount
Net after discounts
VAT
Invoice Amount
Payments / Settlements
Gift Card Applied
Card Paid
Balance Due
The current label “Gift Card Discount” is misleading. Better label: Gift Card Applied or Gift Card Redemption.

System Rule
For calculations:

commercialDiscount = manual + rule + promo
taxableBase = subtotal - commercialDiscount
vat = taxableBase * vatRate
invoiceAmount = taxableBase + vat + otherTax
amountDue = invoiceAmount - giftCardApplied
So yes: manage gift card as a payment method / liability settlement, with full transaction history and audit, not as a price discount.

======================

is there vat gift card to be paid for government and collected from gift card buyer?

Usually: **no VAT is collected when selling a general-purpose gift card**, and VAT is collected later when the gift card is redeemed for actual services.

For CleanMateX laundry services, the safest default is:

```text
Sell gift card 10.000
VAT now: 0.000
Liability: 10.000

Later customer redeems it against laundry order
Laundry taxable amount calculated normally
VAT collected on the laundry service
Gift card pays part/all of the final invoice
```

Why? Because at gift card sale time, the exact service/tax treatment may not be known yet. The gift card is like stored money.

There is one important exception:

If the gift card is **single-purpose voucher** where the exact taxable service and VAT rate are already known at issue time, some tax regimes require VAT at sale time. But most SaaS/POS systems treat normal gift cards as **multi-purpose vouchers**, so VAT happens on redemption.

Recommended CleanMateX rule:

- `GIFT_CARD_SALE`: no VAT, creates liability.
- `GIFT_CARD_REDEMPTION`: VAT belongs to the order/invoice service.
- Gift card applied reduces balance due, not VAT base.
- Add a tenant setting later if a country requires VAT on gift card issue.

For Oman/GCC-style handling, we should make this configurable by tenant/country, but default to **VAT on redemption, not on gift card sale**.

=================

so what we miss to implement that perfectly best practices no gaps production-ready ?

To make gift cards production-ready, the missing part is not only calculation. We need treat it as a full **stored-value liability + tender** feature.

## Main Gaps
1. **Naming / data model clarity**
   Current fields like `gift_card_discount_amount` are misleading. Best practice is `gift_card_applied_amount` or `gift_card_redemption_amount`.

2. **Accounting lifecycle**
   Gift card sale should create liability. Gift card redemption should reduce liability. It should not be mixed with commercial discounts.

3. **Tax policy**
   Need tenant/country setting:
   - default: VAT on redemption, not on gift card sale
   - optional: VAT on issue for single-purpose voucher countries/rules

4. **Full transaction ledger**
   Every movement must be logged:
   - issue
   - sale/activation
   - redemption
   - refund
   - void redemption
   - expiry
   - admin adjustment

5. **Reversal flows**
   If order is cancelled, payment cancelled, invoice voided, or order edited, gift card balance must be reversed safely and audited.

6. **Invoice/payment UI**
   Gift card should appear under **Payments / Settlements**, not under discounts:
   ```text
   Invoice Amount
   Gift Card Applied
   Card/Cash Paid
   Balance Due
   ```

7. **DB constraints**
   Need stronger constraints to prevent:
   - negative balances
   - redemption above available balance
   - using expired/voided cards
   - cross-tenant gift card use
   - duplicate card numbers

8. **Concurrency safety**
   Gift redemption must lock the gift card row during balance update to prevent double-spend.

9. **ERP / journal posting**
   Need clear postings:
   ```text
   Gift card sale:
   Dr Cash/Card
   Cr Gift Card Liability

   Gift card redemption:
   Dr Gift Card Liability
   Cr AR / Invoice Settlement
   ```

10. **Reports**
   Need reports for:
   - outstanding gift card liability
   - gift card sales
   - redemptions
   - expired balances
   - adjustments and audit

## Current Specific Fix Still Needed
For the old order you showed, the code is fixed for future orders, but the existing remote invoice still has wrong stored data. It needs a reviewed correction migration or admin repair action, not direct manual DB editing.

## Recommended Implementation Order
1. Rename/standardize semantics in code while keeping DB compatibility.
2. Add tenant tax settings for gift cards.
3. Harden gift-card service: lock, redeem, reverse, refund, expire.
4. Add accounting postings for sale/redemption/reversal.
5. Update UI wording: “Gift Card Applied”, not “Gift Card Discount”.
6. Add tests for partial payment, full gift redemption, cancellation, refund, expiry, and concurrent redemption.
7. Add reports and audit views.

The biggest missing piece is: **gift card must be a payment/liability subsystem, not a discount shortcut.**

