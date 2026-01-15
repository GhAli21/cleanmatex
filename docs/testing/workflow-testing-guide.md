# Orders Workflow Testing Guide

## Overview

This guide covers testing strategies for the Orders Workflow System, including database functions, API endpoints, frontend hooks, and E2E scenarios.

## Database Function Tests

### Testing Patterns

There are two patterns for testing database functions:

1. **Using `test_assert()` function** - For simple SQL assertions
2. **Using `DO $$` blocks with `ASSERT`** - For complex test logic with variables

### Test Screen Contract Retrieval

#### Pattern 1: Using test_assert() function

```sql
-- File: supabase/tests/functions/test_screen_contracts_simplified.sql

BEGIN;

-- Test 1: Screen contract returns valid structure
SELECT test_assert(
  cmx_ord_screen_pre_conditions('preparation')->>'statuses' IS NOT NULL,
  'Screen contract should return statuses'
);

-- Test 2: Preparation screen returns correct statuses
SELECT test_assert(
  cmx_ord_screen_pre_conditions('preparation')->'statuses' @> '["preparing"]'::jsonb,
  'Preparation screen should include preparing status'
);

-- Test 3: Unknown screen returns empty array
SELECT test_assert_equals(
  jsonb_array_length(cmx_ord_screen_pre_conditions('unknown')->'statuses'),
  0,
  'Unknown screen should return empty statuses array'
);

-- Test 4: JSONB key exists
SELECT test_assert_jsonb_has_key(
  cmx_ord_screen_pre_conditions('preparation'),
  'statuses',
  'Screen contract should have statuses key'
);

ROLLBACK;
```

#### Pattern 2: Using DO blocks with ASSERT (for complex tests)

```sql
DO $$
DECLARE
  v_contract JSONB;
BEGIN
  v_contract := cmx_ord_screen_pre_conditions('preparation');

  ASSERT v_contract->>'statuses' IS NOT NULL, 'Screen contract should return statuses';
  ASSERT v_contract->'statuses' @> '["preparing"]'::jsonb, 'Preparation screen should include preparing status';
END $$;
```

### Test Basic Validation

```sql
-- Test valid transition
SELECT test_assert(
  (cmx_ord_validate_transition_basic(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'preparing',
    'processing'
  )->>'ok')::boolean = true,
  'Valid transition should pass basic validation'
);

-- Test status mismatch
SELECT test_assert(
  (cmx_ord_validate_transition_basic(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'wrong_status',
    'processing'
  )->>'ok')::boolean = false,
  'Status mismatch should fail validation'
);
```

### Available Test Utility Functions

The following test utility functions are available (from migration `0078_test_utility_functions.sql`):

- `test_assert(condition BOOLEAN, message TEXT)` - Assert a boolean condition
- `test_assert_jsonb_has_key(jsonb_value JSONB, key_name TEXT, message TEXT)` - Assert JSONB has a key
- `test_assert_jsonb_equals(actual JSONB, expected JSONB, message TEXT)` - Assert JSONB equality
- `test_assert_not_null(value ANYELEMENT, message TEXT)` - Assert value is not NULL
- `test_assert_equals(actual ANYELEMENT, expected ANYELEMENT, message TEXT)` - Assert value equality

### Test Atomic Transition

```sql
-- Test transition execution
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := cmx_ord_execute_transition(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'preparation',
    'preparing',
    'processing',
    '00000000-0000-0000-0000-000000000003'::uuid
  );

  ASSERT (v_result->>'ok')::boolean = true, 'Transition should succeed';
  ASSERT v_result->>'to_status' = 'processing', 'Status should be updated';
END $$;
```

## API Integration Tests

### Test Transition API (Old Code Path)

```typescript
// File: web-admin/__tests__/api/workflow-transition.test.ts

import { POST } from "@/app/api/v1/orders/[id]/transition/route";
import { createClient } from "@/lib/supabase/server";

describe("Workflow Transition API", () => {
  it("should use old code when USE_OLD_WF_CODE_OR_NEW is false", async () => {
    const request = new Request(
      "http://localhost/api/v1/orders/123/transition",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "processing",
          useOldWfCodeOrNew: false,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBeDefined();
  });
});
```

### Test Transition API (New Code Path)

```typescript
it("should use new code when USE_OLD_WF_CODE_OR_NEW is true", async () => {
  // Mock HQ Platform APIs
  jest.mock("@/lib/services/feature-flags.service");
  jest.mock("@/lib/services/usage-tracking.service");
  jest.mock("@/lib/api/hq-api-client");

  const request = new Request("http://localhost/api/v1/orders/123/transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      screen: "preparation",
      useOldWfCodeOrNew: true,
    }),
  });

  const response = await POST(request, {
    params: Promise.resolve({ id: "123" }),
  });
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.ok).toBe(true);
});
```

### Test Screen Contract API

```typescript
// File: web-admin/__tests__/api/screen-contract.test.ts

import { GET } from "@/app/api/v1/workflows/screens/[screen]/contract/route";

describe("Screen Contract API", () => {
  it("should return screen contract for preparation", async () => {
    const request = new Request(
      "http://localhost/api/v1/workflows/screens/preparation/contract"
    );
    const response = await GET(request, {
      params: Promise.resolve({ screen: "preparation" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.screen).toBe("preparation");
    expect(data.preConditions.statuses).toBeDefined();
  });
});
```

### Test Workflow Context API

```typescript
// File: web-admin/__tests__/api/workflow-context.test.ts

import { GET } from "@/app/api/v1/orders/[id]/workflow-context/route";

describe("Workflow Context API", () => {
  it("should return workflow flags and metrics", async () => {
    const request = new Request(
      "http://localhost/api/v1/orders/123/workflow-context"
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.flags).toBeDefined();
    expect(data.metrics).toBeDefined();
  });
});
```

## Frontend Hook Tests

### Test useScreenContract Hook

```typescript
// File: web-admin/__tests__/hooks/use-screen-contract.test.tsx

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useScreenContract } from "@/lib/hooks/use-screen-contract";

describe("useScreenContract", () => {
  it("should fetch screen contract", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useScreenContract("preparation"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.screen).toBe("preparation");
    expect(result.current.data?.preConditions.statuses).toBeDefined();
  });
});
```

### Test useOrderTransition Hook

```typescript
// File: web-admin/__tests__/hooks/use-order-transition.test.tsx

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrderTransition } from "@/lib/hooks/use-order-transition";

describe("useOrderTransition", () => {
  it("should execute transition", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useOrderTransition(), { wrapper });

    result.current.mutate({
      orderId: "123",
      input: {
        screen: "preparation",
        useOldWfCodeOrNew: true,
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

## E2E Test Scenarios

### Test Complete Workflow Transition

```typescript
// File: web-admin/__tests__/e2e/workflow-transition.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Workflow Transition", () => {
  test("should transition order from preparation to processing", async ({
    page,
  }) => {
    // Login
    await page.goto("/login");
    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // Navigate to preparation screen
    await page.goto("/dashboard/preparation");

    // Wait for orders to load
    await page.waitForSelector('[data-testid="order-card"]');

    // Click complete button
    await page.click('[data-testid="complete-preparation-btn"]');

    // Verify transition
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

### Test Quality Gates

```typescript
test("should block transition to ready if quality gates not met", async ({
  page,
}) => {
  await page.goto("/dashboard/packing");

  // Try to complete packing
  await page.click('[data-testid="complete-packing-btn"]');

  // Verify error message
  await expect(
    page.locator('[data-testid="quality-gate-error"]')
  ).toBeVisible();
  await expect(page.locator("text=Quality gates not met")).toBeVisible();
});
```

## Performance Testing

### Load Test Transition API

```typescript
// File: web-admin/__tests__/performance/workflow-transition-load.test.ts

import { performance } from "perf_hooks";

describe("Workflow Transition Performance", () => {
  it("should handle 100 concurrent transitions", async () => {
    const start = performance.now();
    const promises = Array.from({ length: 100 }, (_, i) =>
      fetch("/api/v1/orders/123/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen: "preparation",
          useOldWfCodeOrNew: true,
        }),
      })
    );

    await Promise.all(promises);
    const end = performance.now();

    expect(end - start).toBeLessThan(5000); // Should complete in under 5 seconds
  });
});
```

## Concurrent Access Tests

### Test Optimistic Concurrency

```typescript
describe("Concurrent Access", () => {
  it("should handle concurrent updates with optimistic locking", async () => {
    // Get order with updated_at
    const order1 = await fetch("/api/v1/orders/123").then((r) => r.json());
    const order2 = await fetch("/api/v1/orders/123").then((r) => r.json());

    // Both transitions use same expected_updated_at
    const [result1, result2] = await Promise.all([
      fetch("/api/v1/orders/123/transition", {
        method: "POST",
        body: JSON.stringify({
          screen: "preparation",
          expected_updated_at: order1.updated_at,
        }),
      }),
      fetch("/api/v1/orders/123/transition", {
        method: "POST",
        body: JSON.stringify({
          screen: "preparation",
          expected_updated_at: order2.updated_at,
        }),
      }),
    ]);

    // One should succeed, one should fail with CONCURRENT_UPDATE
    const results = await Promise.all([result1.json(), result2.json()]);
    const successCount = results.filter((r) => r.ok).length;
    expect(successCount).toBe(1);
  });
});
```

## Test Data Setup

### Create Test Order

```sql
-- Insert test order
INSERT INTO org_orders_mst (
  id,
  tenant_org_id,
  current_status,
  workflow_template_id
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'preparing',
  (SELECT template_id FROM sys_workflow_template_cd WHERE template_code = 'WF_SIMPLE' LIMIT 1)
);
```

### Cleanup Test Data

```sql
-- Cleanup after tests
DELETE FROM org_order_history WHERE order_id = '00000000-0000-0000-0000-000000000002'::uuid;
DELETE FROM org_orders_mst WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
```

## Running Tests

### Database Tests

```bash
psql -d cleanmatex -f supabase/tests/functions/test_screen_contracts_simplified.sql
```

### API Tests

```bash
npm run test:api
```

### Frontend Tests

```bash
npm run test:hooks
```

### E2E Tests

```bash
npm run test:e2e
```

### All Tests

```bash
npm run test
```
