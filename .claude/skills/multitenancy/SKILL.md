---
name: multitenancy
description: Multi-tenancy enforcement, RLS policies, tenant isolation patterns. CRITICAL - use when writing ANY database queries, creating tables, or handling tenant-scoped data.
user-invocable: true
---

# Multi-Tenancy Enforcement

## CRITICAL RULES - NEVER VIOLATE

1. **Always filter by `tenant_org_id`** in every query
2. **Use composite foreign keys** when joining across tenant tables
3. **Leverage RLS policies** for additional security
4. **Global customers** are linked to tenants via junction table
5. **ALWAYS use centralized tenant context** - Never create duplicate `getTenantIdFromSession()` implementations

## Centralized Tenant Context (MANDATORY)

**Location:** `web-admin/lib/db/tenant-context.ts`

**Exports:** `getTenantIdFromSession()`, `withTenantContext()`, `getTenantId()`

### For Prisma Services

```typescript
// CORRECT - Use centralized version
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';

export async function createInvoice(input: CreateInvoiceInput) {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  return withTenantContext(tenantId, async () => {
    // Middleware automatically adds tenant_org_id to all queries
    const invoice = await prisma.org_invoice_mst.create({
      data: { ...input }
      // tenant_org_id added automatically by middleware
    });
    return invoice;
  });
}
```

### For Supabase Services

```typescript
export async function getCustomers() {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data } = await supabase
    .from('org_customers_mst')
    .select('*')
    .eq('tenant_org_id', tenantId);  // REQUIRED - Explicit filter

  return data;
}
```

### For API Routes

```typescript
export async function POST(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await withTenantContext(tenantId, async () => {
    await prisma.org_orders_mst.update({
      where: { id: orderId },
      // Middleware adds tenant_org_id automatically
    });
  });
}
```

## Query Patterns

### CORRECT - With tenant filtering

```typescript
// Supabase query
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId)
  .eq('order_status', 'PENDING');

// SQL query
SELECT * FROM org_orders_mst
WHERE tenant_org_id = $1
AND order_status = 'PENDING';
```

### WRONG - Missing tenant filter

```typescript
// SECURITY VULNERABILITY!
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('order_status', 'PENDING');
// This could expose other tenants' data!
```

### CORRECT - Joins with composite keys

```typescript
const { data } = await supabase
  .from('org_orders_mst')
  .select(`
    *,
    customer:org_customers_mst!inner(*)
  `)
  .eq('tenant_org_id', tenantId);
```

## Code Review Checklist

- [ ] No duplicate `getTenantIdFromSession()` implementations
- [ ] All Prisma queries wrapped with `withTenantContext()` (for `org_*` tables)
- [ ] All Supabase queries include `.eq('tenant_org_id', tenantId)`
- [ ] All services import from `@/lib/db/tenant-context`
- [ ] No inline tenant ID retrieval logic

## Global vs Tenant Data

### System Tables (sys_*)
- No `tenant_org_id` column
- Shared across all tenants
- Examples: `sys_customers_mst`, `sys_order_type_cd`

### Organization Tables (org_*)
- MUST have `tenant_org_id` column
- RLS enabled
- Junction tables link global to tenant data

See `reference.md` for RLS policy examples, testing patterns, and JWT claims setup.
