---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# API Auth Gaps

API routes that use **auth-only** (no explicit permission check) or custom auth.

## Routes with getAuthContext Only

These routes validate JWT and tenant context but do **not** call `requirePermission` or `requireTenantAuth` (no permission check).

| Method | Route | Auth Method | Suggested Permission |
|--------|-------|-------------|----------------------|
| POST | /api/v1/assembly/tasks | getAuthContext | orders:create or orders:update |
| POST | /api/v1/assembly/tasks/[taskId]/pack | (check route) | orders:update |
| POST | /api/v1/assembly/tasks/[taskId]/scan | (check route) | orders:read |
| POST | /api/v1/assembly/tasks/[taskId]/start | (check route) | orders:update |
| POST | /api/v1/assembly/tasks/[taskId]/qa | (check route) | orders:update |
| POST | /api/v1/assembly/tasks/[taskId]/exceptions/route | (check route) | orders:update |
| POST | /api/v1/assembly/exceptions/[id]/resolve | (check route) | orders:update |
| GET | /api/v1/assembly/dashboard | (check route) | orders:read |
| POST | /api/v1/delivery/routes | (check route) | delivery:assign or orders:read |
| POST | /api/v1/delivery/routes/[id]/assign | (check route) | delivery:assign |
| GET | /api/v1/delivery/orders/[orderId]/generate-otp | (check route) | orders:read |
| POST | /api/v1/delivery/orders/[orderId]/verify-otp | (check route) | orders:update |
| POST | /api/v1/delivery/stops/[stopId]/pod | (check route) | orders:update |
| POST | /api/v1/receipts/[id]/resend | (check route) | orders:read or receipts:resend |
| POST | /api/v1/customers/merge | custom getAuthContext | customers:merge |
| GET | /api/v1/customers/export | custom getAuthContext | customers:export |

## Routes with requireTenantAuth

These use `requireTenantAuth(permission)` — same as requirePermission but via tenant-guard middleware.

| Method | Route | Permission |
|--------|-------|------------|
| POST | /api/v1/preparation/[id]/complete | orders:update |
| GET | /api/v1/preparation/[id]/items/[itemId] | orders:update |
| PATCH | /api/v1/preparation/[id]/items/[itemId] | orders:update |

## Recommendation

Add `requirePermission` or `requireTenantAuth` to routes with getAuthContext-only to enforce least-privilege. Run `scripts/docs/extract-api-auth-audit.ts` to detect gaps.

## See Also

- [PERMISSIONS_BY_API](PERMISSIONS_BY_API.md)
- [docs/master_data/Permissions_To_InsertTo_DB.sql](../../master_data/Permissions_To_InsertTo_DB.sql) — customers:merge, customers:export may need to be added
