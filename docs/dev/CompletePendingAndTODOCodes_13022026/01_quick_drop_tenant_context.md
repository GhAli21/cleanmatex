# 01 - Quick Drop Tenant Context

## Summary

Fixed multi-tenancy violation in Quick Drop order creation. Tenant ID is now resolved server-side from the authenticated session instead of being passed from the client (which previously used a hardcoded `demo-tenant-id`).

## File(s) Affected

- `web-admin/app/actions/orders/create-order.ts`
- `web-admin/app/dashboard/orders/components/quick-drop-form.tsx`

## Issue

The Quick Drop form used a hardcoded `tenantOrgId = 'demo-tenant-id'`, which:
- Broke multi-tenancy (all orders would be created under demo tenant)
- Violated security best practice (tenant should never be client-controlled)
- Would fail in production with multiple tenants

## Code Before

**create-order.ts:**
```typescript
export async function createOrder(
  tenantOrgId: string,
  formData: FormData | Record<string, any>
): Promise<CreateOrderResult> {
  try {
    // Parse form data
    const rawData = /* ... */;
    // ...
    const order = await createOrderDb(tenantOrgId, validation.data);
```

**quick-drop-form.tsx:**
```typescript
  // TODO: Get tenant ID from session
  const tenantOrgId = 'demo-tenant-id';
  // ...
  const result = await createOrder(tenantOrgId, formData);
```

## Code After

**create-order.ts:**
```typescript
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

export async function createOrder(
  formData: FormData | Record<string, any>
): Promise<CreateOrderResult> {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant ID is required. User must be authenticated and have tenant_org_id in metadata.',
      };
    }

    // Parse form data
    const rawData = /* ... */;
    // ...
    const order = await createOrderDb(tenantId, validation.data);
```

**quick-drop-form.tsx:**
```typescript
  // Tenant resolved server-side via getTenantIdFromSession
  const result = await createOrder(formData);
```

## Effects and Dependencies

- **Breaking change:** The server action signature changed from `createOrder(tenantOrgId, formData)` to `createOrder(formData)`. The only caller was `quick-drop-form.tsx`, which has been updated.
- **No environment variables** required.
- **Dependency:** `getTenantIdFromSession()` from `@/lib/db/tenant-context` (reads `user.user_metadata?.tenant_org_id` from Supabase auth).

## Testing

1. Log in as a user with `tenant_org_id` in user metadata.
2. Navigate to Quick Drop order creation.
3. Fill form and submit. Order should be created under the correct tenant.
4. Log in as user without tenant (or unauthenticated). Submit should return error: "Tenant ID is required...".

## Production Checklist

- [x] No hardcoded tenant
- [x] Tenant resolved from authenticated session
- [x] Structured error returned when unauthenticated (no throw)
- [x] Single caller updated (quick-drop-form)
