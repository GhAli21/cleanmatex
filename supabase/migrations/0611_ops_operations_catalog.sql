-- =============================================================================
-- Migration: 0611_ops_operations_catalog.sql
-- STATUS:    CREATED, NOT APPLIED. Review and apply manually (local + remote).
--            This file is never executed by the agent.
-- Purpose:   Platform Operations Console P2 - Curated Operations Catalog.
--            Replaces hand-delivered SQL with a reviewed catalog: every operation shows
--            its EXACT SQL, description and guidance; operations marked RUN_IN_UI can be
--            executed from the HQ screen by code (never by caller-supplied SQL), the rest
--            are COPY_ONLY (copy the text and run it yourself) or GUIDE_ONLY (steps).
-- Affected:  NEW sys_ops_operation_cf, sys_ops_operation_run_dtl,
--            fn_ops_operation_list, fn_ops_operation_run, fn_ops_operation_log,
--            hq_permissions (2 new codes: hq_ops:run_operations, hq_ops:run_destructive),
--            seed of 11 catalog operations.
-- Related:   0610_ops_job_registry.sql (P1 pattern, hq_ops:read), 0602 (HQ RBAC seed pattern).
-- Safety:    * The API/UI can only pass an operation CODE plus typed parameters. The SQL
--              text is read from sys_ops_operation_cf by fn_ops_operation_run.
--            * Parameters are validated and cast against param_schema, then bound with
--              EXECUTE ... USING ($1..$6). The stored SQL is never concatenated with
--              caller input.
--            * Only exec_mode RUN_IN_UI rows are executable. CHECK constraints guarantee
--              that such rows contain no DDL/GRANT keywords, no statement separator, no
--              comments, start with SELECT/WITH/INSERT/UPDATE/DELETE, and are never
--              manage_via MIGRATION. Migrations can only be COPY_ONLY/GUIDE_ONLY.
--            * READ operations run inside a sub-transaction with transaction_read_only
--              on, and the sub-transaction is always rolled back.
--            * Any RUN_IN_UI SQL that touches org_* tables must set requires_tenant, which
--              forces a required uuid parameter named tenant_org_id and a visible
--              tenant_org_id reference in the SQL text.
--            * Results are capped at 200 returned rows. The function never raises to the
--              caller; it returns a structured jsonb result. Every attempt is logged in
--              sys_ops_operation_run_dtl.
--            * All functions are SECURITY DEFINER, pinned search_path, EXECUTE granted
--              to service_role only.
-- Authoring convention for RUN_IN_UI SQL (see operations_catalog_guide.md):
--              placeholders are $1..$n in param_schema order; every placeholder is bound
--              as TEXT, so cast explicitly ($1::uuid, $2::int, $3::boolean); write
--              operations must end in RETURNING; one statement, no semicolon, no comments.
-- Reversal:  Forward-only. To retire:
--            DROP FUNCTION IF EXISTS public.fn_ops_operation_run(TEXT, JSONB, TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_operation_list();
--            DROP FUNCTION IF EXISTS public.fn_ops_operation_log(TEXT, TEXT, JSONB, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ);
--            DROP TABLE IF EXISTS public.sys_ops_operation_run_dtl;
--            DROP TABLE IF EXISTS public.sys_ops_operation_cf;
--            DELETE FROM hq_permissions WHERE permission_code IN
--              ('hq_ops:run_operations','hq_ops:run_destructive');
--            (RESTRICT semantics only; no CASCADE is used or needed.)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. sys_ops_operation_cf - curated operations catalog
-- -----------------------------------------------------------------------------

-- Platform-global (no tenant data) catalog of operator operations. Rows are written by
-- migrations only; the HQ API has no endpoint that inserts or edits them.
CREATE TABLE IF NOT EXISTS public.sys_ops_operation_cf (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity; API addresses operations by operation_code.
  operation_code TEXT NOT NULL,                               -- Stable operator-facing code (for example ntf.pilot_test_message).
  title          TEXT NOT NULL,                               -- English title.
  title2         TEXT,                                        -- Arabic title.
  description    TEXT,                                        -- English description: what it does, when to use it, side effects.
  description2   TEXT,                                        -- Arabic description.
  module         TEXT NOT NULL,                               -- Owning product module (ntf, ops, fin, ...), used for filtering.
  category       TEXT NOT NULL,                               -- Functional grouping (DIAGNOSTICS, PILOT, SETUP, CLEANUP, ...).
  risk           TEXT NOT NULL,                               -- READ (no change), WRITE (changes data, confirm dialog), DESTRUCTIVE (typed phrase + extra permission).
  exec_mode      TEXT NOT NULL,                               -- RUN_IN_UI (executable from HQ), COPY_ONLY (operator copies text), GUIDE_ONLY (steps only).
  sql_text       TEXT,                                        -- EXACT text shown to the operator; for RUN_IN_UI it is the statement executed with $1..$n bound as TEXT.
  param_schema   JSONB NOT NULL DEFAULT '[]'::jsonb,          -- Array (max 6) of {name,type(text|uuid|int|bool|timestamp),required,label,label2,description}; order defines $1..$n.
  verify_sql     TEXT,                                        -- Optional read-only SQL (display only) to confirm the effect.
  guidance_md    TEXT,                                        -- English step-by-step guidance (markdown).
  guidance_md2   TEXT,                                        -- Arabic step-by-step guidance (markdown).
  manage_via     TEXT NOT NULL DEFAULT 'UI',                  -- Where the change is really made: UI, HOSTING_ENV, EXTERNAL_CONSOLE, MIGRATION or GIT.
  requires_tenant BOOLEAN NOT NULL DEFAULT false,             -- true when the SQL touches tenant data; forces a required uuid tenant_org_id parameter.
  confirm_phrase TEXT,                                        -- Exact phrase the operator must type for DESTRUCTIVE operations.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Row creation time.
  created_by     UUID,                                        -- User who created the row, when known.
  created_info   TEXT,                                        -- Creation provenance (migration/seed label).
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Last modification time (maintained by trigger).
  updated_by     UUID,                                        -- User who last modified the row, when known.
  updated_info   TEXT,                                        -- Last-change provenance.
  is_active      BOOLEAN NOT NULL DEFAULT true,               -- false hides the operation without deleting history.
  rec_status     SMALLINT NOT NULL DEFAULT 1,                 -- 1=active, 0=soft-deleted (never hard-delete).
  rec_order      INTEGER,                                     -- Optional manual display order.
  rec_notes      TEXT,                                        -- Standard free-text record note.

  -- operation_code is the API path key and the run-log FK target.
  CONSTRAINT uq_ops_op_code UNIQUE (operation_code),
  -- Lowercase code shape, safe for URL path segments.
  CONSTRAINT ck_ops_op_code CHECK (operation_code ~ '^[a-z0-9][a-z0-9_.-]{2,63}$'),
  CONSTRAINT ck_ops_op_risk CHECK (risk IN ('READ', 'WRITE', 'DESTRUCTIVE')),
  CONSTRAINT ck_ops_op_mode CHECK (exec_mode IN ('RUN_IN_UI', 'COPY_ONLY', 'GUIDE_ONLY')),
  CONSTRAINT ck_ops_op_via CHECK (manage_via IN ('UI', 'HOSTING_ENV', 'EXTERNAL_CONSOLE', 'MIGRATION', 'GIT')),
  CONSTRAINT ck_ops_op_recst CHECK (rec_status IN (0, 1)),
  -- Everything except pure guidance must carry the text that is shown/copied/run.
  CONSTRAINT ck_ops_op_sqlreq CHECK (exec_mode = 'GUIDE_ONLY' OR sql_text IS NOT NULL),
  -- Hard guarantee: migrations (DDL) can never be executed from the UI.
  CONSTRAINT ck_ops_op_mig CHECK (manage_via <> 'MIGRATION' OR exec_mode <> 'RUN_IN_UI'),
  -- Defensive keyword guard: executable SQL contains no DDL/privilege keywords.
  CONSTRAINT ck_ops_op_ddl CHECK (
    exec_mode <> 'RUN_IN_UI'
    OR sql_text !~* '\m(create|alter|drop|truncate|grant|revoke)\M'
  ),
  -- Executable SQL is exactly one statement: no separator, no comments, known leading verb.
  CONSTRAINT ck_ops_op_stmt CHECK (
    exec_mode <> 'RUN_IN_UI'
    OR (
      sql_text !~ ';'
      AND sql_text !~ '(--|/\*)'
      AND sql_text ~* '^\s*(select|with|insert|update|delete)\M'
    )
  ),
  -- Write/destructive executable SQL must return the affected rows (drives row_count and the result table).
  CONSTRAINT ck_ops_op_ret CHECK (
    exec_mode <> 'RUN_IN_UI'
    OR risk = 'READ'
    OR sql_text ~* '\mreturning\M'
  ),
  -- READ operations are plain queries: SELECT/WITH only and no write keywords.
  CONSTRAINT ck_ops_op_ro CHECK (
    risk <> 'READ'
    OR sql_text IS NULL
    OR (sql_text ~* '^\s*(select|with)\M' AND sql_text !~* '\m(insert|update|delete|merge|call|copy)\M')
  ),
  -- Executable SQL that references org_* tables must be tenant-scoped (required tenant_org_id parameter).
  CONSTRAINT ck_ops_op_org CHECK (
    exec_mode <> 'RUN_IN_UI'
    OR sql_text !~* '\morg_[a-z0-9_]+'
    OR requires_tenant
  ),
  -- Tenant-scoped operations must declare tenant_org_id as a required typed uuid parameter and reference it in the SQL.
  CONSTRAINT ck_ops_op_tenant CHECK (
    NOT requires_tenant
    OR (
      param_schema @> '[{"name":"tenant_org_id","type":"uuid","required":true}]'::jsonb
      AND sql_text ~* 'tenant_org_id'
    )
  ),
  -- Parameter schema is an array of at most six entries ($1..$6).
  CONSTRAINT ck_ops_op_params CHECK (jsonb_typeof(param_schema) = 'array' AND jsonb_array_length(param_schema) <= 6),
  -- DESTRUCTIVE operations need a typed confirmation phrase.
  CONSTRAINT ck_ops_op_confirm CHECK (
    risk <> 'DESTRUCTIVE'
    OR (confirm_phrase IS NOT NULL AND length(btrim(confirm_phrase)) >= 3)
  )
);

-- Supports the catalog list filtered by module/risk (HQ screen filters).
CREATE INDEX IF NOT EXISTS idx_ops_op_mod_risk
  ON public.sys_ops_operation_cf (module, risk);

COMMENT ON TABLE public.sys_ops_operation_cf IS
  'Platform-global curated catalog of operator operations. Rows are maintained by migrations only. RUN_IN_UI rows are executed by fn_ops_operation_run by code with bound parameters; COPY_ONLY/GUIDE_ONLY rows are displayed only.';
COMMENT ON COLUMN public.sys_ops_operation_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ops_operation_cf.operation_code IS 'Stable operator-facing code; API path key and run-log FK target.';
COMMENT ON COLUMN public.sys_ops_operation_cf.title IS 'English title.';
COMMENT ON COLUMN public.sys_ops_operation_cf.title2 IS 'Arabic title.';
COMMENT ON COLUMN public.sys_ops_operation_cf.description IS 'English description: what it does, when to use it, side effects.';
COMMENT ON COLUMN public.sys_ops_operation_cf.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_ops_operation_cf.module IS 'Owning product module (ntf, ops, ...), used for filtering.';
COMMENT ON COLUMN public.sys_ops_operation_cf.category IS 'Functional grouping (DIAGNOSTICS, PILOT, SETUP, CLEANUP, ...).';
COMMENT ON COLUMN public.sys_ops_operation_cf.risk IS 'READ (no change), WRITE (changes data; confirm dialog), DESTRUCTIVE (typed phrase and hq_ops:run_destructive).';
COMMENT ON COLUMN public.sys_ops_operation_cf.exec_mode IS 'RUN_IN_UI (executable from HQ), COPY_ONLY (operator copies the text), GUIDE_ONLY (steps only).';
COMMENT ON COLUMN public.sys_ops_operation_cf.sql_text IS 'Exact text shown to the operator. For RUN_IN_UI it is the single statement executed with $1..$n bound as TEXT (cast explicitly).';
COMMENT ON COLUMN public.sys_ops_operation_cf.param_schema IS 'Array (max 6) of {name,type text|uuid|int|bool|timestamp,required,label,label2,description}; array order defines $1..$n.';
COMMENT ON COLUMN public.sys_ops_operation_cf.verify_sql IS 'Optional read-only SQL, display only, to confirm the effect of the operation.';
COMMENT ON COLUMN public.sys_ops_operation_cf.guidance_md IS 'English step-by-step guidance (markdown).';
COMMENT ON COLUMN public.sys_ops_operation_cf.guidance_md2 IS 'Arabic step-by-step guidance (markdown).';
COMMENT ON COLUMN public.sys_ops_operation_cf.manage_via IS 'Where the change is really made: UI, HOSTING_ENV, EXTERNAL_CONSOLE, MIGRATION or GIT.';
COMMENT ON COLUMN public.sys_ops_operation_cf.requires_tenant IS 'true when the SQL touches tenant data; forces a required uuid tenant_org_id parameter referenced in the SQL.';
COMMENT ON COLUMN public.sys_ops_operation_cf.confirm_phrase IS 'Exact phrase the operator must type to run a DESTRUCTIVE operation.';
COMMENT ON COLUMN public.sys_ops_operation_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ops_operation_cf.created_by IS 'User who created the row, when known.';
COMMENT ON COLUMN public.sys_ops_operation_cf.created_info IS 'Creation provenance label (migration or seed).';
COMMENT ON COLUMN public.sys_ops_operation_cf.updated_at IS 'Last modification time, maintained by trigger.';
COMMENT ON COLUMN public.sys_ops_operation_cf.updated_by IS 'User who last modified the row, when known.';
COMMENT ON COLUMN public.sys_ops_operation_cf.updated_info IS 'Last-change provenance.';
COMMENT ON COLUMN public.sys_ops_operation_cf.is_active IS 'false hides the operation without deleting history.';
COMMENT ON COLUMN public.sys_ops_operation_cf.rec_status IS '1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.sys_ops_operation_cf.rec_order IS 'Optional manual display order.';
COMMENT ON COLUMN public.sys_ops_operation_cf.rec_notes IS 'Standard free-text record note.';
COMMENT ON CONSTRAINT uq_ops_op_code ON public.sys_ops_operation_cf IS 'operation_code is the API path key and run-log FK target.';
COMMENT ON CONSTRAINT ck_ops_op_code ON public.sys_ops_operation_cf IS 'Lowercase URL-safe code shape.';
COMMENT ON CONSTRAINT ck_ops_op_risk ON public.sys_ops_operation_cf IS 'Allowed risk tiers.';
COMMENT ON CONSTRAINT ck_ops_op_mode ON public.sys_ops_operation_cf IS 'Allowed execution modes.';
COMMENT ON CONSTRAINT ck_ops_op_via ON public.sys_ops_operation_cf IS 'Allowed management channels.';
COMMENT ON CONSTRAINT ck_ops_op_recst ON public.sys_ops_operation_cf IS 'rec_status is 1 (active) or 0 (soft-deleted).';
COMMENT ON CONSTRAINT ck_ops_op_sqlreq ON public.sys_ops_operation_cf IS 'Everything except GUIDE_ONLY must carry sql_text.';
COMMENT ON CONSTRAINT ck_ops_op_mig ON public.sys_ops_operation_cf IS 'Migrations can never be RUN_IN_UI (CLAUDE.md: migrations are never applied by tooling).';
COMMENT ON CONSTRAINT ck_ops_op_ddl ON public.sys_ops_operation_cf IS 'Executable SQL contains no CREATE/ALTER/DROP/TRUNCATE/GRANT/REVOKE.';
COMMENT ON CONSTRAINT ck_ops_op_stmt ON public.sys_ops_operation_cf IS 'Executable SQL is one statement: no semicolon, no comments, known leading verb.';
COMMENT ON CONSTRAINT ck_ops_op_ret ON public.sys_ops_operation_cf IS 'Executable write SQL must RETURN the affected rows.';
COMMENT ON CONSTRAINT ck_ops_op_ro ON public.sys_ops_operation_cf IS 'READ operations are SELECT/WITH with no write keywords.';
COMMENT ON CONSTRAINT ck_ops_op_org ON public.sys_ops_operation_cf IS 'Executable SQL touching org_* tables must set requires_tenant.';
COMMENT ON CONSTRAINT ck_ops_op_tenant ON public.sys_ops_operation_cf IS 'requires_tenant forces a required uuid tenant_org_id parameter referenced in the SQL.';
COMMENT ON CONSTRAINT ck_ops_op_params ON public.sys_ops_operation_cf IS 'param_schema is an array of at most six parameters.';
COMMENT ON CONSTRAINT ck_ops_op_confirm ON public.sys_ops_operation_cf IS 'DESTRUCTIVE operations carry a typed confirmation phrase.';
COMMENT ON INDEX public.idx_ops_op_mod_risk IS 'Supports the catalog list filtered by module and risk.';

-- Keep updated_at fresh using the shared trigger function created in 0038.
DROP TRIGGER IF EXISTS trg_ops_op_cf_upd_at ON public.sys_ops_operation_cf;
CREATE TRIGGER trg_ops_op_cf_upd_at
  BEFORE UPDATE ON public.sys_ops_operation_cf
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
COMMENT ON TRIGGER trg_ops_op_cf_upd_at ON public.sys_ops_operation_cf IS 'Maintains updated_at on every update.';

-- -----------------------------------------------------------------------------
-- 2. sys_ops_operation_run_dtl - append-only attempt log
-- -----------------------------------------------------------------------------

-- Every execution attempt of a RUN_IN_UI operation, including rejected ones (bad
-- parameters, missing confirmation). Parameter values are recorded truncated; no
-- parameter type can carry a secret.
CREATE TABLE IF NOT EXISTS public.sys_ops_operation_run_dtl (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity of the attempt.
  operation_code TEXT NOT NULL,                               -- Catalog operation (FK to sys_ops_operation_cf.operation_code).
  actor          TEXT,                                        -- HQ operator identifier.
  params         JSONB NOT NULL DEFAULT '{}'::jsonb,          -- Sanitised parameter values (strings truncated to 200 chars, nested values replaced by a marker).
  outcome        TEXT NOT NULL,                               -- SUCCESS, FAILED (database error) or REJECTED (validation/confirmation failure).
  error_code     TEXT,                                        -- Structured reason for FAILED/REJECTED (INVALID_PARAMS, CONFIRM_REQUIRED, FAILED, ...).
  row_count      BIGINT,                                      -- Rows returned/affected for SUCCESS; NULL otherwise.
  message        TEXT,                                        -- Short result or error text (max 500 chars); never SQL text or secrets.
  started_at     TIMESTAMPTZ NOT NULL,                        -- When the attempt started.
  finished_at    TIMESTAMPTZ,                                 -- When the attempt ended.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),          -- When this log row was written.
  created_by     UUID,                                        -- HQ user UUID when known; the text actor is authoritative for display.
  created_info   TEXT,                                        -- Writer provenance (function name).

  -- Operation must exist; RESTRICT keeps history when someone tries to remove a catalog row.
  CONSTRAINT fk_ops_oprun_op FOREIGN KEY (operation_code)
    REFERENCES public.sys_ops_operation_cf (operation_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ops_oprun_out CHECK (outcome IN ('SUCCESS', 'FAILED', 'REJECTED'))
);

-- Supports the per-operation history (latest first) and the last-run lookup in fn_ops_operation_list.
CREATE INDEX IF NOT EXISTS idx_ops_oprun_op_start
  ON public.sys_ops_operation_run_dtl (operation_code, started_at DESC);

COMMENT ON TABLE public.sys_ops_operation_run_dtl IS
  'Append-only log of every execution attempt of a catalog operation (success, failure, rejection) with sanitised parameters.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.id IS 'Surrogate identity of the attempt.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.operation_code IS 'Catalog operation attempted.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.actor IS 'HQ operator identifier.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.params IS 'Sanitised parameter values; strings truncated to 200 characters.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.outcome IS 'SUCCESS, FAILED (database error) or REJECTED (validation or confirmation failure).';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.error_code IS 'Structured reason for FAILED/REJECTED.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.row_count IS 'Rows returned/affected on SUCCESS.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.message IS 'Short result or error text; never SQL text or secrets.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.started_at IS 'When the attempt started.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.finished_at IS 'When the attempt ended.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.created_at IS 'When this log row was written.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.created_by IS 'HQ user UUID when known.';
COMMENT ON COLUMN public.sys_ops_operation_run_dtl.created_info IS 'Writer provenance (function name).';
COMMENT ON CONSTRAINT fk_ops_oprun_op ON public.sys_ops_operation_run_dtl IS 'Attempt belongs to a catalog operation; RESTRICT keeps history.';
COMMENT ON CONSTRAINT ck_ops_oprun_out ON public.sys_ops_operation_run_dtl IS 'Allowed attempt outcomes.';
COMMENT ON INDEX public.idx_ops_oprun_op_start IS 'Per-operation history and last-run lookup, newest first.';

-- -----------------------------------------------------------------------------
-- 3. Access control: platform-global tables, service_role only
-- -----------------------------------------------------------------------------

-- RLS enabled with NO policies = deny for anon/authenticated. service_role bypasses RLS.
ALTER TABLE public.sys_ops_operation_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ops_operation_run_dtl ENABLE ROW LEVEL SECURITY;

-- Explicit revoke so no client role can touch the tables even if a policy is added later by mistake.
REVOKE ALL ON public.sys_ops_operation_cf FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sys_ops_operation_run_dtl FROM PUBLIC, anon, authenticated;
-- HQ platform-api uses the service-role client. The catalog is read-only for it (rows come from migrations).
GRANT SELECT ON public.sys_ops_operation_cf TO service_role;
GRANT SELECT, INSERT ON public.sys_ops_operation_run_dtl TO service_role;

-- -----------------------------------------------------------------------------
-- 4. fn_ops_operation_log - internal attempt logger (not callable by service_role)
-- -----------------------------------------------------------------------------

-- Writes one attempt row with a sanitised copy of the parameters. Called only from
-- fn_ops_operation_run (which runs as the function owner), so no EXECUTE is granted to
-- any API role. Sanitising: at most 20 keys, strings truncated to 200 characters, nested
-- values replaced by a type marker.
CREATE OR REPLACE FUNCTION public.fn_ops_operation_log(
  p_code       TEXT,
  p_actor      TEXT,
  p_params     JSONB,
  p_outcome    TEXT,
  p_error_code TEXT,
  p_rows       BIGINT,
  p_message    TEXT,
  p_started    TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean JSONB := '{}'::jsonb;
BEGIN
  IF p_params IS NOT NULL AND jsonb_typeof(p_params) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(e.k, CASE jsonb_typeof(e.v)
             WHEN 'string' THEN to_jsonb(left(e.v #>> '{}', 200))
             WHEN 'number' THEN e.v
             WHEN 'boolean' THEN e.v
             WHEN 'null' THEN e.v
             ELSE to_jsonb('<' || jsonb_typeof(e.v) || '>')
           END), '{}'::jsonb)
    INTO v_clean
    FROM (SELECT k, v FROM jsonb_each(p_params) AS x(k, v) LIMIT 20) AS e;
  END IF;

  INSERT INTO public.sys_ops_operation_run_dtl (
    operation_code, actor, params, outcome, error_code, row_count, message,
    started_at, finished_at, created_info
  ) VALUES (
    p_code, p_actor, v_clean, p_outcome, p_error_code, p_rows, left(p_message, 500),
    p_started, clock_timestamp(), 'fn_ops_operation_run'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_ops_operation_log(TEXT, TEXT, JSONB, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ) IS
  'Internal: appends a sanitised attempt row to sys_ops_operation_run_dtl. Only callable by the function owner (via fn_ops_operation_run).';

-- -----------------------------------------------------------------------------
-- 5. fn_ops_operation_list - catalog with last run
-- -----------------------------------------------------------------------------

-- Read-only. Returns the active catalog with the latest attempt per operation. The
-- sql_text is intentionally included: the screen must show the EXACT statement.
CREATE OR REPLACE FUNCTION public.fn_ops_operation_list()
RETURNS TABLE (
  operation_code   TEXT,
  title            TEXT,
  title2           TEXT,
  description      TEXT,
  description2     TEXT,
  module           TEXT,
  category         TEXT,
  risk             TEXT,
  exec_mode        TEXT,
  sql_text         TEXT,
  param_schema     JSONB,
  verify_sql       TEXT,
  guidance_md      TEXT,
  guidance_md2     TEXT,
  manage_via       TEXT,
  requires_tenant  BOOLEAN,
  confirm_phrase   TEXT,
  last_run_at      TIMESTAMPTZ,
  last_run_outcome TEXT,
  last_run_actor   TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.operation_code, c.title, c.title2, c.description, c.description2,
    c.module, c.category, c.risk, c.exec_mode, c.sql_text, c.param_schema,
    c.verify_sql, c.guidance_md, c.guidance_md2, c.manage_via, c.requires_tenant,
    c.confirm_phrase,
    r.started_at, r.outcome, r.actor
  FROM public.sys_ops_operation_cf c
  LEFT JOIN LATERAL (
    SELECT d.started_at, d.outcome, d.actor
    FROM public.sys_ops_operation_run_dtl d
    WHERE d.operation_code = c.operation_code
    ORDER BY d.started_at DESC
    LIMIT 1
  ) r ON true
  WHERE c.rec_status = 1 AND c.is_active
  ORDER BY c.module, c.category, c.operation_code;
$$;

COMMENT ON FUNCTION public.fn_ops_operation_list() IS
  'Read-only active operations catalog (including the exact sql_text) with the latest attempt per operation.';

-- -----------------------------------------------------------------------------
-- 6. fn_ops_operation_run - the only execution path
-- -----------------------------------------------------------------------------

-- Executes ONE catalog operation looked up BY CODE. The caller supplies only the code,
-- a jsonb object of parameter values, an actor label and (for DESTRUCTIVE) the typed
-- confirmation phrase. Steps: lookup -> must be RUN_IN_UI -> DESTRUCTIVE phrase check ->
-- strict parameter validation and typing against param_schema (unknown, missing and
-- malformed values are rejected) -> placeholder sanity check -> EXECUTE of the STORED
-- statement wrapped in a CTE that counts all rows and returns at most 200, with the
-- values bound through USING (never concatenated). READ operations run in a sub-
-- transaction with transaction_read_only on that is always rolled back. Never raises to
-- the caller. Returns jsonb
-- {ok, code, operation_code, risk, row_count, truncated, rows, message, started_at, finished_at}.
-- code: EXECUTED, NOT_FOUND, NOT_RUNNABLE, INVALID_PARAMS, CONFIRM_REQUIRED,
--       MISCONFIGURED, FAILED.
-- Authorization by risk (hq_ops:run_operations / hq_ops:run_destructive) is enforced by
-- the HQ API before this function is called; the database enforces the confirm phrase.
CREATE OR REPLACE FUNCTION public.fn_ops_operation_run(
  p_code    TEXT,
  p_params  JSONB,
  p_actor   TEXT,
  p_confirm TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '30s'
AS $$
DECLARE
  c_row_cap CONSTANT INTEGER := 200;                 -- Maximum rows returned to the caller.
  v_op      public.sys_ops_operation_cf%ROWTYPE;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_started TIMESTAMPTZ := clock_timestamp();
  v_params  JSONB := COALESCE(p_params, '{}'::jsonb);
  v_vals    TEXT[] := ARRAY[NULL, NULL, NULL, NULL, NULL, NULL]::TEXT[];  -- Bound values for $1..$6 (always TEXT).
  v_n       INTEGER;
  v_i       INTEGER;
  v_def     JSONB;
  v_name    TEXT;
  v_type    TEXT;
  v_req     BOOLEAN;
  v_raw     JSONB;
  v_txt     TEXT;
  v_key     TEXT;
  v_max_ph  INTEGER;
  v_sql     TEXT;
  v_total   BIGINT;
  v_rows    JSONB;
  v_err     TEXT;
BEGIN
  -- ---- Lookup by code (the only way an operation is selected) ----
  SELECT * INTO v_op
  FROM public.sys_ops_operation_cf
  WHERE operation_code = p_code AND rec_status = 1 AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'operation_code', p_code,
      'message', 'Operation is not in the catalog');
  END IF;

  -- ---- Executable only when explicitly marked RUN_IN_UI (also re-checks the DDL guard at run time) ----
  IF v_op.exec_mode <> 'RUN_IN_UI' OR v_op.manage_via = 'MIGRATION'
     OR v_op.sql_text IS NULL OR v_op.sql_text ~* '\m(create|alter|drop|truncate|grant|revoke)\M' THEN
    PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'REJECTED', 'NOT_RUNNABLE', NULL,
      'Operation cannot be run from the UI', v_started);
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_RUNNABLE', 'operation_code', p_code, 'risk', v_op.risk,
      'message', 'This operation cannot be run from the UI; copy it or follow the guidance');
  END IF;

  -- ---- DESTRUCTIVE needs the exact typed phrase ----
  IF v_op.risk = 'DESTRUCTIVE' AND p_confirm IS DISTINCT FROM v_op.confirm_phrase THEN
    PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'REJECTED', 'CONFIRM_REQUIRED', NULL,
      'Confirmation phrase missing or wrong', v_started);
    RETURN jsonb_build_object('ok', false, 'code', 'CONFIRM_REQUIRED', 'operation_code', p_code, 'risk', v_op.risk,
      'message', 'Type the exact confirmation phrase to run this destructive operation');
  END IF;

  -- ---- Strict parameter validation and typing against param_schema ----
  v_n := jsonb_array_length(v_op.param_schema);
  IF jsonb_typeof(v_params) <> 'object' THEN
    v_err := 'params must be a JSON object';
  END IF;

  IF v_err IS NULL THEN
    -- Unknown keys are rejected (a caller can never smuggle extra values).
    FOR v_key IN SELECT jsonb_object_keys(v_params) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_op.param_schema) AS e WHERE e ->> 'name' = v_key
      ) THEN
        v_err := 'Unknown parameter: ' || left(v_key, 60);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_err IS NULL THEN
    FOR v_i IN 1 .. v_n LOOP
      v_def  := v_op.param_schema -> (v_i - 1);
      v_name := v_def ->> 'name';
      v_type := v_def ->> 'type';
      v_req  := COALESCE((v_def ->> 'required')::boolean, false);
      v_raw  := v_params -> v_name;

      IF v_raw IS NULL OR jsonb_typeof(v_raw) = 'null' THEN
        IF v_req THEN
          v_err := 'Missing required parameter: ' || v_name;
          EXIT;
        END IF;
        CONTINUE;  -- Optional and absent: stays NULL.
      END IF;

      v_txt := NULL;
      IF v_type = 'text' THEN
        IF jsonb_typeof(v_raw) = 'string' THEN
          v_txt := v_raw #>> '{}';
          IF length(v_txt) > 500 OR (v_req AND btrim(v_txt) = '') THEN v_txt := NULL; END IF;
        END IF;
      ELSIF v_type = 'uuid' THEN
        IF jsonb_typeof(v_raw) = 'string'
           AND (v_raw #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          v_txt := lower(v_raw #>> '{}');
        END IF;
      ELSIF v_type = 'int' THEN
        IF jsonb_typeof(v_raw) IN ('number', 'string') AND (v_raw #>> '{}') ~ '^-?[0-9]{1,9}$' THEN
          v_txt := v_raw #>> '{}';
        END IF;
      ELSIF v_type = 'bool' THEN
        IF jsonb_typeof(v_raw) = 'boolean' OR (jsonb_typeof(v_raw) = 'string' AND (v_raw #>> '{}') IN ('true', 'false')) THEN
          v_txt := v_raw #>> '{}';
        END IF;
      ELSIF v_type = 'timestamp' THEN
        IF jsonb_typeof(v_raw) = 'string' AND length(v_raw #>> '{}') <= 40 THEN
          BEGIN
            PERFORM (v_raw #>> '{}')::timestamp;   -- Proves the value parses; the SQL casts it again.
            v_txt := v_raw #>> '{}';
          EXCEPTION WHEN OTHERS THEN
            v_txt := NULL;
          END;
        END IF;
      END IF;

      IF v_txt IS NULL THEN
        v_err := 'Malformed value for parameter: ' || v_name;
        EXIT;
      END IF;
      v_vals[v_i] := v_txt;
    END LOOP;
  END IF;

  IF v_err IS NOT NULL THEN
    PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'REJECTED', 'INVALID_PARAMS', NULL, v_err, v_started);
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PARAMS', 'operation_code', p_code, 'risk', v_op.risk,
      'message', v_err);
  END IF;

  -- ---- Placeholder sanity: no $n beyond the declared parameters ----
  SELECT COALESCE(max((m[1])::integer), 0) INTO v_max_ph
  FROM regexp_matches(v_op.sql_text, '\$([0-9]+)', 'g') AS m;
  IF v_max_ph > v_n OR v_n > 6 THEN
    PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'REJECTED', 'MISCONFIGURED', NULL,
      'Catalog row references undeclared parameters', v_started);
    RETURN jsonb_build_object('ok', false, 'code', 'MISCONFIGURED', 'operation_code', p_code, 'risk', v_op.risk,
      'message', 'Catalog row references undeclared parameters');
  END IF;

  -- ---- Execute the STORED statement; only constants are concatenated, values are bound ----
  -- The CTE counts every row and returns at most c_row_cap of them as jsonb. Write
  -- statements (INSERT/UPDATE/DELETE ... RETURNING) are legal CTE bodies.
  v_sql := 'WITH q AS (' || v_op.sql_text || ') SELECT (SELECT count(*) FROM q), '
        || '(SELECT COALESCE(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM (SELECT * FROM q LIMIT '
        || c_row_cap::text || ') r)';

  BEGIN
    IF v_op.risk = 'READ' THEN
      -- Read-only enforcement: the GUC is set inside this sub-transaction and the
      -- sub-transaction is rolled back below, so nothing can persist and the flag is
      -- restored automatically before the run is logged.
      PERFORM set_config('transaction_read_only', 'on', true);
      EXECUTE v_sql INTO v_total, v_rows
        USING v_vals[1], v_vals[2], v_vals[3], v_vals[4], v_vals[5], v_vals[6];
      RAISE EXCEPTION 'ops read rollback' USING ERRCODE = 'OPS01';
    ELSE
      EXECUTE v_sql INTO v_total, v_rows
        USING v_vals[1], v_vals[2], v_vals[3], v_vals[4], v_vals[5], v_vals[6];
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'OPS01' THEN
      NULL;  -- Intentional rollback of a READ operation; v_total/v_rows keep their values.
    WHEN query_canceled THEN
      v_err := 'Timed out after 30s';
    WHEN OTHERS THEN
      v_err := left(SQLERRM, 500);
  END;

  IF v_err IS NOT NULL THEN
    PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'FAILED', 'FAILED', NULL, v_err, v_started);
    RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'operation_code', p_code, 'risk', v_op.risk,
      'message', v_err, 'started_at', v_started, 'finished_at', clock_timestamp());
  END IF;

  PERFORM public.fn_ops_operation_log(p_code, v_actor, v_params, 'SUCCESS', NULL, v_total,
    'Completed; rows: ' || COALESCE(v_total, 0)::text, v_started);

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'EXECUTED',
    'operation_code', p_code,
    'risk', v_op.risk,
    'row_count', COALESCE(v_total, 0),
    'truncated', COALESCE(v_total, 0) > c_row_cap,
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'message', 'Completed; rows: ' || COALESCE(v_total, 0)::text,
    'started_at', v_started,
    'finished_at', clock_timestamp()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Last-resort guard (for example a failure while logging): never raise to the caller.
    RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'operation_code', p_code,
      'message', left(SQLERRM, 500));
END;
$$;

COMMENT ON FUNCTION public.fn_ops_operation_run(TEXT, JSONB, TEXT, TEXT) IS
  'Runs one RUN_IN_UI catalog operation selected BY CODE: validates and types parameters against param_schema, checks the DESTRUCTIVE phrase, executes the stored SQL with bound values only, caps results at 200 rows, runs READ operations read-only and rolled back, logs every attempt, never raises.';

-- -----------------------------------------------------------------------------
-- 7. Function privileges: service_role only
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER functions are callable by PUBLIC by default; revoke from every client
-- role and grant only to service_role (HQ platform-api). fn_ops_operation_log is internal
-- and is granted to nobody.
REVOKE ALL ON FUNCTION public.fn_ops_operation_log(TEXT, TEXT, JSONB, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_ops_operation_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_operation_run(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_operation_list() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_operation_run(TEXT, JSONB, TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 8. Seed the catalog (idempotent). Every RUN_IN_UI statement was validated against
--    the live schema (read-only discovery, 2026-10-14): org_ntf_outbox_dtl,
--    org_ntf_settings_cf, org_ntf_delivery_log_dtl, org_ntf_receipts_tr,
--    org_ntf_inbox_mst, hq_ntf_dispatch_log, cron.job, cron.job_run_details.
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_ops_operation_cf (
  operation_code, title, title2, description, description2,
  module, category, risk, exec_mode, sql_text, param_schema, verify_sql,
  guidance_md, guidance_md2, manage_via, requires_tenant, confirm_phrase, created_info
)
SELECT s.operation_code, s.title, s.title2, s.description, s.description2,
       s.module, s.category, s.risk, s.exec_mode, s.sql_text, s.param_schema, s.verify_sql,
       s.guidance_md, s.guidance_md2, s.manage_via, s.requires_tenant, s.confirm_phrase, '0611 seed'
FROM (
  VALUES
  -- 1. READ: outbox status summary for one tenant -------------------------------------------------
  ('ntf.outbox_status_summary',
   'Notification outbox status summary',
   'ملخص حالات صندوق الإشعارات الصادرة',
   'Counts the notification outbox rows of one tenant by status and channel, with the oldest scheduled time. Use it to see whether messages are stuck in QUEUED or piling up in FAILED_TEMPORARY. Read-only.',
   'يعد صفوف صندوق الإشعارات الصادرة لمنشأة واحدة حسب الحالة والقناة مع أقدم وقت مجدول. استخدمه لمعرفة ما إذا كانت الرسائل عالقة في QUEUED أو تتراكم في FAILED_TEMPORARY. للقراءة فقط.',
   'ntf', 'DIAGNOSTICS', 'READ', 'RUN_IN_UI',
   $sql$SELECT o.status, o.channel_code, count(*) AS message_count, min(o.scheduled_at) AS oldest_scheduled_at, max(o.created_at) AS latest_created_at FROM org_ntf_outbox_dtl o WHERE o.tenant_org_id = $1::uuid GROUP BY o.status, o.channel_code ORDER BY o.status, o.channel_code$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"The tenant whose outbox is summarised."}]$p$::jsonb,
   NULL::TEXT,
   E'1. Enter the tenant organization ID.\n2. Press **Run now**. Nothing is changed.\n3. Many `QUEUED` rows with an old oldest_scheduled_at mean the outbox processor job is not running: check the Job Manager.',
   E'1. أدخل معرف المنشأة.\n2. اضغط **تشغيل الآن**. لا يتم تغيير أي شيء.\n3. وجود صفوف كثيرة بحالة `QUEUED` مع أقدم وقت قديم يعني أن مهمة معالجة الصندوق لا تعمل: راجع مدير المهام.',
   'UI', true, NULL::TEXT),
  -- 2. READ: recent HQ dispatch evidence -----------------------------------------------------------
  ('ntf.dispatch_log_recent',
   'Recent HQ dispatch log evidence',
   'أحدث سجلات الإرسال عبر المنصة',
   'Shows the most recent hq_ntf_dispatch_log rows of one tenant (status, provider message id, errors). A SENT row with a real provider message id is the evidence that the HQ route/proxy path worked. Read-only.',
   'يعرض أحدث صفوف hq_ntf_dispatch_log لمنشأة واحدة (الحالة ومعرف رسالة المزود والأخطاء). صف SENT مع معرف رسالة حقيقي دليل على نجاح مسار المنصة. للقراءة فقط.',
   'ntf', 'DIAGNOSTICS', 'READ', 'RUN_IN_UI',
   $sql$SELECT h.idempotency_key, h.channel_code, h.provider_code, h.dispatch_mode, h.status, h.provider_message_id, h.error_code, h.error_message, h.attempt_count, h.duration_ms, h.dispatched_at, h.failed_at, h.created_at FROM hq_ntf_dispatch_log h WHERE h.tenant_org_id = $1::uuid ORDER BY h.created_at DESC LIMIT LEAST(COALESCE($2::int, 20), 200)$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"The tenant whose dispatch ledger is shown."},{"name":"max_rows","type":"int","required":false,"label":"Max rows (default 20, max 200)","label2":"الحد الأقصى للصفوف (الافتراضي 20، الأقصى 200)","description":"How many recent rows to return."}]$p$::jsonb,
   NULL,
   E'1. Enter the tenant organization ID (optionally a row limit).\n2. Press **Run now**.\n3. Record a `SENT` row with a provider message id as pilot evidence in the feature STATUS.md.',
   E'1. أدخل معرف المنشأة (ويمكن تحديد عدد الصفوف).\n2. اضغط **تشغيل الآن**.\n3. سجل صف `SENT` مع معرف رسالة المزود كدليل تجريبي في ملف STATUS.md الخاص بالميزة.',
   'UI', true, NULL),
  -- 3. READ: retention preview ----------------------------------------------------------------------
  ('ntf.retention_preview',
   'Notification retention preview (per tenant)',
   'معاينة الاحتفاظ بالإشعارات (لكل منشأة)',
   'Counts, for one tenant, how many rows the daily ntf-retention-sweep would purge with the given retention window (default 180 days): outbox, delivery log, receipts, read/expired inbox and HQ dispatch log. Mirrors fn_ntf_retention_sweep. Read-only, deletes nothing.',
   'يحسب لمنشأة واحدة عدد الصفوف التي ستحذفها مهمة ntf-retention-sweep اليومية ضمن مدة الاحتفاظ المحددة (الافتراضي 180 يوما): الصندوق وسجل التسليم والإيصالات والوارد المقروء أو المنتهي وسجل إرسال المنصة. يطابق fn_ntf_retention_sweep. للقراءة فقط ولا يحذف شيئا.',
   'ntf', 'DIAGNOSTICS', 'READ', 'RUN_IN_UI',
   $sql$SELECT 'org_ntf_outbox_dtl' AS source_table, count(*) AS eligible_rows FROM org_ntf_outbox_dtl o WHERE o.tenant_org_id = $1::uuid AND o.status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED') AND COALESCE(o.finalized_at, o.delivered_at, o.created_at) < now() - make_interval(days => COALESCE($2::int, 180)) UNION ALL SELECT 'org_ntf_delivery_log_dtl', count(*) FROM org_ntf_delivery_log_dtl d WHERE d.tenant_org_id = $1::uuid AND d.logged_at < now() - make_interval(days => COALESCE($2::int, 180)) UNION ALL SELECT 'org_ntf_receipts_tr', count(*) FROM org_ntf_receipts_tr r WHERE r.tenant_org_id = $1::uuid AND r.received_at < now() - make_interval(days => COALESCE($2::int, 180)) UNION ALL SELECT 'org_ntf_inbox_mst', count(*) FROM org_ntf_inbox_mst i WHERE i.tenant_org_id = $1::uuid AND (i.is_read = true OR (i.expires_at IS NOT NULL AND i.expires_at < now())) AND i.created_at < now() - make_interval(days => COALESCE($2::int, 180)) UNION ALL SELECT 'hq_ntf_dispatch_log', count(*) FROM hq_ntf_dispatch_log h WHERE h.tenant_org_id = $1::uuid AND h.status IN ('SENT', 'PERMANENT_FAILURE') AND COALESCE(h.dispatched_at, h.failed_at, h.created_at) < now() - make_interval(days => COALESCE($2::int, 180))$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"The tenant to preview."},{"name":"retention_days","type":"int","required":false,"label":"Retention days (default 180)","label2":"أيام الاحتفاظ (الافتراضي 180)","description":"Rows older than this many days are counted as eligible."}]$p$::jsonb,
   NULL,
   E'1. Enter the tenant organization ID and, optionally, a retention window in days.\n2. Press **Run now**: the table shows how many rows per source would be eligible. Nothing is deleted.',
   E'1. أدخل معرف المنشأة ويمكنك تحديد مدة الاحتفاظ بالأيام.\n2. اضغط **تشغيل الآن**: يعرض الجدول عدد الصفوف المؤهلة لكل مصدر. لا يتم حذف شيء.',
   'UI', true, NULL),
  -- 4. READ: cron last runs -------------------------------------------------------------------------
  ('ops.cron_last_runs',
   'Cron jobs: last run summary',
   'مهام cron: ملخص آخر تشغيل',
   'Lists every pg_cron job with its schedule, active flag and the latest run (status, start time, message). Optionally filter by job-name prefix (for example ntf-). Read-only. For history beyond the 14-day window use the Job Manager.',
   'يعرض كل مهمة pg_cron مع جدولها وحالة التفعيل وآخر تشغيل (الحالة ووقت البدء والرسالة). يمكن التصفية ببادئة اسم المهمة (مثل ntf-). للقراءة فقط. للسجل الأقدم من 14 يوما استخدم مدير المهام.',
   'ops', 'DIAGNOSTICS', 'READ', 'RUN_IN_UI',
   $sql$SELECT j.jobname, j.schedule, j.active, d.status AS last_status, d.start_time AS last_start_time, left(d.return_message, 200) AS last_message FROM cron.job j LEFT JOIN LATERAL (SELECT x.status, x.start_time, x.return_message FROM cron.job_run_details x WHERE x.jobid = j.jobid ORDER BY x.start_time DESC LIMIT 1) d ON true WHERE $1::text IS NULL OR j.jobname LIKE $1::text || '%' ORDER BY j.jobname$sql$,
   $p$[{"name":"name_prefix","type":"text","required":false,"label":"Job name prefix (optional)","label2":"بادئة اسم المهمة (اختياري)","description":"For example ntf- or fin-."}]$p$::jsonb,
   NULL,
   E'1. Optionally enter a job-name prefix such as `ntf-`.\n2. Press **Run now**.\n3. To enable, disable or reschedule a job use the **Job Manager** screen, not SQL.',
   E'1. يمكنك إدخال بادئة اسم المهمة مثل `ntf-`.\n2. اضغط **تشغيل الآن**.\n3. لتفعيل مهمة أو تعطيلها أو تغيير جدولها استخدم شاشة **مدير المهام** وليس SQL.',
   'UI', false, NULL),
  -- 5. WRITE: pilot test message --------------------------------------------------------------------
  ('ntf.pilot_test_message',
   'Queue a pilot test message (WhatsApp / SMS)',
   'إضافة رسالة اختبار تجريبية (واتساب / رسائل نصية)',
   'Inserts ONE QUEUED test row into the notification outbox of a tenant (event pilot.test, source A1_PILOT_TEST) so the outbox processor sends it through the generic path. scheduled_at is fixed in the past because the column is timezone-naive and a now() default under a positive UTC offset would look like the future to the processor. Channel must be WHATSAPP or SMS; any other value inserts nothing. The recipient must have joined the Twilio WhatsApp sandbox.',
   'يضيف صفا اختباريا واحدا بحالة QUEUED إلى صندوق إشعارات المنشأة (الحدث pilot.test والمصدر A1_PILOT_TEST) ليرسله المعالج عبر المسار العام. وقت الجدولة ثابت في الماضي لأن العمود بدون منطقة زمنية. يجب أن تكون القناة WHATSAPP أو SMS وإلا لن يضاف شيء. يجب أن يكون المستلم قد انضم إلى sandbox واتساب في Twilio.',
   'ntf', 'PILOT', 'WRITE', 'RUN_IN_UI',
   $sql$INSERT INTO org_ntf_outbox_dtl (tenant_org_id, channel_code, recipient_address, rendered_body, event_code, max_retries, scheduled_at, status, source_entity_type, idempotency_key, metadata, created_info) SELECT $1::uuid, upper($2), $3, $4, 'pilot.test', 1, '2000-01-01 00:00:00'::timestamp, 'QUEUED', 'A1_PILOT_TEST', 'ops-pilot-' || gen_random_uuid()::text, '{"a1_pilot_test": true}'::jsonb, 'ops catalog ntf.pilot_test_message' FROM org_tenants_mst t WHERE t.id = $1::uuid AND upper($2) IN ('WHATSAPP', 'SMS') RETURNING org_ntf_outbox_dtl.id, org_ntf_outbox_dtl.tenant_org_id, org_ntf_outbox_dtl.channel_code, org_ntf_outbox_dtl.status, org_ntf_outbox_dtl.scheduled_at$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"Demo Laundry LLC is 11111111-1111-1111-1111-111111111111."},{"name":"channel_code","type":"text","required":true,"label":"Channel (WHATSAPP or SMS)","label2":"القناة (WHATSAPP أو SMS)","description":"Only WHATSAPP and SMS insert a row."},{"name":"recipient_address","type":"text","required":true,"label":"Recipient phone (+countrycode...)","label2":"هاتف المستلم (+رمز الدولة...)","description":"E.164 number, for example +96877182624."},{"name":"message_body","type":"text","required":true,"label":"Message text","label2":"نص الرسالة","description":"Plain text of the test message."}]$p$::jsonb,
   $sql$SELECT id, status, provider_message_id, error_message, sent_at FROM org_ntf_outbox_dtl WHERE tenant_org_id = '<tenant id>' AND id = '<returned id>'$sql$,
   E'1. Make sure the cron job `ntf-outbox-processor` is active (Job Manager) or be ready to wait for it.\n2. Enter the tenant, channel, recipient and text, press **Run now** and confirm.\n3. Note the returned `id`. After the processor runs, check the status with **Outbox status summary** or the verify SQL, and `hq_ntf_dispatch_log` with **Recent HQ dispatch log**.\n4. Clean up test rows later with **Delete pilot test rows**.',
   E'1. تأكد أن مهمة `ntf-outbox-processor` مفعلة (مدير المهام) أو انتظر تشغيلها.\n2. أدخل المنشأة والقناة والمستلم والنص ثم اضغط **تشغيل الآن** وأكد.\n3. دون المعرف `id` المرجع. بعد تشغيل المعالج تحقق من الحالة عبر **ملخص حالات الصندوق** أو استعلام التحقق، ومن `hq_ntf_dispatch_log` عبر **أحدث سجلات الإرسال**.\n4. نظف صفوف الاختبار لاحقا عبر **حذف صفوف الاختبار التجريبية**.',
   'UI', true, NULL),
  -- 6. WRITE: set tenant dispatch_via_hq ------------------------------------------------------------
  ('ntf.set_dispatch_via_hq',
   'Set tenant dispatch_via_hq (per channel)',
   'ضبط dispatch_via_hq للمنشأة (لكل قناة)',
   'Sets metadata.dispatch_via_hq on the EXISTING org_ntf_settings_cf row of one tenant and channel, merging into the current metadata. When true (and the platform flag ntf_dispatch_via_hq is on) that tenant/channel dispatches through the HQ proxy instead of direct provider calls. Updates nothing if the settings row does not exist.',
   'يضبط metadata.dispatch_via_hq في صف org_ntf_settings_cf الموجود لمنشأة وقناة محددتين مع دمجه في البيانات الحالية. عند true (ومع تفعيل علم المنصة ntf_dispatch_via_hq) ترسل تلك المنشأة والقناة عبر وسيط المنصة بدلا من الاتصال المباشر بالمزود. لا يغير شيئا إذا لم يوجد صف الإعدادات.',
   'ntf', 'SETUP', 'WRITE', 'RUN_IN_UI',
   $sql$UPDATE org_ntf_settings_cf s SET metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('dispatch_via_hq', $3::boolean), updated_at = now(), updated_by = 'ops-catalog', updated_info = 'ops catalog ntf.set_dispatch_via_hq' WHERE s.tenant_org_id = $1::uuid AND s.channel_code = upper($2) RETURNING s.tenant_org_id, s.channel_code, s.metadata$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"The tenant to change."},{"name":"channel_code","type":"text","required":true,"label":"Channel (for example WHATSAPP, SMS)","label2":"القناة (مثل WHATSAPP أو SMS)","description":"Must match an existing settings row."},{"name":"enabled","type":"bool","required":true,"label":"dispatch_via_hq enabled","label2":"تفعيل dispatch_via_hq","description":"true routes this tenant/channel through HQ."}]$p$::jsonb,
   $sql$SELECT tenant_org_id, channel_code, metadata FROM org_ntf_settings_cf WHERE tenant_org_id = '<tenant id>'$sql$,
   E'1. Enter the tenant, the channel and whether to enable the HQ path.\n2. Press **Run now** and confirm. The result row shows the merged metadata; zero rows means no settings row exists for that tenant/channel.\n3. Undo by running again with enabled = false.',
   E'1. أدخل المنشأة والقناة وهل يتم تفعيل مسار المنصة.\n2. اضغط **تشغيل الآن** وأكد. يعرض الصف الناتج البيانات المدمجة؛ صفر صفوف يعني عدم وجود صف إعدادات لهذه المنشأة والقناة.\n3. للتراجع شغله مرة أخرى مع enabled = false.',
   'UI', true, NULL),
  -- 7. DESTRUCTIVE: delete pilot rows ----------------------------------------------------------------
  ('ntf.delete_pilot_rows',
   'Delete pilot test rows (A1_PILOT_TEST)',
   'حذف صفوف الاختبار التجريبية (A1_PILOT_TEST)',
   'Permanently deletes the pilot test rows (source A1_PILOT_TEST) of ONE tenant from the outbox, but only rows that never produced a delivery log or receipt (delivery history is immutable evidence) and that are QUEUED or in a failed/skipped/cancelled state. Returns the deleted ids. Cannot be undone.',
   'يحذف نهائيا صفوف الاختبار التجريبية (المصدر A1_PILOT_TEST) لمنشأة واحدة من الصندوق، فقط الصفوف التي لم تنتج سجل تسليم أو إيصالا (سجل التسليم دليل غير قابل للتعديل) والتي حالتها QUEUED أو فاشلة أو متجاوزة أو ملغاة. يعيد المعرفات المحذوفة. لا يمكن التراجع.',
   'ntf', 'CLEANUP', 'DESTRUCTIVE', 'RUN_IN_UI',
   $sql$DELETE FROM org_ntf_outbox_dtl o WHERE o.tenant_org_id = $1::uuid AND o.source_entity_type = 'A1_PILOT_TEST' AND o.status IN ('QUEUED', 'FAILED_TEMPORARY', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED') AND NOT EXISTS (SELECT 1 FROM org_ntf_delivery_log_dtl d WHERE d.outbox_id = o.id AND d.tenant_org_id = o.tenant_org_id) AND NOT EXISTS (SELECT 1 FROM org_ntf_receipts_tr r WHERE r.delivery_id = o.id AND r.tenant_org_id = o.tenant_org_id) RETURNING o.id, o.channel_code, o.status$sql$,
   $p$[{"name":"tenant_org_id","type":"uuid","required":true,"label":"Tenant organization ID","label2":"معرف المنشأة","description":"Only this tenant's pilot rows are deleted."}]$p$::jsonb,
   NULL,
   E'1. Run **Outbox status summary** first to see what exists.\n2. Enter the tenant, press **Run now**, then type the confirmation phrase exactly.\n3. Requires the separate `hq_ops:run_destructive` permission. Deleted ids are listed in the result and logged.',
   E'1. شغل **ملخص حالات الصندوق** أولا لمعرفة المتاح.\n2. أدخل المنشأة واضغط **تشغيل الآن** ثم اكتب عبارة التأكيد بالضبط.\n3. يتطلب صلاحية `hq_ops:run_destructive` المنفصلة. تظهر المعرفات المحذوفة في النتيجة وتسجل.',
   'UI', true, 'DELETE PILOT ROWS'),
  -- 8. COPY_ONLY: apply a migration -------------------------------------------------------------------
  ('ops.apply_migration',
   'Apply a database migration',
   'تطبيق ترحيل قاعدة البيانات',
   'Migrations are never applied from the UI or by tooling: a human reviews the SQL file and applies it. This entry gives the command and the safe order of steps.',
   'لا يتم تطبيق الترحيلات من الواجهة ولا بأي أداة: يراجع شخص ملف SQL ثم يطبقه. يوفر هذا الإدخال الأمر والترتيب الآمن للخطوات.',
   'ops', 'SETUP', 'WRITE', 'COPY_ONLY',
   $sql$supabase db push$sql$,
   '[]'::jsonb,
   $sql$SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5$sql$,
   E'1. Read the new file in `supabase/migrations/` fully (the header says CREATED, NOT APPLIED).\n2. Apply to **local** first: run the command below from the repository root (or paste the file into the local SQL editor).\n3. Verify with the verify SQL, then apply to **remote** the same way.\n4. Never edit an applied migration; create a new numbered one for fixes.',
   E'1. اقرأ الملف الجديد في `supabase/migrations/` كاملا (يذكر الترويسة CREATED, NOT APPLIED).\n2. طبقه على البيئة **المحلية** أولا: شغل الأمر أدناه من جذر المستودع (أو الصق الملف في محرر SQL المحلي).\n3. تحقق عبر استعلام التحقق ثم طبقه على البيئة **البعيدة** بالطريقة نفسها.\n4. لا تعدل ترحيلا مطبقا أبدا؛ أنشئ ترحيلا جديدا مرقما للإصلاحات.',
   'MIGRATION', false, NULL),
  -- 9. GUIDE_ONLY: HQ env vars ------------------------------------------------------------------------
  ('ops.set_hq_env_vars',
   'Set HQ environment variables on the host',
   'ضبط متغيرات البيئة للمنصة على الخادم',
   'Environment variables live on the hosting platform and are never stored in the database. Lists the notification variables to set on platform-api and web-admin.',
   'تبقى متغيرات البيئة في منصة الاستضافة ولا تخزن في قاعدة البيانات. يعرض المتغيرات المطلوبة للإشعارات في platform-api و web-admin.',
   'ops', 'SETUP', 'WRITE', 'GUIDE_ONLY',
   NULL,
   '[]'::jsonb,
   NULL,
   E'On **platform-api (HQ)** set:\n- `HQ_TWILIO_ACCOUNT_SID` - Twilio Account SID (`AC...`)\n- `HQ_TWILIO_AUTH_TOKEN` - Twilio Auth Token\n- `NTF_TWILIO_CONTENT_CREDENTIAL_REF` - any stable label, for example `twilio-prod-main`\n- `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` - optional; must equal the account row credential_version\n- `HQ_TWILIO_WHATSAPP_FROM` - fallback sender (`whatsapp:+...`)\n\nOn **web-admin (tenant)** set:\n- `NTF_HQ_ROUTE_DISPATCH_URL` - `https://<platform-api-host>/api/hq/v1/notifications/dispatch/route`\n- `NTF_HQ_SERVICE_ROLE_KEY` must equal HQ `HQ_SERVICE_ROLE_KEY` exactly.\n\nThen **redeploy both apps**. Secrets are never shown or stored in this console.',
   E'على **platform-api (المنصة)** اضبط:\n- `HQ_TWILIO_ACCOUNT_SID` - معرف حساب Twilio (`AC...`)\n- `HQ_TWILIO_AUTH_TOKEN` - رمز مصادقة Twilio\n- `NTF_TWILIO_CONTENT_CREDENTIAL_REF` - أي تسمية ثابتة مثل `twilio-prod-main`\n- `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` - اختياري؛ يجب أن يساوي credential_version في صف الحساب\n- `HQ_TWILIO_WHATSAPP_FROM` - مرسل احتياطي (`whatsapp:+...`)\n\nعلى **web-admin (المنشأة)** اضبط:\n- `NTF_HQ_ROUTE_DISPATCH_URL` - `https://<platform-api-host>/api/hq/v1/notifications/dispatch/route`\n- يجب أن يطابق `NTF_HQ_SERVICE_ROLE_KEY` قيمة `HQ_SERVICE_ROLE_KEY` في المنصة تماما.\n\nثم **أعد نشر التطبيقين**. لا تعرض الأسرار ولا تخزن في هذه الشاشة.',
   'HOSTING_ENV', false, NULL),
  -- 10. GUIDE_ONLY: Resend webhook --------------------------------------------------------------------
  ('ntf.resend_webhook_setup',
   'Set up the Resend bounce/complaint webhook',
   'إعداد ويب هوك Resend للارتدادات والشكاوى',
   'The webhook endpoint is registered in the Resend dashboard and its signing secret is set as an environment variable. Until the secret is set the endpoint rejects every callback with 401 by design.',
   'يتم تسجيل نقطة الويب هوك في لوحة Resend ويضبط سر التوقيع كمتغير بيئة. حتى ضبط السر ترفض النقطة كل الطلبات برمز 401 عمدا.',
   'ntf', 'SETUP', 'WRITE', 'GUIDE_ONLY',
   NULL,
   '[]'::jsonb,
   NULL,
   E'1. Resend dashboard > **Webhooks** > **Add endpoint**.\n2. URL: `https://<web-admin-host>/api/notifications/webhooks/resend`; events `email.bounced` and `email.complained`.\n3. Copy the **Signing secret** (`whsec_...`).\n4. Set web-admin env `RESEND_WEBHOOK_SECRET` to it and redeploy.\n5. Use Resend **Send test event**; expect HTTP 200. Real bounces then appear in `org_ntf_suppression_lst`.',
   E'1. لوحة Resend > **Webhooks** > **Add endpoint**.\n2. الرابط: `https://<web-admin-host>/api/notifications/webhooks/resend`؛ الأحداث `email.bounced` و `email.complained`.\n3. انسخ **Signing secret** (`whsec_...`).\n4. اضبط متغير بيئة web-admin باسم `RESEND_WEBHOOK_SECRET` بهذه القيمة وأعد النشر.\n5. استخدم **Send test event** في Resend؛ المتوقع HTTP 200. ستظهر الارتدادات الحقيقية لاحقا في `org_ntf_suppression_lst`.',
   'EXTERNAL_CONSOLE', false, NULL),
  -- 11. GUIDE_ONLY: Twilio account verification --------------------------------------------------------
  ('ntf.twilio_account_verify',
   'Create and verify the Twilio account in HQ',
   'إنشاء حساب Twilio والتحقق منه في المنصة',
   'Prerequisite work happens in the Twilio console (WhatsApp sender, approved Content template). The account and its verification are then done on the HQ Notifications > Providers screen.',
   'العمل المسبق يتم في لوحة Twilio (مرسل واتساب وقالب Content معتمد). ثم يتم إنشاء الحساب والتحقق منه من شاشة الإشعارات > المزودون في المنصة.',
   'ntf', 'SETUP', 'WRITE', 'GUIDE_ONLY',
   NULL,
   '[]'::jsonb,
   NULL,
   E'1. In the Twilio console make sure a WhatsApp sender exists and a Content template (`HX...`) is **approved**.\n2. Set the HQ env variables (see **Set HQ environment variables**).\n3. HQ > Notifications > Providers > **Manage connections**: create a platform account (provider `TWILIO`, channel `WHATSAPP`, `external_account_id` = Account SID, `credential_ref` = exactly `NTF_TWILIO_CONTENT_CREDENTIAL_REF`).\n4. Click **Verify** (calls Twilio live); success sets `VERIFIED`.\n5. Add a sender under the same dialog.',
   E'1. في لوحة Twilio تأكد من وجود مرسل واتساب وقالب Content (`HX...`) **معتمد**.\n2. اضبط متغيرات بيئة المنصة (راجع **ضبط متغيرات البيئة للمنصة**).\n3. المنصة > الإشعارات > المزودون > **Manage connections**: أنشئ حساب منصة (المزود `TWILIO` والقناة `WHATSAPP` و `external_account_id` = معرف الحساب و `credential_ref` = قيمة `NTF_TWILIO_CONTENT_CREDENTIAL_REF` تماما).\n4. اضغط **Verify** (يتصل بـ Twilio مباشرة)؛ النجاح يضبط `VERIFIED`.\n5. أضف مرسلا من النافذة نفسها.',
   'EXTERNAL_CONSOLE', false, NULL)
) AS s(operation_code, title, title2, description, description2,
       module, category, risk, exec_mode, sql_text, param_schema, verify_sql,
       guidance_md, guidance_md2, manage_via, requires_tenant, confirm_phrase)
ON CONFLICT (operation_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. HQ permissions (same pattern as 0610 / hq_notifications:* in 0602)
-- -----------------------------------------------------------------------------

-- Catalog rows only. SUPER_ADMIN already holds the global "*" grant. No other role is
-- granted here (most conservative); assign on the HQ roles screen.
-- hq_ops:run_destructive is separate on purpose: it gates DESTRUCTIVE operations only.
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0611 ops operations catalog'
FROM (
  VALUES
    ('hq_ops:run_operations', 'Run catalog operations (read and write)', 'تشغيل عمليات الكتالوج (قراءة وكتابة)'),
    ('hq_ops:run_destructive', 'Run destructive catalog operations', 'تشغيل عمليات الكتالوج المدمرة')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

COMMIT;
