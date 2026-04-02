-- ==================================================================
-- Migration: 0199_erp_lite_tpl_coa_tables.sql
-- Purpose: Create ERP-Lite template COA and usage mapping tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Template account rows are HQ-governed, not tenant runtime rows
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_coa_tpl_mst (
  coa_tpl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_id UUID NOT NULL,
  coa_template_code VARCHAR(80) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
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
  CONSTRAINT uq_sfct_pkg UNIQUE (tpl_pkg_id),
  CONSTRAINT uq_sfct_code UNIQUE (coa_template_code),
  CONSTRAINT fk_sfct_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id),
  CONSTRAINT chk_sfct_stat CHECK (status_code IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_sfct_pkg
  ON public.sys_fin_coa_tpl_mst(tpl_pkg_id, status_code);

COMMENT ON TABLE public.sys_fin_coa_tpl_mst IS
  'ERP-Lite COA template header attached to one HQ template package.';

CREATE TABLE IF NOT EXISTS public.sys_fin_coa_tpl_dtl (
  coa_tpl_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_tpl_id UUID NOT NULL,
  parent_tpl_line_id UUID,
  account_code VARCHAR(40) NOT NULL,
  acc_type_id UUID NOT NULL,
  acc_group_id UUID,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_postable BOOLEAN NOT NULL DEFAULT true,
  is_control_account BOOLEAN NOT NULL DEFAULT false,
  is_system_linked BOOLEAN NOT NULL DEFAULT false,
  manual_post_allowed BOOLEAN NOT NULL DEFAULT true,
  branch_mode_code VARCHAR(12) NOT NULL DEFAULT 'GLOBAL',
  usage_hint_code VARCHAR(60),
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
  CONSTRAINT uq_sfcd_tpl_code UNIQUE (coa_tpl_id, account_code),
  CONSTRAINT fk_sfcd_tpl FOREIGN KEY (coa_tpl_id)
    REFERENCES public.sys_fin_coa_tpl_mst(coa_tpl_id) ON DELETE CASCADE,
  CONSTRAINT fk_sfcd_prnt FOREIGN KEY (parent_tpl_line_id)
    REFERENCES public.sys_fin_coa_tpl_dtl(coa_tpl_line_id),
  CONSTRAINT fk_sfcd_type FOREIGN KEY (acc_type_id)
    REFERENCES public.sys_fin_acc_type_cd(acc_type_id),
  CONSTRAINT fk_sfcd_grp FOREIGN KEY (acc_group_id)
    REFERENCES public.sys_fin_acc_group_cd(acc_group_id),
  CONSTRAINT chk_sfcd_code CHECK (btrim(account_code) <> ''),
  CONSTRAINT chk_sfcd_bmode CHECK (branch_mode_code IN ('GLOBAL', 'OPTIONAL', 'BRANCH_ONLY'))
);

CREATE INDEX IF NOT EXISTS idx_sfcd_tpl
  ON public.sys_fin_coa_tpl_dtl(coa_tpl_id, rec_order);

CREATE INDEX IF NOT EXISTS idx_sfcd_prnt
  ON public.sys_fin_coa_tpl_dtl(parent_tpl_line_id)
  WHERE parent_tpl_line_id IS NOT NULL;

COMMENT ON TABLE public.sys_fin_coa_tpl_dtl IS
  'ERP-Lite template chart of accounts detail rows authored by HQ.';
COMMENT ON COLUMN public.sys_fin_coa_tpl_dtl.usage_hint_code IS
  'Optional informational hint for likely usage-code mapping. Authoritative mapping lives in sys_fin_usage_tpl_dtl.';

CREATE TABLE IF NOT EXISTS public.sys_fin_usage_tpl_dtl (
  usage_tpl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_id UUID NOT NULL,
  usage_code_id UUID NOT NULL,
  target_account_code VARCHAR(40) NOT NULL,
  branch_scope_code VARCHAR(12) NOT NULL DEFAULT 'GLOBAL',
  is_required BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_sfutd_pkg_use UNIQUE (tpl_pkg_id, usage_code_id, branch_scope_code),
  CONSTRAINT fk_sfutd_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id) ON DELETE CASCADE,
  CONSTRAINT fk_sfutd_use FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_sfutd_bscope CHECK (branch_scope_code IN ('GLOBAL', 'BRANCH'))
);

CREATE INDEX IF NOT EXISTS idx_sfutd_pkg
  ON public.sys_fin_usage_tpl_dtl(tpl_pkg_id, branch_scope_code, is_active);

COMMENT ON TABLE public.sys_fin_usage_tpl_dtl IS
  'ERP-Lite HQ template usage mappings from usage code to template account code.';

COMMIT;
