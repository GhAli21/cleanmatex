-- =============================================================================
-- 0558_pos_session_rollover_foundation.sql
-- POS Session & Cash Drawer Hardening — B2: business date, branch timezone, rollover,
-- stale-session surfacing.
--
-- WHY
--   A POS session records the business date it was opened on, but nothing ever acted on a
--   session that outlives its business day: a cashier who forgets to close at night keeps taking
--   payments into "yesterday". The tenant setting `pos_session_rollover_mode` (OFF |
--   PAUSE_AT_ROLLOVER | FORCE_CLOSE_AT_ROLLOVER) and `pos_session_stale_hours` already exist
--   (0515) but had no executor. This migration adds the storage and the scheduled job:
--     1. a per-branch timezone (NULL = inherit the tenant timezone) — the business day belongs to
--        the branch, and branches of one tenant can sit in different countries;
--     2. three lifecycle columns on POS sessions recording that the rollover job acted on the
--        session, when it was flagged stale, and why it was closed automatically;
--     3. event types so the automatic actions appear in the session timeline;
--     4. the `pos_session_rollover` finance job on the existing pg_cron -> /api/finance/process-jobs
--        infrastructure (0429/0505/0511) — no second scheduler;
--     5. Notification Hub registration (category, two events, IN_APP channel, default templates)
--        so a stale or rolled-over session reaches the cashier and the managers.
--
-- NO TIMEZONE DEFAULT (CLAUDE.md database rule)
--   Neither column nor function supplies a timezone. A branch with no timezone inherits the
--   tenant's; a tenant with none is a configuration error the application reports as
--   TENANT_TIMEZONE_NOT_CONFIGURED — it never silently becomes Muscat.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO UPDATE, constraints dropped-if-exists then re-added.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Branch timezone
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_branches_mst
  ADD COLUMN IF NOT EXISTS timezone_code TEXT NULL;

ALTER TABLE public.org_branches_mst
  DROP CONSTRAINT IF EXISTS fk_branch_timezone;

ALTER TABLE public.org_branches_mst
  ADD CONSTRAINT fk_branch_timezone
    FOREIGN KEY (timezone_code) REFERENCES public.sys_timezone_cd (code);

COMMENT ON COLUMN public.org_branches_mst.timezone_code IS
  'IANA timezone of this branch (sys_timezone_cd.code), used to decide the branch business date and when a POS session rolls over. NULL inherits org_tenants_mst.timezone; there is deliberately no default — a branch and tenant with no timezone is a configuration error (TENANT_TIMEZONE_NOT_CONFIGURED).';
COMMENT ON CONSTRAINT fk_branch_timezone ON public.org_branches_mst IS
  'The branch timezone must be a catalogued IANA timezone.';

-- -----------------------------------------------------------------------------
-- 2. POS session lifecycle columns for the rollover job
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_pos_sessions_mst
  ADD COLUMN IF NOT EXISTS rollover_applied_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS stale_flagged_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS auto_close_reason   TEXT NULL;

ALTER TABLE public.org_pos_sessions_mst
  DROP CONSTRAINT IF EXISTS chk_ops_auto_close_reason;

ALTER TABLE public.org_pos_sessions_mst
  ADD CONSTRAINT chk_ops_auto_close_reason
    CHECK (auto_close_reason IS NULL OR auto_close_reason IN ('ROLLOVER'));

COMMENT ON COLUMN public.org_pos_sessions_mst.rollover_applied_at IS
  'When the rollover job acted on this session because the branch business date moved past business_date (paused or force-closed per pos_session_rollover_mode). NULL = never rolled over. A session with this set cannot be resumed — the cashier closes it and opens a new one, so no payment is ever booked into a past business day.';
COMMENT ON COLUMN public.org_pos_sessions_mst.stale_flagged_at IS
  'When the session was first flagged stale (open or paused longer than pos_session_stale_hours). NULL = not flagged. Drives the stale badge on the POS Sessions hub and the pos_session.stale notification; set once, never cleared.';
COMMENT ON COLUMN public.org_pos_sessions_mst.auto_close_reason IS
  'Why the system, not a person, closed the session. ROLLOVER = force-closed by the business-day rollover job. NULL = closed by a person (or not closed).';
COMMENT ON CONSTRAINT chk_ops_auto_close_reason ON public.org_pos_sessions_mst IS
  'Allowed automatic-close reasons; mirrored by POS_SESSION_AUTO_CLOSE_REASON in lib/constants/pos-session.ts.';

-- The rollover/stale sweep only ever looks at live sessions; keep it off the full history.
CREATE INDEX IF NOT EXISTS idx_ops_live_sweep
  ON public.org_pos_sessions_mst (tenant_org_id, branch_id, opened_at)
  WHERE status IN ('OPEN', 'PAUSED') AND is_active;

COMMENT ON INDEX public.idx_ops_live_sweep IS
  'Partial index for the pos_session_rollover job: live (OPEN/PAUSED, active) sessions only, per tenant and branch.';

-- -----------------------------------------------------------------------------
-- 3. Session timeline event types
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_pos_session_event_type_cd
  (code, name, name2, description, description2, display_order, is_active, rec_status, created_by)
VALUES
  ('ROLLOVER_PAUSE',       'Paused at Rollover',       'إيقاف مؤقت عند تدوير اليوم',
   'The business day changed while the session was open; the system paused it',
   'تغيّر يوم العمل أثناء فتح الجلسة فأوقفها النظام مؤقتاً', 80, TRUE, 1, 'system_admin'),
  ('ROLLOVER_FORCE_CLOSE', 'Force-Closed at Rollover', 'إغلاق إجباري عند تدوير اليوم',
   'The business day changed while the session was open; the system force-closed it',
   'تغيّر يوم العمل أثناء فتح الجلسة فأغلقها النظام إجبارياً', 90, TRUE, 1, 'system_admin'),
  ('STALE_FLAGGED',        'Flagged Stale',            'تنبيه جلسة راكدة',
   'The session stayed open longer than the configured stale threshold',
   'بقيت الجلسة مفتوحة أطول من حد الركود المحدد', 100, TRUE, 1, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  description  = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order= EXCLUDED.display_order,
  is_active    = TRUE;

-- -----------------------------------------------------------------------------
-- 4. Register the pos_session_rollover job on the finance-jobs infrastructure
--    (sys_fin_job_run_log / fin_trigger_job / fin_list_job_schedules — 0429/0505/0511)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_fin_job_run_log
  DROP CONSTRAINT chk_fjrl_job_code RESTRICT;

ALTER TABLE public.sys_fin_job_run_log
  ADD CONSTRAINT chk_fjrl_job_code CHECK (job_code IN (
    'gift_card_expiry',
    'idempotency_cleanup',
    'erp_posting_retry',
    'outbox_processor',
    'credit_note_expiry',
    'loyalty_points_expiry',
    'pos_session_rollover'
  ));

COMMENT ON TABLE public.sys_fin_job_run_log IS
  'Run-history ledger for scheduled finance/POS maintenance jobs (outbox processor, gift-card expiry, credit-note expiry, loyalty-points expiry, idempotency-key cleanup, ERP posting-retry, POS-session rollover). System-level: every job is a cross-tenant sweep.';

CREATE OR REPLACE FUNCTION public.fin_list_job_schedules()
RETURNS TABLE (
  job_code   TEXT,
  cron_name  TEXT,
  schedule   TEXT,
  is_active  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.job_code,
    m.cron_name,
    j.schedule,
    COALESCE(j.active, false)
  FROM (
    VALUES
      ('outbox_processor'::text,      'fin-outbox-processor'::text),
      ('gift_card_expiry'::text,      'fin-gift-card-expiry'::text),
      ('credit_note_expiry'::text,    'fin-credit-note-expiry'::text),
      ('loyalty_points_expiry'::text, 'fin-loyalty-points-expiry'::text),
      ('idempotency_cleanup'::text,   'fin-idempotency-cleanup'::text),
      ('erp_posting_retry'::text,     'fin-erp-posting-retry'::text),
      ('pos_session_rollover'::text,  'fin-pos-session-rollover'::text)
  ) AS m(job_code, cron_name)
  LEFT JOIN cron.job j ON j.jobname = m.cron_name;
END;
$$;

COMMENT ON FUNCTION public.fin_list_job_schedules() IS
  'Ops-screen read of pg_cron rows for the registered finance jobs. SECURITY DEFINER because cron.job is not granted to the app role.';

REVOKE ALL ON FUNCTION public.fin_list_job_schedules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_list_job_schedules() TO postgres, service_role, authenticated;

-- Every 15 minutes: branches sit in different timezones, so "midnight" happens at a different
-- UTC instant per branch — a frequent, cheap, idempotent sweep beats one fixed daily slot.
SELECT cron.schedule(
  'fin-pos-session-rollover',
  '*/15 * * * *',
  $$SELECT public.fin_trigger_job('pos_session_rollover')$$
);

-- -----------------------------------------------------------------------------
-- 5. Notification Hub registration (CMX-PRD-019): category, events, IN_APP channel, templates
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_ntf_categories_cd
  (code, name, name2, description, description2, icon, color, display_order)
VALUES
  ('POS_SESSION', 'POS Session', 'جلسة نقطة البيع',
   'POS session and cash drawer shift events', 'أحداث جلسات نقطة البيع ورديات درج النقد',
   'clock', '#F59E0B', 34)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  icon = EXCLUDED.icon, color = EXCLUDED.color, display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_ntf_events_cd
  (code, category_code, name, name2, description, description2,
   priority, is_transactional, requires_consent, default_recipients, idempotency_key_pattern)
VALUES
  ('pos_session.stale', 'POS_SESSION', 'POS Session Stale', 'جلسة نقطة بيع راكدة',
   'A POS session has stayed open longer than the configured stale threshold',
   'بقيت جلسة نقطة بيع مفتوحة أطول من حد الركود المحدد',
   'HIGH', true, false, ARRAY['staff','tenant_admin'],
   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
  ('pos_session.rolled_over', 'POS_SESSION', 'POS Session Rolled Over', 'تدوير جلسة نقطة بيع',
   'The business day changed and the system paused or force-closed a POS session',
   'تغيّر يوم العمل فأوقف النظام جلسة نقطة بيع مؤقتاً أو أغلقها إجبارياً',
   'HIGH', true, false, ARRAY['staff','tenant_admin'],
   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}')
ON CONFLICT (code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority = EXCLUDED.priority, default_recipients = EXCLUDED.default_recipients,
  idempotency_key_pattern = EXCLUDED.idempotency_key_pattern,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('pos_session.stale',       'IN_APP', true, true),
  ('pos_session.rolled_over', 'IN_APP', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default = EXCLUDED.is_default, can_override = EXCLUDED.can_override,
  is_active = true, updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_ntf_templates_mst
  (template_code, event_code, name, name2, description, description2, is_system)
SELECT e.code || '.default', e.code, e.name, e.name2,
       'Default system template for ' || e.code, 'قالب افتراضي لحدث ' || e.code, true
FROM public.sys_ntf_events_cd e
WHERE e.code IN ('pos_session.stale', 'pos_session.rolled_over')
ON CONFLICT (template_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_by, approved_at)
VALUES
  ('pos_session.stale.default', 1,
   'POS session {{session_no}} is still open', 'جلسة نقطة البيع {{session_no}} ما زالت مفتوحة',
   'POS session {{session_no}} ({{operator_name}}, {{branch_name}}) has been open for {{open_hours}} hours. Close it or hand it over.',
   'جلسة نقطة البيع {{session_no}} ({{operator_name}}، {{branch_name}}) مفتوحة منذ {{open_hours}} ساعة. أغلقها أو سلّمها.',
   'APPROVED', 'system_admin', CURRENT_TIMESTAMP),
  ('pos_session.rolled_over.default', 1,
   'POS session {{session_no}} was {{action}}', 'جلسة نقطة البيع {{session_no}} {{action}}',
   'POS session {{session_no}} ({{operator_name}}, {{branch_name}}) was {{action}} because the business day changed ({{business_date}}). Close it and open a new session to continue.',
   'جلسة نقطة البيع {{session_no}} ({{operator_name}}، {{branch_name}}) {{action}} لأن يوم العمل تغيّر ({{business_date}}). أغلقها وافتح جلسة جديدة للمتابعة.',
   'APPROVED', 'system_admin', CURRENT_TIMESTAMP)
ON CONFLICT (template_code, version_number) DO UPDATE SET
  subject = EXCLUDED.subject, subject2 = EXCLUDED.subject2,
  body = EXCLUDED.body, body2 = EXCLUDED.body2,
  status = 'APPROVED', updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2)
SELECT v.id, 'IN_APP', v.subject, v.subject2, v.body, v.body2
FROM public.sys_ntf_template_ver_dtl v
WHERE v.template_code IN ('pos_session.stale.default', 'pos_session.rolled_over.default')
  AND v.version_number = 1
ON CONFLICT (template_version_id, channel_code) DO UPDATE SET
  rendered_subject = EXCLUDED.rendered_subject, rendered_subject2 = EXCLUDED.rendered_subject2,
  rendered_body = EXCLUDED.rendered_body, rendered_body2 = EXCLUDED.rendered_body2,
  updated_at = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 6. Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'org_pos_sessions_mst'
     AND column_name IN ('rollover_applied_at', 'stale_flagged_at', 'auto_close_reason');
  IF v_count <> 3 THEN
    RAISE EXCEPTION '0558: org_pos_sessions_mst lifecycle columns missing (found % of 3)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'org_branches_mst' AND column_name = 'timezone_code';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '0558: org_branches_mst.timezone_code missing';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_pos_session_event_type_cd
   WHERE code IN ('ROLLOVER_PAUSE', 'ROLLOVER_FORCE_CLOSE', 'STALE_FLAGGED');
  IF v_count <> 3 THEN
    RAISE EXCEPTION '0558: POS session event types not seeded (found % of 3)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM cron.job WHERE jobname = 'fin-pos-session-rollover';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '0558: fin-pos-session-rollover was not scheduled';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_ntf_template_chan_dtl c
    JOIN public.sys_ntf_template_ver_dtl v ON v.id = c.template_version_id
   WHERE v.template_code IN ('pos_session.stale.default', 'pos_session.rolled_over.default')
     AND c.channel_code = 'IN_APP';
  IF v_count <> 2 THEN
    RAISE EXCEPTION '0558: notification templates not seeded (found % of 2 IN_APP renderings)', v_count;
  END IF;

  RAISE NOTICE 'Migration 0558 validation passed';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Run `npm run prisma:pull` straight after applying, then restart the dev server.
-- 2. Tenants/branches keep working unchanged: a branch with NULL timezone_code inherits the tenant
--    timezone; only a tenant with no timezone at all now fails (loudly) when opening a session.
-- 3. Rollback (forward-only repo): unschedule fin-pos-session-rollover; restore chk_fjrl_job_code and
--    fin_list_job_schedules() to the 0511 versions; delete the three event types, the two notification
--    events (+ templates, channel map) and the POS_SESSION category; drop idx_ops_live_sweep,
--    chk_ops_auto_close_reason and the three session columns; drop fk_branch_timezone and
--    org_branches_mst.timezone_code.
-- =============================================================================
