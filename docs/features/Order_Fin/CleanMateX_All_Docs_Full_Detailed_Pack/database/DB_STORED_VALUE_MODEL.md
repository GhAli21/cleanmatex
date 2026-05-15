<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Stored Value Database Model

## 1. Design Pattern

All stored-value systems use:

```text
Master Account/Card
+ Transaction Ledger
+ Order Credit Application
```

## 2. Gift Cards

```text
org_gift_cards_mst
org_gift_card_txn_dtl
```

Lifecycle:

```text
DRAFT
GENERATED
ACTIVE
PARTIALLY_REDEEMED
FULLY_REDEEMED
EXPIRED
VOIDED
SUSPENDED
```

Transaction types:

```text
ISSUE
ACTIVATE
REDEEM
REFUND
EXPIRE
ADJUSTMENT
VOID
BONUS_ADD
BONUS_REDEEM
```

## 3. Wallet

```text
org_wallet_accounts_mst
org_wallet_txn_dtl
```

Transaction types:
- TOP_UP
- APPLY_TO_ORDER
- REFUND_TO_WALLET
- REVERSAL
- ADJUSTMENT
- BONUS_ADD
- EXPIRY

## 4. Customer Advances

```text
org_customer_advances_mst
org_customer_advance_txn_dtl
```

## 5. Customer Credits

```text
org_customer_credits_mst
org_customer_credit_txn_dtl
```

## 6. Locking

Use row locks for all balance mutations:

```sql
SELECT ... FOR UPDATE
```

## 7. Idempotency

Every stored-value application must include an idempotency key.
