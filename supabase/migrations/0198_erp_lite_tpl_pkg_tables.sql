-- ==================================================================
-- Migration: 0198_erp_lite_tpl_pkg_tables.sql
-- Purpose: Create ERP-Lite template package and assignment tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Template resolution is keyed primarily by sys_main_business_type_cd
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_tpl_pkg_mst (
  tpl_pkg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_code VARCHAR(80) NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  phase_scope_code VARCHAR(10) NOT NULL DEFAULT 'V1',
  main_business_type_code VARCHAR(60),
  country_code VARCHAR(10),
  plan_code VARCHAR(50),
  status_code VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  compat_version VARCHAR(50) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  approved_at TIMESTAMP,
  approved_by VARCHAR(120),
  published_at TIMESTAMP,
  published_by VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_sftp_code_ver UNIQUE (tpl_pkg_code, version_no),
  CONSTRAINT fk_sftp_btype FOREIGN KEY (main_business_type_code)
    REFERENCES public.sys_main_business_type_cd(business_type_code),
  CONSTRAINT chk_sftp_phase CHECK (phase_scope_code IN ('V1', 'V2', 'V3', 'ALL')),
  CONSTRAINT chk_sftp_stat CHECK (
    status_code IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'RETIRED')
  ),
  CONSTRAINT chk_sftp_eff CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_sftp_code
  ON public.sys_fin_tpl_pkg_mst(tpl_pkg_code, version_no);

CREATE INDEX IF NOT EXISTS idx_sftp_stat
  ON public.sys_fin_tpl_pkg_mst(status_code, phase_scope_code, is_active);

CREATE INDEX IF NOT EXISTS idx_sftp_btype
  ON public.sys_fin_tpl_pkg_mst(main_business_type_code, status_code);

COMMENT ON TABLE public.sys_fin_tpl_pkg_mst IS
  'ERP-Lite HQ template package header. Published package versions can be materialized into tenant runtime.';
COMMENT ON COLUMN public.sys_fin_tpl_pkg_mst.main_business_type_code IS
  'Primary classification axis for ERP-Lite template targeting; FK to sys_main_business_type_cd.';

CREATE TABLE IF NOT EXISTS public.sys_fin_tpl_assign_mst (
  assign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_id UUID NOT NULL,
  assignment_mode VARCHAR(20) NOT NULL,
  tenant_org_id UUID,
  main_business_type_code VARCHAR(60),
  country_code VARCHAR(10),
  plan_code VARCHAR(50),
  priority_no INTEGER NOT NULL DEFAULT 100,
  is_default_fallback BOOLEAN NOT NULL DEFAULT false,
  status_code VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_sfta_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id),
  CONSTRAINT fk_sfta_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_sfta_btype FOREIGN KEY (main_business_type_code)
    REFERENCES public.sys_main_business_type_cd(business_type_code),
  CONSTRAINT chk_sfta_mode CHECK (
    assignment_mode IN (
      'TENANT',
      'BTYPE',
      'BTYPE_COUNTRY',
      'BTYPE_PLAN',
      'BTYPE_CTRY_PLAN',
      'FALLBACK'
    )
  ),
  CONSTRAINT chk_sfta_stat CHECK (status_code IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT chk_sfta_prio CHECK (priority_no >= 1),
  CONSTRAINT chk_sfta_scope CHECK (
    (assignment_mode = 'TENANT' AND tenant_org_id IS NOT NULL)
    OR (assignment_mode = 'BTYPE' AND main_business_type_code IS NOT NULL)
    OR (assignment_mode = 'BTYPE_COUNTRY' AND main_business_type_code IS NOT NULL AND country_code IS NOT NULL)
    OR (assignment_mode = 'BTYPE_PLAN' AND main_business_type_code IS NOT NULL AND plan_code IS NOT NULL)
    OR (assignment_mode = 'BTYPE_CTRY_PLAN' AND main_business_type_code IS NOT NULL AND country_code IS NOT NULL AND plan_code IS NOT NULL)
    OR (assignment_mode = 'FALLBACK')
  )
);

CREATE INDEX IF NOT EXISTS idx_sfta_pkg
  ON public.sys_fin_tpl_assign_mst(tpl_pkg_id);

CREATE INDEX IF NOT EXISTS idx_sfta_res
  ON public.sys_fin_tpl_assign_mst(status_code, is_active, priority_no);

CREATE INDEX IF NOT EXISTS idx_sfta_tnt
  ON public.sys_fin_tpl_assign_mst(tenant_org_id)
  WHERE tenant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sfta_btype
  ON public.sys_fin_tpl_assign_mst(main_business_type_code, country_code, plan_code)
  WHERE main_business_type_code IS NOT NULL;

COMMENT ON TABLE public.sys_fin_tpl_assign_mst IS
  'ERP-Lite template assignment rules that resolve a published template package for a tenant.';
COMMENT ON COLUMN public.sys_fin_tpl_assign_mst.is_default_fallback IS
  'True marks a lowest-priority global fallback package used when no explicit business-type match exists.';

COMMIT;
