-- Notification Hub — move the pg_cron outbox secret out of plain text (R6) and repair the
-- reconcile cron job.
--
-- Problems fixed
--   1. sys_ntf_runtime_cf.outbox_secret_key held the bearer secret that pg_cron presents to the
--      tenant app (process-outbox, process-campaigns, reconcile-outbox) in PLAIN TEXT, and the
--      original value is committed in migration 0355. The committed value must be treated as
--      burned: after applying this migration, rotate it (see fn_ntf_rotate_outbox_secret).
--   2. The 'ntf-reconcile-outbox' job (0604) reads current_setting('app.next_js_base_url') /
--      current_setting('app.outbox_secret_key'). Supabase's postgres role cannot persist custom
--      GUCs (the reason 0355 introduced a config table), so those settings are NULL and the job
--      posts to a NULL URL: it has been a silent no-op. It now uses the same wrapper pattern as
--      the other jobs.
--
-- Design
--   * The secret lives in Supabase Vault (secret name 'ntf_outbox_secret'), encrypted at rest.
--   * One SECURITY DEFINER dispatcher (fn_ntf_cron_post) reads base_url from the registry (ntf.app.base_url, legacy
--     sys_ntf_runtime_cf as fallback) and the secret from vault.decrypted_secrets, then posts via pg_net. The three job wrappers call it.
--   * Nothing but the function owner can read the vault secret: the helper that decrypts it is
--     revoked from every API role.
--   * Cron schedules and active flags are NOT touched (job drift is managed from /ops/jobs);
--     only the reconcile job's command text changes, through cron.alter_job.
--
-- No secret value appears in this file. The existing value is copied inside the database, then the
-- plain-text row is deleted.
BEGIN;

-- Vault is preinstalled on Supabase; this is a no-op there.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 1. Copy the existing plain-text secret into Vault (once), then purge the plain-text row.
DO $$
DECLARE
  v_plain TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ntf_outbox_secret') THEN
    SELECT value INTO v_plain FROM public.sys_ntf_runtime_cf WHERE key = 'outbox_secret_key';
    IF v_plain IS NOT NULL AND btrim(v_plain) <> '' THEN
      PERFORM vault.create_secret(
        v_plain,
        'ntf_outbox_secret',
        'Bearer secret pg_cron presents to the tenant app notification endpoints; must equal NOTIFICATIONS_OUTBOX_SECRET.'
      );
    END IF;
  END IF;

  -- Purge the plain-text copy only once the vault copy is confirmed.
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ntf_outbox_secret') THEN
    DELETE FROM public.sys_ntf_runtime_cf WHERE key = 'outbox_secret_key';
  ELSE
    -- Nothing usable to migrate: drop any blank placeholder row so no plain-text slot remains.
    DELETE FROM public.sys_ntf_runtime_cf WHERE key = 'outbox_secret_key';
    RAISE WARNING '0616: no outbox secret to migrate (sys_ntf_runtime_cf.outbox_secret_key was empty); create one with fn_ntf_rotate_outbox_secret before the cron jobs can authenticate';
  END IF;
END;
$$;

-- 2. Internal reader. Only the function owner (via the SECURITY DEFINER dispatcher) may decrypt.
CREATE OR REPLACE FUNCTION public.fn_ntf_cron_secret()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.decrypted_secret
    FROM vault.decrypted_secrets s
   WHERE s.name = 'ntf_outbox_secret';
$$;
COMMENT ON FUNCTION public.fn_ntf_cron_secret() IS
  'Returns the decrypted pg_cron bearer secret from Vault. Internal: executable only by the function owner through SECURITY DEFINER dispatchers; revoked from every API role.';
REVOKE ALL ON FUNCTION public.fn_ntf_cron_secret() FROM PUBLIC, anon, authenticated, service_role;

-- 3. Shared dispatcher: POST an authenticated, empty JSON body to a tenant-app notification path.
CREATE OR REPLACE FUNCTION public.fn_ntf_cron_post(p_path TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  -- base_url: the registry key ntf.app.base_url (authoritative, 0617) wins; the legacy
  -- sys_ntf_runtime_cf row is only a fallback while that table still exists.
  SELECT c.db_value INTO v_url
    FROM public.sys_ops_config_cf c
   WHERE c.config_key = 'ntf.app.base_url' AND c.rec_status = 1 AND c.is_active AND NOT c.is_encrypted;
  IF v_url IS NULL OR btrim(v_url) = '' THEN
    SELECT value INTO v_url FROM public.sys_ntf_runtime_cf WHERE key = 'base_url';
  END IF;
  v_secret := public.fn_ntf_cron_secret();

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL THEN
    RAISE WARNING '[fn_ntf_cron_post] % skipped: base_url (registry ntf.app.base_url) or the vault secret ntf_outbox_secret is missing', p_path;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || p_path,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := '{}'::jsonb
  );
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_cron_post(TEXT) IS
  'pg_cron dispatcher: reads base_url from the registry (ntf.app.base_url; legacy sys_ntf_runtime_cf as fallback) and the bearer secret from Vault, then POSTs {} to base_url || p_path through pg_net. Warns and skips when either is missing. Internal; revoked from API roles.';
REVOKE ALL ON FUNCTION public.fn_ntf_cron_post(TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- 4. The three job wrappers keep their names (cron commands do not change) but delegate.
CREATE OR REPLACE FUNCTION public.ntf_trigger_outbox_proc()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.fn_ntf_cron_post('/api/notifications/process-outbox'); $$;
COMMENT ON FUNCTION public.ntf_trigger_outbox_proc() IS
  'Cron wrapper (job ntf-outbox-processor): triggers /api/notifications/process-outbox. Secret now comes from Vault (0616).';

CREATE OR REPLACE FUNCTION public.ntf_trigger_campaign_proc()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.fn_ntf_cron_post('/api/notifications/process-campaigns'); $$;
COMMENT ON FUNCTION public.ntf_trigger_campaign_proc() IS
  'Cron wrapper (job ntf-campaign-scheduler): triggers /api/notifications/process-campaigns. Secret now comes from Vault (0616).';

CREATE OR REPLACE FUNCTION public.ntf_trigger_reconcile_proc()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.fn_ntf_cron_post('/api/notifications/reconcile-outbox'); $$;
COMMENT ON FUNCTION public.ntf_trigger_reconcile_proc() IS
  'Cron wrapper (job ntf-reconcile-outbox): triggers /api/notifications/reconcile-outbox. Replaces the GUC-based command of 0604, which could never authenticate because custom GUCs cannot be persisted on Supabase.';

-- 5. Point the existing reconcile job at the wrapper. alter_job leaves schedule and active untouched.
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'ntf-reconcile-outbox';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, command := 'SELECT public.ntf_trigger_reconcile_proc()');
  END IF;
END;
$$;

-- 6. Rotation. The value being replaced is committed in 0355 and must be treated as burned.
--    Usage (SQL editor, as postgres): SELECT public.fn_ntf_rotate_outbox_secret('<new random 32+ char value>');
--    then set the SAME value as NOTIFICATIONS_OUTBOX_SECRET on the tenant web host and redeploy.
CREATE OR REPLACE FUNCTION public.fn_ntf_rotate_outbox_secret(p_new_secret TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_new_secret IS NULL OR p_new_secret !~ '^[A-Za-z0-9_.~-]{32,256}$' THEN
    RAISE EXCEPTION 'outbox secret must be 32-256 characters from A-Z a-z 0-9 _ . ~ -';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'ntf_outbox_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      p_new_secret,
      'ntf_outbox_secret',
      'Bearer secret pg_cron presents to the tenant app notification endpoints; must equal NOTIFICATIONS_OUTBOX_SECRET.'
    );
  ELSE
    PERFORM vault.update_secret(v_id, p_new_secret);
  END IF;

  -- Fingerprint prefix only, so the operator can confirm which value is live without exposing it.
  RETURN jsonb_build_object(
    'rotated', true,
    'fingerprint', left(encode(sha256(convert_to(p_new_secret, 'UTF8')), 'hex'), 12)
  );
END;
$$;
COMMENT ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) IS
  'Creates or replaces the Vault secret ntf_outbox_secret used by the notification cron jobs. Returns only a 12-hex fingerprint. The same value must be set as NOTIFICATIONS_OUTBOX_SECRET on the tenant web host. Service-role only.';
REVOKE ALL ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_rotate_outbox_secret(TEXT) TO service_role;

-- 7. Registry guidance for the key that mirrors this secret on the tenant host.
UPDATE public.sys_ops_config_cf
   SET guidance = 'The value pg_cron sends is stored encrypted in Supabase Vault (secret ntf_outbox_secret) and must equal this host variable. Rotate with SELECT public.fn_ntf_rotate_outbox_secret(''<new value>''), then set the same value here and redeploy. The previous value was committed to the repository (migration 0355) and must be rotated.',
       guidance2 = 'القيمة التي يرسلها pg_cron مخزّنة مشفّرة في Supabase Vault (السر ntf_outbox_secret) ويجب أن تساوي متغير هذا الخادم. للتدوير نفّذ SELECT public.fn_ntf_rotate_outbox_secret(''<القيمة الجديدة>'') ثم عيّن القيمة نفسها هنا وأعد النشر. القيمة السابقة نُشرت في المستودع (الترحيل 0355) ويجب تدويرها.',
       updated_at = now(),
       updated_info = '0616_ntf_outbox_secret_vault'
 WHERE config_key = 'ntf.app.outbox_secret';

-- 8. Post-conditions.
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.sys_ntf_runtime_cf WHERE key = 'outbox_secret_key'),
    'plain-text outbox_secret_key must be gone from sys_ntf_runtime_cf';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_ntf_cron_post'), 'fn_ntf_cron_post missing';
END;
$$;

COMMIT;
