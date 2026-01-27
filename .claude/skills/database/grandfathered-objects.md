# Grandfathered Database Objects Registry

**Purpose**: Complete list of existing database objects that use the **old naming convention** (without feature grouping).

**CRITICAL**:
- Use these exact names when referencing existing objects
- Do NOT use feature-grouped names for these objects (they don't exist yet)
- When creating NEW related objects, use the new naming convention with feature grouping

## Tables

### System Tables (sys_*)

| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `sys_payment_method_cd` | `pay` | `sys_pay_payment_method_cd` |
| `sys_payment_type_cd` | `pay` | `sys_pay_payment_type_cd` |
| `sys_order_type_cd` | `ord` | `sys_ord_order_type_cd` |
| `sys_service_category_cd` | `cat` | `sys_cat_service_category_cd` |
| `sys_customers_mst` | `cust` | `sys_cust_customers_mst` |
| `sys_plan_limits` | `pln` | `sys_pln_plan_limits` |
| `sys_tenant_settings_cd` | `stng` | `sys_stng_tenant_settings_cd` |
| `sys_workflow_template_cd` | `wf` | `sys_wf_workflow_template_cd` |
| `sys_audit_log` | `aud` | `sys_aud_audit_log` |
| `sys_otp_codes` | `otp` | `sys_otp_codes` |

### Tenant Tables (org_*)

#### Core/Tenant Management
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `org_tenants_mst` | `tnt` | `org_tnt_tenants_mst` |
| `org_subscriptions_mst` | `pln` | `org_pln_subscriptions_mst` |
| `org_branches_mst` | `brn` | `org_brn_branches_mst` |

#### Orders
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `org_orders_mst` | `ord` | `org_ord_orders_mst` |
| `org_order_items_dtl` | `ord` | `org_ord_order_items_dtl` |
| `org_order_history` | `ord` | `org_ord_order_history` |
| `org_order_status_history` | `ord` | `org_ord_order_status_history` |
| `org_order_item_issues` | `ord` | `org_ord_order_item_issues` |
| `org_order_item_processing_steps` | `ord` | `org_ord_order_item_processing_steps` |

#### Customers
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `org_customers_mst` | `cust` | `org_cust_customers_mst` |
| `org_customer_addresses` | `cust` | `org_cust_customer_addresses` |

#### Catalog/Products
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `org_product_data_mst` | `cat` | `org_cat_product_data_mst` |
| `org_service_category_cf` | `cat` | `org_cat_service_category_cf` |
| `org_price_lists_mst` | `cat` | `org_cat_price_lists_mst` |

#### Payments & Invoices
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `org_payments_dtl_tr` | `pay` | `org_pay_payments_dtl_tr` |
| `org_invoice_mst` | `inv` | `org_inv_invoices_mst` |

## Functions

### System Functions
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `current_tenant_id()` | `auth` | `sys_auth_current_tenant_id()` |
| `current_user_id()` | `auth` | `sys_auth_current_user_id()` |
| `current_user_role()` | `auth` | `sys_auth_current_user_role()` |
| `is_admin()` | `auth` | `sys_auth_is_admin()` |
| `is_operator()` | `auth` | `sys_auth_is_operator()` |

### Order Functions
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `cmx_order_items_transition(...)` | `ord` | `org_ord_order_items_transition(...)` |
| `cmx_order_transition(...)` | `ord` | `org_ord_order_transition(...)` |
| `cmx_validate_transition(...)` | `ord` | `org_ord_validate_transition(...)` |
| `generate_order_number(p_tenant_org_id UUID)` | `ord` | `org_ord_generate_order_number(...)` |
| `fn_recalc_order_totals(p_tenant uuid, p_order uuid)` | `ord` | `org_ord_recalc_order_totals(...)` |

### Customer Functions
| Current Name | Feature | Would Become |
|-------------|---------|--------------|
| `generate_customer_number(p_tenant_org_id UUID)` | `cust` | `org_cust_generate_customer_number(...)` |

## Usage Examples

### CORRECT: Referencing Existing Objects

```sql
-- Use exact names from this document
SELECT * FROM org_orders_mst WHERE tenant_org_id = $1;
SELECT * FROM org_order_items_dtl WHERE order_id = $2;
SELECT cmx_order_transition($1, $2, $3);
SELECT generate_order_number($1);
SELECT current_tenant_id();
SELECT is_admin();
```

### CORRECT: Creating New Related Objects

```sql
-- Use new naming convention for NEW objects
CREATE TABLE org_ord_order_status_history (...);
CREATE FUNCTION org_ord_calculate_discount(...);
CREATE VIEW org_ord_pending_orders_vw AS ...;
```

### INCORRECT: Using New Names for Existing Objects

```sql
-- DON'T use new names - these objects don't exist yet!
SELECT * FROM org_ord_orders_mst;  -- WRONG: Should be org_orders_mst
SELECT org_ord_transition_status(...);  -- WRONG: Should be cmx_order_transition(...)
SELECT sys_auth_current_tenant_id();  -- WRONG: Should be current_tenant_id()
```
