---
name: backend
description: Backend development standards for NestJS, API routes, Supabase server-side patterns, service architecture. Use when creating API endpoints, services, or backend business logic.
user-invocable: true
effort: medium
agents:
---

# Backend Standards

Authority note:

- use this skill as backend guidance, not as proof that one tenant-handling pattern fits every module
- `web-admin` and `cmx-api` may use different server-side access patterns
- preserve module-specific patterns from current code and module READMEs within explicit repository security, tenant, money and authorization rules; current implementation never overrides those rules

## Performance engineering

Apply the [shared performance rules](../../../docs/dev/rules/performance-engineering.md) when changing request orchestration, data access or caching.

- Revalidate the current affected path before applying a prior plan; trace proxy/middleware, route, service, RPC/SQL and provider work, including repeated authentication.
- Share identical in-flight fact reads through typed request-owned context keyed by every relevant tenant, user, branch, input, policy and effective-time dimension. Keep strict failures distinct from verified absence and forgiving fallbacks.
- Start independent reads after security/ownership gates; keep optional reads lazy, preserve dependencies and bound fan-out. Do not assume promises inside a single-connection transaction execute SQL in parallel.
- Check apparently read-only helpers for expiry maintenance or other effects before prefetching, retrying or parallelizing them. Cancellation does not prove started database work stopped.
- Preserve thin routes, service/use-case boundaries, explicit tenant predicates, session/permission authority, money correctness, idempotency and lock ordering. A cache is not a replacement for current admission checks.
- Validate the actual bottleneck and correctness with proportional evidence; distinguish fewer transport calls from less database work and measured runtime results from static checks.

## Next.js API Routes

### Route Handlers (App Router)

Illustrative route/service pair below; the service module is part of the example, not an existing import contract. A production list also validates filters and paginates.

```typescript
// app/api/v1/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderService } from '@/lib/services/example-order.service';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  const orders = await new OrderService().listOrders(auth.tenantId);
  return NextResponse.json({ data: orders });
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

The create input below is an internal persistence type, not an HTTP DTO. A real create use-case validates/authorizes related identifiers, nested writes, pricing and workflow before reaching persistence; reuse that use-case rather than exposing this fragment as a create endpoint.

```typescript
// lib/services/example-order.service.ts
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

type CreateOrderData = Omit<Prisma.org_orders_mstUncheckedCreateInput, 'tenant_org_id'>;

export class OrderService {
  async listOrders(tenantId: string) {
    return withTenantContext(tenantId, () =>
      prisma.org_orders_mst.findMany({
        where: { tenant_org_id: tenantId },
        take: 50,
      }),
    );
  }

  async createOrder(tenantId: string, data: CreateOrderData) {
    return withTenantContext(tenantId, () =>
      prisma.org_orders_mst.create({
        data: {
          ...data,
          // Authenticated scope wins even if an untrusted object contains this property.
          tenant_org_id: tenantId,
        },
      }),
    );
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

Use the route's existing safe error-response adapter. Inside a service/use-case, reuse authenticated context for logs rather than resolving authentication again:

```typescript
import { logger } from '@/lib/utils/logger';

async function withOrderErrorLogging<T>(
  tenantId: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(
      'Order operation failed',
      error instanceof Error ? error : new Error('Unknown order error'),
      { tenantId },
    );
    throw error;
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

## Access contracts & API gates (`*-access.ts`)

Load **`/rebuild-ui-access-contract`** when adding or changing dashboard routes, server actions, or API permission enforcement.

| Layer | Responsibility |
|-------|----------------|
| `*-access.ts` | Declares `page.permissions`, `actions`, `apiDependencies` |
| `app/api/**/route.ts` | `requirePermission(code)(request)` for each local `/api/*` path in contract |
| `app/actions/**` | `hasPermissionServer('resource:action')` per mutation; derive documents `/app/actions/...` |
| `derive --apply` | Merges `/api/*` literals + server-action modules into `apiDependencies` |

```bash
# After API or action permission changes — refresh contract deps, then validate
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply
npm run wire:ui-access-contract -- --route=/dashboard/foo --fix
npm run check:ui-access-contract -- --route=/dashboard/foo --wire
```

Server-action-only features (no `/api/*` strings in UI): wire reports `API external/manual` for `/app/actions/...` — expected; enforcement is in the action file.

## Platform info inventories (conditional)

After adding or changing API permission guards, `requireFeature`, or plan-limit middleware:

1. Load **`/rebuild-platform-info-inventories`** — `Mode: refresh` · `Scope: surface=api` or `service`
2. Run `npm run rebuild:platform-info-inventories`
