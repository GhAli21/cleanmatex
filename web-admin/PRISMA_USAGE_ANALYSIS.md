# Prisma Usage Analysis Report

**Date**: 2025-01-16  
**Status**: ⚠️ **Issues Found - Needs Improvement**

## Executive Summary

Prisma is configured correctly, but usage patterns across the codebase are inconsistent. Some files use tenant context properly, while others rely solely on manual filters without the `withTenantContext()` wrapper.

---

## ✅ What's Working Correctly

### 1. Prisma Client Configuration

- ✅ Single consolidated client (`lib/db/prisma.ts`)
- ✅ Middleware properly applied
- ✅ Singleton pattern working
- ✅ All imports using correct client

### 2. Server Actions

- ✅ `app/actions/orders/list-orders.ts` - Uses `withTenantContext()` correctly

### 3. No Direct PrismaClient Instantiations

- ✅ Only intentional instantiations:
  - `lib/db/prisma.ts` - Main singleton (correct)
  - `lib/prisma-middleware.ts` - `createTenantScopedPrisma()` (intentional)
  - `scripts/test-prisma-connection.ts` - Test script (OK)

---

## ⚠️ Issues Found

### Issue 1: API Routes Not Using Tenant Context

**Files Affected**:

- `app/api/v1/preparation/[id]/complete/route.ts`
- `app/api/v1/preparation/[id]/items/[itemId]/route.ts`

**Problem**: These routes use Prisma directly without `withTenantContext()` wrapper.

**Current Pattern**:

```typescript
const tenantId = user.user_metadata?.tenant_org_id;
// ... validation ...

// Direct Prisma query without tenant context
await prisma.org_orders_mst.update({
  where: { id: orderId, tenant_org_id: tenantId }, // Manual filter
  data: { status: "sorting" },
});
```

**Recommended Pattern**:

```typescript
const tenantId = user.user_metadata?.tenant_org_id;
if (!tenantId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Wrap with tenant context
await withTenantContext(tenantId, async () => {
  await prisma.org_orders_mst.update({
    where: { id: orderId }, // Middleware adds tenant_org_id automatically
    data: { status: "sorting" },
  });
});
```

**Impact**:

- ⚠️ **Low Risk** - Manual filters provide defense in depth
- ⚠️ **Inconsistent** - Not following best practices
- ⚠️ **Maintenance** - Easy to forget manual filter

**Recommendation**: Update to use `withTenantContext()` for consistency.

---

### Issue 2: Services Not Using Centralized Tenant Context

**Files Affected**:

- `lib/services/invoice-service.ts`
- `lib/services/gift-card-service.ts`
- `lib/services/discount-service.ts`
- `lib/services/payment-service.ts`
- `lib/services/customers.service.ts`
- `lib/services/catalog.service.ts`
- `lib/services/customer-addresses.service.ts`

**Problem**: Services have their own `getTenantIdFromSession()` implementations instead of using the centralized one from `@/lib/db/tenant-context`.

**Current Pattern**:

```typescript
// Each service has its own implementation
async function getTenantIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.user_metadata?.tenant_org_id;
}

// Then uses Prisma without tenant context wrapper
const order = await prisma.org_orders_mst.findUnique({
  where: { id: input.order_id }, // Missing tenant filter!
});
```

**Issues**:

1. ❌ **Code Duplication** - Multiple implementations of same function
2. ❌ **No Tenant Context** - Services don't use `withTenantContext()` wrapper
3. ❌ **Missing Filters** - Some queries don't have manual tenant filters
4. ⚠️ **Security Risk** - Queries without tenant filters rely solely on middleware

**Example from `invoice-service.ts`**:

```typescript
// Line 32: Query without tenant filter!
const order = await prisma.org_orders_mst.findUnique({
  where: { id: input.order_id }, // Missing tenant_org_id!
  include: {
    org_order_items_dtl: true,
  },
});
```

**Example from `gift-card-service.ts`**:

```typescript
// Line 35: Query without tenant filter!
const giftCard = await prisma.org_gift_cards_mst.findFirst({
  where: {
    card_number: input.card_number,
    is_active: true,
    // Missing tenant_org_id!
  },
});
```

**Recommendation**:

1. Import centralized `getTenantIdFromSession()` from `@/lib/db/tenant-context`
2. Wrap all Prisma queries with `withTenantContext()`
3. Remove duplicate `getTenantIdFromSession()` implementations

---

### Issue 3: DB Functions Pattern (Acceptable but Not Optimal)

**Files Affected**:

- `lib/db/orders.ts`

**Current Pattern**:

```typescript
export async function listOrdersDb(tenantOrgId: string, filters: OrderFilters) {
  // Manual tenant filter + middleware backup
  const orders = await prisma.org_orders_mst.findMany({
    where: {
      tenant_org_id: tenantOrgId, // Manual filter
      status: filters.status,
    },
  });
}
```

**Status**: ✅ **Acceptable** - Defense in depth pattern

- Manual filters provide explicit tenant scoping
- Middleware adds backup protection
- Functions receive `tenantOrgId` as parameter

**Note**: This pattern is documented as acceptable in `PRISMA_SETUP.md` Pattern 3.

---

## Security Analysis

### Current Protection Level

| Location       | Tenant Context | Manual Filter | Middleware | Risk Level         |
| -------------- | -------------- | ------------- | ---------- | ------------------ |
| Server Actions | ✅ Yes         | ✅ Yes        | ✅ Yes     | ✅ **SAFE**        |
| API Routes     | ❌ No          | ✅ Yes        | ✅ Yes     | ⚠️ **LOW RISK**    |
| Services       | ❌ No          | ⚠️ Partial    | ✅ Yes     | ⚠️ **MEDIUM RISK** |
| DB Functions   | ❌ No          | ✅ Yes        | ✅ Yes     | ✅ **SAFE**        |

### Risk Assessment

**API Routes** (Low Risk):

- ✅ Manual filters present
- ✅ Middleware provides backup
- ⚠️ Not using best practices

**Services** (Medium Risk):

- ⚠️ Some queries missing manual filters
- ✅ Middleware provides protection
- ❌ No tenant context wrapper
- ⚠️ Code duplication

---

## Recommendations

### Priority 1: Fix Services (High Priority)

**Action**: Update all services to use centralized tenant context.

**Steps**:

1. Import from centralized location:

   ```typescript
   import {
     withTenantContext,
     getTenantIdFromSession,
   } from "@/lib/db/tenant-context";
   ```

2. Remove duplicate `getTenantIdFromSession()` implementations

3. Wrap Prisma queries with tenant context:
   ```typescript
   export async function createInvoice(input: CreateInvoiceInput) {
     const tenantId = await getTenantIdFromSession();
     if (!tenantId) throw new Error("Unauthorized");

     return withTenantContext(tenantId, async () => {
       const order = await prisma.org_orders_mst.findUnique({
         where: { id: input.order_id },
         // Middleware adds tenant_org_id automatically
       });
       // ... rest of function
     });
   }
   ```

### Priority 2: Update API Routes (Medium Priority)

**Action**: Add `withTenantContext()` wrapper to API routes.

**Example Fix**:

```typescript
// app/api/v1/preparation/[id]/complete/route.ts
import { withTenantContext } from "@/lib/db/tenant-context";

export async function POST(request: NextRequest, { params }) {
  const tenantId = user.user_metadata?.tenant_org_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await withTenantContext(tenantId, async () => {
    await prisma.org_orders_mst.update({
      where: { id: orderId }, // Middleware adds tenant_org_id
      data: { status: "sorting" },
    });
  });
}
```

### Priority 3: Keep DB Functions Pattern (Low Priority)

**Action**: Keep current pattern for DB functions (defense in depth).

**Rationale**:

- Functions receive `tenantOrgId` as explicit parameter
- Manual filters make tenant scoping explicit
- Middleware provides backup protection
- Pattern is documented and acceptable

---

## Migration Checklist

### Services to Update

- [ ] `lib/services/invoice-service.ts`
- [ ] `lib/services/gift-card-service.ts`
- [ ] `lib/services/discount-service.ts`
- [ ] `lib/services/payment-service.ts`
- [ ] `lib/services/customers.service.ts`
- [ ] `lib/services/catalog.service.ts`
- [ ] `lib/services/customer-addresses.service.ts`

### API Routes to Update

- [ ] `app/api/v1/preparation/[id]/complete/route.ts`
- [ ] `app/api/v1/preparation/[id]/items/[itemId]/route.ts`

### Files to Keep As-Is

- ✅ `lib/db/orders.ts` - Current pattern acceptable
- ✅ `app/actions/orders/list-orders.ts` - Already correct

---

## Code Examples

### ✅ Correct Pattern (Server Actions)

```typescript
"use server";

import {
  withTenantContext,
  getTenantIdFromSession,
} from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export async function listOrders(filters: unknown) {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error("Unauthorized");

  return withTenantContext(tenantId, async () => {
    return await prisma.org_orders_mst.findMany({
      where: { status: "active" },
      // tenant_org_id added automatically by middleware
    });
  });
}
```

### ⚠️ Current Pattern (Services - Needs Fix)

```typescript
// ❌ Don't do this
async function getTenantIdFromSession(): Promise<string> {
  // Duplicate implementation
}

export async function createInvoice(input: CreateInvoiceInput) {
  // No tenant context wrapper
  const order = await prisma.org_orders_mst.findUnique({
    where: { id: input.order_id }, // Missing tenant filter!
  });
}
```

### ✅ Recommended Pattern (Services)

```typescript
// ✅ Do this
import {
  withTenantContext,
  getTenantIdFromSession,
} from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";

export async function createInvoice(input: CreateInvoiceInput) {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error("Unauthorized");

  return withTenantContext(tenantId, async () => {
    const order = await prisma.org_orders_mst.findUnique({
      where: { id: input.order_id },
      // tenant_org_id added automatically by middleware
    });
    // ... rest of function
  });
}
```

---

## Summary

### Current Status

- ✅ **Configuration**: Perfect
- ✅ **Middleware**: Working correctly
- ⚠️ **Usage**: Inconsistent patterns
- ⚠️ **Services**: Need tenant context wrapper
- ⚠️ **API Routes**: Should use tenant context

### Security Status

- ✅ **Protected**: Middleware ensures tenant isolation
- ⚠️ **Best Practices**: Not consistently followed
- ⚠️ **Code Quality**: Duplicate implementations

### Action Required

1. **High Priority**: Update services to use centralized tenant context
2. **Medium Priority**: Add tenant context wrapper to API routes
3. **Low Priority**: Document acceptable patterns for DB functions

---

**Next Steps**: Update services and API routes to use `withTenantContext()` wrapper for consistency and best practices.
