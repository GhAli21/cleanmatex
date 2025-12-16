# Frontend Integration Guide - RBAC System

**Version:** v1.0.0
**Last Updated:** 2025-11-03

---

## 📋 Overview

Complete guide for integrating RBAC permissions in React/Next.js frontend.

---

## 🎯 Core Concepts

### Permission Format
```
resource:action
```
Examples: `orders:create`, `customers:delete`, `settings:update`

---

## 🔧 Implementation

### 1. Context Setup

```typescript
// lib/auth/auth-context.tsx
interface AuthState {
  permissions: string[];
  workflowRoles: string[];
}
```

### 2. Permission Hooks

```typescript
// lib/hooks/usePermissions.ts
export function useHasPermission(resource: string, action: string): boolean {
  const { permissions } = useAuth();
  return permissions.includes(`${resource}:${action}`);
}
```

### 3. Permission Components

```typescript
// components/auth/RequirePermission.tsx
<RequirePermission resource="orders" action="delete">
  <DeleteButton />
</RequirePermission>
```

---

## 💡 Usage Examples

### Example 1: Conditional Button

```typescript
function OrderActions() {
  const canDelete = useHasPermission('orders', 'delete');

  return (
    <div>
      <EditButton />
      {canDelete && <DeleteButton />}
    </div>
  );
}
```

### Example 2: Protected Page

```typescript
export default withRole(AdminPage, {
  requiredPermissions: ['users:read', 'users:manage']
});
```

### Example 3: Dynamic Menu

```typescript
function NavigationMenu() {
  const { permissions } = usePermissions();

  const menuItems = [
    { label: 'Orders', permission: 'orders:read' },
    { label: 'Settings', permission: 'settings:read' },
  ].filter(item => permissions.includes(item.permission));

  return <Menu items={menuItems} />;
}
```

---

## 🎨 UI Patterns

### Pattern 1: Show/Hide Elements
```typescript
{hasPermission && <Component />}
```

### Pattern 2: Disable Elements
```typescript
<Button disabled={!hasPermission}>Action</Button>
```

### Pattern 3: Fallback UI
```typescript
<RequirePermission fallback={<NoAccessMessage />}>
  <ProtectedContent />
</RequirePermission>
```

---

**Status:** ✅ Frontend Integration Complete
