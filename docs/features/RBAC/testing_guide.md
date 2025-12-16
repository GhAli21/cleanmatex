# Testing Guide - RBAC Permission System

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Status:** Testing Procedures

---

## 📋 Overview

This guide covers comprehensive testing strategies for the RBAC permission system, including unit tests, integration tests, E2E tests, and permission matrix validation.

---

## 🎯 Testing Objectives

1. **Permission Accuracy** - Verify each permission works correctly
2. **Role Integrity** - Ensure roles have correct permissions
3. **Access Control** - Validate users can't bypass permissions
4. **Performance** - Confirm permission checks meet targets
5. **Security** - Test for permission vulnerabilities

---

## 🧪 Part 1: Unit Tests

### Test 1.1: Permission Functions

**File:** `__tests__/lib/services/permission.service.test.ts`

```typescript
import { PermissionService } from '@/lib/services/permission.service';

describe('PermissionService', () => {
  beforeEach(() => {
    PermissionService.clearAllCaches();
  });

  describe('hasPermission', () => {
    it('should return true for user with specific permission', async () => {
      const hasAccess = await PermissionService.hasPermission(
        'user-123',
        'tenant-456',
        'orders',
        'create'
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false for user without permission', async () => {
      const hasAccess = await PermissionService.hasPermission(
        'user-viewer',
        'tenant-456',
        'orders',
        'delete'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return true for wildcard permission', async () => {
      const hasAccess = await PermissionService.hasPermission(
        'user-admin',
        'tenant-456',
        'orders',
        'anything'
      );

      expect(hasAccess).toBe(true); // Admin has *:*
    });

    it('should cache permission results', async () => {
      // First call - cache miss
      await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'create');

      // Second call - cache hit (should be faster)
      const start = Date.now();
      await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'create');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // < 10ms from cache
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any required permission', async () => {
      const hasAny = await PermissionService.hasAnyPermission(
        'user-123',
        'tenant-456',
        ['orders:delete', 'orders:create']
      );

      expect(hasAny).toBe(true); // Has orders:create
    });

    it('should return false if user has none of the permissions', async () => {
      const hasAny = await PermissionService.hasAnyPermission(
        'user-viewer',
        'tenant-456',
        ['orders:delete', 'orders:create']
      );

      expect(hasAny).toBe(false);
    });
  });
});
```

### Test 1.2: Permission Hooks

**File:** `__tests__/lib/hooks/usePermissions.test.tsx`

```typescript
import { renderHook } from '@testing-library/react';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { AuthProvider } from '@/lib/auth/auth-context';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useHasPermission', () => {
  it('should return true for granted permission', () => {
    const { result } = renderHook(
      () => useHasPermission('orders', 'create'),
      { wrapper }
    );

    expect(result.current).toBe(true);
  });

  it('should return false for denied permission', () => {
    const { result } = renderHook(
      () => useHasPermission('orders', 'delete'),
      { wrapper }
    );

    expect(result.current).toBe(false);
  });

  it('should re-evaluate when permissions change', async () => {
    const { result, rerender } = renderHook(
      () => useHasPermission('orders', 'update'),
      { wrapper }
    );

    expect(result.current).toBe(false);

    // Simulate permission grant
    // ... grant permission ...

    rerender();
    expect(result.current).toBe(true);
  });
});
```

---

## 🔗 Part 2: Integration Tests

### Test 2.1: Database Functions

**File:** `__tests__/database/permission-functions.test.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

describe('Permission Database Functions', () => {
  let supabase: any;

  beforeAll(() => {
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  });

  describe('get_user_permissions', () => {
    it('should return all permissions for user', async () => {
      const { data, error } = await supabase.rpc('get_user_permissions');

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should only return active role permissions', async () => {
      // Deactivate a role
      await supabase
        .from('org_user_roles')
        .update({ is_active: false })
        .eq('role_id', 'inactive-role-id');

      const { data } = await supabase.rpc('get_user_permissions');

      // Should not include permissions from inactive role
      expect(data).not.toContainEqual({ permission_id: 'inactive:permission' });
    });

    it('should respect role expiry dates', async () => {
      // Create expired role
      await supabase.from('org_user_roles').insert({
        user_id: 'user-123',
        role_id: 'temp-role',
        expires_at: new Date(Date.now() - 86400000), // Yesterday
      });

      const { data } = await supabase.rpc('get_user_permissions');

      // Should not include expired role permissions
      expect(data).not.toContainEqual({ permission_id: 'expired:permission' });
    });
  });

  describe('has_permission', () => {
    it('should return true for granted permission', async () => {
      const { data } = await supabase.rpc('has_permission', {
        p_permission: 'orders:create'
      });

      expect(data).toBe(true);
    });

    it('should return false for non-granted permission', async () => {
      const { data } = await supabase.rpc('has_permission', {
        p_permission: 'orders:delete'
      });

      expect(data).toBe(false);
    });
  });

  describe('has_workflow_role', () => {
    it('should return true for assigned workflow role', async () => {
      const { data } = await supabase.rpc('has_workflow_role', {
        p_workflow_role: 'ROLE_RECEPTION'
      });

      expect(data).toBe(true);
    });

    it('should return true if user has ROLE_ADMIN', async () => {
      const { data } = await supabase.rpc('has_workflow_role', {
        p_workflow_role: 'ROLE_QA'
      });

      expect(data).toBe(true); // Admin can access all
    });
  });
});
```

### Test 2.2: API Permission Enforcement

**File:** `__tests__/api/permission-middleware.test.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/middleware/permission.middleware';

describe('Permission Middleware', () => {
  describe('checkPermission', () => {
    it('should allow access with correct permission', async () => {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        headers: { 'x-user-id': 'user-with-access' }
      });

      const response = await checkPermission(req, 'orders', 'read');

      expect(response).toBeNull(); // Null = access granted
    });

    it('should deny access without permission', async () => {
      const req = new NextRequest('http://localhost:3000/api/orders', {
        headers: { 'x-user-id': 'user-without-access' }
      });

      const response = await checkPermission(req, 'orders', 'delete');

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      const req = new NextRequest('http://localhost:3000/api/orders');
      // No auth headers

      const response = await checkPermission(req, 'orders', 'read');

      expect(response?.status).toBe(401);
    });
  });
});
```

---

## 🌐 Part 3: E2E Tests

### Test 3.1: Permission-Based UI Flow

**File:** `e2e/permissions.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Permission-Based Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('admin can access all features', async ({ page }) => {
    // Login as admin
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Should see admin-only menu items
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();

    // Should see delete buttons
    await page.goto('/dashboard/orders');
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });

  test('operator has limited access', async ({ page }) => {
    // Login as operator
    await page.fill('[name="email"]', 'operator@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Should NOT see admin menu items
    await expect(page.locator('text=Users')).not.toBeVisible();
    await expect(page.locator('text=Settings')).not.toBeVisible();

    // Should NOT see delete buttons
    await page.goto('/dashboard/orders');
    await expect(page.locator('button:has-text("Delete")')).not.toBeVisible();

    // But should see edit buttons
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
  });

  test('viewer has read-only access', async ({ page }) => {
    // Login as viewer
    await page.fill('[name="email"]', 'viewer@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Can view orders
    await page.goto('/dashboard/orders');
    await expect(page.locator('text=Orders')).toBeVisible();

    // But cannot edit or delete
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Create")')).not.toBeVisible();
  });

  test('cannot bypass permission with direct URL', async ({ page }) => {
    // Login as viewer
    await page.fill('[name="email"]', 'viewer@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Try to access admin page directly
    await page.goto('/dashboard/users');

    // Should be redirected or see error
    await expect(page).toHaveURL(/error=insufficient_permissions/);
  });
});
```

---

## ✅ Part 4: Permission Matrix Validation

### Test 4.1: Complete Matrix Test

**File:** `__tests__/permission-matrix.test.ts`

```typescript
describe('Permission Matrix Validation', () => {
  const roles = ['super_admin', 'tenant_admin', 'branch_manager', 'operator', 'viewer'];

  // Test matrix from permission_matrix.md
  const expectedPermissions = {
    super_admin: ['*:*'], // All permissions
    tenant_admin: [
      'orders:create', 'orders:read', 'orders:update', 'orders:delete',
      'customers:create', 'customers:read', 'customers:update', 'customers:delete',
      // ... all tenant permissions
    ],
    operator: [
      'orders:create', 'orders:read', 'orders:update',
      'customers:create', 'customers:read',
      // ... operational permissions
    ],
    viewer: [
      'orders:read', 'customers:read', 'products:read',
      // ... all read permissions
    ]
  };

  roles.forEach(role => {
    describe(`${role} role`, () => {
      it('should have correct permissions', async () => {
        const { data } = await supabase
          .from('sys_roles')
          .select('*, sys_role_permissions(*)')
          .eq('code', role)
          .single();

        const actualPermissions = data.sys_role_permissions.map(
          (rp: any) => rp.permission_id
        );

        // Verify expected permissions are present
        expectedPermissions[role].forEach(expectedPerm => {
          expect(actualPermissions).toContain(expectedPerm);
        });
      });
    });
  });
});
```

---

## 🎯 Part 5: Performance Tests

### Test 5.1: Permission Check Performance

**File:** `__tests__/performance/permission-speed.test.ts`

```typescript
describe('Permission Check Performance', () => {
  test('cached permission check < 10ms', async () => {
    // Warm up cache
    await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'read');

    // Measure cached check
    const start = Date.now();
    await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'read');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10);
  });

  test('first permission check < 100ms', async () => {
    PermissionService.clearAllCaches();

    const start = Date.now();
    await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'read');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('cache hit rate > 95%', async () => {
    let hits = 0;
    let misses = 0;

    // Run 100 permission checks
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await PermissionService.hasPermission('user-123', 'tenant-456', 'orders', 'read');
      const duration = Date.now() - start;

      if (duration < 10) hits++;
      else misses++;
    }

    const hitRate = hits / 100;
    expect(hitRate).toBeGreaterThan(0.95);
  });
});
```

---

## 🔒 Part 6: Security Tests

### Test 6.1: Permission Bypass Attempts

```typescript
describe('Security - Permission Bypass', () => {
  test('cannot access without authentication', async () => {
    const response = await fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  test('cannot access with expired token', async () => {
    const expiredToken = generateExpiredJWT();

    const response = await fetch('/api/orders', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${expiredToken}`
      }
    });

    expect(response.status).toBe(401);
  });

  test('cannot access cross-tenant data', async () => {
    // User from tenant A trying to access tenant B data
    const response = await fetch('/api/orders/tenant-b-order-id', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tenantAUserToken}`
      }
    });

    expect(response.status).toBe(403);
  });

  test('cannot bypass permission with SQL injection', async () => {
    const maliciousInput = "' OR '1'='1";

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ permission: maliciousInput })
    });

    expect(response.status).toBe(400);
  });
});
```

---

## 📋 Testing Checklist

### Pre-Testing
- [ ] Database seeded with test data
- [ ] Test users created for each role
- [ ] Test tenants set up
- [ ] Test environment configured

### Unit Tests
- [ ] All permission service methods tested
- [ ] All permission hooks tested
- [ ] All permission components tested
- [ ] Edge cases covered
- [ ] Error handling tested

### Integration Tests
- [ ] Database functions tested
- [ ] RLS policies validated
- [ ] API middleware tested
- [ ] Multi-tenant isolation verified

### E2E Tests
- [ ] All user roles tested
- [ ] UI permission enforcement verified
- [ ] Direct URL bypass prevented
- [ ] Workflow role access tested

### Performance Tests
- [ ] Permission check latency < 10ms (cached)
- [ ] First load < 100ms
- [ ] Cache hit rate > 95%
- [ ] Load testing completed

### Security Tests
- [ ] Authentication required
- [ ] Permission bypass attempts fail
- [ ] Cross-tenant access blocked
- [ ] SQL injection prevented

---

## 📊 Test Coverage Goals

| Area | Target Coverage | Status |
|------|----------------|--------|
| **Permission Service** | > 95% | ⏳ |
| **Permission Hooks** | > 90% | ⏳ |
| **API Middleware** | > 95% | ⏳ |
| **Database Functions** | > 90% | ⏳ |
| **Permission Matrix** | 100% | ⏳ |
| **Security Tests** | 100% critical paths | ⏳ |

---

## 🚀 Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# All tests
npm run test:all

# With coverage
npm run test:coverage
```

---

**Status:** ✅ Testing Guide Complete
