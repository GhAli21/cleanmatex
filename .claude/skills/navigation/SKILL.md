# Navigation Tree (sys_components_cd) Skill

**When to use:** Adding or updating navigation items in `sys_components_cd`, creating a new dashboard page/route, registering a UI screen in the sys tree, or editing `docs/navigation/add_sys_comp.sql`. Load this skill when implementing new features that add new pages so the nav entry is created correctly.

## Table and key columns

- **Table:** `sys_components_cd` (public, no tenant_org_id).
- **Unique key:** `comp_code` (AK_SYS_COMP_CODE).
- **Parent:** `parent_comp_id` (FK to sys_components_cd.comp_id), `parent_comp_code` (text, for scripts).
- **Leaf vs node:** `is_leaf` (true = leaf screen, false = has children), `is_navigable` (true = clickable route).
- **Hierarchy:** `comp_level` (0 = root, 1 = under root; derive from parent if deeper).
- **Order:** `display_order` (integer; sort siblings by this).

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

## SQL script pattern (add_sys_comp.sql)

- Use `INSERT INTO sys_components_cd (...) VALUES (...) ON CONFLICT (comp_code) DO UPDATE SET ...`.
- Then: `UPDATE sys_components_cd c SET parent_comp_id = p.comp_id FROM sys_components_cd p WHERE c.comp_code = :new_comp_code AND c.parent_comp_code = :parent_comp_code AND p.comp_code = :parent_comp_code`.
- Append new blocks to `docs/navigation/add_sys_comp.sql`; do not remove existing ones.

## Update flow

- Load by `comp_id` or `comp_code`. If changing parent, re-resolve `parent_comp_code` → `parent_comp_id` and `comp_level`. Prevent cycles (new parent ≠ self). Optionally: if old parent has no other children, set old parent `is_leaf = true`; ensure new parent has `is_leaf = false`.

## Delete flow

- first confirm with me if i am sure to delete otherwise do not delete
- even if i confirm do not delete just provide the script for deleting in seperate file
- Check children: `SELECT 1 FROM sys_components_cd WHERE parent_comp_id = :id`. If any, refuse delete ("Delete children first"). Else delete by `comp_id`. Optionally set parent's `is_leaf = true` if it has no children left.

## References

- Schema: `supabase/migrations/0058_sys_components_cd_navigation.sql`
- Example scripts: `docs/navigation/add_sys_comp.sql`, `supabase/migrations/0059_navigation_seed.sql`
- API create/update: `web-admin/app/api/navigation/components/route.ts`, `web-admin/app/api/navigation/components/[id]/route.ts`
- Tree build: `web-admin/lib/services/navigation.service.ts`
