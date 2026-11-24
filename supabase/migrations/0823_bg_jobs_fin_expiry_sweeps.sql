-- =============================================================================
-- Migration: 0823_bg_jobs_fin_expiry_sweeps.sql
-- Purpose:   Background Jobs step 6a - gift-card, credit-note and loyalty expiry
--            (plan docs/features/Background_Jobs/STEP6_PLAN.md 6a; DESIGN.md 5.5, 20.8-20.9).
--            Owner decision (25 Nov): pure database where the work has no TypeScript-only
--            effect, to avoid worker polling and connections.
--
--            Credit notes - PURE DATABASE (no accounting posting; this SQL is the one copy):
--              fn_fin_credit_note_expire_one   expires ONE note (row lock, EXPIRED, balance 0,
--                                              one EXPIRY ledger row, idempotency key
--                                              'cn-expiry-<id>'). web-admin expireCreditNote
--                                              calls it too.
--              fn_fin_credit_note_expiry_run   daily sweep: every due note, one savepoint each.
--              pg_cron 'fin-credit-note-expiry' (02:05 UTC); its registry row moves from
--              HQ_WORKER to PG_CRON in place.
--
--            Gift cards and loyalty - cmx-workers on pg-boss (gift card expiry posts a GL entry
--            through the TypeScript ERP engine; loyalty lot expiry is the same code checkout
--            and redemption run, so a SQL copy would be a second set of points rules):
--              <x>.daily  PGBOSS_SCHEDULE  pg-boss cron (UTC) -> one job to <x>.sweep
--              <x>.sweep  PGBOSS_QUEUE     up to 100 due ids -> one <x>.item job each
--              <x>.item   PGBOSS_QUEUE     expires ONE card / account through the service
--            Polling 300 s: daily work, so idle cost is one fetch per queue per 5 minutes.
--
--            fn_ops_job_sched_claim_manual: HQ "Run now" on a PGBOSS_SCHEDULE row writes a
--            MANUAL request; the consuming worker claims it here, sends one job to the
--            target queue and closes it with fn_ops_job_finish.
-- Security:  New functions are closed to PUBLIC, anon and authenticated (service side only).
-- Release:   Everything starts switched off. Switch on in HQ -> Ops -> Jobs (QA_TEST_GUIDE
--            6.1): the credit note cron job any time; the four queues and two schedules after
--            cmx-workers with step 6a is deployed.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- =============================================================================
-- A. Credit notes: pure database.
-- =============================================================================

-- Active credit notes by expiry date: what the daily sweep reads.
CREATE INDEX IF NOT EXISTS ix_cn_active_expiry
  ON public.org_credit_notes_mst (tenant_org_id, expires_at)
  WHERE status = 'ACTIVE';
COMMENT ON INDEX public.ix_cn_active_expiry IS
  'Active credit notes by expiry date: the due read of the daily credit note expiry (fn_fin_credit_note_expiry_run).';

-- Expires ONE credit note. Same rules as the TypeScript version it replaces:
--   already EXPIRED, or its EXPIRY ledger row exists -> make sure it is EXPIRED, write nothing else;
--   not ACTIVE -> NOT_ACTIVE; p_only_if_due and expires_at not before today (UTC) -> NOT_DUE;
--   else EXPIRED + balance 0, and one EXPIRY ledger row when the balance was above 0.
-- Credit note expiry has no accounting posting (gift-card expiry owns breakage, D008/D012).
CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expire_one(
  p_tenant_org_id  UUID,
  p_credit_note_id UUID,
  p_only_if_due    BOOLEAN DEFAULT true,
  p_actor          TEXT    DEFAULT 'system/credit-note-expiry'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_key     TEXT := 'cn-expiry-' || p_credit_note_id::text;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'system/credit-note-expiry'), 120);
  v_note    RECORD;
  v_has_txn BOOLEAN;
BEGIN
  SELECT n.id, n.status, n.remaining_balance, n.currency_code, n.customer_id,
         (n.expires_at IS NOT NULL AND n.expires_at < (now() AT TIME ZONE 'UTC')::date) AS is_due
    INTO v_note
    FROM public.org_credit_notes_mst n
   WHERE n.tenant_org_id = p_tenant_org_id
     AND n.id = p_credit_note_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.org_credit_note_txn_dtl t
     WHERE t.tenant_org_id = p_tenant_org_id AND t.idempotency_key = v_key
  ) INTO v_has_txn;

  IF v_note.status = 'EXPIRED' OR v_has_txn THEN
    IF v_note.status <> 'EXPIRED' THEN
      UPDATE public.org_credit_notes_mst
         SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
       WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;
    END IF;
    RETURN 'ALREADY_EXPIRED';
  END IF;

  IF v_note.status <> 'ACTIVE' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  IF p_only_if_due AND NOT v_note.is_due THEN
    RETURN 'NOT_DUE';
  END IF;

  UPDATE public.org_credit_notes_mst
     SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
   WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;

  IF v_note.remaining_balance > 0 THEN
    INSERT INTO public.org_credit_note_txn_dtl (
      tenant_org_id, credit_note_id, customer_id, txn_type, amount, currency_code,
      balance_before, balance_after, idempotency_key, notes, rec_status, created_by, created_info
    ) VALUES (
      p_tenant_org_id, p_credit_note_id, v_note.customer_id, 'EXPIRY', -v_note.remaining_balance, v_note.currency_code,
      v_note.remaining_balance, 0, v_key, 'Credit note expired', 1, v_actor, 'fn_fin_credit_note_expire_one'
    );
  END IF;
  RETURN 'EXPIRED';
END;
$$;

COMMENT ON FUNCTION public.fn_fin_credit_note_expire_one(UUID, UUID, BOOLEAN, TEXT) IS
  'Service-role-only: expires ONE credit note under its row lock (EXPIRED, remaining_balance 0, one EXPIRY ledger row keyed cn-expiry-<id> when a balance remained). Returns EXPIRED, ALREADY_EXPIRED, NOT_FOUND, NOT_ACTIVE or NOT_DUE (p_only_if_due and expires_at not before today UTC). The single copy of credit note expiry: the daily run and web-admin expireCreditNote both call it.';
REVOKE ALL ON FUNCTION public.fn_fin_credit_note_expire_one(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_credit_note_expire_one(UUID, UUID, BOOLEAN, TEXT) TO service_role;

-- The daily run. One savepoint per note: a note that fails (for example locked by a
-- redemption past the 5 s lock wait) is counted and left for the next day; the rest commit.
-- At most 5,000 notes a run; the next run continues.
CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expiry_run()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  r         RECORD;
  v_outcome TEXT;
  v_expired INTEGER := 0;
  v_skipped INTEGER := 0;
  v_failed  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT n.tenant_org_id, n.id
      FROM public.org_credit_notes_mst n
      JOIN public.org_tenants_mst t
        ON t.id = n.tenant_org_id
       AND t.is_active
       AND t.rec_status = 1
     WHERE n.tenant_org_id = t.id
       AND n.status = 'ACTIVE'
       AND n.is_active
       AND n.rec_status = 1
       AND n.expires_at IS NOT NULL
       AND n.expires_at < (now() AT TIME ZONE 'UTC')::date
     ORDER BY n.expires_at, n.id
     LIMIT 5000
  LOOP
    BEGIN
      v_outcome := public.fn_fin_credit_note_expire_one(r.tenant_org_id, r.id, true, 'system/credit-note-expiry');
      IF v_outcome IN ('EXPIRED', 'ALREADY_EXPIRED') THEN
        v_expired := v_expired + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'fn_fin_credit_note_expiry_run: credit note % (tenant %) failed: %', r.id, r.tenant_org_id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'skipped', v_skipped, 'failed', v_failed);
END;
$$;

COMMENT ON FUNCTION public.fn_fin_credit_note_expiry_run() IS
  'Service-role-only daily credit note expiry (pg_cron fin-credit-note-expiry): every ACTIVE note with expires_at before today UTC in an active tenant, up to 5,000 a run, each in its own savepoint through fn_fin_credit_note_expire_one. Returns {expired, skipped, failed}; a failed note is retried by the next run.';
REVOKE ALL ON FUNCTION public.fn_fin_credit_note_expiry_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_credit_note_expiry_run() TO service_role;

-- pg_cron job, created switched off (the Owner switches it on in HQ -> Ops -> Jobs).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-credit-note-expiry';
SELECT cron.schedule('fin-credit-note-expiry', '5 2 * * *', $$ SELECT public.fn_fin_credit_note_expiry_run() $$);
SELECT cron.alter_job(job_id => jobid, active => false) FROM cron.job WHERE jobname = 'fin-credit-note-expiry';

-- Its registry row: HQ_WORKER (off, never run) -> PG_CRON, in place.
UPDATE public.sys_ops_job_cf
SET kind             = 'PG_CRON',
    completion_mode  = 'SYNC',
    cron_job_name    = 'fin-credit-note-expiry',
    default_schedule = '5 2 * * *',
    schedule         = NULL,
    target_job_code  = NULL,
    desired_enabled  = false,
    run_now_allowed  = true,
    operator_actions = ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'],
    applied_schedule = NULL,
    applied_enabled  = NULL,
    applied_at       = NULL,
    applied_by       = NULL,
    description      = 'Expires active credit notes past their expiry date every day at 02:05 UTC: EXPIRED status, zero balance and one EXPIRY ledger row each. Runs in the database (pg_cron).',
    description2     = 'ينهي إشعارات الدائن النشطة التي تجاوزت تاريخ انتهائها يوميًا الساعة 02:05 بالتوقيت العالمي: حالة منتهية ورصيد صفر وقيد انتهاء واحد لكل إشعار. يعمل داخل قاعدة البيانات (pg_cron).',
    source_migration = '0823_bg_jobs_fin_expiry_sweeps.sql',
    notes            = 'pg_cron SELECT public.fn_fin_credit_note_expiry_run() (Background Jobs step 6a).',
    updated_info     = 'Migration 0823 - credit note expiry moved to pg_cron'
WHERE job_code = 'fin-credit-note-expiry';

-- =============================================================================
-- B. Gift cards and loyalty: cmx-workers queues and schedules.
-- =============================================================================
-- DESIGN 5.2 INTERNAL settings: 8 retries, backoff 10 s to 1 h, 300 s expiry. Jobs are kept
-- 7 days: the next daily sweep re-finds anything lost. Polling 300 s (daily work).
CREATE TEMP TABLE tmp_0823_queues (
  queue_name   TEXT    NOT NULL,
  concurrency  INTEGER NOT NULL,
  sub_system   TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  name2        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  description2 TEXT    NOT NULL,
  rec_order    INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_0823_queues VALUES
  ('fin.gift_card_expiry.sweep', 1, 'gift_cards',
   'Gift card expiry: find due cards', 'انتهاء صلاحية بطاقات الهدايا: البحث عن البطاقات المستحقة',
   'Finds gift cards past their expiry date (100 at a time) and queues one expiry job per card.',
   'يبحث عن بطاقات الهدايا التي تجاوزت تاريخ انتهائها (100 في كل مرة) ويضع مهمة انتهاء لكل بطاقة.', 500),
  ('fin.gift_card_expiry.item', 2, 'gift_cards',
   'Gift card expiry: expire one card', 'انتهاء صلاحية بطاقات الهدايا: إنهاء بطاقة واحدة',
   'Expires one gift card: EXPIRED status, EXPIRE ledger row and its accounting entry. Does nothing if the card is no longer due.',
   'ينهي بطاقة هدايا واحدة: حالة منتهية وقيد انتهاء في السجل وقيده المحاسبي. لا يفعل شيئًا إذا لم تعد البطاقة مستحقة.', 510),
  ('fin.loyalty_expiry.sweep', 1, 'loyalty',
   'Loyalty points expiry: find due accounts', 'انتهاء صلاحية نقاط الولاء: البحث عن الحسابات المستحقة',
   'Finds loyalty accounts holding points older than the program''s expiry days (100 at a time) and queues one job per account.',
   'يبحث عن حسابات الولاء التي تحمل نقاطًا أقدم من مدة الصلاحية في البرنامج (100 في كل مرة) ويضع مهمة لكل حساب.', 540),
  ('fin.loyalty_expiry.item', 2, 'loyalty',
   'Loyalty points expiry: expire one account', 'انتهاء صلاحية نقاط الولاء: حساب واحد',
   'Expires the points of one loyalty account that are older than the program''s expiry days.',
   'ينهي نقاط حساب ولاء واحد التي تجاوزت مدة الصلاحية في البرنامج.', 550);

-- Skips a queue that already exists, so a re-run is harmless.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM tmp_0823_queues ORDER BY rec_order LOOP
    IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = r.queue_name) THEN
      PERFORM pgboss.create_queue(r.queue_name, jsonb_build_object(
        'policy', 'standard',
        'retryLimit', 8,
        'retryDelay', 10,
        'retryBackoff', true,
        'retryDelayMax', 3600,
        'expireInSeconds', 300,
        'heartbeatSeconds', 30,
        'retentionSeconds', 604800,
        'deleteAfterSeconds', 604800,
        'deadLetter', 'dead_letter'
      ));
    END IF;
  END LOOP;
END $$;

INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
SELECT
  q.queue_name, q.name, q.name2, q.description, q.description2,
  'EXPIRY', 'fin', q.sub_system, 'PGBOSS_QUEUE',
  NULL, NULL, NULL, false, false, 'PGBOSS',
  '0823_bg_jobs_fin_expiry_sweeps.sql',
  'Consumed by cmx-workers (Background Jobs step 6a).',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', q.rec_order,
  'Migration 0823 - expiry queue'
FROM tmp_0823_queues q
ON CONFLICT (job_code) DO NOTHING;

INSERT INTO public.sys_ops_job_queue_cf (
  queue_name, consumer_app, effect_class,
  retry_limit, retry_delay_s, retry_backoff, retry_delay_max_s,
  expire_s, heartbeat_s, retention_s, delete_after_s, dead_letter_queue,
  default_priority, local_concurrency, polling_s,
  rec_order, created_by, created_info
)
SELECT
  q.queue_name, 'CMX_WORKERS', 'INTERNAL',
  8, 10, true, 3600,
  300, 30, 604800, 604800, 'dead_letter',
  0, q.concurrency, 300,
  q.rec_order, 'migration', 'Migration 0823 - expiry queue'
FROM tmp_0823_queues q
ON CONFLICT (queue_name) DO NOTHING;

-- Daily schedules (pg-boss cron, UTC). Same times as the HQ_WORKER rows they replace.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, target_job_code, desired_enabled, run_now_allowed,
  completion_mode, source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
VALUES
  ('fin.gift_card_expiry.daily', 'Gift card expiry (daily)', 'انتهاء صلاحية بطاقات الهدايا (يوميًا)',
   'Starts the gift card expiry sweep every day at 02:00 UTC.', 'يبدأ البحث عن بطاقات الهدايا المنتهية يوميًا الساعة 02:00 بالتوقيت العالمي.',
   'EXPIRY', 'fin', 'gift_cards', 'PGBOSS_SCHEDULE', NULL, '0 2 * * *', NULL, 'fin.gift_card_expiry.sweep', false, true,
   'PGBOSS', '0823_bg_jobs_fin_expiry_sweeps.sql', 'Applied by cmx-workers as a pg-boss schedule (Background Jobs step 6a).',
   ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], 'ACTIVE', 505, 'Migration 0823 - expiry schedule'),
  ('fin.loyalty_expiry.daily', 'Loyalty points expiry (daily)', 'انتهاء صلاحية نقاط الولاء (يوميًا)',
   'Starts the loyalty points expiry sweep every day at 02:10 UTC.', 'يبدأ البحث عن نقاط الولاء المنتهية يوميًا الساعة 02:10 بالتوقيت العالمي.',
   'EXPIRY', 'fin', 'loyalty', 'PGBOSS_SCHEDULE', NULL, '10 2 * * *', NULL, 'fin.loyalty_expiry.sweep', false, true,
   'PGBOSS', '0823_bg_jobs_fin_expiry_sweeps.sql', 'Applied by cmx-workers as a pg-boss schedule (Background Jobs step 6a).',
   ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], 'ACTIVE', 545, 'Migration 0823 - expiry schedule')
ON CONFLICT (job_code) DO NOTHING;

-- The HQ_WORKER rows these replace: superseded (observe only, off, no manual run).
UPDATE public.sys_ops_job_cf c
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = x.new_code,
    operator_actions = ARRAY['OBSERVE'],
    desired_enabled  = false,
    run_now_allowed  = false,
    updated_info     = 'Migration 0823 - replaced by a pg-boss schedule'
FROM (VALUES
  ('fin-gift-card-expiry',      'fin.gift_card_expiry.daily'),
  ('fin-loyalty-points-expiry', 'fin.loyalty_expiry.daily')
) AS x(old_code, new_code)
WHERE c.job_code = x.old_code
  AND c.lifecycle_status = 'ACTIVE';

-- Loyalty: accounts with an open lot (remaining_points > 0) older than their tenant's
-- program points_expiry_days. Same predicate as expireLoyaltyPoints. Uses
-- idx_loyalty_txn_open_lots (tenant_org_id, account_id, created_at) WHERE remaining_points > 0.
CREATE OR REPLACE FUNCTION public.fn_fin_loyalty_exp_due(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (tenant_org_id UUID, account_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT l.tenant_org_id, l.account_id
  FROM public.org_loyalty_txn_dtl l
  JOIN public.org_loyalty_programs_cf p
    ON p.tenant_org_id = l.tenant_org_id
   AND p.is_active
   AND p.rec_status = 1
   AND p.points_expiry_days > 0
  JOIN public.org_tenants_mst t
    ON t.id = l.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE l.remaining_points > 0
    AND l.created_at < pg_catalog.now() - pg_catalog.make_interval(days => p.points_expiry_days)
  GROUP BY l.tenant_org_id, l.account_id
  ORDER BY l.tenant_org_id, l.account_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

COMMENT ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER) IS
  'Service-role-only: up to 100 (tenant, loyalty account) pairs holding open points older than the tenant program''s points_expiry_days, active tenants and programs only. Read by the fin.loyalty_expiry.sweep job; each pair becomes one fin.loyalty_expiry.item job.';
REVOKE ALL ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER) TO service_role;

-- =============================================================================
-- C. Manual runs of a schedule ("Run now" in HQ -> Ops -> Jobs).
-- =============================================================================
-- fn_ops_job_run_now writes a MANUAL request for a PGBOSS_SCHEDULE row. The worker that
-- consumes the schedule's target queue claims it here (RUNNING), sends one job to the
-- target queue, then closes it with fn_ops_job_finish (which writes the run history row).
-- A request left RUNNING for 10 minutes (the worker died between claim and send) is closed
-- as FAILED first, so the operator can run it again.
CREATE OR REPLACE FUNCTION public.fn_ops_job_sched_claim_manual(p_consumer TEXT, p_worker TEXT)
RETURNS TABLE (request_id UUID, job_code TEXT, target_queue TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_worker TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
BEGIN
  WITH stale AS (
    UPDATE public.sys_ops_job_req_tr r
       SET status = 'FAILED', finished_at = now(), updated_by = v_worker,
           updated_info = 'fn_ops_job_sched_claim_manual',
           message = 'Abandoned: the worker stopped before it sent the job'
      FROM public.sys_ops_job_cf c
     WHERE c.job_code = r.job_code
       AND c.kind = 'PGBOSS_SCHEDULE'
       AND r.status = 'RUNNING'
       AND r.claimed_at < now() - interval '10 minutes'
    RETURNING r.job_code, r.claimed_at, r.trigger_type, r.requested_by
  )
  INSERT INTO public.sys_ops_job_run_dtl (job_code, started_at, finished_at, status, message, trigger_type, actor, created_info)
  SELECT s.job_code, s.claimed_at, now(), 'FAILED', 'Abandoned: the worker stopped before it sent the job',
         s.trigger_type, s.requested_by, 'fn_ops_job_sched_claim_manual'
    FROM stale s;

  RETURN QUERY
  WITH picked AS (
    SELECT r.id
      FROM public.sys_ops_job_req_tr r
      JOIN public.sys_ops_job_cf c
        ON c.job_code = r.job_code
       AND c.kind = 'PGBOSS_SCHEDULE'
       AND c.lifecycle_status = 'ACTIVE'
       AND c.is_active
       AND c.rec_status = 1
      JOIN public.sys_ops_job_queue_cf q
        ON q.queue_name = c.target_job_code
       AND q.consumer_app = p_consumer
       AND q.is_active
     WHERE r.status = 'REQUESTED'
       AND r.trigger_type = 'MANUAL'
     ORDER BY r.created_at
     LIMIT 10
       FOR UPDATE OF r SKIP LOCKED
  )
  UPDATE public.sys_ops_job_req_tr r
     SET status = 'RUNNING', claimed_at = now(), claimed_by = v_worker,
         updated_by = v_worker, updated_info = 'fn_ops_job_sched_claim_manual'
    FROM picked p, public.sys_ops_job_cf c
   WHERE r.id = p.id
     AND c.job_code = r.job_code
  RETURNING r.id, r.job_code, c.target_job_code;
END;
$$;

COMMENT ON FUNCTION public.fn_ops_job_sched_claim_manual(TEXT, TEXT) IS
  'Service-role-only: claims up to 10 waiting manual runs of PGBOSS_SCHEDULE jobs whose target queue is consumed by p_consumer (status RUNNING, claimed_by p_worker) and returns each request with its target queue. The caller sends one job to that queue and closes the request with fn_ops_job_finish. Requests RUNNING for 10 minutes are closed as FAILED first.';
REVOKE ALL ON FUNCTION public.fn_ops_job_sched_claim_manual(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_sched_claim_manual(TEXT, TEXT) TO service_role;

COMMIT;
