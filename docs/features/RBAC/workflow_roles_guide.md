# Workflow Roles Guide - CleanMateX

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Status:** ⚠️ Defined but NOT Implemented

---

## 📋 Overview

Workflow roles control **which order processing steps** a user can access and perform. They are separate from user roles (authentication) and focus specifically on workflow operations.

**Current Status:** ⚠️ Constants defined in code but NOT stored in database or assigned to users.

---

## 🎯 Purpose

Workflow roles provide **process-level access control**:

- Control which workflow screens users can access
- Restrict order status transitions by role
- Ensure proper segregation of duties
- Track who performed which workflow step

**Different from User Roles:** User roles control app features, workflow roles control process steps.

---

## 👷 The Six Workflow Roles

### 1. ROLE_RECEPTION
**Purpose:** Order intake and delivery operations
**Screens:** New Order, Ready Orders
**Transitions:** `intake->preparing`, `ready->delivered`
**Typical Users:** Reception counter staff, delivery coordinators

### 2. ROLE_PREPARATION
**Purpose:** Item tagging and preparation
**Screens:** Preparation
**Transitions:** `intake->preparing`, `preparing->processing`
**Typical Users:** Tagging staff, preparation workers

### 3. ROLE_PROCESSING
**Purpose:** Washing, drying, ironing operations
**Screens:** Processing, Assembly
**Transitions:** `processing->ready`
**Typical Users:** Machine operators, processing staff

### 4. ROLE_QA
**Purpose:** Quality inspection
**Screens:** Quality Check
**Transitions:** `qa->ready`, `qa->rework`
**Typical Users:** Quality inspectors, supervisors

### 5. ROLE_DELIVERY
**Purpose:** Delivery operations
**Screens:** Ready, Delivery Routes
**Transitions:** `ready->delivered`
**Typical Users:** Drivers, delivery staff

### 6. ROLE_ADMIN
**Purpose:** Full workflow access (bypass)
**Screens:** All workflow screens
**Transitions:** All transitions allowed
**Typical Users:** Managers, administrators

---

## 📍 Current Implementation

### Code Definition
**Location:** `web-admin/lib/auth/roles.ts`

```typescript
export const ROLES = {
  RECEPTION: 'ROLE_RECEPTION',
  PREPARATION: 'ROLE_PREPARATION',
  PROCESSING: 'ROLE_PROCESSING',
  QA: 'ROLE_QA',
  DELIVERY: 'ROLE_DELIVERY',
  ADMIN: 'ROLE_ADMIN',
} as const;
```

### Screen Access Map
```typescript
export const SCREEN_ACCESS = {
  NEW_ORDER: [ROLES.RECEPTION, ROLES.ADMIN],
  PREPARATION: [ROLES.PREPARATION, ROLES.ADMIN],
  PROCESSING: [ROLES.PROCESSING, ROLES.ADMIN],
  ASSEMBLY: [ROLES.PROCESSING, ROLES.ADMIN],
  QA: [ROLES.QA, ROLES.ADMIN],
  READY: [ROLES.RECEPTION, ROLES.DELIVERY, ROLES.ADMIN],
  WORKFLOW_CONFIG: [ROLES.ADMIN],
};
```

### Transition Access Map
```typescript
export const TRANSITION_ACCESS = {
  'intake->preparing': [ROLES.RECEPTION, ROLES.PREPARATION],
  'preparing->processing': [ROLES.PREPARATION],
  'processing->ready': [ROLES.PROCESSING],
  'qa->ready': [ROLES.QA],
  'ready->delivered': [ROLES.RECEPTION, ROLES.DELIVERY],
};
```

---

## ⚠️ Critical Gaps

❌ **No Database Storage** - Workflow roles not stored anywhere
❌ **No Assignment** - Can't assign workflow roles to users
❌ **No Enforcement** - Not checked in APIs or transitions
❌ **Not in JWT** - Not included in session claims
❌ **No UI** - No interface to manage workflow roles
❌ **Not Connected** - No mapping to user roles

---

## 🔄 Required Implementation

### Database Table
```sql
CREATE TABLE org_auth_user_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  workflow_role VARCHAR(50) NOT NULL CHECK (workflow_role IN (
    'ROLE_RECEPTION',
    'ROLE_PREPARATION',
    'ROLE_PROCESSING',
    'ROLE_QA',
    'ROLE_DELIVERY',
    'ROLE_ADMIN'
  )),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tenant_org_id, workflow_role)
);
```

### RLS Functions
```sql
CREATE OR REPLACE FUNCTION user_has_workflow_role(p_workflow_role VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_user_workflow_roles
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND workflow_role = p_workflow_role
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### Context Integration
```typescript
interface AuthState {
  user: AuthUser;
  userRole: UserRole;  // 'admin', 'operator', 'viewer'
  workflowRoles: WorkflowRole[];  // ['ROLE_RECEPTION', 'ROLE_QA']
}
```

---

## 📚 Related Documentation

- [User Roles Guide](./user_roles_guide.md) - Authentication roles
- [RBAC Architecture](./rbac_architecture.md) - Proposed complete system
- [Current State Analysis](./current_state_analysis.md) - Detailed analysis

---

**Status:** ⚠️ Requires Implementation
