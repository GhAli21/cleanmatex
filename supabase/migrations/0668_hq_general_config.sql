--
-- Migration 0668_hq_general_config.sql
-- Human-Friendly Codes, P1 (DB engine), migration 3 of 7.
--
-- Purpose: platform defaults (one row) and per-tenant overrides for locale and fiscal values.
--   hq_general_config      single-row platform defaults (currency, country, language, locale, time zone,
--                          fiscal year, date/time format, first day of week, VAT, support contacts, trial days)
--   org_tenants_mst        + current_fiscal_year, fiscal_year_start_month, locale_code (new, NULL = use HQ default)
--                          + CHECKs on date_format, time_format, first_day_of_week (existing since 0039)
--                          - DROP DEFAULT on date_format, time_format, first_day_of_week so NEW tenants inherit HQ
--                            (A-21, approved 2026-10-30; verified safe: no insert path sets them, readers fall back)
--   fn_tenant_general_value(tenant, key)  resolution rule: tenant value if set, otherwise the HQ default.
--   Time zone validation trigger on both tables (cheap AT TIME ZONE test).
-- Existing tenants keep their values. Nothing is deleted. The seven settings deactivated by 0652 get updated_info
-- pointing to their new column so nobody reactivates them.
--
-- Affected: hq_general_config (new); org_tenants_mst (3 columns, 6 CHECKs, 3 defaults dropped, 1 trigger);
--           sys_tenant_settings_cd (updated_info on 7 inactive rows); functions fn_hq_gen_cfg_validate,
--           fn_hq_gen_cfg_no_delete, fn_tenant_tz_validate, fn_tenant_general_value (new).
-- Related:  0039 (tenant locale columns), 0652 (deactivated settings), 0055 (currency, country, language).
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.3.
-- APPLY ORDER: 3 of 7 in P1. Run INVENTORY section 9 Q8 first (existing values must pass the CHECKs; the preflight
--              below fails the migration with the bad values otherwise). Next: doc_seq_counters.
-- ROLLBACK PLAN (forward-only repo; write a new migration). Roll back doc_seq_engine_fns first (it reads these):
--   DROP FUNCTION public.fn_tenant_general_value(uuid,text) RESTRICT;
--   DROP TRIGGER trg_tenants_tz_validate ON public.org_tenants_mst; DROP FUNCTION public.fn_tenant_tz_validate() RESTRICT;
--   DROP TABLE public.hq_general_config RESTRICT; DROP FUNCTION public.fn_hq_gen_cfg_validate(), fn_hq_gen_cfg_no_delete() RESTRICT;
--   ALTER TABLE public.org_tenants_mst DROP CONSTRAINT ck_tenants_* (6), DROP COLUMN locale_code, fiscal_year_start_month,
--   current_fiscal_year; ALTER COLUMN date_format SET DEFAULT 'DD/MM/YYYY', time_format SET DEFAULT '24h',
--   first_day_of_week SET DEFAULT 6.
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 0. Preflight (INVENTORY section 9 Q8): existing tenant values must pass the new CHECKs ----------------
DO $$
DECLARE v_bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT format('%s: date_format=%s time_format=%s first_day_of_week=%s',
                                    id, date_format, time_format, first_day_of_week), '; ')
    INTO v_bad
    FROM public.org_tenants_mst
   WHERE (date_format IS NOT NULL AND date_format NOT IN ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'))
      OR (time_format IS NOT NULL AND time_format NOT IN ('24h','12h'))
      OR (first_day_of_week IS NOT NULL AND first_day_of_week NOT BETWEEN 0 AND 6);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'hq_general_config preflight: tenant locale values fail the new CHECKs. Fix them first: %', v_bad;
  END IF;
END $$;

-- 1. Time zone validation helper (shared) ---------------------------------------------------------------
CREATE FUNCTION public.fn_hq_gen_cfg_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.timezone IS DISTINCT FROM OLD.timezone) THEN
    BEGIN
      PERFORM now() AT TIME ZONE NEW.timezone;
    EXCEPTION WHEN invalid_parameter_value THEN
      RAISE EXCEPTION 'HQ_CONFIG_BAD_TIMEZONE: %', NEW.timezone USING ERRCODE = '22023';
    END;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_hq_gen_cfg_validate() IS
  'BEFORE INSERT/UPDATE trigger: rejects an unknown time zone (HQ_CONFIG_BAD_TIMEZONE, SQLSTATE 22023). Only a new or changed value is tested, so old rows never block unrelated updates. Used by hq_general_config and org_tenants_mst.';
REVOKE ALL ON FUNCTION public.fn_hq_gen_cfg_validate() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.fn_hq_gen_cfg_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'HQ_CONFIG_DELETE_BLOCKED: hq_general_config has exactly one row; update it instead' USING ERRCODE = 'P0001';
END $$;
COMMENT ON FUNCTION public.fn_hq_gen_cfg_no_delete() IS 'BEFORE DELETE / TRUNCATE guard: the single hq_general_config row can never be removed.';
REVOKE ALL ON FUNCTION public.fn_hq_gen_cfg_no_delete() FROM PUBLIC, anon, authenticated;

-- 2. hq_general_config -----------------------------------------------------------------------------------
CREATE TABLE public.hq_general_config (
  config_id               BOOLEAN      NOT NULL DEFAULT true,  -- Always true: enforces one row.
  default_currency_code   TEXT   NOT NULL,               -- FK sys_currency_cd.
  default_country_code    VARCHAR(2)   NOT NULL,               -- FK sys_country_cd.
  default_language_code   VARCHAR(2)   NOT NULL,               -- FK sys_language_cd.
  locale_code             VARCHAR(10)  NOT NULL,               -- BCP 47, e.g. en-OM.
  timezone                VARCHAR(50)  NOT NULL,         -- IANA zone, e.g. Asia/Muscat. FK sys_timezone_cd
  current_fiscal_year     TEXT         NOT NULL,               -- Label, e.g. FY2026 or 2026-2027.
  fiscal_year_start_month SMALLINT     NOT NULL,               -- 1-12; drives FISCAL_YEAR counters.
  date_format             VARCHAR(20)  NOT NULL,               -- YYYY-MM-DD | DD/MM/YYYY | MM/DD/YYYY.
  time_format             VARCHAR(5)   NOT NULL,               -- 24h | 12h.
  first_day_of_week       SMALLINT     NOT NULL,               -- 0 = Sunday ... 6 = Saturday.
  default_vat_rate        NUMERIC(5,2) NOT NULL,               -- Percent for new tenants.
  support_email           TEXT,                                -- Platform support e-mail.
  support_phone           TEXT,                                -- Platform support phone (E.164).
  default_trial_days      SMALLINT     NOT NULL,               -- Trial length for new tenants.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Row creation time.
  created_by   TEXT,                                -- Who created the row (user id or 'migration').
  created_info TEXT,                                -- Where it was created (migration name, screen, job).
  updated_at   TIMESTAMPTZ,                         -- Last update time (trigger).
  updated_by   TEXT,                                -- Who last updated the row.
  updated_info TEXT,                                -- Where it was last updated.
  updated_count INTEGER DEFAULT 0, -- then on update updated_count=updated_count+1
  
  rec_status   SMALLINT    NOT NULL DEFAULT 1,      -- 1 = live, 0 = soft-deleted.
  rec_order    INTEGER,                             -- Optional manual ordering.
  rec_notes    TEXT,                                -- Free notes.
  is_active    BOOLEAN     NOT NULL DEFAULT true,   -- Offered for new use when true.
  CONSTRAINT pk_hq_general_config PRIMARY KEY (config_id),
  CONSTRAINT ck_hq_gen_cfg_single CHECK (config_id),
  CONSTRAINT fk_hq_gen_cfg_currency FOREIGN KEY (default_currency_code) REFERENCES public.sys_currency_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_hq_gen_cfg_country FOREIGN KEY (default_country_code) REFERENCES public.sys_country_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_hq_gen_cfg_language FOREIGN KEY (default_language_code) REFERENCES public.sys_language_cd (code) ON DELETE RESTRICT,
  CONSTRAINT fk_hq_gen_cfg_timezone FOREIGN KEY (timezone) REFERENCES public.sys_timezone_cd (code) ON DELETE RESTRICT,
  CONSTRAINT ck_hq_gen_cfg_locale CHECK (locale_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  CONSTRAINT ck_hq_gen_cfg_fy CHECK (current_fiscal_year ~ '^(FY)?[0-9]{4}(-[0-9]{4})?$'),
  CONSTRAINT ck_hq_gen_cfg_fy_month CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  CONSTRAINT ck_hq_gen_cfg_date_fmt CHECK (date_format IN ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')),
  CONSTRAINT ck_hq_gen_cfg_time_fmt CHECK (time_format IN ('24h','12h')),
  CONSTRAINT ck_hq_gen_cfg_dow CHECK (first_day_of_week BETWEEN 0 AND 6),
  CONSTRAINT ck_hq_gen_cfg_vat CHECK (default_vat_rate BETWEEN 0 AND 100),
  CONSTRAINT ck_hq_gen_cfg_email CHECK (support_email IS NULL OR support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT ck_hq_gen_cfg_phone CHECK (support_phone IS NULL OR support_phone ~ '^\+[1-9][0-9]{6,14}$'),
  CONSTRAINT ck_hq_gen_cfg_trial CHECK (default_trial_days BETWEEN 0 AND 365)
);

COMMENT ON TABLE public.hq_general_config IS 'Platform defaults (exactly one row). A tenant value in org_tenants_mst wins when set; read through fn_tenant_general_value / TenantGeneralConfigService. service_role only.';
COMMENT ON COLUMN public.hq_general_config.config_id IS 'Always true; the primary key plus CHECK allow exactly one row.';
COMMENT ON COLUMN public.hq_general_config.default_currency_code IS 'Default currency for new tenants (sys_currency_cd).';
COMMENT ON COLUMN public.hq_general_config.default_country_code IS 'Default country for new tenants (sys_country_cd).';
COMMENT ON COLUMN public.hq_general_config.default_language_code IS 'Default language when a tenant has none (sys_language_cd).';
COMMENT ON COLUMN public.hq_general_config.locale_code IS 'Default BCP 47 locale, e.g. en-OM.';
COMMENT ON COLUMN public.hq_general_config.timezone IS 'Default IANA time zone; also the fallback for document counters when a tenant zone is missing or invalid.';
COMMENT ON COLUMN public.hq_general_config.current_fiscal_year IS 'Default fiscal year label shown in finance and reports, e.g. FY2026.';
COMMENT ON COLUMN public.hq_general_config.fiscal_year_start_month IS 'Default fiscal year start month 1-12; drives FISCAL_YEAR document counters.';
COMMENT ON COLUMN public.hq_general_config.date_format IS 'Default date format: YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY.';
COMMENT ON COLUMN public.hq_general_config.time_format IS 'Default time format: 24h or 12h.';
COMMENT ON COLUMN public.hq_general_config.first_day_of_week IS 'Default first day of week: 0 = Sunday ... 6 = Saturday.';
COMMENT ON COLUMN public.hq_general_config.default_vat_rate IS 'Default VAT percent for new tenants.';
COMMENT ON COLUMN public.hq_general_config.support_email IS 'Platform support e-mail shown to tenants.';
COMMENT ON COLUMN public.hq_general_config.support_phone IS 'Platform support phone in E.164.';
COMMENT ON COLUMN public.hq_general_config.default_trial_days IS 'Trial length in days for new tenants.';
COMMENT ON COLUMN public.hq_general_config.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.hq_general_config.created_by IS 'Who created the row (user id or ''migration'').';
COMMENT ON COLUMN public.hq_general_config.created_info IS 'Where the row was created (migration name, screen, job).';
COMMENT ON COLUMN public.hq_general_config.updated_at IS 'Last update time, set by trigger.';
COMMENT ON COLUMN public.hq_general_config.updated_by IS 'Who last updated the row.';
COMMENT ON COLUMN public.hq_general_config.updated_info IS 'Where the row was last updated.';
COMMENT ON COLUMN public.hq_general_config.rec_status IS 'Record status: 1 = live, 0 = soft-deleted.';
COMMENT ON COLUMN public.hq_general_config.rec_order IS 'Optional manual ordering.';
COMMENT ON COLUMN public.hq_general_config.rec_notes IS 'Free notes.';
COMMENT ON COLUMN public.hq_general_config.is_active IS 'Offered for new use when true.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_single ON public.hq_general_config IS 'Exactly one row.';
COMMENT ON CONSTRAINT fk_hq_gen_cfg_currency ON public.hq_general_config IS 'Currency; RESTRICT.';
COMMENT ON CONSTRAINT fk_hq_gen_cfg_country ON public.hq_general_config IS 'Country; RESTRICT.';
COMMENT ON CONSTRAINT fk_hq_gen_cfg_language ON public.hq_general_config IS 'Language; RESTRICT.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_locale ON public.hq_general_config IS 'BCP 47 language[-REGION].';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_fy ON public.hq_general_config IS 'FY2026 or 2026-2027 style.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_fy_month ON public.hq_general_config IS 'Month 1-12.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_date_fmt ON public.hq_general_config IS 'Allowed date formats (same list as the HQ DTO).';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_time_fmt ON public.hq_general_config IS '24h or 12h.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_dow ON public.hq_general_config IS '0 = Sunday ... 6 = Saturday.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_vat ON public.hq_general_config IS '0-100 percent.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_email ON public.hq_general_config IS 'Basic e-mail shape.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_phone ON public.hq_general_config IS 'E.164 phone.';
COMMENT ON CONSTRAINT ck_hq_gen_cfg_trial ON public.hq_general_config IS '0-365 days.';

CREATE TRIGGER trg_hq_gen_cfg_validate
  BEFORE INSERT OR UPDATE ON public.hq_general_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_hq_gen_cfg_validate();
COMMENT ON TRIGGER trg_hq_gen_cfg_validate ON public.hq_general_config IS 'Rejects an unknown time zone.';
CREATE TRIGGER trg_hq_gen_cfg_no_delete
  BEFORE DELETE ON public.hq_general_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_hq_gen_cfg_no_delete();
COMMENT ON TRIGGER trg_hq_gen_cfg_no_delete ON public.hq_general_config IS 'Blocks deleting the single row.';
CREATE TRIGGER trg_hq_gen_cfg_no_trunc
  BEFORE TRUNCATE ON public.hq_general_config
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_hq_gen_cfg_no_delete();
COMMENT ON TRIGGER trg_hq_gen_cfg_no_trunc ON public.hq_general_config IS 'Blocks truncating the single row.';
CREATE TRIGGER trg_hq_gen_cfg_upd
  BEFORE UPDATE ON public.hq_general_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_hq_gen_cfg_upd ON public.hq_general_config IS 'Sets updated_at on every update.';

ALTER TABLE public.hq_general_config ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated see nothing. HQ API (service_role) and definer functions read it.
REVOKE ALL ON TABLE public.hq_general_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.hq_general_config TO service_role;
REVOKE DELETE, TRUNCATE ON TABLE public.hq_general_config FROM service_role;

INSERT INTO public.hq_general_config (config_id, default_currency_code, default_country_code, default_language_code,
  locale_code, timezone, current_fiscal_year, fiscal_year_start_month, date_format, time_format,
  first_day_of_week, default_vat_rate, default_trial_days, created_by, created_info)
VALUES (true, 'OMR', 'OM', 'en', 'en-OM', 'Asia/Muscat', 'FY2026', 1,
  'DD/MM/YYYY', '24h', 6, 5.00, 30, 'migration', 'hq_general_config seed (A-21, approved 2026-10-30)');

-- 3. org_tenants_mst: new columns, CHECKs, defaults ---------------------------------------------------------
ALTER TABLE public.org_tenants_mst
  ADD COLUMN current_fiscal_year     TEXT,
  ADD COLUMN fiscal_year_start_month SMALLINT,
  ADD COLUMN locale_code             VARCHAR(10);
COMMENT ON COLUMN public.org_tenants_mst.current_fiscal_year IS 'Tenant fiscal year label, e.g. FY2026. NULL = use hq_general_config.current_fiscal_year.';
COMMENT ON COLUMN public.org_tenants_mst.fiscal_year_start_month IS 'Tenant fiscal year start month 1-12 (drives FISCAL_YEAR document counters). NULL = use the HQ default. Replaces setting ERP_LITE_FISCAL_YEAR_START.';
COMMENT ON COLUMN public.org_tenants_mst.locale_code IS 'Tenant BCP 47 locale, e.g. ar-OM. NULL = use the HQ default. Replaces setting TENANT_LOCALE.';

ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT ck_tenants_fy CHECK (current_fiscal_year IS NULL OR current_fiscal_year ~ '^(FY)?[0-9]{4}(-[0-9]{4})?$'),
  ADD CONSTRAINT ck_tenants_fy_month CHECK (fiscal_year_start_month IS NULL OR fiscal_year_start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT ck_tenants_locale CHECK (locale_code IS NULL OR locale_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  ADD CONSTRAINT ck_tenants_date_fmt CHECK (date_format IS NULL OR date_format IN ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')),
  ADD CONSTRAINT ck_tenants_time_fmt CHECK (time_format IS NULL OR time_format IN ('24h','12h')),
  ADD CONSTRAINT ck_tenants_dow CHECK (first_day_of_week IS NULL OR first_day_of_week BETWEEN 0 AND 6);
COMMENT ON CONSTRAINT ck_tenants_fy ON public.org_tenants_mst IS 'FY2026 or 2026-2027 style; NULL = HQ default.';
COMMENT ON CONSTRAINT ck_tenants_fy_month ON public.org_tenants_mst IS 'Month 1-12; NULL = HQ default.';
COMMENT ON CONSTRAINT ck_tenants_locale ON public.org_tenants_mst IS 'BCP 47 language[-REGION]; NULL = HQ default.';
COMMENT ON CONSTRAINT ck_tenants_date_fmt ON public.org_tenants_mst IS 'Allowed date formats (same list as the HQ DTO); NULL = HQ default.';
COMMENT ON CONSTRAINT ck_tenants_time_fmt ON public.org_tenants_mst IS '24h or 12h; NULL = HQ default.';
COMMENT ON CONSTRAINT ck_tenants_dow ON public.org_tenants_mst IS '0 = Sunday ... 6 = Saturday; NULL = HQ default.';

-- A-21: new tenants inherit HQ; existing rows keep their values.
ALTER TABLE public.org_tenants_mst
  ALTER COLUMN date_format DROP DEFAULT,
  ALTER COLUMN time_format DROP DEFAULT,
  ALTER COLUMN first_day_of_week DROP DEFAULT;
COMMENT ON COLUMN public.org_tenants_mst.date_format IS 'Tenant date format. NULL = use hq_general_config.date_format (no column default since hq_general_config). Replaces setting TENANT_DATE_FORMAT.';
COMMENT ON COLUMN public.org_tenants_mst.time_format IS 'Tenant time format 24h / 12h. NULL = use the HQ default. Replaces setting TENANT_TIME_FORMAT.';
COMMENT ON COLUMN public.org_tenants_mst.first_day_of_week IS 'Tenant first day of week 0 = Sunday ... 6 = Saturday. NULL = use the HQ default. Replaces setting TENANT_FIRST_DAY_OF_WEEK.';

CREATE FUNCTION public.fn_tenant_tz_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.timezone IS DISTINCT FROM OLD.timezone) THEN
    BEGIN
      PERFORM now() AT TIME ZONE NEW.timezone;
    EXCEPTION WHEN invalid_parameter_value THEN
      RAISE EXCEPTION 'HQ_CONFIG_BAD_TIMEZONE: %', NEW.timezone USING ERRCODE = '22023';
    END;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_tenant_tz_validate() IS 'BEFORE INSERT/UPDATE OF timezone on org_tenants_mst: rejects an unknown new or changed time zone (HQ_CONFIG_BAD_TIMEZONE). Existing values are not re-tested.';
REVOKE ALL ON FUNCTION public.fn_tenant_tz_validate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_tenants_tz_validate
  BEFORE INSERT OR UPDATE OF timezone ON public.org_tenants_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_tz_validate();
COMMENT ON TRIGGER trg_tenants_tz_validate ON public.org_tenants_mst IS 'Rejects an unknown new or changed time zone.';

-- 4. Resolution helper -------------------------------------------------------------------------------------
CREATE FUNCTION public.fn_tenant_general_value(p_tenant_id UUID, p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_role TEXT := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  t      public.org_tenants_mst%ROWTYPE;
  h      public.hq_general_config%ROWTYPE;
BEGIN
  IF v_role = 'authenticated' AND p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  ELSIF v_role NOT IN ('', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.hq_general_config WHERE config_id;
  IF p_tenant_id IS NOT NULL THEN
    SELECT * INTO t FROM public.org_tenants_mst WHERE id = p_tenant_id;
  END IF;
  RETURN CASE p_key
    WHEN 'current_fiscal_year'     THEN COALESCE(t.current_fiscal_year, h.current_fiscal_year)
    WHEN 'fiscal_year_start_month' THEN COALESCE(t.fiscal_year_start_month, h.fiscal_year_start_month)::TEXT
    WHEN 'date_format'             THEN COALESCE(t.date_format, h.date_format)
    WHEN 'time_format'             THEN COALESCE(t.time_format, h.time_format)
    WHEN 'first_day_of_week'       THEN COALESCE(t.first_day_of_week, h.first_day_of_week)::TEXT
    WHEN 'language'                THEN COALESCE(NULLIF(t.language, ''), h.default_language_code)
    WHEN 'locale_code'             THEN COALESCE(t.locale_code, h.locale_code)
    WHEN 'timezone'                THEN COALESCE(NULLIF(t.timezone, ''), h.timezone)
    ELSE NULL
  END;
END $$;
COMMENT ON FUNCTION public.fn_tenant_general_value(UUID, TEXT) IS
  'Resolution rule for general values: the tenant value (org_tenants_mst) if set, otherwise hq_general_config. Keys: current_fiscal_year, fiscal_year_start_month, date_format, time_format, first_day_of_week, language, locale_code, timezone; unknown key returns NULL. A signed-in user may read only their own tenant (DOC_SEQ_TENANT_MISMATCH, 42501). Does not validate the time zone (the engine does).';
REVOKE ALL ON FUNCTION public.fn_tenant_general_value(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_tenant_general_value(UUID, TEXT) TO authenticated, service_role;

-- 5. Point the seven deactivated settings (0652) at their new columns -----------------------------------
-- this is wrong

UPDATE public.sys_tenant_settings_cd s
   SET updated_at   = CURRENT_TIMESTAMP,
       updated_by   = 'migration',
       updated_info = 'Superseded by ' || m.target || ' (hq_general_config migration, Human-Friendly Codes P1). Do not reactivate: it would create a second source of truth.'
  FROM (VALUES ('ERP_LITE_FISCAL_YEAR_START', 'org_tenants_mst.fiscal_year_start_month / hq_general_config.fiscal_year_start_month'),
               ('TENANT_DATE_FORMAT',         'org_tenants_mst.date_format / hq_general_config.date_format'),
               ('TENANT_TIME_FORMAT',         'org_tenants_mst.time_format / hq_general_config.time_format'),
               ('TENANT_FIRST_DAY_OF_WEEK',   'org_tenants_mst.first_day_of_week / hq_general_config.first_day_of_week'),
               ('TENANT_LANGUAGE',            'org_tenants_mst.language / hq_general_config.default_language_code'),
               ('TENANT_LOCALE',              'org_tenants_mst.locale_code / hq_general_config.locale_code'),
               ('SYS_TIMEZONE',               'org_tenants_mst.timezone / hq_general_config.timezone')) AS m(code, target)
 WHERE s.setting_code = m.code
   AND s.is_active = false;

COMMIT;
