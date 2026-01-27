# Database Feature Abbreviations

**CRITICAL**: Always check this list before creating new database objects to ensure consistent abbreviations.

## Quick Reference Table

| Feature | Abbreviation | System Scope | Tenant Scope |
|---------|-------------|--------------|--------------|
| Authentication | `auth` | `sys_auth_` | `org_auth_` |
| Plans | `pln` | `sys_pln_` | `org_pln_` |
| Orders | `ord` | - | `org_ord_` |
| Customers | `cust` | `sys_cust_` | `org_cust_` |
| Settings | `stng` | `sys_stng_` | `org_stng_` |
| Payments | `pay` | `sys_pay_` | `org_pay_` |
| Invoices | `inv` | - | `org_inv_` |
| Catalog | `cat` | `sys_cat_` | `org_cat_` |
| Reports | `rpt` | - | `org_rpt_` |
| Users | `usr` | `sys_usr_` | `org_usr_` |
| Workflow | `wf` | `sys_wf_` | `org_wf_` |
| Branches | `brn` | - | `org_brn_` |
| Discounts | `dsc` | - | `org_dsc_` |
| Gift Cards | `gft` | - | `org_gft_` |
| Tenants | `tnt` | `sys_tnt_` | `org_tnt_` |
| Usage | `usg` | - | `org_usg_` |
| Audit | `aud` | `sys_aud_` | `org_aud_` |
| OTP | `otp` | `sys_otp_` | - |

## Detailed Examples

### Authentication & Authorization (`auth`)
- Tables: `sys_auth_users_mst`, `org_auth_users_mst`, `sys_auth_roles_cd`
- Functions: `sys_auth_validate_token()`, `org_auth_get_permissions()`
- Views: `sys_auth_active_users_vw`
- Triggers: `sys_auth_users_audit_trg`

### Orders (`ord`)
- Tables: `org_ord_orders_mst`, `org_ord_order_items_dtl`, `org_ord_order_status_tr`
- Functions: `org_ord_calculate_total()`, `org_ord_transition_status()`
- Views: `org_ord_pending_orders_vw`
- Sequences: `org_ord_order_number_seq`

### Customers (`cust`)
- Tables: `sys_cust_customers_mst`, `org_cust_customer_tenants_dtl`
- Functions: `sys_cust_validate_phone()`, `org_cust_merge_customers()`
- Views: `org_cust_active_customers_vw`

### Settings (`stng`)
- Tables: `sys_stng_global_cf`, `org_stng_tenant_cf`, `org_stng_business_hours_cf`
- Functions: `org_stng_get_business_hours()`, `sys_stng_get_global_setting()`
- Views: `org_stng_active_settings_vw`

### Payments (`pay`)
- Tables: `sys_pay_payment_method_cd`, `org_pay_payments_tr`, `org_pay_refunds_tr`
- Functions: `org_pay_process_payment()`, `org_pay_refund_payment()`
- Views: `org_pay_pending_payments_vw`

### Invoices (`inv`)
- Tables: `org_inv_invoices_mst`, `org_inv_invoice_items_dtl`
- Functions: `org_inv_generate_invoice()`, `org_inv_calculate_tax()`
- Sequences: `org_inv_invoice_number_seq`

### Catalog/Products (`cat`)
- Tables: `sys_cat_service_categories_cd`, `org_cat_products_mst`, `org_cat_price_lists_mst`
- Functions: `org_cat_get_product_price()`, `sys_cat_get_categories()`
- Views: `org_cat_active_products_vw`

### Branches/Locations (`brn`)
- Tables: `org_brn_branches_mst`, `org_brn_branch_settings_cf`
- Functions: `org_brn_get_branch_settings()`, `org_brn_validate_location()`
- Views: `org_brn_active_branches_vw`

## Abbreviation Guidelines

- **Length**: 3-4 characters (prefer 3)
- **Style**: Lowercase, no underscores
- **Clarity**: Should be obvious what it represents
- **Uniqueness**: Must be unique across all features

### Good Abbreviations
- `auth` - Authentication (clear, 4 chars)
- `ord` - Orders (clear, 3 chars)
- `stng` - Settings (clear, 4 chars)
- `rpt` - Reports (clear, 3 chars)

### Bad Abbreviations
- `a` - Too short, unclear
- `ordr` - Should be `ord` (shorter is better)
- `set` - Could be "settings" or "set" (unclear)
- `usr_mgmt` - Uses underscore (should be `usr`)

## Adding New Features

1. **Check if feature exists** in this document
2. **If new feature**:
   - Add entry to this document
   - Use 3-4 character abbreviation
   - Be consistent with existing patterns
3. **Document examples** for tables, functions, views
4. **Notify team** of new abbreviation
