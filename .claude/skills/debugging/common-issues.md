# Common Issues & Solutions

## Issue 1: RLS Policy Blocking Query

**Symptom**: Query returns empty result or permission error

**Diagnosis**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'org_orders_mst';

-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'org_orders_mst';

-- Test query as specific user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

**Solutions**:
```typescript
// Solution 1: Ensure JWT contains tenant_org_id
const { data: user } = await supabase.auth.getUser();
console.log('JWT claims:', user.user_metadata);

// Solution 2: Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Solution 3: Fix RLS policy
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id = (
      SELECT tenant_org_id FROM org_users_mst WHERE user_id = auth.uid()
    )
  );
```

## Issue 2: Cross-Tenant Data Leak

**Symptom**: Can see other tenant's data

**Diagnosis**:
```typescript
// Check your query - is tenant filter missing?
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('id', orderId);
// MISSING tenant_org_id filter!
```

**Solution**:
```typescript
// Always add tenant filter
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId)  // CRITICAL!
  .eq('id', orderId);
```

## Issue 3: Migration Fails

**Symptom**: `supabase db reset` fails with error

**Common Errors**:
```
ERROR: relation "org_tenants_mst" does not exist
ERROR: foreign key constraint violation
```

**Solutions**:

1. **Fix table creation order**:
```sql
-- Create parent tables first
CREATE TABLE org_tenants_mst (...);

-- Then create child tables
CREATE TABLE org_orders_mst (
  tenant_org_id UUID REFERENCES org_tenants_mst(id)
);
```

2. **Fix foreign key issues**:
```sql
FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON DELETE CASCADE;
```

## Issue 4: N+1 Query Problem

**Symptom**: Slow page load, many database queries

**Solution**:
```typescript
// Use joins in single query
const { data } = await supabase
  .from('org_orders_mst')
  .select(`
    *,
    customer:org_customers_mst(*),
    items:org_order_items_dtl(*),
    branch:org_branches_mst(*)
  `)
  .eq('tenant_org_id', tenantId);
```

## Issue 5: TypeScript Type Errors

**Symptom**: Type errors after database changes

**Solution**:
```bash
# Regenerate types from database
supabase gen types typescript --local > web-admin/types/database.ts

# Restart TypeScript server
# VS Code: Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

## Issue 6: Slow Queries

**Diagnosis**:
```sql
EXPLAIN ANALYZE
SELECT * FROM org_orders_mst
WHERE tenant_org_id = 'uuid'
AND status = 'PENDING';
```

**Solutions**:
```sql
-- Add missing indexes
CREATE INDEX idx_orders_tenant_status
ON org_orders_mst(tenant_org_id, status);

-- Optimize queries - select only needed columns
```

## Issue 7: Build Error - Prisma `g.$use is not a function`

**Root Cause**: Prisma middleware being applied at module load time during webpack bundling

**Solution** in `lib/db/prisma.ts`:
```typescript
if (!(prismaClient as any).__tenantMiddlewareApplied) {
  try {
    if (typeof (prismaClient as any).$use === 'function') {
      applyTenantMiddleware(prismaClient);
      (prismaClient as any).__tenantMiddlewareApplied = true;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Prisma] Middleware application deferred:', error);
    }
  }
}
```

Add to API routes:
```typescript
export const runtime = 'nodejs';
```

## Issue 8: next-intl Configuration Missing (Production)

**Error**:
```
Error: Couldn't find next-intl config file
```

**Solution** in `next.config.ts`:
```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  // Your existing config...
};

export default withNextIntl(nextConfig);
```

## Debugging Tools

### Database Inspection
```bash
# Supabase Studio
open http://localhost:54323

# psql
psql -h localhost -p 54322 -U postgres -d postgres
```

### Network Debugging
```typescript
const supabase = createClient(url, key, {
  global: {
    fetch: (url, options) => {
      console.log('Request:', url, options);
      return fetch(url, options);
    },
  },
});
```

### Performance Profiling
```sql
\timing on

SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```
