# CleanMateX Payment / Settlement Catalogs Upgrade Reference Pack v1.1

**Purpose:** Updated reference pack for AI coding assistant to inspect the current CleanMateX database/codebase, then generate the correct production migration and code updates.

**Status:** v1.1 includes Customer Receipt Allocation / Auto Allocate Oldest Balances catalog alignment.

## Critical Rule

Do **not** add `payment_target_type` to `org_order_payments_dtl`.

`org_order_payments_dtl` remains strictly for direct ORDER real-payment rows.

Generic settlement targeting belongs in:

```text
org_fin_voucher_trx_lines_dtl.line_role
org_fin_voucher_trx_lines_dtl.target_type
org_fin_voucher_trx_lines_dtl.target_id
```

## What v1.1 Adds Over v1.0

```text
1. ALLOCATE_TO_CUSTOMER_BALANCES
2. AUTO_ALLOCATE_TO_CUSTOMER_BALANCES
3. org_customer_receipt_allocation_policy_cf
4. sys_customer_receipt_allocation_mode_cd
5. sys_customer_receipt_fallback_destination_cd
6. sys_fin_voucher_source_type_cd
7. CUSTOMER_CREDIT target type
8. Customer receipt allocation source/origin values
9. Auto allocation policy seeds and constraints
10. Extra implementation instructions for customer account receipt allocation
```

## Included Files

```text
README.md
01_TARGET_CATALOG_TABLES_v1_1.sql
02_FULL_SEED_DATA_v1_1.sql
03_TYPESCRIPT_CONSTANTS_REFERENCE_v1_1.ts
04_MIGRATION_GENERATION_INSTRUCTIONS_v1_1.md
05_CODEBASE_UPDATE_CHECKLIST_v1_1.md
06_CUSTOMER_RECEIPT_ALLOCATION_ADDENDUM.md
```

## AI Assistant Workflow

```text
1. Inspect current DB tables, columns, constraints, indexes, and data.
2. Compare current state with this reference pack.
3. Generate only missing migration changes.
4. Preserve existing data.
5. Add missing comments and seed rows idempotently.
6. Update TypeScript constants, validation schemas, services, and UI.
7. Do not blindly execute the reference SQL.
```
