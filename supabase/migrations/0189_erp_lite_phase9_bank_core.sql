-- ==================================================================
-- Migration: 0189_erp_lite_phase9_bank_core.sql
-- Purpose: Create ERP-Lite Phase 9 bank account and statement foundations
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 9 - V2 Treasury + Suppliers + AP/PO
-- Notes: Schema-only foundation. No import parsing or matching logic here.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_bank_acct_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  account_id UUID NOT NULL,
  bank_code VARCHAR(40) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  bank_name VARCHAR(250),
  bank_name2 VARCHAR(250),
  bank_account_no VARCHAR(80) NOT NULL,
  iban_no VARCHAR(50),
  currency_code VARCHAR(10) NOT NULL,
  stmt_import_mode VARCHAR(12) NOT NULL DEFAULT 'CSV',
  match_mode VARCHAR(12) NOT NULL DEFAULT 'STRICT',
  allow_auto_match BOOLEAN NOT NULL DEFAULT false,
  status_code VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  last_stmt_date DATE,
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
  CONSTRAINT uq_ofba_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofba_code UNIQUE (tenant_org_id, bank_code),
  CONSTRAINT uq_ofba_acct UNIQUE (tenant_org_id, account_id),
  CONSTRAINT fk_ofba_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofba_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofba_acct FOREIGN KEY (account_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofba_code CHECK (btrim(bank_code) <> ''),
  CONSTRAINT chk_ofba_acno CHECK (btrim(bank_account_no) <> ''),
  CONSTRAINT chk_ofba_mode CHECK (stmt_import_mode IN ('CSV', 'MANUAL', 'API')),
  CONSTRAINT chk_ofba_match CHECK (match_mode IN ('STRICT', 'ASSISTED')),
  CONSTRAINT chk_ofba_stat CHECK (status_code IN ('ACTIVE', 'INACTIVE', 'CLOSED'))
);

COMMENT ON TABLE public.org_fin_bank_acct_mst IS
  'Tenant bank-account master linked to governed finance accounts and later statement import flows.';

CREATE INDEX IF NOT EXISTS idx_ofba_tenant
  ON public.org_fin_bank_acct_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofba_branch
  ON public.org_fin_bank_acct_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofba_stat
  ON public.org_fin_bank_acct_mst(tenant_org_id, status_code, is_active);

CREATE TABLE IF NOT EXISTS public.org_fin_bank_stmt_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  import_batch_no VARCHAR(40) NOT NULL,
  source_code VARCHAR(12) NOT NULL DEFAULT 'CSV',
  source_file_name VARCHAR(260),
  stmt_date_from DATE NOT NULL,
  stmt_date_to DATE NOT NULL,
  opening_balance DECIMAL(19, 4),
  closing_balance DECIMAL(19, 4),
  line_count INTEGER NOT NULL DEFAULT 0,
  status_code VARCHAR(12) NOT NULL DEFAULT 'IMPORTED',
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  CONSTRAINT uq_ofbs_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofbs_batch UNIQUE (tenant_org_id, import_batch_no),
  CONSTRAINT fk_ofbs_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofbs_bank FOREIGN KEY (bank_account_id, tenant_org_id)
    REFERENCES public.org_fin_bank_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofbs_src CHECK (source_code IN ('CSV', 'MANUAL', 'API')),
  CONSTRAINT chk_ofbs_stat CHECK (status_code IN ('IMPORTED', 'PARTIAL', 'RECONCILED', 'VOID')),
  CONSTRAINT chk_ofbs_date CHECK (stmt_date_to >= stmt_date_from),
  CONSTRAINT chk_ofbs_line CHECK (line_count >= 0)
);

COMMENT ON TABLE public.org_fin_bank_stmt_mst IS
  'Tenant bank-statement import header preserving batch-level traceability.';

CREATE INDEX IF NOT EXISTS idx_ofbs_tenant
  ON public.org_fin_bank_stmt_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofbs_bank
  ON public.org_fin_bank_stmt_mst(tenant_org_id, bank_account_id, stmt_date_to DESC);

CREATE INDEX IF NOT EXISTS idx_ofbs_stat
  ON public.org_fin_bank_stmt_mst(tenant_org_id, status_code, imported_at DESC);

CREATE TABLE IF NOT EXISTS public.org_fin_bank_stmt_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  bank_stmt_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  txn_date DATE NOT NULL,
  value_date DATE,
  ext_ref_no VARCHAR(120),
  description TEXT,
  description2 TEXT,
  debit_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(19, 4),
  source_hash VARCHAR(128) NOT NULL,
  match_status VARCHAR(12) NOT NULL DEFAULT 'UNMATCHED',
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
  CONSTRAINT uq_ofbd_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofbd_line UNIQUE (tenant_org_id, bank_stmt_id, line_no),
  CONSTRAINT fk_ofbd_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofbd_stmt FOREIGN KEY (bank_stmt_id, tenant_org_id)
    REFERENCES public.org_fin_bank_stmt_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofbd_bank FOREIGN KEY (bank_account_id, tenant_org_id)
    REFERENCES public.org_fin_bank_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofbd_line CHECK (line_no >= 1),
  CONSTRAINT chk_ofbd_amt CHECK (debit_amount >= 0 AND credit_amount >= 0),
  CONSTRAINT chk_ofbd_match CHECK (match_status IN ('UNMATCHED', 'PARTIAL', 'MATCHED', 'EXCLUDED'))
);

COMMENT ON TABLE public.org_fin_bank_stmt_dtl IS
  'Tenant bank-statement lines preserving source-level transaction traceability for later matching.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofbd_hash
  ON public.org_fin_bank_stmt_dtl(tenant_org_id, bank_account_id, source_hash)
  WHERE is_active = true
    AND rec_status = 1;

CREATE INDEX IF NOT EXISTS idx_ofbd_tenant
  ON public.org_fin_bank_stmt_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofbd_stmt
  ON public.org_fin_bank_stmt_dtl(tenant_org_id, bank_stmt_id, line_no);

CREATE INDEX IF NOT EXISTS idx_ofbd_match
  ON public.org_fin_bank_stmt_dtl(tenant_org_id, match_status, txn_date DESC);

ALTER TABLE public.org_fin_bank_acct_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_bank_stmt_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_bank_stmt_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofba ON public.org_fin_bank_acct_mst;
CREATE POLICY tenant_isolation_ofba ON public.org_fin_bank_acct_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofbs ON public.org_fin_bank_stmt_mst;
CREATE POLICY tenant_isolation_ofbs ON public.org_fin_bank_stmt_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofbd ON public.org_fin_bank_stmt_dtl;
CREATE POLICY tenant_isolation_ofbd ON public.org_fin_bank_stmt_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;

