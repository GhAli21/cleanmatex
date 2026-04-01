-- ==================================================================
-- Migration: 0195_erp_lite_phase10_cost_runs.sql
-- Purpose: Create ERP-Lite Phase 10 laundry costing foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 10 - Advanced Controls + Profitability + Costing
-- Notes: Schema-only foundation. Do NOT apply automatically.
--        User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_cost_cmp_cd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  comp_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  cost_class_code VARCHAR(20) NOT NULL,
  basis_code VARCHAR(20) NOT NULL,
  status_code VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
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
  CONSTRAINT uq_ofcc_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofcc_cod UNIQUE (tenant_org_id, comp_code),
  CONSTRAINT fk_ofcc_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT chk_ofcc_cls CHECK (
    cost_class_code IN ('DIRECT', 'INDIRECT')
  ),
  CONSTRAINT chk_ofcc_bas CHECK (
    basis_code IN ('WEIGHT', 'PIECES', 'ORDERS', 'REVENUE', 'MANUAL')
  ),
  CONSTRAINT chk_ofcc_sta CHECK (
    status_code IN ('ACTIVE', 'INACTIVE')
  )
);

COMMENT ON TABLE public.org_fin_cost_cmp_cd IS
  'Tenant laundry-cost component catalog used by governed cost runs.';

CREATE INDEX IF NOT EXISTS idx_ofcc_tnt
  ON public.org_fin_cost_cmp_cd(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofcc_cls
  ON public.org_fin_cost_cmp_cd(tenant_org_id, cost_class_code, status_code);

CREATE TABLE IF NOT EXISTS public.org_fin_cost_run_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  run_no VARCHAR(40) NOT NULL,
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
  CONSTRAINT uq_ofcm_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofcm_no UNIQUE (tenant_org_id, run_no),
  CONSTRAINT fk_ofcm_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofcm_per FOREIGN KEY (period_id, tenant_org_id)
    REFERENCES public.org_fin_period_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofcm_sta CHECK (
    status_code IN ('DRAFT', 'POSTED', 'VOID')
  )
);

COMMENT ON TABLE public.org_fin_cost_run_mst IS
  'Rerunnable laundry cost-run headers with frozen basis snapshots.';

CREATE INDEX IF NOT EXISTS idx_ofcm_tnt
  ON public.org_fin_cost_run_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofcm_dat
  ON public.org_fin_cost_run_mst(tenant_org_id, run_date DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_cost_run_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  cost_run_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  cost_comp_id UUID NOT NULL,
  branch_id UUID,
  order_id UUID,
  order_item_id UUID,
  basis_value DECIMAL(19, 8),
  alloc_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(19, 8),
  total_cost DECIMAL(19, 4) NOT NULL DEFAULT 0,
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
  CONSTRAINT uq_ofcd_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofcd_lin UNIQUE (tenant_org_id, cost_run_id, line_no),
  CONSTRAINT fk_ofcd_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofcd_run FOREIGN KEY (cost_run_id, tenant_org_id)
    REFERENCES public.org_fin_cost_run_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofcd_cmp FOREIGN KEY (cost_comp_id, tenant_org_id)
    REFERENCES public.org_fin_cost_cmp_cd(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofcd_brn FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofcd_lin CHECK (line_no >= 1)
);

COMMENT ON TABLE public.org_fin_cost_run_dtl IS
  'Detailed laundry cost results kept separate from direct-posted finance truth.';

CREATE INDEX IF NOT EXISTS idx_ofcd_tnt
  ON public.org_fin_cost_run_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofcd_run
  ON public.org_fin_cost_run_dtl(tenant_org_id, cost_run_id, line_no);

CREATE INDEX IF NOT EXISTS idx_ofcd_brn
  ON public.org_fin_cost_run_dtl(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.org_fin_cost_cmp_cd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_cost_run_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_cost_run_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isol_ofcc ON public.org_fin_cost_cmp_cd;
CREATE POLICY tenant_isol_ofcc ON public.org_fin_cost_cmp_cd
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofcm ON public.org_fin_cost_run_mst;
CREATE POLICY tenant_isol_ofcm ON public.org_fin_cost_run_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofcd ON public.org_fin_cost_run_dtl;
CREATE POLICY tenant_isol_ofcd ON public.org_fin_cost_run_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
