-- =============================================================================
-- Migration: 0809_bg_jobs_fin_event_reactions.sql
-- Purpose:   Background Jobs step 4 - finance event reactions (DESIGN.md 10.2 step 4,
--            20.2, 20.5). Replaces the claim_outbox_batch processor.
--            1. One pg-boss queue per event reaction (13), INTERNAL settings (DESIGN 5.2).
--            2. A PGBOSS_QUEUE registry row and a queue detail row for each, consumed by
--               cmx-workers.
--            3. The reactions in sys_ops_job_event_subs_cf. Its trigger mirrors them into
--               pgboss.subscription, so publish() sends one job per reaction.
--               Order history now reacts to all ten timeline events. The old processor
--               routed only four, so payment cancel, fail, void, reverse, capture and
--               settle never reached the order timeline.
--            4. An event with no enabled reaction is written as PROCESSED (trigger), and
--               existing unfinished events with no reaction are closed the same way.
--               This is what the old processor did when no handler matched.
--            5. Registry job fin-outbox-processor becomes SUPERSEDED.
-- Event row status after this migration (org_domain_events_outbox.status):
--            PENDING        reactions outstanding (their jobs are in pg-boss)
--            PROCESSED      every enabled reaction applied, or the event has none
--            DEAD_LETTERED  a reaction failed its last retry; error_message says why
--            FAILED / PROCESSING are written only by the old processor (removed).
-- Effect key: each reaction records `<handler_code>:<event id>` in org_ops_job_effect_tr
--            in the same transaction as its writes, so a retried or duplicated job never
--            applies twice.
-- Design:    docs/features/Background_Jobs/DESIGN.md
-- Security:  The new trigger function is SECURITY DEFINER (it reads pgboss.subscription,
--            which anon and authenticated cannot) and is closed to PUBLIC, anon and
--            authenticated. No new tables.
-- Release:   Apply before the web-admin code that publishes events (sending to a missing
--            queue throws). Events written before that code deploys stay PENDING; the
--            one-off `npm run publish-events --workspace=cmx-workers` publishes them.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- The reactions this migration creates. Used by every section below and dropped at commit.
-- polling_s: 10 for what users see soon after the action (order submitted, loyalty
-- points), 30 for the rest (DESIGN 13.2 cost budget).
CREATE TEMP TABLE tmp_0809_reactions (
  queue_name   TEXT     NOT NULL,
  event_code   TEXT     NOT NULL,
  handler_code TEXT     NOT NULL,
  polling_s    NUMERIC  NOT NULL,
  rec_order    INTEGER  NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_0809_reactions (queue_name, event_code, handler_code, polling_s, rec_order) VALUES
  ('fin.order_submitted.order_history',               'ORDER_SUBMITTED',               'order_history',        10, 200),
  ('fin.voucher_posted_and_wired.order_history',      'VOUCHER_POSTED_AND_WIRED',      'order_history',        30, 210),
  ('fin.ar_invoice_issued.order_history',             'AR_INVOICE_ISSUED',             'order_history',        30, 220),
  ('fin.payment_verified.order_history',              'PAYMENT_VERIFIED',              'order_history',        30, 230),
  ('fin.payment_cancelled.order_history',             'PAYMENT_CANCELLED',             'order_history',        30, 240),
  ('fin.payment_failed.order_history',                'PAYMENT_FAILED',                'order_history',        30, 250),
  ('fin.payment_voided.order_history',                'PAYMENT_VOIDED',                'order_history',        30, 260),
  ('fin.payment_reversed.order_history',              'PAYMENT_REVERSED',              'order_history',        30, 270),
  ('fin.payment_captured.order_history',              'PAYMENT_CAPTURED',              'order_history',        30, 280),
  ('fin.payment_settled.order_history',               'PAYMENT_SETTLED',               'order_history',        30, 290),
  ('fin.loyalty_earn_recalc_requested.loyalty_earn',  'LOYALTY_EARN_RECALC_REQUESTED', 'loyalty_earn',         10, 300),
  ('fin.cash_drawer_variance_recorded.cash_over_short','CASH_DRAWER_VARIANCE_RECORDED','cash_over_short',      30, 310),
  ('fin.order_change_applied.order_change_confirm',   'ORDER_CHANGE_APPLIED',          'order_change_confirm', 30, 320);

-- -----------------------------------------------------------------------------
-- 1. Queues. INTERNAL class (DESIGN 5.2): 8 retries, backoff 10 s to 1 h, 300 s expiry
--    with a 30 s heartbeat, then dead_letter. Money events: waiting and finished jobs
--    are kept 30 days. Skips a queue that already exists, so a re-run is harmless.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_queue TEXT;
BEGIN
  FOR v_queue IN SELECT r.queue_name FROM tmp_0809_reactions r ORDER BY r.rec_order LOOP
    IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = v_queue) THEN
      PERFORM pgboss.create_queue(v_queue, jsonb_build_object(
        'policy', 'standard',
        'retryLimit', 8,
        'retryDelay', 10,
        'retryBackoff', true,
        'retryDelayMax', 3600,
        'expireInSeconds', 300,
        'heartbeatSeconds', 30,
        'retentionSeconds', 2592000,
        'deleteAfterSeconds', 2592000,
        'deadLetter', 'dead_letter'
      ));
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Registry rows (what the operator sees and pauses) and queue detail rows (how
--    cmx-workers runs each queue). Names are built from the event catalog names.
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
)
SELECT
  r.queue_name,
  CASE r.handler_code
    WHEN 'order_history'        THEN 'Order history: '
    WHEN 'loyalty_earn'         THEN 'Loyalty points earned: '
    WHEN 'cash_over_short'      THEN 'Cash over/short posting: '
    WHEN 'order_change_confirm' THEN 'Order change confirmation: '
  END || t.name,
  CASE r.handler_code
    WHEN 'order_history'        THEN 'سجل تاريخي للطلب: '
    WHEN 'loyalty_earn'         THEN 'نقاط الولاء المكتسبة: '
    WHEN 'cash_over_short'      THEN 'ترحيل عجز وزيادة درج النقد: '
    WHEN 'order_change_confirm' THEN 'تأكيد تعديل الطلب: '
  END || t.name2,
  CASE r.handler_code
    WHEN 'order_history'        THEN 'Writes the order timeline entry for this event. Runs once per event.'
    WHEN 'loyalty_earn'         THEN 'Brings the order''s earned loyalty points to their target. Runs once per request.'
    WHEN 'cash_over_short'      THEN 'Posts the cash over/short voucher for a drawer variance. Runs once per event and currency.'
    WHEN 'order_change_confirm' THEN 'Confirms that the applied order change row exists. Does not collect, refund or post.'
  END,
  CASE r.handler_code
    WHEN 'order_history'        THEN 'يكتب إدخال سجل الطلب لهذا الحدث. يُنفَّذ مرة واحدة لكل حدث.'
    WHEN 'loyalty_earn'         THEN 'يضبط نقاط الولاء المكتسبة للطلب على قيمتها المستهدفة. يُنفَّذ مرة واحدة لكل طلب.'
    WHEN 'cash_over_short'      THEN 'يرحّل سند العجز أو الزيادة لفرق درج النقد. يُنفَّذ مرة واحدة لكل حدث وعملة.'
    WHEN 'order_change_confirm' THEN 'يتأكد من وجود سجل تعديل الطلب المطبَّق. لا يحصّل ولا يسترد ولا يرحّل.'
  END,
  'REACTION', 'fin', r.handler_code, 'PGBOSS_QUEUE',
  NULL, NULL, NULL, true, false, 'PGBOSS',
  '0809_bg_jobs_fin_event_reactions.sql',
  'Reaction to ' || r.event_code || '. Consumed by cmx-workers. Replaces fin-outbox-processor.',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', r.rec_order,
  'Migration 0809 - finance event reaction queue'
FROM tmp_0809_reactions r
JOIN public.sys_ops_job_event_types_cd t ON t.event_code = r.event_code
ON CONFLICT (job_code) DO NOTHING;

INSERT INTO public.sys_ops_job_queue_cf (
  queue_name, consumer_app, effect_class,
  retry_limit, retry_delay_s, retry_backoff, retry_delay_max_s,
  expire_s, heartbeat_s, retention_s, delete_after_s, dead_letter_queue,
  default_priority, local_concurrency, polling_s,
  rec_order, created_by, created_info
)
SELECT
  r.queue_name, 'CMX_WORKERS', 'INTERNAL',
  8, 10, true, 3600,
  300, 30, 2592000, 2592000, 'dead_letter',
  0, 1, r.polling_s,
  r.rec_order, 'migration', 'Migration 0809 - finance event reaction queue'
FROM tmp_0809_reactions r
ON CONFLICT (queue_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Reactions. trg_sojes_sync copies each enabled row into pgboss.subscription.
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_ops_job_event_subs_cf (
  event_code, handler_code, queue_job_code, description, description2, is_enabled,
  rec_order, created_by, created_info
)
SELECT
  r.event_code, r.handler_code, r.queue_name, c.description, c.description2, true,
  r.rec_order, 'migration', 'Migration 0809 - finance event reaction'
FROM tmp_0809_reactions r
JOIN public.sys_ops_job_cf c ON c.job_code = r.queue_name
ON CONFLICT (event_code, handler_code) DO NOTHING;

-- Fail loudly if the mirror did not pick every reaction up.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(r.queue_name, ', ') INTO v_missing
  FROM tmp_0809_reactions r
  WHERE NOT EXISTS (
    SELECT 1 FROM pgboss.subscription s WHERE s.event = r.event_code AND s.name = r.queue_name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'pgboss.subscription is missing reactions: %', v_missing;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Events nothing reacts to are finished when written.
-- -----------------------------------------------------------------------------

-- Without this, an event with no enabled reaction would stay PENDING forever and the
-- tenant outbox monitor would show it as stuck. pgboss.subscription is the same list
-- publish() reads, so the two can never disagree.
CREATE OR REPLACE FUNCTION public.fn_odeo_no_reaction_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pgboss', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'PENDING'
     AND NOT EXISTS (SELECT 1 FROM pgboss.subscription s WHERE s.event = NEW.event_type) THEN
    NEW.status := 'PROCESSED';
    NEW.processed_at := COALESCE(NEW.processed_at, now());
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_odeo_no_reaction_done() IS
  'Trigger: writes a domain event as PROCESSED when no enabled reaction subscribes to its code, so it never waits for a consumer that does not exist.';
REVOKE ALL ON FUNCTION public.fn_odeo_no_reaction_done() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_odeo_no_reaction ON public.org_domain_events_outbox;
CREATE TRIGGER trg_odeo_no_reaction BEFORE INSERT ON public.org_domain_events_outbox
  FOR EACH ROW EXECUTE FUNCTION public.fn_odeo_no_reaction_done();
COMMENT ON TRIGGER trg_odeo_no_reaction ON public.org_domain_events_outbox IS
  'Marks an event PROCESSED on insert when it has no enabled reaction (see fn_odeo_no_reaction_done).';

-- Existing unfinished events with no reaction (cash drawer session and transaction
-- events, payment received, refund processed): close them the same way. All tenants:
-- this is the one-off equivalent of the old processor's "no handler" branch.
UPDATE public.org_domain_events_outbox o
SET status = 'PROCESSED',
    processed_at = COALESCE(o.processed_at, now())
WHERE o.status <> 'PROCESSED'
  AND NOT EXISTS (SELECT 1 FROM pgboss.subscription s WHERE s.event = o.event_type);

-- -----------------------------------------------------------------------------
-- 5. The old processor is superseded. Its routes and code are removed in the same
--    release; claim_outbox_batch is dropped at step 8.
-- -----------------------------------------------------------------------------
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = 'fin.order_submitted.order_history',
    desired_enabled  = false,
    run_now_allowed  = false,
    operator_actions = ARRAY['OBSERVE'],
    notes            = 'Superseded in 0809 by one pg-boss queue per event reaction (fin.<event>.<handler>, 13 queues) consumed by cmx-workers. Do not Enable or Run now. Removed at Background Jobs step 8.',
    updated_at       = now(),
    updated_info     = 'Migration 0809 - superseded by event reaction queues'
WHERE job_code = 'fin-outbox-processor';

COMMIT;
