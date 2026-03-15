# create-ui-screen-in-sys-tree

When the user asks to add a new UI screen or page to the navigation tree:

1. **Use the Navigation Tree (sys_components_cd) skill** (`.claude/skills/navigation/SKILL.md`): follow the flow for add/update (check existence by comp_code, leaf vs node, resolve parent, set display_order and permissions).

2. **Produce an INSERT statement** for `sys_components_cd` for the new route/page, with:
   - `comp_code`, `parent_comp_code`, `label`, `label2`, `description`, `description2`, `comp_path`, `comp_icon`, `comp_level`, `display_order`, `is_leaf`, `is_navigable`, `is_active`, `main_permission_code`, `roles`, and other fields as in `docs/navigation/add_sys_comp.sql`.

3. **Include the follow-up UPDATE** that sets `parent_comp_id` from `parent_comp_code` (same pattern as in `add_sys_comp.sql`).

4. **Append** the new block (INSERT + UPDATE) to `docs/navigation/add_sys_comp.sql`; do not remove or overwrite existing blocks.

5. If the new item is a child, ensure the parent's `is_leaf` is set to false (add UPDATE for parent if needed).

6. **Add the screen to the frontend sidebar** in `web-admin/config/navigation.ts`:
   - For a **child screen**: add a new `NavigationItem` to the parent section's `children` array. Match `key` to `comp_code`, `label` to `label`, `path` to `comp_path`, `roles` to roles, and `permissions` to `main_permission_code` (as array if present).
   - For a **new top-level section**: add a new `NavigationSection` to `NAVIGATION_SECTIONS` with `icon` (import from `lucide-react`), `path`, `roles`, and optionally `children`.
   - Insert in the correct position among siblings (align with `display_order`).
   - See the skill's "Frontend sidebar: web-admin/config/navigation.ts" section for mapping and examples.

This command is available in chat with /create-ui-screen-in-sys-tree.
