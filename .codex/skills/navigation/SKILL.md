# Navigation Tree (sys_components_cd) Skill

**When to use:** Adding or updating navigation items in `sys_components_cd`, creating a new dashboard page/route, registering a UI screen in the sys tree, or editing `docs/navigation/add_sys_comp.sql`. Load this skill when implementing new features that add new pages so the nav entry is created correctly.

## ⚠️ MANDATORY DUAL-WRITE — No Exceptions

Every navigation add or modify requires **both** of the following steps. Doing only one is incomplete and will cause sidebar/DB drift:

| Step | What | File |
|------|------|------|
| 1 | Update the **frontend sidebar** | `web-admin/config/navigation.ts` |
| 2 | Generate a **DB migration** for `sys_components_cd` | new `supabase/migrations/{next_seq}_nav_*.sql` |

The two must stay in sync. `navigation.ts` drives the React sidebar; `sys_components_cd` drives RBAC, permission checks, and the navigation API. Neither is optional.

## Table and key columns

- **Table:** `sys_components_cd` (public, no tenant_org_id).
- **Unique key:** `comp_code` (AK_SYS_COMP_CODE).
- **Parent:** `parent_comp_id` (FK to sys_components_cd.comp_id), `parent_comp_code` (text, for scripts).
- **Leaf vs node:** `is_leaf` (true = leaf screen, false = has children), `is_navigable` (true = clickable route).
- **Hierarchy:** `comp_level` (0 = root, 1 = under root; derive from parent if deeper).
- **Order:** `display_order` (integer; sort siblings by this).
- **Bilingual (mandatory):** `label` (EN), `label2` (AR), `description` (EN), `description2` (AR) — all four must be set on every INSERT and included in every UPDATE that touches label/description. Never leave `label2`, `description`, or `description2` as NULL when inserting a new row.

## Flow: Add or update an item

1. **Check existence by `comp_code`**
   - Query: `SELECT comp_id, comp_code, parent_comp_id, is_leaf, comp_level FROM sys_components_cd WHERE comp_code = :comp_code`.
   - If exists → treat as update (or use `ON CONFLICT (comp_code) DO UPDATE` in SQL).
   - If not exists → insert.

2. **Decide leaf vs node**
   - **Leaf screen:** real route (e.g. `/dashboard/settings/finance`). Set `is_leaf = true`, `is_navigable = true` (or false for non-navigable refs like dynamic `[id]` routes).
   - **Node (group):** has children. Set `is_leaf = false`. When adding the first child, set parent's `is_leaf = false`.

3. **Resolve parent**
   - No parent: `parent_comp_code` / `parent_comp_id` = NULL, `comp_level = 0`.
   - With parent: `SELECT comp_id FROM sys_components_cd WHERE comp_code = :parent_comp_code`. Use that as `parent_comp_id`; set `comp_level = 1` (or parent's level + 1). If parent not found, fail or create parent first.

4. **After INSERT (when using parent_comp_code only)**
   - Run UPDATE to set `parent_comp_id` from `sys_components_cd` where `parent_comp_code` matches (see `docs/navigation/add_sys_comp.sql`).

5. **After INSERT of a child**
   - Update parent: `UPDATE sys_components_cd SET is_leaf = false WHERE comp_id = :parent_comp_id`.

6. **Display order**
   - Set `display_order` consistently among siblings (0, 1, 2…). Top-level: align with existing roots (e.g. home=0, orders=1).

7. **Permissions**
   - Set `main_permission_code`, `roles` (JSONB array), and optionally `feature_flag` so RLS and `get_navigation_with_parents_jh` show the item correctly.

8. **Frontend sidebar (navigation.ts)**
   - Add the new screen to `web-admin/config/navigation.ts` so it appears in the sidebar. See "Frontend sidebar: web-admin/config/navigation.ts" below.

## SQL script pattern (add_sys_comp.sql)

- Use `INSERT INTO sys_components_cd (...) VALUES (...) ON CONFLICT (comp_code) DO UPDATE SET ...`.
- Always include `label, label2, description, description2` in the column list and `ON CONFLICT DO UPDATE SET`.
- Then: `UPDATE sys_components_cd c SET parent_comp_id = p.comp_id FROM sys_components_cd p WHERE c.comp_code = :new_comp_code AND c.parent_comp_code = :parent_comp_code AND p.comp_code = :parent_comp_code`.
- Append new blocks to `docs/navigation/add_sys_comp.sql`; do not remove existing ones.

### Canonical migration structure (follow 0251 / 0275 as the reference)

Order of sections in every navigation+permissions migration:

```
0. sys_auth_permissions INSERT   (ON CONFLICT DO NOTHING)
1. sys_auth_role_default_permissions INSERT  (NOT EXISTS, CROSS JOIN)
2. sys_components_cd parent INSERT/UPDATE
3. sys_components_cd children INSERT/UPDATE
4. Resolve parent_comp_id UPDATE
5. Ensure parent is_leaf = false UPDATE
```

#### sys_auth_permissions INSERT template

```sql
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('feature:read', 'View Feature', 'عرض الميزة', 'crud',
   'View feature data', 'عرض بيانات الميزة',
   'CategoryName', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;
```

#### sys_auth_role_default_permissions INSERT template (NOT EXISTS pattern)

```sql
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'operator')
  AND p.code IN ('feature:read', 'feature:write')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );
```

- Use **separate INSERT blocks per role group** when different roles get different permission subsets.
- `CROSS JOIN` silently produces no rows when a role does not yet exist — safe for roles like `admin` that may be added later.
- **Never use `ON CONFLICT DO NOTHING`** on `sys_auth_role_default_permissions` — use `NOT EXISTS` instead (matches the project canonical pattern).

#### sys_components_cd INSERT template

```sql
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'comp_code_here', 'parent_code_or_null',
  'English Label', 'التسمية بالعربية',
  'English description', 'الوصف بالعربية',
  '/dashboard/path', 'LucideIconName',
  1, 0,
  true, true, true, true, true,
  '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb, 'permission:code', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;
```

#### parent_comp_id resolution + is_leaf enforcement (always last)

```sql
-- Resolve parent_comp_id for all children of 'parent_code'
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'parent_code'
  AND p.comp_code = 'parent_code'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- Ensure parent is flagged as a node
UPDATE sys_components_cd SET is_leaf = false WHERE comp_code = 'parent_code';
```

**Reference migrations:** `0251_marketing_gifts_promotions_navigation_and_permissions.sql`, `0275_nav_customer_management_section.sql`

## Convert leaf to section (add children to a flat item)

When a flat `is_leaf = true` item needs to become an expandable section with children:

**DB migration steps:**
1. `UPDATE sys_components_cd SET label = :new_label, label2 = :new_label_ar, description = :desc, description2 = :desc_ar, is_leaf = false, updated_at = NOW() WHERE comp_code = :comp_code;`
2. Insert each child with `parent_comp_code = :comp_code`, `comp_level = parent_level + 1`, own `display_order` starting at 0.
3. Run the parent_comp_id resolution UPDATE for each child.

**navigation.ts steps:**
1. Change the flat entry to have a `children` array.
2. Move the original path into the first child (e.g. `customers_list` → `/dashboard/customers`).
3. The parent entry keeps the same `path` (used as the expand toggle root, not a direct link).

**Rename label at the same time:** update both `navigation.ts` label and the DB `label` column in the same migration so they stay in sync.

## Update flow

- Load by `comp_id` or `comp_code`. If changing parent, re-resolve `parent_comp_code` → `parent_comp_id` and `comp_level`. Prevent cycles (new parent ≠ self). Optionally: if old parent has no other children, set old parent `is_leaf = true`; ensure new parent has `is_leaf = false`.
- Always include `updated_at = NOW()` in UPDATE statements.
- Always include `label2`, `description`, `description2` in UPDATE SET when touching label or description fields.

## Delete flow

- first confirm with me if i am sure to delete otherwise do not delete
- even if i confirm do not delete just provide the script for deleting in seperate file
- Check children: `SELECT 1 FROM sys_components_cd WHERE parent_comp_id = :id`. If any, refuse delete ("Delete children first"). Else delete by `comp_id`. Optionally set parent's `is_leaf = true` if it has no children left.

## Migration file

- Find next sequence: `Get-ChildItem supabase/migrations/ -Filter "*.sql" | Where-Object { $_.Name -match "^\d{4}_" } | Sort-Object Name | Select-Object -Last 3` — take the number after the last one.
- Name pattern: `{seq}_nav_{short_description}.sql` (e.g. `0275_nav_customer_management_section.sql`).
- Wrap in a transaction: start with `BEGIN;`, end with `COMMIT;`.

## Frontend sidebar: web-admin/config/navigation.ts

When adding a new UI screen, **also add it to the frontend sidebar** so it appears in the web-admin sidebar. The file `web-admin/config/navigation.ts` defines `NAVIGATION_SECTIONS` (sidebar structure).

### UserRole type — keep in sync with sys_auth_roles

`UserRole` at the top of `navigation.ts` must include every role code that exists in `sys_auth_roles`. When adding a new role to the DB, add it here too:

```ts
export type UserRole = 'super_admin' | 'tenant_admin' | 'admin' | 'branch_manager' | 'operator' | 'viewer' | 'none'
```

`'none'` is a placeholder for sections with no role gate (permission-only). Never remove it.

### Roles arrays must match the migration JSONB

The `roles` array in `navigation.ts` and the `roles` JSONB column in `sys_components_cd` must list the **same set of role codes**. Drift between them causes the sidebar to show/hide items inconsistently with the DB-driven RBAC. Always update both in the same change.

### Structure

- **NavigationSection** (parent): `key`, `label`, `icon`, `path`, `roles`, `permissions`, `featureFlag`, `children`
- **NavigationItem** (child): `key`, `label`, `path`, `roles`, `permissions`, `featureFlag`

### Mapping from sys_components_cd

| sys_components_cd | navigation.ts |
|------------------|---------------|
| `comp_code` | `key` |
| `label` | `label` |
| `comp_path` | `path` |
| `roles` (JSONB array) | `roles` (e.g. `['admin','super_admin','tenant_admin','operator']`) |
| `main_permission_code` | `permissions` (e.g. `['config:preferences_manage']`) |
| `feature_flag` (JSONB array) | `featureFlag` (e.g. `FLAG_KEYS.ADVANCED_ANALYTICS`) |
| `comp_icon` | Lucide icon name (import from `lucide-react`) |

### Flow: Add a new screen to navigation.ts

1. **Identify parent section** — Find the `NAVIGATION_SECTIONS` entry whose `key` matches the parent `comp_code` (e.g. `catalog`, `billing`, `settings`).
2. **Child screen** — Add a new object to the parent's `children` array:
   ```ts
   {
     key: 'parent_child_name',   // matches comp_code
     label: 'Screen Label',
     path: '/dashboard/parent/child-path',
     roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
     permissions: ['permission:code'],  // optional
     featureFlag: FLAG_KEYS.SOME_FLAG,   // optional
   },
   ```
3. **New top-level section** — Add a new object to `NAVIGATION_SECTIONS` with `icon` (import from `lucide-react`), `path`, `roles`, and optionally `children`.
4. **Display order** — Insert the new item in the correct position among siblings (same order as `display_order` in sys_components_cd).
5. **i18n** — Prefer translation keys for labels; if using hardcoded labels, add keys to `web-admin/messages/en/navigation.json` and `web-admin/messages/ar/navigation.json` and use `t('catalog.customerCategories')` etc. where applicable.

### Example (child under catalog)

```ts
{
  key: 'catalog_customer_categories',
  label: 'Customer Categories',
  path: '/dashboard/catalog/customer-categories',
  roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
  permissions: ['config:preferences_manage'],
},
```

## Navigation ↔ access contract sync

Menu-visible routes: **`navigation.ts` permissions MUST match** `*-access.ts` `page.permissions` (dual-write with `sys_components_cd`).

When `*-access.ts` is missing or empty for an existing route, **`derive --apply` reads `navigation.ts`** to fill `page.permissions` and `featureFlags` — so update navigation **first**, then run derive.

After nav + contract edits:

```bash
npm run check:ui-access-contract -- --route=/dashboard/... --wire
npm run sync:ui-access-contract
```

## References

- Schema: `supabase/migrations/0058_sys_components_cd_navigation.sql`
- Example scripts: `docs/navigation/add_sys_comp.sql`, `supabase/migrations/0059_navigation_seed.sql`
- API create/update: `web-admin/app/api/navigation/components/route.ts`, `web-admin/app/api/navigation/components/[id]/route.ts`
- Tree build: `web-admin/lib/services/navigation.service.ts`
- **Frontend sidebar:** `web-admin/config/navigation.ts`
