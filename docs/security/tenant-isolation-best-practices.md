# Tenant Isolation Best Practices

## Overview

This document outlines best practices for maintaining tenant isolation in CleanMateX. Following these practices ensures complete data separation between tenants.

## Core Principles

1. **Never trust client input** - Always validate tenant context server-side
2. **Defense in depth** - Multiple layers of protection (JWT → Middleware → Prisma → RLS)
3. **Fail secure** - If tenant context is missing, reject the request
4. **Monitor violations** - Log and alert on any isolation violations

## Implementation Patterns

### ✅ Correct: Using Tenant Guard

```typescript
import { requireTenantAuth } from '@/lib/middleware/tenant-guard';

export async function GET(request: NextRequest) {
  const auth = await requireTenantAuth('orders:read')(request);
  if (auth instanceof NextResponse) return auth;
  
  const { tenantId, userId } = auth;
  // tenantId is guaranteed to exist and be valid
}
```

### ❌ Incorrect: Manual Tenant Check

```typescript
// BAD - No validation, no repair, no guarantee
const user = await supabase.auth.getUser();
const tenantId = user.data.user?.user_metadata?.tenant_org_id;
if (!tenantId) {
  return NextResponse.json({ error: 'No tenant' }, { status: 400 });
}
```

## Database Queries

### ✅ Correct: Using Tenant Context

```typescript
import { withTenantContext, getTenantIdFromSession } from '@/lib/db/tenant-context';

export async function listOrders() {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized');
  
  return withTenantContext(tenantId, async () => {
    // Prisma middleware automatically adds tenant_org_id filter
    return await prisma.org_orders_mst.findMany();
  });
}
```

### ❌ Incorrect: Manual Filtering

```typescript
// BAD - Easy to forget, no automatic enforcement
const orders = await prisma.org_orders_mst.findMany({
  where: { tenant_org_id: tenantId }
});
```

## Testing

### Unit Tests

Always test tenant isolation:

```typescript
import { validateTenantIsolation } from '@/lib/validation/tenant-isolation-validator';

it('should only return data for current tenant', async () => {
  const result = await validateTenantIsolation('org_orders_mst', tenantId, userId);
  expect(result.passed).toBe(true);
});
```

### Integration Tests

Test cross-tenant isolation:

```typescript
it('should prevent cross-tenant access', async () => {
  const isolated = await validateCrossTenantIsolation(
    'org_orders_mst',
    tenantA,
    tenantB,
    userId
  );
  expect(isolated).toBe(true);
});
```

## Monitoring

### JWT Health

Monitor JWT tenant context coverage:

```typescript
import { getJWTHealthMetrics, checkJWTHealth } from '@/lib/monitoring/jwt-health-monitor';

const metrics = await getJWTHealthMetrics();
const health = checkJWTHealth(metrics);

// Alert if coverage < 99%
if (!health.healthy) {
  // Send alert
}
```

### Violation Detection

Monitor isolation violations:

```typescript
import { getRecentViolations } from '@/lib/monitoring/tenant-isolation-monitor';

const violations = await getRecentViolations(24);
if (violations.length > 0) {
  // Alert on violations
}
```

## Code Review Checklist

- [ ] All API routes use `requireTenantAuth()` or `requireTenantAuth(permission)()`
- [ ] All Prisma queries on `org_*` tables are wrapped with `withTenantContext()`
- [ ] No manual tenant ID extraction from JWT without validation
- [ ] Tests include tenant isolation checks
- [ ] RLS policies exist for all `org_*` tables
- [ ] No hardcoded tenant IDs in queries

## Common Mistakes

1. **Forgetting tenant context wrapper**
   ```typescript
   // BAD
   const orders = await prisma.org_orders_mst.findMany();
   
   // GOOD
   await withTenantContext(tenantId, async () => {
     const orders = await prisma.org_orders_mst.findMany();
   });
   ```

2. **Assuming tenant context exists**
   ```typescript
   // BAD
   const tenantId = user.user_metadata.tenant_org_id;
   
   // GOOD
   const auth = await requireTenantAuth()(request);
   const { tenantId } = auth; // Guaranteed to exist
   ```

3. **Querying without tenant filter**
   ```typescript
   // BAD - RLS will block, but application should also filter
   const orders = await supabase.from('org_orders_mst').select('*');
   
   // GOOD
   const orders = await supabase
     .from('org_orders_mst')
     .select('*')
     .eq('tenant_org_id', tenantId);
   ```

## Security Considerations

1. **RLS is defense-in-depth** - Application layer should also enforce
2. **JWT validation is critical** - Ensures tenant context always exists
3. **Monitor violations** - Set up alerts for any isolation failures
4. **Regular audits** - Review RLS policies and test isolation regularly

