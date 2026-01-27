# Multi-Tenancy Reference Documentation

## RLS Policies

### Basic RLS Setup

```sql
-- Enable RLS on tenant table
ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's orders
CREATE POLICY tenant_isolation_policy ON org_orders_mst
  FOR ALL
  USING (tenant_org_id = auth.jwt() ->> 'tenant_org_id'::text);

-- Policy: Service role can access all data
CREATE POLICY service_role_policy ON org_orders_mst
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### Testing RLS

```sql
-- Set tenant context
SET LOCAL app.current_tenant = 'tenant-uuid';

-- Query should only return tenant's data
SELECT * FROM org_orders_mst;

-- Verify isolation
SELECT COUNT(*) FROM org_orders_mst; -- Should only count current tenant's orders
```

## Customer Linking Example

```sql
-- Global customer (shared identity)
INSERT INTO sys_customers_mst (customer_id, phone, email)
VALUES ('cust-123', '+96812345678', 'ahmed@example.com');

-- Link to tenant with tenant-specific data
INSERT INTO org_customers_mst (
  tenant_org_id,
  customer_id,
  loyalty_points,
  preferred_language
)
VALUES (
  'tenant-456',
  'cust-123',
  100,
  'ar'
);

-- Query customer for specific tenant
SELECT
  s.phone,
  s.email,
  o.loyalty_points,
  o.preferred_language
FROM sys_customers_mst s
JOIN org_customers_mst o ON s.id = o.customer_id
WHERE o.tenant_org_id = 'tenant-456';
```

## Security Best Practices

### 1. JWT Claims

```typescript
// Ensure JWT contains tenant_org_id
interface JWTClaims {
  sub: string;          // User ID
  tenant_org_id: string; // CRITICAL for multi-tenancy
  role: string;         // User role
  email: string;
}

// Verify tenant in middleware
async function verifyTenant(req: Request, res: Response, next: Next) {
  const token = req.headers.authorization;
  const claims = await verifyJWT(token);

  if (!claims.tenant_org_id) {
    return res.status(403).json({ error: 'No tenant context' });
  }

  req.tenantId = claims.tenant_org_id;
  next();
}
```

### 2. Service Role Usage

```typescript
// Use service role ONLY for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Keep this SECRET
);

// Regular client for user operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 3. Input Validation

```typescript
// Always validate tenant context
function validateTenantAccess(requestedTenantId: string, userTenantId: string): boolean {
  if (requestedTenantId !== userTenantId) {
    throw new Error('Cross-tenant access denied');
  }
  return true;
}
```

## Multi-Tenant Testing Checklist

- [ ] Create two test tenants
- [ ] Create data for both tenants
- [ ] Query as tenant 1 - verify only tenant 1 data returned
- [ ] Query as tenant 2 - verify only tenant 2 data returned
- [ ] Attempt cross-tenant access - verify it fails
- [ ] Test joins across tables - verify tenant isolation maintained
- [ ] Test aggregations - verify counts are tenant-specific

## Dual-Layer Architecture

```
SYSTEM LAYER (sys_*): Global shared data, no tenant_id
ORGANIZATION LAYER (org_*): Tenant data with RLS
```

Core entities use composite keys like `(tenant_org_id, entity_id)` to enforce isolation at schema level. RLS provides runtime isolation.

### Multi-Tenancy Enforcement Layers

**Application Layer (Prisma Middleware):**
- Auto-inject `tenant_org_id` filter on all `org_*` tables
- Enforced via middleware in `lib/prisma-middleware.ts`
- Compile-time type checking prevents mistakes

**Database Layer (RLS Policies):**
- Existing RLS policies still active
- Defense-in-depth security model
- Works even if application layer bypassed
