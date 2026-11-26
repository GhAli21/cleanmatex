-- OTP stamps on sys_otp_codes become timestamptz.
-- B5 names this table. The values are UTC walls from now(). This is not an HQ catalog stamp.
-- The retention run compares those instants to now().

BEGIN;

ALTER TABLE public.sys_otp_codes
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN verified_at TYPE timestamptz USING verified_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.sys_otp_codes.created_at IS
  'UTC instant the one-time code row was created. Converted from a naive UTC wall.';
COMMENT ON COLUMN public.sys_otp_codes.updated_at IS
  'UTC instant the one-time code row was last updated. Converted from a naive UTC wall.';
COMMENT ON COLUMN public.sys_otp_codes.expires_at IS
  'UTC instant the one-time code stops being valid. Converted from a naive UTC wall.';
COMMENT ON COLUMN public.sys_otp_codes.verified_at IS
  'UTC instant the one-time code was verified. Null until then. Converted from a naive UTC wall.';

CREATE OR REPLACE FUNCTION public.fn_ntf_short_retention_run()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  -- scheduled_at and expires_at hold UTC wall-clock time; the database time zone is not UTC.
  v_utc_now timestamptz := now();
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
$function$;

COMMIT;
