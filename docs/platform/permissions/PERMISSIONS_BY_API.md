---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Permissions by API Route

Required permissions per API route.

**Source:** requirePermission, requireTenantAuth in `web-admin/app/api/**`

## Format

| Method | Route | Permission(s) | Notes |
|--------|-------|---------------|-------|
| GET | /api/v1/... | permission:action | — |

## Orders

| Method | Route | Permission(s) |
|--------|-------|---------------|
| POST | /api/v1/orders | orders:create |
| GET | /api/v1/orders | orders:read |
| PATCH | /api/v1/orders/[id]/update | orders:update |
| PATCH | /api/v1/orders/[id]/batch-update | orders:update |
| POST | /api/v1/orders/[id]/transition | orders:transition |
| POST | /api/v1/orders/create-with-payment | orders:create |
| POST | /api/v1/orders/preview-payment | orders:create |
| GET | /api/v1/orders/[id]/workflow-context | orders:read |
| GET | /api/v1/orders/[id]/pieces | orders:read |
| POST | /api/v1/orders/[id]/pieces | orders:create |
| PATCH | /api/v1/orders/[id]/pieces | orders:update |
| GET | /api/v1/orders/[id]/items/[itemId]/pieces | orders:read |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces | orders:create |
| PATCH | /api/v1/orders/[id]/items/[itemId]/pieces | orders:update |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces/sync | orders:update |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces/scan | orders:read |
| GET | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId] | orders:read |
| PATCH | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId] | orders:update |
| DELETE | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId] | orders:delete |
| GET | /api/v1/orders/[id]/items/[itemId]/service-prefs | orders:read |
| POST | /api/v1/orders/[id]/items/[itemId]/service-prefs | orders:update |
| PATCH | /api/v1/orders/[id]/items/[itemId]/service-prefs | orders:update |
| PATCH | /api/v1/orders/[id]/items/[itemId]/packing-pref | orders:update |
| POST | /api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode] | orders:update | 403 when bundles_enabled=false |
| GET | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | orders:read |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | orders:update |
| PATCH | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | orders:update |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs/confirm | orders:update |

## Preparation

| Method | Route | Permission(s) |
|--------|-------|---------------|
| POST | /api/v1/preparation/[id]/complete | orders:update (requireTenantAuth) |
| GET | /api/v1/preparation/[id]/items/[itemId] | orders:update (requireTenantAuth) |
| PATCH | /api/v1/preparation/[id]/items/[itemId] | orders:update (requireTenantAuth) |

## Customers

| Method | Route | Permission(s) |
|--------|-------|---------------|
| POST | /api/v1/customers | customers:create |
| GET | /api/v1/customers | customers:read |
| GET | /api/v1/customers/[id] | customers:read |
| PATCH | /api/v1/customers/[id] | customers:update |
| DELETE | /api/v1/customers/[id] | customers:delete |
| GET | /api/v1/customers/[id]/service-prefs | customers:read |
| POST | /api/v1/customers/[id]/service-prefs | customers:update |
| PATCH | /api/v1/customers/[id]/service-prefs | customers:update |

## Catalog & Preferences

| Method | Route | Permission(s) |
|--------|-------|---------------|
| GET | /api/v1/catalog/service-preferences | orders:read |
| GET | /api/v1/catalog/packing-preferences | orders:read |
| GET | /api/v1/catalog/preference-bundles | orders:read | — |
| POST | /api/v1/catalog/preference-bundles | config:preferences_manage | — |
| GET | /api/v1/catalog/preference-bundles/[id] | config:preferences_manage |
| PATCH | /api/v1/catalog/preference-bundles/[id] | config:preferences_manage |
| DELETE | /api/v1/catalog/preference-bundles/[id] | config:preferences_manage |
| GET | /api/v1/preferences/suggest | orders:read | 403 when smart_suggestions=false |
| POST | /api/v1/preferences/resolve | orders:read | — |
| GET | /api/v1/preferences/last-order | orders:read | 403 when repeat_last_order=false |

## Tenant Settings

| Method | Route | Permission(s) |
|--------|-------|---------------|
| GET | /api/v1/tenant-settings/default-guest-customer | customers:read |

## Admin

| Method | Route | Permission(s) |
|--------|-------|---------------|
| GET | /api/admin/jwt-health | admin:read |

## Routes with Auth-Only (No Explicit Permission)

See [API_AUTH_GAPS](API_AUTH_GAPS.md) for routes that use getAuthContext or custom auth without requirePermission.

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_SCREEN](PERMISSIONS_BY_SCREEN.md)
- [API_AUTH_GAPS](API_AUTH_GAPS.md)
