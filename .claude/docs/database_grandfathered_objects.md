---
version: v1.0.0
last_updated: 2025-11-14
author: CleanMateX Team
status: Active - Grandfathered Objects
---

# Grandfathered Database Objects Registry

**Purpose**: Complete list of existing database objects that use the **old naming convention** (without feature grouping).

**CRITICAL**: 
- ✅ **Use these exact names** when referencing existing objects
- ✅ **Do NOT use feature-grouped names** for these objects (they don't exist yet)
- ⚠️ **When creating NEW related objects**, use the new naming convention with feature grouping
- 📝 **This document will be updated** when objects are migrated

**Last Updated**: 2025-11-14  
**Migration Status**: Not Started

---

## How to Use This Document

### For Developers:
- **Referencing existing objects**: Use the names listed here exactly as shown
- **Creating new objects**: Use new naming convention (see [Database Conventions](./database_conventions.md))
- **When in doubt**: Check this document first

### For AI Assistants:
- **When generating code**: Use exact names from this document for existing objects
- **When creating new objects**: Use feature-grouped naming convention
- **When suggesting changes**: Reference this document to ensure consistency

---

## Tables

### System Tables (sys_*)

| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `sys_payment_method_cd` | `pay` | `sys_pay_payment_method_cd` | Grandfathered | Payment methods lookup |
| `sys_payment_type_cd` | `pay` | `sys_pay_payment_type_cd` | Grandfathered | Payment types lookup |
| `sys_order_type_cd` | `ord` | `sys_ord_order_type_cd` | Grandfathered | Order types lookup |
| `sys_service_category_cd` | `cat` | `sys_cat_service_category_cd` | Grandfathered | Service categories lookup |
| `sys_customers_mst` | `cust` | `sys_cust_customers_mst` | Grandfathered | Global customer registry |
| `sys_plan_limits` | `pln` | `sys_pln_plan_limits` | Grandfathered | Plan limits configuration |
| `sys_tenant_settings_cd` | `stng` | `sys_stng_tenant_settings_cd` | Grandfathered | Tenant settings codes |
| `sys_workflow_template_cd` | `wf` | `sys_wf_workflow_template_cd` | Grandfathered | Workflow templates |
| `sys_workflow_template_stages` | `wf` | `sys_wf_workflow_template_stages` | Grandfathered | Workflow stages |
| `sys_workflow_template_transitions` | `wf` | `sys_wf_workflow_template_transitions` | Grandfathered | Workflow transitions |
| `sys_audit_log` | `aud` | `sys_aud_audit_log` | Grandfathered | System audit log |
| `sys_otp_codes` | `otp` | `sys_otp_codes` | Grandfathered | OTP codes (already correct) |

### Tenant Tables (org_*)

#### Core/Tenant Management
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_tenants_mst` | `tnt` | `org_tnt_tenants_mst` | Grandfathered | Tenant organizations |
| `org_subscriptions_mst` | `pln` | `org_pln_subscriptions_mst` | Grandfathered | Tenant subscriptions |
| `org_branches_mst` | `brn` | `org_brn_branches_mst` | Grandfathered | Tenant branches |

#### Authentication & Users
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_users_mst` | `auth` | `org_auth_users_mst` | Grandfathered | Tenant users/staff |

#### Customers
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_customers_mst` | `cust` | `org_cust_customers_mst` | Grandfathered | Tenant-customer links |
| `org_customer_addresses` | `cust` | `org_cust_customer_addresses` | Grandfathered | Customer addresses |
| `org_customer_merge_log` | `cust` | `org_cust_customer_merge_log` | Grandfathered | Customer merge history |

#### Orders
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_orders_mst` | `ord` | `org_ord_orders_mst` | Grandfathered | Tenant orders |
| `org_order_items_dtl` | `ord` | `org_ord_order_items_dtl` | Grandfathered | Order line items |
| `org_order_history` | `ord` | `org_ord_order_history` | Grandfathered | Order history log |
| `org_order_status_history` | `ord` | `org_ord_order_status_history` | Grandfathered | Order status changes |
| `org_order_item_issues` | `ord` | `org_ord_order_item_issues` | Grandfathered | Order item issues |
| `org_order_item_processing_steps` | `ord` | `org_ord_order_item_processing_steps` | Grandfathered | Order processing steps |

#### Catalog/Products
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_product_data_mst` | `cat` | `org_cat_product_data_mst` | Grandfathered | Tenant products |
| `org_service_category_cf` | `cat` | `org_cat_service_category_cf` | Grandfathered | Service category config |
| `org_price_lists_mst` | `cat` | `org_cat_price_lists_mst` | Grandfathered | Price lists |
| `org_price_list_items_dtl` | `cat` | `org_cat_price_list_items_dtl` | Grandfathered | Price list items |

#### Payments
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_payments_dtl_tr` | `pay` | `org_pay_payments_dtl_tr` | Grandfathered | Payment transactions |

#### Invoices
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_invoice_mst` | `inv` | `org_inv_invoices_mst` | Grandfathered | Tenant invoices |

#### Discounts & Promotions
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_discount_rules_cf` | `dsc` | `org_dsc_discount_rules_cf` | Grandfathered | Discount rules |
| `org_promo_codes_mst` | `dsc` | `org_dsc_promo_codes_mst` | Grandfathered | Promo codes |
| `org_promo_usage_log` | `dsc` | `org_dsc_promo_usage_log` | Grandfathered | Promo usage tracking |

#### Gift Cards
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_gift_cards_mst` | `gft` | `org_gft_gift_cards_mst` | Grandfathered | Gift cards |
| `org_gift_card_transactions` | `gft` | `org_gft_gift_card_transactions` | Grandfathered | Gift card transactions |

#### Workflow
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_workflow_rules` | `wf` | `org_wf_workflow_rules` | Grandfathered | Workflow rules |
| `org_workflow_settings_cf` | `wf` | `org_wf_workflow_settings_cf` | Grandfathered | Workflow settings |
| `org_tenant_workflow_settings_cf` | `wf` | `org_wf_tenant_workflow_settings_cf` | Grandfathered | Tenant workflow settings |
| `org_tenant_workflow_templates_cf` | `wf` | `org_wf_tenant_workflow_templates_cf` | Grandfathered | Tenant workflow templates |
| `org_tenant_service_category_workflow_cf` | `wf` | `org_wf_tenant_service_category_workflow_cf` | Grandfathered | Service category workflows |

#### Settings
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_tenant_settings_cf` | `stng` | `org_stng_tenant_settings_cf` | Grandfathered | Tenant settings |

#### Usage Tracking
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `org_usage_tracking` | `usg` | `org_usg_usage_tracking` | Grandfathered | Usage tracking |

---

## Functions

### System Functions

| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `current_tenant_id()` | `auth` | `sys_auth_current_tenant_id()` | Grandfathered | Get current tenant from JWT |
| `current_user_id()` | `auth` | `sys_auth_current_user_id()` | Grandfathered | Get current user ID |
| `current_user_role()` | `auth` | `sys_auth_current_user_role()` | Grandfathered | Get current user role |
| `is_admin()` | `auth` | `sys_auth_is_admin()` | Grandfathered | Check if user is admin |
| `is_operator()` | `auth` | `sys_auth_is_operator()` | Grandfathered | Check if user is operator/admin |
| `has_tenant_access(p_tenant_id UUID)` | `auth` | `sys_auth_has_tenant_access(p_tenant_id UUID)` | Grandfathered | Check tenant access |
| `get_user_tenants()` | `auth` | `sys_auth_get_user_tenants()` | Grandfathered | Get user's accessible tenants |
| `switch_tenant_context(p_tenant_id UUID)` | `auth` | `sys_auth_switch_tenant_context(p_tenant_id UUID)` | Grandfathered | Switch tenant context |
| `record_login_attempt(...)` | `auth` | `sys_auth_record_login_attempt(...)` | Grandfathered | Record login attempt |
| `log_audit_event(...)` | `aud` | `sys_aud_log_audit_event(...)` | Grandfathered | Log audit event |
| `update_user_last_login()` | `auth` | `sys_auth_update_user_last_login()` | Grandfathered | Update last login |
| `is_account_locked(p_email VARCHAR)` | `auth` | `sys_auth_is_account_locked(p_email VARCHAR)` | Grandfathered | Check if account locked |
| `unlock_account(...)` | `auth` | `sys_auth_unlock_account(...)` | Grandfathered | Unlock account |
| `auto_unlock_expired_accounts()` | `auth` | `sys_auth_auto_unlock_expired_accounts()` | Grandfathered | Auto-unlock expired accounts |
| `cleanup_expired_otp_codes()` | `otp` | `sys_otp_cleanup_expired_codes()` | Grandfathered | Cleanup expired OTP |
| `initialize_new_tenant(...)` | `tnt` | `sys_tnt_initialize_new_tenant(...)` | Grandfathered | Initialize new tenant |
| `trg_auto_initialize_tenant()` | `tnt` | `sys_tnt_auto_initialize_tenant()` | Grandfathered | Auto-initialize tenant trigger |

### Tenant Functions

#### Order Functions
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `cmx_order_items_transition(...)` | `ord` | `org_ord_order_items_transition(...)` | Grandfathered | Order items transition |
| `cmx_order_transition(...)` | `ord` | `org_ord_order_transition(...)` | Grandfathered | Order transition |
| `cmx_validate_transition(...)` | `ord` | `org_ord_validate_transition(...)` | Grandfathered | Validate transition |
| `cmx_get_allowed_transitions(...)` | `ord` | `org_ord_get_allowed_transitions(...)` | Grandfathered | Get allowed transitions |
| `generate_order_number(p_tenant_org_id UUID)` | `ord` | `org_ord_generate_order_number(p_tenant_org_id UUID)` | Grandfathered | Generate order number |
| `get_order_number_prefix()` | `ord` | `org_ord_get_order_number_prefix()` | Grandfathered | Get order prefix |
| `extract_order_sequence(p_order_no TEXT)` | `ord` | `org_ord_extract_order_sequence(p_order_no TEXT)` | Grandfathered | Extract order sequence |
| `log_order_action(...)` | `ord` | `org_ord_log_order_action(...)` | Grandfathered | Log order action |
| `get_order_timeline(p_order_id UUID)` | `ord` | `org_ord_get_order_timeline(p_order_id UUID)` | Grandfathered | Get order timeline |
| `order_has_action(p_order_id UUID, p_action_type TEXT)` | `ord` | `org_ord_order_has_action(p_order_id UUID, p_action_type TEXT)` | Grandfathered | Check order action |
| `fn_auto_log_order_created()` | `ord` | `org_ord_auto_log_order_created()` | Grandfathered | Auto-log order creation |
| `fn_next_order_item_srno(p_tenant uuid, p_order uuid)` | `ord` | `org_ord_next_order_item_srno(p_tenant uuid, p_order uuid)` | Grandfathered | Get next item serial |
| `fn_recalc_order_totals(p_tenant uuid, p_order uuid)` | `ord` | `org_ord_recalc_order_totals(p_tenant uuid, p_order uuid)` | Grandfathered | Recalculate order totals |
| `is_item_all_steps_done(p_order_item_id UUID)` | `ord` | `org_ord_is_item_all_steps_done(p_order_item_id UUID)` | Grandfathered | Check if item steps done |
| `has_unresolved_issues(p_order_item_id UUID)` | `ord` | `org_ord_has_unresolved_issues(p_order_item_id UUID)` | Grandfathered | Check unresolved issues |
| `fn_create_initial_status_history()` | `ord` | `org_ord_create_initial_status_history()` | Grandfathered | Create initial status history |
| `trg_set_order_item_srno()` | `ord` | `org_ord_set_order_item_srno()` | Grandfathered | Set order item serial trigger function |
| `trg_after_item_change_recalc()` | `ord` | `org_ord_after_item_change_recalc()` | Grandfathered | Recalc after item change trigger function |

#### Customer Functions
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `generate_customer_number(p_tenant_org_id UUID)` | `cust` | `org_cust_generate_customer_number(p_tenant_org_id UUID)` | Grandfathered | Generate customer number |
| `update_customer_address_timestamp()` | `cust` | `org_cust_update_address_timestamp()` | Grandfathered | Update address timestamp |
| `ensure_single_default_address()` | `cust` | `org_cust_ensure_single_default_address()` | Grandfathered | Ensure single default address |

#### Catalog Functions
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `get_product_price(...)` | `cat` | `org_cat_get_product_price(...)` | Grandfathered | Get product price |

#### Settings Functions
| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `fn_get_setting_value(...)` | `stng` | `org_stng_get_setting_value(...)` | Grandfathered | Get setting value |
| `fn_is_setting_allowed(...)` | `stng` | `org_stng_is_setting_allowed(...)` | Grandfathered | Check if setting allowed |

---

## Views

| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| *(None found yet - add as discovered)* | - | - | - | - |

---

## Triggers

| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| `trg_after_tenant_insert` | `tnt` | `sys_tnt_after_tenant_insert_trg` | Grandfathered | After tenant insert |
| `trg_update_customer_address_timestamp` | `cust` | `org_cust_update_address_timestamp_trg` | Grandfathered | Update address timestamp |
| `trg_ensure_single_default_address` | `cust` | `org_cust_ensure_single_default_address_trg` | Grandfathered | Ensure single default |
| `trg_order_auto_log_created` | `ord` | `org_ord_order_auto_log_created_trg` | Grandfathered | Auto-log order created |
| `trg_set_order_item_srno` | `ord` | `org_ord_set_order_item_srno_trg` | Grandfathered | Set order item serial |
| `trg_after_item_change_recalc` | `ord` | `org_ord_after_item_change_recalc_trg` | Grandfathered | Recalc after item change |
| `trg_order_initial_status` | `ord` | `org_ord_order_initial_status_trg` | Grandfathered | Create initial status |
| `before_ins_set_order_item_srno` | `ord` | `org_ord_before_ins_set_order_item_srno_trg` | Grandfathered | Before insert set serial |
| `after_ins_items_recalc` | `ord` | `org_ord_after_ins_items_recalc_trg` | Grandfathered | After insert recalc |
| `after_upd_items_recalc` | `ord` | `org_ord_after_upd_items_recalc_trg` | Grandfathered | After update recalc |
| `after_del_items_recalc` | `ord` | `org_ord_after_del_items_recalc_trg` | Grandfathered | After delete recalc |

---

## Sequences

| Current Name | Feature | Would Become | Status | Notes |
|-------------|---------|--------------|--------|-------|
| *(None found yet - add as discovered)* | - | - | - | - |

---

## Migration Status Legend

- **Grandfathered**: Object uses old naming, remains unchanged for now
- **Migrated**: Object has been renamed to new convention (remove from this list)
- **Deprecated**: Object scheduled for removal (mark but keep in list)
- **New**: Object created with new naming (not listed here)

---

## Usage Examples

### ✅ Correct: Referencing Existing Objects

```sql
-- Use exact names from this document
SELECT * FROM org_orders_mst WHERE tenant_org_id = $1;
SELECT * FROM org_order_items_dtl WHERE order_id = $2;
SELECT cmx_order_transition($1, $2, $3);
SELECT generate_order_number($1);
SELECT current_tenant_id();
SELECT is_admin();
```

### ✅ Correct: Creating New Related Objects

```sql
-- Use new naming convention for NEW objects
CREATE TABLE org_ord_order_status_history (...);  -- NEW: uses org_ord_
CREATE FUNCTION org_ord_calculate_discount(...);  -- NEW: uses org_ord_
CREATE VIEW org_ord_pending_orders_vw AS ...;     -- NEW: uses org_ord_
```

### ❌ Incorrect: Using New Names for Existing Objects

```sql
-- DON'T use new names - these objects don't exist yet!
SELECT * FROM org_ord_orders_mst;  -- ❌ WRONG: Should be org_orders_mst
SELECT org_ord_transition_status(...);  -- ❌ WRONG: Should be cmx_order_transition(...)
SELECT sys_auth_current_tenant_id();  -- ❌ WRONG: Should be current_tenant_id()
```

---

## Maintenance

### When to Update This Document

1. **After Migration**: Remove migrated objects from this list
2. **New Objects**: Don't add new objects here (they use new naming)
3. **Deprecation**: Mark deprecated objects but keep in list
4. **Discovery**: Add newly discovered existing objects

### Update Process

1. Update the object's status to "Migrated"
2. Add migration date
3. Remove from list after verification period (1 week)
4. Update version and last_updated date

---

## Related Documentation

- [Database Conventions](./database_conventions.md) - Naming rules for NEW objects
- [Feature Abbreviations](./database_feature_abbreviations.md) - Feature abbreviation list
- [Migration Plan](./database_migration_plan.md) - Migration strategy

---

## Return to [Main Documentation](../CLAUDE.md)

