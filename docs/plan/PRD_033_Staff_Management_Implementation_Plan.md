# PRD-033: Staff Management & RBAC - Implementation Plan

**Project**: CleanMateX - Laundry & Dry Cleaning SaaS  
**Phase**: Phase 2 - Enhanced Operations  
**Priority**: 🔴 CRITICAL - Foundation Feature  
**Status**: ⭐ MOVED FROM PHASE 5  
**Duration**: Week 9 (4-5 days, parallel with PRD-023)  
**Effort**: Medium-High  
**Risk**: Medium  
**Developer**: Solo with AI Tools

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why This Matters](#why-this-matters)
3. [Learning Objectives](#learning-objectives)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Steps](#implementation-steps)
6. [Testing & QA](#testing--qa)
7. [Success Criteria](#success-criteria)
8. [Troubleshooting](#troubleshooting)
9. [Resources](#resources)

---

## Overview

### What You'll Build
A complete staff management system with Role-Based Access Control (RBAC):
- Staff CRUD operations (Create, Read, Update, Delete)
- 7 predefined roles (Owner, Admin, Manager, Counter, Assembly, Driver, Finance)
- Permission-based route protection
- Audit logging for all actions
- Staff assignment to branches
- User account linking

### Dependencies
- ✅ PRD-023 (Bilingual Support) - Some UI components use translations
- Can be implemented in parallel with PRD-023

### Tech Stack
- **Backend**: NestJS Guards & Decorators
- **Database**: PostgreSQL with Prisma
- **Frontend**: Next.js with RBAC UI
- **Pattern**: Guard-based authorization

---

## Why This Matters

### Business Reasons
1. **Security Foundation**: Control who can do what in the system
2. **Operational Reality**: Can't run laundry without staff accounts
3. **Compliance**: Audit trail required for financial operations
4. **Scalability**: Easy to add new staff as business grows
5. **Multi-Branch Ready**: Staff can be assigned to specific branches

### Technical Reasons
1. **Authorization Layer**: All future features depend on this
2. **Audit Trail**: Track who did what, when
3. **Data Isolation**: Staff see only what they're allowed to see
4. **API Security**: Routes protected by permissions
5. **Role Management**: Flexible permission model

---

## Learning Objectives

### 🎓 What is RBAC?

**RBAC = Role-Based Access Control**

Think of it like job titles in a company:
- **CEO (Owner)**: Can do everything
- **Manager**: Can manage operations, view reports
- **Cashier (Counter)**: Can create orders, handle customers
- **Worker (Assembly)**: Can only work on assigned tasks
- **Driver**: Can only view/update deliveries

Instead of assigning permissions to each person individually (nightmare!), we:
1. Define **Roles** with specific **Permissions**
2. Assign **Roles** to **Users**
3. Users automatically get all permissions of their role

**Real-World Example**:
```
Counter Staff Role:
✅ Can create orders
✅ Can view customers
✅ Can update orders
❌ Cannot delete orders
❌ Cannot view reports
❌ Cannot change settings

Need to add 10 counter staff?
→ Just assign "Counter Staff" role to each = Done!
```

### 🎓 Permission Pattern: Resource:Action

Permissions follow this pattern:
```
{resource}:{action}

Examples:
orders:create    → Can create orders
orders:read      → Can view orders
orders:update    → Can update orders
orders:delete    → Can delete orders
orders:*         → Can do ALL order actions
*:*              → Super admin (everything)
```

**Wildcard Support**:
```
User has: ['orders:*']
Required: 'orders:create'
→ ALLOWED (orders:* matches everything for orders)

User has: ['orders:read']
Required: 'orders:delete'
→ DENIED (doesn't have delete permission)
```

### 🎓 NestJS Guards

**What is a Guard?**
- A class that decides if a request should be processed
- Runs BEFORE the controller method
- Can allow or deny access

**Flow**:
```
HTTP Request
    ↓
1. Auth Guard (Is user logged in?)
    ↓
2. Permission Guard (Does user have permission?)
    ↓
3. Controller (Execute business logic)
    ↓
Response
```

**Example**:
```typescript
@Get('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)  // Guards
@Permissions('orders:read')                  // Required permission
async getOrders() {
  // Only executed if user is logged in AND has 'orders:read' permission
  return this.ordersService.findAll();
}
```

### 🎓 NestJS Decorators

**What is a Decorator?**
- Adds metadata or behavior to classes, methods, or parameters
- Uses `@` symbol
- Like "tags" or "annotations"

**Common Decorators**:
```typescript
@Controller('staff')           // Marks class as controller
@Get(':id')                    // HTTP GET method
@UseGuards(PermissionsGuard)   // Apply guard
@Permissions('staff:read')     // Add metadata
```

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│            Staff Management System                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────────────────────┐          │
│  │         Database Layer                │          │
│  │                                        │          │
│  │  ┌─────────────────┐ ┌──────────────┐│          │
│  │  │sys_user_roles_cd│ │org_emp_users ││          │
│  │  │                 │ │              ││          │
│  │  │ - code         │ │ - id         ││          │
│  │  │ - name/name2   │ │ - role_code  ││          │
│  │  │ - permissions  │ │ - email      ││          │
│  │  │   (JSON array) │ │ - is_active  ││          │
│  │  └─────────────────┘ └──────────────┘│          │
│  │           │                    │      │          │
│  └───────────┼────────────────────┼──────┘          │
│              │                    │                  │
│              ▼                    ▼                  │
│  ┌────────────────────────────────────────┐        │
│  │         Backend API (NestJS)            │        │
│  │                                          │        │
│  │  ┌──────────────┐  ┌─────────────────┐│        │
│  │  │   Guards     │  │    Services     ││        │
│  │  │              │  │                 ││        │
│  │  │ - Auth       │  │ - Staff CRUD    ││        │
│  │  │ - Permission │  │ - Role Lookup   ││        │
│  │  │              │  │ - Audit Log     ││        │
│  │  └──────────────┘  └─────────────────┘│        │
│  │           │                    │        │        │
│  └───────────┼────────────────────┼────────┘        │
│              │                    │                  │
│              ▼                    ▼                  │
│  ┌────────────────────────────────────────┐        │
│  │         REST API Endpoints              │        │
│  │                                          │        │
│  │  GET    /api/staff                      │        │
│  │  POST   /api/staff                      │        │
│  │  GET    /api/staff/:id                  │        │
│  │  PATCH  /api/staff/:id                  │        │
│  │  DELETE /api/staff/:id                  │        │
│  │  GET    /api/staff/roles                │        │
│  │  GET    /api/staff/:id/audit-log        │        │
│  └──────────────┬──────────────────────────┘        │
│                 │                                     │
│                 ▼                                     │
│  ┌────────────────────────────────────────┐        │
│  │         Frontend (Next.js)              │        │
│  │                                          │        │
│  │  - Staff List Page                      │        │
│  │  - Staff Form (Create/Edit)             │        │
│  │  - Role Assignment                      │        │
│  │  - Permission Matrix View               │        │
│  └─────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### Permission Check Flow

```
Request: GET /api/orders
Headers: Authorization: Bearer <JWT>

    ↓

┌─────────────────────┐
│   1. JWT Decoded    │
│   Extract user info │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Lookup Staff     │
│ Query: org_emp_users│
│ By: email, tenant   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Get Role Perms   │
│ Query: sys_roles_cd │
│ Get: permissions[]  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Check Required   │
│ Required: orders:read│
│ User has: orders:*  │
│ Result: MATCH!      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Log Audit        │
│ Save access attempt │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 6. Allow Request    │
│ Execute controller  │
└─────────────────────┘
```

---

## Implementation Steps

### Step 1: Database Schema (Day 1)

#### 1.1 Create Prisma Schema

**File**: `apps/api/prisma/schema.prisma`

```prisma
// System-wide user roles (code table)
model sys_user_roles_cd {
  id                String   @id @default(uuid())
  code              String   @unique  // admin, manager, counter, assembly, driver
  name              String
  name2             String?  // Arabic name (from PRD-023)
  description       String?
  description2      String?  // Arabic description
  permissions       Json     // Array of permission strings: ["orders:*", "customers:read"]
  is_system         Boolean  @default(false)  // System roles cannot be deleted
  is_active         Boolean  @default(true)
  display_order     Int      @default(0)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  @@map("sys_user_roles_cd")
}

// Organization employees/users
model org_emp_users {
  id                String   @id @default(uuid())
  tenant_org_id     String
  supabase_user_id  String?  // Link to Supabase auth.users if they have login
  
  // Personal Information
  email             String
  phone             String?
  name              String
  name2             String?  // Arabic name
  
  // Role & Employment
  role_code         String   // Links to sys_user_roles_cd.code
  employee_code     String?  // Internal employee number (e.g., EMP-001)
  position          String?  // Job title (e.g., "Head Cashier")
  position2         String?  // Arabic job title
  
  // Branch Assignment
  primary_branch_id String?  // Main branch they work at
  allowed_branches  Json?    // Array of branch IDs they can access
  
  // Status & Dates
  is_active         Boolean  @default(true)
  is_user           Boolean  @default(false)  // Has login access?
  hire_date         DateTime?
  termination_date  DateTime?
  
  // Additional Info
  address           String?
  area              String?
  emergency_contact String?
  notes             String?
  
  // Audit Fields
  created_at        DateTime @default(now())
  created_by        String?
  updated_at        DateTime @updatedAt
  updated_by        String?
  
  // Relations
  tenant            org_tenants_mst @relation(fields: [tenant_org_id], references: [id], onDelete: Cascade)
  primary_branch    org_branches_mst? @relation(fields: [primary_branch_id, tenant_org_id], references: [id, tenant_org_id])
  
  // Audit trail - staff who created/updated orders
  created_orders    org_orders_mst[] @relation("OrderCreatedBy")
  updated_orders    org_orders_mst[] @relation("OrderUpdatedBy")
  
  @@unique([tenant_org_id, email])
  @@index([tenant_org_id])
  @@index([tenant_org_id, role_code])
  @@index([supabase_user_id])
  @@map("org_emp_users")
}

// Permission audit log (tracks all permission checks)
model org_permission_audit_log {
  id                String   @id @default(uuid())
  tenant_org_id     String
  user_id           String   // org_emp_users.id
  user_email        String
  user_role         String   // Role code at time of action
  
  // Action details
  action            String   // create, read, update, delete
  resource          String   // orders, customers, settings, etc.
  resource_id       String?  // Specific record ID (if applicable)
  
  // Request details
  ip_address        String?
  user_agent        String?
  endpoint          String?  // API endpoint called
  
  // Result
  success           Boolean  @default(true)
  error_message     String?
  
  // Additional context
  metadata          Json?
  
  created_at        DateTime @default(now())
  
  @@index([tenant_org_id, user_id])
  @@index([tenant_org_id, created_at])
  @@index([tenant_org_id, resource, action])
  @@map("org_permission_audit_log")
}
```

#### 1.2 Update org_orders_mst for Audit Trail

Add creator/updater tracking to orders:

```prisma
model org_orders_mst {
  // ... existing fields ...
  
  created_by        String?  // org_emp_users.id
  updated_by        String?  // org_emp_users.id
  
  // Relations
  creator           org_emp_users? @relation("OrderCreatedBy", fields: [created_by], references: [id])
  updater           org_emp_users? @relation("OrderUpdatedBy", fields: [updated_by], references: [id])
  
  // ... rest of model ...
}
```

#### 1.3 Create Migration

```bash
cd apps/api

# Generate migration
npx prisma migrate dev --name add_staff_management

# Apply migration
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

#### 1.4 Seed Default Roles

**File**: `apps/api/prisma/seeds/roles.seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultRoles = [
  {
    code: 'owner',
    name: 'Owner',
    name2: 'المالك',
    description: 'Full system access - all permissions',
    description2: 'صلاحيات كاملة للنظام',
    permissions: ['*:*'], // Super admin - everything
    is_system: true,
    display_order: 1,
  },
  {
    code: 'admin',
    name: 'Administrator',
    name2: 'مدير النظام',
    description: 'Full administrative access',
    description2: 'صلاحيات إدارية كاملة',
    permissions: [
      'orders:*',
      'customers:*',
      'services:*',
      'staff:*',
      'branches:*',
      'reports:*',
      'settings:*',
      'payments:*',
    ],
    is_system: true,
    display_order: 2,
  },
  {
    code: 'manager',
    name: 'Manager',
    name2: 'مدير',
    description: 'Branch management and operations',
    description2: 'إدارة الفرع والعمليات',
    permissions: [
      'orders:*',
      'customers:*',
      'services:read',
      'staff:read',
      'reports:read',
      'settings:read',
      'payments:read',
    ],
    is_system: true,
    display_order: 3,
  },
  {
    code: 'counter',
    name: 'Counter Staff',
    name2: 'موظف الاستقبال',
    description: 'Order intake and customer service',
    description2: 'استقبال الطلبات وخدمة العملاء',
    permissions: [
      'orders:create',
      'orders:read',
      'orders:update',
      'customers:create',
      'customers:read',
      'customers:update',
      'services:read',
    ],
    is_system: true,
    display_order: 4,
  },
  {
    code: 'assembly',
    name: 'Assembly Staff',
    name2: 'موظف التجميع',
    description: 'Assembly, QA, and packing operations',
    description2: 'عمليات التجميع والفحص والتعبئة',
    permissions: [
      'orders:read',
      'assembly:*',
      'qa:*',
      'packing:*',
    ],
    is_system: true,
    display_order: 5,
  },
  {
    code: 'driver',
    name: 'Driver',
    name2: 'سائق',
    description: 'Delivery and pickup operations',
    description2: 'عمليات التوصيل والاستلام',
    permissions: [
      'orders:read',
      'deliveries:*',
      'routes:read',
      'customers:read',
    ],
    is_system: true,
    display_order: 6,
  },
  {
    code: 'finance',
    name: 'Finance',
    name2: 'المالية',
    description: 'Financial operations and reporting',
    description2: 'العمليات المالية والتقارير',
    permissions: [
      'orders:read',
      'customers:read',
      'payments:*',
      'invoices:*',
      'reports:*',
      'refunds:*',
    ],
    is_system: true,
    display_order: 7,
  },
];

async function seedRoles() {
  console.log('🌱 Seeding default roles...');

  for (const role of defaultRoles) {
    await prisma.sys_user_roles_cd.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
    console.log(`  ✅ ${role.name} (${role.code})`);
  }

  console.log('✅ Roles seeded successfully!\n');
  
  // Display role summary
  console.log('📋 Role Summary:');
  console.log('─────────────────────────────────────');
  for (const role of defaultRoles) {
    console.log(`${role.name}:`);
    console.log(`  Permissions: ${role.permissions.join(', ')}`);
    console.log('');
  }
}

seedRoles()
  .catch((e) => {
    console.error('❌ Error seeding roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run the seed**:
```bash
npx ts-node prisma/seeds/roles.seed.ts
```

---

### Step 2: Backend - Guards & Decorators (Day 1-2)

#### 2.1 Create Permission Decorator

**File**: `apps/api/src/common/decorators/permissions.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to protect routes with specific permissions
 * 
 * @example
 * @Permissions('orders:create')
 * async createOrder() { ... }
 * 
 * @example
 * @Permissions('orders:create', 'orders:update')
 * async modifyOrder() { ... }
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

#### 2.2 Create Current User Decorator

**File**: `apps/api/src/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts current user from request
 * Set by Auth Guard
 * 
 * @example
 * async myMethod(@CurrentUser() user: any) {
 *   console.log(user.id, user.email, user.tenantId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

#### 2.3 Create Current Staff Decorator

**File**: `apps/api/src/common/decorators/current-staff.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts current staff member from request
 * Set by Permission Guard after validation
 * 
 * @example
 * async myMethod(@CurrentStaff() staff: org_emp_users) {
 *   console.log(staff.role_code, staff.name);
 * }
 */
export const CurrentStaff = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.staff;
  },
);
```

#### 2.4 Create Permission Guard

**File**: `apps/api/src/common/guards/permissions.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from @Permissions() decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required? Allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user from request (set by JWT Auth Guard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get staff member record
    const staff = await this.prisma.org_emp_users.findUnique({
      where: {
        tenant_org_id_email: {
          tenant_org_id: user.tenantId,
          email: user.email,
        },
      },
    });

    if (!staff) {
      throw new ForbiddenException('Staff account not found');
    }

    if (!staff.is_active) {
      throw new ForbiddenException('Staff account is inactive');
    }

    // Get role permissions
    const role = await this.prisma.sys_user_roles_cd.findUnique({
      where: { code: staff.role_code },
    });

    if (!role || !role.is_active) {
      throw new ForbiddenException('Role not found or inactive');
    }

    const userPermissions = role.permissions as string[];

    // Check if user has required permissions
    const hasPermission = this.checkPermissions(
      userPermissions,
      requiredPermissions,
    );

    // Log the permission check
    await this.logPermissionCheck(
      user,
      staff,
      requiredPermissions,
      hasPermission,
      request,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    // Attach staff record to request for use in controllers
    request.staff = staff;
    request.userPermissions = userPermissions;

    return true;
  }

  /**
   * Check if user has all required permissions
   */
  private checkPermissions(
    userPermissions: string[],
    requiredPermissions: string[],
  ): boolean {
    // Super admin has all permissions
    if (userPermissions.includes('*:*')) {
      return true;
    }

    // Check each required permission
    return requiredPermissions.every((required) =>
      this.hasPermission(userPermissions, required),
    );
  }

  /**
   * Check if user has a specific permission (with wildcard support)
   */
  private hasPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    // Exact match
    if (userPermissions.includes(required)) {
      return true;
    }

    const [resource, action] = required.split(':');

    // Resource wildcard: orders:* matches orders:create
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // Action wildcard: *:read matches orders:read
    if (userPermissions.includes(`*:${action}`)) {
      return true;
    }

    return false;
  }

  /**
   * Log permission check to audit trail
   */
  private async logPermissionCheck(
    user: any,
    staff: any,
    permissions: string[],
    success: boolean,
    request: any,
  ) {
    try {
      // Extract action and resource from first permission
      const [resource, action] = (permissions[0] || ':').split(':');

      await this.prisma.org_permission_audit_log.create({
        data: {
          tenant_org_id: user.tenantId,
          user_id: staff.id,
          user_email: user.email,
          user_role: staff.role_code,
          action: action || 'unknown',
          resource: resource || 'unknown',
          endpoint: request.url,
          success,
          error_message: success ? null : 'Permission denied',
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
          metadata: {
            permissions,
            method: request.method,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      // Don't fail request if audit logging fails
      console.error('Failed to log permission check:', error);
    }
  }
}
```

#### 🎓 Understanding the Guard Logic

**Step-by-Step**:
1. **Extract Required Permissions**: From `@Permissions()` decorator
2. **Get User**: From JWT token (set by Auth Guard)
3. **Lookup Staff**: Find staff record by email + tenant
4. **Get Role**: Fetch role and its permissions
5. **Check Match**: Does user have all required permissions?
6. **Log Audit**: Record the attempt (success or failure)
7. **Allow/Deny**: Return true or throw exception

**Permission Matching Examples**:
```typescript
// User has: ['orders:*']
// Required: 'orders:create'
// Result: ALLOWED (wildcard match)

// User has: ['orders:read', 'customers:*']
// Required: 'orders:delete'
// Result: DENIED (no match)

// User has: ['*:*']
// Required: anything
// Result: ALLOWED (super admin)
```

---

### Step 3: Backend - Staff Service & Controller (Day 2)

#### 3.1 Create Staff Module

```bash
cd apps/api
nest g module staff
nest g controller staff
nest g service staff
```

#### 3.2 Staff DTOs

**File**: `apps/api/src/staff/dto/create-staff.dto.ts`

```typescript
import { IsString, IsEmail, IsOptional, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStaffDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+96891234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'جون دو', required: false })
  @IsOptional()
  @IsString()
  name2?: string;

  @ApiProperty({ example: 'counter', enum: ['admin', 'manager', 'counter', 'assembly', 'driver', 'finance'] })
  @IsString()
  role_code: string;

  @ApiProperty({ example: 'EMP-001', required: false })
  @IsOptional()
  @IsString()
  employee_code?: string;

  @ApiProperty({ example: 'Head Cashier', required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ example: 'كاشير رئيسي', required: false })
  @IsOptional()
  @IsString()
  position2?: string;

  @ApiProperty({ example: 'branch-uuid', required: false })
  @IsOptional()
  @IsString()
  primary_branch_id?: string;

  @ApiProperty({ example: ['branch-1', 'branch-2'], required: false })
  @IsOptional()
  @IsArray()
  allowed_branches?: string[];

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  is_user?: boolean;

  @ApiProperty({ example: '2025-01-01', required: false })
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Al Khuwair', required: false })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiProperty({ example: '+96899999999', required: false })
  @IsOptional()
  @IsString()
  emergency_contact?: string;

  @ApiProperty({ example: 'Special notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**File**: `apps/api/src/staff/dto/update-staff.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}
```

**File**: `apps/api/src/staff/dto/staff-query.dto.ts`

```typescript
import { IsOptional, IsString, IsInt, Min, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StaffQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  active?: string;
}
```

#### 3.3 Staff Service

**File**: `apps/api/src/staff/staff.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto, StaffQueryDto } from './dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all staff members with filtering and pagination
   */
  async findAll(tenantId: string, query: StaffQueryDto) {
    const { page = 1, limit = 20, role, branch, search, active } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_org_id: tenantId,
    };

    if (role) {
      where.role_code = role;
    }

    if (branch) {
      where.primary_branch_id = branch;
    }

    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { employee_code: { contains: search } },
      ];
    }

    // Execute queries in parallel
    const [staff, total] = await Promise.all([
      this.prisma.org_emp_users.findMany({
        where,
        skip,
        take: limit,
        include: {
          primary_branch: {
            select: {
              id: true,
              name: true,
              name2: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.org_emp_users.count({ where }),
    ]);

    return {
      data: staff,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single staff member by ID
   */
  async findOne(tenantId: string, id: string) {
    const staff = await this.prisma.org_emp_users.findFirst({
      where: {
        id,
        tenant_org_id: tenantId,
      },
      include: {
        primary_branch: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  /**
   * Create new staff member
   */
  async create(
    tenantId: string,
    dto: CreateStaffDto,
    createdBy: string,
  ) {
    // Check if email already exists in this tenant
    const existing = await this.prisma.org_emp_users.findFirst({
      where: {
        tenant_org_id: tenantId,
        email: dto.email,
      },
    });

    if (existing) {
      throw new ConflictException('Staff member with this email already exists');
    }

    // Verify role exists
    const role = await this.prisma.sys_user_roles_cd.findUnique({
      where: { code: dto.role_code },
    });

    if (!role || !role.is_active) {
      throw new NotFoundException('Invalid role specified');
    }

    // Create staff member
    const staff = await this.prisma.org_emp_users.create({
      data: {
        ...dto,
        tenant_org_id: tenantId,
        created_by: createdBy,
      },
      include: {
        primary_branch: true,
      },
    });

    return {
      success: true,
      message: 'Staff member created successfully',
      data: staff,
    };
  }

  /**
   * Update staff member
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateStaffDto,
    updatedBy: string,
  ) {
    // Verify staff exists
    await this.findOne(tenantId, id);

    // If email is being updated, check for conflicts
    if (dto.email) {
      const existing = await this.prisma.org_emp_users.findFirst({
        where: {
          tenant_org_id: tenantId,
          email: dto.email,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Another staff member with this email exists');
      }
    }

    // If role is being updated, verify it exists
    if (dto.role_code) {
      const role = await this.prisma.sys_user_roles_cd.findUnique({
        where: { code: dto.role_code },
      });

      if (!role || !role.is_active) {
        throw new NotFoundException('Invalid role specified');
      }
    }

    const staff = await this.prisma.org_emp_users.update({
      where: { id },
      data: {
        ...dto,
        updated_by: updatedBy,
        updated_at: new Date(),
      },
      include: {
        primary_branch: true,
      },
    });

    return {
      success: true,
      message: 'Staff member updated successfully',
      data: staff,
    };
  }

  /**
   * Update staff active status
   */
  async updateStatus(
    tenantId: string,
    id: string,
    isActive: boolean,
    updatedBy: string,
  ) {
    await this.findOne(tenantId, id);

    const staff = await this.prisma.org_emp_users.update({
      where: { id },
      data: {
        is_active: isActive,
        termination_date: !isActive ? new Date() : null,
        updated_by: updatedBy,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: `Staff member ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: staff,
    };
  }

  /**
   * Delete staff member (soft delete by deactivating)
   */
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.org_emp_users.update({
      where: { id },
      data: {
        is_active: false,
        termination_date: new Date(),
      },
    });

    return {
      success: true,
      message: 'Staff member removed successfully',
    };
  }

  /**
   * Get audit log for specific staff member
   */
  async getAuditLog(
    tenantId: string,
    id: string,
    limit: number = 50,
  ) {
    await this.findOne(tenantId, id);

    const logs = await this.prisma.org_permission_audit_log.findMany({
      where: {
        tenant_org_id: tenantId,
        user_id: id,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return {
      success: true,
      data: logs,
    };
  }

  /**
   * Get all available roles
   */
  async getRoles() {
    const roles = await this.prisma.sys_user_roles_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
    });

    return {
      success: true,
      data: roles,
    };
  }
}
```

#### 3.4 Staff Controller

**File**: `apps/api/src/staff/staff.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto, StaffQueryDto } from './dto';

@ApiTags('Staff Management')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions('staff:read')
  @ApiOperation({ summary: 'List all staff members' })
  async findAll(
    @CurrentUser() user,
    @Query() query: StaffQueryDto,
  ) {
    return this.staffService.findAll(user.tenantId, query);
  }

  @Get('roles')
  @Permissions('staff:read')
  @ApiOperation({ summary: 'Get available roles' })
  async getRoles() {
    return this.staffService.getRoles();
  }

  @Get(':id')
  @Permissions('staff:read')
  @ApiOperation({ summary: 'Get staff member details' })
  async findOne(
    @CurrentUser() user,
    @Param('id') id: string,
  ) {
    return this.staffService.findOne(user.tenantId, id);
  }

  @Post()
  @Permissions('staff:create')
  @ApiOperation({ summary: 'Create new staff member' })
  async create(
    @CurrentUser() user,
    @Body() createStaffDto: CreateStaffDto,
  ) {
    return this.staffService.create(
      user.tenantId,
      createStaffDto,
      user.id,
    );
  }

  @Patch(':id')
  @Permissions('staff:update')
  @ApiOperation({ summary: 'Update staff member' })
  async update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    return this.staffService.update(
      user.tenantId,
      id,
      updateStaffDto,
      user.id,
    );
  }

  @Patch(':id/status')
  @Permissions('staff:update')
  @ApiOperation({ summary: 'Activate/deactivate staff member' })
  async updateStatus(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body('is_active') isActive: boolean,
  ) {
    return this.staffService.updateStatus(
      user.tenantId,
      id,
      isActive,
      user.id,
    );
  }

  @Delete(':id')
  @Permissions('staff:delete')
  @ApiOperation({ summary: 'Delete staff member' })
  async remove(
    @CurrentUser() user,
    @Param('id') id: string,
  ) {
    return this.staffService.remove(user.tenantId, id);
  }

  @Get(':id/audit-log')
  @Permissions('staff:read', 'reports:read')
  @ApiOperation({ summary: 'Get staff audit trail' })
  async getAuditLog(
    @CurrentUser() user,
    @Param('id') id: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.staffService.getAuditLog(
      user.tenantId,
      id,
      limit,
    );
  }
}
```

---

### Step 4: Frontend - Staff Management UI (Day 3-4)

#### 4.1 Create Staff List Page

**File**: `apps/web/app/[locale]/staff/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StaffForm } from '@/components/staff/staff-form';

export default function StaffPage() {
  const { t } = useTranslation('staff');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchStaff();
  }, [search]);

  const fetchStaff = async () => {
    try {
      const response = await fetch(
        `/api/staff?search=${search}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      const data = await response.json();
      setStaff(data.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (roleCode: string) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      counter: 'bg-green-100 text-green-800',
      assembly: 'bg-yellow-100 text-yellow-800',
      driver: 'bg-indigo-100 text-indigo-800',
      finance: 'bg-pink-100 text-pink-800',
    };
    return colors[roleCode] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('add_staff')}
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 me-2" />
          {t('filter')}
        </Button>
      </div>

      {/* Staff Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('branch')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  {t('no_staff')}
                </TableCell>
              </TableRow>
            ) : (
              staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.name}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(member.role_code)}>
                      {t(`roles.${member.role_code}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.primary_branch?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.is_active ? 'default' : 'secondary'}
                    >
                      {member.is_active ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedStaff(member);
                        setShowForm(true);
                      }}
                    >
                      {t('edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Staff Form Modal */}
      {showForm && (
        <StaffForm
          staff={selectedStaff}
          onClose={() => {
            setShowForm(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            fetchStaff();
            setShowForm(false);
            setSelectedStaff(null);
          }}
        />
      )}
    </div>
  );
}
```

#### 4.2 Create Staff Form Component

**File**: `apps/web/components/staff/staff-form.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface StaffFormProps {
  staff?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function StaffForm({ staff, onClose, onSuccess }: StaffFormProps) {
  const { t } = useTranslation('staff');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    name2: '',
    role_code: '',
    employee_code: '',
    position: '',
    position2: '',
    is_active: true,
    is_user: false,
  });

  useEffect(() => {
    fetchRoles();
    if (staff) {
      setFormData(staff);
    }
  }, [staff]);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/staff/roles', {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await response.json();
      setRoles(data.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = staff
        ? `/api/staff/${staff.id}`
        : '/api/staff';
      
      const method = staff ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.message || 'Error saving staff');
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Error saving staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {staff ? t('edit_staff') : t('add_staff')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="email">{t('form.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">{t('form.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>

          {/* Name (English) */}
          <div>
            <Label htmlFor="name">{t('form.name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          {/* Name (Arabic) */}
          <div>
            <Label htmlFor="name2">{t('form.name_ar')}</Label>
            <Input
              id="name2"
              value={formData.name2}
              onChange={(e) =>
                setFormData({ ...formData, name2: e.target.value })
              }
              dir="rtl"
            />
          </div>

          {/* Role */}
          <div>
            <Label htmlFor="role">{t('form.role')}</Label>
            <Select
              value={formData.role_code}
              onValueChange={(value) =>
                setFormData({ ...formData, role_code: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_role')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.code} value={role.code}>
                    {role.name} - {role.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Code */}
          <div>
            <Label htmlFor="employee_code">{t('form.employee_code')}</Label>
            <Input
              id="employee_code"
              value={formData.employee_code}
              onChange={(e) =>
                setFormData({ ...formData, employee_code: e.target.value })
              }
              placeholder="EMP-001"
            />
          </div>

          {/* Position */}
          <div>
            <Label htmlFor="position">{t('form.position')}</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) =>
                setFormData({ ...formData, position: e.target.value })
              }
            />
          </div>

          {/* Switches */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">{t('form.is_active')}</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_user">{t('form.has_login')}</Label>
            <Switch
              id="is_user"
              checked={formData.is_user}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_user: checked })
              }
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### Step 5: Testing & Integration (Day 4-5)

#### 5.1 Test Permission Guard

**File**: `apps/api/test/permissions.guard.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: PrismaService,
          useValue: {
            org_emp_users: {
              findUnique: jest.fn(),
            },
            sys_user_roles_cd: {
              findUnique: jest.fn(),
            },
            org_permission_audit_log: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access with correct permissions', async () => {
    // Test implementation
  });

  it('should deny access without required permissions', async () => {
    // Test implementation
  });

  it('should allow super admin access to everything', async () => {
    // Test implementation
  });
});
```

#### 5.2 Manual Testing Checklist

**Backend API**:
```bash
# 1. Create staff member
curl -X POST http://localhost:3000/api/staff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe",
    "role_code": "counter"
  }'

# 2. List staff
curl -X GET "http://localhost:3000/api/staff" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Get staff by ID
curl -X GET "http://localhost:3000/api/staff/{id}" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Test permission denial
# Login as counter staff, try to access admin route
curl -X GET "http://localhost:3000/api/settings" \
  -H "Authorization: Bearer COUNTER_TOKEN"
# Should return 403 Forbidden
```

**Permission Testing**:
- [ ] Owner can access everything
- [ ] Admin cannot access owner-only features
- [ ] Manager can view but not delete
- [ ] Counter can create orders
- [ ] Counter cannot view reports
- [ ] Assembly cannot access customer data
- [ ] Driver can only view assigned deliveries

**UI Testing**:
- [ ] Staff list loads correctly
- [ ] Create new staff works
- [ ] Edit staff works
- [ ] Role dropdown shows all roles
- [ ] Bilingual names display correctly
- [ ] Active/Inactive toggle works
- [ ] Search filters staff
- [ ] Pagination works

**Audit Log Testing**:
- [ ] All permission checks logged
- [ ] Success and failures recorded
- [ ] User info captured correctly
- [ ] Timestamps accurate
- [ ] Can view audit log for staff member

---

## Success Criteria

### Must Have ✅
- [x] 7 default roles seeded
- [x] Staff CRUD operations working
- [x] Permission guard protecting routes
- [x] Audit logging operational
- [x] Web UI for staff management
- [x] Role-based access control enforced

### Quality Metrics ✅
- **Security**: All routes protected by permissions
- **Performance**: Permission check < 50ms
- **Audit**: 100% of actions logged
- **UX**: Staff form validates properly
- **Testing**: Core permission scenarios pass

### Business Value 🎯
- **Security Foundation**: Authorization system in place
- **Operational Ready**: Can add staff and control access
- **Audit Trail**: Full accountability for actions
- **Scalable**: Easy to add new roles/permissions
- **Multi-Branch Ready**: Staff can be branch-assigned

---

## Troubleshooting

### Common Issues

**Issue**: Permission guard not working
```typescript
// Check guard is registered globally
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
```

**Issue**: Staff not found after login
```typescript
// Ensure staff record created for auth user
// Check tenant_org_id matches
// Verify email matches exactly
```

**Issue**: Circular dependency error
```typescript
// Move PrismaService to separate module
// Import only what's needed
```

**Issue**: Permissions not checking correctly
```typescript
// Verify permissions array is JSON in database
// Check permission string format: "resource:action"
// Test wildcard matching logic
```

---

## Resources

### Documentation
- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)

### Security Best Practices
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [RBAC Patterns](https://en.wikipedia.org/wiki/Role-based_access_control)

### Testing
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

## Next Steps

After completing staff management:
1. ✅ All future features can use `@Permissions()` decorator
2. ✅ Audit trail automatically tracks all actions
3. ✅ Ready to implement PRD-008 (Service Catalog)
4. ✅ Can assign staff to branches (PRD-014)

**Foundation Complete!** 🎉

---

**Document Status**: ✅ Ready for Implementation  
**Last Updated**: October 31, 2025  
**Next Review**: After PRD-008 completion
