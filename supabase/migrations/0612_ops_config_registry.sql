-- =============================================================================
-- Migration: 0612_ops_config_registry.sql
-- STATUS:    CREATED, NOT APPLIED. Review and apply manually (local + remote).
--            This file is never executed by the agent.
-- Purpose:   Platform Operations Console P4 - Config Registry. A platform-global
--            inventory of configuration keys (environment variables / settings) with a
--            per-key SOURCE POLICY (where the live value is allowed to come from) and a
--            per-row is_encrypted flag. Values that are secret are stored ONLY as an
--            application-level AES-GCM envelope produced by HQ platform-api; the database
--            never sees the master key and never returns a secret or ciphertext.
-- Affected:  NEW sys_ops_config_cf, sys_ops_config_chg_log,
--            fn_ops_config_list, fn_ops_config_get_raw, fn_ops_config_set,
--            fn_ops_config_set_policy, fn_ops_config_clear, fn_ops_config_record_check,
--            hq_permissions (2 new codes), idempotent seed of the Notification Hub keys.
-- Related:   0610 (job registry, same conventions), 0602 (HQ RBAC), 0502/0503
--            (sys_ntf_runtime_cf - the tenant runtime table this registry does NOT replace
--            yet; see is_wired).
-- Safety:    * Tables are RLS-enabled with no policies and REVOKEd from anon/authenticated;
--              only service_role (HQ platform-api) can reach them.
--            * All functions are SECURITY DEFINER, pinned search_path, EXECUTE for
--              service_role only. None accepts or returns a master key.
--            * Change history stores SHA-256 fingerprints only, never values.
--            * Bootstrap keys (DB URL, Supabase keys, HQ_ENCRYPTION_MASTER_KEY, JWT
--              secrets, inter-app service keys) are forced ENV_ONLY with no stored value
--              by CHECK constraints: they must exist before the database is reachable.
--            * Seeded live-env keys use ENV_OVERRIDES_DB (env wins, DB is fallback) so no
--              behaviour changes until a key is deliberately converted. The column
--              DEFAULT stays DB_ONLY for brand-new keys.
-- Reversal:  Forward-only. To retire (RESTRICT semantics, no CASCADE needed):
--            DROP FUNCTION IF EXISTS public.fn_ops_config_record_check(JSONB);
--            DROP FUNCTION IF EXISTS public.fn_ops_config_clear(TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_config_set_policy(TEXT, TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_config_get_raw(TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_config_list();
--            DROP TABLE IF EXISTS public.sys_ops_config_chg_log;
--            DROP TABLE IF EXISTS public.sys_ops_config_cf;
--            DELETE FROM hq_permissions WHERE permission_code IN
--              ('hq_ops:manage_config','hq_ops:manage_secrets');
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. sys_ops_config_cf - registry of configuration keys
-- -----------------------------------------------------------------------------

-- Platform-global (no tenant data) catalog of configuration keys. A row records WHAT the
-- key is, WHERE it may come from (source_policy) and, when the database is an allowed
-- source, the stored value (plain or encrypted). The registry never reads another host's
-- environment; per-host presence is reported by each app on demand.
CREATE TABLE IF NOT EXISTS public.sys_ops_config_cf (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity; API addresses rows by config_key.
  config_key           TEXT NOT NULL,                               -- Stable dotted lowercase key, for example ntf.hq.resend.from_email.
  module               TEXT NOT NULL,                               -- Owning product module used for grouping (ntf, platform, ...).
  name                 TEXT NOT NULL,                               -- English display name.
  name2                TEXT,                                        -- Arabic display name.
  description          TEXT,                                        -- English description of what the key controls.
  description2         TEXT,                                        -- Arabic description.
  value_type           TEXT NOT NULL DEFAULT 'STRING',              -- Value shape validated by the API: STRING, NUMBER, BOOLEAN, URL, JSON, SECRET_STRING.
  is_secret            BOOLEAN NOT NULL DEFAULT false,              -- Secret values are write-only and never displayed, logged or audited.
  is_encrypted         BOOLEAN NOT NULL DEFAULT false,              -- true = value lives only in db_value_enc (envelope); false = plain in db_value.
  source_policy        TEXT NOT NULL DEFAULT 'DB_ONLY',             -- Allowed value source; see ck_sys_ops_config_cf_pol.
  env_var_name         TEXT,                                        -- Environment variable that carries this key on its host; required unless DB_ONLY.
  db_value             TEXT,                                        -- Plain stored value; NULL whenever is_encrypted or policy is ENV_ONLY.
  db_value_enc         TEXT,                                        -- Base64 AES-256-GCM envelope produced by HQ platform-api; NULL when not is_encrypted.
  db_value_fingerprint TEXT,                                        -- SHA-256 hex of the stored value for match checks; never used to recover a value.
  is_bootstrap         BOOLEAN NOT NULL DEFAULT false,              -- true = needed before the DB is reachable; forced ENV_ONLY and never stored here.
  is_wired             BOOLEAN NOT NULL DEFAULT false,              -- true once application code reads this key through the config resolver.
  requires_restart     BOOLEAN NOT NULL DEFAULT true,               -- Whether a change only takes effect after the consuming service restarts.
  validation_rule      TEXT,                                        -- Optional regular expression the API applies to the value before storing.
  manage_via           TEXT NOT NULL DEFAULT 'UI',                  -- Where an operator changes it: UI, HOSTING_ENV, EXTERNAL_CONSOLE, MIGRATION or GIT.
  guidance             TEXT,                                        -- English operator guidance for keys not fully manageable in the UI.
  guidance2            TEXT,                                        -- Arabic operator guidance.
  applies_to_app       TEXT NOT NULL DEFAULT 'ALL',                 -- Which app reads the key: PLATFORM_API, PLATFORM_WORKERS, TENANT_WEB or ALL.
  last_check_status    TEXT,                                        -- Result of the last compliance check run by HQ platform-api; NULL = never checked.
  last_check_at        TIMESTAMPTZ,                                 -- When last_check_status was computed.
  value_updated_at     TIMESTAMPTZ,                                 -- When the stored value or policy last changed (unlike updated_at, not bumped by checks).
  value_updated_by     TEXT,                                        -- Operator who last changed the stored value or policy.
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Row creation time.
  created_by           UUID,                                        -- HQ user who created the row, when known.
  created_info         TEXT,                                        -- Creation provenance (migration/seed label).
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Last modification time (maintained by trigger).
  updated_by           UUID,                                        -- HQ user who last modified the row, when a UUID is known.
  updated_info         TEXT,                                        -- Last-change provenance (function name and actor label).
  is_active            BOOLEAN NOT NULL DEFAULT true,               -- false hides the key from the screen without deleting history.
  rec_status           SMALLINT NOT NULL DEFAULT 1,                 -- 1=active, 0=soft-deleted (never hard-delete).
  rec_order            INTEGER,                                     -- Optional manual display order.
  rec_notes            TEXT,                                        -- Standard free-text record note.

  -- Unique key: the API path parameter and change-log FK target.
  CONSTRAINT uq_sys_ops_config_cf_key UNIQUE (config_key),
  -- Dotted lowercase identifier, at most 120 chars.
  CONSTRAINT ck_sys_ops_config_cf_key CHECK (length(config_key) <= 120 AND config_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  CONSTRAINT ck_sys_ops_config_cf_vtype CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'URL', 'JSON', 'SECRET_STRING')),
  -- Source policy vocabulary. DB_ONLY is the column default; ENV_OVERRIDES_DB reproduces today's env-wins behaviour.
  CONSTRAINT ck_sys_ops_config_cf_pol CHECK (source_policy IN ('DB_ONLY', 'ENV_ONLY', 'BOTH_MUST_MATCH', 'ENV_OVERRIDES_DB')),
  -- A secret may never be stored in plain text.
  CONSTRAINT ck_sys_ops_config_cf_secenc CHECK (NOT is_secret OR is_encrypted),
  -- SECRET_STRING values are by definition secret.
  CONSTRAINT ck_sys_ops_config_cf_sectyp CHECK (value_type <> 'SECRET_STRING' OR is_secret),
  -- Exactly one storage column is usable: plain only when not encrypted ...
  CONSTRAINT ck_sys_ops_config_cf_plain CHECK (NOT is_encrypted OR db_value IS NULL),
  -- ... and the envelope only when encrypted.
  CONSTRAINT ck_sys_ops_config_cf_enc CHECK (is_encrypted OR db_value_enc IS NULL),
  -- ENV_ONLY keys never hold a stored value or fingerprint.
  CONSTRAINT ck_sys_ops_config_cf_envonly CHECK (
    source_policy <> 'ENV_ONLY'
    OR (db_value IS NULL AND db_value_enc IS NULL AND db_value_fingerprint IS NULL)
  ),
  -- Bootstrap keys are always ENV_ONLY (and therefore never stored, see above) and managed in the hosting env.
  CONSTRAINT ck_sys_ops_config_cf_boot CHECK (NOT is_bootstrap OR (source_policy = 'ENV_ONLY' AND manage_via = 'HOSTING_ENV')),
  -- Fingerprint is a SHA-256 hex digest and exists exactly when a value exists.
  CONSTRAINT ck_sys_ops_config_cf_fp CHECK (db_value_fingerprint IS NULL OR db_value_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_sys_ops_config_cf_fpset CHECK (
    (db_value IS NULL AND db_value_enc IS NULL) = (db_value_fingerprint IS NULL)
  ),
  -- Every policy that consults the environment must say which variable.
  CONSTRAINT ck_sys_ops_config_cf_envnm CHECK (source_policy = 'DB_ONLY' OR (env_var_name IS NOT NULL AND length(btrim(env_var_name)) > 0)),
  CONSTRAINT ck_sys_ops_config_cf_via CHECK (manage_via IN ('UI', 'HOSTING_ENV', 'EXTERNAL_CONSOLE', 'MIGRATION', 'GIT')),
  CONSTRAINT ck_sys_ops_config_cf_app CHECK (applies_to_app IN ('PLATFORM_API', 'PLATFORM_WORKERS', 'TENANT_WEB', 'ALL')),
  CONSTRAINT ck_sys_ops_config_cf_chk CHECK (last_check_status IS NULL OR last_check_status IN ('OK', 'MISSING', 'MATCH', 'MISMATCH', 'UNCHECKABLE')),
  CONSTRAINT ck_sys_ops_config_cf_recst CHECK (rec_status IN (0, 1))
);

-- Supports the screen list grouped/filtered by module.
CREATE INDEX IF NOT EXISTS idx_sys_ops_config_cf_mod
  ON public.sys_ops_config_cf (module, config_key);

COMMENT ON TABLE public.sys_ops_config_cf IS
  'Platform-global registry of configuration keys with per-key source policy and per-row encryption. Secret values are stored only as application-encrypted envelopes and are never returned.';
COMMENT ON COLUMN public.sys_ops_config_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ops_config_cf.config_key IS 'Stable dotted lowercase key; API path parameter.';
COMMENT ON COLUMN public.sys_ops_config_cf.module IS 'Owning product module used for grouping on the screen.';
COMMENT ON COLUMN public.sys_ops_config_cf.name IS 'English display name.';
COMMENT ON COLUMN public.sys_ops_config_cf.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_ops_config_cf.description IS 'English description of what the key controls.';
COMMENT ON COLUMN public.sys_ops_config_cf.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_ops_config_cf.value_type IS 'Value shape validated by the API: STRING, NUMBER, BOOLEAN, URL, JSON or SECRET_STRING.';
COMMENT ON COLUMN public.sys_ops_config_cf.is_secret IS 'Secret values are write-only: never displayed, logged, audited or returned.';
COMMENT ON COLUMN public.sys_ops_config_cf.is_encrypted IS 'true = value lives only in db_value_enc as an envelope; false = plain in db_value. is_secret implies is_encrypted.';
COMMENT ON COLUMN public.sys_ops_config_cf.source_policy IS 'DB_ONLY (default) | ENV_ONLY | BOTH_MUST_MATCH (env and DB must be equal) | ENV_OVERRIDES_DB (env wins, DB is fallback; legacy behaviour).';
COMMENT ON COLUMN public.sys_ops_config_cf.env_var_name IS 'Environment variable carrying this key on its host; required unless source_policy is DB_ONLY.';
COMMENT ON COLUMN public.sys_ops_config_cf.db_value IS 'Plain stored value; NULL when is_encrypted or source_policy is ENV_ONLY. Never returned for secret rows.';
COMMENT ON COLUMN public.sys_ops_config_cf.db_value_enc IS 'Base64 AES-256-GCM envelope from HQ platform-api (master key is env-only). Never returned by any function except fn_ops_config_get_raw for in-process decryption.';
COMMENT ON COLUMN public.sys_ops_config_cf.db_value_fingerprint IS 'SHA-256 hex of the stored value, used for BOTH_MUST_MATCH comparison and change history; never a way to recover the value.';
COMMENT ON COLUMN public.sys_ops_config_cf.is_bootstrap IS 'Needed before the database is reachable (DB URL, Supabase keys, master key, JWT secrets); forced ENV_ONLY and never stored here.';
COMMENT ON COLUMN public.sys_ops_config_cf.is_wired IS 'true once application code reads the key through the config resolver; false means the registry value is not consumed yet.';
COMMENT ON COLUMN public.sys_ops_config_cf.requires_restart IS 'Whether a change takes effect only after the consuming service restarts.';
COMMENT ON COLUMN public.sys_ops_config_cf.validation_rule IS 'Optional regular expression applied by the API before storing a value.';
COMMENT ON COLUMN public.sys_ops_config_cf.manage_via IS 'Where an operator changes it: UI, HOSTING_ENV, EXTERNAL_CONSOLE, MIGRATION or GIT.';
COMMENT ON COLUMN public.sys_ops_config_cf.guidance IS 'English operator guidance for keys that cannot be fully managed in the UI.';
COMMENT ON COLUMN public.sys_ops_config_cf.guidance2 IS 'Arabic operator guidance.';
COMMENT ON COLUMN public.sys_ops_config_cf.applies_to_app IS 'Which app reads the key: PLATFORM_API, PLATFORM_WORKERS, TENANT_WEB or ALL.';
COMMENT ON COLUMN public.sys_ops_config_cf.last_check_status IS 'Last compliance result: OK, MISSING, MATCH, MISMATCH or UNCHECKABLE (env belongs to another host).';
COMMENT ON COLUMN public.sys_ops_config_cf.last_check_at IS 'When last_check_status was computed.';
COMMENT ON COLUMN public.sys_ops_config_cf.value_updated_at IS 'When the stored value or policy last changed; not bumped by compliance checks.';
COMMENT ON COLUMN public.sys_ops_config_cf.value_updated_by IS 'Operator who last changed the stored value or policy.';
COMMENT ON COLUMN public.sys_ops_config_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ops_config_cf.created_by IS 'HQ user who created the row, when known.';
COMMENT ON COLUMN public.sys_ops_config_cf.created_info IS 'Creation provenance label (migration or seed).';
COMMENT ON COLUMN public.sys_ops_config_cf.updated_at IS 'Last modification time, maintained by trigger.';
COMMENT ON COLUMN public.sys_ops_config_cf.updated_by IS 'HQ user who last modified the row, when a UUID is known.';
COMMENT ON COLUMN public.sys_ops_config_cf.updated_info IS 'Last-change provenance (function name and actor label).';
COMMENT ON COLUMN public.sys_ops_config_cf.is_active IS 'false hides the key from the screen without deleting history.';
COMMENT ON COLUMN public.sys_ops_config_cf.rec_status IS '1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.sys_ops_config_cf.rec_order IS 'Optional manual display order.';
COMMENT ON COLUMN public.sys_ops_config_cf.rec_notes IS 'Standard free-text record note.';
COMMENT ON CONSTRAINT uq_sys_ops_config_cf_key ON public.sys_ops_config_cf IS 'config_key is the API path key and change-log FK target.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_key ON public.sys_ops_config_cf IS 'Dotted lowercase identifier, at most 120 characters.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_vtype ON public.sys_ops_config_cf IS 'Allowed value types.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_pol ON public.sys_ops_config_cf IS 'Allowed source policies.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_secenc ON public.sys_ops_config_cf IS 'A secret must be encrypted (is_secret implies is_encrypted).';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_sectyp ON public.sys_ops_config_cf IS 'SECRET_STRING values are always secret.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_plain ON public.sys_ops_config_cf IS 'Encrypted rows cannot carry a plain db_value.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_enc ON public.sys_ops_config_cf IS 'Non-encrypted rows cannot carry an envelope.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_envonly ON public.sys_ops_config_cf IS 'ENV_ONLY rows never hold a stored value or fingerprint.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_boot ON public.sys_ops_config_cf IS 'Bootstrap rows are ENV_ONLY and managed in the hosting environment.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_fp ON public.sys_ops_config_cf IS 'Fingerprint is a 64-char lowercase SHA-256 hex digest.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_fpset ON public.sys_ops_config_cf IS 'A fingerprint exists exactly when a value exists.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_envnm ON public.sys_ops_config_cf IS 'Policies that consult the environment must name the variable.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_via ON public.sys_ops_config_cf IS 'Allowed manage_via values.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_app ON public.sys_ops_config_cf IS 'Allowed applies_to_app values.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_chk ON public.sys_ops_config_cf IS 'Allowed compliance-check results.';
COMMENT ON CONSTRAINT ck_sys_ops_config_cf_recst ON public.sys_ops_config_cf IS 'rec_status is 1 (active) or 0 (soft-deleted).';
COMMENT ON INDEX public.idx_sys_ops_config_cf_mod IS 'Supports the screen list grouped by module.';

-- Keep updated_at fresh using the shared trigger function created in 0038.
DROP TRIGGER IF EXISTS trg_ops_config_cf_upd_at ON public.sys_ops_config_cf;
CREATE TRIGGER trg_ops_config_cf_upd_at
  BEFORE UPDATE ON public.sys_ops_config_cf
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
COMMENT ON TRIGGER trg_ops_config_cf_upd_at ON public.sys_ops_config_cf IS 'Maintains updated_at on every update.';

-- -----------------------------------------------------------------------------
-- 2. sys_ops_config_chg_log - change history (fingerprints only, never values)
-- -----------------------------------------------------------------------------

-- Append-only record of every value or policy change. Holds SHA-256 fingerprints and
-- policy names only; a value, plaintext or ciphertext, is never written here.
CREATE TABLE IF NOT EXISTS public.sys_ops_config_chg_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity of the change record.
  config_key      TEXT NOT NULL,                               -- Registry key that changed (FK to sys_ops_config_cf.config_key).
  action          TEXT NOT NULL,                               -- SET, CLEAR or POLICY_CHANGE.
  actor           TEXT NOT NULL,                               -- HQ operator identifier that made the change.
  old_fingerprint TEXT,                                        -- SHA-256 hex of the previous value; NULL when none existed.
  new_fingerprint TEXT,                                        -- SHA-256 hex of the new value; NULL after CLEAR.
  old_policy      TEXT,                                        -- Previous source_policy for POLICY_CHANGE.
  new_policy      TEXT,                                        -- New source_policy for POLICY_CHANGE.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),          -- When the change was recorded.
  created_by      UUID,                                        -- HQ user UUID when known; the text actor column is authoritative.
  created_info    TEXT,                                        -- Writer provenance (function name).

  -- History must not vanish with a key; RESTRICT keeps it.
  CONSTRAINT fk_ops_config_chg_key FOREIGN KEY (config_key)
    REFERENCES public.sys_ops_config_cf (config_key) ON DELETE RESTRICT,
  CONSTRAINT ck_ops_config_chg_act CHECK (action IN ('SET', 'CLEAR', 'POLICY_CHANGE')),
  CONSTRAINT ck_ops_config_chg_ofp CHECK (old_fingerprint IS NULL OR old_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_ops_config_chg_nfp CHECK (new_fingerprint IS NULL OR new_fingerprint ~ '^[0-9a-f]{64}$')
);

-- Supports the per-key history view, newest first.
CREATE INDEX IF NOT EXISTS idx_ops_config_chg_key
  ON public.sys_ops_config_chg_log (config_key, created_at DESC);

COMMENT ON TABLE public.sys_ops_config_chg_log IS
  'Append-only history of config value/policy changes. Stores SHA-256 fingerprints and policy names only, never a value.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.id IS 'Surrogate identity of the change record.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.config_key IS 'Registry key that changed.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.action IS 'SET, CLEAR or POLICY_CHANGE.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.actor IS 'HQ operator identifier that made the change.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.old_fingerprint IS 'SHA-256 hex of the previous value; NULL when none existed.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.new_fingerprint IS 'SHA-256 hex of the new value; NULL after CLEAR.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.old_policy IS 'Previous source_policy for POLICY_CHANGE.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.new_policy IS 'New source_policy for POLICY_CHANGE.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.created_at IS 'When the change was recorded.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.created_by IS 'HQ user UUID when known.';
COMMENT ON COLUMN public.sys_ops_config_chg_log.created_info IS 'Writer provenance (function name).';
COMMENT ON CONSTRAINT fk_ops_config_chg_key ON public.sys_ops_config_chg_log IS 'Change belongs to a registered key; RESTRICT keeps history.';
COMMENT ON CONSTRAINT ck_ops_config_chg_act ON public.sys_ops_config_chg_log IS 'Allowed change actions.';
COMMENT ON CONSTRAINT ck_ops_config_chg_ofp ON public.sys_ops_config_chg_log IS 'Old fingerprint is a SHA-256 hex digest.';
COMMENT ON CONSTRAINT ck_ops_config_chg_nfp ON public.sys_ops_config_chg_log IS 'New fingerprint is a SHA-256 hex digest.';
COMMENT ON INDEX public.idx_ops_config_chg_key IS 'Per-key history, newest first.';

-- -----------------------------------------------------------------------------
-- 3. Access control: platform-global tables, service_role only
-- -----------------------------------------------------------------------------

-- RLS enabled with NO policies = deny for anon/authenticated. service_role bypasses RLS.
ALTER TABLE public.sys_ops_config_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ops_config_chg_log ENABLE ROW LEVEL SECURITY;

-- Explicit revoke so no client role can touch the tables even if a policy is added later by mistake.
REVOKE ALL ON public.sys_ops_config_cf FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sys_ops_config_chg_log FROM PUBLIC, anon, authenticated;
-- HQ platform-api uses the service-role client. The registry is mutated only through the functions below.
GRANT SELECT, INSERT, UPDATE ON public.sys_ops_config_cf TO service_role;
GRANT SELECT, INSERT ON public.sys_ops_config_chg_log TO service_role;

-- -----------------------------------------------------------------------------
-- 4. fn_ops_config_list - metadata for the screen (never a secret, never ciphertext)
-- -----------------------------------------------------------------------------

-- Read-only. db_value is returned only for plain, non-secret rows. The envelope column and
-- the fingerprint are never returned; is_set_db says whether any stored value exists.
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
  is_bootstrap      BOOLEAN,
  is_wired          BOOLEAN,
  requires_restart  BOOLEAN,
  validation_rule   TEXT,
  manage_via        TEXT,
  guidance          TEXT,
  guidance2         TEXT,
  applies_to_app    TEXT,
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
  'Read-only registry list for the HQ screen. Never returns secret values, ciphertext or fingerprints; db_value only for plain non-secret rows.';

-- -----------------------------------------------------------------------------
-- 5. fn_ops_config_get_raw - in-process resolver/check feed (service_role only)
-- -----------------------------------------------------------------------------

-- Returns the storage columns the HQ API needs to resolve a value or run a compliance check:
-- plain value, envelope (ciphertext) and fingerprint. Plaintext secrets never exist in the
-- database, so none can be returned. The caller (platform-api) decrypts in-process and must
-- never forward the result to a browser. p_key NULL returns every active key.
CREATE OR REPLACE FUNCTION public.fn_ops_config_get_raw(p_key TEXT DEFAULT NULL)
RETURNS TABLE (
  config_key           TEXT,
  source_policy        TEXT,
  is_secret            BOOLEAN,
  is_encrypted         BOOLEAN,
  is_bootstrap         BOOLEAN,
  value_type           TEXT,
  env_var_name         TEXT,
  applies_to_app       TEXT,
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
    AND (p_key IS NULL OR c.config_key = p_key);
$$;

COMMENT ON FUNCTION public.fn_ops_config_get_raw(TEXT) IS
  'service_role only. Storage columns (plain value, envelope, fingerprint) for the platform-api resolver and compliance check. Output must never reach a browser or a log.';

-- -----------------------------------------------------------------------------
-- 6. fn_ops_config_set - store a value (API supplies plain OR ciphertext + fingerprint)
-- -----------------------------------------------------------------------------

-- The API encrypts when is_encrypted (the database never sees the master key) and passes
-- exactly one of p_value_plain / p_value_enc plus the SHA-256 hex fingerprint of the value.
-- Returns jsonb {ok, code, message, config_key}.
-- code: UPDATED, NOT_FOUND, BOOTSTRAP_KEY, ENV_ONLY_POLICY, INVALID_FINGERPRINT, VALUE_SHAPE, VALUE_TOO_LONG.
CREATE OR REPLACE FUNCTION public.fn_ops_config_set(
  p_key         TEXT,
  p_value_plain TEXT,
  p_value_enc   TEXT,
  p_fingerprint TEXT,
  p_actor       TEXT
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
      'message', 'Bootstrap keys can only be set in the hosting environment', 'config_key', p_key);
  END IF;
  IF v_cfg.source_policy = 'ENV_ONLY' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ENV_ONLY_POLICY',
      'message', 'Policy ENV_ONLY does not allow a stored value; change the policy first', 'config_key', p_key);
  END IF;
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_FINGERPRINT',
      'message', 'Fingerprint must be a SHA-256 hex digest', 'config_key', p_key);
  END IF;

  -- Exactly the column that matches is_encrypted may be supplied.
  IF v_cfg.is_encrypted THEN
    IF p_value_enc IS NULL OR btrim(p_value_enc) = '' OR p_value_plain IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'This key is encrypted: supply the envelope only', 'config_key', p_key);
    END IF;
    IF length(p_value_enc) > 16000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
  ELSE
    IF p_value_plain IS NULL OR btrim(p_value_plain) = '' OR p_value_enc IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_SHAPE',
        'message', 'This key is plain: supply the plain value only', 'config_key', p_key);
    END IF;
    IF length(p_value_plain) > 4000 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALUE_TOO_LONG', 'message', 'Value is too long', 'config_key', p_key);
    END IF;
  END IF;

  UPDATE public.sys_ops_config_cf
  SET db_value             = CASE WHEN v_cfg.is_encrypted THEN NULL ELSE p_value_plain END,
      db_value_enc         = CASE WHEN v_cfg.is_encrypted THEN p_value_enc ELSE NULL END,
      db_value_fingerprint = p_fingerprint,
      last_check_status    = NULL,
      last_check_at        = NULL,
      value_updated_at     = now(),
      value_updated_by     = v_actor,
      updated_info         = 'fn_ops_config_set by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
  VALUES (p_key, 'SET', v_actor, v_cfg.db_value_fingerprint, p_fingerprint, 'fn_ops_config_set');

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Value stored', 'config_key', p_key);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Stores a config value supplied as plain text or as an API-produced envelope plus SHA-256 fingerprint. Rejects bootstrap keys and ENV_ONLY policy. Logs the fingerprint change only.';

-- -----------------------------------------------------------------------------
-- 7. fn_ops_config_set_policy - change the source policy
-- -----------------------------------------------------------------------------

-- DB_ONLY and BOTH_MUST_MATCH require a stored value so a policy switch cannot silently
-- leave a live key unresolved; every policy other than DB_ONLY requires env_var_name.
-- Switching to ENV_ONLY clears any stored value (no dormant secret is left behind).
-- Returns jsonb {ok, code, message, config_key, cleared_value}.
-- code: UPDATED, NOT_FOUND, BOOTSTRAP_KEY, INVALID_POLICY, NOTHING_TO_CHANGE, DB_VALUE_REQUIRED, ENV_VAR_REQUIRED.
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
  IF p_policy IS NULL OR p_policy NOT IN ('DB_ONLY', 'ENV_ONLY', 'BOTH_MUST_MATCH', 'ENV_OVERRIDES_DB') THEN
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
  'Changes the source policy of a non-bootstrap key. DB_ONLY/BOTH_MUST_MATCH require a stored value; ENV_ONLY clears any stored value. Logs the change.';

-- -----------------------------------------------------------------------------
-- 8. fn_ops_config_clear - remove the stored value
-- -----------------------------------------------------------------------------

-- Clears db_value / db_value_enc / fingerprint. Under DB_ONLY this leaves the key unset;
-- the API warns the operator. Returns jsonb {ok, code, message, config_key}.
-- code: UPDATED, NOT_FOUND, BOOTSTRAP_KEY, NOTHING_TO_CLEAR.
CREATE OR REPLACE FUNCTION public.fn_ops_config_clear(
  p_key   TEXT,
  p_actor TEXT
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
  IF v_cfg.db_value IS NULL AND v_cfg.db_value_enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CLEAR', 'message', 'No stored value', 'config_key', p_key);
  END IF;

  UPDATE public.sys_ops_config_cf
  SET db_value             = NULL,
      db_value_enc         = NULL,
      db_value_fingerprint = NULL,
      last_check_status    = NULL,
      last_check_at        = NULL,
      value_updated_at     = now(),
      value_updated_by     = v_actor,
      updated_info         = 'fn_ops_config_clear by ' || v_actor
  WHERE config_key = p_key;

  INSERT INTO public.sys_ops_config_chg_log (config_key, action, actor, old_fingerprint, new_fingerprint, created_info)
  VALUES (p_key, 'CLEAR', v_actor, v_cfg.db_value_fingerprint, NULL, 'fn_ops_config_clear');

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Value cleared', 'config_key', p_key);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_clear(TEXT, TEXT) IS
  'Clears the stored value and fingerprint of a non-bootstrap key and logs the removal (old fingerprint only).';

-- -----------------------------------------------------------------------------
-- 9. fn_ops_config_record_check - persist compliance results computed by the API
-- -----------------------------------------------------------------------------

-- Input: jsonb array of {"config_key": text, "status": text}. Only last_check_* columns are
-- touched (not value_updated_*). Unknown keys and statuses outside the CHECK vocabulary
-- are ignored/rejected by the CHECK. Returns the number of rows updated.
CREATE OR REPLACE FUNCTION public.fn_ops_config_record_check(p_results JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RETURN 0;
  END IF;

  UPDATE public.sys_ops_config_cf c
  SET last_check_status = r.status,
      last_check_at     = now(),
      updated_info      = 'fn_ops_config_record_check'
  FROM jsonb_to_recordset(p_results) AS r(config_key TEXT, status TEXT)
  WHERE c.config_key = r.config_key AND c.rec_status = 1 AND c.is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fn_ops_config_record_check(JSONB) IS
  'Persists per-key compliance statuses computed by platform-api (OK, MISSING, MATCH, MISMATCH, UNCHECKABLE). Touches last_check_* only.';

-- -----------------------------------------------------------------------------
-- 10. Function privileges: service_role only
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER functions are callable by PUBLIC by default; revoke from every client
-- role and grant only to service_role (HQ platform-api).
REVOKE ALL ON FUNCTION public.fn_ops_config_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_get_raw(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_clear(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_config_record_check(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_list() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_get_raw(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_set_policy(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_clear(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_config_record_check(JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- 11. Seed the Notification Hub keys (idempotent). Keys were found by reading the code:
--     tenant web-admin/lib/notifications/config.ts (ENV_OVERRIDE map + runtime keys) and the
--     notification route handlers; HQ platform-api notifications-hq providers/services.
--     No value is seeded: values are entered through the screen, secrets encrypted by the API.
-- -----------------------------------------------------------------------------

-- Group defaults: policy, bootstrap flag, manage_via and bilingual operator guidance.
INSERT INTO public.sys_ops_config_cf (
  config_key, module, name, name2, description, description2,
  value_type, is_secret, is_encrypted, source_policy, env_var_name,
  is_bootstrap, is_wired, requires_restart, manage_via, guidance, guidance2,
  applies_to_app, created_info
)
SELECT
  s.config_key, s.module, s.name, s.name2, s.description, s.description2,
  s.value_type, s.is_secret, s.is_secret, g.source_policy, s.env_var_name,
  g.is_bootstrap, s.is_wired, (g.is_bootstrap OR NOT s.is_wired), g.manage_via, g.guidance, g.guidance2,
  s.applies_to_app, '0612 seed'
FROM (
  VALUES
  -- ---- BOOT: bootstrap keys (never stored in the registry) ------------------------------
  ('platform.supabase.url', 'platform', 'Supabase URL (HQ API)', 'عنوان Supabase (واجهة HQ)',
   'Base URL of the Supabase project the HQ API connects to.', 'العنوان الأساسي لمشروع Supabase الذي تتصل به واجهة HQ.',
   'URL', false, 'SUPABASE_URL', 'PLATFORM_API', 'BOOT', false),
  ('platform.supabase.service_role', 'platform', 'Supabase service role key (HQ API)', 'مفتاح خدمة Supabase (واجهة HQ)',
   'Service-role key used by the HQ API to reach the database. Needed before any registry value can be read.', 'مفتاح الخدمة الذي تستخدمه واجهة HQ للوصول إلى قاعدة البيانات. مطلوب قبل قراءة أي قيمة من السجل.',
   'SECRET_STRING', true, 'SUPABASE_SERVICE_ROLE_KEY', 'PLATFORM_API', 'BOOT', false),
  ('platform.supabase.anon_key', 'platform', 'Supabase anon key (HQ API)', 'المفتاح العام لـ Supabase (واجهة HQ)',
   'Public anon key of the Supabase project.', 'المفتاح العام (anon) لمشروع Supabase.',
   'SECRET_STRING', true, 'SUPABASE_ANON_KEY', 'PLATFORM_API', 'BOOT', false),
  ('platform.supabase.jwt_secret', 'platform', 'Supabase JWT secret (HQ API)', 'سر JWT لـ Supabase (واجهة HQ)',
   'Secret Supabase uses to sign auth tokens; the HQ API verifies tokens with it.', 'السر الذي تستخدمه Supabase لتوقيع رموز المصادقة وتتحقق بها واجهة HQ.',
   'SECRET_STRING', true, 'SUPABASE_JWT_SECRET', 'PLATFORM_API', 'BOOT', false),
  ('platform.database.url', 'platform', 'Database URL (HQ API)', 'عنوان قاعدة البيانات (واجهة HQ)',
   'Direct PostgreSQL connection string.', 'سلسلة اتصال PostgreSQL المباشرة.',
   'SECRET_STRING', true, 'DATABASE_URL', 'PLATFORM_API', 'BOOT', false),
  ('platform.jwt.secret', 'platform', 'HQ JWT signing secret', 'سر توقيع JWT لـ HQ',
   'Secret that signs HQ operator session tokens.', 'السر الذي يوقع رموز جلسات مشغلي HQ.',
   'SECRET_STRING', true, 'JWT_SECRET', 'PLATFORM_API', 'BOOT', false),
  ('platform.encryption.master_key', 'platform', 'HQ encryption master key', 'مفتاح التشفير الرئيسي لـ HQ',
   'Base64 32-byte AES key that encrypts every encrypted registry value and provider credential. It can never be stored in the database it protects.', 'مفتاح AES بطول 32 بايت (Base64) يشفر كل قيمة مشفرة في السجل وبيانات المزودين. لا يمكن تخزينه في قاعدة البيانات التي يحميها.',
   'SECRET_STRING', true, 'HQ_ENCRYPTION_MASTER_KEY', 'PLATFORM_API', 'BOOT', false),
  ('platform.hq_service_role_key', 'platform', 'HQ service-to-service key (HQ side)', 'مفتاح الخدمة بين التطبيقين (جهة HQ)',
   'Bearer key the HQ API accepts from the tenant app. Must equal the tenant-side NTF_HQ_SERVICE_ROLE_KEY.', 'المفتاح الذي تقبله واجهة HQ من تطبيق المنشأة. يجب أن يطابق NTF_HQ_SERVICE_ROLE_KEY في جهة المنشأة.',
   'SECRET_STRING', true, 'HQ_SERVICE_ROLE_KEY', 'PLATFORM_API', 'BOOT', false),
  ('platform.tenant_hq_service_key', 'platform', 'HQ service-to-service key (tenant side)', 'مفتاح الخدمة بين التطبيقين (جهة المنشأة)',
   'Key the tenant app sends to HQ when proxying notification dispatch. Must equal HQ_SERVICE_ROLE_KEY on the HQ API.', 'المفتاح الذي يرسله تطبيق المنشأة إلى HQ عند تمرير الإشعارات. يجب أن يطابق HQ_SERVICE_ROLE_KEY في واجهة HQ.',
   'SECRET_STRING', true, 'NTF_HQ_SERVICE_ROLE_KEY', 'TENANT_WEB', 'BOOT', false),
  ('platform.redis.url', 'platform', 'Redis URL', 'عنوان Redis',
   'Redis connection used by the notification queue.', 'اتصال Redis الذي تستخدمه طابور الإشعارات.',
   'SECRET_STRING', true, 'REDIS_URL', 'PLATFORM_API', 'BOOT', false),
  -- ---- EXT: credentials issued by external consoles (HQ side) ---------------------------
  ('ntf.hq.resend.api_key', 'ntf', 'HQ Resend API key', 'مفتاح Resend لـ HQ',
   'Platform Resend API key used for platform-routed email and HQ password mail.', 'مفتاح Resend للمنصة المستخدم في البريد الموجه عبر المنصة وبريد كلمات مرور HQ.',
   'SECRET_STRING', true, 'HQ_RESEND_API_KEY', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.twilio.account_sid', 'ntf', 'HQ Twilio account SID', 'معرف حساب Twilio لـ HQ',
   'Platform Twilio account SID for SMS, WhatsApp and Content imports.', 'معرف حساب Twilio للمنصة للرسائل القصيرة وواتساب واستيراد القوالب.',
   'STRING', false, 'HQ_TWILIO_ACCOUNT_SID', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.twilio.auth_token', 'ntf', 'HQ Twilio auth token', 'رمز مصادقة Twilio لـ HQ',
   'Platform Twilio auth token; also verifies inbound Twilio webhooks.', 'رمز مصادقة Twilio للمنصة؛ ويستخدم أيضا للتحقق من ويب هوك Twilio.',
   'SECRET_STRING', true, 'HQ_TWILIO_AUTH_TOKEN', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.meta.app_secret', 'ntf', 'HQ Meta app secret', 'سر تطبيق Meta لـ HQ',
   'Meta app secret that verifies WhatsApp webhook signatures.', 'سر تطبيق Meta للتحقق من توقيعات ويب هوك واتساب.',
   'SECRET_STRING', true, 'HQ_META_APP_SECRET', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.meta.wa_access_token', 'ntf', 'HQ Meta WhatsApp access token', 'رمز وصول واتساب Meta لـ HQ',
   'Meta Cloud API access token for WhatsApp sends.', 'رمز وصول Meta Cloud API لإرسال واتساب.',
   'SECRET_STRING', true, 'HQ_META_WHATSAPP_ACCESS_TOKEN', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.meta.wa_phone_number_id', 'ntf', 'HQ Meta WhatsApp phone number ID', 'معرف رقم واتساب Meta لـ HQ',
   'Meta WhatsApp business phone number ID.', 'معرف رقم هاتف واتساب للأعمال في Meta.',
   'STRING', false, 'HQ_META_WHATSAPP_PHONE_NUMBER_ID', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.fcm.server_key', 'ntf', 'HQ FCM server key', 'مفتاح خادم FCM لـ HQ',
   'Firebase Cloud Messaging server key for push dispatch.', 'مفتاح خادم Firebase Cloud Messaging لإرسال الإشعارات الفورية.',
   'SECRET_STRING', true, 'HQ_FCM_SERVER_KEY', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.twilio.content_cred_ref', 'ntf', 'Twilio Content credential reference', 'مرجع بيانات اعتماد Twilio Content',
   'Approved credential_ref a platform account must carry before Content imports may use the platform Twilio credentials.', 'مرجع بيانات الاعتماد المعتمد الذي يجب أن يحمله حساب المنصة قبل السماح باستيراد Content.',
   'STRING', false, 'NTF_TWILIO_CONTENT_CREDENTIAL_REF', 'PLATFORM_API', 'EXT', false),
  ('ntf.hq.twilio.content_cred_ver', 'ntf', 'Twilio Content credential version', 'إصدار بيانات اعتماد Twilio Content',
   'Approved credential version for Content imports (optional).', 'إصدار بيانات الاعتماد المعتمد لاستيراد Content (اختياري).',
   'STRING', false, 'NTF_TWILIO_CONTENT_CREDENTIAL_VERSION', 'PLATFORM_API', 'EXT', false),
  -- ---- PLAT: HQ settings manageable here -------------------------------------------------
  ('ntf.hq.resend.from_email', 'ntf', 'HQ Resend from address', 'عنوان المرسل في Resend لـ HQ',
   'From address of platform-routed email. Wired to the config resolver: this is the reference conversion.', 'عنوان المرسل للبريد الموجه عبر المنصة. موصول بمحلل الإعدادات: هذا هو التحويل المرجعي.',
   'STRING', false, 'HQ_RESEND_FROM_EMAIL', 'PLATFORM_API', 'PLAT', true),
  ('ntf.hq.twilio.sms_from', 'ntf', 'HQ Twilio SMS from number', 'رقم المرسل للرسائل القصيرة عبر Twilio',
   'E.164 number used as the SMS sender for platform routes.', 'رقم بصيغة E.164 يستخدم كمرسل للرسائل القصيرة في مسارات المنصة.',
   'STRING', false, 'HQ_TWILIO_SMS_FROM', 'PLATFORM_API', 'PLAT', false),
  ('ntf.hq.twilio.whatsapp_from', 'ntf', 'HQ Twilio WhatsApp from number', 'رقم المرسل لواتساب عبر Twilio',
   'WhatsApp sender (whatsapp:+E.164) used when a route carries no sender address.', 'مرسل واتساب (whatsapp:+E.164) عند غياب عنوان مرسل في المسار.',
   'STRING', false, 'HQ_TWILIO_WHATSAPP_FROM', 'PLATFORM_API', 'PLAT', false),
  ('ntf.hq.twilio.webhook_url', 'ntf', 'HQ Twilio webhook URL', 'عنوان ويب هوك Twilio لـ HQ',
   'Public URL Twilio calls; part of the signature it is verified against.', 'العنوان العام الذي تستدعيه Twilio، وهو جزء من التوقيع الذي يتم التحقق منه.',
   'URL', false, 'HQ_TWILIO_WEBHOOK_URL', 'PLATFORM_API', 'PLAT', false),
  ('ntf.hq.queue_enabled', 'ntf', 'HQ notification queue enabled', 'تفعيل طابور إشعارات HQ',
   'true enables the BullMQ notification queue (needs Redis).', 'القيمة true تفعل طابور BullMQ للإشعارات (يتطلب Redis).',
   'BOOLEAN', false, 'NTF_QUEUE_ENABLED', 'PLATFORM_API', 'PLAT', false),
  -- ---- TENSEC: secrets read by the tenant app from its environment -----------------------
  ('ntf.app.outbox_secret', 'ntf', 'Notification outbox secret', 'سر صندوق الإشعارات',
   'Bearer secret the process-outbox, campaigns and reconcile endpoints require from pg_cron. Must equal sys_ntf_runtime_cf outbox_secret_key / app.outbox_secret_key.', 'السر الذي تتطلبه نقاط معالجة الصندوق والحملات والمطابقة من pg_cron. يجب أن يطابق outbox_secret_key في sys_ntf_runtime_cf.',
   'SECRET_STRING', true, 'NOTIFICATIONS_OUTBOX_SECRET', 'TENANT_WEB', 'TENSEC', false),
  ('ntf.app.resend.webhook_secret', 'ntf', 'Resend webhook signing secret', 'سر توقيع ويب هوك Resend',
   'whsec_ secret from the Resend webhook page; every Resend callback is rejected without it.', 'السر whsec_ من صفحة ويب هوك Resend؛ يرفض كل نداء من Resend بدونه.',
   'SECRET_STRING', true, 'RESEND_WEBHOOK_SECRET', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.resend.api_key', 'ntf', 'Tenant app Resend API key', 'مفتاح Resend لتطبيق المنشأة',
   'Resend API key used by the tenant app for direct email sends.', 'مفتاح Resend الذي يستخدمه تطبيق المنشأة للإرسال المباشر.',
   'SECRET_STRING', true, 'RESEND_API_KEY', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.twilio.account_sid', 'ntf', 'Tenant app Twilio account SID', 'معرف حساب Twilio لتطبيق المنشأة',
   'Twilio account SID used by the tenant app.', 'معرف حساب Twilio الذي يستخدمه تطبيق المنشأة.',
   'STRING', false, 'TWILIO_ACCOUNT_SID', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.twilio.auth_token', 'ntf', 'Tenant app Twilio auth token', 'رمز مصادقة Twilio لتطبيق المنشأة',
   'Twilio auth token used by the tenant app.', 'رمز مصادقة Twilio الذي يستخدمه تطبيق المنشأة.',
   'SECRET_STRING', true, 'TWILIO_AUTH_TOKEN', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.meta.wa_access_token', 'ntf', 'Tenant app Meta WhatsApp access token', 'رمز وصول واتساب Meta لتطبيق المنشأة',
   'Meta Cloud API access token used by the tenant app.', 'رمز وصول Meta Cloud API الذي يستخدمه تطبيق المنشأة.',
   'SECRET_STRING', true, 'META_WHATSAPP_ACCESS_TOKEN', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.meta.wa_phone_number_id', 'ntf', 'Tenant app Meta WhatsApp phone number ID', 'معرف رقم واتساب Meta لتطبيق المنشأة',
   'Meta WhatsApp business phone number ID used by the tenant app.', 'معرف رقم واتساب للأعمال في Meta الذي يستخدمه تطبيق المنشأة.',
   'STRING', false, 'META_WHATSAPP_PHONE_NUMBER_ID', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.vapid.private_key', 'ntf', 'Web push VAPID private key', 'المفتاح الخاص VAPID للإشعارات الفورية',
   'Private VAPID key for browser web push.', 'المفتاح الخاص VAPID لإشعارات المتصفح الفورية.',
   'SECRET_STRING', true, 'VAPID_PRIVATE_KEY', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.vapid.public_key', 'ntf', 'Web push VAPID public key', 'المفتاح العام VAPID للإشعارات الفورية',
   'Public VAPID key served to browsers.', 'المفتاح العام VAPID الذي يقدم للمتصفحات.',
   'STRING', false, 'VAPID_PUBLIC_KEY', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.vapid.subject', 'ntf', 'Web push VAPID subject', 'موضوع VAPID للإشعارات الفورية',
   'mailto: or https: contact URI sent with web push.', 'عنوان mailto: أو https: للتواصل يرسل مع الإشعارات الفورية.',
   'STRING', false, 'VAPID_SUBJECT', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.onesignal.rest_api_key', 'ntf', 'OneSignal REST API key', 'مفتاح OneSignal REST',
   'OneSignal REST API key for mobile push.', 'مفتاح OneSignal REST للإشعارات الفورية للجوال.',
   'SECRET_STRING', true, 'ONESIGNAL_REST_API_KEY', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.onesignal.app_id', 'ntf', 'OneSignal app ID', 'معرف تطبيق OneSignal',
   'OneSignal application ID.', 'معرف تطبيق OneSignal.',
   'STRING', false, 'ONESIGNAL_APP_ID', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.fcm.service_account', 'ntf', 'FCM service account JSON', 'ملف حساب خدمة FCM',
   'Firebase service-account JSON for FCM sends.', 'ملف JSON لحساب خدمة Firebase لإرسال FCM.',
   'SECRET_STRING', true, 'FCM_SERVICE_ACCOUNT_JSON', 'TENANT_WEB', 'EXT', false),
  ('ntf.app.fcm.project_id', 'ntf', 'FCM project ID', 'معرف مشروع FCM',
   'Firebase project ID.', 'معرف مشروع Firebase.',
   'STRING', false, 'FCM_PROJECT_ID', 'TENANT_WEB', 'EXT', false),
  -- ---- TEN: tenant runtime flags (today: sys_ntf_runtime_cf, env wins) -------------------
  ('ntf.app.whatsapp_fallback_email', 'ntf', 'WhatsApp falls back to email', 'الرجوع إلى البريد عند تعذر واتساب',
   'Tenant runtime flag whatsapp_fallback_email: when true, WhatsApp deliveries fall back to the customer email.', 'مفتاح تشغيل whatsapp_fallback_email: عند true يتم الرجوع إلى بريد العميل عند تعذر واتساب.',
   'BOOLEAN', false, 'NTF_WHATSAPP_FALLBACK_EMAIL', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.order_transition_notify', 'ntf', 'Legacy order transition notify', 'إشعار انتقال الطلب القديم',
   'Tenant runtime flag order_transition_notify for the legacy transition notify path.', 'مفتاح التشغيل order_transition_notify لمسار إشعار الانتقال القديم.',
   'BOOLEAN', false, 'NTF_ORDER_TRANSITION_NOTIFY', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.outbox_inline_dispatch', 'ntf', 'Inline outbox dispatch', 'الإرسال المباشر من الصندوق',
   'Tenant runtime flag outbox_inline_dispatch: dispatch WhatsApp outbox rows in-process instead of waiting for pg_cron.', 'مفتاح التشغيل outbox_inline_dispatch: إرسال صفوف واتساب مباشرة بدل انتظار pg_cron.',
   'BOOLEAN', false, 'NTF_OUTBOX_INLINE_DISPATCH', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.dispatch_via_hq', 'ntf', 'Dispatch through HQ', 'الإرسال عبر HQ',
   'Tenant runtime flag ntf_dispatch_via_hq: send EMAIL/SMS/WHATSAPP/PUSH through the HQ dispatch proxy.', 'مفتاح التشغيل ntf_dispatch_via_hq: إرسال البريد والرسائل وواتساب والإشعارات الفورية عبر وسيط HQ.',
   'BOOLEAN', false, 'NTF_DISPATCH_VIA_HQ', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.hq_dispatch_url', 'ntf', 'HQ dispatch URL', 'عنوان إرسال HQ',
   'Tenant runtime key ntf_hq_dispatch_url: URL of the generic HQ dispatch proxy.', 'مفتاح التشغيل ntf_hq_dispatch_url: عنوان وسيط الإرسال العام في HQ.',
   'URL', false, 'NTF_HQ_DISPATCH_URL', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.hq_route_dispatch_url', 'ntf', 'HQ route dispatch URL', 'عنوان إرسال HQ حسب المسار',
   'Tenant runtime key ntf_hq_route_dispatch_url: URL of the route-aware WhatsApp dispatch.', 'مفتاح التشغيل ntf_hq_route_dispatch_url: عنوان إرسال واتساب المعتمد على المسار.',
   'URL', false, 'NTF_HQ_ROUTE_DISPATCH_URL', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.resend_from_email', 'ntf', 'Tenant app Resend from address', 'عنوان المرسل في Resend لتطبيق المنشأة',
   'Tenant runtime key resend_from_email: From address of tenant-app email.', 'مفتاح التشغيل resend_from_email: عنوان المرسل لبريد تطبيق المنشأة.',
   'STRING', false, 'RESEND_FROM_EMAIL', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.twilio_sms_from', 'ntf', 'Tenant app Twilio SMS from number', 'رقم المرسل للرسائل القصيرة لتطبيق المنشأة',
   'Tenant runtime key twilio_sms_from (E.164).', 'مفتاح التشغيل twilio_sms_from (بصيغة E.164).',
   'STRING', false, 'TWILIO_SMS_FROM', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.twilio_whatsapp_from', 'ntf', 'Tenant app Twilio WhatsApp from number', 'رقم المرسل لواتساب لتطبيق المنشأة',
   'Tenant runtime key twilio_whatsapp_from (whatsapp:+E.164).', 'مفتاح التشغيل twilio_whatsapp_from (whatsapp:+E.164).',
   'STRING', false, 'TWILIO_WHATSAPP_FROM', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.wa_use_sandbox_template', 'ntf', 'WhatsApp sandbox template mode', 'وضع قالب بيئة تجربة واتساب',
   'Tenant runtime key wa_use_sandbox_template: send through the Twilio Content API sandbox template.', 'مفتاح التشغيل wa_use_sandbox_template: الإرسال عبر قالب Twilio Content في بيئة التجربة.',
   'BOOLEAN', false, 'TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.wa_sandbox_content_sid', 'ntf', 'WhatsApp sandbox content SID', 'معرف محتوى بيئة تجربة واتساب',
   'Tenant runtime key wa_sandbox_content_sid.', 'مفتاح التشغيل wa_sandbox_content_sid.',
   'STRING', false, 'TWILIO_WHATSAPP_SANDBOX_CONTENT_SID', 'TENANT_WEB', 'TEN', false),
  ('ntf.app.wa_sandbox_to_phone', 'ntf', 'WhatsApp sandbox destination', 'وجهة بيئة تجربة واتساب',
   'Tenant runtime key wa_sandbox_to_phone: optional fixed sandbox recipient.', 'مفتاح التشغيل wa_sandbox_to_phone: مستلم ثابت اختياري لبيئة التجربة.',
   'STRING', false, 'TWILIO_WHATSAPP_SANDBOX_TO', 'TENANT_WEB', 'TEN', false)
) AS s(config_key, module, name, name2, description, description2,
       value_type, is_secret, env_var_name, applies_to_app, grp, is_wired)
JOIN (
  VALUES
  ('BOOT', 'ENV_ONLY', true, 'HOSTING_ENV',
   'Bootstrap value: the app needs it before it can reach the database, so it can never be stored in this registry. Set it in the hosting environment (for example Render environment variables) and restart the service.',
   'قيمة تمهيدية: يحتاجها التطبيق قبل أن يصل إلى قاعدة البيانات، لذلك لا يمكن تخزينها في هذا السجل. اضبطها في بيئة الاستضافة (مثل متغيرات بيئة Render) ثم أعد تشغيل الخدمة.'),
  ('EXT', 'ENV_OVERRIDES_DB', false, 'EXTERNAL_CONSOLE',
   'Credential issued by an external console (Resend, Twilio, Meta, Firebase). Generate or rotate it there, then set it here or in the hosting environment. The hosting environment variable still wins until the key is converted.',
   'بيانات اعتماد تصدر من لوحة جهة خارجية (Resend أو Twilio أو Meta أو Firebase). أنشئها أو دوّرها هناك ثم اضبطها هنا أو في بيئة الاستضافة. يبقى متغير بيئة الاستضافة هو الأعلى أولوية حتى يتم تحويل المفتاح.'),
  ('PLAT', 'ENV_OVERRIDES_DB', false, 'UI',
   'Platform setting managed from this screen. Until the consuming code is converted to the config resolver, the hosting environment variable is what the app reads.',
   'إعداد للمنصة يدار من هذه الشاشة. إلى أن يتم تحويل الكود المستهلك إلى محلل الإعدادات، يبقى متغير بيئة الاستضافة هو ما يقرؤه التطبيق.'),
  ('TEN', 'ENV_OVERRIDES_DB', false, 'UI',
   'Tenant app runtime key. Today the tenant app reads it from sys_ntf_runtime_cf with the environment variable taking precedence. A value stored here is NOT consumed by the tenant app until that read is converted to the resolver.',
   'مفتاح تشغيل لتطبيق المنشأة. حاليا يقرؤه التطبيق من sys_ntf_runtime_cf مع أولوية لمتغير البيئة. القيمة المخزنة هنا لا يستهلكها التطبيق إلى أن يتم تحويل القراءة إلى المحلل.'),
  ('TENSEC', 'ENV_OVERRIDES_DB', false, 'HOSTING_ENV',
   'Secret the tenant app reads from its hosting environment. It must equal its counterpart (see description). Rotate it in the hosting environment; a value stored here is NOT consumed until the read is converted.',
   'سر يقرؤه تطبيق المنشأة من بيئة الاستضافة. يجب أن يطابق نظيره (راجع الوصف). دوّره في بيئة الاستضافة؛ القيمة المخزنة هنا لا تستهلك قبل تحويل القراءة.')
) AS g(grp, source_policy, is_bootstrap, manage_via, guidance, guidance2) ON g.grp = s.grp
ON CONFLICT (config_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 12. HQ permissions (same pattern as hq_ops:read / hq_ops:manage_jobs in 0610)
-- -----------------------------------------------------------------------------

-- Catalog rows only. SUPER_ADMIN already holds the global "*" grant and therefore covers
-- both codes. No other role is granted here (most conservative); manage_secrets is
-- deliberately separate so editing a non-secret setting never implies writing a secret.
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0612 ops config registry'
FROM (
  VALUES
    ('hq_ops:manage_config', 'Manage platform configuration', 'إدارة إعدادات المنصة'),
    ('hq_ops:manage_secrets', 'Manage platform secrets', 'إدارة أسرار المنصة')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

COMMIT;
