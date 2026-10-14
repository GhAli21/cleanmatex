-- Platform Operations Console — Config Registry v2 (schema + functions). Data lives in 0617.
--
-- Decisions this migration implements (owner, 2026-10-15)
--   1. The registry (sys_ops_config_cf) becomes the single authority for configuration, including
--      the tenant-app flags that used to live in sys_ntf_runtime_cf (which is retired later).
--   2. Encryption is an explicit per-key choice, independent of is_secret. is_encrypted defaults
--      to false (plain text) for every key; is_secret only means "write-only: never displayed,
--      logged or audited". The old rule "a secret must be encrypted" is dropped.
--   3. applies_to_app becomes a JSONB list of {app, is_still_used, ...} so one key can be read by
--      several apps and an app can be marked as no longer using it.
--   4. New columns record WHERE each key lives in the hosting environments and what it holds there
--      (env_var_scope_val: one object per scope; env_var_value: representative non-secret value).
--   5. Two new source policies: DB_OVERRIDES_ENV and TAKE_EXISTING_DB_OR_ENV, plus a DRIFT check result.
--
-- Safety: no stored value exists in any environment yet (verified on the remote database), so the
-- is_encrypted flips and the column conversion cannot orphan a ciphertext. The migration never
-- touches stored values. Functions are re-created with service_role-only privileges as in 0612.
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop the functions whose result shape changes (re-created below) and the old constraints.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_ops_config_list() RESTRICT;
DROP FUNCTION IF EXISTS public.fn_ops_config_get_raw(TEXT) RESTRICT;

ALTER TABLE public.sys_ops_config_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_config_cf_secenc; -- secret no longer forces encryption
ALTER TABLE public.sys_ops_config_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_config_cf_app;    -- replaced by a shape check on the JSONB list
ALTER TABLE public.sys_ops_config_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_config_cf_pol;    -- widened vocabulary
ALTER TABLE public.sys_ops_config_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_config_cf_chk;    -- adds DRIFT

-- -----------------------------------------------------------------------------
-- 2. Shape validators (IMMUTABLE so they can back CHECK constraints)
-- -----------------------------------------------------------------------------

-- applies_to_app must be an array of objects {app: UPPER_SNAKE, is_still_used: boolean, ...}.
CREATE OR REPLACE FUNCTION public.fn_ops_config_apps_valid(p_apps JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_typeof(p_apps) = 'array'
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements(p_apps) AS e
        WHERE jsonb_typeof(e) <> 'object'
           OR COALESCE(e->>'app', '') !~ '^[A-Z][A-Z0-9_]{1,40}$'
           OR jsonb_typeof(e->'is_still_used') IS DISTINCT FROM 'boolean'
     );
$$;
COMMENT ON FUNCTION public.fn_ops_config_apps_valid(JSONB) IS
  'True when a JSONB value is an array of objects each carrying an UPPER_SNAKE "app" and a boolean "is_still_used". Backs ck_sys_ops_config_cf_apps. Open vocabulary: new apps need no migration.';

-- env_var_scope_val must be an array of objects {scope: UPPER_SNAKE, is_it_there: yes|no|unknown, ...}.
CREATE OR REPLACE FUNCTION public.fn_ops_config_scopes_valid(p_scopes JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_typeof(p_scopes) = 'array'
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements(p_scopes) AS e
        WHERE jsonb_typeof(e) <> 'object'
           OR COALESCE(e->>'scope', '') !~ '^[A-Z][A-Z0-9_]{1,40}$'
           OR COALESCE(e->>'is_it_there', '') NOT IN ('yes', 'no', 'unknown')
     );
$$;
COMMENT ON FUNCTION public.fn_ops_config_scopes_valid(JSONB) IS
  'True when a JSONB value is an array of objects each carrying an UPPER_SNAKE "scope" and is_it_there in (yes, no, unknown). Backs ck_sys_ops_config_cf_scopes.';

-- True when any scope entry carries a non-null "value" (used to keep secrets out of the scope list).
CREATE OR REPLACE FUNCTION public.fn_ops_config_scopes_have_value(p_scopes JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_typeof(p_scopes) = 'array'
     AND EXISTS (
       SELECT 1
         FROM jsonb_array_elements(p_scopes) AS e
        WHERE jsonb_typeof(e) = 'object'
          AND e ? 'value'
          AND jsonb_typeof(e->'value') <> 'null'
     );
$$;
COMMENT ON FUNCTION public.fn_ops_config_scopes_have_value(JSONB) IS
  'True when any env_var_scope_val element holds a non-null "value". Backs ck_sys_ops_config_cf_scpsec so secret keys can only record presence (is_it_there) and a fingerprint, never a value.';

-- -----------------------------------------------------------------------------
-- 3. applies_to_app: TEXT -> JSONB list of {app, is_still_used}
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_ops_config_cf ALTER COLUMN applies_to_app DROP DEFAULT;
ALTER TABLE public.sys_ops_config_cf
  ALTER COLUMN applies_to_app TYPE JSONB
  USING (
    CASE applies_to_app
      WHEN 'PLATFORM_API'     THEN '[{"app":"HQ_API","is_still_used":true}]'::jsonb
      WHEN 'PLATFORM_WORKERS' THEN '[{"app":"HQ_WORKERS","is_still_used":true}]'::jsonb
      WHEN 'TENANT_WEB'       THEN '[{"app":"TENANT_WEB","is_still_used":true}]'::jsonb
      ELSE '[{"app":"HQ_API","is_still_used":true},{"app":"HQ_WEB","is_still_used":true},{"app":"HQ_WORKERS","is_still_used":true},{"app":"TENANT_WEB","is_still_used":true},{"app":"TENANT_API","is_still_used":true}]'::jsonb
    END
  );
ALTER TABLE public.sys_ops_config_cf ALTER COLUMN applies_to_app SET DEFAULT '[]'::jsonb;
ALTER TABLE public.sys_ops_config_cf ALTER COLUMN applies_to_app SET NOT NULL;
COMMENT ON COLUMN public.sys_ops_config_cf.applies_to_app IS
  'JSONB list of apps that read this key: [{"app":"TENANT_WEB","is_still_used":true,"notes":"..."}]. Suggested apps: HQ_API, HQ_WEB, HQ_WORKERS, TENANT_WEB, TENANT_API, MARKETING_WEB, CUSTOMER_MOBILE_APP, DATABASE. is_still_used=false marks a variable that is declared but no longer read. Replaces the old single-value TEXT column.';

-- -----------------------------------------------------------------------------
-- 4. New columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_ops_config_cf
  ADD COLUMN IF NOT EXISTS env_var_value     TEXT,
  ADD COLUMN IF NOT EXISTS env_var_scope_val JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sys_ops_config_cf.env_var_value IS
  'Representative value of the environment variable for NON-secret keys (taken from the primary scope when the environments were inventoried); NULL for secrets and when unknown. Informational: the live value is decided by source_policy, never read from this column.';
COMMENT ON COLUMN public.sys_ops_config_cf.env_var_scope_val IS
  'JSONB list describing where the environment variable lives, one object per scope: {"scope":"TENANT_WEB","env_var_name":"TWILIO_AUTH_TOKEN","is_it_there":"yes|no|unknown","value":null,"fingerprint":"12hex|null","description":"...","is_still_used":true}. "value" is only ever set for non-secret keys (ck_sys_ops_config_cf_scpsec). Informational inventory; maintained by seed scripts and migrations.';

-- -----------------------------------------------------------------------------
-- 5. Constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_ops_config_cf
  ADD CONSTRAINT ck_sys_ops_config_cf_apps CHECK (public.fn_ops_config_apps_valid(applies_to_app)),
  ADD CONSTRAINT ck_sys_ops_config_cf_scopes CHECK (public.fn_ops_config_scopes_valid(env_var_scope_val)),
  -- A secret key records presence and a fingerprint per scope, never a value.
  ADD CONSTRAINT ck_sys_ops_config_cf_scpsec CHECK (NOT is_secret OR NOT public.fn_ops_config_scopes_have_value(env_var_scope_val)),
  ADD CONSTRAINT ck_sys_ops_config_cf_envval CHECK (NOT is_secret OR env_var_value IS NULL),
  ADD CONSTRAINT ck_sys_ops_config_cf_pol CHECK (source_policy IN (
    'DB_ONLY', 'ENV_ONLY', 'BOTH_MUST_MATCH', 'ENV_OVERRIDES_DB', 'DB_OVERRIDES_ENV', 'TAKE_EXISTING_DB_OR_ENV'
  )),
  ADD CONSTRAINT ck_sys_ops_config_cf_chk CHECK (
    last_check_status IS NULL OR last_check_status IN ('OK', 'MISSING', 'MATCH', 'MISMATCH', 'UNCHECKABLE', 'DRIFT')
  );

COMMENT ON CONSTRAINT ck_sys_ops_config_cf_apps ON public.sys_ops_config_cf IS 'applies_to_app is a list of {app, is_still_used} objects (open vocabulary).';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_scopes ON public.sys_ops_config_cf IS 'env_var_scope_val is a list of {scope, is_it_there, ...} objects.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_scpsec ON public.sys_ops_config_cf IS 'Secret keys never carry a value inside env_var_scope_val.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_envval ON public.sys_ops_config_cf IS 'Secret keys never carry env_var_value.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_pol ON public.sys_ops_config_cf IS
  'Allowed source policies: DB_ONLY, ENV_ONLY, BOTH_MUST_MATCH, ENV_OVERRIDES_DB, DB_OVERRIDES_ENV, TAKE_EXISTING_DB_OR_ENV.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_chk ON public.sys_ops_config_cf IS 'Allowed compliance-check results (DRIFT = both sources set and different under TAKE_EXISTING_DB_OR_ENV).';

COMMENT ON COLUMN public.sys_ops_config_cf.is_encrypted IS
  'true = the stored value lives only in db_value_enc (AES-256-GCM envelope produced by HQ platform-api); false (the default for EVERY key, secrets included) = plain text in db_value. Independent of is_secret. Switchable only while no value is stored (fn_ops_config_set_encryption).';
COMMENT ON COLUMN public.sys_ops_config_cf.is_secret IS
  'Write-only handling: the value is never displayed, logged or audited and needs hq_ops:manage_secrets. Does NOT imply encryption at rest (see is_encrypted).';
COMMENT ON COLUMN public.sys_ops_config_cf.source_policy IS
  'Which source decides the live value: DB_ONLY (stored), ENV_ONLY (environment), ENV_OVERRIDES_DB (env, else stored), DB_OVERRIDES_ENV (stored, else env), BOTH_MUST_MATCH (equal or refused), TAKE_EXISTING_DB_OR_ENV (whichever exists; stored wins and Check now reports DRIFT when both exist and differ).';

-- -----------------------------------------------------------------------------
-- 6. Encryption is plain by default: flip seeded rows that hold no value.
-- -----------------------------------------------------------------------------
UPDATE public.sys_ops_config_cf
   SET is_encrypted = false,
       updated_at = now(),
       updated_info = '0615_ops_config_registry_v2'
 WHERE is_encrypted
   AND db_value IS NULL
   AND db_value_enc IS NULL;

-- -----------------------------------------------------------------------------
-- 7. Change-log vocabulary
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_ops_config_chg_log DROP CONSTRAINT IF EXISTS ck_ops_config_chg_act;
ALTER TABLE public.sys_ops_config_chg_log
  ADD CONSTRAINT ck_ops_config_chg_act CHECK (action IN ('SET', 'CLEAR', 'POLICY_CHANGE', 'ENCRYPTION_CHANGE'));
COMMENT ON CONSTRAINT ck_ops_config_chg_act ON public.sys_ops_config_chg_log IS 'Allowed change actions (ENCRYPTION_CHANGE = is_encrypted switched on a key with no stored value).';
COMMENT ON COLUMN public.sys_ops_config_chg_log.action IS 'SET, CLEAR, POLICY_CHANGE or ENCRYPTION_CHANGE.';

-- -----------------------------------------------------------------------------
-- 8. fn_ops_config_list - metadata for the screen (never ciphertext or fingerprints)
-- -----------------------------------------------------------------------------
-- db_value is returned only for plain, NON-secret rows (a plain secret is still never listed).
CREATE OR REPLACE FUNCTION public.fn_ops_config_list()
RETURNS TABLE (
  config_key        TEXT,
  module            TEXT,
  name              TEXT,
  name2             TEXT,
  description       TEXT,
  description2      TEXT,
  value_type        TEXT,
  is_secret         BOOLEAN,
  is_encrypted      BOOLEAN,
  source_policy     TEXT,
  env_var_name      TEXT,
  env_var_value     TEXT,
  env_var_scope_val JSONB,
  is_bootstrap      BOOLEAN,
  is_wired          BOOLEAN,
  requires_restart  BOOLEAN,
  validation_rule   TEXT,
  manage_via        TEXT,
  guidance          TEXT,
  guidance2         TEXT,
  applies_to_app    JSONB,
  is_set_db         BOOLEAN,
  db_value          TEXT,
  last_check_status TEXT,
  last_check_at     TIMESTAMPTZ,
  value_updated_at  TIMESTAMPTZ,
  value_updated_by  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.config_key, c.module, c.name, c.name2, c.description, c.description2,
    c.value_type, c.is_secret, c.is_encrypted, c.source_policy, c.env_var_name,
    c.env_var_value, c.env_var_scope_val,
    c.is_bootstrap, c.is_wired, c.requires_restart, c.validation_rule, c.manage_via,
    c.guidance, c.guidance2, c.applies_to_app,
    (c.db_value IS NOT NULL OR c.db_value_enc IS NOT NULL),
    CASE WHEN c.is_secret OR c.is_encrypted THEN NULL ELSE c.db_value END,
    c.last_check_status, c.last_check_at, c.value_updated_at, c.value_updated_by
  FROM public.sys_ops_config_cf c
  WHERE c.rec_status = 1 AND c.is_active
  ORDER BY c.module, c.config_key;
$$;
COMMENT ON FUNCTION public.fn_ops_config_list() IS
  'Read-only registry list for the HQ screen. Never returns ciphertext or fingerprints; db_value only for plain non-secret rows (secrets stay write-only even when stored as plain text).';

-- -----------------------------------------------------------------------------
-- 9. fn_ops_config_get_raw - resolver/check feed (service_role only)
-- -----------------------------------------------------------------------------
-- p_key NULL = every active key. p_app (optional) keeps only keys that list that app with
-- is_still_used = true; a convenience filter for app resolvers, NOT an isolation boundary (every
-- caller holds the same service role).
CREATE OR REPLACE FUNCTION public.fn_ops_config_get_raw(p_key TEXT DEFAULT NULL, p_app TEXT DEFAULT NULL)
RETURNS TABLE (
  config_key           TEXT,
  source_policy        TEXT,
  is_secret            BOOLEAN,
  is_encrypted         BOOLEAN,
  is_bootstrap         BOOLEAN,
  value_type           TEXT,
  env_var_name         TEXT,
  applies_to_app       JSONB,
  db_value             TEXT,
  db_value_enc         TEXT,
  db_value_fingerprint TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.config_key, c.source_policy, c.is_secret, c.is_encrypted, c.is_bootstrap,
         c.value_type, c.env_var_name, c.applies_to_app,
         c.db_value, c.db_value_enc, c.db_value_fingerprint
  FROM public.sys_ops_config_cf c
  WHERE c.rec_status = 1 AND c.is_active
    AND (p_key IS NULL OR c.config_key = p_key)
    AND (p_app IS NULL OR EXISTS (
          SELECT 1
            FROM jsonb_array_elements(c.applies_to_app) AS e
           WHERE e->>'app' = p_app
             AND COALESCE((e->>'is_still_used')::boolean, true)
        ));
$$;
COMMENT ON FUNCTION public.fn_ops_config_get_raw(TEXT, TEXT) IS
  'service_role only. Storage columns (plain value, envelope, fingerprint) for app resolvers and the compliance check; may contain plain-text secrets by owner decision. Output must never reach a browser or a log. p_app filters to keys the app still uses (not a security boundary).';

-- -----------------------------------------------------------------------------
-- 10. fn_ops_config_set_policy - six policies
-- -----------------------------------------------------------------------------
-- DB_ONLY and BOTH_MUST_MATCH need a stored value (a switch must not leave a live key unresolved);
-- every policy except DB_ONLY needs env_var_name; ENV_ONLY clears any stored value.
CREATE OR REPLACE FUNCTION public.fn_ops_config_set_policy(
  p_key    TEXT,
  p_policy TEXT,
  p_actor  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg     public.sys_ops_config_cf%ROWTYPE;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_cleared BOOLEAN := false;
BEGIN
  IF p_policy IS NULL OR p_policy NOT IN (
    'DB_ONLY', 'ENV_ONLY', 'BOTH_MUST_MATCH', 'ENV_OVERRIDES_DB', 'DB_OVERRIDES_ENV', 'TAKE_EXISTING_DB_OR_ENV'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_POLICY', 'message', 'Unknown source policy', 'config_key', p_key);
  END IF;

  SELECT * INTO v_cfg
  FROM public.sys_ops_config_cf
  WHERE config_key = p_key AND rec_status = 1 AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Config key is not registered', 'config_key', p_key);
  END IF;
  IF v_cfg.is_bootstrap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOTSTRAP_KEY',
      'message', 'Bootstrap keys are always ENV_ONLY', 'config_key', p_key);
  END IF;
  IF v_cfg.source_policy = p_policy THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Policy is already set', 'config_key', p_key);
  END IF;
  IF p_policy <> 'DB_ONLY' AND (v_cfg.env_var_name IS NULL OR btrim(v_cfg.env_var_name) = '') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ENV_VAR_REQUIRED',
      'message', 'This key has no environment variable name', 'config_key', p_key);
  END IF;
  IF p_policy IN ('DB_ONLY', 'BOTH_MUST_MATCH')
     AND v_cfg.db_value IS NULL AND v_cfg.db_value_enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'DB_VALUE_REQUIRED',
      'message', 'Store a value before switching to this policy', 'config_key', p_key);
  END IF;

  v_cleared := p_policy = 'ENV_ONLY' AND v_cfg.db_value_fingerprint IS NOT NULL;

  UPDATE public.sys_ops_config_cf
  SET source_policy        = p_policy,
      db_value             = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value END,
      db_value_enc         = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value_enc END,
      db_value_fingerprint = CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE db_value_fingerprint END,
      last_check_status    = NULL,
      last_check_at        = NULL,
      value_updated_at     = now(),
      value_updated_by     = v_actor,
      updated_info         = 'fn_ops_config_set_policy by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (
    config_key, action, actor, old_fingerprint, new_fingerprint, old_policy, new_policy, created_info
  ) VALUES (
    p_key, 'POLICY_CHANGE', v_actor, v_cfg.db_value_fingerprint,
    CASE WHEN p_policy = 'ENV_ONLY' THEN NULL ELSE v_cfg.db_value_fingerprint END,
    v_cfg.source_policy, p_policy, 'fn_ops_config_set_policy'
  );

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Policy updated',
    'config_key', p_key, 'cleared_value', v_cleared);
END;
$$;
COMMENT ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) IS
  'Changes the source policy of a non-bootstrap key (six policies). DB_ONLY/BOTH_MUST_MATCH require a stored value; ENV_ONLY clears any stored value. Logs the change.';

-- -----------------------------------------------------------------------------
-- 11. fn_ops_config_set_encryption - choose plain or encrypted storage (only while no value is stored)
-- -----------------------------------------------------------------------------
-- A stored value cannot change storage form without being re-entered, so the switch is refused while a
-- value exists (clear it first). Returns jsonb {ok, code, message, config_key}.
-- code: UPDATED, NOT_FOUND, BOOTSTRAP_KEY, NOTHING_TO_CHANGE, VALUE_PRESENT.
CREATE OR REPLACE FUNCTION public.fn_ops_config_set_encryption(
  p_key          TEXT,
  p_is_encrypted BOOLEAN,
  p_actor        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg   public.sys_ops_config_cf%ROWTYPE;
  v_actor TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_config_cf
  WHERE config_key = p_key AND rec_status = 1 AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Config key is not registered', 'config_key', p_key);
  END IF;
  IF v_cfg.is_bootstrap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOTSTRAP_KEY',
      'message', 'Bootstrap keys hold no stored value', 'config_key', p_key);
  END IF;
  IF p_is_encrypted IS NULL OR v_cfg.is_encrypted = p_is_encrypted THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE', 'message', 'Storage form is already set', 'config_key', p_key);
  END IF;
  IF v_cfg.db_value IS NOT NULL OR v_cfg.db_value_enc IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALUE_PRESENT',
      'message', 'Clear the stored value first; it must be re-entered in the new storage form', 'config_key', p_key);
  END IF;

  UPDATE public.sys_ops_config_cf
  SET is_encrypted = p_is_encrypted,
      last_check_status = NULL,
      last_check_at = NULL,
      value_updated_at = now(),
      value_updated_by = v_actor,
      updated_info = 'fn_ops_config_set_encryption by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, created_info)
  VALUES (p_key, 'ENCRYPTION_CHANGE', v_actor,
          'fn_ops_config_set_encryption -> ' || CASE WHEN p_is_encrypted THEN 'encrypted' ELSE 'plain' END);

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Storage form updated', 'config_key', p_key);
END;
$$;
COMMENT ON FUNCTION public.fn_ops_config_set_encryption(TEXT, BOOLEAN, TEXT) IS
  'Switches a non-bootstrap key between plain and encrypted storage, only while no value is stored. Logs ENCRYPTION_CHANGE. Service-role only.';

-- -----------------------------------------------------------------------------
-- 12. Privileges: service_role only (same model as 0612)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_ops_config_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_get_raw(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_set_encryption(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_list() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_get_raw(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set_encryption(TEXT, BOOLEAN, TEXT) TO service_role;
-- The three validators (section 2) keep their default EXECUTE grant on purpose: a CHECK constraint runs
-- them with the privileges of the writing role, so revoking would make every write by that role fail.
-- They are pure functions of their argument and expose nothing.

COMMIT;
