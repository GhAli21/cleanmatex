---
name: multitenancy
description: Multi-tenancy enforcement, RLS policies, tenant isolation patterns. CRITICAL - use when writing ANY database queries, creating tables, or handling tenant-scoped data.
user-invocable: true
---

# Multi-Tenancy Enforcement

## CRITICAL RULES - NEVER VIOLATE

1. **Always filter by `tenant_org_id`** in every query
2. **Use composite foreign keys** when joining tenant tables
3. **ALWAYS use centralized tenant context** - Never duplicate `getTenantIdFromSession()`

## Centralized Tenant Context (MANDATORY)

**Location:** `web-admin/lib/db/tenant-context.ts`

### For Prisma Services

```typescript
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';

const tenantId = await getTenantIdFromSession();
return withTenantContext(tenantId, async () => {
  // Middleware automatically adds tenant_org_id filter
  return await prisma.org_orders_mst.findMany();
});
```

### For Supabase Services

```typescript
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

const tenantId = await getTenantIdFromSession();
const { data } = await supabase
  .from('org_customers_mst')
  .select('*')
  .eq('tenant_org_id', tenantId);  // REQUIRED - Never omit
```

## Composite Foreign Keys (CRITICAL)

Enforce tenant isolation at the database schema level:

```sql
-- Example: Order references customer
FOREIGN KEY (tenant_org_id, customer_id)
  REFERENCES org_customers_mst(tenant_org_id, customer_id)
  ON DELETE CASCADE

-- Example: Order item references product
FOREIGN KEY (tenant_org_id, service_category_code)
  REFERENCES org_service_category_cf(tenant_org_id, service_category_code)
```

**Why?** Database-level enforcement prevents accidental cross-tenant references even if application code has bugs.

## Code Review Checklist

Before committing any database code:

- [ ] No duplicate `getTenantIdFromSession()` implementations
- [ ] All Prisma queries wrapped with `withTenantContext()`
- [ ] All Supabase queries include `.eq('tenant_org_id', tenantId)`
- [ ] All services import from `@/lib/db/tenant-context`
- [ ] All new `org_*` tables have composite foreign keys
- [ ] RLS policies enabled on all `org_*` tables

## Dual-Layer Architecture

```
SYSTEM LAYER (sys_*): Global shared data, no tenant_org_id
  Examples: sys_auth_users_mst, sys_pln_plans_mst

ORGANIZATION LAYER (org_*): Tenant data with RLS
  Examples: org_orders_mst, org_customers_mst
```

### Multi-Tenancy Enforcement Layers

**Application Layer (Prisma Middleware):**
- Auto-inject `tenant_org_id` filter on all `org_*` tables
- Enforced via middleware in `lib/prisma-middleware.ts`
- Compile-time type checking prevents mistakes

**Database Layer (RLS Policies):**
- Existing RLS policies still active
- Defense-in-depth security model
- Works even if application layer bypassed

## Common Mistakes to Avoid

❌ **Wrong - Missing tenant filter:**
```typescript
const orders = await prisma.org_orders_mst.findMany();
// Missing withTenantContext - will fail or leak data
```

✅ **Correct - With tenant context:**
```typescript
const tenantId = await getTenantIdFromSession();
const orders = await withTenantContext(tenantId, async () => {
  return await prisma.org_orders_mst.findMany();
});
```

❌ **Wrong - Duplicate tenant function:**
```typescript
// In some-service.ts
async function getTenantId() {
  // Duplicated logic
}
```

✅ **Correct - Use centralized:**
```typescript
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

const tenantId = await getTenantIdFromSession();
```

## Additional Resources

- See [reference.md](./reference.md) for RLS policy examples and testing checklist
- See [Database Skill](/database) for composite foreign key patterns
