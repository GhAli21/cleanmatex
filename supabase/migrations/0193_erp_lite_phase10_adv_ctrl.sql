-- ==================================================================
-- Migration: 0193_erp_lite_phase10_adv_ctrl.sql
-- Purpose: Create ERP-Lite Phase 10 advanced approval and petty-cash
--          reconciliation foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 10 - Advanced Controls + Profitability + Costing
-- Notes: Schema-only foundation. Do NOT apply automatically.
--        User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_doc_appr_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  source_doc_type VARCHAR(20) NOT NULL,
  source_doc_id UUID NOT NULL,
  step_no INTEGER NOT NULL,
  approver_user_id UUID,
  status_code VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  action_at TIMESTAMP,
  action_note TEXT,
  action_note2 TEXT,
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
  CONSTRAINT uq_ofda_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofda_step UNIQUE (tenant_org_id, source_doc_type, source_doc_id, step_no),
  CONSTRAINT fk_ofda_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT chk_ofda_src CHECK (
    source_doc_type IN ('EXPENSE', 'CASH_TXN')
  ),
  CONSTRAINT chk_ofda_step CHECK (step_no >= 1),
  CONSTRAINT chk_ofda_stat CHECK (
    status_code IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
  )
);

COMMENT ON TABLE public.org_fin_doc_appr_tr IS
  'Advanced document approval steps for Phase 10 expense and petty-cash workflows.';

CREATE INDEX IF NOT EXISTS idx_ofda_tnt
  ON public.org_fin_doc_appr_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofda_src
  ON public.org_fin_doc_appr_tr(tenant_org_id, source_doc_type, source_doc_id);

CREATE INDEX IF NOT EXISTS idx_ofda_stat
  ON public.org_fin_doc_appr_tr(tenant_org_id, status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_cash_rec_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  cashbox_id UUID NOT NULL,
  branch_id UUID,
  recon_no VARCHAR(40) NOT NULL,
  recon_date DATE NOT NULL,
  opening_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
  expected_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
  counted_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
  variance_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  status_code VARCHAR(20) NOT NULL DEFAULT 'OPEN',
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
  CONSTRAINT uq_ofcr_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofcr_no UNIQUE (tenant_org_id, recon_no),
  CONSTRAINT fk_ofcr_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofcr_cash FOREIGN KEY (cashbox_id, tenant_org_id)
    REFERENCES public.org_fin_cashbox_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofcr_brn FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofcr_stat CHECK (
    status_code IN ('OPEN', 'CLOSED', 'LOCKED')
  )
);

COMMENT ON TABLE public.org_fin_cash_rec_mst IS
  'Petty-cash reconciliation headers for advanced cashbox close and lock workflows.';

CREATE INDEX IF NOT EXISTS idx_ofcr_tnt
  ON public.org_fin_cash_rec_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofcr_cash
  ON public.org_fin_cash_rec_mst(tenant_org_id, cashbox_id, recon_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofcr_stat
  ON public.org_fin_cash_rec_mst(tenant_org_id, status_code, recon_date DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_cash_exc_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  cash_recon_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  reason_code VARCHAR(30) NOT NULL,
  amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  note TEXT,
  note2 TEXT,
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
  CONSTRAINT uq_ofce_tid UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofce_lin UNIQUE (tenant_org_id, cash_recon_id, line_no),
  CONSTRAINT fk_ofce_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofce_rec FOREIGN KEY (cash_recon_id, tenant_org_id)
    REFERENCES public.org_fin_cash_rec_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_ofce_lin CHECK (line_no >= 1),
  CONSTRAINT chk_ofce_amt CHECK (amount <> 0)
);

COMMENT ON TABLE public.org_fin_cash_exc_tr IS
  'Petty-cash reconciliation exception rows capturing shortages, overages, and other audited variance causes.';

CREATE INDEX IF NOT EXISTS idx_ofce_tnt
  ON public.org_fin_cash_exc_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofce_rec
  ON public.org_fin_cash_exc_tr(tenant_org_id, cash_recon_id, line_no);

ALTER TABLE public.org_fin_doc_appr_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_cash_rec_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_cash_exc_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isol_ofda ON public.org_fin_doc_appr_tr;
CREATE POLICY tenant_isol_ofda ON public.org_fin_doc_appr_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofcr ON public.org_fin_cash_rec_mst;
CREATE POLICY tenant_isol_ofcr ON public.org_fin_cash_rec_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isol_ofce ON public.org_fin_cash_exc_tr;
CREATE POLICY tenant_isol_ofce ON public.org_fin_cash_exc_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
