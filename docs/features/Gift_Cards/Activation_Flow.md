# Gift Cards — Activation Flow

Defines who moves a card between states and under what conditions.

---

## State Definitions

### DRAFT

Created when an admin starts preparing a gift card or batch.

Used for:
- Unsaved manual preparation
- Incomplete batch setup
- Pending template configuration

Card code does not exist yet. Card is **not redeemable**.

### GENERATED

Set when the system generates the actual card code and PIN.

Triggered by:
- Batch generation run
- Physical card print/export
- Digital card generation

At this point:
- Card exists with a `gift_card_code`
- Balance exists logically (`original_amount`)
- **Not redeemable** — payment/approval event required to activate

### ACTIVE

The card is redeemable. This state is reached only after a valid financial or approved business event.

**Never activate merely because a code was generated.** Doing so creates financial and fraud exposure.

---

## Activation Trigger Matrix

| Scenario | Trigger | Mechanism |
|---|---|---|
| Customer buys digital gift card | Auto-ACTIVE after payment success | `sellGiftCard` → SALE ledger → status = ACTIVE |
| POS sells physical gift card | Auto-ACTIVE after payment success | `sellGiftCard` → SALE ledger → status = ACTIVE |
| Admin creates promotional card | Manual admin activation | `adminActivateGiftCard` → ACTIVATE ledger |
| Corporate batch cards | Batch approval + optional payment confirmation | Batch approval → `adminActivateGiftCard` per card |
| Imported / migrated old cards | Admin migration activation | `adminActivateGiftCard` with MIGRATION issue_type |
| Replacement card | Admin activation after voiding old card | Void old → `adminActivateGiftCard` on replacement |

---

## Buyer vs. Recipient

`purchased_by_cust_id` and `issued_to_customer_id` are distinct fields:

| Field | Meaning | Used For |
|---|---|---|
| `purchased_by_cust_id` | The buyer (who paid) | Payment receipt, refund rights, anti-fraud, purchase history |
| `issued_to_customer_id` | The receiver/owner | Wallet display, redemption rights, customer app, notifications |

### Examples

**Customer buys for himself:**
```
purchased_by_cust_id = Ahmed
issued_to_customer_id = Ahmed
```

**Customer buys for someone else:**
```
purchased_by_cust_id = Ahmed
issued_to_customer_id = Fatima
```

**Anonymous physical card sold at counter:**
```
purchased_by_cust_id = NULL
issued_to_customer_id = NULL
```
→ When customer later claims the card: `issued_to_customer_id = claimant`

**Corporate batch (initially unassigned):**
```
purchased_by_cust_id = NULL
issued_to_customer_id = NULL
batch_id = <batch UUID>
```
→ Each card assigned to a guest/customer later

---

## Full Lifecycle Diagram

```
DRAFT → GENERATED → ACTIVE ──────────────────────────→ FULLY_REDEEMED
                      │                                       ↑
                      │        ┌── PARTIALLY_REDEEMED ────────┘
                      │        │   (refund reverts here)
                      ↓        ↓
                   SUSPENDED  EXPIRED
                      │
                      └──────→ VOIDED
```

| Status | Redeemable | Who sets it |
|---|:---:|---|
| DRAFT | No | Admin (batch prep) |
| GENERATED | No | System on code creation |
| ACTIVE | Yes | Auto on paid sale; manual admin activate |
| PARTIALLY_REDEEMED | Yes | System after partial use or refund |
| FULLY_REDEEMED | No | System when `available_amount = 0` |
| EXPIRED | No | Admin manually; inline check at redemption |
| VOIDED | No | Admin void action |
| SUSPENDED | No | Admin suspend action |

---

## Admin UI Actions Required

### Tenant Admin / Operator

| Action | Applies to |
|---|---|
| Generate single card or batch | DRAFT → GENERATED |
| Sell gift card (single) | GENERATED → ACTIVE (auto) |
| Activate single card or batch | GENERATED → ACTIVE (manual) |
| Suspend single card or batch | ACTIVE → SUSPENDED |
| Unsuspend | SUSPENDED → ACTIVE |
| Void single card or batch | Any → VOIDED |
| Adjust balance | ACTIVE / PARTIALLY_REDEEMED |
| View card detail | Any status |
| View transaction history | Any status |
| View liability reports | — |

### Customer App (V2 — deferred)

Customers do not manually activate purchased cards. Customer actions:
- Claim an anonymous physical card (sets `issued_to_customer_id`)
- View wallet (all cards issued/claimed to them)
- Check balance
- Redeem on customer-initiated orders

Claiming is different from activation. Only the admin/POS flow activates cards.
