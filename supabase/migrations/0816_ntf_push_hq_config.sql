-- ============================================================
-- Migration: 0816_ntf_push_hq_config.sql
-- Purpose:   Config Registry metadata for push sent by HQ API (Background
--            Jobs step 5d). HQ API now reads the shared Firebase and VAPID
--            keys; it no longer reads the legacy FCM server key.
-- Affected:  sys_ops_config_cf (six rows: applies_to_app, env_var_scope_val)
-- Related:   0612, 0617, 0777; docs/features/Background_Jobs/STEP5_PLAN.md
--            HQ code item 8
-- ============================================================
--
-- Why: HQ API's PushHqProvider now sends FCM through the HTTP v1 API with the
-- Firebase service account, and browser push through Web Push with the VAPID
-- key pair. The VAPID pair must be the one the browser subscribed with, so HQ
-- reads the existing ntf.app.vapid.* keys instead of new ntf.hq.* copies; the
-- same holds for ntf.app.fcm.*. Listing HQ_API on those rows lets HQ "Check
-- now" look for the variables on HQ API. Google retired the legacy FCM API
-- (fcm/send + server key) in 2024; ntf.hq.fcm.server_key stays listed for
-- HQ_WORKERS only until platform-workers' notification code is deleted (5e).
--
-- Metadata only: no value, ciphertext or fingerprint is written, and the
-- HQ_API scope entries start as is_it_there = unknown until the next Check.
-- Re-running is a no-op.
BEGIN;

SET LOCAL lock_timeout = '10s';

-- Abort if a key this file edits is missing, so a partial registry is never half-updated.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(k.config_key, ', ' ORDER BY k.config_key)
    INTO v_missing
    FROM (VALUES ('ntf.app.fcm.service_account'), ('ntf.app.fcm.project_id'), ('ntf.app.vapid.public_key'),
                 ('ntf.app.vapid.private_key'), ('ntf.app.vapid.subject'), ('ntf.hq.fcm.server_key')) AS k(config_key)
   WHERE NOT EXISTS (SELECT 1 FROM public.sys_ops_config_cf c WHERE c.config_key = k.config_key AND c.rec_status = 1);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0816 aborted: registry keys missing: %', v_missing;
  END IF;
END
$$;

-- 1. The five shared push keys: HQ_API reads them from now on (added once; existing entries are left as they are).
WITH k(config_key, env_var_name) AS (
  VALUES ('ntf.app.fcm.service_account', 'FCM_SERVICE_ACCOUNT_JSON'),
         ('ntf.app.fcm.project_id',      'FCM_PROJECT_ID'),
         ('ntf.app.vapid.public_key',    'VAPID_PUBLIC_KEY'),
         ('ntf.app.vapid.private_key',   'VAPID_PRIVATE_KEY'),
         ('ntf.app.vapid.subject',       'VAPID_SUBJECT')
)
UPDATE public.sys_ops_config_cf AS c
   SET applies_to_app = COALESCE(c.applies_to_app, '[]'::jsonb)
                        || '[{"app":"HQ_API","is_still_used":true}]'::jsonb,
       env_var_scope_val = COALESCE(c.env_var_scope_val, '[]'::jsonb)
                        || jsonb_build_array(jsonb_build_object(
                             'scope', 'HQ_API',
                             'env_var_name', k.env_var_name,
                             'is_it_there', 'unknown',
                             'value', NULL,          -- never a value here: secrets must not carry one (ck_sys_ops_config_cf_scpsec)
                             'fingerprint', NULL,
                             'description', 'Read by HQ platform-api (push sender) from its host environment.',
                             'is_still_used', true)),
       updated_at = now(),
       updated_info = 'HQ API sends push (Background Jobs step 5d)'
  FROM k
 WHERE c.config_key = k.config_key
   AND NOT (COALESCE(c.applies_to_app, '[]'::jsonb) @> '[{"app":"HQ_API"}]'::jsonb);

-- 2. Legacy FCM server key: HQ API no longer reads it. The HQ_WORKERS entry stays until 5e deletes that code.
UPDATE public.sys_ops_config_cf AS c
   SET applies_to_app = COALESCE((SELECT jsonb_agg(CASE WHEN e->>'app' = 'HQ_API' THEN e || '{"is_still_used":false}'::jsonb ELSE e END ORDER BY n)
                           FROM jsonb_array_elements(c.applies_to_app) WITH ORDINALITY AS a(e, n)), c.applies_to_app),
       env_var_scope_val = COALESCE((SELECT jsonb_agg(CASE WHEN e->>'scope' = 'HQ_API' THEN e || '{"is_still_used":false}'::jsonb ELSE e END ORDER BY n)
                              FROM jsonb_array_elements(COALESCE(c.env_var_scope_val, '[]'::jsonb)) WITH ORDINALITY AS s(e, n)), c.env_var_scope_val),
       updated_at = now(),
       updated_info = 'HQ API reads the FCM v1 service account instead (Background Jobs step 5d)'
 WHERE c.config_key = 'ntf.hq.fcm.server_key'
   AND c.applies_to_app @> '[{"app":"HQ_API","is_still_used":true}]'::jsonb;

COMMIT;
