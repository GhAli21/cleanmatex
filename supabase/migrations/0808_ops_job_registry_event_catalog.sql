-- =============================================================================
-- Migration: 0808_ops_job_registry_event_catalog.sql
-- Purpose:   Background Jobs - one registry for every kind of background work, and
--            a seeded catalog of domain event types (DESIGN.md sections 20.7 - 21).
--            1. sys_ops_job_cf (the registry) gains kinds PGBOSS_QUEUE and
--               PGBOSS_SCHEDULE. Cron-only columns are required only for PG_CRON.
--            2. 0807 tables get their approved `_ops_` names:
--               sys_job_queue_cf  -> sys_ops_job_queue_cf (queue detail, 1:1 with a
--               PGBOSS_QUEUE registry row; holds the queue's runtime settings)
--               org_job_effect_tr -> org_ops_job_effect_tr.
--               Neither holds business data and no code uses them yet.
--            3. Queue `fin.domain_event` is removed: each event reaction gets its own
--               queue instead (DESIGN 20.2). Its subscription queues come with step 4.
--            4. New sys_ops_job_event_types_cd (34 seeded event codes, EN/AR) and
--               sys_ops_job_event_subs_cf (event -> reaction -> queue), mirrored into
--               pgboss.subscription by trigger, so publish() reaches exactly the
--               enabled reactions.
--            5. Event codes renamed to say what happened (DESIGN 21.1). Existing
--               org_domain_events_outbox rows and chk_history_action_type follow.
--               org_domain_events_outbox.event_type now references the catalog.
--            6. fn_ops_job_list_v2, fn_ops_job_set_state and fn_ops_job_run_now learn
--               the new kinds. Return shapes are unchanged, so HQ API needs no change.
-- Design:    docs/features/Background_Jobs/DESIGN.md
-- Security:  New tables and the new function are closed to PUBLIC, anon and
--            authenticated. sys_* is read service-side after HQ permission checks.
-- Paired code change: web-admin constants and emit sites use the new event codes in
--            the same release. The old codes are rejected by the new foreign key.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Registry: new kinds and kind-specific column rules.
-- -----------------------------------------------------------------------------

-- Kinds: PG_CRON (pg_cron runs fixed SQL), HQ_WORKER (legacy loop, removed at step 8),
-- PGBOSS_QUEUE (a pg-boss queue worked by a consumer app), PGBOSS_SCHEDULE (a cron
-- slot that sends one job into its target queue).
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind;
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind
  CHECK (kind IN ('PG_CRON', 'HQ_WORKER', 'PGBOSS_QUEUE', 'PGBOSS_SCHEDULE'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind ON public.sys_ops_job_cf IS
  'PG_CRON = pg_cron runs a fixed SQL command; HQ_WORKER = legacy worker loop (retired at Background Jobs step 8); PGBOSS_QUEUE = pg-boss queue worked by a consumer app; PGBOSS_SCHEDULE = cron slot that sends one job into its target queue.';

-- PGBOSS completion mode: the outcome is the pg-boss job state, not a cron run row.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_mode;
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_mode
  CHECK (completion_mode IN ('SYNC', 'ASYNC_HTTP', 'WORKER_QUEUE', 'PGBOSS'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_mode ON public.sys_ops_job_cf IS
  'SYNC = finishes inside the cron call; ASYNC_HTTP = legacy HTTP hand-off; WORKER_QUEUE = legacy HQ worker; PGBOSS = outcome is the pg-boss job state.';

ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind_mode;
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind_mode
  CHECK (((kind = 'HQ_WORKER') = (completion_mode = 'WORKER_QUEUE'))
     AND ((kind IN ('PGBOSS_QUEUE', 'PGBOSS_SCHEDULE')) = (completion_mode = 'PGBOSS')));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind_mode ON public.sys_ops_job_cf IS
  'HQ_WORKER always completes as WORKER_QUEUE; pg-boss kinds always complete as PGBOSS; other kinds use neither.';

-- applied_* is the state a running consumer reports back. Every worker-run kind may use it.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_applied;
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_applied
  CHECK (kind IN ('HQ_WORKER', 'PGBOSS_QUEUE', 'PGBOSS_SCHEDULE')
      OR (applied_schedule IS NULL AND applied_enabled IS NULL AND applied_at IS NULL AND applied_by IS NULL));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_applied ON public.sys_ops_job_cf IS
  'Only worker-run kinds (HQ_WORKER, PGBOSS_QUEUE, PGBOSS_SCHEDULE) carry the state their consumer reports in applied_*.';

-- RESTORE re-creates a pg_cron row from stored SQL; it means nothing for other kinds.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_wrk_act;
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_wrk_act
  CHECK (kind = 'PG_CRON' OR NOT ('RESTORE' = ANY (operator_actions)));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_wrk_act ON public.sys_ops_job_cf IS
  'RESTORE is allowed only for PG_CRON jobs.';

-- Cron-only columns become optional; ck_sys_ops_job_cf_kind_shape requires them where needed.
ALTER TABLE public.sys_ops_job_cf ALTER COLUMN cron_job_name DROP NOT NULL;
ALTER TABLE public.sys_ops_job_cf ALTER COLUMN default_schedule DROP NOT NULL;
COMMENT ON COLUMN public.sys_ops_job_cf.cron_job_name IS
  'pg_cron job name. Required for PG_CRON and HQ_WORKER rows; NULL for pg-boss kinds.';
COMMENT ON COLUMN public.sys_ops_job_cf.default_schedule IS
  'Default 5-field UTC cron schedule. Required for PG_CRON, HQ_WORKER and PGBOSS_SCHEDULE; NULL for PGBOSS_QUEUE (queues are fed by producers, not a clock).';

ALTER TABLE public.sys_ops_job_cf ADD COLUMN IF NOT EXISTS target_job_code TEXT NULL;
COMMENT ON COLUMN public.sys_ops_job_cf.target_job_code IS
  'PGBOSS_SCHEDULE only: job_code of the PGBOSS_QUEUE registry row that receives the scheduled job.';
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT fk_sys_ops_job_cf_target
  FOREIGN KEY (target_job_code) REFERENCES public.sys_ops_job_cf (job_code)
  ON UPDATE CASCADE ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_sys_ops_job_cf_target ON public.sys_ops_job_cf IS
  'A schedule points at an existing registry job; that job cannot be removed while the schedule exists.';

ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind_shape CHECK (
  CASE kind
    WHEN 'PG_CRON' THEN cron_job_name IS NOT NULL AND default_schedule IS NOT NULL AND target_job_code IS NULL
    WHEN 'HQ_WORKER' THEN cron_job_name IS NOT NULL AND default_schedule IS NOT NULL AND target_job_code IS NULL
    WHEN 'PGBOSS_QUEUE' THEN cron_job_name IS NULL AND default_schedule IS NULL AND schedule IS NULL
                             AND target_job_code IS NULL AND NOT run_now_allowed
    WHEN 'PGBOSS_SCHEDULE' THEN cron_job_name IS NULL AND default_schedule IS NOT NULL
                                AND target_job_code IS NOT NULL AND target_job_code <> job_code
    ELSE false
  END);
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind_shape ON public.sys_ops_job_cf IS
  'Per-kind required columns: cron jobs need a cron name and schedule; queues have no schedule and no Run now; schedules need a schedule and a different target job.';

-- -----------------------------------------------------------------------------
-- 2. Rename the 0807 tables to the approved `_ops_` names.
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_job_queue_cf RENAME TO sys_ops_job_queue_cf;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT pk_sys_job_queue_cf TO pk_sys_ops_job_queue_cf;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT ck_sjq_queue_name TO ck_sojq_queue_name;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT ck_sjq_consumer_app TO ck_sojq_consumer_app;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT ck_sjq_effect_class TO ck_sojq_effect_class;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT ck_sjq_rec_status TO ck_sojq_rec_status;
ALTER TABLE public.sys_ops_job_queue_cf RENAME CONSTRAINT ck_sjq_deleted_inactive TO ck_sojq_deleted_inactive;

ALTER TABLE public.org_job_effect_tr RENAME TO org_ops_job_effect_tr;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT pk_org_job_effect_tr TO pk_org_ops_job_effect_tr;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT uq_ojef_id_tenant TO uq_oojef_id_tenant;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT uq_ojef_tnt_key TO uq_oojef_tnt_key;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT fk_ojef_tenant TO fk_oojef_tenant;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT ck_ojef_effect_key TO ck_oojef_effect_key;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT ck_ojef_rec_status TO ck_oojef_rec_status;
ALTER TABLE public.org_ops_job_effect_tr RENAME CONSTRAINT ck_ojef_deleted_inactive TO ck_oojef_deleted_inactive;
COMMENT ON TABLE public.org_ops_job_effect_tr IS
  'One row per applied background-job effect per Organization. Inserted in the same transaction as the effect, so a retried or duplicated job never applies it twice. Permanent audit of which job applied which effect. (Created as org_job_effect_tr in 0807, renamed in 0808.)';

-- -----------------------------------------------------------------------------
-- 3. Queue detail: drop fin.domain_event, move labels and pause to the registry,
--    add runtime settings, link 1:1 to the registry.
-- -----------------------------------------------------------------------------

-- Replaced by one queue per event reaction (DESIGN 20.2). Empty: no producer ever used it.
DELETE FROM public.sys_ops_job_queue_cf WHERE queue_name = 'fin.domain_event';
SELECT pgboss.delete_queue('fin.domain_event');

-- Labels and the pause switch live on the registry row, so each job has one name and one switch.
ALTER TABLE public.sys_ops_job_queue_cf
  DROP COLUMN name,
  DROP COLUMN name2,
  DROP COLUMN description,
  DROP COLUMN description2,
  DROP COLUMN is_enabled;

-- Runtime settings: the source of truth HQ API copies into pgboss.queue (updateQueue).
ALTER TABLE public.sys_ops_job_queue_cf
  ADD COLUMN retry_limit       INTEGER      NULL,
  ADD COLUMN retry_delay_s     INTEGER      NULL,
  ADD COLUMN retry_backoff     BOOLEAN      NULL,
  ADD COLUMN retry_delay_max_s INTEGER      NULL,
  ADD COLUMN expire_s          INTEGER      NULL,
  ADD COLUMN heartbeat_s       INTEGER      NULL,
  ADD COLUMN retention_s       INTEGER      NULL,
  ADD COLUMN delete_after_s    INTEGER      NULL,
  ADD COLUMN dead_letter_queue TEXT         NULL,
  ADD COLUMN default_priority  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN local_concurrency INTEGER      NOT NULL DEFAULT 1,
  ADD COLUMN polling_s         NUMERIC(6,1) NOT NULL DEFAULT 30;

-- Backfill the remaining queues from what 0807 created in pg-boss.
UPDATE public.sys_ops_job_queue_cf d
SET retry_limit       = q.retry_limit,
    retry_delay_s     = q.retry_delay,
    retry_backoff     = q.retry_backoff,
    retry_delay_max_s = q.retry_delay_max,
    expire_s          = q.expire_seconds,
    heartbeat_s       = q.heartbeat_seconds,
    retention_s       = q.retention_seconds,
    delete_after_s    = q.deletion_seconds,
    dead_letter_queue = q.dead_letter,
    polling_s         = CASE WHEN d.queue_name = 'ops.smoke_test' THEN 2 ELSE 30 END,
    updated_info      = 'Migration 0808 - backfilled from pgboss.queue'
FROM pgboss.queue q
WHERE q.name = d.queue_name;

ALTER TABLE public.sys_ops_job_queue_cf
  ALTER COLUMN retry_limit   SET NOT NULL,
  ALTER COLUMN retry_delay_s SET NOT NULL,
  ALTER COLUMN retry_backoff SET NOT NULL,
  ALTER COLUMN expire_s      SET NOT NULL,
  ALTER COLUMN retention_s   SET NOT NULL,
  ALTER COLUMN delete_after_s SET NOT NULL;

ALTER TABLE public.sys_ops_job_queue_cf
  ADD CONSTRAINT ck_sojq_retry CHECK (retry_limit BETWEEN 0 AND 100 AND retry_delay_s >= 0
                                      AND (retry_delay_max_s IS NULL OR retry_delay_max_s >= retry_delay_s)),
  ADD CONSTRAINT ck_sojq_timing CHECK (expire_s BETWEEN 1 AND 1209600
                                       AND (heartbeat_s IS NULL OR heartbeat_s >= 10)
                                       AND retention_s >= 60 AND delete_after_s >= 0),
  ADD CONSTRAINT ck_sojq_runtime CHECK (local_concurrency BETWEEN 1 AND 50 AND polling_s BETWEEN 0.5 AND 300),
  ADD CONSTRAINT ck_sojq_dead_letter CHECK (dead_letter_queue IS DISTINCT FROM queue_name),
  ADD CONSTRAINT fk_sojq_dead_letter FOREIGN KEY (dead_letter_queue)
    REFERENCES public.sys_ops_job_queue_cf (queue_name) ON UPDATE CASCADE ON DELETE RESTRICT;

COMMENT ON TABLE public.sys_ops_job_queue_cf IS
  'Queue detail for each PGBOSS_QUEUE registry row (1:1, queue_name = sys_ops_job_cf.job_code): consumer app, effect class and runtime settings. Source of truth that HQ API copies into pgboss.queue; fn_ops_job_list_v2 reports SETTINGS_DRIFT when they differ. Names and the pause switch live on the registry row. (Created as sys_job_queue_cf in 0807, renamed in 0808.)';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.queue_name IS 'pg-boss queue name; equal to the job_code of its PGBOSS_QUEUE registry row.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.retry_limit IS 'Retries after the first attempt before the job moves to its dead-letter queue (pg-boss retryLimit).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.retry_delay_s IS 'Seconds before the first retry; the base of exponential backoff (pg-boss retryDelay).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.retry_backoff IS 'true = exponential backoff with jitter between retries (pg-boss retryBackoff).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.retry_delay_max_s IS 'Upper bound on the backoff delay in seconds; NULL = no bound (pg-boss retryDelayMax).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.expire_s IS 'Seconds a job may stay active before pg-boss expires and retries it. Handler timeouts must be shorter.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.heartbeat_s IS 'Consumer heartbeat interval; a silent consumer loses its job after this many seconds (pg-boss heartbeatSeconds). NULL = off.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.retention_s IS 'Seconds a waiting job is kept before pg-boss deletes it (pg-boss retentionSeconds).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.delete_after_s IS 'Seconds a finished job is kept for audit (pg-boss deleteAfterSeconds).';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.dead_letter_queue IS 'Queue that receives jobs after the last retry; NULL for the dead-letter queue itself.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.default_priority IS 'Default job priority; higher runs first. Transactional work above campaigns.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.local_concurrency IS 'Jobs one consumer process runs at once from this queue.';
COMMENT ON COLUMN public.sys_ops_job_queue_cf.polling_s IS 'Seconds between consumer polls of this queue (2 s notifications, 30 s other work; measured cost in DESIGN 13.2).';
COMMENT ON CONSTRAINT ck_sojq_retry ON public.sys_ops_job_queue_cf IS 'Retry settings are within pg-boss limits and the backoff cap is not below the base delay.';
COMMENT ON CONSTRAINT ck_sojq_timing ON public.sys_ops_job_queue_cf IS 'Expiry, heartbeat and retention values are within pg-boss limits.';
COMMENT ON CONSTRAINT ck_sojq_runtime ON public.sys_ops_job_queue_cf IS 'Consumer concurrency 1-50 and polling 0.5-300 seconds.';
COMMENT ON CONSTRAINT ck_sojq_dead_letter ON public.sys_ops_job_queue_cf IS 'A queue cannot be its own dead-letter queue.';
COMMENT ON CONSTRAINT fk_sojq_dead_letter ON public.sys_ops_job_queue_cf IS 'The dead-letter queue is itself a registered queue.';

-- Registry rows for the two remaining queues.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system, kind,
  cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, operator_actions, lifecycle_status, rec_order, created_info
) VALUES
  ('dead_letter', 'Dead letters', 'المهام المتعثرة',
   'Jobs that failed every retry. They wait here for a fix and a redrive from the HQ jobs screen.',
   'المهام التي فشلت في جميع المحاولات. تبقى هنا حتى يتم إصلاحها وإعادة تشغيلها من شاشة المهام في HQ.',
   'OPS', 'ops', 'pgboss', 'PGBOSS_QUEUE', NULL, NULL, NULL, true, false, 'PGBOSS',
   '0808_ops_job_registry_event_catalog.sql', 'No consumer by design. Retention 90 days.',
   ARRAY['OBSERVE'], 'ACTIVE', 10, 'Migration 0808 - registry row for pg-boss queue'),
  ('ops.smoke_test', 'Smoke test', 'اختبار التشغيل',
   'Test job that proves fetch, retry, dead-letter and redrive after each deploy. Touches no business data.',
   'مهمة اختبار تثبت الجلب وإعادة المحاولة والمهام المتعثرة وإعادة التشغيل بعد كل نشر. لا تمس بيانات العمل.',
   'OPS', 'ops', 'pgboss', 'PGBOSS_QUEUE', NULL, NULL, NULL, true, false, 'PGBOSS',
   '0808_ops_job_registry_event_catalog.sql', 'Consumed by cmx-workers.',
   ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', 90, 'Migration 0808 - registry row for pg-boss queue')
ON CONFLICT (job_code) DO NOTHING;

ALTER TABLE public.sys_ops_job_queue_cf ADD CONSTRAINT fk_sojq_registry
  FOREIGN KEY (queue_name) REFERENCES public.sys_ops_job_cf (job_code) ON UPDATE CASCADE ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_sojq_registry ON public.sys_ops_job_queue_cf IS
  'Every queue detail row belongs to a registry row; the registry row cannot be removed while its queue detail exists.';

-- -----------------------------------------------------------------------------
-- 4. Event type catalog.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ops_job_event_types_cd (
  event_code      TEXT        NOT NULL,
  domain_code     TEXT        NOT NULL,
  category_code   TEXT        NOT NULL,
  aggregate_type  TEXT        NULL,
  name            TEXT        NOT NULL,
  name2           TEXT        NOT NULL,
  description     TEXT        NULL,
  description2    TEXT        NULL,
  payload_version INTEGER     NOT NULL DEFAULT 1,
  is_financial    BOOLEAN     NOT NULL,
  can_disable     BOOLEAN     NOT NULL,
  is_reserved     BOOLEAN     NOT NULL DEFAULT false,
  is_enabled      BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT        NULL,
  created_info    TEXT        NULL,
  updated_at      TIMESTAMPTZ NULL,
  updated_by      TEXT        NULL,
  updated_info    TEXT        NULL,
  updated_count   INTEGER     NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMPTZ NULL,
  deleted_by      TEXT        NULL,
  deleted_info    TEXT        NULL,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  rec_order       INTEGER     NULL,
  rec_notes       TEXT        NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ops_job_event_types_cd PRIMARY KEY (event_code),
  CONSTRAINT ck_sojet_code CHECK (event_code ~ '^[A-Z][A-Z0-9_]*$' AND length(event_code) <= 64),
  CONSTRAINT ck_sojet_domain CHECK (domain_code IN ('ORDER', 'PAYMENT', 'LOYALTY', 'STORED_VALUE', 'AR', 'FINANCE', 'CASH_DRAWER', 'WORKFLOW')),
  CONSTRAINT ck_sojet_category CHECK (category_code IN ('FACT', 'REQUEST')),
  CONSTRAINT ck_sojet_payload_version CHECK (payload_version >= 1),
  CONSTRAINT ck_sojet_financial CHECK (NOT (is_financial AND can_disable)),
  CONSTRAINT ck_sojet_disable CHECK (can_disable OR is_enabled),
  CONSTRAINT ck_sojet_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_sojet_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

COMMENT ON TABLE  public.sys_ops_job_event_types_cd IS 'Catalog of domain event codes written to org_domain_events_outbox and published to pg-boss. Code constants mirror it exactly (CLAUDE.md rule 9). Reactions are in sys_ops_job_event_subs_cf.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.event_code IS 'Event code: a past-tense fact (<OBJECT>_<PAST_VERB>) or a request (<THING>_REQUESTED). Upper snake case, identical to the code constant.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.domain_code IS 'Business domain that produces the event.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.category_code IS 'FACT = something happened; REQUEST = work was asked for (for example a recalculation).';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.aggregate_type IS 'aggregate_type the producer writes on org_domain_events_outbox for this code.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.name IS 'English display name.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.description IS 'English description of what happened when this event is written.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.description2 IS 'Arabic description of what happened when this event is written.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.payload_version IS 'Version of the payload shape; producers and consumers change it together, additively.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.is_financial IS 'true = the event carries money effects. It can be paused through its queues but never disabled.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.can_disable IS 'true = an operator may stop publishing it. Always false for financial events.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.is_reserved IS 'true = code is catalogued for a planned feature but no code writes it yet.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.is_enabled IS 'false = publish() creates no jobs for it (its pg-boss subscriptions are removed). The event row is still written for audit and replay.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.created_by IS 'User or actor that created the row.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.updated_by IS 'User or actor that last updated the row.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.updated_count IS 'Monotonic update counter (incremented by trigger).';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.deleted_by IS 'User or actor that soft-deleted the row.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.rec_status IS 'Record status: 1 active, 0 soft-deleted, 2 archived.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.rec_order IS 'Display order on the HQ jobs screen.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.rec_notes IS 'Optional operator notes.';
COMMENT ON COLUMN public.sys_ops_job_event_types_cd.is_active IS 'True when the catalog row is live.';
COMMENT ON CONSTRAINT pk_sys_ops_job_event_types_cd ON public.sys_ops_job_event_types_cd IS 'One row per event code.';
COMMENT ON CONSTRAINT ck_sojet_code ON public.sys_ops_job_event_types_cd IS 'Upper snake case, at most 64 characters.';
COMMENT ON CONSTRAINT ck_sojet_domain ON public.sys_ops_job_event_types_cd IS 'Allowed producing domains.';
COMMENT ON CONSTRAINT ck_sojet_category ON public.sys_ops_job_event_types_cd IS 'FACT or REQUEST.';
COMMENT ON CONSTRAINT ck_sojet_payload_version ON public.sys_ops_job_event_types_cd IS 'Payload versions start at 1.';
COMMENT ON CONSTRAINT ck_sojet_financial ON public.sys_ops_job_event_types_cd IS 'Financial events can never be marked disableable (Owner decision E3).';
COMMENT ON CONSTRAINT ck_sojet_disable ON public.sys_ops_job_event_types_cd IS 'Only disableable events may be disabled.';
COMMENT ON CONSTRAINT ck_sojet_rec_status ON public.sys_ops_job_event_types_cd IS 'Standard CleanMateX rec_status values (0, 1, 2).';
COMMENT ON CONSTRAINT ck_sojet_deleted_inactive ON public.sys_ops_job_event_types_cd IS 'Soft-deleted or archived rows cannot stay active.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.sys_ops_job_event_types_cd;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.sys_ops_job_event_types_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.sys_ops_job_event_types_cd IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.sys_ops_job_event_types_cd ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ops_job_event_types_cd FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sys_ops_job_event_types_cd TO service_role;

-- Seed: every code the application writes, with the approved names (DESIGN 21).
INSERT INTO public.sys_ops_job_event_types_cd
  (event_code, domain_code, category_code, aggregate_type, is_financial, can_disable, is_reserved, rec_order, name, name2, description, description2)
VALUES
  ('ORDER_SUBMITTED', 'ORDER', 'FACT', 'order', true, false, false, 100,
   'Order submitted', 'تم تقديم الطلب',
   'An order was submitted from checkout and its financial snapshot saved, paid or not.',
   'تم تقديم طلب من صفحة الدفع وحُفظ ملخصه المالي، سواء كان مدفوعًا أم لا.'),
  ('ORDER_FINANCIAL_ADJUSTMENT_CREATED', 'ORDER', 'FACT', 'order', true, false, false, 110,
   'Order financial adjustment created', 'تم إنشاء تعديل مالي على الطلب',
   'A financial adjustment was created on an order.',
   'تم إنشاء تعديل مالي على طلب.'),
  ('ORDER_CHANGE_APPLIED', 'ORDER', 'FACT', 'order_change', true, false, false, 120,
   'Order change applied', 'تم تطبيق تعديل الطلب',
   'An approved order change was applied to its order.',
   'تم تطبيق تعديل معتمد على الطلب.'),
  ('ORDER_CANCEL_FINANCIALS_UNWOUND', 'ORDER', 'FACT', 'order', true, false, false, 130,
   'Cancelled order financials unwound', 'تم عكس الآثار المالية للطلب الملغى',
   'The money effects of a cancelled order were reversed.',
   'تم عكس الآثار المالية لطلب ملغى.'),
  ('PAYMENT_RECEIVED', 'PAYMENT', 'FACT', 'order', true, false, false, 200,
   'Payment received', 'تم استلام دفعة',
   'A payment was collected against an order.',
   'تم تحصيل دفعة على طلب.'),
  ('PAYMENT_VERIFIED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 210,
   'Payment verified', 'تم التحقق من الدفعة',
   'A pending payment was verified and completed.',
   'تم التحقق من دفعة معلّقة واكتملت.'),
  ('PAYMENT_CANCELLED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 220,
   'Payment cancelled', 'تم إلغاء الدفعة',
   'A pending or processing payment was cancelled.',
   'تم إلغاء دفعة معلّقة أو قيد المعالجة.'),
  ('PAYMENT_FAILED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 230,
   'Payment failed', 'فشلت الدفعة',
   'A pending or processing payment failed or bounced.',
   'فشلت دفعة معلّقة أو قيد المعالجة أو ارتدّت.'),
  ('PAYMENT_VOIDED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 240,
   'Payment voided', 'تم إبطال الدفعة',
   'A payment that never took effect was voided.',
   'تم إبطال دفعة لم تُنفَّذ.'),
  ('PAYMENT_REVERSED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 250,
   'Payment reversed', 'تم عكس الدفعة',
   'A completed payment was reversed.',
   'تم عكس دفعة مكتملة.'),
  ('PAYMENT_CAPTURED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 260,
   'Payment captured', 'تم تحصيل الدفعة المفوَّضة',
   'An authorized payment was captured.',
   'تم تحصيل دفعة مفوَّضة.'),
  ('PAYMENT_SETTLED', 'PAYMENT', 'FACT', 'order_payment', true, false, false, 270,
   'Payment settled', 'تمت تسوية الدفعة',
   'A payment was settled.',
   'تمت تسوية دفعة.'),
  ('REFUND_PROCESSED', 'PAYMENT', 'FACT', 'order_refund', true, false, false, 280,
   'Refund processed', 'تمت معالجة الاسترداد',
   'A refund was processed for an order.',
   'تمت معالجة استرداد لطلب.'),
  ('LOYALTY_EARN_RECALC_REQUESTED', 'LOYALTY', 'REQUEST', 'order', true, false, false, 300,
   'Loyalty earn recalculation requested', 'طلب إعادة احتساب نقاط الولاء',
   'A money change asked for the order''s loyalty points to be recalculated.',
   'طلب تغيير مالي إعادة احتساب نقاط الولاء للطلب.'),
  ('STORED_VALUE_REDEEMED', 'STORED_VALUE', 'FACT', 'order', true, false, false, 400,
   'Stored value redeemed', 'تم استخدام الرصيد المخزَّن',
   'Stored value (gift card, wallet or credit note) was applied to an order.',
   'تم استخدام رصيد مخزَّن (بطاقة هدية أو محفظة أو إشعار دائن) على طلب.'),
  ('STORED_VALUE_FUNDING_COMPLETED', 'STORED_VALUE', 'FACT', 'stored_value_funding', true, false, false, 410,
   'Stored value funding completed', 'اكتمل شحن الرصيد المخزَّن',
   'A gift card sale, wallet top-up or customer advance finished crediting its ledger.',
   'اكتمل قيد بيع بطاقة هدية أو شحن محفظة أو دفعة مقدّمة للعميل.'),
  ('GIFT_CARD_REDEEMED', 'STORED_VALUE', 'FACT', 'gift_card', true, false, true, 420,
   'Gift card redeemed', 'تم استخدام بطاقة الهدية',
   'Reserved: a gift card balance was used. No code writes it yet; it is planned for gift-card-level reactions.',
   'محجوز: تم استخدام رصيد بطاقة هدية. لا يوجد كود يكتبه حاليًا، وهو مخطط لتفاعلات على مستوى بطاقة الهدية.'),
  ('AR_INVOICE_ISSUED', 'AR', 'FACT', 'ar_invoice', true, false, false, 500,
   'AR invoice issued', 'تم إصدار فاتورة ذمم مدينة',
   'An accounts-receivable invoice was issued.',
   'تم إصدار فاتورة ذمم مدينة.'),
  ('AR_INVOICE_VOIDED', 'AR', 'FACT', 'ar_invoice', true, false, false, 510,
   'AR invoice voided', 'تم إلغاء فاتورة ذمم مدينة',
   'An accounts-receivable invoice was voided.',
   'تم إلغاء فاتورة ذمم مدينة.'),
  ('AR_PAYMENT_ALLOCATED', 'AR', 'FACT', 'ar_invoice', true, false, false, 520,
   'AR payment allocated', 'تم تخصيص دفعة لفاتورة ذمم مدينة',
   'A payment was allocated to an accounts-receivable invoice.',
   'تم تخصيص دفعة لفاتورة ذمم مدينة.'),
  ('AR_PAYMENT_ALLOCATION_REVERSED', 'AR', 'FACT', 'ar_invoice', true, false, false, 530,
   'AR payment allocation reversed', 'تم عكس تخصيص دفعة ذمم مدينة',
   'A payment allocation on an accounts-receivable invoice was reversed.',
   'تم عكس تخصيص دفعة على فاتورة ذمم مدينة.'),
  ('AR_OVERPAYMENT_CREDIT_CREATED', 'AR', 'FACT', 'ar_invoice', true, false, false, 540,
   'AR overpayment credit created', 'تم إنشاء رصيد دائن من دفعة زائدة',
   'An overpayment on an accounts-receivable invoice created a customer credit.',
   'أنشأت دفعة زائدة على فاتورة ذمم مدينة رصيدًا دائنًا للعميل.'),
  ('AR_CREDIT_MEMO_POSTED', 'AR', 'FACT', 'ar_invoice', true, false, false, 550,
   'AR credit memo posted', 'تم ترحيل إشعار دائن',
   'A credit adjustment on an accounts-receivable invoice was posted.',
   'تم ترحيل تعديل دائن على فاتورة ذمم مدينة.'),
  ('AR_DEBIT_NOTE_POSTED', 'AR', 'FACT', 'ar_invoice', true, false, false, 560,
   'AR debit note posted', 'تم ترحيل إشعار مدين',
   'A debit adjustment on an accounts-receivable invoice was posted.',
   'تم ترحيل تعديل مدين على فاتورة ذمم مدينة.'),
  ('AR_WRITE_OFF_POSTED', 'AR', 'FACT', 'ar_invoice', true, false, false, 570,
   'AR write-off posted', 'تم ترحيل شطب دين',
   'A write-off on an accounts-receivable invoice was posted.',
   'تم ترحيل شطب على فاتورة ذمم مدينة.'),
  ('VOUCHER_POSTED_AND_WIRED', 'FINANCE', 'FACT', 'fin_voucher', true, false, false, 600,
   'Voucher posted and wired', 'تم ترحيل السند وربطه',
   'A voucher was posted and all its line effects were applied in one transaction.',
   'تم ترحيل سند وتطبيق جميع آثار بنوده في معاملة واحدة.'),
  ('VOUCHER_REVERSED', 'FINANCE', 'FACT', 'fin_voucher', true, false, false, 610,
   'Voucher reversed', 'تم عكس السند',
   'Posted voucher lines were reversed.',
   'تم عكس بنود سند مُرحَّل.'),
  ('CASH_DRAWER_SESSION_OPENED', 'CASH_DRAWER', 'FACT', 'cash_drawer_session', true, false, false, 700,
   'Cash drawer session opened', 'تم فتح جلسة الدرج النقدي',
   'A cash drawer session was opened.',
   'تم فتح جلسة درج نقدي.'),
  ('CASH_DRAWER_SESSION_CLOSE_STARTED', 'CASH_DRAWER', 'FACT', 'cash_drawer_session', true, false, false, 710,
   'Cash drawer session close started', 'بدأ إغلاق جلسة الدرج النقدي',
   'Closing a cash drawer session was started.',
   'بدأ إغلاق جلسة درج نقدي.'),
  ('CASH_DRAWER_SESSION_CLOSED', 'CASH_DRAWER', 'FACT', 'cash_drawer_session', true, false, false, 720,
   'Cash drawer session closed', 'تم إغلاق جلسة الدرج النقدي',
   'A cash drawer session was closed.',
   'تم إغلاق جلسة درج نقدي.'),
  ('CASH_DRAWER_VARIANCE_RECORDED', 'CASH_DRAWER', 'FACT', 'cash_drawer_session', true, false, false, 730,
   'Cash drawer variance recorded', 'تم تسجيل فرق في الدرج النقدي',
   'A cash difference was recorded for a drawer session: at opening, at closing or at variance approval.',
   'تم تسجيل فرق نقدي لجلسة درج: عند الفتح أو الإغلاق أو اعتماد الفرق.'),
  ('CASH_DRAWER_TRX_POSTED', 'CASH_DRAWER', 'FACT', 'cash_drawer_trx', true, false, false, 740,
   'Cash drawer transaction posted', 'تم ترحيل حركة الدرج النقدي',
   'A cash drawer transaction was posted.',
   'تم ترحيل حركة درج نقدي.'),
  ('CASH_LINE_SESSION_REDIRECTED', 'CASH_DRAWER', 'FACT', 'fin_voucher_line', true, false, false, 750,
   'Cash line redirected to another session', 'تم توجيه بند نقدي إلى جلسة أخرى',
   'A cash line was posted to a different drawer session than the one requested.',
   'تم ترحيل بند نقدي إلى جلسة درج غير الجلسة المطلوبة.'),
  ('WORKFLOW_GATE_DECISION_ACCEPTED', 'WORKFLOW', 'FACT', 'workflow_gate_decision', false, true, false, 800,
   'Workflow gate decision accepted', 'تم قبول قرار بوابة سير العمل',
   'A workflow gate decision was accepted for an order action.',
   'تم قبول قرار بوابة سير العمل لإجراء على طلب.')
ON CONFLICT (event_code) DO NOTHING;

UPDATE public.sys_ops_job_event_types_cd
SET created_by = 'migration', created_info = 'Migration 0808 - event type catalog seed'
WHERE created_info IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Event subscriptions: which reaction runs for which event, through which queue.
--    Rows arrive with Background Jobs step 4, together with their queues.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_ops_job_event_subs_cf (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_code      TEXT        NOT NULL,
  handler_code    TEXT        NOT NULL,
  queue_job_code  TEXT        NOT NULL,
  description     TEXT        NULL,
  description2    TEXT        NULL,
  is_enabled      BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT        NULL,
  created_info    TEXT        NULL,
  updated_at      TIMESTAMPTZ NULL,
  updated_by      TEXT        NULL,
  updated_info    TEXT        NULL,
  updated_count   INTEGER     NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMPTZ NULL,
  deleted_by      TEXT        NULL,
  deleted_info    TEXT        NULL,
  rec_status      SMALLINT    NOT NULL DEFAULT 1,
  rec_order       INTEGER     NULL,
  rec_notes       TEXT        NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ops_job_event_subs_cf PRIMARY KEY (id),
  CONSTRAINT uq_sojes_event_handler UNIQUE (event_code, handler_code),
  CONSTRAINT uq_sojes_queue UNIQUE (queue_job_code),
  CONSTRAINT fk_sojes_event FOREIGN KEY (event_code)
    REFERENCES public.sys_ops_job_event_types_cd (event_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sojes_queue FOREIGN KEY (queue_job_code)
    REFERENCES public.sys_ops_job_cf (job_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_sojes_handler CHECK (handler_code ~ '^[a-z][a-z0-9_]*$' AND length(handler_code) <= 64),
  CONSTRAINT ck_sojes_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_sojes_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

COMMENT ON TABLE  public.sys_ops_job_event_subs_cf IS 'Event reactions: when event_code is published, one job goes to queue_job_code and is run by the handler handler_code. Each reaction has its own queue so it pauses, retries and dead-letters alone. Mirrored into pgboss.subscription by fn_ops_job_evt_sub_sync.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.id IS 'Reaction UUID primary key.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.event_code IS 'Event this reaction listens to.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.handler_code IS 'Stable key of the handler in the consumer''s handler registry (lower snake case), for example order_history.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.queue_job_code IS 'PGBOSS_QUEUE registry job (and pg-boss queue) that carries this reaction''s jobs. One queue per reaction.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.description IS 'English description of what the reaction does.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.description2 IS 'Arabic description of what the reaction does.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.is_enabled IS 'false = publish() sends this reaction no jobs. Reactions to financial events can be paused through their queue but not disabled.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.created_by IS 'User or actor that created the row.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.updated_by IS 'User or actor that last updated the row.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.updated_count IS 'Monotonic update counter (incremented by trigger).';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.deleted_by IS 'User or actor that soft-deleted the row.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.rec_status IS 'Record status: 1 active, 0 soft-deleted, 2 archived.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.rec_order IS 'Display order on the HQ jobs screen.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.rec_notes IS 'Optional operator notes.';
COMMENT ON COLUMN public.sys_ops_job_event_subs_cf.is_active IS 'True when the row is live.';
COMMENT ON CONSTRAINT pk_sys_ops_job_event_subs_cf ON public.sys_ops_job_event_subs_cf IS 'Surrogate primary key.';
COMMENT ON CONSTRAINT uq_sojes_event_handler ON public.sys_ops_job_event_subs_cf IS 'A handler reacts to an event at most once.';
COMMENT ON CONSTRAINT uq_sojes_queue ON public.sys_ops_job_event_subs_cf IS 'One queue per reaction, so each reaction is paused and retried alone.';
COMMENT ON CONSTRAINT fk_sojes_event ON public.sys_ops_job_event_subs_cf IS 'Reaction belongs to a catalogued event; event renames cascade.';
COMMENT ON CONSTRAINT fk_sojes_queue ON public.sys_ops_job_event_subs_cf IS 'Reaction queue is a registered job (checked to be PGBOSS_QUEUE by fn_ops_job_evt_sub_sync).';
COMMENT ON CONSTRAINT ck_sojes_handler ON public.sys_ops_job_event_subs_cf IS 'Handler codes are lower snake case, at most 64 characters.';
COMMENT ON CONSTRAINT ck_sojes_rec_status ON public.sys_ops_job_event_subs_cf IS 'Standard CleanMateX rec_status values (0, 1, 2).';
COMMENT ON CONSTRAINT ck_sojes_deleted_inactive ON public.sys_ops_job_event_subs_cf IS 'Soft-deleted or archived rows cannot stay active.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.sys_ops_job_event_subs_cf;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.sys_ops_job_event_subs_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.sys_ops_job_event_subs_cf IS 'Keeps updated_at and updated_count current.';

ALTER TABLE public.sys_ops_job_event_subs_cf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ops_job_event_subs_cf FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sys_ops_job_event_subs_cf TO service_role;

-- Keeps pgboss.subscription equal to the enabled reactions of enabled events, so
-- publish() never needs a catalog lookup. Also enforces two rules a CHECK cannot:
-- the reaction queue must be a PGBOSS_QUEUE job, and reactions to financial events
-- cannot be disabled (Owner decision E3).
CREATE OR REPLACE FUNCTION public.fn_ops_job_evt_sub_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pgboss', 'pg_temp'
AS $$
DECLARE
  v_codes TEXT[];
BEGIN
  IF TG_TABLE_NAME = 'sys_ops_job_event_subs_cf' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.sys_ops_job_cf r
        WHERE r.job_code = NEW.queue_job_code AND r.kind = 'PGBOSS_QUEUE'
      ) THEN
        RAISE EXCEPTION 'Reaction queue % is not a PGBOSS_QUEUE registry job', NEW.queue_job_code
          USING ERRCODE = 'check_violation';
      END IF;
      IF NOT NEW.is_enabled AND EXISTS (
        SELECT 1 FROM public.sys_ops_job_event_types_cd t
        WHERE t.event_code = NEW.event_code AND t.is_financial
      ) THEN
        RAISE EXCEPTION 'Reactions to financial event % can be paused but not disabled', NEW.event_code
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    v_codes := ARRAY_REMOVE(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.event_code END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.event_code END
    ], NULL);
  ELSE
    -- sys_ops_job_event_types_cd: AFTER UPDATE only.
    v_codes := ARRAY_REMOVE(ARRAY[OLD.event_code, NEW.event_code], NULL);
  END IF;

  DELETE FROM pgboss.subscription WHERE event = ANY (v_codes);

  INSERT INTO pgboss.subscription (event, name, created_on, updated_on)
  SELECT s.event_code, s.queue_job_code, now(), now()
  FROM public.sys_ops_job_event_subs_cf s
  JOIN public.sys_ops_job_event_types_cd t ON t.event_code = s.event_code
  WHERE s.event_code = ANY (v_codes)
    AND s.is_enabled AND s.is_active AND s.rec_status = 1
    AND t.is_enabled AND t.is_active AND t.rec_status = 1
  ON CONFLICT (event, name) DO NOTHING;

  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.fn_ops_job_evt_sub_sync() IS
  'Trigger: mirrors enabled reactions of enabled event types into pgboss.subscription; rejects non-queue reaction targets and disabling a reaction to a financial event.';
REVOKE ALL ON FUNCTION public.fn_ops_job_evt_sub_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sojes_sync ON public.sys_ops_job_event_subs_cf;
CREATE TRIGGER trg_sojes_sync AFTER INSERT OR UPDATE OR DELETE ON public.sys_ops_job_event_subs_cf
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_job_evt_sub_sync();
COMMENT ON TRIGGER trg_sojes_sync ON public.sys_ops_job_event_subs_cf IS 'Keeps pgboss.subscription in step with reactions.';

DROP TRIGGER IF EXISTS trg_sojet_sync ON public.sys_ops_job_event_types_cd;
CREATE TRIGGER trg_sojet_sync AFTER UPDATE OF event_code, is_enabled, is_active, rec_status ON public.sys_ops_job_event_types_cd
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_job_evt_sub_sync();
COMMENT ON TRIGGER trg_sojet_sync ON public.sys_ops_job_event_types_cd IS 'Enabling, disabling or renaming an event type re-syncs its pg-boss subscriptions.';

-- -----------------------------------------------------------------------------
-- 6. Rename event codes (DESIGN 21.1) and link the event log to the catalog.
-- -----------------------------------------------------------------------------
UPDATE public.org_domain_events_outbox
SET event_type = CASE event_type
  WHEN 'ORDER_COMPLETED'               THEN 'ORDER_SUBMITTED'
  WHEN 'LOYALTY_EARN'                  THEN 'LOYALTY_EARN_RECALC_REQUESTED'
  WHEN 'STORED_VALUE_CHANGED'          THEN 'STORED_VALUE_REDEEMED'
  WHEN 'ORDER_CANCEL_FINANCIAL_UNWIND' THEN 'ORDER_CANCEL_FINANCIALS_UNWOUND'
  WHEN 'CASH_DRAWER_SESSION_CLOSING'   THEN 'CASH_DRAWER_SESSION_CLOSE_STARTED'
  WHEN 'CASH_DRAWER_OVER_SHORT'        THEN 'CASH_DRAWER_VARIANCE_RECORDED'
  WHEN 'CASH_FACT_REDIRECTED'          THEN 'CASH_LINE_SESSION_REDIRECTED'
END
WHERE event_type IN ('ORDER_COMPLETED', 'LOYALTY_EARN', 'STORED_VALUE_CHANGED', 'ORDER_CANCEL_FINANCIAL_UNWIND',
                     'CASH_DRAWER_SESSION_CLOSING', 'CASH_DRAWER_OVER_SHORT', 'CASH_FACT_REDIRECTED');

-- Fail with a readable message, rather than a bare FK error, if any row still has an
-- uncatalogued code.
DO $$
DECLARE
  v_unknown TEXT;
BEGIN
  SELECT string_agg(DISTINCT o.event_type, ', ') INTO v_unknown
  FROM public.org_domain_events_outbox o
  WHERE NOT EXISTS (SELECT 1 FROM public.sys_ops_job_event_types_cd t WHERE t.event_code = o.event_type);
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'org_domain_events_outbox has event codes missing from sys_ops_job_event_types_cd: %', v_unknown;
  END IF;
END $$;

ALTER TABLE public.org_domain_events_outbox ADD CONSTRAINT fk_odeo_event_type
  FOREIGN KEY (event_type) REFERENCES public.sys_ops_job_event_types_cd (event_code)
  ON UPDATE CASCADE ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_odeo_event_type ON public.org_domain_events_outbox IS
  'Every event row uses a catalogued code, so a typo fails the business transaction instead of creating an event nothing reacts to. Catalog renames cascade.';

-- Serves the foreign-key checks when a catalog code is renamed or removed.
CREATE INDEX IF NOT EXISTS idx_odeo_event_type ON public.org_domain_events_outbox (event_type);
COMMENT ON INDEX public.idx_odeo_event_type IS 'Supports fk_odeo_event_type cascades and per-code counts on the HQ jobs screen.';

-- Order history: the event-derived action ORDER_COMPLETED becomes ORDER_SUBMITTED.
UPDATE public.org_order_history SET action_type = 'ORDER_SUBMITTED' WHERE action_type = 'ORDER_COMPLETED';
ALTER TABLE public.org_order_history DROP CONSTRAINT chk_history_action_type;
ALTER TABLE public.org_order_history ADD CONSTRAINT chk_history_action_type CHECK (action_type IN (
  'ORDER_CREATED', 'STATUS_CHANGE', 'FIELD_UPDATE', 'SPLIT', 'QA_DECISION', 'ITEM_STEP',
  'ISSUE_CREATED', 'ISSUE_SOLVED', 'ORDER_CANCELLED', 'CUSTOMER_RETURN', 'ORDER_SUBMITTED',
  'VOUCHER_POSTED_AND_WIRED', 'AR_INVOICE_ISSUED', 'PAYMENT_VERIFIED', 'PAYMENT_CANCELLED',
  'PAYMENT_FAILED', 'PAYMENT_VOIDED', 'PAYMENT_REVERSED', 'PAYMENT_CAPTURED', 'PAYMENT_SETTLED'
));
COMMENT ON CONSTRAINT chk_history_action_type ON public.org_order_history IS
  'Allowed history actions. Event-derived actions mirror sys_ops_job_event_types_cd codes exactly (ORDER_COMPLETED renamed to ORDER_SUBMITTED in 0808).';

-- -----------------------------------------------------------------------------
-- 7. Registry functions learn the new kinds. Signatures and result shapes unchanged.
-- -----------------------------------------------------------------------------

-- Lists every registry job with drift flags. pg-boss kinds use the state their consumer
-- reports in applied_*; queues also report MISSING_IN_QUEUE and SETTINGS_DRIFT.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list_v2()
 RETURNS TABLE(job_code text, name text, name2 text, description text, description2 text, category text, module text, sub_system text, kind text, cron_job_name text, default_schedule text, schedule_override text, effective_schedule text, actual_schedule text, actual_active boolean, desired_enabled boolean, cron_jobid bigint, command_present boolean, run_now_allowed boolean, completion_mode text, source_migration text, notes text, is_active boolean, operator_actions text[], drift_flags text[], last_run_at timestamp with time zone, last_run_status text, last_run_message text, last_run_source text, last_run_trigger text, last_run_actor text, lifecycle_status text, superseded_by text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
  SELECT
    c.job_code, c.name, c.name2, c.description, c.description2,
    c.category, c.module, c.sub_system, c.kind, c.cron_job_name,
    c.default_schedule, c.schedule, COALESCE(c.schedule, c.default_schedule),
    CASE WHEN c.kind = 'PG_CRON' THEN j.schedule ELSE c.applied_schedule END,
    CASE WHEN c.kind = 'PG_CRON' THEN j.active ELSE c.applied_enabled END,
    c.desired_enabled, j.jobid,
    CASE WHEN c.kind = 'PG_CRON' THEN COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false)
         ELSE c.applied_at IS NOT NULL END,
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
    CASE WHEN c.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
      ARRAY['SUPERSEDED']::text[]
    WHEN c.kind = 'PGBOSS_QUEUE' THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN pq.name IS NULL THEN 'MISSING_IN_QUEUE' END,
        CASE WHEN qd.consumer_app IS DISTINCT FROM 'NONE'
               AND c.desired_enabled
               AND (c.applied_at IS NULL OR c.applied_at < now() - interval '20 minutes')
             THEN 'WORKER_NOT_SEEN' END,
        CASE WHEN c.applied_at IS NOT NULL AND c.applied_enabled IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END,
        CASE WHEN pq.name IS NOT NULL AND qd.queue_name IS NOT NULL AND (
               pq.retry_limit, pq.retry_delay, pq.retry_backoff, pq.retry_delay_max,
               pq.expire_seconds, pq.retention_seconds, pq.deletion_seconds,
               pq.heartbeat_seconds, pq.dead_letter
             ) IS DISTINCT FROM (
               qd.retry_limit, qd.retry_delay_s, qd.retry_backoff, qd.retry_delay_max_s,
               qd.expire_s, qd.retention_s, qd.delete_after_s,
               qd.heartbeat_s, qd.dead_letter_queue
             )
             THEN 'SETTINGS_DRIFT' END
      ], NULL)
    WHEN c.kind IN ('HQ_WORKER', 'PGBOSS_SCHEDULE') THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN (
               c.desired_enabled
               OR EXISTS (
                 SELECT 1 FROM public.sys_ops_job_req_tr q
                 WHERE q.job_code = c.job_code
                   AND q.status = 'REQUESTED'
                   AND q.trigger_type = 'MANUAL'
                   AND q.is_active
                   AND q.rec_status = 1
               )
             )
             AND (c.applied_at IS NULL OR c.applied_at < now() - interval '20 minutes')
             THEN 'WORKER_NOT_SEEN' END,
        CASE WHEN c.applied_at IS NOT NULL
               AND c.applied_schedule IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN c.applied_at IS NOT NULL AND c.applied_enabled IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    ELSE
      ARRAY_REMOVE(ARRAY[
        CASE WHEN j.jobid IS NULL THEN 'MISSING_IN_CRON' END,
        CASE WHEN j.jobid IS NOT NULL
               AND btrim(j.schedule) IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN j.jobid IS NOT NULL AND j.active IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.started_at ELSE cr.run_at END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.status ELSE cr.run_status END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.message ELSE cr.run_message END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN 'OPS_LOG' WHEN cr.run_at IS NOT NULL THEN 'CRON' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.trigger_type WHEN cr.run_at IS NOT NULL THEN 'SCHEDULE' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.actor END,
    c.lifecycle_status,
    c.superseded_by
  FROM public.sys_ops_job_cf c
  LEFT JOIN cron.job j ON j.jobname = c.cron_job_name AND c.kind = 'PG_CRON'
  LEFT JOIN public.sys_ops_job_queue_cf qd ON qd.queue_name = c.job_code AND c.kind = 'PGBOSS_QUEUE'
  LEFT JOIN pgboss.queue pq ON pq.name = c.job_code AND c.kind = 'PGBOSS_QUEUE'
  LEFT JOIN LATERAL (
    SELECT d.start_time AS run_at,
           CASE d.status WHEN 'succeeded' THEN 'SUCCESS' WHEN 'failed' THEN 'FAILED' ELSE 'RUNNING' END AS run_status,
           left(d.return_message, 1000) AS run_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid AND d.start_time IS NOT NULL
    ORDER BY d.start_time DESC
    LIMIT 1
  ) cr ON true
  LEFT JOIN LATERAL (
    SELECT r.started_at, r.status, r.message, r.trigger_type, r.actor
    FROM public.sys_ops_job_run_dtl r
    WHERE r.job_code = c.job_code
    ORDER BY r.started_at DESC
    LIMIT 1
  ) orr ON true
  WHERE c.rec_status = 1
  ORDER BY c.module, c.job_code;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_list_v2() IS
  'HQ jobs screen list: every registry job with desired versus actual state and drift flags (MISSING_IN_CRON, MISSING_IN_QUEUE, WORKER_NOT_SEEN, SCHEDULE_DRIFT, STATE_DRIFT, SETTINGS_DRIFT, SUPERSEDED). Updated in 0808 for pg-boss kinds.';

-- Enable/disable and reschedule. pg-boss queues: on/off only (consumers obey within
-- about 30 s). pg-boss schedules: like HQ_WORKER, applied by the consumer.
CREATE OR REPLACE FUNCTION public.fn_ops_job_set_state(p_job_code text, p_enabled boolean, p_schedule text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
DECLARE
  v_cfg    public.sys_ops_job_cf%ROWTYPE;
  v_jobid  BIGINT;
  v_sched  TEXT;
  v_before JSONB;
  v_after  JSONB;
  v_actor  TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  IF p_enabled IS NULL AND p_schedule IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE',
      'message', 'Provide enabled and/or schedule', 'job_code', p_job_code);
  END IF;

  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'Job is not registered', 'job_code', p_job_code);
  END IF;

  IF v_cfg.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED',
      'message', 'This job is superseded and cannot be enabled or rescheduled', 'job_code', p_job_code);
  END IF;

  IF p_schedule IS NOT NULL THEN
    v_sched := btrim(p_schedule);
    IF length(v_sched) > 100 OR v_sched !~ '^[0-9*/,-]+( [0-9*/,-]+){4}$' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCHEDULE',
        'message', 'Schedule must be 5 numeric cron fields', 'job_code', p_job_code);
    END IF;
  END IF;

  IF v_cfg.kind = 'PGBOSS_QUEUE' THEN
    IF v_sched IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_NOT_APPLICABLE',
        'message', 'A queue has no schedule; it runs when jobs arrive', 'job_code', p_job_code);
    END IF;
    v_before := jsonb_build_object('schedule', NULL, 'active', v_cfg.desired_enabled);
    UPDATE public.sys_ops_job_cf
    SET desired_enabled = p_enabled,
        updated_info = 'fn_ops_job_set_state by ' || v_actor
    WHERE job_code = p_job_code
    RETURNING jsonb_build_object('schedule', NULL, 'active', desired_enabled) INTO v_after;
    RETURN jsonb_build_object('ok', true, 'code', 'UPDATED',
      'message', CASE WHEN p_enabled THEN 'Saved. Consumers resume this queue within about 30 seconds.'
                      ELSE 'Saved. Consumers pause this queue within about 30 seconds; waiting jobs are kept.' END,
      'job_code', p_job_code, 'before', v_before, 'after', v_after);
  END IF;

  IF v_cfg.kind IN ('HQ_WORKER', 'PGBOSS_SCHEDULE') THEN
    v_before := jsonb_build_object('schedule', v_cfg.applied_schedule, 'active', v_cfg.applied_enabled);
    UPDATE public.sys_ops_job_cf
    SET desired_enabled = COALESCE(p_enabled, desired_enabled),
        schedule = CASE
                     WHEN v_sched IS NULL THEN schedule
                     WHEN v_sched = default_schedule THEN NULL
                     ELSE v_sched
                   END,
        updated_info = 'fn_ops_job_set_state by ' || v_actor
    WHERE job_code = p_job_code
    RETURNING jsonb_build_object('schedule', COALESCE(schedule, default_schedule), 'active', desired_enabled) INTO v_after;
    RETURN jsonb_build_object('ok', true, 'code', 'UPDATED',
      'message', CASE WHEN v_cfg.kind = 'HQ_WORKER'
                      THEN 'Saved. The HQ worker applies it within about 15 minutes.'
                      ELSE 'Saved. The worker applies the schedule within about 30 seconds.' END,
      'job_code', p_job_code, 'before', v_before, 'after', v_after);
  END IF;

  SELECT j.jobid INTO v_jobid FROM cron.job j WHERE j.jobname = v_cfg.cron_job_name;
  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_CRON',
      'message', 'No cron.job row exists for this job', 'job_code', p_job_code);
  END IF;

  SELECT jsonb_build_object('schedule', j.schedule, 'active', j.active) INTO v_before
  FROM cron.job j WHERE j.jobid = v_jobid;

  BEGIN
    PERFORM cron.alter_job(job_id => v_jobid, schedule => v_sched, active => p_enabled);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALTER_FAILED',
      'message', left(SQLERRM, 500), 'job_code', p_job_code, 'before', v_before);
  END;

  UPDATE public.sys_ops_job_cf
  SET desired_enabled = COALESCE(p_enabled, desired_enabled),
      schedule = CASE
                   WHEN v_sched IS NULL THEN schedule
                   WHEN v_sched = default_schedule THEN NULL
                   ELSE v_sched
                 END,
      updated_info = 'fn_ops_job_set_state by ' || v_actor
  WHERE job_code = p_job_code;

  SELECT jsonb_build_object('schedule', j.schedule, 'active', j.active) INTO v_after
  FROM cron.job j WHERE j.jobid = v_jobid;

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Job updated',
    'job_code', p_job_code, 'before', v_before, 'after', v_after);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_set_state(text, boolean, text, text) IS
  'Enable/disable and reschedule a registry job. PG_CRON alters cron.job; HQ_WORKER and PGBOSS_SCHEDULE record desired state for the worker; PGBOSS_QUEUE is on/off only. Updated in 0808 for pg-boss kinds.';

-- Run now. pg-boss schedules: a MANUAL request the worker turns into one job in the
-- target queue (same request table as HQ_WORKER). Queues cannot be run now.
CREATE OR REPLACE FUNCTION public.fn_ops_job_run_now(p_job_code text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_cfg      public.sys_ops_job_cf%ROWTYPE;
  v_command  TEXT;
  v_started  TIMESTAMPTZ;
  v_finished TIMESTAMPTZ;
  v_status   TEXT;
  v_message  TEXT;
  v_rows     BIGINT;
  v_req_id   UUID;
  v_actor    TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'job_code', p_job_code,
      'message', 'Job is not registered');
  END IF;

  IF v_cfg.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED', 'job_code', p_job_code,
      'message', 'This job is superseded and cannot be run');
  END IF;

  IF v_cfg.kind = 'PGBOSS_QUEUE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_APPLICABLE', 'job_code', p_job_code,
      'message', 'A queue runs when jobs arrive; run its schedule or redrive its dead letters instead');
  END IF;

  IF NOT v_cfg.run_now_allowed THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_ALLOWED', 'job_code', p_job_code,
      'message', 'Manual run is not allowed for this job');
  END IF;

  IF v_cfg.kind IN ('HQ_WORKER', 'PGBOSS_SCHEDULE') THEN
    BEGIN
      INSERT INTO public.sys_ops_job_req_tr (job_code, trigger_type, status, requested_by, created_by, created_info)
      VALUES (p_job_code, 'MANUAL', 'REQUESTED', v_actor, v_actor, 'fn_ops_job_run_now')
      RETURNING id INTO v_req_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'job_code', p_job_code,
        'message', 'A manual run of this job is already waiting or running');
    END;
    RETURN jsonb_build_object(
      'ok', true, 'code', 'QUEUED', 'status', 'QUEUED', 'job_code', p_job_code, 'request_id', v_req_id,
      'message', CASE
        WHEN v_cfg.kind = 'PGBOSS_SCHEDULE' THEN
          CASE WHEN v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '20 minutes'
            THEN 'Queued, but the worker has not reported recently: the run starts when it is back.'
            ELSE 'Queued. The worker sends the job within about 30 seconds; the result appears in the run history.'
          END
        WHEN v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '15 minutes'
          THEN 'Queued, but the HQ worker has not reported for 15 minutes: the run starts when it is back.'
        ELSE 'Queued. The HQ worker starts it within about 15 minutes; the result appears in the run history.'
      END);
  END IF;

  SELECT j.command INTO v_command FROM cron.job j WHERE j.jobname = v_cfg.cron_job_name;
  IF v_command IS NULL OR btrim(v_command) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_CRON', 'job_code', p_job_code,
      'message', 'No cron command found for this job');
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('ops_job_run:' || p_job_code, 0)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'job_code', p_job_code,
      'message', 'A manual run of this job is already in progress');
  END IF;

  v_started := clock_timestamp();
  BEGIN
    EXECUTE v_command;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_cfg.completion_mode = 'ASYNC_HTTP' THEN
      v_status := 'DISPATCHED';
      v_message := 'Handed to the async HTTP worker; the outcome is not observable here';
    ELSE
      v_status := 'SUCCESS';
      v_message := 'Completed; rows affected: ' || COALESCE(v_rows, 0)::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'FAILED';
    v_message := left(SQLERRM, 500);
  END;
  v_finished := clock_timestamp();

  INSERT INTO public.sys_ops_job_run_dtl (
    job_code, started_at, finished_at, status, message, trigger_type, actor, created_info
  ) VALUES (
    p_job_code, v_started, v_finished, v_status, v_message, 'MANUAL', v_actor, 'fn_ops_job_run_now'
  );

  RETURN jsonb_build_object(
    'ok', v_status <> 'FAILED',
    'code', CASE WHEN v_status = 'FAILED' THEN 'FAILED' ELSE 'EXECUTED' END,
    'status', v_status,
    'message', v_message,
    'job_code', p_job_code,
    'started_at', v_started,
    'finished_at', v_finished
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'status', 'FAILED',
    'message', left(SQLERRM, 500), 'job_code', p_job_code);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_run_now(text, text) IS
  'Run a registry job now. PG_CRON executes its fixed command; HQ_WORKER and PGBOSS_SCHEDULE record a MANUAL request for the worker; PGBOSS_QUEUE is rejected (queues run when jobs arrive). Updated in 0808 for pg-boss kinds.';

COMMIT;
