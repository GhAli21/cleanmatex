---
version: v1.0.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# Database Feature Abbreviations

**CRITICAL**: Always check this list before creating new database objects to ensure consistent abbreviations.

**Last Updated**: 2025-11-14  
**Maintainer**: Database Team

---

## How to Use This Document

1. **Before creating a new database object**, check if the feature exists below
2. **If feature exists**: Use the abbreviation listed
3. **If feature is new**: Add it to this document first, then use it
4. **If unsure**: Ask the team before creating the object

---

## Standard Feature Abbreviations

### Authentication & Authorization
- **Abbreviation**: `auth`
- **Scope**: `sys_auth_` (system and HQ SAAS Platform), `org_auth_` (tenant)
- **Examples**:
  - Tables: `sys_auth_users_mst`, `org_auth_users_mst`, `sys_auth_roles_cd`
  - Functions: `sys_auth_validate_token()`, `org_auth_get_permissions()`
  - Views: `sys_auth_active_users_vw`
  - Triggers: `sys_auth_users_audit_trg`

### Plans & Subscriptions
- **Abbreviation**: `pln`
- **Scope**: `sys_pln_` (system), `org_pln_` (tenant)
- **Examples**:
  - Tables: `sys_pln_plans_mst`, `org_pln_subscriptions_mst`, `sys_pln_features_cd`
  - Functions: `sys_pln_get_plan_features()`, `org_pln_check_limits()`
  - Views: `org_pln_active_subscriptions_vw`

### Orders
- **Abbreviation**: `ord`
- **Scope**: `org_ord_` (tenant only)
- **Examples**:
  - Tables: `org_ord_orders_mst`, `org_ord_order_items_dtl`, `org_ord_order_status_tr`
  - Functions: `org_ord_calculate_total()`, `org_ord_transition_status()`
  - Views: `org_ord_pending_orders_vw`
  - Sequences: `org_ord_order_number_seq`

### Customers
- **Abbreviation**: `cust`
- **Scope**: `sys_cust_` (system), `org_cust_` (tenant)
- **Examples**:
  - Tables: `sys_cust_customers_mst`, `org_cust_customer_tenants_dtl`
  - Functions: `sys_cust_validate_phone()`, `org_cust_merge_customers()`
  - Views: `org_cust_active_customers_vw`

### Settings
- **Abbreviation**: `stng`
- **Scope**: `sys_stng_` (system), `org_stng_` (tenant)
- **Examples**:
  - Tables: `sys_stng_global_cf`, `org_stng_tenant_cf`, `org_stng_business_hours_cf`
  - Functions: `org_stng_get_business_hours()`, `sys_stng_get_global_setting()`
  - Views: `org_stng_active_settings_vw`

### Payments
- **Abbreviation**: `pay`
- **Scope**: `sys_pay_` (system), `org_pay_` (tenant)
- **Examples**:
  - Tables: `sys_pay_payment_method_cd`, `org_pay_payments_tr`, `org_pay_refunds_tr`
  - Functions: `org_pay_process_payment()`, `org_pay_refund_payment()`
  - Views: `org_pay_pending_payments_vw`

### Invoices
- **Abbreviation**: `inv`
- **Scope**: `org_inv_` (tenant only)
- **Examples**:
  - Tables: `org_inv_invoices_mst`, `org_inv_invoice_items_dtl`
  - Functions: `org_inv_generate_invoice()`, `org_inv_calculate_tax()`
  - Sequences: `org_inv_invoice_number_seq`

### Catalog/Products
- **Abbreviation**: `cat`
- **Scope**: `sys_cat_` (system), `org_cat_` (tenant)
- **Examples**:
  - Tables: `sys_cat_service_categories_cd`, `org_cat_products_mst`, `org_cat_price_lists_mst`
  - Functions: `org_cat_get_product_price()`, `sys_cat_get_categories()`
  - Views: `org_cat_active_products_vw`

### Reports
- **Abbreviation**: `rpt`
- **Scope**: `org_rpt_` (tenant only)
- **Examples**:
  - Tables: `org_rpt_sales_summary_mst`, `org_rpt_daily_stats_mst`
  - Functions: `org_rpt_generate_sales_report()`, `org_rpt_get_daily_stats()`
  - Views: `org_rpt_sales_summary_vw`

### Users (Staff/Employees)
- **Abbreviation**: `usr`
- **Scope**: `sys_usr_` (system), `org_usr_` (tenant)
- **Examples**:
  - Tables: `sys_usr_employees_mst`, `org_usr_staff_mst`
  - Functions: `org_usr_get_staff_permissions()`, `sys_usr_validate_employee()`
  - Views: `org_usr_active_staff_vw`

### Workflow
- **Abbreviation**: `wf`
- **Scope**: `sys_wf_` (system), `org_wf_` (tenant)
- **Examples**:
  - Tables: `sys_wf_templates_cd`, `org_wf_workflow_settings_cf`, `org_wf_rules_cf`
  - Functions: `org_wf_transition_status()`, `sys_wf_get_template()`
  - Views: `org_wf_active_workflows_vw`

### Branches/Locations
- **Abbreviation**: `brn`
- **Scope**: `org_brn_` (tenant only)
- **Examples**:
  - Tables: `org_brn_branches_mst`, `org_brn_branch_settings_cf`
  - Functions: `org_brn_get_branch_settings()`, `org_brn_validate_location()`
  - Views: `org_brn_active_branches_vw`

### Discounts & Promotions
- **Abbreviation**: `dsc`
- **Scope**: `org_dsc_` (tenant only)
- **Examples**:
  - Tables: `org_dsc_discount_rules_cf`, `org_dsc_promo_codes_mst`, `org_dsc_promo_usage_log`
  - Functions: `org_dsc_apply_discount()`, `org_dsc_validate_promo_code()`
  - Views: `org_dsc_active_promotions_vw`

### Gift Cards
- **Abbreviation**: `gft`
- **Scope**: `org_gft_` (tenant only)
- **Examples**:
  - Tables: `org_gft_gift_cards_mst`, `org_gft_transactions_tr`
  - Functions: `org_gft_issue_card()`, `org_gft_redeem_card()`
  - Views: `org_gft_active_cards_vw`

### Tenants/Organizations
- **Abbreviation**: `tnt`
- **Scope**: `sys_tnt_` (system), `org_tnt_` (tenant)
- **Examples**:
  - Tables: `org_tnt_tenants_mst`, `sys_tnt_tenant_types_cd`
  - Functions: `sys_tnt_create_tenant()`, `org_tnt_get_tenant_info()`
  - Views: `sys_tnt_active_tenants_vw`

### Usage Tracking
- **Abbreviation**: `usg`
- **Scope**: `org_usg_` (tenant only)
- **Examples**:
  - Tables: `org_usg_usage_tracking`, `org_usg_daily_usage_mst`
  - Functions: `org_usg_record_usage()`, `org_usg_get_monthly_usage()`
  - Views: `org_usg_usage_summary_vw`

### Audit & Logging
- **Abbreviation**: `aud`
- **Scope**: `sys_aud_` (system), `org_aud_` (tenant)
- **Examples**:
  - Tables: `sys_aud_audit_log`, `org_aud_activity_log`
  - Functions: `sys_aud_log_event()`, `org_aud_get_audit_trail()`
  - Views: `org_aud_recent_activities_vw`

### OTP & Verification
- **Abbreviation**: `otp`
- **Scope**: `sys_otp_` (system)
- **Examples**:
  - Tables: `sys_otp_codes`, `sys_otp_verification_log`
  - Functions: `sys_otp_generate_code()`, `sys_otp_validate_code()`
  - Views: `sys_otp_pending_verifications_vw`

---

## Adding New Features

### Process for Adding New Abbreviation

1. **Check if feature exists** in this document
2. **If new feature**:
   - Add entry to this document
   - Use 3-4 character abbreviation
   - Be consistent with existing patterns
   - Update version and last_updated date
3. **Document examples** for tables, functions, views
4. **Notify team** of new abbreviation

### Abbreviation Guidelines

- **Length**: 3-4 characters (prefer 3)
- **Style**: Lowercase, no underscores
- **Clarity**: Should be obvious what it represents
- **Uniqueness**: Must be unique across all features
- **Consistency**: Follow existing patterns

### Examples of Good Abbreviations

- ✅ `auth` - Authentication (clear, 4 chars)
- ✅ `ord` - Orders (clear, 3 chars)
- ✅ `stng` - Settings (clear, 4 chars)
- ✅ `rpt` - Reports (clear, 3 chars)

### Examples of Bad Abbreviations

- ❌ `a` - Too short, unclear
- ❌ `ordr` - Should be `ord` (shorter is better)
- ❌ `set` - Could be "settings" or "set" (unclear)
- ❌ `usr_mgmt` - Use underscore (should be `usr`)

---

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

---

## Related Documentation

- [Database Conventions](./database_conventions.md) - Complete naming rules
- [Grandfathered Objects](./database_grandfathered_objects.md) - Existing objects registry
- [Migration Plan](./database_migration_plan.md) - Migration strategy for existing objects

---

## Return to [Main Documentation](../CLAUDE.md)

