---
name: debugging
description: Common issues, debugging techniques, error handling patterns, build fixes. Use when encountering errors, build failures, or debugging issues.
user-invocable: true
---

# Debugging Guide - Quick Fixes

## Build Errors

### `g.$use is not a function` (Prisma Middleware)

Prisma middleware issue during webpack bundling.

**Fix in `lib/db/prisma.ts`:**
```typescript
// Apply middleware with safety check
if (typeof (prismaClient as any).$use === 'function') {
  applyTenantMiddleware(prismaClient);
}
```

### `Cannot find module`

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### `next-intl Config Missing`

Add to `next.config.ts`:
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  // Your config...
};

export default withNextIntl(nextConfig);
```

## Database Issues

### RLS Blocking Query

**Symptom:** Query returns empty or permission error

**Diagnosis:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'org_orders_mst';

-- Test with tenant context
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

**Fix:** Use service role for admin operations or ensure JWT contains `tenant_org_id`

### Cross-Tenant Data Leak

**Symptom:** Can see other tenant's data

**Problem:** Missing tenant filter

```typescript
// WRONG - Missing tenant filter
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('id', orderId);

// CORRECT - With tenant filter
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId)  // REQUIRED
  .eq('id', orderId);
```

### Migration Fails

**Common errors:**
- `relation does not exist` → Check table creation order
- `foreign key violation` → Check FK dependencies
- `syntax error` → Check SQL syntax

**Fix:**
```bash
# Test specific migration
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/XXX.sql

# Check migration order
ls -la supabase/migrations/
```

### N+1 Query Problem

**Symptom:** Slow page load, many queries

```typescript
// WRONG - Creates N+1 queries
const orders = await supabase.from('org_orders_mst').select('*');
for (const order of orders) {
  const customer = await supabase
    .from('org_customers_mst')
    .select('*')
    .eq('id', order.customer_id)
    .single();
}

// CORRECT - Single query with joins
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

### TypeScript Type Errors

**After database changes:**
```bash
# Regenerate types from database
supabase gen types typescript --local > web-admin/types/database.ts

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## Authentication Issues

### Missing Tenant Context

```typescript
// Add tenant_org_id during signup
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      tenant_org_id: tenantId,  // CRITICAL
      role: 'staff',
    },
  },
});
```

### Session Expired

```typescript
// Refresh session
const { data: { session } } = await supabase.auth.refreshSession();

// Auto-refresh setup
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed');
  }
});
```

## Performance Issues

### Slow Queries

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM org_orders_mst
WHERE tenant_org_id = 'uuid'
AND status = 'PENDING';

-- Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'org_orders_mst';
```

**Add missing indexes:**
```sql
CREATE INDEX idx_orders_tenant_status
ON org_orders_mst(tenant_org_id, status);

CREATE INDEX idx_orders_created
ON org_orders_mst(tenant_org_id, created_at DESC);
```

## RTL Display Issues

### Arabic Text Displays Incorrectly

**Fix HTML direction:**
```tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

**Fix Tailwind RTL:**
```tsx
<div className="text-left rtl:text-right">
<div className="ml-4 rtl:ml-0 rtl:mr-4">
<ChevronRight className="rtl:rotate-180" />
```

**Fix font:**
```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic');
body[dir='rtl'] {
  font-family: 'Noto Sans Arabic', sans-serif;
}
```

## Debugging Tools

### Supabase Studio
```bash
open http://localhost:54323
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

### Logging (Use Centralized Logger)

```typescript
import { logger } from '@/lib/utils/logger';

// NEVER use console.log directly
logger.info('Order created', { orderId, tenantId });
logger.error('Order creation failed', error, { context });
```

## Additional Resources

- [common-issues.md](./common-issues.md) - Comprehensive debugging guide with all issues
- [error-handling.md](./error-handling.md) - Error handling patterns
- [logging.md](./logging.md) - Centralized logging standards
