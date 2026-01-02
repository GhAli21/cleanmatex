> Combined from `@.claude/docs/multitenancy.md` and `@.claude/docs/05-security.md` on 2025-10-17

# Multi‑Tenancy Enforcement

**Rules**
1. Always filter by `tenant_org_id`
2. Composite FKs on joins
3. Enforce RLS on every org_* table
4. Global sys_* tables link to org_* via junctions

**RLS Example**
- Enable RLS on `org_orders_mst`
- Policy ensures `tenant_org_id` matches JWT claim
- Service role policy for administrative use


---

## 🔐 MULTI-TENANCY ENFORCEMENT

### CRITICAL RULES

**🚨 NEVER VIOLATE THESE RULES:**

1. **Always filter by `tenant_org_id`** in every query
2. **Use composite foreign keys** when joining across tenant tables
3. **Leverage RLS policies** for additional security
4. **Global customers** are linked to tenants via junction table

---

## Query Patterns

### ✅ CORRECT - With tenant filtering
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

### ❌ WRONG - Missing tenant filter
```typescript
// SECURITY VULNERABILITY!
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('order_status', 'PENDING');
// This could expose other tenants' data!
```

### ✅ CORRECT - Joins with composite keys
```typescript
const { data } = await supabase
  .from('org_orders_mst')
  .select(`
    *,
    customer:org_customers_mst!inner(*)
  `)
  .eq('tenant_org_id', tenantId);
```

---

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

---

## Global vs Tenant Data

### System Tables (sys_*)
- No `tenant_org_id` column
- Shared across all tenants
- Examples: `sys_customers_mst`, `sys_order_type_cd`
- Used for: Reference data, global customers

### Organization Tables (org_*)
- MUST have `tenant_org_id` column
- RLS enabled
- Junction tables link global to tenant data
- Used for: Tenant-specific business data

### Customer Linking Example
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

---

## Security Best Practices

### 1. JWT Claims
```typescript
// Ensure JWT contains tenant_org_id
interface JWTClaims {
  sub: string;           // User ID
  tenant_org_id: string; // CRITICAL for multi-tenancy
  role: string;          // User role
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
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Keep this SECRET
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
function validateTenantAccess(
  requestedTenantId: string, 
  userTenantId: string
): boolean {
  if (requestedTenantId !== userTenantId) {
    throw new Error('Cross-tenant access denied');
  }
  return true;
}
```

---

## Multi-Tenant Testing Checklist

- [ ] Create two test tenants
- [ ] Create data for both tenants
- [ ] Query as tenant 1 - verify only tenant 1 data returned
- [ ] Query as tenant 2 - verify only tenant 2 data returned
- [ ] Attempt cross-tenant access - verify it fails
- [ ] Test joins across tables - verify tenant isolation maintained
- [ ] Test aggregations - verify counts are tenant-specific

---

## Return to [Main Documentation](../CLAUDE.md)
