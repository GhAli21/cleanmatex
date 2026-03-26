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

```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL
    }
  }
});

beforeAll(async () => {
  // Run migrations
  await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS test`;
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

## Additional Resources

- See [reference.md](./reference.md) for complete testing documentation
