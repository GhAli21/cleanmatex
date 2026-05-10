The criticism is correct: the lifecycle needs explicit transition ownership.

Your gift card plan says the feature should use controlled lifecycle states and audit history, not deletion or coupon-style shortcuts . But it must define **who moves the card between states**.

## Correct activation flow

### 1. `DRAFT`

Created when admin starts preparing a gift card or batch.

Used for:

* unsaved/manual preparation
* incomplete batch setup
* pending template configuration

No code should be usable here.

### 2. `GENERATED`

Set when the system generates the actual card code/PIN.

Triggered by:

* batch generation
* physical card print/export
* digital card generation

At this point:

* card exists
* code exists
* balance exists logically
* but it is **not redeemable yet**

### 3. `ACTIVE`

This is the important part.

For V1, I strongly recommend:

```text
ACTIVE only after successful sale/payment confirmation.
```

So:

```text
DRAFT → GENERATED → ACTIVE
```

means:

```text
Admin prepares → System creates code → Payment/sale activates
```

Not manual activation by default.

Manual admin activation should exist only for:

* corporate gifts
* goodwill compensation
* migration/import
* customer service correction
* promotional campaign cards

## Best V1 rule

Use this:

| Scenario                            | Activation Trigger                             |
| ----------------------------------- | ---------------------------------------------- |
| Customer buys digital gift card     | Auto-active after payment success              |
| POS sells physical card             | Auto-active after payment success              |
| Admin creates promotional gift card | Manual admin activation                        |
| Corporate batch cards               | Batch approval + optional payment confirmation |
| Imported old cards                  | Admin migration activation                     |
| Replacement card                    | Admin activation after voiding old card        |

## Should Phase 6 UI include this?

Yes.

You need UI actions, but not everywhere.

### Tenant Admin / POS

* Generate gift card signle card or batch
* Sell gift card signle card or batch
* View card
* Activate signle card or batch
* Suspend signle card or batch
* Void signle card or batch
* Check balance
* View transactions
* View liability reports
* Monitor fraud

### Customer App

Customer should not manually activate normal purchased cards.

Customer can:

* claim a gift card
* add it to wallet
* view balance
* redeem it

Claiming is different from activation.

## `issued_to_customer_id` vs `purchased_by_customer_id`

They are different and both are needed.

### `purchased_by_customer_id`

This is the buyer.

Example:

```text
Ahmed buys a 20 OMR gift card.
```

Then:

```text
purchased_by_customer_id = Ahmed
```

This matters for:

* payment receipt
* refund rights
* anti-fraud
* purchase history
* customer support

### `issued_to_customer_id`

This is the receiver/owner/beneficiary.

Example:

```text
Ahmed buys a 20 OMR gift card for Fatima.
```

Then:

```text
purchased_by_customer_id = Ahmed
issued_to_customer_id = Fatima
```

This matters for:

* wallet display
* redemption permission
* customer app balance
* recipient notification
* ownership transfer rules

## Important examples

### Customer buys for himself

```text
purchased_by_customer_id = Ahmed
issued_to_customer_id = Ahmed
```

### Customer buys for someone else

```text
purchased_by_customer_id = Ahmed
issued_to_customer_id = Fatima
```

### Anonymous physical card sold at counter

```text
purchased_by_customer_id = NULL
issued_to_customer_id = NULL
```

Then when customer claims it:

```text
issued_to_customer_id = Customer who claimed it
```

### Corporate batch

```text
purchased_by_customer_id = NULL
issued_to_customer_id = NULL initially
corporate_account_id = Hotel ABC
batch_id = Batch ID
```

Then each card may later be assigned to a guest/customer.

## Final recommendation

For CleanMateX V1, define activation like this:

```text
Gift card is GENERATED when the code is created.
Gift card becomes ACTIVE only when there is a valid financial or approved business event.
```

That event can be:

* paid sale
* approved corporate issue
* approved promotional issue
* admin correction/migration

Never activate merely because the code was generated. That creates financial and fraud exposure.
