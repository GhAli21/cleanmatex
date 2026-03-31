-- ==================================================================
-- Migration: 0185_erp_lite_phase3_journals.sql
-- Purpose: Create ERP-Lite Phase 3 tenant journal master and detail
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 3 - Tenant Finance Schema
-- Notes: Runtime reporting and posting engine logic are implemented later.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_journal_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  journal_no VARCHAR(40) NOT NULL,
  journal_date DATE NOT NULL,
  posting_date DATE NOT NULL,
  source_module_code VARCHAR(40) NOT NULL,
  source_doc_type_code VARCHAR(40) NOT NULL,
  source_doc_id UUID NOT NULL,
  source_doc_no VARCHAR(60),
  txn_event_code VARCHAR(60) NOT NULL,
  mapping_rule_id UUID,
  mapping_rule_version_no INTEGER,
  currency_code VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(19,4) NOT NULL DEFAULT 1.0000,
  total_debit DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  total_credit DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  status_code VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  narration TEXT,
  narration2 TEXT,
  reversal_of_journal_id UUID,
  posted_at TIMESTAMP,
  posted_by VARCHAR(120),
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
  CONSTRAINT uq_ofj_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofj_tenant_no UNIQUE (tenant_org_id, journal_no),
  CONSTRAINT fk_ofj_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofj_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofj_evt FOREIGN KEY (txn_event_code)
    REFERENCES public.sys_fin_evt_cd(evt_code),
  CONSTRAINT fk_ofj_rule FOREIGN KEY (mapping_rule_id)
    REFERENCES public.sys_fin_map_rule_mst(rule_id),
  CONSTRAINT fk_ofj_rev FOREIGN KEY (reversal_of_journal_id, tenant_org_id)
    REFERENCES public.org_fin_journal_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_ofj_stat CHECK (status_code IN ('DRAFT', 'POSTED', 'FAILED', 'REVERSED')),
  CONSTRAINT chk_ofj_totals CHECK (total_debit >= 0 AND total_credit >= 0),
  CONSTRAINT chk_ofj_rulever CHECK (
    (mapping_rule_id IS NULL AND mapping_rule_version_no IS NULL)
    OR (mapping_rule_id IS NOT NULL AND mapping_rule_version_no IS NOT NULL)
  ),
  CONSTRAINT chk_ofj_bal_post CHECK (
    status_code <> 'POSTED'
    OR (
      total_debit = total_credit
      AND total_debit > 0
      AND total_credit > 0
    )
  )
);

COMMENT ON TABLE public.org_fin_journal_mst IS
  'Tenant journal header used as the general ledger source of truth.';
COMMENT ON COLUMN public.org_fin_journal_mst.mapping_rule_version_no IS
  'Captured rule version for immutable posting traceability.';
COMMENT ON COLUMN public.org_fin_journal_mst.reversal_of_journal_id IS
  'Links reversal journals to the original immutable posted journal.';

CREATE INDEX IF NOT EXISTS idx_ofj_tenant
  ON public.org_fin_journal_mst(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofj_date
  ON public.org_fin_journal_mst(tenant_org_id, posting_date DESC);

CREATE INDEX IF NOT EXISTS idx_ofj_source
  ON public.org_fin_journal_mst(tenant_org_id, source_doc_type_code, source_doc_id);

CREATE INDEX IF NOT EXISTS idx_ofj_evt
  ON public.org_fin_journal_mst(tenant_org_id, txn_event_code, status_code);

CREATE INDEX IF NOT EXISTS idx_ofj_branch
  ON public.org_fin_journal_mst(tenant_org_id, branch_id, posting_date DESC)
  WHERE branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.org_fin_journal_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  journal_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  branch_id UUID,
  account_id UUID NOT NULL,
  entry_side VARCHAR(10) NOT NULL,
  amount_txn_currency DECIMAL(19,4) NOT NULL,
  amount_base_currency DECIMAL(19,4) NOT NULL,
  line_description TEXT,
  line_description2 TEXT,
  cost_center_id UUID,
  profit_center_id UUID,
  party_type_code VARCHAR(30),
  party_id UUID,
  tax_code VARCHAR(40),
  tax_rate DECIMAL(19,4),
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
  CONSTRAINT uq_ofjd_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofjd_line UNIQUE (tenant_org_id, journal_id, line_no),
  CONSTRAINT fk_ofjd_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofjd_jrnl FOREIGN KEY (journal_id, tenant_org_id)
    REFERENCES public.org_fin_journal_mst(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofjd_acct FOREIGN KEY (account_id, tenant_org_id)
    REFERENCES public.org_fin_acct_mst(id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ofjd_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofjd_side CHECK (entry_side IN ('DEBIT', 'CREDIT')),
  CONSTRAINT chk_ofjd_amt CHECK (
    amount_txn_currency > 0
    AND amount_base_currency > 0
  )
);

COMMENT ON TABLE public.org_fin_journal_dtl IS
  'Tenant journal lines carrying debit and credit postings per account.';

CREATE INDEX IF NOT EXISTS idx_ofjd_tenant
  ON public.org_fin_journal_dtl(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofjd_jrnl
  ON public.org_fin_journal_dtl(tenant_org_id, journal_id, line_no);

CREATE INDEX IF NOT EXISTS idx_ofjd_acct
  ON public.org_fin_journal_dtl(tenant_org_id, account_id);

CREATE INDEX IF NOT EXISTS idx_ofjd_branch
  ON public.org_fin_journal_dtl(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.org_fin_journal_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_journal_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofj ON public.org_fin_journal_mst;
CREATE POLICY tenant_isolation_ofj ON public.org_fin_journal_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofjd ON public.org_fin_journal_dtl;
CREATE POLICY tenant_isolation_ofjd ON public.org_fin_journal_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
