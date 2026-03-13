---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Data Model

## Tables

### org_customers_mst (extended)

B2B columns (nullable): `company_name`, `company_name2`, `tax_id`, `credit_limit`, `payment_terms_days`, `cost_center_code`. Used when `type = 'b2b'`.

### org_b2b_contacts_dtl

- `id`, `tenant_org_id`, `customer_id` (FK org_customers_mst)
- `contact_name`, `contact_name2`, `phone`, `email`
- `role_cd`, `is_primary`, `rec_status`, `is_active`
- Audit fields

### org_b2b_contracts_mst

- `id`, `tenant_org_id`, `customer_id` (FK org_customers_mst)
- `contract_no`, `effective_from`, `effective_to`
- `pricing_terms` JSONB, `rec_status`, `is_active`
- Audit fields

### org_b2b_statements_mst

- `id`, `tenant_org_id`, `customer_id`, `contract_id` (nullable)
- `statement_no`, `period_from`, `period_to`, `due_date`
- `total_amount`, `paid_amount`, `balance_amount`, `currency_cd`, `status_cd`
- Audit fields

### org_invoice_mst (extended)

`invoice_type_cd`, `b2b_contract_id`, `statement_id`, `cost_center_code`, `po_number`

### org_orders_mst (extended)

`b2b_contract_id`, `cost_center_code`, `po_number`
