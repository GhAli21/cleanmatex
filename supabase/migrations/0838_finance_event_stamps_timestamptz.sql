-- Finance and invoice event stamps become timestamptz.
-- handed_to_date is an instant: invoice readers emit an ISO timestamp. It is not a civil date.

BEGIN;

DROP VIEW IF EXISTS public.vw_fin_tenant_readiness RESTRICT;
DROP VIEW IF EXISTS public.vw_fin_effective_gov_for_tenant RESTRICT;
DROP VIEW IF EXISTS public.vw_fin_open_exceptions RESTRICT;
-- org_fin_bank_recon_mst.closed_at
ALTER TABLE public.org_fin_bank_recon_mst ALTER COLUMN closed_at TYPE timestamptz USING closed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_recon_mst.closed_at IS 'UTC instant (closed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_bank_stmt_mst.imported_at
ALTER TABLE public.org_fin_bank_stmt_mst ALTER COLUMN imported_at TYPE timestamptz USING imported_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_bank_stmt_mst.imported_at IS 'UTC instant (imported_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_bank_stmt_mst ALTER COLUMN imported_at SET DEFAULT now();

-- org_fin_cash_rec_mst.closed_at
ALTER TABLE public.org_fin_cash_rec_mst ALTER COLUMN closed_at TYPE timestamptz USING closed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_cash_rec_mst.closed_at IS 'UTC instant (closed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_doc_appr_tr.action_at
ALTER TABLE public.org_fin_doc_appr_tr ALTER COLUMN action_at TYPE timestamptz USING action_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_doc_appr_tr.action_at IS 'UTC instant (action_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_gov_assign_mst.approved_at
ALTER TABLE public.org_fin_gov_assign_mst ALTER COLUMN approved_at TYPE timestamptz USING approved_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_gov_assign_mst.approved_at IS 'UTC instant (approved_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_journal_mst.posted_at
ALTER TABLE public.org_fin_journal_mst ALTER COLUMN posted_at TYPE timestamptz USING posted_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_journal_mst.posted_at IS 'UTC instant (posted_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_period_mst.closed_at
ALTER TABLE public.org_fin_period_mst ALTER COLUMN closed_at TYPE timestamptz USING closed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_period_mst.closed_at IS 'UTC instant (closed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_post_exc_tr.resolved_at
ALTER TABLE public.org_fin_post_exc_tr ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_post_exc_tr.resolved_at IS 'UTC instant (resolved_at). Converted from a naive stamp written while the database session was UTC.';

-- org_fin_tpl_apply_log.applied_at
ALTER TABLE public.org_fin_tpl_apply_log ALTER COLUMN applied_at TYPE timestamptz USING applied_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_fin_tpl_apply_log.applied_at IS 'UTC instant (applied_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_fin_tpl_apply_log ALTER COLUMN applied_at SET DEFAULT now();

-- org_invoice_mst.handed_to_date
ALTER TABLE public.org_invoice_mst ALTER COLUMN handed_to_date TYPE timestamptz USING handed_to_date AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_invoice_mst.handed_to_date IS 'UTC instant (handed_to_date). Converted from a naive stamp written while the database session was UTC. Invoice readers emit an ISO timestamp, so this is an instant, not a civil date.';

-- org_invoice_mst.paid_at
ALTER TABLE public.org_invoice_mst ALTER COLUMN paid_at TYPE timestamptz USING paid_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_invoice_mst.paid_at IS 'UTC instant (paid_at). Converted from a naive stamp written while the database session was UTC.';

CREATE VIEW public.vw_fin_effective_gov_for_tenant AS
 SELECT a.tenant_org_id,
    a.id AS assignment_id,
    a.pkg_id,
    p.pkg_code,
    p.version_no AS pkg_version,
    p.compat_version,
    p.status_code AS pkg_status_code,
    p.effective_from AS pkg_effective_from,
    p.effective_to AS pkg_effective_to,
    a.effective_from AS assign_effective_from,
    a.effective_to AS assign_effective_to,
    a.assignment_mode,
    a.approved_at,
    a.approved_by
   FROM org_fin_gov_assign_mst a
     JOIN sys_fin_gov_pkg_mst p ON p.pkg_id = a.pkg_id
  WHERE a.is_current = true AND a.status_code::text = 'ACTIVE'::text AND a.is_active = true AND a.rec_status = 1 AND p.status_code::text = 'PUBLISHED'::text AND p.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_effective_gov_for_tenant IS 'Current effective governance package per tenant. Used by the posting engine to resolve the single authoritative package for rule/policy selection. Returns zero rows when no valid assignment exists (finance posting will fail). Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_effective_gov_for_tenant FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_effective_gov_for_tenant TO service_role;

CREATE VIEW public.vw_fin_open_exceptions AS
 SELECT e.id AS exception_id,
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
    pl.idempotency_key,
    pl.attempt_no,
    pl.attempt_status_code,
    pl.log_status_code,
    pl.source_module_code,
    pl.source_doc_no,
    pl.mapping_rule_id,
    pl.mapping_rule_version_no,
    pl.error_code AS log_error_code,
    pl.retry_of_log_id,
    pl.repost_of_log_id,
    pl.journal_id,
        CASE
            WHEN e.status_code::text = ANY (ARRAY['NEW'::character varying, 'OPEN'::character varying, 'RETRY_PENDING'::character varying]::text[]) THEN true
            ELSE false
        END AS is_retry_eligible,
        CASE
            WHEN e.status_code::text = ANY (ARRAY['NEW'::character varying, 'OPEN'::character varying, 'RETRY_PENDING'::character varying, 'RETRIED'::character varying, 'REPOST_PENDING'::character varying]::text[]) THEN true
            ELSE false
        END AS is_repost_eligible
   FROM org_fin_post_exc_tr e
     LEFT JOIN org_fin_post_log_tr pl ON pl.id = e.posting_log_id AND pl.tenant_org_id = e.tenant_org_id
  WHERE (e.status_code::text <> ALL (ARRAY['RESOLVED'::character varying, 'IGNORED'::character varying, 'CLOSED'::character varying]::text[])) AND e.is_active = true AND e.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_open_exceptions IS 'Operational queue of all non-terminal posting exceptions with posting-log context. Powers the Exception Workbench list. Excludes RESOLVED, IGNORED, and CLOSED exceptions. is_retry_eligible and is_repost_eligible are hints; service layer enforces policy. Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_open_exceptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_open_exceptions TO service_role;

CREATE VIEW public.vw_fin_tenant_readiness AS
 WITH missing_maps AS (
         SELECT vw_fin_missing_required_usage.tenant_org_id,
            count(*) FILTER (WHERE vw_fin_missing_required_usage.mapping_issue <> 'OK'::text) AS missing_or_broken_count,
            count(*) AS total_required_count
           FROM vw_fin_missing_required_usage
          GROUP BY vw_fin_missing_required_usage.tenant_org_id
        ), open_exc AS (
         SELECT org_fin_post_exc_tr.tenant_org_id,
            count(*) AS open_exception_count
           FROM org_fin_post_exc_tr
          WHERE (org_fin_post_exc_tr.status_code::text <> ALL (ARRAY['RESOLVED'::character varying, 'IGNORED'::character varying, 'CLOSED'::character varying]::text[])) AND org_fin_post_exc_tr.is_active = true AND org_fin_post_exc_tr.rec_status = 1
          GROUP BY org_fin_post_exc_tr.tenant_org_id
        ), open_periods AS (
         SELECT org_fin_period_mst.tenant_org_id,
            count(*) AS open_period_count
           FROM org_fin_period_mst
          WHERE org_fin_period_mst.status_code::text = 'OPEN'::text AND org_fin_period_mst.is_active = true AND org_fin_period_mst.rec_status = 1
          GROUP BY org_fin_period_mst.tenant_org_id
        ), last_apply AS (
         SELECT DISTINCT ON (org_fin_tpl_apply_log.tenant_org_id) org_fin_tpl_apply_log.tenant_org_id,
            org_fin_tpl_apply_log.applied_at AS last_template_applied_at,
            org_fin_tpl_apply_log.tpl_pkg_code AS last_template_pkg_code,
            org_fin_tpl_apply_log.apply_result_code AS last_apply_status
           FROM org_fin_tpl_apply_log
          ORDER BY org_fin_tpl_apply_log.tenant_org_id, org_fin_tpl_apply_log.applied_at DESC
        ), last_post AS (
         SELECT org_fin_post_log_tr.tenant_org_id,
            max(org_fin_post_log_tr.created_at) FILTER (WHERE org_fin_post_log_tr.log_status_code::text = 'POSTED'::text) AS last_posted_at,
            max(org_fin_post_log_tr.created_at) FILTER (WHERE org_fin_post_log_tr.log_status_code::text = 'FAILED'::text) AS last_failed_at
           FROM org_fin_post_log_tr
          GROUP BY org_fin_post_log_tr.tenant_org_id
        ), coa_stats AS (
         SELECT org_fin_acct_mst.tenant_org_id,
            count(*) AS total_accounts,
            count(*) FILTER (WHERE org_fin_acct_mst.is_postable = true) AS postable_accounts,
            count(*) FILTER (WHERE org_fin_acct_mst.is_active = false) AS inactive_accounts
           FROM org_fin_acct_mst
          WHERE org_fin_acct_mst.rec_status = 1
          GROUP BY org_fin_acct_mst.tenant_org_id
        ), gov_assign AS (
         SELECT vw_fin_effective_gov_for_tenant.tenant_org_id
           FROM vw_fin_effective_gov_for_tenant
        )
 SELECT t.id AS tenant_org_id,
    COALESCE(mm.missing_or_broken_count, 0::bigint) AS missing_required_mappings,
    COALESCE(mm.total_required_count, 0::bigint) AS total_required_mappings,
    COALESCE(oe.open_exception_count, 0::bigint) AS open_exception_count,
    COALESCE(op.open_period_count, 0::bigint) AS open_period_count,
    la.last_template_applied_at,
    la.last_template_pkg_code,
    la.last_apply_status,
    lp.last_posted_at,
    lp.last_failed_at,
    COALESCE(cs.total_accounts, 0::bigint) AS total_coa_accounts,
    COALESCE(cs.postable_accounts, 0::bigint) AS postable_coa_accounts,
    COALESCE(cs.inactive_accounts, 0::bigint) AS inactive_coa_accounts,
        CASE
            WHEN ga.tenant_org_id IS NOT NULL THEN true
            ELSE false
        END AS has_gov_assignment,
        CASE
            WHEN COALESCE(mm.missing_or_broken_count, 0::bigint) > 0 THEN 'NOT_READY'::text
            WHEN COALESCE(op.open_period_count, 0::bigint) = 0 THEN 'NOT_READY'::text
            WHEN ga.tenant_org_id IS NULL THEN 'NOT_READY'::text
            WHEN COALESCE(oe.open_exception_count, 0::bigint) > 0 THEN 'WARNING'::text
            WHEN la.last_apply_status IS NULL THEN 'WARNING'::text
            ELSE 'READY'::text
        END AS readiness_status
   FROM org_tenants_mst t
     LEFT JOIN missing_maps mm ON mm.tenant_org_id = t.id
     LEFT JOIN open_exc oe ON oe.tenant_org_id = t.id
     LEFT JOIN open_periods op ON op.tenant_org_id = t.id
     LEFT JOIN last_apply la ON la.tenant_org_id = t.id
     LEFT JOIN last_post lp ON lp.tenant_org_id = t.id
     LEFT JOIN coa_stats cs ON cs.tenant_org_id = t.id
     LEFT JOIN gov_assign ga ON ga.tenant_org_id = t.id
  WHERE t.is_active = true AND t.rec_status = 1;;
COMMENT ON VIEW public.vw_fin_tenant_readiness IS 'Finance readiness summary per tenant. readiness_status: READY, WARNING, NOT_READY. NOT_READY when: missing required usage mappings, no open period, or no governance assignment. WARNING when: open unresolved exceptions exist or template never applied. Used by readiness dashboard and HQ rollout tools. Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.vw_fin_tenant_readiness FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.vw_fin_tenant_readiness TO service_role;

COMMIT;
