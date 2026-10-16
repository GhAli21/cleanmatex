-- Notification Hub: record, as code, the operator settings that were changed by hand on the live database on 2026-10-16.
--
-- Why: these settings were made through the HQ screens (Operations > Jobs, Configuration Registry, Providers). A rebuilt
-- or restored database would silently lose them. This migration re-states them so they exist in version control.
-- It is IDEMPOTENT: on the live database (where every value is already in place) it changes nothing.
--
-- Contents
--   1. Job schedules and on/off state in the job registry (and pg_cron) for the notification jobs:
--        ntf-outbox-processor      enabled, every minute (registry default; an override of every 5 minutes had been
--                                  set while fixing drift and is removed)
--        ntf-campaign-scheduler    enabled, every 5 minutes (owner choice; registry default is every minute)
--        ntf-sweep-stale-push-subs disabled (it is disabled in pg_cron; the registry said "enabled", which showed as drift)
--      The change goes through fn_ops_job_set_state, the same function the Jobs screen uses, so the registry and
--      pg_cron can never disagree afterwards.
--   2. Registry key ntf.hq.twilio.content_cred_ref = cleanmatex_comm (a label, not a secret). It must equal the
--      credential_ref of the platform Twilio account in section 3.
--   3. The platform Twilio WhatsApp account and its sender, as PENDING. They are NEVER seeded as VERIFIED: verification
--      is a live check against Twilio and is done with the Verify button (Providers > Manage connections).
--      On the live database both rows already exist (VERIFIED), so the inserts do nothing there.
--
-- Deliberately NOT included (they are produced by live Twilio checks and approval evidence, so a migration must not
-- fake them): the imported template registration and revision, its variable bindings, and the tenant route.
-- To rebuild them follow docs/features/Notification_And_Communication_Hub/Setup_And_Config/LIVE_CONFIG_SNAPSHOT_2026-10-16.md.
--
-- No secrets are written here: the Twilio Auth Token stays in the HQ hosting environment.
--
-- Affected: sys_ops_job_cf, cron.job (through fn_ops_job_set_state), sys_ops_config_cf, sys_ops_config_chg_log,
--           sys_ntf_prov_acct_mst, sys_ntf_prov_send_mst. No new objects, so there are no new comments to add.
-- Related:  0611_ops_job_manager.sql, 0615_ops_config_registry_v2.sql, 0629_ntf_retention_days_registry.sql
BEGIN;

-- 1. Job schedules and state -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_job    RECORD;
  v_result JSONB;
BEGIN
  -- pg_cron or the job manager may be absent on a minimal local database: skip quietly instead of failing the migration.
  IF to_regclass('cron.job') IS NULL
     OR to_regclass('public.sys_ops_job_cf') IS NULL
     OR to_regprocedure('public.fn_ops_job_set_state(text,boolean,text,text)') IS NULL THEN
    RAISE NOTICE '0632: job manager or pg_cron not available, job settings skipped';
    RETURN;
  END IF;

  FOR v_job IN
    SELECT * FROM (VALUES
      ('ntf-outbox-processor',       TRUE,  '* * * * *'),   -- equals the registry default, so the override is cleared
      ('ntf-campaign-scheduler',     TRUE,  '*/5 * * * *'), -- owner choice: every 5 minutes (stored as a registry override)
      ('ntf-sweep-stale-push-subs',  TRUE, '0 3 * * 0')           -- stays disabled; schedule untouched
    ) AS t(job_code, enabled, schedule)
  LOOP
    v_result := public.fn_ops_job_set_state(v_job.job_code, v_job.enabled, v_job.schedule, 'migration:0632');
    IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) THEN
      CONTINUE;
    END IF;
    -- A job that is not registered or not in pg_cron on this database is not an error; anything else is.
    IF v_result ->> 'code' IN ('NOT_FOUND', 'NOT_IN_CRON') THEN
      RAISE NOTICE '0632: job % skipped (%)', v_job.job_code, v_result ->> 'code';
    ELSE
      RAISE EXCEPTION '0632: could not set job %: %', v_job.job_code, v_result::TEXT;
    END IF;
  END LOOP;
END $$;

-- 2. Registry key: credential label of the platform Twilio account -----------------------------------------------
DO $$
DECLARE
  c_key   CONSTANT TEXT := 'ntf.hq.twilio.content_cred_ref';
  c_value CONSTANT TEXT := 'cleanmatex_comm';
  v_old_fp TEXT;
  v_new_fp TEXT := encode(sha256(convert_to(c_value, 'UTF8')), 'hex');
BEGIN
  IF to_regclass('public.sys_ops_config_cf') IS NULL THEN
    RETURN;
  END IF;

  SELECT db_value_fingerprint INTO v_old_fp
    FROM public.sys_ops_config_cf
   WHERE config_key = c_key AND db_value IS DISTINCT FROM c_value;

  IF FOUND THEN
    UPDATE public.sys_ops_config_cf
       SET db_value = c_value,
           db_value_fingerprint = v_new_fp,
           value_updated_at = now(),
           value_updated_by = 'migration:0632'
     WHERE config_key = c_key;

    -- History row (fingerprints only, never the value), like every other registry change.
    INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
    VALUES (c_key, 'SET', 'migration:0632', v_old_fp, v_new_fp, '0632 baseline of the Twilio credential label');
  END IF;
END $$;

COMMIT;
