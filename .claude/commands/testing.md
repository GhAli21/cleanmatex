> Combined from `@.claude/docs/testing.md` and `@.claude/docs/08-testing.md` on 2025-10-17

# Testing Strategy

- **Unit:** Jest/Vitest, 80%+ target
- **Integration:** Supertest (API), Playwright (E2E)
- **E2E:** Critical UC flows
- **Load:** k6 with p95 < 800ms @ 1000 VUs

**Performance Targets**
- p50 < 300ms, p95 < 800ms
- Order search < 1s @ 100k
- Availability 99.9%


---

## 🧪 TESTING APPROACH

### Current Status
⚠️ **Test infrastructure not yet implemented** - This is the planned approach

---

## Testing Pyramid

```
        /\
       /E2E\      <- 10% - Critical user flows
      /------\
     /  API   \   <- 20% - Integration tests
    /----------\
   /   Unit     \ <- 70% - Business logic
  /--------------\
```

---

## Unit Tests

### Framework
- **Backend**: Jest
- **Frontend**: Vitest
- **Target**: 80%+ code coverage

### Example: Order Validation
```typescript
// tests/order-validation.test.ts
describe('Order Validation', () => {
  it('should validate order completeness before QA', () => {
    const order = createMockOrder({
      items: [
        { id: '1', status: 'ASSEMBLED', qa_status: 'PASSED' },
        { id: '2', status: 'ASSEMBLED', qa_status: 'PASSED' }
      ]
    });
    
    const result = validateOrderForQA(order);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should reject order with missing items', () => {
    const order = createMockOrder({
      items: [
        { id: '1', status: 'WASHING', qa_status: null },
        { id: '2', status: 'ASSEMBLED', qa_status: 'PASSED' }
      ]
    });
    
    const result = validateOrderForQA(order);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Item 1 not assembled');
  });
  
  it('should reject order with failed QA', () => {
    const order = createMockOrder({
      items: [
        { id: '1', status: 'ASSEMBLED', qa_status: 'FAILED' }
      ]
    });
    
    const result = validateOrderForQA(order);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Item 1 failed QA');
  });
});
```

---

## Integration Tests

### API Testing with Supertest
```typescript
// tests/api/orders.test.ts
describe('POST /api/orders', () => {
  let tenant1Token: string;
  let tenant2Token: string;
  
  beforeAll(async () => {
    tenant1Token = await createTestTenant('tenant1');
    tenant2Token = await createTestTenant('tenant2');
  });
  
  it('should create order for authenticated tenant', async () => {
    const orderData = {
      customer_id: 'cust-123',
      items: [
        { service: 'WASH_IRON', quantity: 5 }
      ]
    };
    
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send(orderData);
    
    expect(response.status).toBe(201);
    expect(response.body.data.tenant_org_id).toBe('tenant1');
    expect(response.body.data.items).toHaveLength(1);
  });
  
  it('should prevent cross-tenant access', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${tenant2Token}`);
    
    // Should not see tenant1's orders
    expect(response.body.data).not.toContainEqual(
      expect.objectContaining({ tenant_org_id: 'tenant1' })
    );
  });
});
```

---

## E2E Tests with Playwright

### Critical User Flows
```typescript
// tests/e2e/order-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete order flow from creation to delivery', async ({ page }) => {
  // 1. Login as staff
  await page.goto('/login');
  await page.fill('[name="email"]', 'staff@laundry.com');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');
  
  // 2. Create new order
  await page.goto('/orders/new');
  await page.fill('[name="phone"]', '91234567');
  await page.click('button:has-text("Search Customer")');
  
  // 3. Add items
  await page.click('button:has-text("Add Item")');
  await page.selectOption('[name="service"]', 'WASH_AND_IRON');
  await page.fill('[name="quantity"]', '5');
  await page.selectOption('[name="garment"]', 'SHIRT');
  
  // 4. Create order
  await page.click('button:has-text("Create Order")');
  await expect(page.locator('.success-message')).toBeVisible();
  
  // 5. Progress through workflow
  const orderId = await page.locator('[data-order-id]').getAttribute('data-order-id');
  
  // Move to washing
  await page.click(`button:has-text("Start Washing")`);
  await expect(page.locator('.order-status')).toContainText('WASHING');
  
  // Continue through states...
});

test('Arabic RTL interface', async ({ page }) => {
  // Switch to Arabic
  await page.goto('/ar/orders');
  
  // Verify RTL direction
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  
  // Verify Arabic text
  await expect(page.locator('h1')).toContainText('الطلبات');
});
```

---

## Performance Testing

### Load Testing with k6
```javascript
// tests/load/orders-api.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests under 800ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  const params = {
    headers: {
      'Authorization': 'Bearer ${__ENV.TEST_TOKEN}',
      'Content-Type': 'application/json',
    },
  };
  
  // Test order listing
  let res = http.get('https://api.cleanmatex.com/orders', params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

---

## Performance Targets

From requirements document:

| Metric | Target | Measure |
|--------|---------|---------|
| **API Response p50** | < 300ms | 50% of requests |
| **API Response p95** | < 800ms | 95% of requests |
| **Order Search** | < 1s | At 100k records |
| **Availability** | 99.9% | Max 43min downtime/month |
| **Database Queries** | < 100ms | For indexed queries |

---

## Multi-Tenant Testing

### Critical Test Scenarios
```typescript
describe('Multi-tenancy Isolation', () => {
  test('Tenant cannot see other tenant data', async () => {
    // Setup
    const tenant1 = await createTenant('Laundry A');
    const tenant2 = await createTenant('Laundry B');
    
    const order1 = await createOrder(tenant1.id, { /* data */ });
    const order2 = await createOrder(tenant2.id, { /* data */ });
    
    // Test isolation
    const tenant1Orders = await getOrders(tenant1.token);
    expect(tenant1Orders).toContainEqual(
      expect.objectContaining({ id: order1.id })
    );
    expect(tenant1Orders).not.toContainEqual(
      expect.objectContaining({ id: order2.id })
    );
  });
  
  test('Composite foreign keys enforce tenant boundaries', async () => {
    const tenant1 = await createTenant('Laundry A');
    const tenant2 = await createTenant('Laundry B');
    
    // Try to reference tenant2's customer from tenant1's order
    await expect(
      createOrderWithCustomer(tenant1.id, tenant2.customerId)
    ).rejects.toThrow('Foreign key violation');
  });
});
```

---

## Test Data Management

### Seed Data for Testing
```sql
-- tests/fixtures/seed-test-data.sql

-- Test tenants
INSERT INTO org_tenants_mst (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Laundry 1'),
  ('22222222-2222-2222-2222-222222222222', 'Test Laundry 2');

-- Test customers
INSERT INTO sys_customers_mst (id, phone, first_name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '91111111', 'Test Customer 1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '92222222', 'Test Customer 2');
```

---

## Testing Checklist

### Before Each Release
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E critical flows tested
- [ ] Performance benchmarks met
- [ ] Multi-tenant isolation verified
- [ ] RTL/Arabic interface tested
- [ ] Mobile responsive tested
- [ ] Payment flows tested (sandbox)
- [ ] Error handling tested
- [ ] Security scan completed

---

## Return to [Main Documentation](../CLAUDE.md)
