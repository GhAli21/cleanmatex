# RBAC & User Management — User Guide

## Overview

The RBAC (Role-Based Access Control) system lets administrators manage who can do what within the CleanMateX platform. It has four main areas:

1. **Users** — Manage team members (add, edit, activate/deactivate)
2. **User Details** — View a user's assigned roles and effective permissions
3. **Roles** — Create and manage roles that bundle permissions together
4. **Permissions** — The individual access rights that roles are built from

---

## 1. Users Management

**Location:** Dashboard → Users (sidebar)
**Access:** Admin only

### Viewing Users
The users page shows all team members for your organization with:
- Name and email address
- Current role (e.g., Admin, Operator, Viewer)
- Status (Active / Inactive)
- Last login date and login count
- Action buttons (Edit, Activate/Deactivate, Delete)

Use the **search bar** to find users by name or email.
Use the **role filter** to show only users with a specific role.
Use the **status filter** to show only active or inactive users.

### Adding a New User
1. Click **Add User** (top-right)
2. Fill in:
   - **Email** (required) — the user's login email
   - **Password** (required) — initial password (user should change this after login)
   - **Display Name** (required) — shown in the system
   - **Role** (required) — what permissions the user will have
   - **First Name / Last Name** (optional)
   - **Phone** (optional)
3. Click **Create User**

The system creates both the login account and the user profile in one step. If any part fails, everything is rolled back — no partial users are created.

### Editing a User
1. Click the **Edit** (pencil) icon on any user row
2. Update Display Name, Role, or other fields
3. Email cannot be changed (it's the login identifier)
4. Click **Update User**

### Activating / Deactivating Users
- Click the toggle or action button to activate/deactivate a user
- Deactivated users cannot log in but their data is preserved
- You can reactivate them at any time

### Viewing User Details
Click **View Details** on any user row to open the User Details screen.

---

## 2. User Details & Role Assignment

**Location:** Dashboard → Users → [Click "View Details"]
**Access:** Admin only

The User Details page shows:

### User Info Card
- Name, email, role badge, active/inactive status
- Last login date

### Roles Tab
Shows all roles currently assigned to this user.

**To assign a new role:**
1. Click **Assign Role**
2. Check the roles to assign in the modal
3. Click **Save**
4. The user's effective permissions are automatically rebuilt

**To remove a role:**
1. Click the **×** button next to a role
2. Confirm the removal
3. Permissions are automatically rebuilt

> Note: Users can have multiple roles. Their effective permissions are the union of all roles' permissions.

### Effective Permissions Tab
Shows the full list of permissions the user currently has, computed from all their assigned roles. This is read-only — to change permissions, edit the assigned roles.

---

## 3. Roles Management

**Location:** Dashboard → Settings → Roles & Permissions
**Access:** Admin only

### What is a Role?
A role is a named collection of permissions. Examples:
- **Admin** — full access to everything
- **Operator** — can manage orders but not settings
- **Viewer** — read-only access

Roles marked as **System** are built-in and cannot be deleted. They can have permissions assigned to them.

### Viewing Roles
The roles table shows:
- Role name (English and Arabic)
- Role code (internal identifier, e.g. `tenant_admin`)
- Type: **System** (built-in) or **Custom** (created by you)
- Number of permissions assigned
- Number of users using this role

### Creating a Custom Role
1. Click **Create Role**
2. Fill in:
   - **Code** (required) — unique identifier, lowercase, e.g. `warehouse_manager`
   - **Name (English)** (required) — display name
   - **Name (Arabic)** (optional) — Arabic display name
   - **Description** (optional)
3. Click **Create**
4. Assign permissions to the new role using the **Key** icon

### Assigning Permissions to a Role
1. Click the **Key** (🔑) icon on any role row
2. The Permission Assignment modal opens showing all available permissions grouped by category
3. Check the permissions you want to assign
4. Use **Select All** / **Deselect All** per category for bulk selection
5. Use the **search bar** to find specific permissions
6. Click **Save Permissions**
7. All users with this role have their permissions automatically rebuilt

### Editing a Custom Role
1. Click the **Edit** (pencil) icon
2. Update the name or description (code cannot be changed)
3. Click **Update**

### Deleting a Custom Role
1. Click the **Delete** (trash) icon
2. Confirm in the dialog
3. Deletion is blocked if:
   - The role is a System role
   - Any users are currently assigned to this role

---

## 4. Permissions Management

**Location:** Dashboard → Settings → Permissions
**Access:** Admin only

### What is a Permission?
A permission is a specific access right with the format `resource:action`.
Examples:
- `orders:read` — can view orders
- `orders:create` — can create orders
- `customers:manage` — full customer management
- `settings:read` — can view settings

Permissions marked as **System** are built-in and cannot be modified or deleted.

### Viewing Permissions
Permissions are displayed grouped by **category** (Orders, Customers, Payments, etc.).

Use the **category tabs** at the top to filter by category.
Use the **search bar** to search by code, name, or description.

The table shows:
- Permission code (`resource:action`)
- Name (English and Arabic if available)
- Category
- How many roles use this permission
- Type: **System** or **Custom**

### Creating a Custom Permission
1. Click **Create Permission**
2. Fill in:
   - **Code** (required) — must follow the `resource:action` format, e.g. `warehouse:manage`
   - **Name (English)** (required)
   - **Name (Arabic)** (optional)
   - **Category** (required) — group this permission with similar ones
   - **Description** (optional)
3. The code field validates the format in real time
4. Click **Create**

### Editing a Custom Permission
1. Click the **Edit** (pencil) icon
2. Update the name, category, or description (code cannot be changed)
3. Click **Update**

### Deleting a Custom Permission
1. Click the **Delete** (trash) icon
2. Deletion is blocked if:
   - The permission is a System permission
   - Any roles are currently using this permission (shown as "Used by X role(s)")

To delete a permission that is in use: first remove it from all roles using the Permission Assignment modal in Roles Management, then delete it.

---

## Bilingual Support (English / Arabic)

The system supports English and Arabic for:
- Role names (`name` / `name2`)
- Permission names (`name` / `name2`)
- User display names

Arabic text fields are right-to-left aligned automatically. Both languages are stored and can be displayed based on the user's locale setting.

---

## Quick Reference

| Task | Location |
|------|----------|
| Add a new user | Dashboard → Users → Add User |
| See what a user can do | Users → View Details → Effective Permissions |
| Assign a role to a user | Users → View Details → Roles → Assign Role |
| Create a custom role | Settings → Roles → Create Role |
| Assign permissions to a role | Settings → Roles → 🔑 icon |
| Create a custom permission | Settings → Permissions → Create Permission |
| See which roles use a permission | Settings → Permissions → "Used by X roles" |
