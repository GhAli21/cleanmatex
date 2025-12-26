# RBAC User Guide

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Understanding Roles](#understanding-roles)
3. [Understanding Permissions](#understanding-permissions)
4. [Managing Roles](#managing-roles)
5. [Assigning Roles to Users](#assigning-roles-to-users)
6. [Workflow Roles](#workflow-roles)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Role-Based Access Control (RBAC) system allows administrators to control what users can do in CleanMateX. This guide explains how to use the RBAC system from an end-user perspective.

### Key Concepts

- **Roles:** Collections of permissions that define what a user can do
- **Permissions:** Specific actions users can perform (e.g., create orders, view reports)
- **Workflow Roles:** Special roles that control access to operational workflow steps
- **Multi-Role Support:** Users can have multiple roles simultaneously

---

## Understanding Roles

### System Roles

These are built-in roles that come with CleanMateX:

#### 1. **Super Admin**

- **Code:** `super_admin`
- **Description:** Platform administrator with access to all tenants
- **Use Case:** System administrators managing the entire platform

#### 2. **Tenant Admin**

- **Code:** `tenant_admin`
- **Description:** Full access within your tenant organization
- **Use Case:** Business owners or managers who need complete control
- **Permissions:** All permissions within the tenant

#### 3. **Branch Manager**

- **Code:** `branch_manager`
- **Description:** Manages a specific branch with branch-scoped permissions
- **Use Case:** Branch supervisors who manage operations at a specific location
- **Permissions:** Most permissions, but scoped to their branch

#### 4. **Operator**

- **Code:** `operator`
- **Description:** Standard worker with operational permissions
- **Use Case:** Staff members who handle daily operations
- **Permissions:** Create and manage orders, view customers, basic operations

#### 5. **Viewer**

- **Code:** `viewer`
- **Description:** Read-only access to view data
- **Use Case:** Auditors, accountants, or managers who only need to view information
- **Permissions:** View-only access to orders, customers, reports

### Custom Roles

You can create custom roles tailored to your business needs:

**Examples:**

- **Cashier:** Can create orders and process payments, but cannot delete orders
- **Inventory Manager:** Can manage inventory and view reports, but cannot create orders
- **Customer Service:** Can view and update customer information, but cannot access financial data

---

## Understanding Permissions

Permissions follow the format: `resource:action`

### Resources

Available resources include:

- **orders** - Order management
- **customers** - Customer management
- **inventory** - Inventory management
- **reports** - Reports and analytics
- **settings** - System settings
- **users** - User management
- **roles** - Role management

### Actions

Common actions include:

- **create** - Create new records
- **read** - View records
- **update** - Edit records
- **delete** - Delete records
- **export** - Export data
- **manage** - Full management access

### Examples

- `orders:create` - Permission to create orders
- `orders:read` - Permission to view orders
- `orders:update` - Permission to edit orders
- `orders:delete` - Permission to delete orders
- `customers:export` - Permission to export customer data
- `settings:manage` - Permission to manage system settings

---

## Managing Roles

### Accessing Role Management

1. Navigate to **Settings** → **Roles & Permissions**
2. You'll see two sections:
   - **System Roles:** Built-in roles (cannot be deleted)
   - **Custom Roles:** Roles you've created

### Creating a Custom Role

1. Click **Create Role** button
2. Fill in the form:
   - **Role Code:** Unique identifier (lowercase, underscores only)
     - Example: `cashier`, `inventory_manager`
   - **Role Name (English):** Display name in English
     - Example: `Cashier`, `Inventory Manager`
   - **Role Name (Arabic):** Display name in Arabic (optional)
     - Example: `أمين الصندوق`, `مدير المخزون`
   - **Description:** What this role is for (optional)
3. Click **Create Role**
4. After creation, click **Edit** to assign permissions to the role

### Editing a Role

1. Find the role in the list
2. Click **Edit**
3. Modify the name, description, or permissions
4. Click **Save Changes**

**Note:** Role code cannot be changed after creation.

### Deleting a Custom Role

1. Find the custom role (system roles cannot be deleted)
2. Click **Delete**
3. Confirm the deletion

**Warning:** Deleting a role will remove it from all users who have it assigned.

### Assigning Permissions to a Role

1. Click **Edit** on a role
2. Navigate to the **Permissions** tab (if available in future updates)
3. Select the permissions this role should have
4. Click **Save**

**Note:** Permission assignment UI is coming in a future update. Currently, permissions are assigned via database or API.

---

## Assigning Roles to Users

### Via User Management Page

1. Navigate to **Settings** → **Team Members**
2. Find the user you want to assign a role to
3. Click **Edit** or **Assign Roles**
4. Select one or more roles from the dropdown
5. Click **Save**

### Multi-Role Support

Users can have multiple roles simultaneously. For example:

- A user can be both **Operator** and have a custom **Cashier** role
- Permissions from all roles are combined
- If one role allows an action and another denies it, the deny takes precedence

---

## Workflow Roles

Workflow roles control access to specific operational workflow steps, separate from regular permissions.

### Available Workflow Roles

1. **Reception** (`ROLE_RECEPTION`)

   - Order intake and delivery
   - Can receive orders from customers
   - Can handle order pickup

2. **Preparation** (`ROLE_PREPARATION`)

   - Item tagging and preparation
   - Can tag items and prepare them for processing

3. **Processing** (`ROLE_PROCESSING`)

   - Wash, dry, and iron operations
   - Can process laundry items

4. **Quality Assurance** (`ROLE_QA`)

   - Quality inspection
   - Can inspect completed items for quality

5. **Delivery** (`ROLE_DELIVERY`)

   - Delivery operations
   - Can handle order delivery

6. **Workflow Admin** (`ROLE_ADMIN`)
   - Full workflow access
   - Can access all workflow steps

### Assigning Workflow Roles

1. Navigate to **Settings** → **Workflow Roles**
2. Find the user in the list
3. Click **Assign Roles**
4. Select one or more workflow roles
5. Click **Assign**

### Multi-Workflow-Role Support

Users can have multiple workflow roles. For example:

- A user can be both **Reception** and **QA**
- This allows them to handle both order intake and quality inspection

---

## Common Tasks

### Task 1: Create a Cashier Role

**Scenario:** You want to create a role for cashiers who can create orders and process payments, but cannot delete orders or access settings.

**Steps:**

1. Go to **Settings** → **Roles & Permissions**
2. Click **Create Role**
3. Enter:
   - Code: `cashier`
   - Name (English): `Cashier`
   - Name (Arabic): `أمين الصندوق`
   - Description: `Handles cash transactions and order creation`
4. Click **Create Role**
5. Edit the role and assign permissions:
   - `orders:create`
   - `orders:read`
   - `orders:update`
   - `customers:read`
   - `customers:create`
   - `payments:create`
   - `payments:read`

### Task 2: Assign Multiple Roles to a User

**Scenario:** You want a user to be both an Operator and have the Cashier role.

**Steps:**

1. Go to **Settings** → **Team Members**
2. Find the user
3. Click **Edit**
4. In the **Roles** section, select:
   - `operator` (system role)
   - `cashier` (custom role)
5. Click **Save**

### Task 3: Assign Workflow Roles

**Scenario:** You want a user to handle both reception and quality assurance.

**Steps:**

1. Go to **Settings** → **Workflow Roles**
2. Find the user
3. Click **Assign Roles**
4. Select:
   - `ROLE_RECEPTION`
   - `ROLE_QA`
5. Click **Assign**

### Task 4: Remove a Role from a User

**Steps:**

1. Go to **Settings** → **Team Members**
2. Find the user
3. Click **Edit**
4. Deselect the role you want to remove
5. Click **Save**

---

## Troubleshooting

### User Cannot Access a Feature

**Problem:** A user reports they cannot access a feature they should have access to.

**Solution:**

1. Check what roles the user has:
   - Go to **Settings** → **Team Members**
   - Find the user and check their assigned roles
2. Check what permissions those roles have:
   - Go to **Settings** → **Roles & Permissions**
   - Check each role's permissions
3. Verify the user has the required permission:
   - The permission format is `resource:action`
   - For example, to create orders, they need `orders:create`
4. If permissions are correct, try:
   - Removing and re-adding the role
   - Contacting system administrator

### Workflow Role Not Working

**Problem:** A user cannot access a workflow step even though they have the workflow role assigned.

**Solution:**

1. Verify the workflow role is assigned:
   - Go to **Settings** → **Workflow Roles**
   - Check if the user has the correct workflow role
2. Check if the workflow role is active:
   - Ensure the workflow role assignment is active (not deactivated)
3. Verify the user is in the correct tenant:
   - Workflow roles are tenant-specific
   - Ensure the user is accessing the correct tenant

### Cannot Delete a Role

**Problem:** You're trying to delete a role but the delete button is disabled or the role cannot be deleted.

**Solution:**

- System roles cannot be deleted
- Only custom roles can be deleted
- If it's a custom role and still cannot be deleted, check if any users still have this role assigned
- Remove the role from all users first, then try deleting

### Permission Changes Not Taking Effect

**Problem:** You've updated a role's permissions, but users with that role don't see the changes.

**Solution:**

1. Wait a few seconds - permissions are automatically rebuilt
2. Ask users to refresh their browser
3. If still not working, contact system administrator to manually rebuild permissions

---

## Best Practices

### 1. Principle of Least Privilege

- Only assign permissions users actually need
- Start with minimal permissions and add more as needed
- Regularly review user permissions

### 2. Use Custom Roles

- Create custom roles for specific job functions
- Don't give everyone admin access
- Use descriptive role names

### 3. Regular Audits

- Periodically review who has what roles
- Remove roles from users who no longer need them
- Update roles as business needs change

### 4. Document Your Roles

- Use role descriptions to document what each role is for
- Keep a list of which roles have which permissions
- Update documentation when roles change

---

## Support

If you need help with the RBAC system:

1. **Check this guide** for common tasks and troubleshooting
2. **Contact your system administrator** for role and permission issues
3. **Refer to developer documentation** for technical details

---

**Version:** v1.0.0 | **Last Updated:** 2025-01-XX
