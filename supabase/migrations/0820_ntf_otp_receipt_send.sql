-- =============================================================================
-- Migration: 0820_ntf_otp_receipt_send.sql
-- Purpose:   Background Jobs STEP5_PLAN item 5 (5d): customer OTP codes and order
--            receipts are sent at once through the notification outbox
--            (outbox row + ntf.deliver job in one transaction, run by HQ API).
--              1. sys_otp_codes.request_ip: per-IP send limit (SMS pumping).
--                 The code column now holds an HMAC of the code, never the code.
--              2. Event customer.otp_generated (SMS) with its approved template,
--                 so the SMS text is the catalog's, in EN and AR.
--              3. Event order.receipt_sent (EMAIL, WHATSAPP) with its approved
--                 template. HQ sends the WhatsApp receipt through a route of this
--                 event (an approved UTILITY template), like every order event.
--              4. fn_ntf_short_retention_run + hourly pg_cron job
--                 ntf-short-retention: OTP rows and the code in OTP outbox rows
--                 are kept 24 hours; request_data of processed notification
--                 requests is cleared after 30 days.
-- Affected:  sys_otp_codes, sys_ntf_events_cd, sys_ntf_event_chan_map,
--            sys_ntf_templates_mst, sys_ntf_template_ver_dtl,
--            sys_ntf_template_chan_dtl, org_ntf_outbox_dtl (index),
--            org_ntf_requests_tr (cleared column), sys_ops_job_cf, cron.job
-- Related:   0345 (event catalog), 0382 (templates), 0609 (ntf retention),
--            0810 (notification requests)
-- Safety:    Additive. The only data change is the hourly purge, which deletes OTP
--            rows older than 24 hours (remote holds 32 test rows with the fixed
--            code) and blanks old OTP texts and old request data.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. sys_otp_codes: who asked, and the code is stored as an HMAC
-- ---------------------------------------------------------------------------

ALTER TABLE public.sys_otp_codes
  ADD COLUMN request_ip TEXT;
COMMENT ON COLUMN public.sys_otp_codes.request_ip IS
  'Client IP of the request that created this code. Counts codes per IP per hour (SMS pumping limit). NULL on rows made before 0820.';

COMMENT ON COLUMN public.sys_otp_codes.code IS
  'HMAC-SHA256 (hex) of the phone and the code, keyed by a server secret. The code itself is never stored here (0820); it exists only in the SMS outbox row, which keeps it 24 hours.';

COMMENT ON COLUMN public.sys_otp_codes.expires_at IS
  'When the code stops working, UTC wall-clock time written by the app. Send limits and the 24-hour purge count from this column, because created_at holds database-local time.';

-- Per-IP count over the last hour.
CREATE INDEX idx_otp_ip_expires
  ON public.sys_otp_codes (request_ip, expires_at)
  WHERE request_ip IS NOT NULL;
COMMENT ON INDEX public.idx_otp_ip_expires IS
  'OTP send limit per IP: codes created by one IP in the last hour (0820).';

-- ---------------------------------------------------------------------------
-- 2. Event + template: customer.otp_generated (SMS)
-- ---------------------------------------------------------------------------

INSERT INTO public.sys_ntf_events_cd
  (code, category_code, name, name2, description, description2,
   priority, is_transactional, requires_consent, created_info)
VALUES
  ('customer.otp_generated', 'CUSTOMER',
   'Customer verification code', 'رمز تحقق العميل',
   'A one-time code sent by SMS to verify a customer phone number. Written straight to the outbox at the highest priority, never through the orchestrator. Variables: tenant_name, otp_code, expires_minutes.',
   'رمز لمرة واحدة يرسل برسالة نصية للتحقق من رقم هاتف العميل.',
   'URGENT', true, false, '0820')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override, created_info)
VALUES ('customer.otp_generated', 'SMS', true, false, '0820')
ON CONFLICT (event_code, channel_code) DO NOTHING;

INSERT INTO public.sys_ntf_templates_mst
  (template_code, event_code, name, name2, description, description2, is_system, created_info)
VALUES
  ('customer.otp_generated.default', 'customer.otp_generated',
   'Customer verification code', 'رمز تحقق العميل',
   'SMS text of the customer verification code.', 'نص الرسالة النصية لرمز تحقق العميل.',
   true, '0820')
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_at, created_info)
VALUES
  ('customer.otp_generated.default', 1,
   'Verification code', 'رمز التحقق',
   '{{tenant_name}}: your verification code is {{otp_code}}. It expires in {{expires_minutes}} minutes. Do not share it with anyone.',
   '{{tenant_name}}: رمز التحقق الخاص بك هو {{otp_code}}. ينتهي خلال {{expires_minutes}} دقائق. لا تشاركه مع أي شخص.',
   'APPROVED', now(), '0820')
ON CONFLICT (template_code, version_number) DO NOTHING;

INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, created_info)
SELECT v.id, 'SMS', v.subject, v.subject2, v.body, v.body2, '0820'
  FROM public.sys_ntf_template_ver_dtl v
 WHERE v.template_code = 'customer.otp_generated.default' AND v.version_number = 1
ON CONFLICT (template_version_id, channel_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Event + template: order.receipt_sent (EMAIL, WHATSAPP)
-- ---------------------------------------------------------------------------

INSERT INTO public.sys_ntf_events_cd
  (code, category_code, name, name2, description, description2,
   priority, is_transactional, requires_consent, created_info)
VALUES
  ('order.receipt_sent', 'ORDER',
   'Order receipt', 'إيصال الطلب',
   'A staff member sends an order receipt to the customer. Written straight to the outbox at high priority; the outbox source is the order, so WhatsApp uses the order customer''s opt-in and an HQ route of this event. Variables: order_number, customer_name, total_amount, tracking_url.',
   'يرسل الموظف إيصال الطلب إلى العميل.',
   'HIGH', true, false, '0820')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override, created_info)
VALUES ('order.receipt_sent', 'EMAIL', true, false, '0820'),
       ('order.receipt_sent', 'WHATSAPP', true, false, '0820')
ON CONFLICT (event_code, channel_code) DO NOTHING;

INSERT INTO public.sys_ntf_templates_mst
  (template_code, event_code, name, name2, description, description2, is_system, created_info)
VALUES
  ('order.receipt_sent.default', 'order.receipt_sent',
   'Order receipt', 'إيصال الطلب',
   'Subject of the receipt email and the text behind the WhatsApp receipt route. The email body is the receipt itself.',
   'عنوان بريد الإيصال ونص قالب واتساب للإيصال.',
   true, '0820')
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO public.sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_at, created_info)
VALUES
  ('order.receipt_sent.default', 1,
   'Your receipt for order #{{order_number}}', 'إيصال طلبك رقم #{{order_number}}',
   'Hello {{customer_name}}, here is your receipt for order #{{order_number}}. Total: {{total_amount}}. Track your order: {{tracking_url}}',
   'مرحبا {{customer_name}}، هذا إيصال طلبك رقم #{{order_number}}. الإجمالي: {{total_amount}}. تتبع طلبك: {{tracking_url}}',
   'APPROVED', now(), '0820')
ON CONFLICT (template_code, version_number) DO NOTHING;

INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, created_info)
SELECT v.id, c.channel_code, v.subject, v.subject2, v.body, v.body2, '0820'
  FROM public.sys_ntf_template_ver_dtl v
 CROSS JOIN (VALUES ('EMAIL'), ('WHATSAPP')) AS c(channel_code)
 WHERE v.template_code = 'order.receipt_sent.default' AND v.version_number = 1
ON CONFLICT (template_version_id, channel_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Short retention: OTP 24 hours, request data 30 days after PROCESSED
-- ---------------------------------------------------------------------------

-- The hourly purge finds old OTP outbox rows across tenants without a full scan.
CREATE INDEX ix_ntf_outbox_otp_ret
  ON public.org_ntf_outbox_dtl (scheduled_at)
  WHERE event_code = 'customer.otp_generated';
COMMENT ON INDEX public.ix_ntf_outbox_otp_ret IS
  'Hourly purge of the code text in OTP outbox rows older than 24 hours (fn_ntf_short_retention_run, 0820).';

-- Platform sweep (pg_cron), so it runs across tenants on purpose, like
-- fn_ntf_retention_sweep. Each part is bounded to 5000 rows per tick; the
-- next tick continues.
CREATE OR REPLACE FUNCTION public.fn_ntf_short_retention_run()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  -- scheduled_at and expires_at hold UTC wall-clock time; the database time zone is not UTC.
  v_utc_now TIMESTAMP := now() AT TIME ZONE 'UTC';
  v_otp   INTEGER;
  v_text  INTEGER;
  v_req   INTEGER;
BEGIN
  DELETE FROM public.sys_otp_codes
   WHERE id IN (SELECT id FROM public.sys_otp_codes
                 WHERE expires_at < v_utc_now - INTERVAL '24 hours'
                 LIMIT 5000);
  GET DIAGNOSTICS v_otp = ROW_COUNT;

  -- Keep the row (delivery history, receipts) and remove only the code.
  UPDATE public.org_ntf_outbox_dtl o
     SET rendered_body = '[removed]', rendered_body2 = NULL, updated_at = now(),
         updated_info = 'fn_ntf_short_retention_run'
   WHERE o.id IN (SELECT x.id FROM public.org_ntf_outbox_dtl x
                   WHERE x.event_code = 'customer.otp_generated'
                     AND x.scheduled_at < v_utc_now - INTERVAL '24 hours'
                     AND x.rendered_body <> '[removed]'
                   LIMIT 5000);
  GET DIAGNOSTICS v_text = ROW_COUNT;

  -- FAILED requests keep their data while their dead letter can still be redriven.
  UPDATE public.org_ntf_requests_tr r
     SET request_data = '{}'::jsonb, updated_at = now(), updated_info = 'fn_ntf_short_retention_run'
   WHERE r.id IN (SELECT x.id FROM public.org_ntf_requests_tr x
                   WHERE x.status = 'PROCESSED'
                     AND x.processed_at < now() - INTERVAL '30 days'
                     AND x.request_data <> '{}'::jsonb
                   LIMIT 5000);
  GET DIAGNOSTICS v_req = ROW_COUNT;

  RETURN v_otp + v_text + v_req;
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_short_retention_run() IS
  'Hourly (pg_cron ntf-short-retention): deletes OTP rows 24 hours after they expire, replaces the code text of OTP outbox rows older than 24 hours with [removed], clears request_data of notification requests PROCESSED more than 30 days ago. At most 5000 rows per part per tick. Returns rows touched (0820).';

-- Runs as the cron owner only; no API role may call it.
REVOKE ALL ON FUNCTION public.fn_ntf_short_retention_run() FROM PUBLIC, anon, authenticated, service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-short-retention';
SELECT cron.schedule('ntf-short-retention', '23 * * * *', $$ SELECT public.fn_ntf_short_retention_run() $$);

INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, restore_command, notes, created_info
) VALUES (
  'ntf-short-retention', 'Notification short retention', 'الاحتفاظ القصير بالإشعارات',
  'Every hour: deletes customer verification codes 24 hours after they expire, removes the code from OTP messages older than 24 hours, and clears the data of notification requests processed more than 30 days ago.',
  'كل ساعة: يحذف رموز تحقق العملاء بعد 24 ساعة من انتهائها، ويزيل الرمز من رسائل التحقق الأقدم من 24 ساعة، ويمسح بيانات طلبات الإشعارات المعالجة قبل أكثر من 30 يوما.',
  'CLEANUP', 'ntf', 'retention', 'PG_CRON', 'ntf-short-retention',
  '23 * * * *', true, true, 'SYNC',
  '0820', $cmd$SELECT public.fn_ntf_short_retention_run()$cmd$,
  'At most 5000 rows per part per tick. FAILED requests keep their data for dead-letter redrive.', '0820 seed'
)
ON CONFLICT (job_code) DO NOTHING;

COMMIT;
