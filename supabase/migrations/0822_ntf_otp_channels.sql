-- =============================================================================
-- Migration: 0822_ntf_otp_channels.sql
-- Purpose:   Background Jobs STEP5_PLAN item 5 (5d), follow-up to 0820.
--              1. sys_otp_codes.code becomes TEXT: it holds a 64-character
--                 HMAC (0820), and VARCHAR(6) cannot store it.
--              2. A customer verification code can be sent by SMS, WhatsApp or
--                 email (the staff member chooses). The event
--                 customer.otp_generated gains the WHATSAPP and EMAIL channels
--                 and their template texts. WhatsApp goes through an HQ route of
--                 this event with an approved Meta AUTHENTICATION template.
--              3. fn_ntf_short_retention_run also removes the code from the
--                 metadata of old OTP outbox rows (WhatsApp carries it in
--                 metadata.variables.otp_code, the value of the template slot).
-- Affected:  sys_otp_codes, sys_ntf_events_cd, sys_ntf_event_chan_map,
--            sys_ntf_template_chan_dtl, fn_ntf_short_retention_run
-- Related:   0820 (OTP and receipt sends)
-- Safety:    VARCHAR(6) → TEXT needs no table rewrite. Catalog rows are added
--            with ON CONFLICT DO NOTHING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. Room for the HMAC
-- ---------------------------------------------------------------------------

ALTER TABLE public.sys_otp_codes
  ALTER COLUMN code TYPE TEXT;
COMMENT ON COLUMN public.sys_otp_codes.code IS
  'HMAC-SHA256 (hex) of the phone and the code, keyed by a server secret. The code itself is never stored here (0820, TEXT since 0822); it exists only in the outbox row that sends it, which keeps it 24 hours.';

COMMENT ON COLUMN public.sys_otp_codes.phone IS
  'E.164 phone the code verifies. It is the key the verify flows check, also when the code was sent by email (the outbox row holds the address it went to, 0822).';

-- ---------------------------------------------------------------------------
-- 2. WhatsApp and email for customer.otp_generated
-- ---------------------------------------------------------------------------

UPDATE public.sys_ntf_events_cd
   SET description = 'A one-time code that verifies a customer, sent by SMS, WhatsApp or email (the staff member chooses). Written straight to the outbox at the highest priority, never through the orchestrator. WhatsApp needs an HQ route of this event with an approved Meta AUTHENTICATION template. Variables: tenant_name, otp_code, expires_minutes.',
       description2 = 'رمز لمرة واحدة للتحقق من العميل، يرسل برسالة نصية أو واتساب أو بريد إلكتروني.',
       updated_at = CURRENT_TIMESTAMP,
       updated_info = '0822'
 WHERE code = 'customer.otp_generated';

INSERT INTO public.sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override, created_info)
VALUES ('customer.otp_generated', 'WHATSAPP', false, false, '0822'),
       ('customer.otp_generated', 'EMAIL', false, false, '0822')
ON CONFLICT (event_code, channel_code) DO NOTHING;

INSERT INTO public.sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, created_info)
SELECT v.id, c.channel_code, v.subject, v.subject2, v.body, v.body2, '0822'
  FROM public.sys_ntf_template_ver_dtl v
 CROSS JOIN (VALUES ('WHATSAPP'), ('EMAIL')) AS c(channel_code)
 WHERE v.template_code = 'customer.otp_generated.default' AND v.version_number = 1
ON CONFLICT (template_version_id, channel_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Retention also strips the code from metadata
-- ---------------------------------------------------------------------------

-- Same as 0820, plus removing metadata.variables.otp_code from old OTP outbox rows.
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

  -- Keep the row (delivery history) and remove only the code, from the text and the metadata.
  UPDATE public.org_ntf_outbox_dtl o
     SET rendered_body = '[removed]', rendered_body2 = NULL,
         metadata = coalesce(o.metadata, '{}'::jsonb) #- '{variables,otp_code}',
         updated_at = now(), updated_info = 'fn_ntf_short_retention_run'
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
  'Hourly (pg_cron ntf-short-retention): deletes OTP rows 24 hours after they expire, replaces the code text of OTP outbox rows older than 24 hours with [removed] and drops variables.otp_code from their metadata, clears request_data of notification requests PROCESSED more than 30 days ago. At most 5000 rows per part per tick. Returns rows touched (0820, metadata since 0822).';

-- CREATE OR REPLACE keeps the 0820 grants; repeated so the file stands alone.
REVOKE ALL ON FUNCTION public.fn_ntf_short_retention_run() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
