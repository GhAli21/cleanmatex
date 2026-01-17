# Tenant Isolation Management Guide

## Overview

This guide covers the comprehensive tenant isolation system implemented in CleanMateX. The system ensures complete data isolation between tenants through multiple layers of defense.

## Architecture

### Multi-Layer Defense

1. **JWT Validation Layer** - Ensures JWT always contains tenant context
2. **Application Middleware Layer** - Validates tenant access before processing
3. **Prisma Middleware Layer** - Automatically injects tenant filters
4. **Database RLS Layer** - Database-level enforcement of tenant isolation

## JWT Management

### Ensuring JWT Always Has Tenant Context

The system guarantees that JWTs always contain `tenant_org_id` in `user_metadata`:

1. **Automatic Repair**: If JWT is missing tenant context, it's automatically repaired
2. **Database Triggers**: Triggers sync tenant context to user metadata on login/tenant switch
3. **Refresh Handler**: JWT refresh preserves tenant context

### Usage

```typescript
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';

export async function GET(request: NextRequest) {
  const jwtValidation = await validateJWTWithTenant(request);
  if (jwtValidation instanceof NextResponse) return jwtValidation;
  
  const { tenantId, userId } = jwtValidation;
  // tenantId is guaranteed to exist
}
```

## Tenant Validation Middleware

### Standard Pattern

All API routes should use the tenant guard pattern:

```typescript
import { requireTenantAuth } from '@/lib/middleware/tenant-guard';

export async function GET(request: NextRequest) {
  const auth = await requireTenantAuth('orders:read')(request);
  if (auth instanceof NextResponse) return auth;
  
  const { tenantId, userId } = auth;
  // Proceed with tenant-scoped operations
}
```

## Database RLS Policies

All `org_*` tables have RLS policies that enforce tenant isolation:

```sql
CREATE POLICY tenant_isolation_org_orders ON org_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());
```

The `current_tenant_id()` function:
1. First checks JWT metadata
2. Falls back to `org_users_mst` query if JWT doesn't have tenant

## Testing

### Unit Tests

```typescript
import { validateTenantIsolation } from '@/lib/validation/tenant-isolation-validator';

const result = await validateTenantIsolation('org_orders_mst', tenantId, userId);
expect(result.passed).toBe(true);
```

### Integration Tests

Test that RLS policies prevent cross-tenant access:

```typescript
// User from tenant A should not access tenant B's data
const isolated = await validateCrossTenantIsolation(
  'org_orders_mst',
  tenantA,
  tenantB,
  userId
);
expect(isolated).toBe(true);
```

## Monitoring

### JWT Health

Monitor JWT tenant context health:

```typescript
import { getJWTHealthMetrics, checkJWTHealth } from '@/lib/monitoring/jwt-health-monitor';

const metrics = await getJWTHealthMetrics();
const health = checkJWTHealth(metrics);

if (!health.healthy) {
  // Alert on violations
  console.error('JWT health issues:', health.alerts);
}
```

### Isolation Violations

Monitor tenant isolation violations:

```typescript
import { getRecentViolations } from '@/lib/monitoring/tenant-isolation-monitor';

const violations = await getRecentViolations(24); // Last 24 hours
if (violations.length > 0) {
  // Alert on violations
}
```

## Best Practices

1. **Always use tenant guard middleware** - Never manually check tenant access
2. **Never query without tenant filter** - RLS will enforce, but application layer should also filter
3. **Test tenant isolation** - Write tests for all API routes
4. **Monitor JWT health** - Set up alerts for low coverage rates
5. **Log violations** - All violations are logged to `sys_audit_log`

## Common Mistakes

1. ❌ **Querying without tenant filter**
   ```typescript
   // BAD
   const orders = await prisma.org_orders_mst.findMany();
   
   // GOOD
   const orders = await prisma.org_orders_mst.findMany({
     where: { tenant_org_id: tenantId }
   });
   ```

2. ❌ **Not using tenant guard middleware**
   ```typescript
   // BAD
   const user = await supabase.auth.getUser();
   const tenantId = user.data.user?.user_metadata?.tenant_org_id;
   
   // GOOD
   const auth = await requireTenantAuth()(request);
   const { tenantId } = auth;
   ```

3. ❌ **Assuming tenant context exists**
   ```typescript
   // BAD
   const tenantId = user.user_metadata.tenant_org_id; // May be undefined
   
   // GOOD
   const jwtValidation = await validateJWTWithTenant(request);
   if (jwtValidation instanceof NextResponse) return jwtValidation;
   const { tenantId } = jwtValidation; // Guaranteed to exist
   ```

## Troubleshooting

### JWT Missing Tenant Context

1. Check JWT health metrics: `/api/admin/jwt-health`
2. Review repair logs in `sys_jwt_tenant_health_log`
3. Verify `org_users_mst` has correct `tenant_org_id`
4. Check database triggers are active

### Cross-Tenant Data Access

1. Verify RLS is enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'org_orders_mst';`
2. Check RLS policies exist: `SELECT * FROM pg_policies WHERE tablename = 'org_orders_mst';`
3. Test `current_tenant_id()` function: `SELECT current_tenant_id();`
4. Review audit logs for violations

## Security Considerations

1. **Never trust client-side tenant ID** - Always validate server-side
2. **Use RLS as defense-in-depth** - Even if application layer fails, RLS protects
3. **Monitor violations** - Set up alerts for any isolation violations
4. **Regular audits** - Review RLS policies and test tenant isolation regularly

