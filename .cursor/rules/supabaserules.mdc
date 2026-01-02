---
version: v1.1.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# 🛡️ Supabase Usage Guidelines

**CRITICAL**: Follow these rules for all Supabase database operations and RLS policies.

---

## Row-Level Security (RLS)

### Enable RLS on All Tenant Tables

**CRITICAL**: Enable RLS on ALL `org_*` tables (tenant tables).

```sql
-- ✅ Good: Enable RLS
CREATE TABLE org_orders_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  -- ... other columns
);

ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;

-- ❌ Bad: Missing RLS
CREATE TABLE org_orders_mst (
  -- No RLS enabled - security risk!
);
```

### RLS Policy Patterns

#### Tenant Isolation Policy

```sql
-- Standard tenant isolation policy
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id = (
      SELECT tenant_org_id
      FROM org_users_mst
      WHERE user_id = auth.uid()
    )
  );

-- Or using JWT claims (if tenant_org_id is in JWT)
CREATE POLICY tenant_isolation_jwt ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id')
  );
```

#### Role-Based Policies

```sql
-- Admin can see all orders in their tenant
CREATE POLICY admin_full_access ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id = (
      SELECT tenant_org_id
      FROM org_users_mst
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Staff can only see assigned orders
CREATE POLICY staff_assigned_access ON org_orders_mst
  FOR SELECT
  USING (
    tenant_org_id = (
      SELECT tenant_org_id
      FROM org_users_mst
      WHERE user_id = auth.uid()
    )
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  );
```

#### Testing RLS Policies

```sql
-- Test policy as specific user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';

-- Test query
SELECT * FROM org_orders_mst;

-- Should only return orders for the specified tenant
```

---

## Client Usage Patterns

### Always Filter by Tenant

```typescript
// ✅ Good: Always include tenant filter
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId) // CRITICAL: Always filter
  .eq("status", "PENDING");

// ❌ Bad: Missing tenant filter
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("status", "PENDING");
```

### Use Select to Limit Columns

```typescript
// ✅ Good: Select only needed columns
const { data } = await supabase
  .from("org_orders_mst")
  .select("id, order_number, status, total_amount")
  .eq("tenant_org_id", tenantId);

// ❌ Bad: Selecting all columns
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId);
```

### Pagination

```typescript
// ✅ Good: Always paginate large datasets
const { data, error } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId)
  .range(page * limit, (page + 1) * limit - 1)
  .order("created_at", { ascending: false });

// Get total count separately
const { count } = await supabase
  .from("org_orders_mst")
  .select("*", { count: "exact", head: true })
  .eq("tenant_org_id", tenantId);
```

### Avoid N+1 Queries

```typescript
// ✅ Good: Use joins/select with relations
const { data } = await supabase
  .from("org_orders_mst")
  .select(
    `
    *,
    customer:org_customers_mst(*),
    items:org_order_items_dtl(*)
  `
  )
  .eq("tenant_org_id", tenantId);

// ❌ Bad: N+1 query problem
const { data: orders } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId);

for (const order of orders) {
  const { data: customer } = await supabase
    .from("org_customers_mst")
    .select("*")
    .eq("id", order.customer_id)
    .single();
}
```

---

## Migrations

### Migration Naming Convention

```
YYYYMMDDHHMMSS_description.sql

Examples:
20250116103000_create_orders_table.sql
20250116104500_add_order_status_index.sql
20250116110000_add_rls_policies.sql
```

### Migration Best Practices

```sql
-- ✅ Good: One logical change per migration
-- Migration: 20250116103000_create_orders_table.sql

BEGIN;

-- Create table
CREATE TABLE org_orders_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  order_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX idx_orders_tenant ON org_orders_mst(tenant_org_id);
CREATE INDEX idx_orders_tenant_status ON org_orders_mst(tenant_org_id, status);
CREATE INDEX idx_orders_created ON org_orders_mst(tenant_org_id, created_at DESC);

-- Enable RLS
ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id')
  );

COMMIT;

-- Rollback instructions (in comments)
-- DROP POLICY tenant_isolation ON org_orders_mst;
-- DROP TABLE org_orders_mst;
```

### Migration Rules

1. **One logical change per migration** - Don't mix unrelated changes
2. **Use transactions** - Wrap migrations in BEGIN/COMMIT
3. **Test locally first** - Always test migrations before applying
4. **Never modify existing migrations** - Create new migrations for fixes
5. **Include rollback instructions** - Comment rollback SQL
6. **Add indexes after data** - Create indexes after table creation
7. **Document complex logic** - Add comments for complex migrations

---

## Database Functions

### Creating Functions

```sql
-- ✅ Good: Use PostgreSQL functions for complex logic
CREATE OR REPLACE FUNCTION calculate_order_total(order_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO total
  FROM org_order_items_dtl
  WHERE order_id = calculate_order_total.order_id;

  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expose via Supabase RPC
-- In Supabase dashboard or migration:
-- This function is automatically available as RPC
```

### Using Functions via RPC

```typescript
// Call PostgreSQL function via Supabase RPC
const { data, error } = await supabase.rpc("calculate_order_total", {
  order_id: orderId,
});
```

### Function Security

```sql
-- ✅ Good: Use SECURITY DEFINER only when necessary
CREATE FUNCTION admin_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Only if function needs elevated privileges
SET search_path = public
AS $$
BEGIN
  -- Function body
END;
$$;

-- ✅ Good: Default SECURITY INVOKER (safer)
CREATE FUNCTION user_function()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER -- Uses caller's privileges
AS $$
BEGIN
  -- Function body
END;
$$;
```

---

## Validation

### Database-Level Validation

```sql
-- ✅ Good: Add constraints at database level
CREATE TABLE org_orders_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'DELIVERED')),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Application-Level Validation

```typescript
// ✅ Good: Validate before insert/update
import { z } from "zod";

const orderSchema = z.object({
  tenant_org_id: z.string().uuid(),
  order_number: z.string().min(1).max(50),
  status: z.enum(["PENDING", "PROCESSING", "READY", "DELIVERED"]),
  total_amount: z.number().min(0),
});

const validatedData = orderSchema.parse(orderData);

const { data, error } = await supabase
  .from("org_orders_mst")
  .insert(validatedData)
  .select()
  .single();
```

---

## Logging Database Operations

### Log Mutations

```typescript
import { logger } from "@/lib/utils/logger";

async function createOrder(
  orderData: CreateOrderDto,
  tenantId: string,
  userId: string
) {
  const startTime = Date.now();

  try {
    logger.info("Creating order", {
      tenantId,
      userId,
      feature: "orders",
      action: "create",
    });

    const { data, error } = await supabase
      .from("org_orders_mst")
      .insert({
        ...orderData,
        tenant_org_id: tenantId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    logger.info("Order created successfully", {
      tenantId,
      userId,
      orderId: data.id,
      duration: `${duration}ms`,
      feature: "orders",
      action: "create",
    });

    return data;
  } catch (error) {
    logger.error("Order creation failed", error as Error, {
      tenantId,
      userId,
      feature: "orders",
      action: "create",
    });
    throw error;
  }
}
```

---

## Service Role Key Usage

### When to Use Service Role Key

**CRITICAL**: Only use service role key for:

- Admin operations (tenant management)
- Background jobs
- System-level operations
- Never use in client-side code

```typescript
// ✅ Good: Server-side admin operation
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

// Admin operation
const { data } = await supabaseAdmin.from("org_tenants_mst").select("*");

// ❌ Bad: Using service role key in client
// Never expose service role key to client!
```

---

## Naming Conventions

### Function Naming

- **Database Functions**: `snake_case` with descriptive name (e.g., `calculate_order_total`, `get_active_orders`)
- **RPC Functions**: `snake_case` (e.g., `create_order`, `update_order_status`)
- **Validation Functions**: Prefix with `validate_` (e.g., `validate_phone_number`, `validate_email`)
- **Helper Functions**: Descriptive `snake_case` (e.g., `format_phone_number`, `calculate_discount`)

### Policy Naming

- **RLS Policies**: `{purpose}_{scope}` (e.g., `tenant_isolation`, `admin_full_access`, `staff_assigned_access`)
- **Policy Names**: Descriptive and indicate purpose (e.g., `tenant_isolation`, `user_own_data`)

### Migration Naming

- **Migrations**: `YYYYMMDDHHMMSS_{description}.sql` (e.g., `20250116103000_create_orders_table.sql`)
- **Descriptions**: Use `snake_case` and be descriptive

### Examples

```sql
-- ✅ Good: Clear, descriptive function names
CREATE FUNCTION calculate_order_total(order_id UUID) ...
CREATE FUNCTION get_active_orders(tenant_id UUID) ...
CREATE FUNCTION validate_phone_number(phone VARCHAR) ...

-- ❌ Bad: Unclear or abbreviated names
CREATE FUNCTION calc(o_id UUID) ... -- Should be calculate_order_total
CREATE FUNCTION get_ord(t_id UUID) ... -- Should be get_active_orders
```

---

## Code Reuse Patterns

### 1. Extract Common Query Helpers

```typescript
// ✅ Good: Reusable query helper
// lib/utils/supabase-helpers.ts
export async function queryWithTenant<T>(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  options?: {
    select?: string;
    filters?: Record<string, unknown>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  let query = supabase
    .from(table)
    .select(options?.select || "*")
    .eq("tenant_org_id", tenantId);

  if (options?.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return query;
}

// Usage
const { data } = await queryWithTenant(supabase, "org_orders_mst", tenantId, {
  filters: { status: "PENDING" },
  orderBy: { column: "created_at", ascending: false },
  limit: 20,
});

// ❌ Bad: Duplicate query logic
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId)
  .eq("status", "PENDING")
  .order("created_at", { ascending: false })
  .limit(20);
// Repeated in multiple places
```

### 2. Extract Common RPC Wrappers

```typescript
// ✅ Good: Reusable RPC wrapper
// lib/utils/rpc-helpers.ts
export async function callRPC<T>(
  supabase: SupabaseClient,
  functionName: string,
  params: Record<string, unknown>,
  tenantId: string
): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, {
    ...params,
    tenant_id: tenantId,
  });

  if (error) {
    logger.error(`RPC ${functionName} failed`, error, { tenantId, params });
    throw error;
  }

  return data as T;
}

// Usage
const total = await callRPC<number>(
  supabase,
  'calculate_order_total',
  { order_id: orderId },
  tenantId
);

// ❌ Bad: Duplicate RPC error handling
const { data, error } = await supabase.rpc('calculate_order_total', {...});
if (error) { /* duplicate error handling */ }
```

### 3. Extract Common Insert Patterns

```typescript
// ✅ Good: Reusable insert helper
// lib/utils/supabase-helpers.ts
export async function insertWithAudit<T>(
  supabase: SupabaseClient,
  table: string,
  data: Partial<T>,
  tenantId: string,
  userId: string
) {
  const { data: result, error } = await supabase
    .from(table)
    .insert({
      ...data,
      tenant_org_id: tenantId,
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error(`Insert into ${table} failed`, error, {
      tenantId,
      userId,
      table,
    });
    throw error;
  }

  return result;
}

// Usage
const order = await insertWithAudit(
  supabase,
  "org_orders_mst",
  orderData,
  tenantId,
  userId
);

// ❌ Bad: Duplicate insert logic
const { data } = await supabase.from("org_orders_mst").insert({
  ...orderData,
  tenant_org_id: tenantId,
  created_by: userId,
  created_at: new Date().toISOString(),
});
// Repeated everywhere
```

### 4. Extract Common Update Patterns

```typescript
// ✅ Good: Reusable update helper
export async function updateWithAudit<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  updates: Partial<T>,
  tenantId: string,
  userId: string
) {
  const { data: result, error } = await supabase
    .from(table)
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_org_id", tenantId) // Always filter by tenant
    .select()
    .single();

  if (error) {
    logger.error(`Update ${table} failed`, error, {
      tenantId,
      userId,
      table,
      id,
    });
    throw error;
  }

  return result;
}

// Usage
const updatedOrder = await updateWithAudit(
  supabase,
  "org_orders_mst",
  orderId,
  { status: "PROCESSING" },
  tenantId,
  userId
);
```

### 5. Extract Common Soft Delete Pattern

```typescript
// ✅ Good: Reusable soft delete helper
export async function softDelete(
  supabase: SupabaseClient,
  table: string,
  id: string,
  tenantId: string,
  userId: string
) {
  return await updateWithAudit(
    supabase,
    table,
    id,
    {
      is_active: false,
      rec_status: 0,
    } as any,
    tenantId,
    userId
  );
}

// Usage
await softDelete(supabase, "org_orders_mst", orderId, tenantId, userId);
```

---

## Best Practices

### ✅ DO

- Always enable RLS on `org_*` tables
- Always filter by `tenant_org_id` in queries
- Use composite foreign keys for tenant-scoped joins
- Test RLS policies with different user roles
- Use transactions for multi-step operations
- Validate data before insert/update
- Log all mutations with context
- Use pagination for large datasets
- Select only needed columns
- Extract common query patterns to helper functions
- Use reusable RPC wrappers
- Follow naming conventions consistently

### ❌ DON'T

- Don't disable RLS on tenant tables
- Don't query without tenant filter
- Don't use service role key in client code
- Don't modify existing migrations
- Don't skip validation
- Don't forget to add indexes
- Don't expose sensitive data in logs
- Don't use N+1 query patterns
- Don't duplicate query logic - extract to helpers
- Don't repeat error handling - use wrapper functions

---

## Troubleshooting

### RLS Blocking Queries

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'org_orders_mst';

-- Check existing policies
SELECT * FROM pg_policies
WHERE tablename = 'org_orders_mst';

-- Test policy
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

### Migration Issues

```bash
# Reset database (development only)
supabase db reset

# Check migration status
supabase migration list

# Apply specific migration
supabase migration up --version 20250116103000
```

---

## Related Documentation

- [Database Conventions](./database_conventions.md) - Database schema standards
- [Multi-Tenancy](./multitenancy.md) - Multi-tenant security patterns
- [Logging Rules](./logging-rules.md) - Logging database operations

---

## Return to [Main Documentation](../CLAUDE.md)
