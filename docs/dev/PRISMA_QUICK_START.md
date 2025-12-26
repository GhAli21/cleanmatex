# Prisma Quick Start Guide

## ✅ Setup Complete!

Prisma has been successfully integrated into CleanMateX web-admin!

### What's Ready:

- ✅ Prisma schema introspected (13 models from your database)
- ✅ TypeScript types generated
- ✅ Client singleton configured ([`lib/prisma.ts`](lib/prisma.ts))
- ✅ Multi-tenant middleware ready ([`lib/prisma-middleware.ts`](lib/prisma-middleware.ts))
- ✅ Docker Compose service configured

---

## 🚀 Using Prisma Commands

All Prisma CLI commands must run via Docker Compose:

```bash
# Introspect database (pull schema changes)
docker-compose run --rm prisma-cli npx prisma db pull

# Generate TypeScript client (after schema changes)
docker-compose run --rm prisma-cli npx prisma generate

# Open Prisma Studio (visual database browser)
docker-compose run --rm -p 5555:5555 prisma-cli npx prisma studio

# Format schema.prisma
docker-compose run --rm prisma-cli npx prisma format

# Validate schema
docker-compose run --rm prisma-cli npx prisma validate
```

**Why Docker?** Prisma needs to connect to PostgreSQL. Using Docker ensures the connection works via Docker's internal network (`postgres:5432`).

---

## 💻 Using Prisma in Your Code

### 1. Import the Client

```typescript
// In API routes or Server Components
import { prisma } from '@/lib/prisma'
```

### 2. Basic Queries

```typescript
// Find all orders (auto-filtered by tenant_org_id via middleware)
const orders = await prisma.org_orders_mst.findMany({
  take: 10,
  orderBy: { created_at: 'desc' },
})

// Find specific order
const order = await prisma.org_orders_mst.findUnique({
  where: { id: orderId },
})

// Create new order
const newOrder = await prisma.org_orders_mst.create({
  data: {
    order_no: 'ORD-001',
    customer_id: customerId,
    status: 'intake',
    total: 100.500,
    // tenant_org_id will be auto-added by middleware
  },
})
```

### 3. Relations & Joins

```typescript
// Get orders with customer and items
const ordersWithDetails = await prisma.org_orders_mst.findMany({
  include: {
    org_customers_mst: {
      include: {
        sys_customers_mst: true, // Global customer data
      },
    },
    org_order_items_dtl: {
      include: {
        org_product_data_mst: true, // Product details
      },
    },
    org_branches_mst: true, // Branch info
  },
})
```

### 4. Complex Queries

```typescript
// Search orders with filters
const pendingOrders = await prisma.org_orders_mst.findMany({
  where: {
    status: { in: ['intake', 'preparation'] },
    created_at: {
      gte: new Date('2025-01-01'),
    },
    total: {
      gte: 50.0,
    },
  },
  include: {
    org_customers_mst: true,
  },
  orderBy: {
    created_at: 'desc',
  },
})
```

### 5. Aggregations

```typescript
// Get order statistics
const stats = await prisma.org_orders_mst.aggregate({
  _count: true,
  _sum: {
    total: true,
    total_items: true,
  },
  _avg: {
    total: true,
  },
  where: {
    status: 'delivered',
    created_at: {
      gte: new Date('2025-01-01'),
    },
  },
})

console.log(`Total orders: ${stats._count}`)
console.log(`Revenue: ${stats._sum.total}`)
console.log(`Average order: ${stats._avg.total}`)
```

### 6. Transactions

```typescript
// Create order with items atomically
const result = await prisma.$transaction(async (tx) => {
  // Create order
  const order = await tx.org_orders_mst.create({
    data: {
      order_no: 'ORD-002',
      customer_id: customerId,
      status: 'intake',
    },
  })

  // Create order items
  await tx.org_order_items_dtl.createMany({
    data: items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      price_per_unit: item.price,
      total_price: item.quantity * item.price,
    })),
  })

  // Update order total
  const updatedOrder = await tx.org_orders_mst.update({
    where: { id: order.id },
    data: {
      total_items: items.length,
      total: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
    },
  })

  return updatedOrder
})
```

---

## 🔐 Multi-Tenancy (IMPORTANT!)

### Automatic Tenant Filtering

**All `org_*` table queries automatically filter by `tenant_org_id`** via middleware!

```typescript
// You write this:
const orders = await prisma.org_orders_mst.findMany()

// Prisma executes this:
// SELECT * FROM org_orders_mst WHERE tenant_org_id = '[current-tenant-id]'
```

### Implementing Tenant Context

**TODO:** You need to implement `getTenantIdFromSession()` in [`lib/prisma-middleware.ts`](lib/prisma-middleware.ts):

```typescript
// Example implementation:
export function getTenantIdFromSession(): string | null {
  // Get from Next.js session
  const session = await auth()
  return session?.user?.tenant_org_id ?? null

  // Or from Supabase:
  // const supabase = createServerClient(...)
  // const { data: { session } } = await supabase.auth.getSession()
  // return session?.user?.user_metadata?.tenant_org_id ?? null
}
```

### Testing Tenant Isolation

Create tests to verify cross-tenant access is impossible:

```typescript
describe('Tenant Isolation', () => {
  it('should only return tenant A orders', async () => {
    // Set session to tenant A
    mockSession({ tenant_org_id: TENANT_A_ID })

    const orders = await prisma.org_orders_mst.findMany()

    expect(orders.every(o => o.tenant_org_id === TENANT_A_ID)).toBe(true)
  })
})
```

---

## 📁 Example: API Route

Create [`app/api/orders/route.ts`](app/api/orders/route.ts):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Query with Prisma
    const orders = await prisma.org_orders_mst.findMany({
      where: status ? { status } : {},
      include: {
        org_customers_mst: {
          include: {
            sys_customers_mst: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: orders,
      count: orders.length,
    })
  } catch (error) {
    console.error('[API] Get orders error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const order = await prisma.org_orders_mst.create({
      data: {
        order_no: body.order_no,
        customer_id: body.customer_id,
        branch_id: body.branch_id,
        status: 'intake',
        total: body.total || 0,
      },
      include: {
        org_customers_mst: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: order,
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Create order error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
```

Test it:
```bash
# Get orders
curl http://localhost:3000/api/orders

# Get pending orders only
curl http://localhost:3000/api/orders?status=pending

# Create order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"order_no":"ORD-123","customer_id":"uuid-here","total":150.5}'
```

---

## 🔄 Workflow: Database Changes

When you modify the database schema:

```bash
# 1. Create Supabase migration
echo "ALTER TABLE org_orders_mst ADD COLUMN priority INTEGER DEFAULT 1;" \
  > supabase/migrations/0004_add_priority.sql

# 2. Apply to database
docker exec -i cmx-postgres psql -U cmx_user -d cmx_db \
  < supabase/migrations/0004_add_priority.sql

# 3. Update Prisma schema
docker-compose run --rm prisma-cli npx prisma db pull

# 4. Regenerate client
docker-compose run --rm prisma-cli npx prisma generate

# 5. Use new field immediately (with IntelliSense!)
const orders = await prisma.org_orders_mst.findMany({
  where: { priority: { gte: 5 } },
})
```

---

## 🐛 Troubleshooting

### "PrismaClient is unable to run in the browser"

**Cause:** Importing Prisma in a Client Component

**Fix:** Only import `prisma` in Server Components or API routes:
```typescript
// ❌ Client Component
'use client'
import { prisma } from '@/lib/prisma' // ERROR!

// ✅ Server Component (no 'use client')
import { prisma } from '@/lib/prisma' // OK!

// ✅ API Route
import { prisma } from '@/lib/prisma' // OK!
```

### Schema out of sync

```bash
docker-compose run --rm prisma-cli npx prisma db pull
docker-compose run --rm prisma-cli npx prisma generate
```

### Need to reset database

```bash
# Drop all tables (CAREFUL!)
docker exec cmx-postgres psql -U cmx_user -d cmx_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Reapply migrations
docker exec -i cmx-postgres psql -U cmx_user -d cmx_db < supabase/migrations/0001_core.sql
docker exec -i cmx-postgres psql -U cmx_user -d cmx_db < supabase/migrations/0002_rls_core.sql
docker exec -i cmx-postgres psql -U cmx_user -d cmx_db < supabase/migrations/0003_seed_core.sql

# Re-introspect
docker-compose run --rm prisma-cli npx prisma db pull
docker-compose run --rm prisma-cli npx prisma generate
```

---

## 📚 Learn More

- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [Next.js + Prisma](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)

---

## ✅ Next Steps

1. ✅ Prisma is ready to use!
2. ⏳ Implement `getTenantIdFromSession()` in middleware
3. ⏳ Create your first API route using Prisma
4. ⏳ Add tenant isolation tests
5. ⏳ Start building features!

---

**Questions?** Check:
- [Full Setup Guide](PRISMA_SETUP.md)
- [Architecture Docs](../.claude/docs/architecture.md)
- [Integration Summary](../docs/PRISMA_INTEGRATION.md)

Happy coding! 🚀
