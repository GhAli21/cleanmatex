# RBAC Testing Scenarios

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [E2E Tests](#e2e-tests)
6. [Multi-Tenant Isolation Tests](#multi-tenant-isolation-tests)
7. [Performance Tests](#performance-tests)
8. [Security Tests](#security-tests)

---

## Overview

This document provides comprehensive testing scenarios for the RBAC system, covering unit tests, integration tests, E2E tests, and security tests.

### Test Categories

1. **Unit Tests:** Test individual functions and services
2. **Integration Tests:** Test API routes and database interactions
3. **E2E Tests:** Test complete user workflows
4. **Multi-Tenant Tests:** Verify tenant isolation
5. **Performance Tests:** Verify system performance
6. **Security Tests:** Verify security boundaries

---

## Test Environment Setup

### Prerequisites

1. Test database with RBAC migrations applied
2. Test users with different roles
3. Test tenants for multi-tenant tests
4. Test data (orders, customers, etc.)

### Test Users

Create test users with different roles:

```sql
-- Test users
INSERT INTO org_users_mst (user_id, tenant_org_id, display_name, role, is_active)
VALUES
  ('test-admin-uuid', 'test-tenant-1', 'Test Admin', 'admin', true),
  ('test-operator-uuid', 'test-tenant-1', 'Test Operator', 'operator', true),
  ('test-viewer-uuid', 'test-tenant-1', 'Test Viewer', 'viewer', true);
```

### Test Data

```sql
-- Test orders
INSERT INTO org_orders_mst (order_id, tenant_org_id, customer_id, status)
VALUES
  ('test-order-1', 'test-tenant-1', 'test-customer-1', 'pending'),
  ('test-order-2', 'test-tenant-1', 'test-customer-1', 'completed');
```

---

## Unit Tests

### Permission Service Tests

**File:** `web-admin/__tests__/services/permission-service.test.ts`

#### Test 1: Single Permission Check

```typescript
describe("hasPermission", () => {
  it("should return true when user has permission", async () => {
    // Setup: User has orders:create permission
    const result = await hasPermission("orders", "create");
    expect(result).toBe(true);
  });

  it("should return false when user lacks permission", async () => {
    // Setup: User does not have orders:delete permission
    const result = await hasPermission("orders", "delete");
    expect(result).toBe(false);
  });
});
```

#### Test 2: Multiple Permission Checks

```typescript
describe("hasAnyPermission", () => {
  it("should return true if user has any permission", async () => {
    const result = await hasAnyPermission(["orders:create", "orders:update"]);
    expect(result).toBe(true);
  });

  it("should return false if user has none", async () => {
    const result = await hasAnyPermission(["orders:delete", "settings:manage"]);
    expect(result).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("should return true if user has all permissions", async () => {
    const result = await hasAllPermissions(["orders:read", "orders:create"]);
    expect(result).toBe(true);
  });

  it("should return false if user missing any permission", async () => {
    const result = await hasAllPermissions(["orders:read", "orders:delete"]);
    expect(result).toBe(false);
  });
});
```

#### Test 3: Resource-Scoped Permissions

```typescript
describe("hasResourcePermission", () => {
  it("should return true for branch-scoped permission", async () => {
    const result = await hasResourcePermission(
      "orders",
      "read",
      "branch",
      "branch-uuid"
    );
    expect(result).toBe(true);
  });

  it("should fallback to tenant-wide permission", async () => {
    // User has tenant-wide orders:read but not branch-scoped
    const result = await hasResourcePermission(
      "orders",
      "read",
      "branch",
      "other-branch-uuid"
    );
    expect(result).toBe(true); // Falls back to tenant-wide
  });
});
```

### Role Service Tests

**File:** `web-admin/__tests__/services/role-service.test.ts`

#### Test 1: Get All Roles

```typescript
describe("getAllRoles", () => {
  it("should return all roles including system and custom", async () => {
    const roles = await getAllRoles();
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.some((r) => r.is_system)).toBe(true);
  });
});
```

#### Test 2: Create Custom Role

```typescript
describe("createCustomRole", () => {
  it("should create a new custom role", async () => {
    const role = await createCustomRole({
      code: "test_role",
      name: "Test Role",
      description: "Test description",
    });
    expect(role.code).toBe("test_role");
    expect(role.is_system).toBe(false);
  });

  it("should reject duplicate role code", async () => {
    await expect(
      createCustomRole({
        code: "operator", // System role code
        name: "Duplicate",
      })
    ).rejects.toThrow();
  });
});
```

#### Test 3: Assign Role to User

```typescript
describe("assignRoleToUser", () => {
  it("should assign role to user", async () => {
    await assignRoleToUser({
      user_id: "test-user-uuid",
      tenant_org_id: "test-tenant-uuid",
      role_id: "operator-role-uuid",
    });

    const roles = await getUserRoles("test-user-uuid", "test-tenant-uuid");
    expect(roles.some((r) => r.code === "operator")).toBe(true);
  });

  it("should support multiple roles", async () => {
    await assignRoleToUser({
      user_id: "test-user-uuid",
      tenant_org_id: "test-tenant-uuid",
      role_id: "operator-role-uuid",
    });
    await assignRoleToUser({
      user_id: "test-user-uuid",
      tenant_org_id: "test-tenant-uuid",
      role_id: "custom-role-uuid",
    });

    const roles = await getUserRoles("test-user-uuid", "test-tenant-uuid");
    expect(roles.length).toBe(2);
  });
});
```

---

## Integration Tests

### API Route Tests

**File:** `web-admin/__tests__/api/v1/orders.test.ts`

#### Test 1: Create Order with Permission

```typescript
describe("POST /api/v1/orders", () => {
  it("should create order when user has orders:create permission", async () => {
    const response = await fetch("/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: "test-customer-uuid",
        items: [],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.order_id).toBeDefined();
  });

  it("should reject when user lacks orders:create permission", async () => {
    const response = await fetch("/api/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: "test-customer-uuid",
        items: [],
      }),
    });

    expect(response.status).toBe(403);
  });
});
```

#### Test 2: Read Orders with Permission

```typescript
describe("GET /api/v1/orders", () => {
  it("should return orders when user has orders:read permission", async () => {
    const response = await fetch("/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${operatorToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should filter by tenant", async () => {
    const response = await fetch("/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    const data = await response.json();
    data.forEach((order: any) => {
      expect(order.tenant_org_id).toBe("tenant-1-uuid");
    });
  });
});
```

### Database Function Tests

**File:** `supabase/__tests__/functions/rbac.test.sql`

#### Test 1: Permission Check Function

```sql
-- Test cmx_can function
BEGIN;

-- Setup: Create test user with role
INSERT INTO org_auth_user_roles (user_id, tenant_org_id, role_id)
VALUES (
  'test-user-uuid',
  'test-tenant-uuid',
  (SELECT role_id FROM sys_auth_roles WHERE code = 'operator')
);

-- Rebuild permissions
SELECT cmx_rebuild_user_permissions('test-user-uuid', 'test-tenant-uuid');

-- Test permission check
SELECT cmx_can('orders:create', NULL, NULL) AS can_create;
-- Expected: true

SELECT cmx_can('settings:manage', NULL, NULL) AS can_manage;
-- Expected: false

ROLLBACK;
```

#### Test 2: Effective Permissions Rebuild

```sql
-- Test permission rebuild
BEGIN;

-- Assign role
INSERT INTO org_auth_user_roles (user_id, tenant_org_id, role_id)
VALUES (
  'test-user-uuid',
  'test-tenant-uuid',
  (SELECT role_id FROM sys_auth_roles WHERE code = 'operator')
);

-- Rebuild
SELECT cmx_rebuild_user_permissions('test-user-uuid', 'test-tenant-uuid');

-- Verify effective permissions
SELECT COUNT(*) FROM cmx_effective_permissions
WHERE user_id = 'test-user-uuid'
  AND tenant_org_id = 'test-tenant-uuid';
-- Expected: > 0

ROLLBACK;
```

---

## E2E Tests

### User Workflow Tests

**File:** `web-admin/__tests__/e2e/rbac-workflows.test.ts`

#### Test 1: Admin Creates Role and Assigns to User

```typescript
describe("Admin Role Management Workflow", () => {
  it("should allow admin to create role and assign to user", async () => {
    // 1. Login as admin
    await page.goto("/login");
    await page.fill('[name="email"]', "admin@test.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // 2. Navigate to roles page
    await page.click("text=Settings");
    await page.click("text=Roles & Permissions");

    // 3. Create custom role
    await page.click("text=Create Role");
    await page.fill('[name="code"]', "cashier");
    await page.fill('[name="name"]', "Cashier");
    await page.click("text=Create Role");

    // 4. Assign role to user
    await page.click("text=Team Members");
    await page.click("text=Edit", { hasText: "test-user" });
    await page.selectOption('[name="roles"]', "cashier");
    await page.click("text=Save");

    // 5. Verify role assigned
    await expect(page.locator("text=Cashier")).toBeVisible();
  });
});
```

#### Test 2: Operator Creates Order

```typescript
describe("Operator Order Creation Workflow", () => {
  it("should allow operator to create order", async () => {
    // 1. Login as operator
    await page.goto("/login");
    await page.fill('[name="email"]', "operator@test.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // 2. Navigate to orders
    await page.click("text=Orders");
    await page.click("text=New Order");

    // 3. Create order
    await page.fill('[name="customer"]', "Test Customer");
    await page.click("text=Add Item");
    await page.click("text=Create Order");

    // 4. Verify order created
    await expect(page.locator("text=Order created successfully")).toBeVisible();
  });

  it("should prevent operator from accessing settings", async () => {
    await page.goto("/login");
    await page.fill('[name="email"]', "operator@test.com");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // Settings should not be visible
    await expect(page.locator("text=Settings")).not.toBeVisible();
  });
});
```

---

## Multi-Tenant Isolation Tests

### Test 1: Tenant Data Isolation

```typescript
describe("Multi-Tenant Isolation", () => {
  it("should prevent tenant A from accessing tenant B data", async () => {
    // Login as tenant A user
    const tenantAToken = await login("tenant-a-user@test.com", "password");

    // Try to access tenant B order
    const response = await fetch("/api/v1/orders/tenant-b-order-uuid", {
      headers: {
        Authorization: `Bearer ${tenantAToken}`,
      },
    });

    expect(response.status).toBe(404); // Not found (filtered by RLS)
  });

  it("should allow tenant A to access only tenant A data", async () => {
    const tenantAToken = await login("tenant-a-user@test.com", "password");

    const response = await fetch("/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${tenantAToken}`,
      },
    });

    const orders = await response.json();
    orders.forEach((order: any) => {
      expect(order.tenant_org_id).toBe("tenant-a-uuid");
    });
  });
});
```

### Test 2: Cross-Tenant Permission Isolation

```typescript
describe("Cross-Tenant Permission Isolation", () => {
  it("should prevent tenant A admin from managing tenant B users", async () => {
    const tenantAToken = await login("tenant-a-admin@test.com", "password");

    const response = await fetch("/api/v1/users/tenant-b-user-uuid", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tenantAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "admin" }),
    });

    expect(response.status).toBe(403); // Forbidden
  });
});
```

---

## Performance Tests

### Test 1: Permission Check Performance

```typescript
describe("Permission Check Performance", () => {
  it("should check permissions in < 10ms", async () => {
    const start = performance.now();
    await hasPermission("orders", "create");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // 10ms threshold
  });

  it("should handle 1000 permission checks efficiently", async () => {
    const start = performance.now();
    const promises = Array(1000)
      .fill(null)
      .map(() => hasPermission("orders", "create"));
    await Promise.all(promises);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000); // 1 second for 1000 checks
  });
});
```

### Test 2: Permission Rebuild Performance

```sql
-- Test permission rebuild performance
EXPLAIN ANALYZE
SELECT cmx_rebuild_user_permissions('test-user-uuid', 'test-tenant-uuid');

-- Expected: Execution time < 100ms
```

---

## Security Tests

### Test 1: SQL Injection Prevention

```typescript
describe("SQL Injection Prevention", () => {
  it("should prevent SQL injection in permission checks", async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    // Should not execute SQL injection
    const result = await hasPermission(maliciousInput, "create");
    expect(result).toBe(false); // Should fail safely
  });
});
```

### Test 2: Permission Bypass Prevention

```typescript
describe("Permission Bypass Prevention", () => {
  it("should not allow permission bypass via API", async () => {
    // User without orders:delete permission
    const viewerToken = await login("viewer@test.com", "password");

    const response = await fetch("/api/v1/orders/test-order-uuid", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    expect(response.status).toBe(403); // Forbidden
  });
});
```

---

## Test Execution

### Run All Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

### Run Specific Test Suite

```bash
# Permission service tests
npm run test -- permission-service.test.ts

# API route tests
npm run test -- api/v1/orders.test.ts

# E2E tests
npm run test:e2e -- rbac-workflows.test.ts
```

---

## Test Coverage Goals

- **Unit Tests:** > 80% coverage
- **Integration Tests:** All API routes covered
- **E2E Tests:** Critical user workflows covered
- **Security Tests:** All security boundaries tested

---

**Version:** v1.0.0 | **Last Updated:** 2025-01-XX
