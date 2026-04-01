-- ==================================================================
-- Migration: 0190_erp_lite_phase9_supplier_master.sql
-- Purpose: Create ERP-Lite Phase 9 supplier master foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 9 - V2 Treasury + Suppliers + AP/PO
-- Notes: Schema-only foundation. No workflow or posting logic here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_supp_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  payable_acct_id UUID,
  default_usage_id UUID,
  supplier_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  email VARCHAR(250),
  phone VARCHAR(40),
  tax_reg_no VARCHAR(80),
  payment_terms_days INTEGER NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL,
  status_code VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  posting_hold BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_ofs_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofs_code UNIQUE (tenant_org_id, supplier_code),
  CONSTRAINT fk_ofs_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofs_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofs_pay FOREIGN KEY (payable_acct_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofs_usage FOREIGN KEY (default_usage_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_ofs_code CHECK (btrim(supplier_code) <> ''),
  CONSTRAINT chk_ofs_days CHECK (payment_terms_days >= 0),
  CONSTRAINT chk_ofs_stat CHECK (status_code IN ('ACTIVE', 'INACTIVE', 'BLOCKED'))
);

COMMENT ON TABLE public.org_fin_supp_mst IS
  'Tenant supplier master supporting payable lifecycle, terms, and future procurement controls.';

CREATE INDEX IF NOT EXISTS idx_ofs_tenant
  ON public.org_fin_supp_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofs_branch
  ON public.org_fin_supp_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofs_stat
  ON public.org_fin_supp_mst(tenant_org_id, status_code, is_active);

CREATE TABLE IF NOT EXISTS public.org_fin_supp_ctc_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  email VARCHAR(250),
  phone VARCHAR(40),
  role_name VARCHAR(120),
  is_primary BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_ofsc_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofsc_line UNIQUE (tenant_org_id, supplier_id, line_no),
  CONSTRAINT fk_ofsc_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofsc_supp FOREIGN KEY (supplier_id, tenant_org_id)
    REFERENCES public.org_fin_supp_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_ofsc_line CHECK (line_no >= 1)
);

COMMENT ON TABLE public.org_fin_supp_ctc_dtl IS
  'Optional supplier contacts linked to tenant supplier master records.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofsc_prim
  ON public.org_fin_supp_ctc_dtl(tenant_org_id, supplier_id)
  WHERE is_primary = true
    AND is_active = true
    AND rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_ofsc_tenant
  ON public.org_fin_supp_ctc_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofsc_supp
  ON public.org_fin_supp_ctc_dtl(tenant_org_id, supplier_id, line_no);

ALTER TABLE public.org_fin_supp_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_supp_ctc_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofs ON public.org_fin_supp_mst;
CREATE POLICY tenant_isolation_ofs ON public.org_fin_supp_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofsc ON public.org_fin_supp_ctc_dtl;
CREATE POLICY tenant_isolation_ofsc ON public.org_fin_supp_ctc_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;

