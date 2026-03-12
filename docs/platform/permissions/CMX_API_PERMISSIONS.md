---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# cmx-api Permissions

NestJS backend (cmx-api) — current auth guards and permissions.

**Note:** cmx-api is Phase 2; document current state and future permission model.

## Current Guards

| Guard | File | Purpose |
|-------|------|---------|
| JwtAuthGuard | `cmx-api/src/common/guards/jwt-auth.guard.ts` | Validates JWT |
| TenantGuard | `cmx-api/src/common/guards/tenant.guard.ts` | Validates tenant context |

## Current State

- No permission decorators yet — auth is JWT + tenant validation only
- No `requirePermission`-style middleware in cmx-api
- Request context: `RequestContext` interface, `tenant-id` decorator, `request-context.middleware.ts`

## Future Permission Model

When implementing permission checks in cmx-api:

- Use same permission codes as web-admin (e.g., `orders:read`, `customers:create`)
- Consider `@RequirePermission('orders:read')` decorator
- Use `get_user_permissions` or equivalent RPC for tenant-scoped user
- Pass tenant context explicitly through guards/request context

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [docs/plan/master_plan_cc_01.md](../../plan/master_plan_cc_01.md) — Platform architecture
