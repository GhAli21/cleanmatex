/*
  Migration: Config And Settings navigation parent
  Purpose: Reparent tenant runtime settings screens under a stable top-level
  navigation section that can accept future configuration pages.
  Note: Review-only migration file. Do not apply from Codex.
*/

BEGIN;

WITH upsert_parent AS (
  INSERT INTO sys_components_cd (
    comp_code,
    parent_comp_id,
    parent_comp_code,
    label,
    label2,
    comp_path,
    comp_icon,
    main_permission_code,
    display_order,
    comp_level,
    is_leaf,
    is_navigable,
    is_active,
    is_system,
    is_for_tenant_use,
    roles,
    permissions,
    feature_flag,
    badge,
    rec_status,
    created_info
  )
  VALUES (
    'config_settings',
    NULL,
    NULL,
    'Config And Settings',
    'الإعدادات والتكوين',
    '/dashboard/settings',
    'Settings2',
    NULL,
    COALESCE((SELECT display_order FROM sys_components_cd WHERE comp_code = 'settings' LIMIT 1), 900),
    0,
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    '["admin","super_admin","tenant_admin","operator"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    NULL,
    1,
    'Created by migration 0272 to make configuration pages a top-level navigation group.'
  )
  ON CONFLICT (comp_code) DO UPDATE
  SET
    label = EXCLUDED.label,
    label2 = EXCLUDED.label2,
    comp_path = EXCLUDED.comp_path,
    comp_icon = EXCLUDED.comp_icon,
    comp_level = 0,
    is_leaf = FALSE,
    is_navigable = TRUE,
    is_active = TRUE,
    updated_at = NOW(),
    updated_info = 'Updated by migration 0272 to align settings navigation parent.'
  RETURNING comp_id
)
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_id,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  main_permission_code,
  display_order,
  comp_level,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  permissions,
  feature_flag,
  badge,
  rec_status,
  created_info
)
VALUES
  ('settings_general', (SELECT comp_id FROM upsert_parent), 'config_settings', 'General', 'عام', '/dashboard/settings/general', 'Settings', 'settings:read', 0, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_all', (SELECT comp_id FROM upsert_parent), 'config_settings', 'All Settings', 'كل الإعدادات', '/dashboard/settings/allsettings', 'Settings', 'settings:read', 1, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_preferences', (SELECT comp_id FROM upsert_parent), 'config_settings', 'User Preferences', 'تفضيلات المستخدم', '/dashboard/settings/preferences', 'User', 'settings:read', 2, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin","operator","viewer"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_users', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Team Members', 'أعضاء الفريق', '/dashboard/settings/users', 'Users', 'settings:read', 3, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_roles', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Roles & Permissions', 'الأدوار والصلاحيات', '/dashboard/settings/roles', 'Settings2', 'settings:read', 4, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_permissions', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Permissions', 'الصلاحيات', '/dashboard/settings/permissions', 'Settings2', 'settings:read', 5, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_workflow_roles', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Workflow Roles', 'أدوار سير العمل', '/dashboard/settings/workflow-roles', 'ClipboardCheck', 'settings:workflow_roles:view', 6, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_branding', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Branding', 'الهوية البصرية', '/dashboard/settings/branding', 'Palette', 'settings:read', 7, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_subscription', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Subscription', 'الاشتراك', '/dashboard/settings/subscription', 'CreditCard', 'settings:read', 8, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin","viewer","operator"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_finance', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Finance', 'المالية', '/dashboard/settings/finance', 'DollarSign', 'settings:read', 9, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_payments', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Payment Setup', 'إعداد المدفوعات', '/dashboard/settings/payments', 'CreditCard', 'settings:read', 10, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_workflows', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Workflows', 'سير العمل', '/dashboard/settings/workflows', 'Workflow', 'settings:read', 11, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["admin","super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.'),
  ('settings_navigation', (SELECT comp_id FROM upsert_parent), 'config_settings', 'Navigation', 'التنقل', '/dashboard/settings/navigation', 'Navigation', 'settings:read', 12, 1, TRUE, TRUE, TRUE, TRUE, TRUE, '["super_admin","tenant_admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 1, 'Aligned by migration 0272 under Config And Settings.')
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id = EXCLUDED.parent_comp_id,
  parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order = EXCLUDED.display_order,
  comp_level = EXCLUDED.comp_level,
  is_leaf = TRUE,
  is_navigable = TRUE,
  is_active = TRUE,
  roles = EXCLUDED.roles,
  permissions = EXCLUDED.permissions,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = NOW(),
  updated_info = 'Aligned by migration 0272 under Config And Settings.';

UPDATE sys_components_cd
SET
  is_leaf = TRUE,
  is_navigable = FALSE,
  is_active = FALSE,
  updated_at = NOW(),
  updated_info = 'Deprecated by migration 0272; config_settings is the active settings parent.'
WHERE comp_code = 'settings'
  AND NOT EXISTS (
    SELECT 1
    FROM sys_components_cd child
    WHERE child.parent_comp_code = 'settings'
  );

COMMIT;
