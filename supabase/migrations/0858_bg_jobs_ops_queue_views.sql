-- =============================================================================
-- 0858_bg_jobs_ops_queue_views.sql
-- Background Jobs step 7a (docs/features/Background_Jobs/STEP7_PLAN.md): the database side of
-- HQ -> Ops -> Jobs on the queue, and the four alerts (DESIGN §8.1-8.2).
--
-- Purpose:   Read-only, service-role functions over pg-boss's own tables and the job registry, so HQ
--            API can show queue numbers, recent results, dead letters and worker heartbeats, and
--            evaluate the alerts, without counting pgboss.job on every page load (pg-boss's monitor
--            already keeps per-queue counts in pgboss.queue). They return counts, queue names, ids,
--            times and error text only: no job payload values.
-- Affected:  sys_ops_job_queue_cf.alert_ready_age_s (new column, backfilled); functions
--            fn_ops_queue_stats, fn_ops_queue_recent, fn_ops_dead_letter_list, fn_ops_worker_list,
--            fn_ops_job_alerts; index idx_ntfo_uncertain on org_ntf_outbox_dtl.
-- Callers:   HQ API ops-jobs module (screen + 60-second alert poller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- 1. Per-queue "waiting too long" threshold (alert 1). Typed column, not a general setting.
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_ops_job_queue_cf
  ADD COLUMN IF NOT EXISTS alert_ready_age_s INTEGER;

ALTER TABLE public.sys_ops_job_queue_cf
  ADD CONSTRAINT ck_sojq_alert_ready_age
  CHECK (alert_ready_age_s IS NULL OR alert_ready_age_s BETWEEN 60 AND 86400);

COMMENT ON COLUMN public.sys_ops_job_queue_cf.alert_ready_age_s IS
  'Alert when the oldest job ready to run in this queue has waited longer than this many seconds (60-86400). NULL = no alert (smoke test, dead-letter queue). Read by fn_ops_job_alerts.';
COMMENT ON CONSTRAINT ck_sojq_alert_ready_age ON public.sys_ops_job_queue_cf IS
  'A threshold under a minute would fire on normal polling delay; over a day is no longer an alert.';

-- DESIGN §8.2: notifications 2 minutes, finance (and file purge) 1 hour. Campaign chunks are
-- throttled on purpose, so they get 15 minutes.
UPDATE public.sys_ops_job_queue_cf
   SET alert_ready_age_s = CASE
         WHEN queue_name LIKE 'ntf.campaign_%' THEN 900
         WHEN queue_name LIKE 'ntf.%'          THEN 120
         WHEN queue_name LIKE 'fin.%'          THEN 3600
         WHEN queue_name LIKE 'file.%'         THEN 3600
         ELSE NULL
       END,
       updated_at   = now(),
       updated_by   = 'system',
       updated_info = '0858 alert thresholds'
 WHERE alert_ready_age_s IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Queue numbers: registry + pg-boss monitor counts + dead letters per source queue.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ops_queue_stats()
RETURNS TABLE (
  queue_name        TEXT,
  name              TEXT,
  name2             TEXT,
  module            TEXT,
  consumer_app      TEXT,
  policy            TEXT,
  desired_enabled   BOOLEAN,
  applied_enabled   BOOLEAN,
  applied_at        TIMESTAMPTZ,
  queued            INTEGER,
  ready             INTEGER,
  active            INTEGER,
  deferred          INTEGER,
  failed            INTEGER,
  total             INTEGER,
  ready_oldest_s    INTEGER,
  alert_ready_age_s INTEGER,
  dead_letters      INTEGER,
  stats_on          TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT q.queue_name, c.name, c.name2, c.module, q.consumer_app, p.policy,
         c.desired_enabled, c.applied_enabled, c.applied_at,
         p.queued_count, p.ready_count, p.active_count, p.deferred_count, p.failed_count, p.total_count,
         p.ready_oldest_seconds, q.alert_ready_age_s,
         COALESCE(d.n, 0)::INTEGER,
         p.monitor_on
    FROM public.sys_ops_job_queue_cf q
    JOIN public.sys_ops_job_cf c
      ON c.job_code = q.queue_name
     AND c.rec_status = 1
    LEFT JOIN pgboss.queue p
      ON p.name = q.queue_name
    LEFT JOIN (
      SELECT j.source_name, count(*) AS n
        FROM pgboss.job j
       WHERE j.name = 'dead_letter'
       GROUP BY j.source_name
    ) d ON d.source_name = q.queue_name
   WHERE q.rec_status = 1
   ORDER BY q.queue_name;
$$;

COMMENT ON FUNCTION public.fn_ops_queue_stats() IS
  'Service-role-only: one row per registered pg-boss queue with its on/off state, pg-boss monitor counts (queued, ready, active, deferred, failed, total, oldest ready age; refreshed by the cmx-workers supervisor about every minute, time in stats_on), its alert threshold and how many of its jobs sit in the dead-letter queue. HQ -> Ops -> Jobs, Queues tab.';
-- Service role only: HQ API reads it on behalf of a person with hq_ops:read.
REVOKE ALL ON FUNCTION public.fn_ops_queue_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_queue_stats() TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Recent jobs of one queue with their result (counts) or error message.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ops_queue_recent(p_queue TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  job_id       UUID,
  state        TEXT,
  attempts     INTEGER,
  created_on   TIMESTAMPTZ,
  started_on   TIMESTAMPTZ,
  completed_on TIMESTAMPTZ,
  result       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT j.id, j.state::TEXT, j.retry_count, j.created_on, j.started_on, j.completed_on,
         CASE
           -- A failed job's output is the error object: show its message, never the stack (server paths).
           WHEN j.state::TEXT = 'failed' THEN left(COALESCE(j.output->>'message', split_part(j.output->>'stack', E'\n', 1)), 300)
           -- A completed job's output is what the handler returned (counts, outcome codes).
           WHEN j.state::TEXT = 'completed' THEN left(j.output::TEXT, 300)
         END
    FROM pgboss.job j
   WHERE j.name = p_queue
     AND EXISTS (SELECT 1 FROM public.sys_ops_job_queue_cf q WHERE q.queue_name = p_queue AND q.rec_status = 1)
   ORDER BY j.created_on DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

COMMENT ON FUNCTION public.fn_ops_queue_recent(TEXT, INTEGER) IS
  'Service-role-only: the last 1-50 jobs (default 20) of one registered queue: state, attempts, times and the result (handler output, up to 300 characters) or error message (no stack). Payloads are not returned. pg-boss keeps finished jobs for the queue''s retention (7 days for most queues).';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_ops_queue_recent(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_queue_recent(TEXT, INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Dead letters: jobs that used up their retries, newest first.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ops_dead_letter_list(p_source_queue TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  dead_letter_id UUID,
  source_queue   TEXT,
  source_job_id  UUID,
  attempts       INTEGER,
  error          TEXT,
  dead_on        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT j.id, j.source_name, j.source_id, j.source_retry_count,
         left(COALESCE(j.source_output->>'message', split_part(j.source_output->>'stack', E'\n', 1)), 300),
         j.created_on
    FROM pgboss.job j
   WHERE j.name = 'dead_letter'
     AND (p_source_queue IS NULL OR j.source_name = p_source_queue)
   ORDER BY j.created_on DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;

COMMENT ON FUNCTION public.fn_ops_dead_letter_list(TEXT, INTEGER) IS
  'Service-role-only: jobs in the dead-letter queue (all source queues, or one), newest first, up to 500: source queue and job id, attempts used, error message (no stack) and when it gave up. Payloads are not returned; redrive and delete are done by HQ API through pg-boss.';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_ops_dead_letter_list(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_dead_letter_list(TEXT, INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Workers: the newest pg-boss instance of each process name.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ops_worker_list()
RETURNS TABLE (
  instance_name TEXT,
  version       TEXT,
  node_version  TEXT,
  started_on    TIMESTAMPTZ,
  heartbeat_on  TIMESTAMPTZ,
  stopped_on    TIMESTAMPTZ,
  queue_count   INTEGER,
  is_silent     BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT DISTINCT ON (COALESCE(i.name, ''))
         i.name, i.version, i.node_version, i.started_on, i.heartbeat_on, i.stopped_on,
         COALESCE(jsonb_array_length(i.workers), 0),
         -- Two missed 30-second heartbeats plus margin (alert 3).
         i.stopped_on IS NOT NULL OR i.heartbeat_on IS NULL OR i.heartbeat_on < now() - interval '2 minutes'
    FROM pgboss.instance i
   ORDER BY COALESCE(i.name, ''), i.started_on DESC;
$$;

COMMENT ON FUNCTION public.fn_ops_worker_list() IS
  'Service-role-only: the newest pg-boss instance per process name (cmx-workers, hq-api; older rows are processes replaced by a deploy): versions, start, last heartbeat, how many queues it works, and is_silent when stopped or no heartbeat for 2 minutes. Host and process id are not returned.';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_ops_worker_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_worker_list() TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Alerts (DESIGN §8.2): the conditions true right now. HQ API polls this every minute and
--    reports a condition to Sentry once, and again only after it cleared.
-- -----------------------------------------------------------------------------

-- Alert 4 reads only uncertain rows; this partial index keeps that read tiny.
CREATE INDEX IF NOT EXISTS idx_ntfo_uncertain
  ON public.org_ntf_outbox_dtl (tenant_org_id, updated_at)
  WHERE reconcile_state = 'ACCEPTANCE_UNCERTAIN';
COMMENT ON INDEX public.idx_ntfo_uncertain IS
  'Outbox rows whose provider acceptance is uncertain (normally none). Used by fn_ops_job_alerts rule NTF_UNCERTAIN.';

CREATE OR REPLACE FUNCTION public.fn_ops_job_alerts()
RETURNS TABLE (
  rule_code TEXT,
  subject   TEXT,
  detail    JSONB,
  since     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  -- 1. A switched-on queue whose oldest ready job waited longer than its threshold.
  SELECT 'READY_TOO_OLD', q.queue_name,
         jsonb_build_object('ready', p.ready_count, 'oldest_s', p.ready_oldest_seconds, 'threshold_s', q.alert_ready_age_s),
         now() - make_interval(secs => p.ready_oldest_seconds)
    FROM public.sys_ops_job_queue_cf q
    JOIN public.sys_ops_job_cf c ON c.job_code = q.queue_name AND c.rec_status = 1 AND c.desired_enabled
    JOIN pgboss.queue p ON p.name = q.queue_name
   WHERE q.rec_status = 1
     AND q.alert_ready_age_s IS NOT NULL
     AND p.ready_oldest_seconds > q.alert_ready_age_s
  UNION ALL
  -- 2. Jobs that reached the dead-letter queue in the last 15 minutes, per source queue.
  SELECT 'DEAD_LETTER', j.source_name, jsonb_build_object('count', count(*)), min(j.created_on)
    FROM pgboss.job j
   WHERE j.name = 'dead_letter'
     AND j.created_on > now() - interval '15 minutes'
   GROUP BY j.source_name
  UNION ALL
  -- 3. A consumer with switched-on queues whose newest instance is missing or silent for 2 minutes.
  SELECT 'WORKER_SILENT', a.instance_name,
         jsonb_build_object('last_heartbeat', w.heartbeat_on, 'queues_on', a.queues_on),
         COALESCE(w.heartbeat_on, now())
    FROM (
      SELECT CASE q.consumer_app WHEN 'CMX_WORKERS' THEN 'cmx-workers' WHEN 'HQ_API' THEN 'hq-api' END AS instance_name,
             count(*) AS queues_on
        FROM public.sys_ops_job_queue_cf q
        JOIN public.sys_ops_job_cf c ON c.job_code = q.queue_name AND c.rec_status = 1 AND c.desired_enabled
       WHERE q.rec_status = 1
         AND q.consumer_app IN ('CMX_WORKERS', 'HQ_API')
       GROUP BY 1
    ) a
    LEFT JOIN LATERAL (
      SELECT i.heartbeat_on, i.stopped_on
        FROM pgboss.instance i
       WHERE i.name = a.instance_name
       ORDER BY i.started_on DESC
       LIMIT 1
    ) w ON true
   WHERE w.heartbeat_on IS NULL
      OR w.stopped_on IS NOT NULL
      OR w.heartbeat_on < now() - interval '2 minutes'
  UNION ALL
  -- 4. Notifications whose provider acceptance stayed uncertain for over an hour (count only).
  SELECT 'NTF_UNCERTAIN', 'ntf.outbox', jsonb_build_object('count', count(*)), min(o.updated_at)
    FROM public.org_ntf_outbox_dtl o
    JOIN public.org_tenants_mst t ON t.id = o.tenant_org_id
   WHERE o.tenant_org_id = t.id
     AND o.reconcile_state = 'ACCEPTANCE_UNCERTAIN'
     AND o.updated_at < now() - interval '1 hour'
  HAVING count(*) > 0;
$$;

COMMENT ON FUNCTION public.fn_ops_job_alerts() IS
  'Service-role-only: the background-job alert conditions true now (DESIGN §8.2). READY_TOO_OLD (subject = queue): oldest ready job older than alert_ready_age_s on a switched-on queue. DEAD_LETTER (subject = source queue): jobs dead-lettered in the last 15 minutes. WORKER_SILENT (subject = cmx-workers or hq-api): a consumer with switched-on queues whose newest pg-boss instance is missing, stopped or without heartbeat for 2 minutes. NTF_UNCERTAIN (subject = ntf.outbox): outbox rows ACCEPTANCE_UNCERTAIN for over an hour, count only. HQ API reports each to Sentry once per occurrence.';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_ops_job_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_alerts() TO service_role;

COMMIT;
