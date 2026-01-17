# Prisma Configuration Guide

This document explains how Prisma is configured in CleanMateX with multi-tenant support.

## Architecture

### 1. Consolidated Prisma Client

- **Location**: `lib/db/prisma.ts`
- **Pattern**: Singleton to prevent multiple instances in development
- **Middleware**: Automatically applies tenant filtering

### 2. Tenant Context System

- **Location**: `lib/db/tenant-context.ts`
- **Technology**: AsyncLocalStorage (Node.js async context)
- **Purpose**: Stores tenant ID in async context so middleware can access it synchronously

### 3. Multi-Tenant Middleware

- **Location**: `lib/prisma-middleware.ts`
- **Function**: Automatically filters all `org_*` table queries by `tenant_org_id`
- **Applied**: Automatically when Prisma client is created

## Usage Patterns

### Pattern 1: Server Actions (Recommended)

```typescript
"use server";

import {
  withTenantContext,
  getTenantIdFromSession,
} from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export async function listOrders(filters: unknown) {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error("Unauthorized");
  }

  // Wrap with tenant context - all Prisma queries auto-filter by tenant_org_id
  return withTenantContext(tenantId, async () => {
    // Middleware automatically adds tenant_org_id to all queries
    return await prisma.org_orders_mst.findMany({
      where: {
        status: "active",
        // tenant_org_id is automatically added by middleware
      },
    });
  });
}
```

### Pattern 2: API Routes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTenantContext } from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tenantId = user?.user_metadata?.tenant_org_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Wrap with tenant context
  const orders = await withTenantContext(tenantId, async () => {
    return await prisma.org_orders_mst.findMany();
  });

  return NextResponse.json({ orders });
}
```

### Pattern 3: Direct DB Functions (Current Pattern)

```typescript
import { prisma } from "@/lib/db/prisma";

export async function listOrdersDb(tenantOrgId: string, filters: OrderFilters) {
  // Manual tenant filter (middleware also adds it as backup)
  const orders = await prisma.org_orders_mst.findMany({
    where: {
      tenant_org_id: tenantOrgId, // Manual filter
      status: filters.status,
      // Middleware will merge tenant_org_id if not present
    },
  });

  return orders;
}
```

**Note**: Manual tenant filters are kept for defense-in-depth. Middleware ensures tenant filtering even if manual filters are forgotten.

### Pattern 4: Tenant-Scoped Client (For Scripts/Jobs)

```typescript
import { createTenantScopedPrisma } from "@/lib/prisma-middleware";

// Create a Prisma client scoped to a specific tenant
const prisma = createTenantScopedPrisma("tenant-id");

// All queries automatically filtered by tenant_org_id
const orders = await prisma.org_orders_mst.findMany();
```

## How Middleware Works

1. **Intercepts all Prisma queries** before execution
2. **Checks if model starts with `org_`** (tenant-scoped tables)
3. **Gets tenant ID from AsyncLocalStorage** context
4. **Automatically adds `tenant_org_id`** to:
   - `where` clauses (READ operations)
   - `data` objects (CREATE operations)
   - `where` clauses (UPDATE/DELETE operations)

## Safety Features

### Defense in Depth

- **Primary**: Manual tenant filters in code
- **Backup**: Middleware automatically adds tenant filters
- **Result**: Even if manual filter is forgotten, middleware ensures tenant isolation

### Development vs Production

- **Development**: Warns if tenant context is missing but allows query (for testing)
- **Production**: Throws error if tenant context is missing (prevents data leaks)

## Migration Guide

### Old Pattern (Before Middleware)

```typescript
// Had to manually add tenant_org_id everywhere
const orders = await prisma.org_orders_mst.findMany({
  where: {
    tenant_org_id: tenantOrgId, // Required everywhere
    status: "active",
  },
});
```

### New Pattern (With Middleware)

```typescript
// Wrap with tenant context once
await withTenantContext(tenantId, async () => {
  // All queries automatically filtered
  const orders = await prisma.org_orders_mst.findMany({
    where: {
      status: "active", // tenant_org_id added automatically
    },
  });
});
```

## Best Practices

1. **Always use `withTenantContext()`** in server actions/API routes
2. **Get tenant ID from session** using `getTenantIdFromSession()`
3. **Keep manual filters** for defense-in-depth (optional but recommended)
4. **Never bypass middleware** for `org_*` tables
5. **Use `sys_*` tables** for global data (no tenant filtering needed)

## Troubleshooting

### Error: "Tenant ID is required"

- **Cause**: `withTenantContext()` not called or tenant ID not in session
- **Fix**: Ensure tenant context is set before Prisma queries

### Error: "Cannot read properties of undefined (reading 'groupBy')"

- **Cause**: Prisma client not regenerated after schema changes
- **Fix**: Run `npm run prisma:generate`

### Queries not filtering by tenant

- **Cause**: Middleware not applied or tenant context not set
- **Fix**: Ensure middleware is applied in `lib/db/prisma.ts` and `withTenantContext()` is used

## Files Reference

- `lib/db/prisma.ts` - Main Prisma client (use this)
- `lib/db/tenant-context.ts` - Tenant context management
- `lib/prisma-middleware.ts` - Multi-tenant middleware
- `lib/prisma.ts` - Legacy export (backward compatibility)

## Testing

Test Prisma connection:

```bash
npx tsx scripts/test-prisma-connection.ts
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Open Prisma Studio:

```bash
npm run prisma:studio
```
