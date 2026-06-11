# CleanMateX Customer Receipt Auto Allocation Feature Pack v1.0

**Feature:** Customer Receipt Allocation / Auto Allocate Oldest Balances  
**Scope:** POS overpayment, customer account payment, BVM voucher allocation, AR invoice payment, B2B statement payment, wallet top-up, customer advance, customer credit.  
**Status:** Implementation-ready reference pack for AI coding assistant.

## Core Rule

When a customer pays more than the current order needs, the excess becomes **Unallocated Customer Receipt Amount**. It must be resolved by explicit allocation or configured fallback.

Allowed resolutions:

- Return cash change.
- Reduce payment.
- Manually allocate to customer balances.
- Auto allocate to oldest eligible customer balances.
- Top up wallet.
- Save as customer advance.
- Save as customer credit.
- Restore stored value if the excess came from gift card/wallet/customer credit.

## Architecture

Use **one Business Voucher receipt header** with multiple voucher lines:

```text
org_fin_vouchers_mst
  voucher_type/source = CUSTOMER_RECEIPT / ACCOUNT_RECEIPT
  customer_id = customer
  total_amount = retained receipt amount

org_fin_voucher_trx_lines_dtl
  ORDER_PAYMENT             -> ORDER
  INVOICE_PAYMENT           -> AR_INVOICE
  STATEMENT_PAYMENT         -> B2B_STATEMENT
  WALLET_TOPUP              -> WALLET_TOPUP
  CUSTOMER_ADVANCE_RECEIPT  -> CUSTOMER_ADVANCE
  CUSTOMER_CREDIT_ISSUE     -> CUSTOMER_CREDIT
```

Do **not** add `payment_target_type` to `org_order_payments_dtl`. Generic targeting belongs in `org_fin_voucher_trx_lines_dtl.target_type` and `target_id`.

## Pack Files

1. `01_PRD_Customer_Receipt_Auto_Allocation.md`
2. `02_Database_Target_Schema_And_Seeds.sql`
3. `03_Service_Algorithms_And_Validation.md`
4. `04_API_Contracts.md`
5. `05_UI_UX_Spec_Payment_Modal_Allocation.md`
6. `06_TypeScript_Constants_And_Types.ts`
7. `07_Test_Cases_And_QA_Checklist.md`
8. `08_AI_Coding_Assistant_Implementation_Instructions.md`
