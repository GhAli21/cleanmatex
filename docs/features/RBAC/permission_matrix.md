# Permission Matrix - CleanMateX RBAC System

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Status:** Complete Permission Catalog

---

## 📋 Overview

This document provides a complete catalog of all permissions in the CleanMateX RBAC system, organized by resource type with role mappings.

**Permission Format:** `resource:action`

---

## 🎯 Permission Categories

1. **Orders Management** (16 permissions)
2. **Customers Management** (10 permissions)
3. **Products & Catalog** (8 permissions)
4. **Pricing Management** (7 permissions)
5. **Users & Roles** (10 permissions)
6. **Invoices & Billing** (9 permissions)
7. **Payments** (7 permissions)
8. **Reports & Analytics** (12 permissions)
9. **Settings & Configuration** (15 permissions)
10. **Drivers & Delivery** (8 permissions)
11. **Branches** (6 permissions)
12. **Integrations** (6 permissions)
13. **Audit & Logs** (4 permissions)

**Total:** 118+ permissions

---

## 1️⃣ Orders Management

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `orders:create` | Create new orders | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:read` | View orders | ✅ | ✅ | ✅ | ✅ | ✅ |
| `orders:update` | Edit order details | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:delete` | Delete orders | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders:cancel` | Cancel orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders:split` | Split orders | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:merge` | Merge orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders:transition` | Change order status | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:assign` | Assign to staff/driver | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders:export` | Export order data | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders:print` | Print receipts/labels | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:refund` | Process refunds | ✅ | ✅ | ✅ | ❌ | ❌ |
| `orders:discount` | Apply discounts | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:notes` | Add internal notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| `orders:history` | View full history | ✅ | ✅ | ✅ | ✅ | ✅ |
| `orders:urgent` | Mark as urgent | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 2️⃣ Customers Management

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `customers:create` | Create customers | ✅ | ✅ | ✅ | ✅ | ❌ |
| `customers:read` | View customers | ✅ | ✅ | ✅ | ✅ | ✅ |
| `customers:update` | Edit customer details | ✅ | ✅ | ✅ | ✅ | ❌ |
| `customers:delete` | Delete customers | ✅ | ✅ | ❌ | ❌ | ❌ |
| `customers:export` | Export customer data | ✅ | ✅ | ❌ | ❌ | ❌ |
| `customers:merge` | Merge duplicate customers | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers:upgrade` | Upgrade customer profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| `customers:loyalty` | Manage loyalty points | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers:tags` | Add/edit customer tags | ✅ | ✅ | ✅ | ✅ | ❌ |
| `customers:history` | View order history | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3️⃣ Products & Catalog

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `products:create` | Create products/services | ✅ | ✅ | ❌ | ❌ | ❌ |
| `products:read` | View catalog | ✅ | ✅ | ✅ | ✅ | ✅ |
| `products:update` | Edit products | ✅ | ✅ | ❌ | ❌ | ❌ |
| `products:delete` | Delete products | ✅ | ✅ | ❌ | ❌ | ❌ |
| `products:categories` | Manage categories | ✅ | ✅ | ❌ | ❌ | ❌ |
| `products:publish` | Publish/unpublish | ✅ | ✅ | ❌ | ❌ | ❌ |
| `products:stock` | Manage stock levels | ✅ | ✅ | ✅ | ❌ | ❌ |
| `products:export` | Export catalog | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4️⃣ Pricing Management

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `pricing:create` | Create price lists | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pricing:read` | View pricing | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pricing:update` | Update prices | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pricing:delete` | Delete price lists | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pricing:tiers` | Manage pricing tiers | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pricing:bulk` | Bulk price updates | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pricing:history` | View price history | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 5️⃣ Users & Roles

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `users:create` | Create users | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:read` | View users | ✅ | ✅ | ✅ | ❌ | ❌ |
| `users:update` | Edit user details | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:delete` | Delete users | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:activate` | Activate/deactivate | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:assign_roles` | Assign roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users:reset_password` | Reset passwords | ✅ | ✅ | ❌ | ❌ | ❌ |
| `roles:create` | Create custom roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| `roles:update` | Edit roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| `roles:delete` | Delete custom roles | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 6️⃣ Invoices & Billing

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `invoices:create` | Generate invoices | ✅ | ✅ | ✅ | ✅ | ❌ |
| `invoices:read` | View invoices | ✅ | ✅ | ✅ | ✅ | ✅ |
| `invoices:update` | Edit invoices | ✅ | ✅ | ✅ | ❌ | ❌ |
| `invoices:void` | Void invoices | ✅ | ✅ | ✅ | ❌ | ❌ |
| `invoices:send` | Send to customer | ✅ | ✅ | ✅ | ✅ | ❌ |
| `invoices:print` | Print invoices | ✅ | ✅ | ✅ | ✅ | ❌ |
| `invoices:export` | Export invoice data | ✅ | ✅ | ❌ | ❌ | ❌ |
| `invoices:credit_note` | Issue credit notes | ✅ | ✅ | ✅ | ❌ | ❌ |
| `invoices:recurring` | Manage recurring | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 7️⃣ Payments

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `payments:create` | Record payments | ✅ | ✅ | ✅ | ✅ | ❌ |
| `payments:read` | View payments | ✅ | ✅ | ✅ | ✅ | ✅ |
| `payments:refund` | Process refunds | ✅ | ✅ | ✅ | ❌ | ❌ |
| `payments:void` | Void payments | ✅ | ✅ | ❌ | ❌ | ❌ |
| `payments:reconcile` | Reconcile payments | ✅ | ✅ | ✅ | ❌ | ❌ |
| `payments:export` | Export payment data | ✅ | ✅ | ❌ | ❌ | ❌ |
| `payments:methods` | Manage payment methods | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 8️⃣ Reports & Analytics

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `reports:view_financial` | View financial reports | ✅ | ✅ | ✅ | ❌ | ✅ |
| `reports:view_operational` | View operational reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reports:view_customer` | View customer reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reports:view_staff` | View staff reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| `reports:export` | Export reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports:schedule` | Schedule reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports:custom` | Create custom reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports:dashboard` | View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics:view` | View analytics | ✅ | ✅ | ✅ | ❌ | ✅ |
| `analytics:export` | Export analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| `analytics:kpi` | View KPIs | ✅ | ✅ | ✅ | ❌ | ✅ |
| `analytics:trends` | View trend analysis | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 9️⃣ Settings & Configuration

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `settings:read` | View settings | ✅ | ✅ | ✅ | ❌ | ❌ |
| `settings:update` | Update settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:organization` | Org settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:billing` | Billing settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:workflow` | Workflow config | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:notifications` | Notification settings | ✅ | ✅ | ✅ | ❌ | ❌ |
| `settings:integrations` | Integration config | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:branding` | Branding settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:security` | Security settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:api` | API settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:webhooks` | Webhook config | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:subscription` | Subscription mgmt | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:features` | Feature flags | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:localization` | Language/timezone | ✅ | ✅ | ❌ | ❌ | ❌ |
| `settings:tax` | Tax configuration | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔟 Drivers & Delivery

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `drivers:create` | Create driver profiles | ✅ | ✅ | ✅ | ❌ | ❌ |
| `drivers:read` | View drivers | ✅ | ✅ | ✅ | ✅ | ✅ |
| `drivers:update` | Edit driver details | ✅ | ✅ | ✅ | ❌ | ❌ |
| `drivers:delete` | Delete drivers | ✅ | ✅ | ❌ | ❌ | ❌ |
| `delivery:assign` | Assign deliveries | ✅ | ✅ | ✅ | ✅ | ❌ |
| `delivery:track` | Track deliveries | ✅ | ✅ | ✅ | ✅ | ✅ |
| `delivery:routes` | Manage routes | ✅ | ✅ | ✅ | ❌ | ❌ |
| `delivery:pod` | Proof of delivery | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 1️⃣1️⃣ Branches

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `branches:create` | Create branches | ✅ | ✅ | ❌ | ❌ | ❌ |
| `branches:read` | View branches | ✅ | ✅ | ✅ | ✅ | ✅ |
| `branches:update` | Edit branches | ✅ | ✅ | ❌ | ❌ | ❌ |
| `branches:delete` | Delete branches | ✅ | ✅ | ❌ | ❌ | ❌ |
| `branches:transfer` | Transfer orders/items | ✅ | ✅ | ✅ | ❌ | ❌ |
| `branches:settings` | Branch settings | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 1️⃣2️⃣ Integrations

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `integrations:read` | View integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| `integrations:create` | Add integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| `integrations:update` | Edit integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| `integrations:delete` | Remove integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| `integrations:test` | Test connections | ✅ | ✅ | ❌ | ❌ | ❌ |
| `integrations:logs` | View integration logs | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 1️⃣3️⃣ Audit & Logs

| Permission | Description | super_admin | tenant_admin | branch_manager | operator | viewer |
|------------|-------------|:-----------:|:------------:|:--------------:|:--------:|:------:|
| `audit:read` | View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| `audit:export` | Export audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| `logs:view` | View system logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| `logs:export` | Export logs | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🎭 Workflow Permissions (Separate System)

Workflow roles control order processing steps, managed separately:

| Workflow Role | Purpose | Permissions |
|---------------|---------|-------------|
| `ROLE_RECEPTION` | Order intake/delivery | Access reception screens, create orders, mark delivered |
| `ROLE_PREPARATION` | Item prep | Access prep screens, tag items, transition to processing |
| `ROLE_PROCESSING` | Wash/iron | Access processing screens, assemble orders |
| `ROLE_QA` | Quality check | Access QA screens, pass/fail items |
| `ROLE_DELIVERY` | Deliveries | Access delivery screens, manage routes, POD |
| `ROLE_ADMIN` | Full workflow access | Access all workflow screens and transitions |

---

## 📊 Permission Summary by Role

### Super Admin
- **Total Permissions:** ALL (wildcard `*:*`)
- **Scope:** All tenants
- **Purpose:** Platform management

### Tenant Admin
- **Total Permissions:** ~110 (all tenant permissions)
- **Scope:** Single tenant
- **Purpose:** Tenant owner/administrator

### Branch Manager
- **Total Permissions:** ~45 (branch-scoped)
- **Scope:** Single branch
- **Purpose:** Branch operations manager

### Operator
- **Total Permissions:** ~35 (operational)
- **Scope:** Branch/tenant
- **Purpose:** Daily operations

### Viewer
- **Total Permissions:** ~25 (read-only)
- **Scope:** Tenant
- **Purpose:** View-only access

---

## 🔧 Permission Seeding

### SQL Seed Script Example

```sql
-- Insert permissions
INSERT INTO sys_auth_permissions (id, resource, action, description, category) VALUES
('orders:create', 'orders', 'create', 'Create new orders', 'crud'),
('orders:read', 'orders', 'read', 'View orders', 'crud'),
('orders:update', 'orders', 'update', 'Edit orders', 'crud'),
('orders:delete', 'orders', 'delete', 'Delete orders', 'crud'),
('orders:cancel', 'orders', 'cancel', 'Cancel orders', 'action'),
-- ... more permissions

-- Create roles
INSERT INTO sys_auth_roles (id, code, name, description, is_system) VALUES
(gen_random_uuid(), 'super_admin', 'Super Administrator', 'Platform admin', true),
(gen_random_uuid(), 'tenant_admin', 'Tenant Administrator', 'Tenant owner', true),
(gen_random_uuid(), 'operator', 'Operator', 'Standard worker', true),
(gen_random_uuid(), 'viewer', 'Viewer', 'Read-only access', true);

-- Assign permissions to roles
-- (See migration scripts for complete mappings)
```

---

## 📚 Related Documentation

- [RBAC Architecture](./rbac_architecture.md) - Complete RBAC design
- [User Roles Guide](./user_roles_guide.md) - User role system
- [Workflow Roles Guide](./workflow_roles_guide.md) - Workflow roles
- [Migration Plan](./migration_plan.md) - Implementation steps

---

**Status:** ✅ Complete Permission Catalog
**Total Permissions:** 118+ defined
**Next Step:** Implement database schema and seed data
