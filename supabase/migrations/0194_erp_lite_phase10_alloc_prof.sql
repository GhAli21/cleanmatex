-- ==================================================================
-- Migration: 0194_erp_lite_phase10_alloc_prof.sql
-- Purpose: Create ERP-Lite Phase 10 allocation and branch profitability
--          runtime foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 10 - Advanced Controls + Profitability + Costing
-- Notes: Schema-only foundation. Do NOT apply automatically.
--        User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_alloc_rule_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  alloc_scope_code VARCHAR(20) NOT NULL,
  basis_code VARCHAR(20) NOT NULL,
  source_filter_json JSONB,
  target_filter_json JSONB,
  status_code VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  effective_from DATE,
  effective_to DATE,
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
  CONSTRAINT uq_ofar_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofar_cod UNIQUE (tenant_org_id, rule_code),
  CONSTRAINT fk_ofar_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT chk_ofar_scp CHECK (
    alloc_scope_code IN ('BRANCH_PL', 'COSTING')
  ),
  CONSTRAINT chk_ofar_bas CHECK (
    basis_code IN ('REVENUE', 'WEIGHT', 'PIECES', 'ORDERS', 'MANUAL')
  ),
  CONSTRAINT chk_ofar_sta CHECK (
    status_code IN ('DRAFT', 'ACTIVE', 'INACTIVE')
  ),
  CONSTRAINT chk_ofar_dte CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

COMMENT ON TABLE public.org_fin_alloc_rule_mst IS
  'Tenant allocation rules used by branch profitability and later costing runs.';

CREATE INDEX IF NOT EXISTS idx_ofar_tnt
  ON public.org_fin_alloc_rule_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofar_scp
  ON public.org_fin_alloc_rule_mst(tenant_org_id, alloc_scope_code, status_code);

CREATE TABLE IF NOT EXISTS public.org_fin_alloc_run_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  run_no VARCHAR(40) NOT NULL,
  alloc_scope_code VARCHAR(20) NOT NULL,
  run_date DATE NOT NULL,
  period_id UUID,
  status_code VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  basis_snapshot_json JSONB,
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
  CONSTRAINT uq_ofrn_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofrn_no UNIQUE (tenant_org_id, run_no),
  CONSTRAINT fk_ofrn_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofrn_per FOREIGN KEY (period_id, tenant_org_id)
    REFERENCES public.org_fin_period_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofrn_scp CHECK (
    alloc_scope_code IN ('BRANCH_PL', 'COSTING')
  ),
  CONSTRAINT chk_ofrn_sta CHECK (
    status_code IN ('DRAFT', 'POSTED', 'VOID')
  )
);

COMMENT ON TABLE public.org_fin_alloc_run_mst IS
  'Rerunnable allocation runs with frozen basis snapshots for audited profitability and costing outputs.';

CREATE INDEX IF NOT EXISTS idx_ofrn_tnt
  ON public.org_fin_alloc_run_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofrn_scp
  ON public.org_fin_alloc_run_mst(tenant_org_id, alloc_scope_code, run_date DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_alloc_run_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  alloc_run_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  alloc_rule_id UUID,
  source_branch_id UUID,
  target_branch_id UUID,
  source_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  alloc_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  basis_value DECIMAL(19, 8),
  source_ref_json JSONB,
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
  CONSTRAINT uq_ofrd_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofrd_lin UNIQUE (tenant_org_id, alloc_run_id, line_no),
  CONSTRAINT fk_ofrd_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofrd_run FOREIGN KEY (alloc_run_id, tenant_org_id)
    REFERENCES public.org_fin_alloc_run_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofrd_rul FOREIGN KEY (alloc_rule_id, tenant_org_id)
    REFERENCES public.org_fin_alloc_rule_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofrd_sbr FOREIGN KEY (source_branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofrd_tbr FOREIGN KEY (target_branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofrd_lin CHECK (line_no >= 1)
);

COMMENT ON TABLE public.org_fin_alloc_run_dtl IS
  'Allocation detail rows that separate direct-posted truth from governed derived allocations.';

CREATE INDEX IF NOT EXISTS idx_ofrd_tnt
  ON public.org_fin_alloc_run_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofrd_run
  ON public.org_fin_alloc_run_dtl(tenant_org_id, alloc_run_id, line_no);

ALTER TABLE public.org_fin_alloc_rule_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_alloc_run_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_alloc_run_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isol_ofar ON public.org_fin_alloc_rule_mst;
CREATE POLICY tenant_isol_ofar ON public.org_fin_alloc_rule_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofrn ON public.org_fin_alloc_run_mst;
CREATE POLICY tenant_isol_ofrn ON public.org_fin_alloc_run_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofrd ON public.org_fin_alloc_run_dtl;
CREATE POLICY tenant_isol_ofrd ON public.org_fin_alloc_run_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
