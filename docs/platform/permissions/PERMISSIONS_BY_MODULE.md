---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Permissions by Module

Permissions grouped by resource prefix (module).

## orders:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `orders:read` | Orders list, Preparation, Processing, Assembly, QA, Ready, Packing, Delivery, Catalog preferences | GET /orders, GET /orders/[id]/*, GET /catalog/*, GET /preferences/* | — |
| `orders:create` | New Order | POST /orders, POST /orders/create-with-payment, POST /orders/preview-payment | — |
| `orders:update` | Edit order, Preparation, Pieces | PATCH /orders/[id]/update, PATCH /orders/[id]/batch-update, POST /orders/[id]/transition, PATCH /orders/[id]/items/*, POST /preparation/* | — |
| `orders:delete` | — | DELETE /orders/[id]/items/[itemId]/pieces/[pieceId] | — |
| `orders:transition` | — | POST /orders/[id]/transition | — |
| `orders:service_prefs_view` | Catalog preferences | — | — |
| `orders:service_prefs_edit` | — | — | Service prefs on order items | 
| `orders:preparation:complete` | Preparation | — | — |
| `orders:processing:complete` | Processing | — | — |
| `orders:assembly:complete` | Assembly | — | — |
| `orders:qa:approve`, `orders:qa:reject` | QA | — | — |
| `orders:packing:complete` | Packing | — | — |
| `orders:ready:release` | Ready | — | — |
| `orders:delivery:complete` | Delivery | — | — |
| `orders:cancel` | Cancel screen | — | — |
| `orders:return` | Return screen | — | — |

## customers:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `customers:read` | Customers | GET /customers, GET /customers/[id], GET /tenant-settings/default-guest-customer | — |
| `customers:create` | — | POST /customers | — |
| `customers:update` | Customer detail | PATCH /customers/[id], PATCH /customers/[id]/service-prefs | — |
| `customers:delete` | — | DELETE /customers/[id] | — |
| `customers:preferences_manage` | Customer prefs tab | — | — |

## payments:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `payments:cancel` | Payment detail | Server action: cancelPaymentAction | Cancel button |
| `payments:refund` | Payments table, Payment detail | Server action: refundPaymentAction | Refund button |

## config:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `config:preferences_manage` | Catalog preferences | POST/DELETE /catalog/preference-bundles, PATCH/DELETE /catalog/preference-bundles/[id] | Add/Edit/Delete bundle buttons |

## pricing:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `pricing:override` | New order | — (lib/db/orders.ts) | Price override in new order modal |

## settings:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `settings:read` | Settings pages | — | — |
| `settings:workflow_roles:view` | Workflow roles settings | — | — |

## drivers:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `drivers:read` | Drivers, Routes | — | — |

## admin:*

| Permission | Screens | APIs | UI Elements |
|------------|---------|------|-------------|
| `admin:read` | — | GET /api/admin/jwt-health | — |

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_SCREEN](PERMISSIONS_BY_SCREEN.md)
- [PERMISSIONS_BY_API](PERMISSIONS_BY_API.md)
