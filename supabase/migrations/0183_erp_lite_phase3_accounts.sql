-- ==================================================================
-- Migration: 0183_erp_lite_phase3_accounts.sql
-- Purpose: Create ERP-Lite Phase 3 tenant chart-of-accounts foundation
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 3 - Tenant Finance Schema
-- Notes: Schema-only foundation. No posting logic is implemented here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_acct_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  parent_account_id UUID,
  branch_id UUID,
  acc_type_id UUID NOT NULL,
  acc_group_id UUID,
  account_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_postable BOOLEAN NOT NULL DEFAULT true,
  is_control_account BOOLEAN NOT NULL DEFAULT false,
  is_system_linked BOOLEAN NOT NULL DEFAULT false,
  manual_post_allowed BOOLEAN NOT NULL DEFAULT true,
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
  CONSTRAINT uq_ofa_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofa_tenant_code UNIQUE (tenant_org_id, account_code),
  CONSTRAINT fk_ofa_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofa_parent FOREIGN KEY (parent_account_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofa_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofa_type FOREIGN KEY (acc_type_id)
    REFERENCES public.sys_fin_acc_type_cd(acc_type_id),
  CONSTRAINT fk_ofa_group FOREIGN KEY (acc_group_id)
    REFERENCES public.sys_fin_acc_group_cd(acc_group_id),
  CONSTRAINT chk_ofa_code CHECK (btrim(account_code) <> ''),
  CONSTRAINT chk_ofa_eff CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

COMMENT ON TABLE public.org_fin_acct_mst IS
  'Tenant chart of accounts master for ERP-Lite runtime.';
COMMENT ON COLUMN public.org_fin_acct_mst.parent_account_id IS
  'Optional self-reference to support hierarchical account trees.';
COMMENT ON COLUMN public.org_fin_acct_mst.branch_id IS
  'Optional branch-specific account ownership for future branch-level finance controls.';
COMMENT ON COLUMN public.org_fin_acct_mst.is_postable IS
  'Only postable accounts may receive journal lines at runtime.';
COMMENT ON COLUMN public.org_fin_acct_mst.is_control_account IS
  'Marks system-governed control accounts such as receivables.';
COMMENT ON COLUMN public.org_fin_acct_mst.is_system_linked IS
  'Marks accounts linked to governed usage mappings or protected runtime flows.';
COMMENT ON COLUMN public.org_fin_acct_mst.manual_post_allowed IS
  'Future-safe control for whether direct manual journal lines may target this account.';

CREATE INDEX IF NOT EXISTS idx_ofa_tenant
  ON public.org_fin_acct_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofa_type
  ON public.org_fin_acct_mst(tenant_org_id, acc_type_id);

CREATE INDEX IF NOT EXISTS idx_ofa_group
  ON public.org_fin_acct_mst(tenant_org_id, acc_group_id);

CREATE INDEX IF NOT EXISTS idx_ofa_parent
  ON public.org_fin_acct_mst(tenant_org_id, parent_account_id)
  WHERE parent_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofa_branch
  ON public.org_fin_acct_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofa_post
  ON public.org_fin_acct_mst(tenant_org_id, is_postable, is_active);

CREATE INDEX IF NOT EXISTS idx_ofa_created
  ON public.org_fin_acct_mst(tenant_org_id, created_at DESC);

ALTER TABLE public.org_fin_acct_mst ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofa ON public.org_fin_acct_mst;
CREATE POLICY tenant_isolation_ofa ON public.org_fin_acct_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
