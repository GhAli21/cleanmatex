---
version: v1.0.0
last_updated: 2026-03-26
author: CleanMateX Team
---

# All Contract-Aligned UI Permissions

Master inventory for active `web-admin` dashboard route and action access contracts.

Linked backend APIs for these pages are documented in [PERMISSIONS_BY_API.md](./PERMISSIONS_BY_API.md). Page contracts may include `apiDependencies`, but this inventory stays focused on UI route and action access.

Legend:
- `None` = no explicit UI permission gate
- `Flag:` = feature-flag requirement
- `Workflow:` = workflow-role requirement
- `Tenant:` = tenant-role requirement

## Core

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard` | Dashboard | None | None | None | None | No explicit UI permission gate |
| `/dashboard/help` | Help | None | None | None | None | No explicit UI permission gate |
| `/dashboard/jhtestui` | JWT Test | None | None | None | None | Debug route |
| `/dashboard/subscription` | Subscription | None | None | None | None | No explicit UI permission gate |
| `/dashboard/customers` | Customers | None | None | None | `Use B2B customer options` → Flag: `b2b_contracts` | Page is open; B2B options are gated |
| `/dashboard/customers/[id]` | Customer Details | None | None | None | None | No explicit UI permission gate |
| `/dashboard/users` | Users | None | None | None | None | No explicit UI permission gate |
| `/dashboard/users/new` | New User | None | None | None | None | No explicit UI permission gate |
| `/dashboard/users/[userId]` | User Details | None | None | None | None | No explicit UI permission gate |
| `/dashboard/inventory` | Inventory | None | None | None | None | No explicit UI permission gate |
| `/dashboard/inventory/stock` | Inventory Stock | None | None | None | None | No explicit UI permission gate |
| `/dashboard/reports` | Reports | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/orders` | Orders Report | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/payments` | Payments Report | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/invoices` | Invoices Report | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/revenue` | Revenue Report | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/customers` | Customers Report | None | `advanced_analytics` | None | None | Feature-flag page gate |
| `/dashboard/reports/print` | Print Reports | None | `advanced_analytics` | None | None | Feature-flag page gate |

## B2B

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard/b2b/customers` | B2B Customers | `b2b_customers:view` | `b2b_contracts` | None | None | Contract-backed page gate |
| `/dashboard/b2b/customers/new` | New B2B Customer | `b2b_customers:view` | `b2b_contracts` | None | None | Relies on route contract plus backend |
| `/dashboard/b2b/customers/[id]` | B2B Customer Details | `b2b_customers:view` | `b2b_contracts` | None | None | Relies on route contract plus backend |
| `/dashboard/b2b/customers/[id]/edit` | Edit B2B Customer | `b2b_customers:view` | `b2b_contracts` | None | None | Relies on route contract plus backend |
| `/dashboard/b2b/contracts` | B2B Contracts | `b2b_contracts:view` | `b2b_contracts` | None | `Create contract` → `b2b_contracts:create` | Contract-backed page and action gate |
| `/dashboard/b2b/statements` | B2B Statements | `b2b_statements:view` | `b2b_contracts` | None | None | Contract-backed page gate |
| `/dashboard/b2b/statements/[id]` | B2B Statement Details | `b2b_statements:view` | `b2b_contracts` | None | None | Relies on route contract plus backend |

## Billing

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard/billing/invoices` | Invoices | None | None | None | `Filter B2B invoices` → Flag: `b2b_contracts` | Open page with gated filter behavior |
| `/dashboard/billing/invoices/[id]` | Invoice Details | None | None | None | None | No explicit page gate |
| `/dashboard/billing/payments` | Payments | None | None | None | `Cancel payment` → `payments:cancel`; `Refund payment` → `payments:refund` | Open page with gated row actions |
| `/dashboard/billing/payments/new` | New Payment | None | None | None | None | No explicit page gate |
| `/dashboard/billing/payments/[id]` | Payment Details | None | None | None | `Cancel payment` → `payments:cancel`; `Refund payment` → `payments:refund` | Open page with gated detail actions |
| `/dashboard/billing/payments/[id]/print/receipt-voucher` | Print Receipt Voucher | None | None | None | None | No explicit page gate |
| `/dashboard/billing/vouchers` | Receipt Vouchers | None | None | None | None | No explicit page gate |
| `/dashboard/billing/vouchers/new` | New Receipt Voucher | None | None | None | None | No explicit page gate |
| `/dashboard/billing/cashup` | Cash Up | None | None | None | None | No explicit page gate |

## Catalog

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard/catalog/services` | Catalog Services | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/services/new` | New Catalog Service | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/services/[id]` | Catalog Service Details | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/pricing` | Catalog Pricing | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/pricing/[id]` | Pricing Details | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/addons` | Catalog Add-ons | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/categories` | Catalog Categories | None | None | None | None | No explicit page gate |
| `/dashboard/catalog/preferences` | Preferences Catalog | `orders:service_prefs_view` OR `orders:read` OR `config:preferences_manage` | None | None | `Edit service preferences` → `config:preferences_manage`; `Edit packing preferences` → `config:preferences_manage`; `Create, edit, and delete bundles` → `config:preferences_manage`; `Edit preference kinds` → `config:preferences_manage` | Page allows viewers and managers |
| `/dashboard/catalog/customer-categories` | Customer Categories | `config:preferences_manage` | None | None | `Create, edit, and delete customer categories` → `config:preferences_manage` | Explicit page and action gate |

## Orders And Workflow

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard/orders` | Orders | None | None | None | None | No explicit page gate |
| `/dashboard/orders/new` | New Order | None | None | None | `Use price override controls` → `pricing:override`; `Use B2B customer options` → Flag: `b2b_contracts` | Action-only gates |
| `/dashboard/orders/[id]` | Order Details | None | None | None | None | No explicit page gate |
| `/dashboard/orders/[id]/edit` | Edit Order | None | None | None | None | No explicit page gate |
| `/dashboard/orders/[id]/prepare` | Prepare Order | None | None | None | None | No explicit page gate |
| `/dashboard/orders/[id]/full` | Full Order Details | None | None | None | None | No explicit page gate |
| `/dashboard/preparation` | Preparation | None | None | None | None | No explicit page gate |
| `/dashboard/preparation/[orderId]` | Preparation Details | None | None | None | None | No explicit page gate |
| `/dashboard/processing` | Processing | None | None | None | None | No explicit page gate |
| `/dashboard/processing/[id]` | Processing Details | None | None | None | None | No explicit page gate |
| `/dashboard/assembly` | Assembly | None | None | None | None | No explicit page gate |
| `/dashboard/assembly/[id]` | Assembly Details | None | None | None | None | No explicit page gate |
| `/dashboard/qa` | Quality Check | None | None | None | None | No explicit page gate |
| `/dashboard/qa/[id]` | Quality Check Details | None | None | None | None | No explicit page gate |
| `/dashboard/ready` | Ready | None | None | None | None | No explicit page gate |
| `/dashboard/ready/[id]` | Ready Details | None | None | None | None | No explicit page gate |
| `/dashboard/ready/[id]/print/[type]` | Print Ready Document | None | None | None | None | No explicit page gate |
| `/dashboard/packing` | Packing | None | None | None | None | No explicit page gate |
| `/dashboard/packing/[id]` | Packing Details | None | None | None | None | No explicit page gate |
| `/dashboard/delivery` | Delivery | None | None | None | None | No explicit page gate |
| `/dashboard/receipts/[orderId]` | Receipt Details | None | None | None | None | No explicit page gate |

## Settings

| Route | Page Label | Page Gate | Feature Flags | Workflow Roles | Action Gates | Notes |
|---|---|---|---|---|---|---|
| `/dashboard/settings` | Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/general` | General Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/allsettings` | All Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/users` | Settings Users | None | None | None | None | No explicit page gate |
| `/dashboard/settings/branding` | Branding Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/subscription` | Settings Subscription | None | None | None | None | No explicit page gate |
| `/dashboard/settings/finance` | Finance Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/navigation` | Navigation Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/preferences` | Settings Preferences | None | None | None | None | No explicit page gate |
| `/dashboard/settings/branches/[id]` | Branch Settings | None | None | None | None | No explicit page gate |
| `/dashboard/settings/workflows` | Workflows | None | None | None | None | No explicit page gate |
| `/dashboard/settings/workflows/new` | New Workflow | None | None | None | None | No explicit page gate |
| `/dashboard/settings/workflows/[id]/edit` | Edit Workflow | None | None | None | None | No explicit page gate |
| `/dashboard/settings/workflow-roles` | Workflow Roles | `settings:workflow_roles:view` | None | None | None | Explicit page gate |
| `/dashboard/settings/roles` | Roles Management | `*:*` OR `settings:*` OR prefix `roles:` OR tenant role `admin` OR tenant role `tenant_admin` | None | None | None | Declarative page gate |
| `/dashboard/settings/permissions` | Permissions Management | `*:*` OR `settings:*` OR prefix `permissions:` OR tenant role `admin` OR tenant role `tenant_admin` | None | None | None | Declarative page gate |
