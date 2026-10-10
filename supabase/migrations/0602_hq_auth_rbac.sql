BEGIN;

-- =============================================================================
-- Migration 0602: HQ Auth RBAC
-- Users, roles, permissions, role grants, user-role assignments, password resets
-- Created: 2026-10-10
--
-- Extends the tables created in 0038_hq_platform_tables.sql.
-- Does not edit that historical migration.
-- Review and apply manually. This file is not executed by the agent.
--
-- Seed data in this file:
--   1. Permission catalog (identity grants, live API grants, and any grant
--      already stored in hq_roles.permissions).
--   2. hq_role_permissions copied from each role's existing JSON list.
--   3. hq_user_roles copied from each hq_users.role_code as the primary role.
-- No password, password hash, MFA secret, or reset token is inserted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- hq_users profile and audit columns
-- -----------------------------------------------------------------------------

ALTER TABLE hq_users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS created_info TEXT,
  ADD COLUMN IF NOT EXISTS updated_info TEXT,
  ADD COLUMN IF NOT EXISTS rec_notes TEXT,
  ADD COLUMN IF NOT EXISTS rec_order INTEGER,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hq_users_username
  ON hq_users (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

-- email and session token_hash indexes already exist (0038).
-- Previous refresh hash detects reuse of a rotated refresh token.
ALTER TABLE hq_session_tokens
  ADD COLUMN IF NOT EXISTS previous_refresh_hash TEXT;

-- -----------------------------------------------------------------------------
-- Role hierarchy hook. Inheritance is not applied by application code yet.
-- -----------------------------------------------------------------------------

-- Columns created as varchar in 0038 are converted here. The historical
-- migration is not edited. role_code is converted before the new foreign keys
-- because varchar and text cannot share a foreign key.
ALTER TABLE hq_users DROP CONSTRAINT IF EXISTS hq_users_role_code_fkey;

ALTER TABLE hq_roles
  ALTER COLUMN role_code TYPE TEXT,
  ALTER COLUMN role_name TYPE TEXT,
  ALTER COLUMN role_name_ar TYPE TEXT;

ALTER TABLE hq_users
  ALTER COLUMN email TYPE TEXT,
  ALTER COLUMN full_name TYPE TEXT,
  ALTER COLUMN full_name_ar TYPE TEXT,
  ALTER COLUMN password_hash TYPE TEXT,
  ALTER COLUMN role_code TYPE TEXT;

ALTER TABLE hq_session_tokens
  ALTER COLUMN token_hash TYPE TEXT,
  ALTER COLUMN refresh_token_hash TYPE TEXT;

ALTER TABLE hq_users
  ADD CONSTRAINT hq_users_role_code_fkey
  FOREIGN KEY (role_code) REFERENCES hq_roles (role_code) ON DELETE RESTRICT;

ALTER TABLE hq_roles
  ADD COLUMN IF NOT EXISTS parent_role_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hq_roles_parent_role_code_fkey'
  ) THEN
    ALTER TABLE hq_roles
      ADD CONSTRAINT hq_roles_parent_role_code_fkey
      FOREIGN KEY (parent_role_code) REFERENCES hq_roles (role_code) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hq_roles_parent_not_self'
  ) THEN
    ALTER TABLE hq_roles
      ADD CONSTRAINT hq_roles_parent_not_self
      CHECK (parent_role_code IS NULL OR parent_role_code <> role_code);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Permissions catalog
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hq_permissions (
  permission_code TEXT PRIMARY KEY,
  permission_name TEXT NOT NULL,
  permission_name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  resource_code TEXT NOT NULL,
  action_code TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hq_permissions_resource
  ON hq_permissions (resource_code, action_code);

-- -----------------------------------------------------------------------------
-- Role grants. Source of truth after this migration.
-- hq_roles.permissions JSON is kept in sync by the application.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hq_role_permissions (
  role_code TEXT NOT NULL REFERENCES hq_roles (role_code) ON DELETE RESTRICT,
  permission_code TEXT NOT NULL REFERENCES hq_permissions (permission_code) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  PRIMARY KEY (role_code, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_hq_role_permissions_permission
  ON hq_role_permissions (permission_code);

-- -----------------------------------------------------------------------------
-- Multiple roles per user. Exactly one primary assignment.
-- hq_users.role_code stays and must equal the primary role.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hq_user_roles (
  user_id UUID NOT NULL REFERENCES hq_users (id) ON DELETE RESTRICT,
  role_code TEXT NOT NULL REFERENCES hq_roles (role_code) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  PRIMARY KEY (user_id, role_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hq_user_roles_primary
  ON hq_user_roles (user_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_hq_user_roles_role
  ON hq_user_roles (role_code);

-- -----------------------------------------------------------------------------
-- Self-service password reset. Only the token hash is stored.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hq_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES hq_users (id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hq_password_resets_user
  ON hq_password_resets (user_id, expires_at DESC);

-- -----------------------------------------------------------------------------
-- updated_at triggers (function already exists from 0038)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_hq_permissions_updated_at ON hq_permissions;
CREATE TRIGGER update_hq_permissions_updated_at
  BEFORE UPDATE ON hq_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hq_role_permissions_updated_at ON hq_role_permissions;
CREATE TRIGGER update_hq_role_permissions_updated_at
  BEFORE UPDATE ON hq_role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hq_user_roles_updated_at ON hq_user_roles;
CREATE TRIGGER update_hq_user_roles_updated_at
  BEFORE UPDATE ON hq_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hq_password_resets_updated_at ON hq_password_resets;
CREATE TRIGGER update_hq_password_resets_updated_at
  BEFORE UPDATE ON hq_password_resets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS: same deny-by-default pattern as 0038. Service role bypasses RLS.
-- email and token_hash lookups are already indexed, so no extra index there.
-- -----------------------------------------------------------------------------

ALTER TABLE hq_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_permissions;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_role_permissions;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_user_roles;
DROP POLICY IF EXISTS "HQ tables are only accessible via service role" ON hq_password_resets;

CREATE POLICY "HQ tables are only accessible via service role"
  ON hq_permissions FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
  ON hq_role_permissions FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
  ON hq_user_roles FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "HQ tables are only accessible via service role"
  ON hq_password_resets FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

GRANT ALL ON hq_permissions TO service_role;
GRANT ALL ON hq_role_permissions TO service_role;
GRANT ALL ON hq_user_roles TO service_role;
GRANT ALL ON hq_password_resets TO service_role;

-- -----------------------------------------------------------------------------
-- Seed: named permission catalog
-- -----------------------------------------------------------------------------

INSERT INTO hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT
  seed.code,
  seed.name_en,
  seed.name_ar,
  CASE
    WHEN seed.code = '*' THEN '*'
    WHEN position(':' IN seed.code) > 0 THEN split_part(seed.code, ':', 1)
    ELSE split_part(seed.code, '.', 1)
  END,
  CASE
    WHEN seed.code = '*' THEN '*'
    WHEN position(':' IN seed.code) > 0 THEN split_part(seed.code, ':', 2)
    ELSE split_part(seed.code, '.', 2)
  END,
  true,
  true,
  '0602 hq-auth permission catalog'
FROM (
  VALUES
    ('*', 'All HQ capabilities', 'كل صلاحيات المقر'),
    ('*.view', 'View all HQ resources', 'عرض كل موارد المقر'),
    ('users.view', 'View HQ users', 'عرض مستخدمي المقر'),
    ('users.manage', 'Manage HQ users', 'إدارة مستخدمي المقر'),
    ('roles.view', 'View HQ roles', 'عرض أدوار المقر'),
    ('roles.manage', 'Manage HQ roles', 'إدارة أدوار المقر'),
    ('permissions.view', 'View HQ permissions', 'عرض صلاحيات المقر'),
    ('permissions.manage', 'Manage HQ permissions', 'إدارة صلاحيات المقر'),
    ('tenants.view', 'View tenants', 'عرض المستأجرين'),
    ('tenants.edit', 'Edit tenants', 'تعديل المستأجرين'),
    ('tenants.manage', 'Manage tenants', 'إدارة المستأجرين'),
    ('branches.view', 'View tenant branches', 'عرض فروع المستأجر'),
    ('branches.manage', 'Manage tenant branches', 'إدارة فروع المستأجر'),
    ('tenant_users.view', 'View tenant users', 'عرض مستخدمي المستأجر'),
    ('tenant_users.manage', 'Manage tenant users', 'إدارة مستخدمي المستأجر'),
    ('tenant_roles.view', 'View tenant roles', 'عرض أدوار المستأجر'),
    ('tenant_roles.manage', 'Manage tenant roles', 'إدارة أدوار المستأجر'),
    ('tenant_permissions.view', 'View tenant permissions', 'عرض صلاحيات المستأجر'),
    ('tenant_permissions.manage', 'Manage tenant permissions', 'إدارة صلاحيات المستأجر'),
    ('tenant_maintenance.view', 'View tenant maintenance', 'عرض صيانة المستأجر'),
    ('tenant_maintenance.manage', 'Manage tenant maintenance', 'إدارة صيانة المستأجر'),
    ('workflows.*', 'All workflow capabilities', 'كل صلاحيات سير العمل'),
    ('workflows.view', 'View workflows', 'عرض سير العمل'),
    ('workflows.manage', 'Manage workflows', 'إدارة سير العمل'),
    ('workflows.edit_policy', 'Manage workflow edit policy', 'إدارة سياسة تعديل سير العمل'),
    ('workflows.edit_policy_promote', 'Promote workflow edit policy', 'ترقية سياسة تعديل سير العمل'),
    ('workflows.edit_policy_assign', 'Assign workflow edit policy', 'تعيين سياسة تعديل سير العمل'),
    ('catalog.*', 'All catalog capabilities', 'كل صلاحيات الكتالوج'),
    ('catalog.view', 'View catalog', 'عرض الكتالوج'),
    ('catalog.manage', 'Manage catalog', 'إدارة الكتالوج'),
    ('core_data.view', 'View core data', 'عرض البيانات الأساسية'),
    ('core_data.manage', 'Manage core data', 'إدارة البيانات الأساسية'),
    ('codes.*', 'All system-code capabilities', 'كل صلاحيات رموز النظام'),
    ('codes.view', 'View system codes', 'عرض رموز النظام'),
    ('codes.manage', 'Manage system codes', 'إدارة رموز النظام'),
    ('system.*', 'All system capabilities', 'كل صلاحيات النظام'),
    ('system.view', 'View system settings', 'عرض إعدادات النظام'),
    ('system.manage', 'Manage system settings', 'إدارة إعدادات النظام'),
    ('plans.*', 'All plan capabilities', 'كل صلاحيات الخطط'),
    ('plans.view', 'View plans', 'عرض الخطط'),
    ('plans.manage', 'Manage plans', 'إدارة الخطط'),
    ('subscriptions.*', 'All subscription capabilities', 'كل صلاحيات الاشتراكات'),
    ('subscriptions.view', 'View subscriptions', 'عرض الاشتراكات'),
    ('subscriptions.manage', 'Manage subscriptions', 'إدارة الاشتراكات'),
    ('billing.*', 'All billing capabilities', 'كل صلاحيات الفوترة'),
    ('billing.view', 'View billing', 'عرض الفوترة'),
    ('billing.manage', 'Manage billing', 'إدارة الفوترة'),
    ('payment_setup.view', 'View payment setup', 'عرض إعداد الدفع'),
    ('payment_setup.manage', 'Manage payment setup', 'إدارة إعداد الدفع'),
    ('fin_settlement.view', 'View financial settlement catalogs', 'عرض كتالوجات التسوية المالية'),
    ('fin_settlement.manage', 'Manage financial settlement catalogs', 'إدارة كتالوجات التسوية المالية'),
    ('analytics.*', 'All analytics capabilities', 'كل صلاحيات التحليلات'),
    ('analytics.view', 'View analytics', 'عرض التحليلات'),
    ('analytics.manage', 'Manage analytics', 'إدارة التحليلات'),
    ('reports.*', 'All report capabilities', 'كل صلاحيات التقارير'),
    ('reports.view', 'View reports', 'عرض التقارير'),
    ('reports.manage', 'Manage reports', 'إدارة التقارير'),
    ('customers.view', 'View customers', 'عرض العملاء'),
    ('customers.edit', 'Edit customers', 'تعديل العملاء'),
    ('customers.manage', 'Manage customers', 'إدارة العملاء'),
    ('tickets.*', 'All ticket capabilities', 'كل صلاحيات التذاكر'),
    ('tickets.view', 'View tickets', 'عرض التذاكر'),
    ('tickets.manage', 'Manage tickets', 'إدارة التذاكر'),
    ('impersonate.*', 'All impersonation capabilities', 'كل صلاحيات انتحال الهوية'),
    ('impersonate.manage', 'Impersonate a tenant user', 'انتحال مستخدم المستأجر'),
    ('settings.view', 'View platform settings', 'عرض إعدادات المنصة'),
    ('settings.manage', 'Manage platform settings', 'إدارة إعدادات المنصة'),
    ('feature_flags.view', 'View feature flags', 'عرض أعلام الميزات'),
    ('feature_flags.manage', 'Manage feature flags', 'إدارة أعلام الميزات'),
    ('navigation.view', 'View navigation', 'عرض التنقل'),
    ('navigation.manage', 'Manage navigation', 'إدارة التنقل'),
    ('audit.view', 'View HQ audit log', 'عرض سجل تدقيق المقر'),
    ('erp_lite.view', 'View ERP-Lite governance', 'عرض حوكمة ERP-Lite'),
    ('erp_lite.manage', 'Manage ERP-Lite governance', 'إدارة حوكمة ERP-Lite'),
    ('marketing.view', 'View marketing', 'عرض التسويق'),
    ('marketing.manage', 'Manage marketing', 'إدارة التسويق'),
    ('developer_portal.view', 'View developer portal', 'عرض بوابة المطور'),
    ('developer_portal.manage', 'Manage developer portal', 'إدارة بوابة المطور'),
    ('auth_config.view', 'View auth configuration', 'عرض إعدادات المصادقة'),
    ('auth_config.manage', 'Manage auth configuration', 'إدارة إعدادات المصادقة'),
    ('cash_pos_catalogs.view', 'View cash and POS catalogs', 'عرض كتالوجات النقد ونقاط البيع'),
    ('cash_pos_catalogs.manage', 'Manage cash and POS catalogs', 'إدارة كتالوجات النقد ونقاط البيع'),
    ('currencies.view', 'View currencies', 'عرض العملات'),
    ('currencies.manage', 'Manage currencies', 'إدارة العملات'),
    ('exchange_rates.view', 'View exchange rates', 'عرض أسعار الصرف'),
    ('exchange_rates.manage', 'Manage exchange rates', 'إدارة أسعار الصرف'),
    ('exchange_rates.approve', 'Approve exchange rates', 'اعتماد أسعار الصرف'),
    ('hq_notifications:read', 'Read HQ notifications', 'قراءة إشعارات المقر'),
    ('hq_notifications:manage', 'Manage HQ notifications', 'إدارة إشعارات المقر')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

-- Any grant already stored on a role and missing from the named list.
INSERT INTO hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT DISTINCT
  perm_row.code,
  perm_row.code,
  perm_row.code,
  CASE
    WHEN perm_row.code = '*' THEN '*'
    WHEN position(':' IN perm_row.code) > 0 THEN split_part(perm_row.code, ':', 1)
    ELSE split_part(perm_row.code, '.', 1)
  END,
  CASE
    WHEN perm_row.code = '*' THEN '*'
    WHEN position(':' IN perm_row.code) > 0 THEN split_part(perm_row.code, ':', 2)
    ELSE COALESCE(NULLIF(split_part(perm_row.code, '.', 2), ''), perm_row.code)
  END,
  true,
  true,
  '0602 copied from hq_roles.permissions'
FROM hq_roles AS role_row
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(role_row.permissions, '[]'::jsonb)) AS perm_row(code)
WHERE perm_row.code <> ''
ON CONFLICT (permission_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: role grants copied from the existing JSON on hq_roles
-- SUPER_ADMIN, TECH_ADMIN, BUSINESS_ADMIN, SUPPORT, ANALYST, VIEWER, and
-- any later custom role are included. JSON values are not rewritten.
-- -----------------------------------------------------------------------------

INSERT INTO hq_role_permissions (role_code, permission_code, created_info)
SELECT role_row.role_code, perm_row.code, '0602 copied from hq_roles.permissions'
FROM hq_roles AS role_row
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(role_row.permissions, '[]'::jsonb)) AS perm_row(code)
WHERE perm_row.code <> ''
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: one primary role assignment per existing HQ user.
-- Does not create a user and does not write a password.
-- -----------------------------------------------------------------------------

INSERT INTO hq_user_roles (user_id, role_code, is_primary, created_info)
SELECT user_row.id, user_row.role_code, true, '0602 copied from hq_users.role_code'
FROM hq_users AS user_row
WHERE user_row.role_code IS NOT NULL
ON CONFLICT (user_id, role_code) DO NOTHING;

COMMIT;
