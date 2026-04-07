-- ==================================================================
-- Migration: 0215_erp_lite_readiness_views.sql
-- Purpose: Add operational readiness and control views.
--          Closes DELTA-OPS-001, DELTA-OPS-002, DELTA-OPS-003.
--
-- These views power:
--   - Finance Readiness Dashboard (vw_fin_tenant_readiness)
--   - Usage Mapping Console missing-mapping indicator (vw_fin_missing_required_usage)
--   - Exception Workbench list (vw_fin_open_exceptions)
--
-- All views are tenant-scoped and use only existing tables.
-- No new tables are created in this migration.
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- View: vw_fin_missing_required_usage
-- Lists required usage codes that are not yet ACTIVE-mapped for each
-- tenant, optionally including type mismatch and inactive account issues.
-- Powers the readiness dashboard "missing mappings" section and the
-- Usage Mapping Console filter.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_fin_missing_required_usage AS
SELECT
  t.id                                        AS tenant_org_id,
  uc.usage_code_id,
  uc.usage_code,
  uc.name                                     AS usage_code_name,
  uc.name2                                    AS usage_code_name2,
  uc.is_required_v1                           AS is_required,
  at.acc_type_code                            AS required_acc_type_code,
  at.name                                     AS required_acc_type_name,
  -- current active mapping (NULL when missing)
  m.id                                        AS mapping_id,
  m.account_id                               AS mapped_account_id,
  a.account_code                              AS mapped_account_code,
  a.name                                      AS mapped_account_name,
  a_type.acc_type_code                        AS mapped_acc_type_code,
  -- derived issue classification
  CASE
    WHEN m.id IS NULL                         THEN 'MISSING'
    WHEN a.is_active = false                  THEN 'ACCOUNT_INACTIVE'
    WHEN a.is_postable = false                THEN 'ACCOUNT_NOT_POSTABLE'
    WHEN a.acc_type_id <> uc.primary_acc_type_id THEN 'TYPE_MISMATCH'
    ELSE 'OK'
  END                                         AS mapping_issue,
  m.effective_from,
  m.effective_to,
  m.status_code                               AS mapping_status
FROM public.org_tenants_mst t
  -- cross join all required (v1) usage codes
  CROSS JOIN public.sys_fin_usage_code_cd uc
  LEFT JOIN public.sys_fin_acc_type_cd at
    ON at.acc_type_id = uc.primary_acc_type_id
  -- current ACTIVE global mapping for this tenant + usage code
  LEFT JOIN public.org_fin_usage_map_mst m
    ON  m.tenant_org_id  = t.id
    AND m.usage_code_id  = uc.usage_code_id
    AND m.branch_id IS NULL
    AND m.status_code    = 'ACTIVE'
    AND m.is_active      = true
    AND m.rec_status     = 1
    AND (m.effective_from IS NULL OR m.effective_from <= CURRENT_DATE)
    AND (m.effective_to   IS NULL OR m.effective_to   >= CURRENT_DATE)
  LEFT JOIN public.org_fin_acct_mst a
    ON  a.id            = m.account_id
    AND a.tenant_org_id = t.id
  LEFT JOIN public.sys_fin_acc_type_cd a_type
    ON a_type.acc_type_id = a.acc_type_id
WHERE t.is_active  = true
  AND t.rec_status = 1
  AND uc.is_required_v1 = true;

COMMENT ON VIEW public.vw_fin_missing_required_usage IS
  'Per-tenant list of required usage codes and their current mapping health. '
  'mapping_issue = MISSING, ACCOUNT_INACTIVE, ACCOUNT_NOT_POSTABLE, TYPE_MISMATCH, or OK. '
  'Used by the readiness dashboard and Usage Mapping Console.';

-- ------------------------------------------------------------------
-- View: vw_fin_tenant_readiness
-- Computes a READY / WARNING / NOT_READY classification per tenant.
-- Used by the Finance Readiness Dashboard panel and HQ rollout tooling.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_fin_tenant_readiness AS
WITH
-- count of required usage codes with issues
missing_maps AS (
  SELECT
    tenant_org_id,
    COUNT(*) FILTER (WHERE mapping_issue <> 'OK') AS missing_or_broken_count,
    COUNT(*)                                        AS total_required_count
  FROM public.vw_fin_missing_required_usage
  GROUP BY tenant_org_id
),
-- open posting exception counts
open_exc AS (
  SELECT
    tenant_org_id,
    COUNT(*) AS open_exception_count
  FROM public.org_fin_post_exc_tr
  WHERE status_code NOT IN ('RESOLVED', 'IGNORED', 'CLOSED')
    AND is_active = true
    AND rec_status = 1
  GROUP BY tenant_org_id
),
-- open period existence
open_periods AS (
  SELECT
    tenant_org_id,
    COUNT(*) AS open_period_count
  FROM public.org_fin_period_mst
  WHERE status_code = 'OPEN'
    AND is_active  = true
    AND rec_status = 1
  GROUP BY tenant_org_id
),
-- latest template apply
last_apply AS (
  SELECT DISTINCT ON (tenant_org_id)
    tenant_org_id,
    applied_at          AS last_template_applied_at,
    tpl_pkg_code        AS last_template_pkg_code,
    apply_result_code   AS last_apply_status
  FROM public.org_fin_tpl_apply_log
  ORDER BY tenant_org_id, applied_at DESC
),
-- last posting activity
last_post AS (
  SELECT
    tenant_org_id,
    MAX(created_at) FILTER (WHERE log_status_code = 'POSTED')  AS last_posted_at,
    MAX(created_at) FILTER (WHERE log_status_code = 'FAILED')  AS last_failed_at
  FROM public.org_fin_post_log_tr
  GROUP BY tenant_org_id
),
-- active COA counts
coa_stats AS (
  SELECT
    tenant_org_id,
    COUNT(*)                                    AS total_accounts,
    COUNT(*) FILTER (WHERE is_postable = true)  AS postable_accounts,
    COUNT(*) FILTER (WHERE is_active   = false) AS inactive_accounts
  FROM public.org_fin_acct_mst
  WHERE rec_status = 1
  GROUP BY tenant_org_id
),
-- effective governance assignment
gov_assign AS (
  SELECT tenant_org_id
  FROM public.vw_fin_effective_gov_for_tenant
)
SELECT
  t.id                                        AS tenant_org_id,
  COALESCE(mm.missing_or_broken_count, 0)     AS missing_required_mappings,
  COALESCE(mm.total_required_count,    0)     AS total_required_mappings,
  COALESCE(oe.open_exception_count,    0)     AS open_exception_count,
  COALESCE(op.open_period_count,       0)     AS open_period_count,
  la.last_template_applied_at,
  la.last_template_pkg_code,
  la.last_apply_status,
  lp.last_posted_at,
  lp.last_failed_at,
  COALESCE(cs.total_accounts,      0)         AS total_coa_accounts,
  COALESCE(cs.postable_accounts,   0)         AS postable_coa_accounts,
  COALESCE(cs.inactive_accounts,   0)         AS inactive_coa_accounts,
  -- has an effective governance assignment
  CASE WHEN ga.tenant_org_id IS NOT NULL THEN true ELSE false END AS has_gov_assignment,
  -- derived readiness status
  CASE
    WHEN COALESCE(mm.missing_or_broken_count, 0) > 0
      THEN 'NOT_READY'
    WHEN COALESCE(op.open_period_count, 0) = 0
      THEN 'NOT_READY'
    WHEN ga.tenant_org_id IS NULL
      THEN 'NOT_READY'
    WHEN COALESCE(oe.open_exception_count, 0) > 0
      THEN 'WARNING'
    WHEN la.last_apply_status IS NULL
      THEN 'WARNING'
    ELSE 'READY'
  END                                         AS readiness_status
FROM public.org_tenants_mst t
  LEFT JOIN missing_maps mm ON mm.tenant_org_id = t.id
  LEFT JOIN open_exc     oe ON oe.tenant_org_id = t.id
  LEFT JOIN open_periods op ON op.tenant_org_id = t.id
  LEFT JOIN last_apply   la ON la.tenant_org_id = t.id
  LEFT JOIN last_post    lp ON lp.tenant_org_id = t.id
  LEFT JOIN coa_stats    cs ON cs.tenant_org_id = t.id
  LEFT JOIN gov_assign   ga ON ga.tenant_org_id = t.id
WHERE t.is_active  = true
  AND t.rec_status = 1;

COMMENT ON VIEW public.vw_fin_tenant_readiness IS
  'Finance readiness summary per tenant. readiness_status: READY, WARNING, NOT_READY. '
  'NOT_READY when: missing required usage mappings, no open period, or no governance assignment. '
  'WARNING when: open unresolved exceptions exist or template never applied. '
  'Used by readiness dashboard and HQ rollout tools.';

-- ------------------------------------------------------------------
-- View: vw_fin_open_exceptions
-- Operational queue view for the Exception Workbench.
-- Returns all non-terminal posting exceptions with key context.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_fin_open_exceptions AS
SELECT
  e.id                                        AS exception_id,
  e.tenant_org_id,
  e.branch_id,
  e.posting_log_id,
  e.source_doc_id,
  e.source_doc_type_code,
  e.txn_event_code,
  e.exception_type_code,
  e.status_code,
  e.error_message,
  e.resolution_notes,
  e.resolved_at,
  e.resolved_by,
  e.created_at,
  e.created_by,
  -- posting log context
  pl.idempotency_key,
  pl.attempt_no,
  pl.attempt_status_code,
  pl.log_status_code,
  pl.source_module_code,
  pl.source_doc_no,
  pl.mapping_rule_id,
  pl.mapping_rule_version_no,
  pl.error_code             AS log_error_code,
  pl.retry_of_log_id,
  pl.repost_of_log_id,
  pl.journal_id,
  -- retry/repost eligibility hints (policy enforcement is in service layer)
  CASE
    WHEN e.status_code IN ('NEW','OPEN','RETRY_PENDING') THEN true
    ELSE false
  END                                         AS is_retry_eligible,
  CASE
    WHEN e.status_code IN ('NEW','OPEN','RETRY_PENDING','RETRIED','REPOST_PENDING') THEN true
    ELSE false
  END                                         AS is_repost_eligible
FROM public.org_fin_post_exc_tr e
  LEFT JOIN public.org_fin_post_log_tr pl
    ON  pl.id             = e.posting_log_id
    AND pl.tenant_org_id  = e.tenant_org_id
WHERE e.status_code NOT IN ('RESOLVED', 'IGNORED', 'CLOSED')
  AND e.is_active  = true
  AND e.rec_status = 1;

COMMENT ON VIEW public.vw_fin_open_exceptions IS
  'Operational queue of all non-terminal posting exceptions with posting-log context. '
  'Powers the Exception Workbench list. Excludes RESOLVED, IGNORED, and CLOSED exceptions. '
  'is_retry_eligible and is_repost_eligible are hints; service layer enforces policy.';

COMMIT;
