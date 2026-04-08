-- ==================================================================
-- Migration: 0221_erp_lite_permission_grant_hardening.sql
-- Purpose: Two-part hardening for ERP-Lite security and access control.
--
-- Part 1 — DB GRANT hardening (PB-H7):
--   Revoke direct anon/authenticated read on HQ governance tables.
--   These tables are owned by HQ (cleanmatexsaas) and must only be
--   accessed via service role key. Tenant app (cleanmatex) must NEVER
--   query them directly at runtime.
--   Affected tables:
--     sys_fin_gov_pkg_mst     -- governance packages (HQ only)
--     sys_fin_map_rule_mst    -- mapping rules (HQ only)
--     sys_fin_map_rule_dtl    -- mapping rule detail lines (HQ only)
--     sys_fin_resolver_cd     -- resolver catalog (HQ only, read-only)
--
-- Part 2 — Missing permissions (PB-H10 fix support):
--   Add erp_lite_branch_pl:create and erp_lite_branch_pl:post
--   which were missing from 0176 but are required by the corrected
--   access contract in erp-lite-access.ts.
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Part 1: Revoke anon/authenticated access on HQ governance tables
--
-- These tables are structurally in the shared DB but are governed
-- exclusively by HQ (cleanmatexsaas via service role key).
-- Tenant app must consume governance data through the posting engine
-- resolver, not by direct table query.
-- ------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.sys_fin_gov_pkg_mst
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.sys_fin_map_rule_mst
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.sys_fin_map_rule_dtl
  FROM anon, authenticated;

-- sys_fin_resolver_cd is a catalog but still HQ-only read
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.sys_fin_resolver_cd
  FROM anon, authenticated;

-- ------------------------------------------------------------------
-- Part 2: New permissions for Branch P&L write operations
--
-- erp_lite_branch_pl:create — required for allocation/cost setup
-- erp_lite_branch_pl:post   — required for posting runs (elevated)
-- ------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by,
  created_info
) VALUES
  (
    'erp_lite_branch_pl:create',
    'Create Branch P&L Entries',
    'إنشاء إدخالات أرباح وخسائر الفروع',
    'crud',
    'Create allocation rules, allocation runs, cost components, and cost runs for Branch P&L',
    'إنشاء قواعد التوزيع وتشغيلات التوزيع ومكونات التكلفة وتشغيلات التكلفة لأرباح وخسائر الفروع',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0221'
  ),
  (
    'erp_lite_branch_pl:post',
    'Post Branch P&L Runs',
    'ترحيل تشغيلات أرباح وخسائر الفروع',
    'actions',
    'Post allocation runs and cost runs in Branch P&L (elevated finance action)',
    'ترحيل تشغيلات التوزيع وتشغيلات التكلفة في أرباح وخسائر الفروع (إجراء مالي مرتفع الصلاحية)',
    'ERP-Lite',
    true, true, 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0221'
  )
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_enabled    = EXCLUDED.is_enabled,
  is_active     = EXCLUDED.is_active,
  updated_at    = CURRENT_TIMESTAMP,
  updated_by    = 'system_admin',
  updated_info  = 'Migration 0221 ERP-Lite permission hardening';

-- Assign new permissions to super_admin and tenant_admin by default.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by,
  created_info
)
SELECT
  role_code,
  permission_code,
  true, true, 1,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0221 ERP-Lite permission hardening'
FROM (
  SELECT role_code, permission_code
  FROM unnest(ARRAY['super_admin', 'tenant_admin']) AS role_code
  CROSS JOIN unnest(ARRAY[
    'erp_lite_branch_pl:create',
    'erp_lite_branch_pl:post'
  ]) AS permission_code
) AS seed_rows
ON CONFLICT (role_code, permission_code) DO NOTHING;

COMMIT;
