---
name: debugging
description: Common issues, debugging techniques, error handling patterns, and build fixes. Use when encountering errors, build failures, or debugging issues.
user-invocable: true
---

# Debugging Guide

## Quick Fixes

### Build Error: `g.$use is not a function`
Prisma middleware issue during webpack bundling.

**Fix in `lib/db/prisma.ts`:**
```typescript
if (typeof (prismaClient as any).$use === 'function') {
  applyTenantMiddleware(prismaClient);
}
```

Also add to API routes using Prisma:
```typescript
export const runtime = 'nodejs';
```

### Build Error: `Cannot find module`
```bash
rm -rf node_modules package-lock.json
npm install
rm -rf .next
npm run build
```

### next-intl Config Missing
Add to `next.config.ts`:
```typescript
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');
export default withNextIntl(nextConfig);
```

### RLS Policy Blocking Query
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'org_orders_mst';

-- Test with tenant context
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

### Cross-Tenant Data Leak
Missing tenant filter! Always add:
```typescript
.eq('tenant_org_id', tenantId)
```

### TypeScript Type Errors After Schema Change
```bash
supabase gen types typescript --local > web-admin/types/database.ts
# Then restart TS server: Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### N+1 Query Problem
```typescript
// BAD: N+1 queries
for (const order of orders) {
  const customer = await supabase.from('customers').eq('id', order.customer_id);
}

// GOOD: Single query with joins
const { data } = await supabase
  .from('org_orders_mst')
  .select(`*, customer:org_customers_mst(*)`)
  .eq('tenant_org_id', tenantId);
```

### Arabic/RTL Display Issues
```tsx
// HTML direction
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>

// Tailwind RTL utilities
<div className="text-left rtl:text-right">
<div className="ml-4 rtl:ml-0 rtl:mr-4">
<ChevronRight className="rtl:rotate-180" />
```

## Debug Commands

```bash
# Supabase Studio
open http://localhost:54323

# Check database
psql -h localhost -p 54322 -U postgres -d postgres

# Clean build
rm -rf .next && npm run build
```

## Error Response Format

```typescript
{
  success: false,
  error: {
    code: "ORDER_NOT_FOUND",
    message: "Order with ID 123 not found",
    details: { orderId: "123" },
    timestamp: "2025-11-14T10:30:00Z",
    requestId: "req-789"
  }
}
```

## Logging Pattern

```typescript
import { logger } from '@/lib/utils/logger';

logger.error('Failed to process order', error as Error, {
  tenantId,
  userId,
  orderId,
  feature: 'order_processing',
  action: 'process',
});
```

See `common-issues.md` for comprehensive debugging guide.
See `error-handling.md` for error patterns.
See `logging.md` for logging standards.
