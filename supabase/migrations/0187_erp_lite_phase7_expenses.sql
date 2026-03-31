-- ==================================================================
-- Migration: 0187_erp_lite_phase7_expenses.sql
-- Purpose: Create ERP-Lite Phase 7 basic expense source-document tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 7 - Basic Expenses and Petty Cash
-- Notes: Runtime source tables only. Do NOT apply automatically.
--        User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_exp_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  expense_no VARCHAR(60) NOT NULL,
  expense_date DATE NOT NULL,
  posting_date DATE,
  status_code VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
  settlement_code VARCHAR(20) NOT NULL DEFAULT 'CASH',
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19, 8) NOT NULL DEFAULT 1,
  subtotal_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  source_ref_no VARCHAR(80),
  payee_name VARCHAR(250),
  payee_name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
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
  CONSTRAINT uq_ofe_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofe_tenant_no UNIQUE (tenant_org_id, expense_no),
  CONSTRAINT fk_ofe_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofe_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofe_status CHECK (
    status_code IN ('DRAFT', 'RECORDED', 'CANCELLED')
  ),
  CONSTRAINT chk_ofe_settle CHECK (
    settlement_code IN ('CASH', 'BANK', 'PAYABLE')
  ),
  CONSTRAINT chk_ofe_fx CHECK (exchange_rate > 0),
  CONSTRAINT chk_ofe_amt CHECK (
    subtotal_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
    AND total_amount = subtotal_amount + tax_amount
  )
);

COMMENT ON TABLE public.org_fin_exp_mst IS
  'Tenant basic expense source-document master for ERP-Lite Phase 7.';
COMMENT ON COLUMN public.org_fin_exp_mst.settlement_code IS
  'Operational settlement path for the expense runtime document. Posting behavior remains governed by HQ rules.';
COMMENT ON COLUMN public.org_fin_exp_mst.posting_date IS
  'Optional override used when expense operational date and finance posting date differ.';

CREATE INDEX IF NOT EXISTS idx_ofe_tenant
  ON public.org_fin_exp_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofe_branch
  ON public.org_fin_exp_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofe_date
  ON public.org_fin_exp_mst(tenant_org_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofe_status
  ON public.org_fin_exp_mst(tenant_org_id, status_code, expense_date DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_exp_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  expense_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  usage_code_id UUID NOT NULL,
  branch_id UUID,
  line_description TEXT,
  line_description2 TEXT,
  net_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  gross_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
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
  CONSTRAINT uq_ofed_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofed_tenant_line UNIQUE (tenant_org_id, expense_id, line_no),
  CONSTRAINT fk_ofed_exp FOREIGN KEY (expense_id, tenant_org_id)
    REFERENCES public.org_fin_exp_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofed_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofed_usage FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_ofed_line CHECK (line_no >= 1),
  CONSTRAINT chk_ofed_amt CHECK (
    net_amount >= 0
    AND tax_amount >= 0
    AND gross_amount >= 0
    AND gross_amount = net_amount + tax_amount
  )
);

COMMENT ON TABLE public.org_fin_exp_dtl IS
  'Expense detail lines classified by HQ-governed usage codes for later posting resolution.';
COMMENT ON COLUMN public.org_fin_exp_dtl.usage_code_id IS
  'Usage code identifies the governed expense classification. Tenant posting resolves through org_fin_usage_map_mst, not direct account entry.';

CREATE INDEX IF NOT EXISTS idx_ofed_tenant
  ON public.org_fin_exp_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofed_exp
  ON public.org_fin_exp_dtl(tenant_org_id, expense_id, line_no);

CREATE INDEX IF NOT EXISTS idx_ofed_usage
  ON public.org_fin_exp_dtl(tenant_org_id, usage_code_id);

ALTER TABLE public.org_fin_exp_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_exp_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofe ON public.org_fin_exp_mst;
CREATE POLICY tenant_isolation_ofe ON public.org_fin_exp_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofed ON public.org_fin_exp_dtl;
CREATE POLICY tenant_isolation_ofed ON public.org_fin_exp_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
