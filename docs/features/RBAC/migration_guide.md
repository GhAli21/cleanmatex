# RBAC Migration Guide

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Steps](#migration-steps)
4. [Post-Migration Verification](#post-migration-verification)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide walks you through migrating from the old role system (`admin`, `operator`, `viewer` in `org_users_mst.role`) to the new RBAC system with granular permissions.

### What Changes

**Before:**

- Single role per user (`admin`, `operator`, `viewer`)
- Hard-coded role checks in code
- Limited flexibility

**After:**

- Multiple roles per user
- Granular permissions (`resource:action`)
- Custom roles support
- Resource-scoped permissions
- Workflow roles separate from regular roles

### Migration Mapping

| Old Role   | New Role Code  | Description             |
| ---------- | -------------- | ----------------------- |
| `admin`    | `tenant_admin` | Full tenant access      |
| `operator` | `operator`     | Operational permissions |
| `viewer`   | `viewer`       | Read-only access        |

---

## Pre-Migration Checklist

### 1. Backup Database

```sql
-- Create backup of critical tables
pg_dump -h localhost -U postgres -d cleanmatex -t org_users_mst > backup_org_users_mst.sql
pg_dump -h localhost -U postgres -d cleanmatex -t org_auth_user_roles > backup_org_auth_user_roles.sql
```

### 2. Verify Migrations Applied

Ensure all RBAC migrations are applied:

```sql
-- Check migration status
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%rbac%'
ORDER BY applied_at;
```

Required migrations:

- `0034_rbac_foundation.sql` - Core tables
- `0035_rbac_seed_system_data.sql` - System data
- `0036_rbac_rls_functions.sql` - RLS functions
- `0037_rbac_migration_functions.sql` - Migration functions

### 3. Check Current Users

```sql
-- Count users to migrate
SELECT role, COUNT(*)
FROM org_users_mst
WHERE is_active = true
GROUP BY role;
```

### 4. Verify System Roles Exist

```sql
-- Check system roles
SELECT code, name, is_system
FROM sys_auth_roles
WHERE is_system = true;
```

Expected roles:

- `super_admin`
- `tenant_admin`
- `branch_manager`
- `operator`
- `viewer`

---

## Migration Steps

### Step 1: Run Migration Function

The migration function automatically converts existing users:

```sql
-- Run migration
SELECT * FROM migrate_users_to_rbac();
```

**Output:**

```
user_id | tenant_org_id | old_role | new_role_code | migrated
---------+---------------+----------+---------------+----------
uuid-1   | uuid-tenant-1 | admin    | tenant_admin  | true
uuid-2   | uuid-tenant-1 | operator | operator      | true
uuid-3   | uuid-tenant-2 | viewer   | viewer        | true
```

### Step 2: Verify Migration Results

```sql
-- Check migration status
SELECT * FROM check_rbac_migration_status();
```

**Expected Output:**

```
total_users | migrated_users | pending_users | migration_complete
------------+----------------+---------------+-------------------
100         | 100            | 0             | true
```

### Step 3: Verify User Role Assignments

```sql
-- Check user role assignments
SELECT
  oum.user_id,
  oum.display_name,
  oum.role AS old_role,
  sr.code AS new_role_code,
  sr.name AS new_role_name
FROM org_users_mst oum
LEFT JOIN org_auth_user_roles oaur ON oaur.user_id = oum.user_id
LEFT JOIN sys_auth_roles sr ON sr.role_id = oaur.role_id
WHERE oum.is_active = true
ORDER BY oum.tenant_org_id, oum.display_name;
```

### Step 4: Verify Effective Permissions

```sql
-- Check effective permissions for a user
SELECT
  permission_code,
  resource_type,
  resource_id,
  allow
FROM cmx_effective_permissions
WHERE user_id = 'user-uuid-here'
  AND tenant_org_id = 'tenant-uuid-here'
ORDER BY permission_code;
```

### Step 5: Test Permission Checks

```sql
-- Test permission check function
SELECT has_permission('orders:create');
SELECT has_permission('orders:read');
SELECT has_permission('settings:manage');
```

---

## Post-Migration Verification

### 1. Verify Users Can Log In

Test login for users with different roles:

- Tenant admin
- Operator
- Viewer

### 2. Test Permission Checks

**Frontend:**

```typescript
// Test permission hooks
const canCreate = useHasPermission("orders", "create");
const canRead = useHasPermission("orders", "read");
```

**Backend:**

```typescript
// Test API permission checks
await requirePermission("orders", "create");
```

### 3. Verify Role-Based UI

- Admin users should see all menu items
- Operator users should see operational items
- Viewer users should see read-only items

### 4. Check Workflow Roles

If you have workflow roles assigned:

```sql
-- Check workflow role assignments
SELECT
  uwr.user_id,
  uwr.workflow_role,
  uwr.is_active
FROM org_auth_user_workflow_roles uwr
WHERE uwr.tenant_org_id = 'tenant-uuid-here';
```

### 5. Monitor Performance

```sql
-- Check permission rebuild performance
EXPLAIN ANALYZE
SELECT * FROM cmx_effective_permissions
WHERE user_id = 'user-uuid-here';
```

---

## Rollback Procedure

If you need to rollback the migration:

### Step 1: Backup Current State

```sql
-- Backup new RBAC data
pg_dump -h localhost -U postgres -d cleanmatex -t org_auth_user_roles > backup_org_auth_user_roles_after.sql
```

### Step 2: Remove RBAC Assignments

```sql
-- Remove RBAC role assignments (keep old roles in org_users_mst)
DELETE FROM org_auth_user_roles;
DELETE FROM org_auth_user_workflow_roles;
DELETE FROM cmx_effective_permissions;
```

### Step 3: Verify Old Roles Still Exist

```sql
-- Verify old roles are still in org_users_mst
SELECT user_id, role, is_active
FROM org_users_mst
WHERE is_active = true;
```

### Step 4: Update Code

Revert code changes that use new RBAC system:

- Restore old role checks
- Remove permission checks
- Restore old navigation filtering

**Note:** This is a destructive rollback. Only use if absolutely necessary.

---

## Troubleshooting

### Issue: Migration Function Returns No Rows

**Problem:** `migrate_users_to_rbac()` returns empty result.

**Solution:**

1. Check if users already have RBAC roles:

```sql
SELECT COUNT(*) FROM org_auth_user_roles;
```

2. If users already migrated, that's why it returns empty.

3. If not migrated, check user roles:

```sql
SELECT role, COUNT(*)
FROM org_users_mst
WHERE is_active = true
GROUP BY role;
```

### Issue: Users Missing Permissions

**Problem:** Users cannot access features they should have access to.

**Solution:**

1. Rebuild permissions for affected users:

```sql
SELECT cmx_rebuild_user_permissions('user-uuid', 'tenant-uuid');
```

2. Verify role assignments:

```sql
SELECT * FROM org_auth_user_roles
WHERE user_id = 'user-uuid';
```

3. Check role permissions:

```sql
SELECT sp.code
FROM org_auth_user_roles oaur
JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = oaur.role_id
JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
WHERE oaur.user_id = 'user-uuid';
```

### Issue: Migration Function Errors

**Problem:** Migration function throws errors.

**Common Errors:**

1. **"Role not found"**

   - Solution: Ensure system roles are seeded:

   ```sql
   SELECT * FROM sys_auth_roles WHERE is_system = true;
   ```

2. **"Duplicate key violation"**

   - Solution: Users already migrated. Check:

   ```sql
   SELECT * FROM org_auth_user_roles;
   ```

3. **"Permission rebuild failed"**
   - Solution: Check RLS functions exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'cmx_rebuild_user_permissions';
   ```

### Issue: Performance Degradation

**Problem:** System is slower after migration.

**Solution:**

1. Check indexes on `cmx_effective_permissions`:

```sql
SELECT * FROM pg_indexes WHERE tablename = 'cmx_effective_permissions';
```

2. Verify effective permissions are being used:

```sql
EXPLAIN ANALYZE
SELECT * FROM cmx_effective_permissions
WHERE user_id = 'user-uuid' AND permission_code = 'orders:read';
```

3. Rebuild permissions if needed:

```sql
-- Rebuild for all users (run during maintenance window)
SELECT cmx_rebuild_user_permissions(user_id, tenant_org_id)
FROM (SELECT DISTINCT user_id, tenant_org_id FROM org_auth_user_roles) AS users;
```

---

## Migration Checklist

Use this checklist to ensure complete migration:

- [ ] Database backup created
- [ ] All RBAC migrations applied
- [ ] System roles verified
- [ ] Migration function executed
- [ ] Migration status verified
- [ ] User role assignments verified
- [ ] Effective permissions verified
- [ ] Permission checks tested
- [ ] User login tested
- [ ] Role-based UI verified
- [ ] Workflow roles checked (if applicable)
- [ ] Performance monitored
- [ ] Documentation updated

---

## Post-Migration Tasks

### 1. Update Code

Replace old role checks with permission checks:

**Before:**

```typescript
if (userRole === "admin") {
  // do something
}
```

**After:**

```typescript
const canManage = useHasPermission("settings", "manage");
if (canManage) {
  // do something
}
```

### 2. Train Users

- Explain new permission system
- Show how to assign roles
- Demonstrate workflow roles

### 3. Monitor Usage

- Track permission checks
- Monitor performance
- Collect user feedback

### 4. Create Custom Roles

- Identify common permission sets
- Create custom roles for specific job functions
- Assign custom roles to users

---

## Support

If you encounter issues during migration:

1. **Check this guide** for common problems
2. **Review migration logs** for errors
3. **Contact development team** for assistance
4. **Refer to developer documentation** for technical details

---

**Version:** v1.0.0 | **Last Updated:** 2025-01-XX
