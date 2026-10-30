---
name: testing
description: Testing strategy, test patterns, and commands for unit, integration, and E2E tests. Use when writing tests or understanding testing approach.
user-invocable: true
---

# Testing Strategy

## Testing Layers

### Unit Tests
- Test individual functions and utilities
- Mock external dependencies
- Fast execution

### Integration Tests
- Test API routes end-to-end
- Test database operations
- Use test database

### Multi-Tenant Testing
- **CRITICAL**: Always test tenant isolation
- Create test data for multiple tenants
- Verify cross-tenant access is blocked

### Money-Field Behavior Testing
- Apply `docs/dev/rules/no-silent-money-mutation.md` for any payment, pricing, refund, wallet, discount, or voucher flow
- Verify invalid money entry is prevented or clearly blocked
- Verify unavoidable money adjustments are explained inline at the moment they occur
- Verify toggles, mode switches, dialog close, and state transitions never silently rewrite typed money

## Test Structure

```typescript
// __tests__/services/order-service.test.ts
import { OrderService } from '@/lib/services/order-service';
import { prisma } from '@/lib/db/prisma';

describe('OrderService', () => {
  let service: OrderService;
  const tenantId1 = 'tenant-123';
  const tenantId2 = 'tenant-456';

  beforeEach(async () => {
    service = new OrderService();
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup test data
  });

  it('should create order for tenant', async () => {
    const order = await service.createOrder({
      customerId: 'cust-123',
      items: [{ productId: 'prod-1', quantity: 2 }]
    });

    expect(order.tenant_org_id).toBe(tenantId1);
  });

  it('should not access other tenant data', async () => {
    // Create order for tenant1
    const order1 = await service.createOrder({ ... }, tenantId1);

    // Try to access as tenant2
    await expect(
      service.getOrder(order1.id, tenantId2)
    ).rejects.toThrow('Not found');
  });
});
```

## Multi-Tenant Test Pattern

```typescript
describe('Tenant Isolation', () => {
  const tenant1 = 'tenant-aaa';
  const tenant2 = 'tenant-bbb';

  beforeEach(async () => {
    // Create test data for both tenants
    await createTestData(tenant1, { orders: 5 });
    await createTestData(tenant2, { orders: 3 });
  });

  it('tenant1 should only see their data', async () => {
    const orders = await getOrders(tenant1);
    expect(orders.length).toBe(5);
    orders.forEach(order => {
      expect(order.tenant_org_id).toBe(tenant1);
    });
  });

  it('tenant2 should only see their data', async () => {
    const orders = await getOrders(tenant2);
    expect(orders.length).toBe(3);
    orders.forEach(order => {
      expect(order.tenant_org_id).toBe(tenant2);
    });
  });

  it('should prevent cross-tenant access', async () => {
    const tenant1Order = await createOrder(tenant1);

    // Attempt to access tenant1's order as tenant2
    await expect(
      getOrder(tenant1Order.id, tenant2)
    ).rejects.toThrow();
  });
});
```

## API Route Testing

```typescript
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/v1/orders/route';

describe('GET /api/v1/orders', () => {
  it('should return orders for tenant', async () => {
    const request = new NextRequest('http://localhost/api/v1/orders');

    // Mock auth session
    mockSession({ tenantId: 'tenant-123' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
  });

  it('should require authentication', async () => {
    const request = new NextRequest('http://localhost/api/v1/orders');

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

## Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- order-service.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run only unit tests
npm test -- --testPathPattern=unit

# Run only integration tests
npm test -- --testPathPattern=integration
```

## Test Database Setup

Use an approved test database already provisioned by the user. Test setup must not apply migrations, create schemas or reset databases; the connection check below is read-only.

```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl?.trim()) {
  throw new Error('TEST_DATABASE_URL must identify an approved, user-provisioned test database.');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl
    }
  }
});

beforeAll(async () => {
  // Verify connectivity without mutating the user-provisioned database.
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
});
```

## Mocking

```typescript
// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  },
}));

// Mock auth session
jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
}));
```

## Testing Checklist

- [ ] Unit tests for business logic
- [ ] Integration tests for API routes
- [ ] Multi-tenant isolation tests
- [ ] Edge case testing
- [ ] Error handling tests
- [ ] Input validation tests
- [ ] RLS policy tests
- [ ] Money-field rule tests: no silent mutation, blocked transitions, inline explanation, permission-gated guidance with permission name + code

## Additional Resources

- See [reference.md](./reference.md) for complete testing documentation
- `docs/dev/rules/no-silent-money-mutation.md` - Canonical money-field behavior rule

## Validating performance-sensitive changes

Apply the relevant [performance engineering rules](../../../docs/dev/rules/performance-engineering.md) to a performance investigation or changed data/query/cache/rendering path. Do not require benchmarks for ordinary copy or other low-impact edits; retain the existing applicable static checks.

- Establish comparable fixtures, build/regions, workload/concurrency and cache conditions before claiming improvement. Separate visible content, fresh financial authority and selected-method/confirmation readiness; a cached paint is not safe payment readiness.
- Use focused tests for the affected money, tenant/user isolation, security/session/permission, promise sharing, cancellation, stale confirmation, invalidation and operational transitions. Preserve existing semantics instead of bypassing controls to obtain a pass.
- Test call growth for representative unique/duplicate-line workloads. Mocked application/RPC counts protect structure; they do not establish executed SQL work, query plans, pool pressure, transaction races or deployed latency.
- Capture configured-fixture production-build browser/runtime evidence appropriate to a performance claim, with sample counts, p50/p95, error/timeout rates and blocked/skipped outcomes. A skip, missing prerequisite or safe rejection is not successful readiness proof.
- During performance work, make one small scoped change, run its relevant correctness checks, and compare evidence before the next optimization. Stop and reassess on correctness/security regression; stop speculative optimization when the agreed target is met or evidence no longer justifies expansion.
- Treat numerical performance targets as workload-specific goals requiring defined conditions and evidence, not universal guarantees. Keep database/load/write-capable tests in explicitly suitable authorized environments.
- Run required lint, explicit typecheck, applicable i18n checks and build for changed code; report exact scope and gaps. Do not substitute an unrelated full suite for missing runtime proof or assume a build replaces typechecking when type errors can be ignored.
