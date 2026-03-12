---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Permissions Reference

All permission codes in CleanMateX, with descriptions and typical role assignments.

**Source:** `sys_auth_permissions`, `sys_auth_role_default_permissions`, migrations, `docs/master_data/Permissions_To_InsertTo_DB.sql`

## Format

| Code | Name | Name (AR) | Category | Description | Typical Roles |
|------|------|-----------|----------|-------------|---------------|
| `resource:action` | Display name | Arabic | category_main | Description | super_admin, tenant_admin, etc. |

## Orders

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `orders:create` | Create Orders | إنشاء الطلبات | Create new orders | super_admin, tenant_admin, operator |
| `orders:read` | View Orders | عرض الطلبات | View orders | super_admin, tenant_admin, operator |
| `orders:update` | Edit Orders | تعديل الطلبات | Edit order details | super_admin, tenant_admin, operator |
| `orders:delete` | Delete Orders | حذف الطلبات | Delete orders | super_admin, tenant_admin |
| `orders:transition` | Change Order Status | تغيير حالة الطلب | Change order status | super_admin, tenant_admin, operator |
| `orders:cancel` | Cancel Orders | إلغاء الطلبات | Cancel orders | super_admin, tenant_admin, operator |
| `orders:return` | Return Orders | إرجاع الطلبات | Process customer returns | super_admin, tenant_admin, operator |
| `orders:service_prefs_view` | View Service Preferences | عرض تفضيلات الخدمة | View service and packing preferences on orders | super_admin, tenant_admin, operator |
| `orders:service_prefs_edit` | Edit Service Preferences | تعديل تفضيلات الخدمة | Add/remove service and packing preferences on orders | super_admin, tenant_admin, operator |
| `orders:preparation:complete` | Preparation Complete | — | Complete preparation screen | — |
| `orders:processing:complete` | Processing Complete | — | Complete processing screen | — |
| `orders:assembly:complete` | Assembly Complete | — | Complete assembly screen | — |
| `orders:qa:approve` | QA Approve | — | Approve in QA screen | — |
| `orders:qa:reject` | QA Reject | — | Reject in QA screen | — |
| `orders:packing:complete` | Packing Complete | — | Complete packing screen | — |
| `orders:ready:release` | Ready Release | — | Release from ready screen | — |
| `orders:delivery:complete` | Delivery Complete | — | Complete delivery | — |

## Customers

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `customers:create` | Create Customers | إنشاء العملاء | Create customers | super_admin, tenant_admin, operator |
| `customers:read` | View Customers | عرض العملاء | View customers | super_admin, tenant_admin, operator |
| `customers:update` | Edit Customers | تعديل العملاء | Edit customer details | super_admin, tenant_admin, operator |
| `customers:delete` | Delete Customers | حذف العملاء | Delete customers | super_admin, tenant_admin |
| `customers:preferences_manage` | Manage Customer Preferences | إدارة تفضيلات العميل | Manage customer standing preferences | super_admin, tenant_admin |

## Payments

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `payments:cancel` | Cancel Payment | إلغاء الدفع | Cancel a payment and reverse invoice/order balances | super_admin, tenant_admin, operator |
| `payments:refund` | Process Refunds | معالجة الاسترداد | Process refunds | super_admin, tenant_admin, operator |

## Config & Catalog

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `config:preferences_manage` | Manage Preferences Catalog | إدارة كتالوج التفضيلات | Manage service preferences catalog and bundles | super_admin, tenant_admin |
| `catalog:read` | View Catalog | — | View catalog | super_admin, tenant_admin |

## Pricing

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `pricing:override` | Override Price | تجاوز السعر | Override price in new order page | super_admin, tenant_admin, operator |

## Settings

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `settings:read` | View Settings | عرض الإعدادات | View settings | super_admin, tenant_admin |
| `settings:update` | Update Settings | تحديث الإعدادات | Update settings | super_admin, tenant_admin |
| `settings:workflow_roles:view` | View Workflow Roles | — | View workflow roles configuration | super_admin, tenant_admin |

## Drivers & Delivery

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `drivers:read` | View Drivers | عرض السائقين | View drivers | super_admin, tenant_admin |

## Billing & Reports

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `billing:read` | View Billing | — | View billing/invoices/payments | super_admin, tenant_admin, operator |
| `reports:read` | View Reports | — | View reports | super_admin, tenant_admin |
| `inventory:read` | View Inventory | — | View inventory | super_admin, tenant_admin, operator |

## Users & Roles

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `users:read` | View Users | عرض المستخدمين | View users and team members | super_admin, tenant_admin |
| `roles:create` | Create Roles | إنشاء الأدوار | Create custom roles | super_admin, tenant_admin |
| `roles:update` | Edit Roles | تعديل الأدوار | Edit roles | super_admin, tenant_admin |
| `roles:delete` | Delete Roles | حذف الأدوار | Delete custom roles | super_admin, tenant_admin |
| `users:assign_roles` | Assign Roles | تعيين الأدوار | Assign roles to users | super_admin, tenant_admin |

## Admin

| Code | Name | Name (AR) | Description | Typical Roles |
|------|------|-----------|-------------|---------------|
| `admin:read` | Admin Read | — | Admin-level read (e.g., JWT health) | super_admin |

## Wildcard

| Code | Name | Description | Typical Roles |
|------|------|-------------|---------------|
| `*:*` | All Permissions | Super admin wildcard — bypasses all permission checks | super_admin |

## See Also

- [PERMISSIONS_BY_MODULE](PERMISSIONS_BY_MODULE.md)
- [PERMISSIONS_BY_SCREEN](PERMISSIONS_BY_SCREEN.md)
- [PERMISSIONS_BY_API](PERMISSIONS_BY_API.md)
- [docs/features/RBAC/QUICK_REFERENCE.md](../../features/RBAC/QUICK_REFERENCE.md)
