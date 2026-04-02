# User Management — User Guide

**Audience:** Tenant managers and administrators
**Last updated:** 2026-04-03

---

## Overview

The User Management module lets tenant administrators manage all users within their organization: create accounts, assign roles, configure workflow access, and set fine-grained permission overrides.

Navigation: **Dashboard → Users**

---

## Managing Users

### View Users

The users list page shows all active users in your organization with their name, email, role, status, and last login date.

Use the filter bar to narrow results by:
- **Status** — Active / Inactive
- **Role** — Filter by assigned role
- **Workflow Role** — Filter by operational workflow role
- **Search** — Search by name or email

### Create a User

1. Click **New User** in the top-right corner.
2. Fill in: First name, Last name, Email, Phone (optional), Role.
3. Click **Create**. The user receives an invitation email.

### Edit a User

1. Click on a user row to open the user detail screen.
2. On the **Profile** tab, click **Edit Profile**.
3. Modify fields and click **Save**.

### Activate / Deactivate Users

**Single user:**
- Open the user detail screen → use the status toggle in the header.

**Bulk:**
1. Check the boxes next to multiple users in the list.
2. Use the **Bulk Actions** toolbar: **Activate** or **Deactivate**.

### Delete Users

> ⚠️ Deletion is permanent. Deactivation is preferred for users who may return.

**Single:** Open user → Actions menu → Delete.

**Bulk:**
1. Select users in the list.
2. Click **Delete Selected**.
3. Confirm the deletion in the dialog.

---

## User Detail Screen

Click any user row to open the detail screen. It has three tabs:

| Tab | Contents |
|-----|----------|
| **Profile** | Contact info, role, status, login history |
| **Roles & Permissions** | Tenant roles, resource roles, workflow roles, permission overrides |
| **Activity** | Effective permissions, audit log |

---

## Assigning Roles

Roles bundle a set of permissions together. A user can have multiple roles.

1. Open user → **Roles & Permissions** tab.
2. In the **Tenant-Level Roles** section, click **Assign Roles**.
3. The dialog shows all available roles. Check/uncheck roles.
4. Choose scope:
   - **Tenant-Level** — role applies to the entire organization.
   - **Resource-Scoped** — role applies only to a specific resource (branch, store, route, etc.). Select the resource type and enter/select the resource ID.
5. Review the **Changes** summary (Added / Removed count).
6. Click **Save**.

---

## Assigning Workflow Roles

Workflow roles control which operational stages a user can act on in the order processing pipeline. They are **independent** from user roles.

1. Open user → **Roles & Permissions** tab.
2. In the **Workflow Roles** section, click **Assign Workflow Roles**.
3. Check the applicable workflow roles:

| Role | Access |
|------|--------|
| Reception | Receive orders at counter |
| Preparation | Sort and tag items |
| Processing | Clean/process items |
| Quality Assurance | QA check before packaging |
| Delivery | Handle deliveries |
| Workflow Admin | Override and manage all workflow stages |

4. Click **Save**.

---

## Permission Overrides

Permission overrides let you grant or deny specific permissions to a user, regardless of their assigned roles.

> ⚠️ **Use with caution.** Overrides take precedence over role-based permissions.

1. Open user → **Roles & Permissions** tab.
2. In the **Permission Overrides** section, click **Override Permissions**.
3. In the dialog:
   - Select a permission from the list.
   - Choose **Allow** or **Deny**.
   - Choose scope: **Global** (applies everywhere) or **Resource-Scoped** (specific resource only).
   - Click **Add** to add it to the pending list.
4. Review the pending overrides list.
5. Click **Save All** to apply.

To remove an override: click the **Remove** button next to it in the overrides table.

---

## Rebuilding Permissions

After changing roles or overrides, permissions are usually updated automatically. If you notice a user's access is not reflecting recent changes:

1. Open user → **Roles & Permissions** tab.
2. Click **Rebuild Permissions** in the top-right of the tab.
3. Wait for the success confirmation.

---

## Activity Tab

The **Activity** tab shows two sections:

### Effective Permissions

A list of all permissions the user currently has, derived from all their roles plus any overrides. Grouped by category (e.g., `orders:*`, `customers:*`).

Use this to verify what a user can and cannot do before troubleshooting access issues.

### Audit Log

The last 20 actions performed by or on this user account, including:
- Action type
- Entity affected
- Date and time
- IP address
