-- ==================================================================
-- Migration: 0186_erp_lite_phase3_posting_runtime.sql
-- Purpose: Create ERP-Lite Phase 3 posting log and exception runtime tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 3 - Tenant Finance Schema
-- Notes: This uses a unified posting-log table that also carries attempt-state
--        lifecycle fields, avoiding a second attempt table while preserving
--        retry/repost lineage required by the runtime contract.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_post_log_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  journal_id UUID,
  source_module_code VARCHAR(40) NOT NULL,
  source_doc_type_code VARCHAR(40) NOT NULL,
  source_doc_id UUID NOT NULL,
  source_doc_no VARCHAR(60),
  txn_event_code VARCHAR(60) NOT NULL,
  mapping_rule_id UUID,
  mapping_rule_version_no INTEGER,
  idempotency_key VARCHAR(220) NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  attempt_status_code VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
  log_status_code VARCHAR(20) NOT NULL DEFAULT 'FAILED',
  retry_of_log_id UUID,
  repost_of_log_id UUID,
  request_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_payload_json JSONB,
  preview_result_json JSONB,
  execute_result_json JSONB,
  error_code VARCHAR(60),
  error_message TEXT,
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
  CONSTRAINT uq_ofpl_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT uq_ofpl_attempt UNIQUE (tenant_org_id, idempotency_key, attempt_no),
  CONSTRAINT fk_ofpl_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofpl_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofpl_jrnl FOREIGN KEY (journal_id, tenant_org_id)
    REFERENCES public.org_fin_journal_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofpl_evt FOREIGN KEY (txn_event_code)
    REFERENCES public.sys_fin_evt_cd(evt_code),
  CONSTRAINT fk_ofpl_rule FOREIGN KEY (mapping_rule_id)
    REFERENCES public.sys_fin_map_rule_mst(rule_id),
  CONSTRAINT fk_ofpl_retry FOREIGN KEY (retry_of_log_id, tenant_org_id)
    REFERENCES public.org_fin_post_log_tr(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofpl_repost FOREIGN KEY (repost_of_log_id, tenant_org_id)
    REFERENCES public.org_fin_post_log_tr(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ofpl_astat CHECK (
    attempt_status_code IN (
      'INITIATED',
      'VALIDATED',
      'FAILED_VALIDATION',
      'FAILED_RULE',
      'FAILED_ACCOUNT',
      'FAILED_SYSTEM',
      'POSTED',
      'REVERSED'
    )
  ),
  CONSTRAINT chk_ofpl_lstat CHECK (
    log_status_code IN ('PREVIEWED', 'POSTED', 'FAILED', 'SKIPPED', 'REVERSED')
  ),
  CONSTRAINT chk_ofpl_attempt_no CHECK (attempt_no >= 1),
  CONSTRAINT chk_ofpl_rulever CHECK (
    (mapping_rule_id IS NULL AND mapping_rule_version_no IS NULL)
    OR (mapping_rule_id IS NOT NULL AND mapping_rule_version_no IS NOT NULL)
  )
);

COMMENT ON TABLE public.org_fin_post_log_tr IS
  'Unified posting audit log. Each row represents one posting attempt and its final logged outcome.';
COMMENT ON COLUMN public.org_fin_post_log_tr.attempt_status_code IS
  'Canonical attempt lifecycle state from the runtime contract.';
COMMENT ON COLUMN public.org_fin_post_log_tr.log_status_code IS
  'Audit/log result state retained separately from attempt lifecycle.';
COMMENT ON COLUMN public.org_fin_post_log_tr.retry_of_log_id IS
  'Links a retry attempt to the immediately preceding failed attempt.';
COMMENT ON COLUMN public.org_fin_post_log_tr.repost_of_log_id IS
  'Links a repost attempt to the prior failed attempt after remediation.';

CREATE INDEX IF NOT EXISTS idx_ofpl_tenant
  ON public.org_fin_post_log_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofpl_source
  ON public.org_fin_post_log_tr(tenant_org_id, source_doc_type_code, source_doc_id);

CREATE INDEX IF NOT EXISTS idx_ofpl_evt
  ON public.org_fin_post_log_tr(tenant_org_id, txn_event_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofpl_idem
  ON public.org_fin_post_log_tr(tenant_org_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ofpl_astat
  ON public.org_fin_post_log_tr(tenant_org_id, attempt_status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofpl_lstat
  ON public.org_fin_post_log_tr(tenant_org_id, log_status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofpl_jrnl
  ON public.org_fin_post_log_tr(tenant_org_id, journal_id)
  WHERE journal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofpl_posted
  ON public.org_fin_post_log_tr(tenant_org_id, idempotency_key)
  WHERE attempt_status_code = 'POSTED';

CREATE TABLE IF NOT EXISTS public.org_fin_post_exc_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID,
  posting_log_id UUID NOT NULL,
  source_doc_id UUID NOT NULL,
  source_doc_type_code VARCHAR(40) NOT NULL,
  txn_event_code VARCHAR(60) NOT NULL,
  exception_type_code VARCHAR(40) NOT NULL,
  status_code VARCHAR(20) NOT NULL DEFAULT 'NEW',
  error_message TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(120),
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
  CONSTRAINT uq_ofpe_tenant_id UNIQUE (tenant_org_id, id),
  CONSTRAINT fk_ofpe_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_ofpe_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ofpe_log FOREIGN KEY (posting_log_id, tenant_org_id)
    REFERENCES public.org_fin_post_log_tr(id, tenant_org_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ofpe_evt FOREIGN KEY (txn_event_code)
    REFERENCES public.sys_fin_evt_cd(evt_code),
  CONSTRAINT chk_ofpe_type CHECK (
    exception_type_code IN (
      'RULE_NOT_FOUND',
      'AMBIGUOUS_RULE',
      'ACCOUNT_NOT_FOUND',
      'VALIDATION_ERROR',
      'SYSTEM_ERROR',
      'PERIOD_CLOSED',
      'DUPLICATE_POST',
      'ACCOUNT_INACTIVE',
      'ACCOUNT_NOT_POSTABLE',
      'MISSING_USAGE_MAPPING'
    )
  ),
  CONSTRAINT chk_ofpe_stat CHECK (
    status_code IN (
      'NEW',
      'OPEN',
      'RETRY_PENDING',
      'RETRIED',
      'REPOST_PENDING',
      'REPOSTED',
      'RESOLVED',
      'IGNORED',
      'CLOSED'
    )
  )
);

COMMENT ON TABLE public.org_fin_post_exc_tr IS
  'Tenant posting exception queue records requiring controlled follow-up.';

CREATE INDEX IF NOT EXISTS idx_ofpe_tenant
  ON public.org_fin_post_exc_tr(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_ofpe_stat
  ON public.org_fin_post_exc_tr(tenant_org_id, status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofpe_type
  ON public.org_fin_post_exc_tr(tenant_org_id, exception_type_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofpe_source
  ON public.org_fin_post_exc_tr(tenant_org_id, source_doc_type_code, source_doc_id);

ALTER TABLE public.org_fin_post_log_tr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_fin_post_exc_tr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ofpl ON public.org_fin_post_log_tr;
CREATE POLICY tenant_isolation_ofpl ON public.org_fin_post_log_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_ofpe ON public.org_fin_post_exc_tr;
CREATE POLICY tenant_isolation_ofpe ON public.org_fin_post_exc_tr
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
