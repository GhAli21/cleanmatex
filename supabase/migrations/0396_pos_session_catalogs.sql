-- =============================================================================
-- 0396_pos_session_catalogs.sql
-- POS Session Management v1 — system catalogs, permissions, and component seed.
-- Phase 1 is schema/documentation only. No runtime wiring is introduced here.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. POS session status catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_pos_session_status_cd (
  code           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name2          TEXT,
  description    TEXT,
  description2   TEXT,
  is_final       BOOLEAN NOT NULL DEFAULT FALSE,
  display_order  INTEGER,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status     SMALLINT NOT NULL DEFAULT 1,
  rec_order      INTEGER,
  rec_notes      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT
);

INSERT INTO public.sys_pos_session_status_cd (
  code, name, name2, description, description2,
  is_final, display_order, is_active, rec_status, created_at, created_by
) VALUES
  ('OPEN',         'Open',         'مفتوحة',      'Active POS session ready for use',          'جلسة نقطة بيع نشطة وجاهزة للاستخدام',            FALSE, 10, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('PAUSED',       'Paused',       'موقوفة',      'Temporarily paused POS session',            'جلسة نقطة بيع موقوفة مؤقتاً',                    FALSE, 20, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('CLOSED',       'Closed',       'مغلقة',       'Normally closed POS session',               'جلسة نقطة بيع مغلقة بشكل طبيعي',                 TRUE,  30, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('FORCE_CLOSED', 'Force Closed', 'مغلقة إجبارياً', 'Force-closed POS session for exception handling', 'جلسة نقطة بيع أغلقت إجباريًا لمعالجة حالة استثنائية', TRUE,  40, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  is_final      = EXCLUDED.is_final,
  display_order = EXCLUDED.display_order,
  is_active     = EXCLUDED.is_active,
  rec_status    = EXCLUDED.rec_status;

-- -----------------------------------------------------------------------------
-- 2. POS session event type catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_pos_session_event_type_cd (
  code           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name2          TEXT,
  description    TEXT,
  description2   TEXT,
  display_order  INTEGER,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  rec_status     SMALLINT NOT NULL DEFAULT 1,
  rec_order      INTEGER,
  rec_notes      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  created_info   TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT,
  updated_info   TEXT
);

INSERT INTO public.sys_pos_session_event_type_cd (
  code, name, name2, description, description2,
  display_order, is_active, rec_status, created_at, created_by
) VALUES
  ('OPEN',             'Open',             'فتح',                  'Manual open of a POS session',                         'فتح يدوي لجلسة نقطة بيع',                                10, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('AUTO_OPEN',        'Auto Open',        'فتح تلقائي',            'Automatic POS session creation during POS entry',      'إنشاء تلقائي لجلسة نقطة بيع عند دخول مسار نقطة البيع',  20, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('PAUSE',            'Pause',            'إيقاف مؤقت',           'Pause an active POS session',                          'إيقاف مؤقت لجلسة نقطة بيع نشطة',                         30, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('RESUME',           'Resume',           'استئناف',              'Resume a paused POS session',                          'استئناف جلسة نقطة بيع موقوفة',                            40, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('CLOSE',            'Close',            'إغلاق',                'Normal close of a POS session',                        'إغلاق طبيعي لجلسة نقطة بيع',                             50, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('FORCE_CLOSE',      'Force Close',      'إغلاق إجباري',         'Exception close of a POS session',                     'إغلاق استثنائي لجلسة نقطة بيع',                           60, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('AUTO_LINK_DRAWER', 'Auto Link Drawer', 'ربط الصندوق تلقائياً', 'Attach a drawer session to a POS session automatically', 'ربط جلسة صندوق نقدي بجلسة نقطة بيع تلقائياً',           70, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  is_active     = EXCLUDED.is_active,
  rec_status    = EXCLUDED.rec_status;

-- -----------------------------------------------------------------------------
-- 3. Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('pos_session:view',         'View Own POS Session',         'عرض جلسة نقطة البيع الخاصة بي',      'crud',    'View the current user POS session context',                           'عرض سياق جلسة نقطة البيع الخاصة بالمستخدم الحالي',                'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:view_all',     'View All POS Sessions',        'عرض جميع جلسات نقطة البيع',          'crud',    'View branch or tenant POS session history and summaries',            'عرض سجل وملخصات جلسات نقطة البيع على مستوى الفرع أو المستأجر',   'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:open',         'Open POS Session',             'فتح جلسة نقطة البيع',                'actions', 'Open a POS session for the current user',                            'فتح جلسة نقطة بيع للمستخدم الحالي',                               'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:pause_resume', 'Pause or Resume POS Session',  'إيقاف أو استئناف جلسة نقطة البيع',   'actions', 'Pause or resume the current user POS session',                       'إيقاف أو استئناف جلسة نقطة البيع الخاصة بالمستخدم الحالي',        'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:close',        'Close POS Session',            'إغلاق جلسة نقطة البيع',              'actions', 'Close the current user POS session after required drawer workflow',  'إغلاق جلسة نقطة البيع الخاصة بالمستخدم بعد استكمال مسار الصندوق', 'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('pos_session:force_close',  'Force Close POS Session',      'إغلاق إجباري لجلسة نقطة البيع',      'actions', 'Force-close a POS session with audit reason',                        'إغلاق جلسة نقطة بيع إجباريًا مع سبب تدقيقي',                     'POSSession', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status;

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active,
  rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE 1=1 -- ALL roles r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN (
    'pos_session:view',
    'pos_session:view_all',
    'pos_session:open',
    'pos_session:pause_resume',
    'pos_session:close',
    'pos_session:force_close'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active,
  rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'pos_session:view',
    'pos_session:view_all',
    'pos_session:open',
    'pos_session:pause_resume',
    'pos_session:close',
    'pos_session:force_close'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active,
  rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'operator'
  AND p.code IN (
    'pos_session:view',
    'pos_session:open',
    'pos_session:pause_resume',
    'pos_session:close'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 4. sys_components_cd metadata seed
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'billing_pos_sessions', 'billing',
  'POS Sessions', 'جلسات نقطة البيع',
  'POS session management metadata seed for Phase 1', 'بذرة وصفية لإدارة جلسات نقطة البيع في المرحلة الأولى',
  '/dashboard/billing/pos-sessions', 'MonitorSmartphone',
  1, 53,
  TRUE, FALSE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
  'pos_session:view',
  '{"phase":"phase_1_schema_only","visible":false,"feature":"pos_session_management_v1"}'::jsonb,
  1
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
  is_system            = EXCLUDED.is_system,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  metadata             = EXCLUDED.metadata,
  updated_at           = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'billing_pos_sessions'
  AND c.parent_comp_code = p.comp_code
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

COMMIT;
