-- Migration 0385: Help — Platform Inventories read permission
-- Read-only access to the Platform Inventories Help viewer (contracts, flags, drift).

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'help:platform_inventories',
  'View Platform Inventories',
  'عرض مخزون المنصة',
  'actions',
  'Read-only access to platform gating inventories in Help (contracts, permissions, flags, navigation, drift)',
  'وصول للقراءة فقط لمخزون بوابات المنصة في المساعدة (العقود، الصلاحيات، العلامات، التنقل، الانحراف)',
  'Help',
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
)
ON CONFLICT (code) DO NOTHING;

-- Grant help:platform_inventories to every role in sys_auth_roles (system + tenant roles).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, 'help:platform_inventories', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
WHERE NOT EXISTS (
  SELECT 1 FROM public.sys_auth_role_default_permissions dp
  WHERE dp.role_code = r.code AND dp.permission_code = 'help:platform_inventories'
);

COMMIT;
