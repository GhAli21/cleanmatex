---
name: create-update-rbac-permission
description: Create or update system permission seed data and assign permissions to roles in `sys_auth_permissions` and `sys_auth_role_default_permissions`.
user-invocable: true
version: 1.0.0
deprecated: false
effort: medium
references:
  - @.claude/skills/update-rbac-role/reference-original.md
  - CLAUDE.md
agents:
---

# Create / Update RBAC Permission Skill

## Purpose

Use this skill only when the task explicitly involves:
- creating or updating permission definitions in `sys_auth_permissions`
- mapping permissions to role defaults in `sys_auth_role_default_permissions`
- enabling or disabling default permissions for system roles
- assigning permissions to specific roles or role groups
- handling one or many permissions in the same request
- generating the correct production-ready SQL seed block for a migration

## Operating Rules

- Do not modify existing migration files. Generate SQL script only by default; if the caller requests migration output, also return a filename suggestion and migration-ready SQL content.
- Preserve the CleanMateX Tenant App rules from `CLAUDE.md`.
- Always include `super_admin`, `tenant_admin`, and `admin` when enabling a new permission by default.
- Use `ON CONFLICT` for `sys_auth_permissions` metadata updates.
- Do not use `ON CONFLICT DO NOTHING` on `sys_auth_role_default_permissions`.
- Use role and permission codes only; do not introduce `role_id` or `permission_id` columns in new seed SQL.
- Keep the migration explicit: separate permission definition and role assignment sections.
- Support permission batches: one or many permissions may be seeded in the same request.
- Support role-specific assignment: include exact target role lists as requested.

## Workflow

1. Classify the task:
   - **Create permission** → add one or more new `sys_auth_permissions` rows.
   - **Update permission** → refresh metadata for one or more permissions in `sys_auth_permissions` using `ON CONFLICT`.
   - **Assign permission to roles** → update/insert defaults in `sys_auth_role_default_permissions` for specific role(s).
   - **Enable/disable role permission** → update existing mapping rows in `sys_auth_role_default_permissions`.

2. Confirm the permission code(s) are valid and follow the repository convention: `resource:action` or `resource:*`, lowercase letters, digits, and underscores only.

3. Generate the `sys_auth_permissions` SQL block.
   - For a new or updated permission, use `ON CONFLICT (code) DO UPDATE SET ...`.
   - Include bilingual values for `name/name2`, `description/description2`, and `category_main`.
   - Set audit fields consistently: `is_active`, `is_enabled`, `rec_status`, `created_at`, `created_by`, and update `updated_at` on conflict.

4. Generate `sys_auth_role_default_permissions` SQL blocks.
   - Use `UPDATE` for existing rows that should be enabled, disabled, or changed.
   - Use the canonical `INSERT ... SELECT ... CROSS JOIN ... NOT EXISTS` pattern for missing rows.
   - Always seed `super_admin`, `tenant_admin`, and `admin` for new permissions.
   - Use separate blocks when multiple role groups require different permission subsets.

5. Validate the migration output mentally and verify the role codes exist or may be created later.

6. Deliver the SQL script for the permission change.

7. If the caller requests migration output, include a filename suggestion and full migration-ready SQL content, with a descriptive SQL comment header.

8. If the caller only needs SQL, return only the SQL script with no file guidance.

## Canonical SQL Patterns

### Permission definition: insert or update

```sql
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'orders:transition',
  'Transition order status',
  'تغيير حالة الطلب',
  'orders',
  'Allow status transitions for an order',
  'السماح بتغيير حالة الطلب',
  'Orders',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  name2           = EXCLUDED.name2,
  category        = EXCLUDED.category,
  description     = EXCLUDED.description,
  description2    = EXCLUDED.description2,
  category_main   = EXCLUDED.category_main,
  is_active       = EXCLUDED.is_active,
  is_enabled      = EXCLUDED.is_enabled,
  rec_status      = EXCLUDED.rec_status,
  updated_at      = CURRENT_TIMESTAMP;
```

### Enable or update default permission for role(s)

Use `UPDATE` first when an existing row may already exist and should be enabled or re-enabled.

```sql
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = true,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code = 'orders:transition';
```

Then insert any missing rows using the canonical pattern:

```sql
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'orders:transition'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );
```

### Disable a default role permission

```sql
UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = false,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code = 'orders:transition';
```

### Insert missing default permissions for a mixed role set

If a permission should be enabled for multiple role groups with different scopes, create separate blocks.

```sql
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'operations_manager')
  AND p.code = 'orders:read'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );
```

## Role assignment rules

- Always seed `super_admin`, `tenant_admin`, and `admin` for new permission definitions.
- Use explicit role lists, not wildcard role groups, unless the feature requires one.
- Do not assume a role exists; the `CROSS JOIN` pattern is safe because it produces no rows when the role is missing.
- Do not create default permission rows for roles not intended to receive the permission.

## Multi-Permission and Role-Specific Handling

- Support batches of permission definitions in one migration file when the request includes multiple permission codes.
- For each permission, optionally assign it to a specific role list, in addition to the mandatory `super_admin`, `tenant_admin`, and `admin` seed placement.
- Use separate `INSERT ... SELECT ... CROSS JOIN ... NOT EXISTS` blocks for different role groups when requested role subsets vary.
- Use explicit `UPDATE` blocks when a role-specific mapping needs to be enabled, disabled, or corrected.

## Migration File Guidance

- The response should include SQL suitable for a new migration file under `supabase/migrations/`.
- Prefer migration file names like `{next_seq}_rbac_permissions_{feature_or_change}.sql`.
- Include a short SQL comment header describing the permission seed change, affected feature, and target roles.
- Ensure permission definitions appear before role mapping blocks in the migration.

## Example

Use a single migration when the request includes multiple permission definitions and role assignments.

```sql
-- Migration: add order transition and order refund permissions for selected roles
-- Feature: order workflow updates

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('orders:transition', 'Transition order status', 'تغيير حالة الطلب', 'orders',
   'Allow status transitions for an order', 'السماح بتغيير حالة الطلب',
   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:refund', 'Refund order', 'استرداد الطلب', 'orders',
   'Allow refund processing for an order', 'السماح بمعالجة رد الأموال للطلب',
   'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = true,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code IN ('orders:transition', 'orders:refund');

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'finance_manager', 'branch_manager')
  AND p.code IN ('orders:transition', 'orders:refund')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );
```

This example shows how to:
- define or update multiple permissions in one permission block
- enable them for the mandatory base roles
- assign them to additional specific roles in the same migration

## Notes

- This skill is for seed data and permission-role assignment only. It is not for runtime RBAC logic or frontend authorization code.
- Always document permission changes in the migration comment header and cross-reference the affected feature or screen.
- When in doubt, prefer explicit `UPDATE` + `INSERT` over `ON CONFLICT DO NOTHING` for `sys_auth_role_default_permissions`.

## Platform info inventories (conditional)

After creating or updating permission seed SQL:

1. Load **`/rebuild-platform-info-inventories`** — `Mode: refresh` · `Scope: surface=permission` · `permissionCode=<code>`
2. Run `npm run rebuild:platform-info-inventories`

Use **this skill** for permission definitions — not `/update-rbac-role`.

## Final response contract

- Summary
- Files changed
- Validation result
- Risks / follow-ups
