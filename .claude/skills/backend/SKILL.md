---
name: backend
description: Backend development standards for NestJS, API routes, Supabase server-side patterns, service architecture. Use when creating API endpoints, services, or backend business logic.
user-invocable: true
---

# Backend Standards

Authority note:

- use this skill as backend guidance, not as proof that one tenant-handling pattern fits every module
- `web-admin` and `cmx-api` may use different server-side access patterns
- when this skill conflicts with `CLAUDE.md`, current module READMEs, or current implementation, the current implementation wins

## Next.js API Routes

### Route Handlers (App Router)

```typescript
// app/api/v1/orders/route.ts
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: Request) {
  const tenantId = await getTenantIdFromSession();

  const orders = await withTenantContext(tenantId, async () => {
    return await prisma.org_orders_mst.findMany();
  });

  return Response.json({ data: orders });
}
```

### API Route Organization

```
app/api/
  v1/                    # API version
    orders/
      route.ts           # GET /api/v1/orders, POST /api/v1/orders
      [id]/
        route.ts         # GET/PATCH/DELETE /api/v1/orders/:id
        items/
          route.ts       # GET /api/v1/orders/:id/items
```

**CRITICAL — Dynamic slug consistency**: All sub-routes of the same dynamic segment MUST use the same slug name. Adding a new folder like `[orderId]` alongside an existing `[id]` folder causes:
```
Error: You cannot use different slug names for the same dynamic path ('id' !== 'orderId').
```
Always match the existing slug name. If the parent folder already has `[id]`, any new sub-routes must also live inside `[id]`, not in a new `[orderId]` or `[fooId]` folder. Inside the route file, destructure with an alias if needed:
```ts
const { id: orderId } = await params; // renames to orderId locally
```

## Service Layer Pattern

```typescript
// lib/services/order-service.ts
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';

export class OrderService {
  async createOrder(data: CreateOrderDto) {
    const tenantId = await getTenantIdFromSession();

    return withTenantContext(tenantId, async () => {
      return await prisma.org_orders_mst.create({
        data: {
          ...data,
          // tenant_org_id auto-injected by middleware
        },
      });
    });
  }
}
```

## Supabase Server-Side

```typescript
import { createClient } from '@supabase/supabase-js';

// Server-side client (use service role for admin operations)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Keep SECRET
);

// Regular client for user operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

## Error Handling

```typescript
import { logger } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createOrder(body);
    return Response.json({ success: true, data: result });
  } catch (error) {
    logger.error('Order creation failed', error as Error, {
      tenantId: await getTenantIdFromSession(),
    });

    return Response.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

## Input Validation

```typescript
import { z } from 'zod';

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
  })).min(1),
});

export async function POST(request: Request) {
  const body = await request.json();

  // Validate input
  const validated = createOrderSchema.parse(body);

  // Process...
}
```

## Additional Resources

- [nestjs-standards.md](./nestjs-standards.md) - NestJS patterns (Phase 2)
- [supabase-rules.md](./supabase-rules.md) - Supabase server-side usage
