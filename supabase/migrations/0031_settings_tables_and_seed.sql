-- ==================================================================
-- 0031_settings_tables_and_seed.sql
-- Purpose: Core database schema for CleanMateX multi-tenant SaaS
-- Author: CleanMateX Development Team
-- Created: 2025-10-17
-- Dependencies: None
-- ==================================================================
-- This migration creates the foundational tables for:
-- - System-level lookup tables (sys_*)
-- - Tenant organization tables (org_*)
-- - Multi-tenant data isolation via composite keys
-- ==================================================================

BEGIN;

-- ===============================================================
-- Extensions
-- ===============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

-- ===============================================================
-- System catalog of settings (master definitions)
-- ===============================================================
CREATE TABLE IF NOT EXISTS sys_tenant_settings_cd (
  setting_code          text PRIMARY KEY,
  setting_name          text,
  setting_name2         text,
  setting_desc          text,

  -- typed values
  setting_value_type    text CHECK (setting_value_type IN ('BOOLEAN','TEXT','NUMBER','DATE')),
  setting_value         text,

  -- control flags
  is_for_tenants_org    boolean NOT NULL DEFAULT true,
  is_active             boolean NOT NULL DEFAULT true,
  is_per_tenant_org_id  boolean NOT NULL DEFAULT true,
  is_per_branch_id      boolean NOT NULL DEFAULT false,
  is_per_user_id        boolean NOT NULL DEFAULT false,

  -- housekeeping
  rec_order             int,
  rec_notes             text,
  rec_status            smallint DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text,
  created_info          text,
  updated_at            timestamptz,
  updated_by            text,
  updated_info          text
);

/*
-- helpful index for admin queries
CREATE INDEX IF NOT EXISTS idx_sys_tenant_settings_cd_active
ON sys_tenant_settings_cd (is_active, setting_code);
*/ 

-- ===============================================================
-- Tenant overrides table (per tenant/branch/user)
-- ===============================================================
CREATE TABLE IF NOT EXISTS org_tenant_settings_cf (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_org_id         uuid NOT NULL,
  setting_code          text NOT NULL,

  setting_name          text,
  setting_name2         text,
  setting_desc          text,

  -- typed values
  setting_value_type    text CHECK (setting_value_type IN ('BOOLEAN','TEXT','NUMBER','DATE')),
  setting_value         text,

  is_active             boolean NOT NULL DEFAULT true,

  -- optional scopes (NULL = not scoped)
  branch_id             uuid NULL,
  user_id               uuid NULL,

  -- housekeeping
  rec_order             int,
  rec_notes             text,
  rec_status            smallint DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text,
  created_info          text,
  updated_at            timestamptz,
  updated_by            text,
  updated_info          text
);

-- FK to tenants
ALTER TABLE org_tenant_settings_cf
  ADD CONSTRAINT fk_ots_tenant
  FOREIGN KEY (tenant_org_id)
  REFERENCES org_tenants_mst(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Optional FKs (enable only if these tables exist with matching keys)
/*
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='org_branches_mst') THEN
    -- Expect org_branches_mst(id, tenant_org_id)
    ALTER TABLE org_tenant_settings_cf
      ADD CONSTRAINT fk_ots_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON UPDATE RESTRICT ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='org_emp_users') THEN
    -- Expect org_emp_users(id, tenant_id)
    ALTER TABLE org_tenant_settings_cf
      ADD CONSTRAINT fk_ots_user
      FOREIGN KEY (user_id, tenant_org_id)
      REFERENCES org_emp_users(id, tenant_id)
      ON UPDATE RESTRICT ON DELETE SET NULL;
  END IF;
END $$;
*/

-- fast lookups
/*
CREATE INDEX IF NOT EXISTS idx_ots_tenant_code ON org_tenant_settings_cf (tenant_org_id, setting_code);
CREATE INDEX IF NOT EXISTS idx_ots_scope ON org_tenant_settings_cf (tenant_org_id, branch_id, user_id);
*/

/*
-- Unique constraint for the common “tenant-global” scope
-- (branch_id IS NULL AND user_id IS NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ots_tenant_code_nullscope'
  ) THEN
    ALTER TABLE org_tenant_settings_cf
      ADD CONSTRAINT uq_ots_tenant_code_nullscope
      UNIQUE (tenant_org_id, setting_code)
      DEFERRABLE INITIALLY IMMEDIATE;
    -- Make it partial (null-scope) by converting via CREATE UNIQUE INDEX and dropping constraint?
    -- Workaround: keep the constraint for ON CONFLICT target and enforce null-scope in application.
  END IF;
END $$;
*/

/*
-- If you prefer a true partial uniqueness at DB level for null-scope, add this unique INDEX:
CREATE UNIQUE INDEX IF NOT EXISTS uix_ots_tenant_code_nullscope
ON org_tenant_settings_cf (tenant_org_id, setting_code)
WHERE branch_id IS NULL AND user_id IS NULL;
*/
-- ===============================================================
-- RLS: enforce tenant isolation (expects app.current_tenant_id set)
-- ===============================================================
/*
ALTER TABLE org_tenant_settings_cf ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_tenant_settings_cf'
      AND policyname = 'rls_ots_select'
  ) THEN
    CREATE POLICY rls_ots_select ON org_tenant_settings_cf
      FOR SELECT USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_tenant_settings_cf'
      AND policyname = 'rls_ots_ins'
  ) THEN
    CREATE POLICY rls_ots_ins ON org_tenant_settings_cf
      FOR INSERT WITH CHECK (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_tenant_settings_cf'
      AND policyname = 'rls_ots_upd'
  ) THEN
    CREATE POLICY rls_ots_upd ON org_tenant_settings_cf
      FOR UPDATE USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid)
                 WITH CHECK (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_tenant_settings_cf'
      AND policyname = 'rls_ots_del'
  ) THEN
    CREATE POLICY rls_ots_del ON org_tenant_settings_cf
      FOR DELETE USING (tenant_org_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;
END $$;
*/

-- ===============================================================
-- Seed: system definitions (idempotent)
-- ===============================================================
INSERT INTO sys_tenant_settings_cd (
  setting_code, setting_name, setting_name2, setting_desc,
  setting_value_type, setting_value,
  is_for_tenants_org, is_active,
  is_per_tenant_org_id, is_per_branch_id, is_per_user_id,
  rec_order, rec_notes, rec_status,
  created_by, created_info, updated_at, updated_by, updated_info
)
VALUES
  -- boolean feature flag
  ('USING_SPLIT_ORDER',
   'Using Split Order', 'يستخدم تقسيم الطلبات',
   'Defines whether split sub-orders are allowed.',
   'BOOLEAN','true',
   true,true,
   true,false,false,
   1,'Global config for Using Split Order',1,
   'system_admin','setup seed', now(),'system_admin','upsert'),
  -- UI color example
  ('REJECT_ROW_COLOR',
   'Reject Row Color', 'لون الصف المرفوض',
   'Color code used to highlight rejected rows.',
   'TEXT','#10B981',
   true,true,
   true,false,false,
   2,'UI theme color for reject state',1,
   'system_admin','setup seed', now(),'system_admin','upsert'),
  -- USE_TRACK_BY_PIECE feature flag
  ('USE_TRACK_BY_PIECE',
   'Using Tracking By Piece',
   'إستخدام التتبع على مستوى القطعه',
   'Defines whether Using Tracking By Piece are allowed.',
   'BOOLEAN','true',
   true,true,
   true,false,false,
   1,'Global config for Using Tracking By Piece',1,
   'system_admin','setup seed', now(),'system_admin','upsert'
   ),
   -- USE_REJECT_TO_SOLVE feature flag
  ('USE_REJECT_TO_SOLVE',
   'Using Reject of items or Pieces of orders',
   'إستحدام رفض وارجاع الصنف او القطع',
   'Defines whether Reject of items or Pieces of orders are allowed.',
   'BOOLEAN','true',
   true,true,
   true,false,false,
   1,'Global config for Reject of items or Pieces of orders',1,
   'system_admin','setup seed', now(),'system_admin','upsert'
   ),
  -- numeric example
  ('AUTO_CLOSE_DAYS',
   'Auto Close After (Days)', 'الإغلاق الآلي بعد (أيام)',
   'Auto-close completed orders after N days.',
   'NUMBER','7',
   true,true,
   true,false,false,
   3,'Ops hygiene rule',1,
   'system_admin','setup seed', now(),'system_admin','upsert'),
  -- date example
  ('PEAK_SEASON_START',
   'Peak Season Start', 'بداية الموسم الذروي',
   'Start date of peak season pricing window.',
   'DATE','2025-12-01T00:00:00Z',
   true,true,
   true,false,false,
   4,'Pricing calendar anchor',1,
   'system_admin','setup seed', now(),'system_admin','upsert')
ON CONFLICT (setting_code) DO UPDATE SET
  setting_name         = EXCLUDED.setting_name,
  setting_name2        = EXCLUDED.setting_name2,
  setting_desc         = EXCLUDED.setting_desc,
  setting_value_type   = EXCLUDED.setting_value_type,
  setting_value        = EXCLUDED.setting_value,
  is_for_tenants_org   = EXCLUDED.is_for_tenants_org,
  is_active            = EXCLUDED.is_active,
  is_per_tenant_org_id = EXCLUDED.is_per_tenant_org_id,
  is_per_branch_id     = EXCLUDED.is_per_branch_id,
  is_per_user_id       = EXCLUDED.is_per_user_id,
  rec_order            = EXCLUDED.rec_order,
  rec_notes            = EXCLUDED.rec_notes,
  rec_status           = EXCLUDED.rec_status,
  updated_at           = now(),
  updated_by           = 'system_admin',
  updated_info         = 'upsert refresh';


-- ===============================================================
-- Propagate system settings to tenants (tenant-global scope only)
-- Safe upsert using the partial unique index for NULL scope.
-- ===============================================================
-- ===============================================================
-- Propagate system settings to tenants (tenant-global scope only)
-- Uses MERGE so we don't need a partial unique constraint name.
-- Match key: (tenant_org_id, setting_code, branch_id IS NULL, user_id IS NULL)
-- ===============================================================

MERGE INTO org_tenant_settings_cf AS dst
USING (
  SELECT
    t.id                AS tenant_org_id,
    s.setting_code,
    s.setting_name,
    s.setting_name2,
    s.setting_desc,
    s.setting_value_type,
    s.setting_value,
    s.is_active,
    s.rec_order,
    s.rec_notes,
    s.rec_status
  FROM sys_tenant_settings_cd s
  CROSS JOIN org_tenants_mst t
  WHERE s.is_active = true
    AND s.is_for_tenants_org = true
) AS src
ON (
  dst.tenant_org_id = src.tenant_org_id
  AND dst.setting_code = src.setting_code
  AND dst.branch_id IS NULL
  AND dst.user_id IS NULL
)
WHEN MATCHED THEN
  UPDATE SET
    setting_name       = src.setting_name,
    setting_name2      = src.setting_name2,
    setting_desc       = src.setting_desc,
    setting_value_type = src.setting_value_type,
    setting_value      = src.setting_value,
    is_active          = src.is_active,
    rec_order          = src.rec_order,
    rec_notes          = src.rec_notes,
    rec_status         = src.rec_status,
    updated_at         = now(),
    updated_by         = 'system_admin',
    updated_info       = 'propagate refresh'
WHEN NOT MATCHED THEN
  INSERT (
    tenant_org_id, setting_code,
    setting_name, setting_name2, setting_desc,
    setting_value_type, setting_value,
    is_active,
    branch_id, user_id,
    rec_order, rec_notes, rec_status,
    created_by, created_info, updated_at, updated_by, updated_info
  )
  VALUES (
    src.tenant_org_id, src.setting_code,
    src.setting_name, src.setting_name2, src.setting_desc,
    src.setting_value_type, src.setting_value,
    src.is_active,
    NULL, NULL,
    src.rec_order, src.rec_notes, src.rec_status,
    'system_admin', 'seed: propagate sys -> tenant', now(), 'system_admin', 'propagate'
  );

COMMIT;
-- ==========================================================--
-- Expose a view that picks the most specific row. This keeps reads fast and pushes logic to SQL.
-- ==========================================================--

-- ===============================================================
-- View: v_effective_tenant_settings
-- Purpose: Resolve the effective (active) configuration for each
--          tenant / branch / user across all settings.
-- Logic:
--   1. Combine org_tenant_settings_cf (tenant overrides)
--      with sys_tenant_settings_cd (system defaults).
--   2. Prefer most specific scope:
--         user > branch > tenant > system
--   3. Return typed value and source indicator.
-- ===============================================================

CREATE OR REPLACE VIEW v_effective_tenant_settings AS
WITH ranked AS (
  SELECT
    -- Context
    COALESCE(o.tenant_org_id, NULL) AS tenant_org_id,
    COALESCE(o.branch_id, NULL)     AS branch_id,
    COALESCE(o.user_id, NULL)       AS user_id,

    -- Identifiers
    s.setting_code,
    COALESCE(o.setting_name, s.setting_name)     AS setting_name,
    COALESCE(o.setting_name2, s.setting_name2)   AS setting_name2,
    COALESCE(o.setting_desc, s.setting_desc)     AS setting_desc,

    -- Value and type
    COALESCE(o.setting_value_type, s.setting_value_type) AS setting_value_type,
    COALESCE(o.setting_value, s.setting_value)           AS setting_value,

    -- Active status
    COALESCE(o.is_active, s.is_active) AS is_active,

    -- Source indicator
    CASE
      WHEN o.user_id IS NOT NULL THEN 'user'
      WHEN o.branch_id IS NOT NULL THEN 'branch'
      WHEN o.tenant_org_id IS NOT NULL THEN 'tenant'
      ELSE 'system'
    END AS source,

    -- Ranking for row precedence
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(o.tenant_org_id, '00000000-0000-0000-0000-000000000000'),
                   s.setting_code
      ORDER BY
        (o.user_id IS NOT NULL) DESC,
        (o.branch_id IS NOT NULL) DESC,
        o.updated_at DESC NULLS LAST,
        o.created_at DESC NULLS LAST
    ) AS rn
  FROM sys_tenant_settings_cd s
  LEFT JOIN org_tenant_settings_cf o
    ON s.setting_code = o.setting_code
)
SELECT
  tenant_org_id,
  branch_id,
  user_id,
  setting_code,
  setting_name,
  setting_name2,
  setting_desc,
  setting_value_type,
  setting_value,
  is_active,
  source
FROM ranked
WHERE rn = 1
;

/*
-- Get all effective settings for a tenant
SELECT *
FROM v_effective_tenant_settings
WHERE tenant_org_id = '11111111-2222-3333-4444-555555555555';

-- Get a single setting (effective typed value)
SELECT setting_value, setting_value_type
FROM v_effective_tenant_settings
WHERE tenant_org_id = '11111111-2222-3333-4444-555555555555'
  AND setting_code = 'USING_SPLIT_ORDER';

*/
-- ==========================================================--

-- ==========================================================--
-- ===============================================================
-- Function: fn_get_setting_value
-- Purpose : Retrieve setting value for a tenant with type awareness
-- Input   : tenant_org_id UUID, setting_code TEXT
-- Output  : JSON { value, type, is_active, source }
-- ===============================================================

CREATE OR REPLACE FUNCTION fn_get_setting_value(
  p_tenant_org_id uuid,
  p_setting_code  text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_result json;
BEGIN
  -- 1. Try tenant-level record
  SELECT
    s.setting_value,
    s.setting_value_type,
    s.is_active,
    'tenant' AS source
  INTO r
  FROM org_tenant_settings_cf s
  WHERE s.tenant_org_id = p_tenant_org_id
    AND s.setting_code  = p_setting_code
  ORDER BY
    (s.user_id IS NOT NULL) DESC,
    (s.branch_id IS NOT NULL) DESC,
    s.updated_at DESC NULLS LAST,
    s.created_at DESC
  LIMIT 1;

  -- 2. If no tenant record, use system default
  IF NOT FOUND THEN
    SELECT
      s.setting_value,
      s.setting_value_type,
      s.is_active,
      'system' AS source
    INTO r
    FROM sys_tenant_settings_cd s
    WHERE s.setting_code = p_setting_code;
  END IF;

  -- 3. If still null, default false/null result
  IF r.setting_value IS NULL THEN
    RETURN json_build_object(
      'value', NULL,
      'type', NULL,
      'is_active', false,
      'source', 'none'
    );
  END IF;

  -- 4. Coerce value according to type
  CASE r.setting_value_type
    WHEN 'BOOLEAN' THEN
      v_result := json_build_object(
        'value', (r.setting_value::boolean),
        'type', 'BOOLEAN',
        'is_active', r.is_active,
        'source', r.source
      );
    WHEN 'NUMBER' THEN
      v_result := json_build_object(
        'value', (r.setting_value::numeric),
        'type', 'NUMBER',
        'is_active', r.is_active,
        'source', r.source
      );
    WHEN 'DATE' THEN
      v_result := json_build_object(
        'value', (r.setting_value::timestamptz),
        'type', 'DATE',
        'is_active', r.is_active,
        'source', r.source
      );
    ELSE
      v_result := json_build_object(
        'value', r.setting_value,
        'type', 'TEXT',
        'is_active', r.is_active,
        'source', r.source
      );
  END CASE;

  RETURN v_result;
END;
$$;

-- ==========================================================--

-- ==========================================================--

CREATE OR REPLACE FUNCTION fn_is_setting_allowed(
  p_tenant_org_id uuid,
  p_setting_code  text
)
RETURNS boolean
LANGUAGE sql
AS $$
SELECT COALESCE(
  (fn_get_setting_value(p_tenant_org_id, p_setting_code)->>'value')::boolean,
  false
);
$$;

-- ==========================================================--

-- ==========================================================--
/*
-- Boolean example
SELECT fn_get_setting_value('11111111-2222-3333-4444-555555555555','USING_SPLIT_ORDER');
-- → {"value": true, "type": "BOOLEAN", "is_active": true, "source": "system"}

-- Text example
SELECT fn_get_setting_value('11111111-2222-3333-4444-555555555555','REJECT_ROW_COLOR');
-- → {"value": "#10B981", "type": "TEXT", "is_active": true, "source": "system"}

-- Shortcut boolean
SELECT fn_is_setting_allowed('11111111-2222-3333-4444-555555555555','USING_SPLIT_ORDER');
-- → true
*/
-- ==========================================================--

-- ==========================================================--

