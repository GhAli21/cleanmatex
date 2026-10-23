# Rule: server actions never trust a caller-supplied tenant

**Since:** 2026-10-23 (BF-20) · **Enforced by:** `web-admin/__tests__/security/server-action-tenant-guard.test.ts`

## Why

A `'use server'` export is a callable HTTP endpoint. It stays callable even when no screen uses it, and anyone can send it any arguments. A tenant id is not a secret: it appears in URLs, links and app storage. Trusting it lets one tenant read or change another tenant's data.

## Rule

1. Tenant and user come from the **session**.
2. A server action that takes a tenant id must call `resolveActionTenant` from `web-admin/lib/auth/server-action-guard.ts`:

   ```ts
   const guard = await resolveActionTenant({
     action: 'orders.getOrder',            // for logs
     expectedTenantId: tenantOrgId,        // caller value: verified, never trusted
     permission: ORDERS_PERMISSIONS.READ,  // when the action needs one
   });
   if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };
   // use guard.tenantId / guard.userId from here on
   ```

3. Codes: `UNAUTHENTICATED`, `TENANT_MISMATCH` (logged as a warning), `FORBIDDEN`.
4. Never take a **user id** from the caller for user-scoped reads or writes; use `guard.userId`.
5. New actions should take no tenant parameter at all; the guard works without `expectedTenantId`.
6. Remove server actions that nobody calls. They are still endpoints.
7. Internal error text is logged, not returned.

## External callers

Mobile apps, public pages and HQ never call server actions. They use API routes that accept a tenant id only together with proof for that tenant:

| Caller | Proof |
|---|---|
| Customer mobile app | Bearer token verified by `resolveCustomerMobileSession` for that tenant; data filtered by the session customer |
| Public tracking | Opaque `/track/{token}`; the tenant comes from the token |
| HQ / services | Service credential verified on the server |

A readable path keyed only by tenant id and order number is not allowed (BF-16).

## Exceptions

Listed with a reason in `ALLOWED` inside the enforcing test. Prefer fixing the action.
