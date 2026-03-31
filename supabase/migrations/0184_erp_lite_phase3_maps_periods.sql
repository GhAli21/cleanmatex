-- ==================================================================
-- Migration: 0184_erp_lite_phase3_maps_periods.sql
-- Purpose: Create ERP-Lite Phase 3 tenant usage mappings and periods
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 3 - Tenant Finance Schema
-- Notes: Schema-only foundation. No package activation logic is implemented here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_usage_map_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  usage_code_id UUID NOT NULL,
  account_id UUID NOT NULL,
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
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
  CONSTRAINT uq_ofum_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT fk_ofum_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofum_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofum_usage FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT fk_ofum_acct FOREIGN KEY (account_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofum_stat CHECK (status_code IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
  CONSTRAINT chk_ofum_eff CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

COMMENT ON TABLE public.org_fin_usage_map_mst IS
  'Tenant usage-code to account mapping used by runtime account resolution.';
COMMENT ON COLUMN public.org_fin_usage_map_mst.branch_id IS
  'Optional branch override for usage mapping; NULL means tenant-global mapping.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofum_global
  ON public.org_fin_usage_map_mst(tenant_org_id, usage_code_id)
  WHERE branch_id IS NULL
    AND status_code = 'ACTIVE'
    AND is_active = true
    AND rec_status = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofum_branch
  ON public.org_fin_usage_map_mst(tenant_org_id, usage_code_id, branch_id)
  WHERE branch_id IS NOT NULL
    AND status_code = 'ACTIVE'
    AND is_active = true
    AND rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_ofum_tenant
  ON public.org_fin_usage_map_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofum_acct
  ON public.org_fin_usage_map_mst(tenant_org_id, account_id);

CREATE INDEX IF NOT EXISTS idx_ofum_stat
  ON public.org_fin_usage_map_mst(tenant_org_id, status_code, is_active);

CREATE TABLE IF NOT EXISTS public.org_fin_period_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  period_code VARCHAR(20) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status_code VARCHAR(12) NOT NULL DEFAULT 'OPEN',
  lock_reason TEXT,
  closed_at TIMESTAMP,
  closed_by VARCHAR(120),
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
  CONSTRAINT uq_ofp_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofp_tenant_code UNIQUE (tenant_org_id, period_code),
  CONSTRAINT fk_ofp_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT chk_ofp_stat CHECK (status_code IN ('OPEN', 'CLOSED', 'SOFT_LOCKED')),
  CONSTRAINT chk_ofp_date CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.org_fin_period_mst IS
  'Tenant accounting periods controlling posting eligibility by posting date.';

CREATE INDEX IF NOT EXISTS idx_ofp_tenant
  ON public.org_fin_period_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofp_stat
  ON public.org_fin_period_mst(tenant_org_id, status_code, start_date);

CREATE INDEX IF NOT EXISTS idx_ofp_date
  ON public.org_fin_period_mst(tenant_org_id, start_date, end_date);

ALTER TABLE public.org_fin_usage_map_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_period_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofum ON public.org_fin_usage_map_mst;
CREATE POLICY tenant_isolation_ofum ON public.org_fin_usage_map_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofp ON public.org_fin_period_mst;
CREATE POLICY tenant_isolation_ofp ON public.org_fin_period_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
