# API Specifications - RBAC System

**Version:** v1.0.0
**Last Updated:** 2025-11-03

---

## 📋 Overview

Complete API specifications for the RBAC permission management system, including endpoints for roles, permissions, and assignments.

---

## 🔑 Authentication

All endpoints require authentication via JWT token:

```http
Authorization: Bearer {jwt_token}
```

**Headers:**
- `x-tenant-id`: Current tenant context (required)
- `Content-Type`: application/json

---

## 📚 API Endpoints

### 1. Permissions API

#### GET /api/v1/permissions
List all available permissions

**Permission Required:** `permissions:read`

**Response:**
```json
{
  "data": [
    {
      "id": "orders:create",
      "resource": "orders",
      "action": "create",
      "description": "Create new orders",
      "category": "crud"
    }
  ]
}
```

---

### 2. Roles API

#### GET /api/v1/roles
List all roles (system + tenant custom roles)

**Permission Required:** `roles:read`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "tenant_admin",
      "name": "Tenant Administrator",
      "description": "Full tenant access",
      "is_system": true,
      "permission_count": 110
    }
  ]
}
```

#### POST /api/v1/roles
Create custom role (tenant-specific)

**Permission Required:** `roles:create`

**Request:**
```json
{
  "code": "custom_manager",
  "name": "Custom Manager",
  "description": "Custom role for managers",
  "permissions": ["orders:read", "customers:read"]
}
```

---

### 3. User Roles API

#### GET /api/v1/users/{userId}/roles
Get user's assigned roles

**Permission Required:** `users:read`

**Response:**
```json
{
  "data": [
    {
      "role_id": "uuid",
      "role_code": "operator",
      "is_primary": true,
      "expires_at": null
    }
  ]
}
```

#### POST /api/v1/users/{userId}/roles
Assign role to user

**Permission Required:** `users:assign_roles`

**Request:**
```json
{
  "role_id": "uuid",
  "is_primary": false,
  "expires_at": "2025-12-31T23:59:59Z"
}
```

---

**Status:** ✅ API Specifications Complete
