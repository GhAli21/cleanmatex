# create-ui-screen-in-sys-tree

When the user asks to add a new UI screen or page to the navigation tree:

1. **Use the Navigation Tree (sys_components_cd) skill** (`.claude/skills/navigation/SKILL.md`): follow the flow for add/update (check existence by comp_code, leaf vs node, resolve parent, set display_order and permissions).

2. **Produce an INSERT statement** for `sys_components_cd` for the new route/page, with:
   - `comp_code`, `parent_comp_code`, `label`, `label2`, `description`, `description2`, `comp_path`, `comp_icon`, `comp_level`, `display_order`, `is_leaf`, `is_navigable`, `is_active`, `main_permission_code`, `roles`, and other fields as in `docs/navigation/add_sys_comp.sql`.

3. **Include the follow-up UPDATE** that sets `parent_comp_id` from `parent_comp_code` (same pattern as in `add_sys_comp.sql`).

4. **Append** the new block (INSERT + UPDATE) to `docs/navigation/add_sys_comp.sql`; do not remove or overwrite existing blocks.

5. If the new item is a child, ensure the parent's `is_leaf` is set to false (add UPDATE for parent if needed).

This command is available in chat with /create-ui-screen-in-sys-tree.
