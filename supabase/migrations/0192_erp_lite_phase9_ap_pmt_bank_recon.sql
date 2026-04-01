-- ==================================================================
-- Migration: 0192_erp_lite_phase9_ap_pmt_bank_recon.sql
-- Purpose: Create ERP-Lite Phase 9 AP payment and bank reconciliation foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 9 - V2 Treasury + Suppliers + AP/PO
-- Notes: Schema-only foundation. No allocation or matching workflow logic here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_ap_pmt_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  branch_id UUID,
  bank_account_id UUID,
  cashbox_id UUID,
  ap_pmt_no VARCHAR(40) NOT NULL,
  payment_date DATE NOT NULL,
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19, 4) NOT NULL DEFAULT 1,
  amount_total DECIMAL(19, 4) NOT NULL DEFAULT 0,
  settlement_code VARCHAR(12) NOT NULL,
  payment_method_code VARCHAR(40),
  ext_ref_no VARCHAR(120),
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
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
  CONSTRAINT uq_ofap_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofap_no UNIQUE (tenant_org_id, ap_pmt_no),
  CONSTRAINT fk_ofap_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofap_supp FOREIGN KEY (supplier_id, tenant_org_id)
    REFERENCES public.org_fin_supp_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofap_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofap_bank FOREIGN KEY (bank_account_id, tenant_org_id)
    REFERENCES public.org_fin_bank_acct_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofap_cash FOREIGN KEY (cashbox_id, tenant_org_id)
    REFERENCES public.org_fin_cashbox_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofap_amt CHECK (amount_total >= 0),
  CONSTRAINT chk_ofap_setl CHECK (settlement_code IN ('BANK', 'CASH')),
  CONSTRAINT chk_ofap_stat CHECK (status_code IN ('DRAFT', 'POSTED', 'VOID')),
  CONSTRAINT chk_ofap_src CHECK (
    (settlement_code = 'BANK' AND bank_account_id IS NOT NULL AND cashbox_id IS NULL)
    OR (settlement_code = 'CASH' AND cashbox_id IS NOT NULL AND bank_account_id IS NULL)
  )
);

COMMENT ON TABLE public.org_fin_ap_pmt_mst IS
  'Tenant AP payment master supporting payable settlement by bank or cash source.';

CREATE INDEX IF NOT EXISTS idx_ofap_tenant
  ON public.org_fin_ap_pmt_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofap_supp
  ON public.org_fin_ap_pmt_mst(tenant_org_id, supplier_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofap_stat
  ON public.org_fin_ap_pmt_mst(tenant_org_id, status_code, settlement_code);

CREATE TABLE IF NOT EXISTS public.org_fin_ap_alloc_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  ap_payment_id UUID NOT NULL,
  ap_invoice_id UUID NOT NULL,
  alloc_no INTEGER NOT NULL,
  alloc_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
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
  CONSTRAINT uq_ofaa_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofaa_line UNIQUE (tenant_org_id, ap_payment_id, alloc_no),
  CONSTRAINT fk_ofaa_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofaa_pmt FOREIGN KEY (ap_payment_id, tenant_org_id)
    REFERENCES public.org_fin_ap_pmt_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofaa_inv FOREIGN KEY (ap_invoice_id, tenant_org_id)
    REFERENCES public.org_fin_ap_inv_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofaa_no CHECK (alloc_no >= 1),
  CONSTRAINT chk_ofaa_amt CHECK (alloc_amount > 0)
);

COMMENT ON TABLE public.org_fin_ap_alloc_tr IS
  'Tenant AP payment allocation rows linking one payment to one or more AP invoices.';

CREATE INDEX IF NOT EXISTS idx_ofaa_tenant
  ON public.org_fin_ap_alloc_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofaa_pmt
  ON public.org_fin_ap_alloc_tr(tenant_org_id, ap_payment_id, alloc_no);

CREATE INDEX IF NOT EXISTS idx_ofaa_inv
  ON public.org_fin_ap_alloc_tr(tenant_org_id, ap_invoice_id);

CREATE TABLE IF NOT EXISTS public.org_fin_bank_recon_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  period_id UUID,
  recon_code VARCHAR(40) NOT NULL,
  recon_date DATE NOT NULL,
  stmt_date_from DATE NOT NULL,
  stmt_date_to DATE NOT NULL,
  gl_balance DECIMAL(19, 4),
  stmt_balance DECIMAL(19, 4),
  unmatched_amount DECIMAL(19, 4),
  status_code VARCHAR(12) NOT NULL DEFAULT 'OPEN',
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
  CONSTRAINT uq_ofbr_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofbr_code UNIQUE (tenant_org_id, recon_code),
  CONSTRAINT fk_ofbr_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofbr_bank FOREIGN KEY (bank_account_id, tenant_org_id)
    REFERENCES public.org_fin_bank_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofbr_per FOREIGN KEY (period_id, tenant_org_id)
    REFERENCES public.org_fin_period_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofbr_stat CHECK (status_code IN ('OPEN', 'CLOSED', 'LOCKED')),
  CONSTRAINT chk_ofbr_date CHECK (stmt_date_to >= stmt_date_from)
);

COMMENT ON TABLE public.org_fin_bank_recon_mst IS
  'Tenant bank-reconciliation master capturing period-level reconciliation status and balances.';

CREATE INDEX IF NOT EXISTS idx_ofbr_tenant
  ON public.org_fin_bank_recon_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofbr_bank
  ON public.org_fin_bank_recon_mst(tenant_org_id, bank_account_id, recon_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofbr_stat
  ON public.org_fin_bank_recon_mst(tenant_org_id, status_code, stmt_date_to DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_bank_match_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  bank_stmt_line_id UUID NOT NULL,
  bank_recon_id UUID,
  source_doc_type VARCHAR(20) NOT NULL,
  source_doc_id UUID NOT NULL,
  match_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
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
  CONSTRAINT uq_ofbm_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT fk_ofbm_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofbm_stmt FOREIGN KEY (bank_stmt_line_id, tenant_org_id)
    REFERENCES public.org_fin_bank_stmt_dtl(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofbm_rec FOREIGN KEY (bank_recon_id, tenant_org_id)
    REFERENCES public.org_fin_bank_recon_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofbm_amt CHECK (match_amount > 0),
  CONSTRAINT chk_ofbm_src CHECK (
    source_doc_type IN ('AP_PAYMENT', 'AR_PAYMENT', 'BANK_FEE', 'MANUAL_JE')
  ),
  CONSTRAINT chk_ofbm_stat CHECK (
    status_code IN ('DRAFT', 'CONFIRMED', 'REVERSED')
  )
);

COMMENT ON TABLE public.org_fin_bank_match_tr IS
  'Tenant bank-statement matching rows linking statement lines to finance source documents.';

CREATE INDEX IF NOT EXISTS idx_ofbm_tenant
  ON public.org_fin_bank_match_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofbm_stmt
  ON public.org_fin_bank_match_tr(tenant_org_id, bank_stmt_line_id, status_code);

CREATE INDEX IF NOT EXISTS idx_ofbm_src
  ON public.org_fin_bank_match_tr(tenant_org_id, source_doc_type, source_doc_id);

ALTER TABLE public.org_fin_ap_pmt_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_ap_alloc_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_bank_recon_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_bank_match_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofap ON public.org_fin_ap_pmt_mst;
CREATE POLICY tenant_isolation_ofap ON public.org_fin_ap_pmt_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofaa ON public.org_fin_ap_alloc_tr;
CREATE POLICY tenant_isolation_ofaa ON public.org_fin_ap_alloc_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofbr ON public.org_fin_bank_recon_mst;
CREATE POLICY tenant_isolation_ofbr ON public.org_fin_bank_recon_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofbm ON public.org_fin_bank_match_tr;
CREATE POLICY tenant_isolation_ofbm ON public.org_fin_bank_match_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;

