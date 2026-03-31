-- ==================================================================
-- Migration: 0188_erp_lite_phase7_petty_cash.sql
-- Purpose: Create ERP-Lite Phase 7 petty cash cashbox and transaction tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 7 - Basic Expenses and Petty Cash
-- Notes: Runtime source tables only. Running balance must remain derived
--        from transactions. Do NOT apply automatically.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_cashbox_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  account_id UUID NOT NULL,
  cashbox_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  currency_code VARCHAR(10) NOT NULL,
  opening_date DATE,
  opening_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_ofc_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofc_tenant_code UNIQUE (tenant_org_id, cashbox_code),
  CONSTRAINT fk_ofc_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofc_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofc_acct FOREIGN KEY (account_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofc_open CHECK (opening_balance >= 0)
);

COMMENT ON TABLE public.org_fin_cashbox_mst IS
  'Tenant petty cash cashbox master. Current balance must be derived from opening balance plus ledger transactions.';
COMMENT ON COLUMN public.org_fin_cashbox_mst.account_id IS
  'Tenant COA account representing this petty cash box in ERP-Lite.';

CREATE INDEX IF NOT EXISTS idx_ofc_tenant
  ON public.org_fin_cashbox_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofc_branch
  ON public.org_fin_cashbox_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofc_acct
  ON public.org_fin_cashbox_mst(tenant_org_id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofc_default
  ON public.org_fin_cashbox_mst(tenant_org_id)
  WHERE is_default = true AND is_active = true AND rec_status = 1;

CREATE TABLE IF NOT EXISTS public.org_fin_cash_txn_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  cashbox_id UUID NOT NULL,
  branch_id UUID,
  txn_no VARCHAR(60) NOT NULL,
  txn_date DATE NOT NULL,
  posting_date DATE,
  txn_type_code VARCHAR(20) NOT NULL,
  status_code VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19, 8) NOT NULL DEFAULT 1,
  amount_total DECIMAL(19, 4) NOT NULL,
  funding_usage_code_id UUID,
  expense_usage_code_id UUID,
  reference_no VARCHAR(80),
  party_name VARCHAR(250),
  party_name2 VARCHAR(250),
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
  CONSTRAINT uq_ofct_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofct_tenant_no UNIQUE (tenant_org_id, txn_no),
  CONSTRAINT fk_ofct_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofct_cash FOREIGN KEY (cashbox_id, tenant_org_id)
    REFERENCES public.org_fin_cashbox_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofct_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofct_fund FOREIGN KEY (funding_usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT fk_ofct_exp FOREIGN KEY (expense_usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT chk_ofct_type CHECK (
    txn_type_code IN ('TOPUP', 'SPEND')
  ),
  CONSTRAINT chk_ofct_stat CHECK (
    status_code IN ('DRAFT', 'RECORDED', 'CANCELLED')
  ),
  CONSTRAINT chk_ofct_fx CHECK (exchange_rate > 0),
  CONSTRAINT chk_ofct_amt CHECK (amount_total >= 0),
  CONSTRAINT chk_ofct_usage CHECK (
    (txn_type_code = 'TOPUP' AND funding_usage_code_id IS NOT NULL AND expense_usage_code_id IS NULL)
    OR (txn_type_code = 'SPEND' AND expense_usage_code_id IS NOT NULL AND funding_usage_code_id IS NULL)
  )
);

COMMENT ON TABLE public.org_fin_cash_txn_tr IS
  'Petty cash ledger transactions for top-up and spend flows.';
COMMENT ON COLUMN public.org_fin_cash_txn_tr.funding_usage_code_id IS
  'Governed usage classification for the non-cashbox side of a top-up entry.';
COMMENT ON COLUMN public.org_fin_cash_txn_tr.expense_usage_code_id IS
  'Governed usage classification for petty cash spend expense resolution.';

CREATE INDEX IF NOT EXISTS idx_ofct_tenant
  ON public.org_fin_cash_txn_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofct_cash
  ON public.org_fin_cash_txn_tr(tenant_org_id, cashbox_id, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofct_type
  ON public.org_fin_cash_txn_tr(tenant_org_id, txn_type_code, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofct_branch
  ON public.org_fin_cash_txn_tr(tenant_org_id, branch_id, txn_date DESC)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.org_fin_cashbox_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_cash_txn_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofc ON public.org_fin_cashbox_mst;
CREATE POLICY tenant_isolation_ofc ON public.org_fin_cashbox_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofct ON public.org_fin_cash_txn_tr;
CREATE POLICY tenant_isolation_ofct ON public.org_fin_cash_txn_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
