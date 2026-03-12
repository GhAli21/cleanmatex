---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Navigation Permissions

Navigation items and their permission/role requirements from `sys_components_cd`.

**Source:** `supabase/migrations/0059_navigation_seed.sql`, `0141_navigation_catalog_preferences.sql`, `docs/navigation/add_sys_comp.sql`

## Table

| comp_code | comp_path | main_permission_code | roles | feature_flag |
|-----------|-----------|----------------------|-------|--------------|
| home | /dashboard | (none) | admin, operator | — |
| orders | /dashboard/orders | orders:read | admin, operator | — |
| orders_list | /dashboard/orders | orders:read | admin, operator | — |
| orders_new | /dashboard/orders/new | orders:create | admin, operator | — |
| orders_preparation | /dashboard/preparation | orders:read | admin, operator | — |
| orders_processing | /dashboard/processing | orders:read | admin, operator | — |
| orders_assembly | /dashboard/assembly | orders:read | admin, operator | — |
| orders_qa | /dashboard/qa | orders:read | admin, operator | — |
| orders_ready | /dashboard/ready | orders:read | admin, operator | — |
| orders_packing | /dashboard/packing | orders:read | super_admin, tenant_admin, admin, operator | — |
| orders_delivery | /dashboard/delivery | orders:read | — | — |
| assembly | /dashboard/assembly | orders:read | admin, operator | — |
| drivers | /dashboard/drivers | drivers:read | admin | driver_app |
| drivers_list | /dashboard/drivers | drivers:read | admin | driver_app |
| drivers_routes | /dashboard/drivers/routes | drivers:read | admin | driver_app |
| customers | /dashboard/customers | customers:read | admin, operator | — |
| catalog | /dashboard/catalog | catalog:read | admin | — |
| catalog_services | /dashboard/catalog/services | catalog:read | admin | — |
| catalog_pricing | /dashboard/catalog/pricing | catalog:read | admin | — |
| catalog_addons | /dashboard/catalog/addons | catalog:read | admin | — |
| catalog_preferences | /dashboard/catalog/preferences | config:preferences_manage | super_admin, tenant_admin | — |
| catalog_pricing_detail | /dashboard/catalog/pricing/[id] | catalog:read | admin | — |
| billing | /dashboard/billing | billing:read | admin, operator | — |
| billing_invoices | /dashboard/billing/invoices | billing:read | admin, operator | — |
| billing_payments | /dashboard/billing/payments | billing:read | admin, operator | — |
| billing_cashup | /dashboard/billing/cashup | billing:read | admin, operator | — |
| reports | /dashboard/reports | reports:read | admin | advanced_analytics |
| inventory | /dashboard/inventory | inventory:read | admin, operator | — |
| inventory_stock | /dashboard/inventory/stock | inventory:read | admin, operator | — |
| inventory_machines | /dashboard/inventory/machines | inventory:read | admin | — |
| settings | /dashboard/settings | settings:read | admin | — |
| settings_general | /dashboard/settings/general | settings:read | admin | — |
| settings_users | /dashboard/settings/users | settings:read | admin | — |
| settings_roles | /dashboard/settings/roles | settings:read | admin | — |
| settings_workflow_roles | /dashboard/settings/workflow-roles | settings:read | admin | — |
| settings_branding | /dashboard/settings/branding | settings:read | admin | — |
| settings_subscription | /dashboard/settings/subscription | settings:read | admin | — |
| settings_finance | /dashboard/settings/finance | settings:read | admin, super_admin, tenant_admin | — |
| settings_navigation | /dashboard/settings/navigation | — | — | — |
| help | /dashboard/help | (none) | admin, operator | — |
| jhtestui | /dashboard/jhtestui | (none) | admin | — |

## Resolution

- **Navigation service:** `web-admin/lib/services/navigation.service.ts` — uses `get_navigation_with_parents_jh` RPC with `p_user_permissions` to filter by `main_permission_code`
- **API:** `web-admin/app/api/navigation/route.ts` — loads permissions via `get_user_permissions` RPC and passes to navigation service
- User must have `main_permission_code` (or `*:*`) to see the item; `roles` is also checked for role-based visibility

## See Also

- [PERMISSIONS_BY_SCREEN](PERMISSIONS_BY_SCREEN.md)
- [NAVIGATION_FEATURE_FLAGS](../feature_flags/NAVIGATION_FEATURE_FLAGS.md)
