-- =============================================================================
-- Migration: 0810_bg_jobs_ntf_queues_requests.sql
-- Purpose:   Background Jobs step 5 - notifications on pg-boss (DESIGN.md 7, 14.5, 16;
--            plan docs/features/Background_Jobs/STEP5_PLAN.md).
--            1. Six queues, each with its registry row and queue detail row:
--                 ntf.orchestrate     cmx-workers  request -> in-app rows + outbox rows
--                 ntf.deliver         HQ API       one outbox row -> provider (1 s polling)
--                 ntf.reconcile       HQ API       an uncertain send -> provider lookup
--                 ntf.status_apply    HQ API       one stored provider webhook -> row status
--                 ntf.campaign_start  cmx-workers  an approved campaign -> chunk jobs
--                 ntf.campaign_chunk  cmx-workers  50 campaign targets -> outbox rows
--            2. org_ntf_requests_tr: one row per notification request. A pg-boss job may
--               carry ids only, never names, phone numbers or rendered text, so the
--               request (event code, recipients, template variables) is stored here and
--               ntf.orchestrate receives { tenantOrgId, requestId }.
--            3. fn_ntf_worker_claim_one: claims ONE outbox row by id for an ntf.deliver
--               job, using the pg-boss job id as the claim token (the existing
--               PROCESSING + claim_token model). The batch claim functions are removed at
--               step 8; finalize, mark-uncertain and reconcile are reused unchanged.
-- Security:  New table and function are closed to PUBLIC, anon and authenticated. The
--            request table is written and read server-side only (Prisma, service role).
-- Release:   Queues exist before any producer sends to them; no code uses them yet. They
--            start paused (desired_enabled = false) so running consumers neither fetch
--            them nor report them as missing handlers; the step 5 release switches them on
--            from HQ -> Ops -> Jobs (QA_TEST_GUIDE step 5).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Queues, registry rows and queue detail rows.
-- -----------------------------------------------------------------------------
-- One row per queue; every section below reads it. Dropped at commit.
-- Settings follow DESIGN 5.2: INTERNAL = 8 retries, backoff 10 s to 1 h, 300 s expiry;
-- EXTERNAL = 6 retries, backoff 30 s to 2 h, 120 s expiry per message.
-- Retention (how long a waiting job is kept) is 30 days wherever a job may wait for
-- quiet hours or a campaign's send time; deleted rows would otherwise be lost silently.
CREATE TEMP TABLE tmp_0810_queues (
  queue_name     TEXT    NOT NULL,
  consumer_app   TEXT    NOT NULL,
  effect_class   TEXT    NOT NULL,
  retry_limit    INTEGER NOT NULL,
  retry_delay_s  INTEGER NOT NULL,
  retry_max_s    INTEGER NOT NULL,
  expire_s       INTEGER NOT NULL,
  retention_s    INTEGER NOT NULL,
  delete_after_s INTEGER NOT NULL,
  concurrency    INTEGER NOT NULL,
  polling_s      NUMERIC NOT NULL,
  sub_system     TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  name2          TEXT    NOT NULL,
  description    TEXT    NOT NULL,
  description2   TEXT    NOT NULL,
  rec_order      INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_0810_queues VALUES
  ('ntf.orchestrate', 'CMX_WORKERS', 'INTERNAL', 8, 10, 3600, 300, 2592000, 604800, 2, 2, 'orchestrate',
   'Notifications: prepare', 'الإشعارات: التجهيز',
   'Turns one notification request into in-app messages and outbox rows: settings, consent, quiet hours, template, channel.',
   'يحوّل طلب إشعار واحد إلى رسائل داخل التطبيق وسجلات صندوق الإرسال: الإعدادات والموافقة وساعات الهدوء والقالب والقناة.', 400),
  ('ntf.deliver', 'HQ_API', 'EXTERNAL_UNCERTAIN', 6, 30, 7200, 120, 2592000, 2592000, 5, 1, 'deliver',
   'Notifications: send', 'الإشعارات: الإرسال',
   'Sends one outbox row through its provider. A timeout marks the row uncertain and starts a reconcile instead of sending again.',
   'يرسل سجل صندوق إرسال واحدًا عبر مزوّده. عند انتهاء المهلة يُعلَّم السجل غير مؤكد ويبدأ التحقق بدل الإرسال مرة أخرى.', 410),
  ('ntf.reconcile', 'HQ_API', 'EXTERNAL_IDEMPOTENT', 6, 120, 7200, 120, 2592000, 2592000, 2, 30, 'reconcile',
   'Notifications: check uncertain sends', 'الإشعارات: التحقق من الإرسال غير المؤكد',
   'Asks the provider whether an uncertain send was accepted. Resends once only when the provider proves it was not.',
   'يسأل المزوّد إن كان الإرسال غير المؤكد قد قُبل. يعيد الإرسال مرة واحدة فقط عندما يثبت المزوّد أنه لم يُقبل.', 420),
  ('ntf.status_apply', 'HQ_API', 'INTERNAL', 8, 10, 3600, 120, 604800, 604800, 2, 5, 'status',
   'Notifications: apply delivery status', 'الإشعارات: تطبيق حالة التسليم',
   'Applies one stored provider webhook (delivered, read, bounced) to its outbox row.',
   'يطبّق إشعار مزوّد مخزَّنًا واحدًا (تم التسليم أو القراءة أو الارتداد) على سجل صندوق الإرسال.', 430),
  ('ntf.campaign_start', 'CMX_WORKERS', 'INTERNAL', 8, 10, 3600, 300, 2592000, 2592000, 1, 30, 'campaigns',
   'Campaigns: start', 'الحملات: البدء',
   'At an approved campaign''s send time, splits its targets into chunk jobs of 50.',
   'في موعد إرسال الحملة المعتمدة يقسّم المستهدفين إلى مهام دفعات من 50.', 440),
  ('ntf.campaign_chunk', 'CMX_WORKERS', 'INTERNAL', 8, 10, 3600, 300, 2592000, 2592000, 1, 10, 'campaigns',
   'Campaigns: prepare a chunk', 'الحملات: تجهيز دفعة',
   'Applies consent, quiet hours and idempotency to 50 campaign targets and writes their outbox rows at low priority.',
   'يطبّق الموافقة وساعات الهدوء وعدم التكرار على 50 مستهدفًا ويكتب سجلاتهم في صندوق الإرسال بأولوية منخفضة.', 450);

-- Skips a queue that already exists, so a re-run is harmless.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM tmp_0810_queues ORDER BY rec_order LOOP
    IF NOT EXISTS (SELECT 1 FROM pgboss.queue q WHERE q.name = r.queue_name) THEN
      PERFORM pgboss.create_queue(r.queue_name, jsonb_build_object(
        'policy', 'standard',
        'retryLimit', r.retry_limit,
        'retryDelay', r.retry_delay_s,
        'retryBackoff', true,
        'retryDelayMax', r.retry_max_s,
        'expireInSeconds', r.expire_s,
        'heartbeatSeconds', 30,
        'retentionSeconds', r.retention_s,
        'deleteAfterSeconds', r.delete_after_s,
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
  'NOTIFICATION', 'ntf', q.sub_system, 'PGBOSS_QUEUE',
  NULL, NULL, NULL, false, false, 'PGBOSS',
  '0810_bg_jobs_ntf_queues_requests.sql',
  'Consumed by ' || CASE q.consumer_app WHEN 'HQ_API' THEN 'HQ API' ELSE 'cmx-workers' END || ' (Background Jobs step 5).',
  ARRAY['OBSERVE', 'SET_STATE'], 'ACTIVE', q.rec_order,
  'Migration 0810 - notification queue'
FROM tmp_0810_queues q
ON CONFLICT (job_code) DO NOTHING;

INSERT INTO public.sys_ops_job_queue_cf (
  queue_name, consumer_app, effect_class,
  retry_limit, retry_delay_s, retry_backoff, retry_delay_max_s,
  expire_s, heartbeat_s, retention_s, delete_after_s, dead_letter_queue,
  default_priority, local_concurrency, polling_s,
  rec_order, created_by, created_info
)
SELECT
  q.queue_name, q.consumer_app, q.effect_class,
  q.retry_limit, q.retry_delay_s, true, q.retry_max_s,
  q.expire_s, 30, q.retention_s, q.delete_after_s, 'dead_letter',
  0, q.concurrency, q.polling_s,
  q.rec_order, 'migration', 'Migration 0810 - notification queue'
FROM tmp_0810_queues q
ON CONFLICT (queue_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. org_ntf_requests_tr - one notification request per row.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_ntf_requests_tr (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID        NOT NULL,
  event_code          TEXT        NOT NULL,
  source_entity_type  TEXT        NULL,
  source_entity_id    TEXT        NULL,
  request_data        JSONB       NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'PENDING',
  processed_at        TIMESTAMPTZ NULL,
  result_summary      JSONB       NULL,
  error_message       TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          TEXT        NULL,
  created_info        TEXT        NULL,
  updated_at          TIMESTAMPTZ NULL,
  updated_by          TEXT        NULL,
  updated_info        TEXT        NULL,
  updated_count       INTEGER     NOT NULL DEFAULT 0,
  deleted_at          TIMESTAMPTZ NULL,
  deleted_by          TEXT        NULL,
  deleted_info        TEXT        NULL,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER     NULL,
  rec_notes           TEXT        NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_ntf_requests_tr PRIMARY KEY (id),
  CONSTRAINT uq_onrq_id_tenant UNIQUE (id, tenant_org_id),
  CONSTRAINT fk_onrq_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  CONSTRAINT fk_onrq_event FOREIGN KEY (event_code)
    REFERENCES public.sys_ntf_events_cd (code) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_onrq_status CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  CONSTRAINT ck_onrq_processed CHECK ((status = 'PENDING') = (processed_at IS NULL)),
  CONSTRAINT ck_onrq_data CHECK (jsonb_typeof(request_data) = 'object'),
  CONSTRAINT ck_onrq_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_onrq_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

COMMENT ON TABLE  public.org_ntf_requests_tr IS 'One notification request per row (Background Jobs step 5). Written in the business transaction together with its ntf.orchestrate job, which carries only { tenantOrgId, requestId }. ntf.orchestrate reads it, writes in-app and outbox rows (deduplicated by the outbox idempotency key), and marks it PROCESSED. Holds template variables, so it is server-only.';
COMMENT ON COLUMN public.org_ntf_requests_tr.id IS 'Request UUID primary key; also the ntf.orchestrate job id, so a request is enqueued once.';
COMMENT ON COLUMN public.org_ntf_requests_tr.tenant_org_id IS 'Organization the notification belongs to. Every query filters on it.';
COMMENT ON COLUMN public.org_ntf_requests_tr.event_code IS 'Notification event code (sys_ntf_events_cd), for example order.created.';
COMMENT ON COLUMN public.org_ntf_requests_tr.source_entity_type IS 'Business object kind that caused the request, for example order.';
COMMENT ON COLUMN public.org_ntf_requests_tr.source_entity_id IS 'Business object id that caused the request.';
COMMENT ON COLUMN public.org_ntf_requests_tr.request_data IS 'The rest of the request as JSON: recipientUserIds, template variables, priority, action URL and labels. May contain personal data; never copied into a job payload.';
COMMENT ON COLUMN public.org_ntf_requests_tr.status IS 'PENDING until ntf.orchestrate finishes; PROCESSED when its rows are written; FAILED when its job reached the dead-letter queue.';
COMMENT ON COLUMN public.org_ntf_requests_tr.processed_at IS 'When the request left PENDING.';
COMMENT ON COLUMN public.org_ntf_requests_tr.result_summary IS 'Counts written by ntf.orchestrate: channels attempted, in-app delivered and skipped, outbox rows queued.';
COMMENT ON COLUMN public.org_ntf_requests_tr.error_message IS 'Last failure reason when status is FAILED.';
COMMENT ON COLUMN public.org_ntf_requests_tr.created_at IS 'When the row was created.';
COMMENT ON COLUMN public.org_ntf_requests_tr.created_by IS 'User or actor that created the row.';
COMMENT ON COLUMN public.org_ntf_requests_tr.created_info IS 'Creation context.';
COMMENT ON COLUMN public.org_ntf_requests_tr.updated_at IS 'When the row was last updated (set by trigger).';
COMMENT ON COLUMN public.org_ntf_requests_tr.updated_by IS 'User or actor that last updated the row.';
COMMENT ON COLUMN public.org_ntf_requests_tr.updated_info IS 'Last update context.';
COMMENT ON COLUMN public.org_ntf_requests_tr.updated_count IS 'Monotonic update counter (incremented by trigger).';
COMMENT ON COLUMN public.org_ntf_requests_tr.deleted_at IS 'When the row was soft-deleted.';
COMMENT ON COLUMN public.org_ntf_requests_tr.deleted_by IS 'User or actor that soft-deleted the row.';
COMMENT ON COLUMN public.org_ntf_requests_tr.deleted_info IS 'Soft-delete context.';
COMMENT ON COLUMN public.org_ntf_requests_tr.rec_status IS 'Record status: 1 active, 0 soft-deleted, 2 archived.';
COMMENT ON COLUMN public.org_ntf_requests_tr.rec_order IS 'Unused ordering slot (standard column).';
COMMENT ON COLUMN public.org_ntf_requests_tr.rec_notes IS 'Optional operator notes.';
COMMENT ON COLUMN public.org_ntf_requests_tr.is_active IS 'True when the row is live.';
COMMENT ON CONSTRAINT pk_org_ntf_requests_tr ON public.org_ntf_requests_tr IS 'Surrogate primary key.';
COMMENT ON CONSTRAINT uq_onrq_id_tenant ON public.org_ntf_requests_tr IS 'Lets a child row reference a request together with its tenant (Prisma-safe composite key, id first).';
COMMENT ON CONSTRAINT fk_onrq_tenant ON public.org_ntf_requests_tr IS 'Request belongs to an Organization; removed with it.';
COMMENT ON CONSTRAINT fk_onrq_event ON public.org_ntf_requests_tr IS 'Request uses a catalogued notification event code.';
COMMENT ON CONSTRAINT ck_onrq_status ON public.org_ntf_requests_tr IS 'PENDING, PROCESSED or FAILED.';
COMMENT ON CONSTRAINT ck_onrq_processed ON public.org_ntf_requests_tr IS 'processed_at is set exactly when the request has left PENDING.';
COMMENT ON CONSTRAINT ck_onrq_data ON public.org_ntf_requests_tr IS 'request_data is a JSON object.';
COMMENT ON CONSTRAINT ck_onrq_rec_status ON public.org_ntf_requests_tr IS 'Standard CleanMateX rec_status values (0, 1, 2).';
COMMENT ON CONSTRAINT ck_onrq_deleted_inactive ON public.org_ntf_requests_tr IS 'Soft-deleted or archived rows cannot stay active.';

-- Tenant-first lists for the notification log, and the "stuck requests" check.
CREATE INDEX IF NOT EXISTS idx_onrq_tenant_created ON public.org_ntf_requests_tr (tenant_org_id, created_at DESC);
COMMENT ON INDEX public.idx_onrq_tenant_created IS 'Newest requests per Organization (notification log, retention sweep).';
CREATE INDEX IF NOT EXISTS idx_onrq_tenant_pending ON public.org_ntf_requests_tr (tenant_org_id, created_at)
  WHERE status <> 'PROCESSED';
COMMENT ON INDEX public.idx_onrq_tenant_pending IS 'Requests not yet processed, for the stuck-request check on the HQ jobs screen.';

DROP TRIGGER IF EXISTS trg_audit_touch ON public.org_ntf_requests_tr;
CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_ntf_requests_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_ntf_requests_tr IS 'Keeps updated_at and updated_count current.';

-- Server-only: RLS on with no policy denies every role that does not bypass RLS, the same
-- as org_ops_job_effect_tr. The tenant web app writes it through Prisma (owner role).
ALTER TABLE public.org_ntf_requests_tr ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_ntf_requests_tr FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_ntf_requests_tr TO service_role;

-- -----------------------------------------------------------------------------
-- 3. fn_ntf_worker_claim_one - claim one outbox row for one ntf.deliver job.
-- -----------------------------------------------------------------------------
-- claim_outcome:
--   CLAIMED            the row was QUEUED or FAILED_TEMPORARY and is now PROCESSING with
--                      p_claim_token (the pg-boss job id); send it.
--   OWN_CLAIM          the row is already PROCESSING with p_claim_token: an earlier attempt
--                      of this same job may have reached the provider. Do not send again;
--                      mark it uncertain and reconcile (DESIGN 5.1 EXTERNAL_UNCERTAIN).
--   NOT_DUE            the row is QUEUED for a later time (policy moved it); re-send the job
--                      with startAfter = scheduled_at. Nothing is claimed.
--   NOT_CLAIMABLE      finalized, being reconciled, or claimed by another worker; no action.
--   NOT_FOUND          no such row for this tenant.
-- Only CLAIMED and OWN_CLAIM return the message fields. The lease matches the queue
-- expiry, so the existing lease rules keep holding.
CREATE OR REPLACE FUNCTION public.fn_ntf_worker_claim_one(
  p_tenant_org_id UUID,
  p_outbox_id     UUID,
  p_claim_token   UUID,
  p_worker_id     TEXT,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
  claim_outcome      TEXT,
  id                 UUID,
  tenant_org_id      UUID,
  claim_token        UUID,
  status             TEXT,
  scheduled_at       TIMESTAMP,
  channel_code       TEXT,
  recipient_address  TEXT,
  recipient_user_id  UUID,
  rendered_subject   TEXT,
  rendered_body      TEXT,
  event_code         TEXT,
  retry_count        INTEGER,
  max_retries        INTEGER,
  source_entity_type TEXT,
  source_entity_id   TEXT,
  metadata           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.org_ntf_outbox_dtl%ROWTYPE;
BEGIN
  IF p_tenant_org_id IS NULL OR p_outbox_id IS NULL OR p_claim_token IS NULL
     OR coalesce(trim(p_worker_id), '') = '' THEN
    RAISE EXCEPTION 'tenant, outbox id, claim token and worker identity are required';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 600';
  END IF;

  SELECT o.* INTO v_row
  FROM public.org_ntf_outbox_dtl AS o
  WHERE o.id = p_outbox_id
    AND o.tenant_org_id = p_tenant_org_id
    AND o.rec_status = 1
    AND o.is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::TEXT, p_outbox_id, p_tenant_org_id, NULL::UUID, NULL::TEXT, NULL::TIMESTAMP,
      NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER,
      NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_row.status = 'PROCESSING' AND v_row.claim_token = p_claim_token AND v_row.reconcile_state IS NULL THEN
    UPDATE public.org_ntf_outbox_dtl AS o
    SET lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id
    RETURNING o.* INTO v_row;
    RETURN QUERY SELECT 'OWN_CLAIM'::TEXT, v_row.id, v_row.tenant_org_id, v_row.claim_token, v_row.status,
      v_row.scheduled_at, v_row.channel_code, v_row.recipient_address, v_row.recipient_user_id,
      v_row.rendered_subject, v_row.rendered_body, v_row.event_code, v_row.retry_count, v_row.max_retries,
      v_row.source_entity_type, v_row.source_entity_id, v_row.metadata;
    RETURN;
  END IF;

  IF v_row.claim_token IS NOT NULL OR v_row.reconcile_state IS NOT NULL
     OR v_row.status NOT IN ('QUEUED', 'FAILED_TEMPORARY') THEN
    RETURN QUERY SELECT 'NOT_CLAIMABLE'::TEXT, v_row.id, v_row.tenant_org_id, NULL::UUID, v_row.status,
      v_row.scheduled_at, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::INTEGER, NULL::INTEGER, NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- scheduled_at is a timestamp without time zone holding UTC wall-clock time (the app writes
  -- ISO strings in UTC). Compare in UTC explicitly: the database time zone is Asia/Muscat, so a
  -- bare `scheduled_at <= now()` (the batch claims) treats it as local time and is 4 hours early.
  IF v_row.status = 'QUEUED' AND v_row.scheduled_at > (now() AT TIME ZONE 'UTC') + interval '5 seconds' THEN
    RETURN QUERY SELECT 'NOT_DUE'::TEXT, v_row.id, v_row.tenant_org_id, NULL::UUID, v_row.status,
      v_row.scheduled_at, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::INTEGER, NULL::INTEGER, NULL::TEXT, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  UPDATE public.org_ntf_outbox_dtl AS o
  SET status = 'PROCESSING',
      claim_token = p_claim_token,
      claimed_by = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  WHERE o.id = p_outbox_id AND o.tenant_org_id = p_tenant_org_id
  RETURNING o.* INTO v_row;

  RETURN QUERY SELECT 'CLAIMED'::TEXT, v_row.id, v_row.tenant_org_id, v_row.claim_token, v_row.status,
    v_row.scheduled_at, v_row.channel_code, v_row.recipient_address, v_row.recipient_user_id,
    v_row.rendered_subject, v_row.rendered_body, v_row.event_code, v_row.retry_count, v_row.max_retries,
    v_row.source_entity_type, v_row.source_entity_id, v_row.metadata;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_worker_claim_one(UUID, UUID, UUID, TEXT, INTEGER) IS
  'Service-role-only claim of ONE notification outbox row for an ntf.deliver job; the claim token is the pg-boss job id. Returns claim_outcome CLAIMED, OWN_CLAIM (a retry of the same job: reconcile, never resend), NOT_DUE, NOT_CLAIMABLE or NOT_FOUND. Finalize, mark-uncertain and reconcile use the existing fn_ntf_worker_* functions.';
REVOKE ALL ON FUNCTION public.fn_ntf_worker_claim_one(UUID, UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_worker_claim_one(UUID, UUID, UUID, TEXT, INTEGER) TO service_role;

COMMIT;
