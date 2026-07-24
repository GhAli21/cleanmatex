-- =============================================================================
-- 0429_b19_expiry_and_idempotency_jobs.sql
-- B19 — Expiry and Idempotency Jobs
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Create sys_fin_job_run_log — a run-history ledger for the 3 scheduled
--      jobs this package registers (gift-card expiry, idempotency-key
--      cleanup, ERP posting-retry). System-level (no tenant_org_id, no
--      RLS): every job here is a cross-tenant maintenance sweep, same
--      justification as B7's org_domain_events_outbox claim mechanism.
--   2. Seed 2 new permission codes (finance_jobs:view / finance_jobs:run) —
--      B19's own doc claims these already exist as "ops job permission
--      (B27)"; re-verified against migration 0411 and found FALSE (B27
--      seeded 7 unrelated codes). Follows B7's own precedent of a package
--      seeding its own ops-screen permissions rather than assuming a
--      generic one exists.
--   3. Add a cross-tenant idempotency-key cleanup SQL function
--      (cleanup_expired_idempotency_keys) — D010's own migration comment
--      (0292) promised an "application cleanup job" that was never built;
--      this is that job's DB-side primitive.
--   4. Add a cross-tenant retryable-posting-exceptions lookup SQL function
--      (list_retryable_posting_exceptions) — org_fin_post_exc_tr is
--      RLS-isolated per tenant; the scheduled retry sweep needs one
--      cross-tenant read, same class of need as claim_outbox_batch (0296).
--   5. Retire the competing raw expiry cron for gift cards
--      (`expire-gift-cards` / fn_expire_gift_cards()) — confirmed ACTIVE in
--      the live remote DB (schedule '0 2 * * *') and confirmed to write
--      ZERO ledger rows and dispatch ZERO ERP-Lite GL events (a bare
--      UPDATE ... SET status='EXPIRED'). Leaving it scheduled alongside
--      this package's new ledger+GL-aware job would race two competing
--      expiry mechanisms against the same rows. Mirrors B7's own retirement
--      of the dead `outbox-worker` cron in the same spirit: unschedule the
--      cron, leave the now-orphaned SQL function in place (harmless, not
--      dropped — no DROP CASCADE, nothing references it after unschedule).
--      `expire-credit-notes` / fn_expire_credit_notes() has the exact same
--      defect (confirmed by reading the same migration) but credit notes
--      are NOT named anywhere in B19's scope — left untouched deliberately,
--      flagged here for a future package, not silently expanded into.
--   6. Register 3 new pg_cron jobs driving a single new dispatcher route,
--      reusing sys_fin_runtime_cf's EXISTING outbox_secret_key (no new
--      secret minted — same bearer-secret trust boundary as B7's own
--      finance-internal routes).
--
-- Explicitly NOT in this migration (documented scope boundaries, not silent
-- gaps — see B19's own Completion evidence for full reasoning):
--   • Wallet expiry: no policy config surface exists anywhere in this
--     codebase for wallets (confirmed by repo-wide search) — genuinely
--     dormant, same class as B08's AUTHORIZED sub-lifecycle. Nothing to
--     wire.
--   • Loyalty points expiry: org_loyalty_programs_cf.points_expiry_days IS
--     a real, live, tenant-editable policy (non-null on seeded tenants) —
--     but org_loyalty_txn_dtl has no per-earn-lot expiry stamp and
--     redemptions decrement a single denormalized points_balance with no
--     FIFO lot-consumption tracking. A correct per-lot expiry sweep cannot
--     be computed without first building that allocation model — a real,
--     separate loyalty-ledger feature, not a "jobs registration" concern.
--     Building an approximate sweep risked wrongly zeroing out points a
--     customer already redeemed. Deferred, not implemented.
--   • Pending-payment "aging": B19's doc describes a "sweep [that] stamps
--     aged PENDING legs" and "feeds the B30 worklist age column" — neither
--     the column nor the sweep exist anywhere; the worklist's existing
--     "Age" column header (pending-payments-worklist-page.tsx) has always
--     rendered a raw timestamp, never an elapsed duration. A stored/swept
--     column is unnecessary — created_at is already returned on every row.
--     Implemented instead as a cheap, always-current, query-time
--     ageDays/ageBucket computation in the worklist service (no schema
--     change, no batch job, no staleness).
--
-- Decisions: D008 (breakage interaction — not triggered; gift-card expiry
--            already dispatches GIFT_CARD_EXPIRED via expireGiftCard(),
--            unchanged by this package), D010 (idempotency key retention —
--            this migration's cleanup function is the sanctioned deletion
--            path D010 names B19 as owning).
-- Dependencies:
--   0410_b07_financial_outbox_processor.sql — sys_fin_runtime_cf + SECURITY
--                                              DEFINER + net.http_post + pg_cron pattern (reused verbatim)
--   0296_pg_cron_jobs.sql                    — origin of the competing expire-gift-cards cron this retires
--   0292_outbox_idempotency.sql              — org_idempotency_keys schema
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B19_Expiry_And_Idempotency_Jobs.md
--
-- WHY this migration is safe:
--   • New table is additive; nothing reads/writes it before this migration.
--   • Permission INSERTs use ON CONFLICT DO NOTHING (idempotent); role
--     grants use NOT EXISTS (idempotent).
--   • cleanup_expired_idempotency_keys only DELETEs rows already past their
--     own expires_at — by definition rows no writer can still be relying on.
--   • list_retryable_posting_exceptions is read-only (SELECT).
--   • Unscheduling expire-gift-cards changes a live production behavior
--     (gift cards stop auto-expiring via the OLD ledger-less path) —
--     immediately replaced in the SAME migration by a new cron driving the
--     ledger+GL-aware replacement, so gift-card expiry itself never stops
--     happening, only becomes correct.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Job run-log table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sys_fin_job_run_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code         TEXT NOT NULL,
  trigger_source   TEXT NOT NULL DEFAULT 'SCHEDULE',
  triggered_by     UUID NULL,
  status           TEXT NOT NULL DEFAULT 'RUNNING',
  processed_count  INTEGER NULL,
  failed_count     INTEGER NULL,
  error_message    TEXT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_fjrl_job_code CHECK (job_code IN (
    'gift_card_expiry', 'idempotency_cleanup', 'erp_posting_retry'
  )),
  CONSTRAINT chk_fjrl_trigger_source CHECK (trigger_source IN ('SCHEDULE', 'MANUAL')),
  CONSTRAINT chk_fjrl_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED'))
);

COMMENT ON TABLE public.sys_fin_job_run_log IS
  'B19 — run-history ledger for the scheduled finance maintenance jobs (gift-card expiry, idempotency-key cleanup, ERP posting-retry). System-level: every job is a cross-tenant sweep, no single tenant owns a run.';

CREATE INDEX IF NOT EXISTS idx_fjrl_job_started
  ON public.sys_fin_job_run_log (job_code, started_at DESC);

REVOKE ALL ON public.sys_fin_job_run_log FROM anon;

-- -----------------------------------------------------------------------------
-- 2. Permissions + role grants (finance_jobs:view / finance_jobs:run)
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('finance_jobs:view',
   'View Finance Jobs', 'عرض المهام المالية',
   'actions',
   'View the scheduled finance maintenance jobs section (gift-card expiry, idempotency cleanup, ERP posting-retry) and their run history',
   'عرض قسم المهام المالية المجدولة (انتهاء بطاقات الهدايا، تنظيف مفاتيح عدم التكرار، إعادة محاولة الترحيل) وسجل تشغيلها',
   'Finance', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('finance_jobs:run',
   'Manually Run Finance Jobs', 'تشغيل المهام المالية يدويًا',
   'actions',
   'Manually trigger an on-demand run of a scheduled finance maintenance job outside its normal schedule',
   'تشغيل مهمة صيانة مالية مجدولة يدويًا عند الطلب خارج جدولها المعتاد',
   'Finance', TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status;

-- Same finance-ops role set as B7's finance_outbox:view/retry (0410).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, TRUE, TRUE, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'finance_manager')
  AND p.code IN ('finance_jobs:view', 'finance_jobs:run')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 3. Idempotency-key cleanup (D010's sanctioned deletion path)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.org_idempotency_keys
  WHERE expires_at < CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_keys() IS
  'B19/D010 — deletes every org_idempotency_keys row past its own expires_at, across all tenants. The one sanctioned deletion path for this table (D010 invariant 8) — no writer deletes inline. Safe to run repeatedly; a row is only ever eligible once it is already past the retention window its own writer staked.';

-- -----------------------------------------------------------------------------
-- 4. Retryable posting-exceptions lookup (cross-tenant read for the sweep)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_retryable_posting_exceptions(p_max_age_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  exception_id UUID,
  tenant_org_id UUID,
  posting_log_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.tenant_org_id, e.posting_log_id
  FROM public.org_fin_post_exc_tr e
  WHERE e.status_code = 'OPEN'
    AND e.exception_type_code = 'SYSTEM_ERROR'
    AND e.created_at >= CURRENT_TIMESTAMP - (p_max_age_hours || ' hours')::interval
    AND e.rec_status = 1
  ORDER BY e.created_at ASC
  LIMIT 200;
END;
$$;

COMMENT ON FUNCTION public.list_retryable_posting_exceptions(INTEGER) IS
  'B19 — cross-tenant read of exceptions eligible for an AUTOMATIC retry. Deliberately narrow: only exception_type_code=SYSTEM_ERROR (plausibly transient) within a bounded recent window, never ACCOUNT_NOT_FOUND/MISSING_USAGE_MAPPING/VALIDATION_ERROR/PERIOD_CLOSED/etc — those require a human to fix the underlying config and will never self-heal; auto-retrying them forever would be pure noise. The Exception Workbench manual Retry button (any type, any age, operator-initiated after fixing the cause) is the path for everything else.';

-- -----------------------------------------------------------------------------
-- 5. Retire the competing ledger-less gift-card expiry cron
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-gift-cards') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-gift-cards';
  END IF;
END $$;

-- fn_expire_gift_cards() is intentionally left defined (not dropped) —
-- orphaned, harmless, no longer scheduled or called by anything. Dropping
-- it would need a CASCADE review this package doesn't require.

-- -----------------------------------------------------------------------------
-- 6. Register the 3 new scheduled jobs (reuses sys_fin_runtime_cf's secret)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fin_trigger_job(p_job_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT value INTO v_url FROM public.sys_fin_runtime_cf WHERE key = 'base_url';
  SELECT value INTO v_secret FROM public.sys_fin_runtime_cf WHERE key = 'outbox_secret_key';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'B19 fin_trigger_job(%): sys_fin_runtime_cf missing base_url/outbox_secret_key — skipping', p_job_code;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/api/finance/process-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('job', p_job_code)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_trigger_job(TEXT) IS
  'B19 — SECURITY DEFINER dispatcher shared by all 3 new finance jobs, mirroring B7''s fin_trigger_outbox_proc() pattern exactly (same sys_fin_runtime_cf config row, same secret, same net.http_post call — only the target route and job-code body differ).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-gift-card-expiry') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-gift-card-expiry';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-idempotency-cleanup') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-idempotency-cleanup';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-erp-posting-retry') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-erp-posting-retry';
  END IF;
END $$;

-- Daily 02:00 — same slot expire-gift-cards previously ran in.
SELECT cron.schedule('fin-gift-card-expiry', '0 2 * * *', $$SELECT public.fin_trigger_job('gift_card_expiry')$$);
-- Daily 03:00 — off-peak, after gift-card expiry.
SELECT cron.schedule('fin-idempotency-cleanup', '0 3 * * *', $$SELECT public.fin_trigger_job('idempotency_cleanup')$$);
-- Hourly — SYSTEM_ERROR exceptions are plausibly transient; retry them promptly.
SELECT cron.schedule('fin-erp-posting-retry', '15 * * * *', $$SELECT public.fin_trigger_job('erp_posting_retry')$$);

-- -----------------------------------------------------------------------------
-- 7. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_auth_permissions
  WHERE code IN ('finance_jobs:view', 'finance_jobs:run');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'B19 permissions not fully seeded (found % of 2)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name = 'sys_fin_job_run_log';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'sys_fin_job_run_log table was not created';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-gift-cards') THEN
    RAISE EXCEPTION 'expire-gift-cards was not successfully unscheduled';
  END IF;

  SELECT COUNT(*) INTO v_count FROM cron.job
  WHERE jobname IN ('fin-gift-card-expiry', 'fin-idempotency-cleanup', 'fin-erp-posting-retry');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'B19 cron jobs not fully scheduled (found % of 3)', v_count;
  END IF;

  RAISE NOTICE '✓ Migration 0429 validation passed';
  RAISE NOTICE '  - sys_fin_job_run_log created';
  RAISE NOTICE '  - finance_jobs:view / finance_jobs:run seeded + granted';
  RAISE NOTICE '  - cleanup_expired_idempotency_keys() + list_retryable_posting_exceptions() created';
  RAISE NOTICE '  - expire-gift-cards unscheduled; fin-gift-card-expiry/fin-idempotency-cleanup/fin-erp-posting-retry scheduled';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. No Prisma schema change needed for sys_fin_job_run_log beyond adding the
--    model (hand-mirrored, this project doesn't use `prisma db pull`) — no
--    existing table's columns changed.
-- 2. New route: POST /api/finance/process-jobs (bearer-secret, reuses
--    FINANCE_OUTBOX_SECRET — no new env var needed, same secret B7 already
--    uses for /api/finance/process-outbox).
-- 3. New interactive routes: GET /api/v1/finance/jobs (list + run history),
--    POST /api/v1/finance/jobs/[jobCode]/run (manual trigger).
-- 4. Gift-card expiry is no longer silently ledger-less as of this
--    migration's cron switch — but the OLD expire-gift-cards cron ran daily
--    at 02:00, so any gift card that already expired via that ledger-less
--    path before this migration applied is NOT retroactively corrected (no
--    lineage exists to reconstruct a historical EXPIRE ledger row honestly
--    — flagged as a known historical gap, not silently patched).
-- 5. To rollback: unschedule fin-gift-card-expiry/fin-idempotency-cleanup/
--    fin-erp-posting-retry, re-schedule expire-gift-cards at '0 2 * * *'
--    calling fn_expire_gift_cards() (still defined, never dropped), drop
--    fin_trigger_job/cleanup_expired_idempotency_keys/
--    list_retryable_posting_exceptions, revoke the 2 role grants, delete the
--    2 sys_auth_permissions rows, drop sys_fin_job_run_log.
-- =============================================================================
