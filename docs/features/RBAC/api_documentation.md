# RBAC API Documentation

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Permission Endpoints](#permission-endpoints)
4. [Role Endpoints](#role-endpoints)
5. [User Endpoints](#user-endpoints)
6. [Workflow Role Endpoints](#workflow-role-endpoints)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Overview

This document describes the API endpoints for the RBAC system. All endpoints require authentication and respect tenant boundaries.

### Base URL

```
/api/v1
```

### Authentication

All endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## Permission Endpoints

### Get User Permissions

Get all permissions for the current user.

**Endpoint:** `GET /api/v1/auth/permissions`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "permissions": [
      "orders:create",
      "orders:read",
      "orders:update",
      "customers:read"
    ],
    "workflowRoles": ["ROLE_RECEPTION", "ROLE_PROCESSING"]
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Unauthorized

---

### Check Permission

Check if current user has a specific permission.

**Endpoint:** `POST /api/v1/auth/permissions/check`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "resource": "orders",
  "action": "create"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hasPermission": true
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request (missing resource/action)
- `401` - Unauthorized

---

### Check Multiple Permissions

Check if current user has any/all of multiple permissions.

**Endpoint:** `POST /api/v1/auth/permissions/check-multiple`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "permissions": ["orders:create", "orders:update"],
  "mode": "any" // "any" or "all"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hasPermission": true
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized

---

## Role Endpoints

### Get All Roles

Get all roles (system + custom) for the current tenant.

**Endpoint:** `GET /api/v1/roles`

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `include_system` (boolean, default: true) - Include system roles
- `include_custom` (boolean, default: true) - Include custom roles

**Response:**

```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "role_id": "uuid",
        "code": "tenant_admin",
        "name": "Tenant Admin",
        "name2": "مدير المستأجر",
        "description": "Full tenant access",
        "is_system": true,
        "permission_count": 95,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:read`)

---

### Get Role Details

Get detailed information about a specific role.

**Endpoint:** `GET /api/v1/roles/:roleId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "role": {
      "role_id": "uuid",
      "code": "operator",
      "name": "Operator",
      "name2": "مشغل",
      "description": "Operational permissions",
      "is_system": true,
      "permissions": [
        {
          "permission_id": "uuid",
          "code": "orders:create",
          "name": "Create Orders",
          "category": "orders"
        }
      ],
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:read`)

---

### Create Custom Role

Create a new custom role.

**Endpoint:** `POST /api/v1/roles`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "code": "cashier",
  "name": "Cashier",
  "name2": "أمين الصندوق",
  "description": "Handles cash transactions"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "role": {
      "role_id": "uuid",
      "code": "cashier",
      "name": "Cashier",
      "name2": "أمين الصندوق",
      "description": "Handles cash transactions",
      "is_system": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Status Codes:**

- `201` - Created
- `400` - Bad Request (invalid code, duplicate code)
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:create`)

---

### Update Role

Update role details (name, description). Role code cannot be changed.

**Endpoint:** `PUT /api/v1/roles/:roleId`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Updated Cashier",
  "name2": "أمين الصندوق المحدث",
  "description": "Updated description"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "role": {
      "role_id": "uuid",
      "code": "cashier",
      "name": "Updated Cashier",
      "name2": "أمين الصندوق المحدث",
      "description": "Updated description",
      "is_system": false
    }
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request
- `404` - Role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:update`)

---

### Delete Role

Delete a custom role. System roles cannot be deleted.

**Endpoint:** `DELETE /api/v1/roles/:roleId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Role deleted successfully"
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request (system role, role in use)
- `404` - Role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:delete`)

---

### Assign Permissions to Role

Assign permissions to a role.

**Endpoint:** `POST /api/v1/roles/:roleId/permissions`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "permission_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Permissions assigned successfully",
    "assigned_count": 3
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request
- `404` - Role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:update`)

---

### Remove Permissions from Role

Remove permissions from a role.

**Endpoint:** `DELETE /api/v1/roles/:roleId/permissions`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "permission_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Permissions removed successfully",
    "removed_count": 2
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad Request
- `404` - Role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `roles:update`)

---

## User Endpoints

### Get User Roles

Get all roles assigned to a user.

**Endpoint:** `GET /api/v1/users/:userId/roles`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "role_id": "uuid",
        "code": "operator",
        "name": "Operator",
        "is_system": true,
        "assigned_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - User not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:read` or own user)

---

### Assign Role to User

Assign a role to a user.

**Endpoint:** `POST /api/v1/users/:userId/roles`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "role_id": "uuid",
  "tenant_org_id": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Role assigned successfully",
    "assignment": {
      "id": "uuid",
      "user_id": "uuid",
      "role_id": "uuid",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Status Codes:**

- `201` - Created
- `400` - Bad Request (duplicate assignment)
- `404` - User or role not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:assign_roles`)

---

### Remove Role from User

Remove a role from a user.

**Endpoint:** `DELETE /api/v1/users/:userId/roles/:roleId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Role removed successfully"
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Assignment not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:assign_roles`)

---

## Workflow Role Endpoints

### Get User Workflow Roles

Get all workflow roles assigned to a user.

**Endpoint:** `GET /api/v1/users/:userId/workflow-roles`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workflowRoles": [
      {
        "id": "uuid",
        "workflow_role": "ROLE_RECEPTION",
        "is_active": true,
        "assigned_at": "2025-01-01T00:00:00Z"
      },
      {
        "id": "uuid",
        "workflow_role": "ROLE_QA",
        "is_active": true,
        "assigned_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - User not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:read` or own user)

---

### Assign Workflow Role to User

Assign a workflow role to a user.

**Endpoint:** `POST /api/v1/users/:userId/workflow-roles`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "workflow_role": "ROLE_RECEPTION",
  "tenant_org_id": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Workflow role assigned successfully",
    "assignment": {
      "id": "uuid",
      "user_id": "uuid",
      "workflow_role": "ROLE_RECEPTION",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Status Codes:**

- `201` - Created
- `400` - Bad Request (invalid workflow role, duplicate)
- `404` - User not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:assign_roles`)

---

### Remove Workflow Role from User

Remove a workflow role from a user.

**Endpoint:** `DELETE /api/v1/users/:userId/workflow-roles/:assignmentId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Workflow role removed successfully"
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Assignment not found
- `401` - Unauthorized
- `403` - Forbidden (requires `users:assign_roles`)

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_permission": "roles:create",
      "user_permissions": ["roles:read"]
    }
  }
}
```

### Error Codes

| Code                 | Status | Description                             |
| -------------------- | ------ | --------------------------------------- |
| `UNAUTHORIZED`       | 401    | Missing or invalid authentication token |
| `PERMISSION_DENIED`  | 403    | User lacks required permission          |
| `NOT_FOUND`          | 404    | Resource not found                      |
| `BAD_REQUEST`        | 400    | Invalid request data                    |
| `VALIDATION_ERROR`   | 400    | Request validation failed               |
| `DUPLICATE_RESOURCE` | 409    | Resource already exists                 |
| `INTERNAL_ERROR`     | 500    | Server error                            |

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default:** 100 requests per minute per user
- **Permission checks:** 200 requests per minute per user
- **Role management:** 50 requests per minute per user

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Examples

### Example: Check Permission Before Creating Order

```typescript
// 1. Check permission
const checkResponse = await fetch("/api/v1/auth/permissions/check", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    resource: "orders",
    action: "create",
  }),
});

const { data } = await checkResponse.json();
if (!data.hasPermission) {
  throw new Error("Permission denied");
}

// 2. Create order
const createResponse = await fetch("/api/v1/orders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customer_id: "customer-uuid",
    items: [],
  }),
});
```

### Example: Create Custom Role and Assign Permissions

```typescript
// 1. Create role
const createRoleResponse = await fetch("/api/v1/roles", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    code: "cashier",
    name: "Cashier",
    name2: "أمين الصندوق",
    description: "Handles cash transactions",
  }),
});

const { data: roleData } = await createRoleResponse.json();
const roleId = roleData.role.role_id;

// 2. Assign permissions
await fetch(`/api/v1/roles/${roleId}/permissions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    permission_ids: ["perm-uuid-1", "perm-uuid-2"],
  }),
});
```

---

**Version:** v1.0.0 | **Last Updated:** 2025-01-XX
