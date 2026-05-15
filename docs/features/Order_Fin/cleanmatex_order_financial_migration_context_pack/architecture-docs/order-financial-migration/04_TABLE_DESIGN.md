# Table Design

## Existing Core Tables

```text
org_orders_mst
org_order_items_dtl
org_order_item_pieces_dtl
org_order_preferences_dtl
```

## Target Financial Detail Tables

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
org_order_financial_audit_log
```

## Promotion Tables

Promotions are tenant-owned:

```text
org_promotions_mst
org_promotion_rules_dtl
org_promotion_eligibility_dtl
org_promotion_rewards_dtl
org_promotion_limits_dtl
org_promotion_exclusions_dtl
```

Static codes only:

```text
sys_promotion_type_cd
sys_promotion_reward_type_cd
sys_promotion_stacking_policy_cd
sys_coupon_type_cd
sys_discount_type_cd
```

## Product Piece Templates

Use tenant-owned configuration:

```text
org_product_piece_templates_mst
org_product_piece_templates_dtl
```

Recommended fields in `org_product_data_mst`:

```text
pieces_per_product integer default 1
has_piece_template boolean default false
default_piece_template_id uuid null
```

## Stored Value Tables

```text
org_gift_cards_mst
org_gift_card_txn_dtl

org_wallet_accounts_mst
org_wallet_txn_dtl

org_customer_advances_mst
org_customer_advance_txn_dtl

org_customer_credits_mst
org_customer_credit_txn_dtl

org_loyalty_accounts_mst
org_loyalty_txn_dtl
```

## Invoice / AR

```text
org_invoices_mst
org_invoice_lines_dtl
org_invoice_payments_dtl
```

## Reconciliation / Events

```text
org_domain_events_outbox
org_idempotency_keys_log
org_fin_reconciliation_runs_mst
org_fin_reconciliation_issues_dtl
```

## Column Conventions

Follow existing project conventions after schema discovery.

Default target conventions:

```text
id uuid primary key default gen_random_uuid()
tenant_org_id uuid not null
branch_id uuid null where relevant
order_id uuid where relevant
order_item_id uuid null where relevant
order_item_piece_id uuid null where relevant
currency_code char(3) where monetary
amount numeric(19,4)
metadata jsonb default '{}'
rec_status smallint default 1 if used in existing project
created_at timestamptz default now()
updated_at timestamptz null
created_by consistent with existing type
updated_by consistent with existing type
```

## Required Index Pattern

```text
(tenant_org_id, order_id)
(tenant_org_id, branch_id)
(tenant_org_id, customer_id)
(tenant_org_id, created_at desc)
partial indexes for nullable FKs when useful
```

## Required Checks

```text
amount >= 0
discount_amount >= 0
tax_amount >= 0
quantity > 0
```

## Preference Level Constraint

```sql
check (
  (
    prefs_level = 'ORDER'
    and order_item_id is null
    and order_item_piece_id is null
  )
  or
  (
    prefs_level = 'ITEM'
    and order_item_id is not null
    and order_item_piece_id is null
  )
  or
  (
    prefs_level = 'PIECE'
    and order_item_id is not null
    and order_item_piece_id is not null
  )
)
```
