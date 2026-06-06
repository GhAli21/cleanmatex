-- =============================================================================
-- 0349_ntf_permissions_and_nav.sql
-- Purpose: Notification Hub – permissions seed and navigation dual-write.
--          Adds sys_auth_permissions, role assignments, and sys_components_cd
--          entries for the notifications section and its child pages.
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. Permissions
-- =============================================================================

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  (
    'notifications:read',
    'View Notifications',
    'عرض الإشعارات',
    'crud',
    'View own notifications in the bell and notification center',
    'عرض الإشعارات الخاصة في الجرس ومركز الإشعارات',
    'Notifications', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'notifications:manage',
    'Manage Notifications',
    'إدارة الإشعارات',
    'actions',
    'Mark notifications as read, manage personal channel preferences',
    'تحديد الإشعارات كمقروءة وإدارة تفضيلات القنوات الشخصية',
    'Notifications', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'notifications:view_log',
    'View Delivery Log',
    'عرض سجل التسليم',
    'crud',
    'View notification delivery log and dispatch history',
    'عرض سجل تسليم الإشعارات وتاريخ الإرسال',
    'Notifications', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'notifications:configure',
    'Configure Notification Channels',
    'تكوين قنوات الإشعارات',
    'management',
    'Enable or disable notification channels and configure quiet hours for the tenant',
    'تفعيل أو تعطيل قنوات الإشعارات وتكوين ساعات الهدوء للمستأجر',
    'Notifications', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'notifications:send_test',
    'Send Test Notification',
    'إرسال إشعار تجريبي',
    'actions',
    'Send a test notification to verify channel configuration',
    'إرسال إشعار تجريبي للتحقق من تكوين القناة',
    'Notifications', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 1. Role default permissions
-- =============================================================================

-- notifications:read + notifications:manage → all roles
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'operator', 'viewer')
  AND p.code IN ('notifications:read', 'notifications:manage')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- notifications:view_log → admin and above + branch_manager
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager')
  AND p.code = 'notifications:view_log'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- notifications:configure + notifications:send_test → admin and above only
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN ('notifications:configure', 'notifications:send_test')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- =============================================================================
-- 2. sys_components_cd — Notifications section (top-level)
-- =============================================================================

INSERT INTO public.sys_components_cd (
  comp_code,        parent_comp_code,
  label,            label2,
  description,      description2,
  comp_path,        comp_icon,
  comp_level,       display_order,
  is_leaf,          is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,            main_permission_code,       rec_status
) VALUES (
  'notifications',  NULL,
  'Notifications',  'الإشعارات',
  'Notification center, delivery log, and channel settings',
  'مركز الإشعارات وسجل التسليم وإعدادات القنوات',
  NULL,             'Bell',
  0,                25,
  false,            false,   true,   true,   true,
  '["super_admin","tenant_admin","admin","branch_manager","operator","viewer"]'::jsonb,
  'notifications:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_icon            = EXCLUDED.comp_icon,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- =============================================================================
-- 3. sys_components_cd — Notification Center page
-- =============================================================================

INSERT INTO public.sys_components_cd (
  comp_code,              parent_comp_code,
  label,                  label2,
  description,            description2,
  comp_path,              comp_icon,
  comp_level,             display_order,
  is_leaf,                is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,                  main_permission_code,       rec_status
) VALUES (
  'notifications_center', 'notifications',
  'Notification Center',  'مركز الإشعارات',
  'View and manage all notifications',
  'عرض وإدارة جميع الإشعارات',
  '/dashboard/notifications', 'Bell',
  1,                      1,
  true,                   true,   true,   true,   true,
  '["super_admin","tenant_admin","admin","branch_manager","operator","viewer"]'::jsonb,
  'notifications:read', 1
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

-- =============================================================================
-- 4. sys_components_cd — Delivery Log page
-- =============================================================================

INSERT INTO public.sys_components_cd (
  comp_code,                  parent_comp_code,
  label,                      label2,
  description,                description2,
  comp_path,                  comp_icon,
  comp_level,                 display_order,
  is_leaf,                    is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,                      main_permission_code,       rec_status
) VALUES (
  'notifications_delivery_log', 'notifications',
  'Delivery Log',             'سجل التسليم',
  'View notification delivery attempts and channel dispatch history',
  'عرض محاولات تسليم الإشعارات وتاريخ إرسال القنوات',
  '/dashboard/notifications/delivery-log', 'FileText',
  1,                          2,
  true,                       true,   true,   true,   true,
  '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
  'notifications:view_log', 1
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

-- =============================================================================
-- 5. sys_components_cd — Channel Settings page
-- =============================================================================

INSERT INTO public.sys_components_cd (
  comp_code,                  parent_comp_code,
  label,                      label2,
  description,                description2,
  comp_path,                  comp_icon,
  comp_level,                 display_order,
  is_leaf,                    is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,                      main_permission_code,       rec_status
) VALUES (
  'notifications_settings',   'notifications',
  'Channel Settings',         'إعدادات القنوات',
  'Enable channels, configure quiet hours and tenant notification preferences',
  'تفعيل القنوات وتكوين ساعات الهدوء وتفضيلات الإشعارات للمستأجر',
  '/dashboard/notifications/settings', 'Settings',
  1,                          3,
  true,                       true,   true,   true,   true,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  'notifications:configure', 1
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

-- =============================================================================
-- 6. Resolve parent_comp_id for all notifications children
-- =============================================================================

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE p.comp_code = 'notifications'
  AND c.parent_comp_code = 'notifications'
  AND c.comp_code IN (
    'notifications_center',
    'notifications_delivery_log',
    'notifications_settings'
  )
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

COMMIT;
