-- ============================================================================
-- Migration: 0843_cmx_dt_settings.sql
-- Purpose:   Clock and Time Zone Manager, slice S2 part 2 (MASTER_PLAN_v2 §5.1, §5.3, D6, D7, D13,
--            D29, D33, D34): the settings foundation that S3 (ClockProvider) and S6 (clock block) read.
--              1. Business-day cut-over columns (D6/D33): org_branches_mst.business_day_cutover and
--                 org_tenants_mst.business_day_cutover (TIME NULL, NULL = inherit), and the platform
--                 value hq_general_config.business_day_cutover (TIME NOT NULL DEFAULT '00:00').
--                 Allowed range 00:00-11:59 (CHECK).
--              2. Country clock defaults (D13/D7/D29): sys_country_cd.default_hour_cycle (H12/H23),
--                 default_week_start (0 = Sunday ... 6 = Saturday, like the 0668 columns), cldr_version,
--                 clock_defaults_source; seeded from Unicode CLDR 49 supplemental data for the
--                 country rows that exist (no country row is added).
--              3. Pure resolvers (mirror @cmx/clock settings.ts) and DEFINER readers:
--                 fn_cmx_dt_hour_cycle, fn_cmx_dt_week_start, fn_cmx_dt_cutover, fn_cmx_dt_date_format,
--                 fn_cmx_dt_settings (all four with their source, one call for the clock block).
--              4. fn_cmx_dt_business_date(_in), fn_cmx_dt_business_day_bounds(_in).
--              5. fn_cmx_dt_period_key gains WEEK (previous body: ROLLBACK BODY A at the end).
--              6. Health: CLOCK_COUNTRY_UNKNOWN, CLOCK_CUTOVER_INVALID, CLOCK_CUTOVER_INCONSISTENT,
--                 CLOCK_SETTING_UNRESOLVED, CLOCK_DEFAULTS_MISSING (chk + fn_shc_clock_* + registry rows).
-- Behaviour: Nothing calls the new readers yet (S3, S6, S9 do). Existing callers of
--            fn_tenant_general_value keep the tenant -> HQ meaning. Once S3 reads fn_cmx_dt_hour_cycle,
--            a tenant whose time_format is NULL shows its country's CLDR value instead of the HQ value
--            (D33, what t131u asked for). Example (CLDR 49): OM = 12-hour, week starts Saturday.
-- Sources:   Unicode CLDR release 49, common/supplemental/supplementalData.xml: timeData
--            "_preferred" (h, hb, hB, K -> H12; H, Hb, HB, k -> H23) and weekData firstDay. A territory
--            without its own entry inherits the world value 001 (H23, mon); the row's
--            clock_defaults_source then names [001]. https://cldr.unicode.org
-- Requires:  0842_cmx_dt_clock_api.sql (fn_cmx_dt_now, fn_cmx_dt_zone*, fn_cmx_dt_instant_at_zone,
--            fn_cmx_dt_period_key_in, fn_cmx_dt__guard_scope, fn_cmx_dt__shc, CLOCK domain).
-- Plan:      docs/features/Time_and_Timezone/MASTER_PLAN_v2.md §5.1, §5.3, §7.1.1, §9.4.
-- APPLY:     Only the user applies (D17), right after 0842 in the same window. After: run §10 Q11
--            (setup health), npm run prisma:pull and regenerate the web-admin and HQ database types.
-- Guard:     scripts/check-clock-contract.mjs strict set. This file reads zones only through
--            fn_cmx_dt_zone / fn_cmx_dt_zone_required.
--
-- ROLLBACK (§9.4; forward-only repository: write a NEW migration, never edit this file):
--   1. Restore fn_cmx_dt_period_key from ROLLBACK BODY A at the end of this file.
--   2. DELETE FROM public.sys_setup_health_check_cd WHERE check_code IN ('CLOCK_COUNTRY_UNKNOWN',
--      'CLOCK_CUTOVER_INVALID', 'CLOCK_CUTOVER_INCONSISTENT', 'CLOCK_SETTING_UNRESOLVED', 'CLOCK_DEFAULTS_MISSING');
--   3. DROP FUNCTION the five fn_shc_clock_* and the fn_cmx_dt_* created here (section headers list them),
--      after checking no later migration calls them (S3/S6/S9 do).
--   4. Columns: keep them unless no later slice uses them. To drop:
--      ALTER TABLE public.org_branches_mst DROP COLUMN business_day_cutover;
--      ALTER TABLE public.org_tenants_mst  DROP COLUMN business_day_cutover;
--      ALTER TABLE public.hq_general_config DROP COLUMN business_day_cutover;
--      ALTER TABLE public.sys_country_cd DROP COLUMN default_hour_cycle, DROP COLUMN default_week_start,
--        DROP COLUMN cldr_version, DROP COLUMN clock_defaults_source;
--   Data at risk: cut-over values and HQ edits of the country defaults entered after apply (export them
--   first: SELECT id, business_day_cutover FROM org_branches_mst WHERE business_day_cutover IS NOT NULL;
--   the same for org_tenants_mst; SELECT code, default_hour_cycle, default_week_start FROM sys_country_cd).
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regprocedure('public.fn_cmx_dt_period_key_in(text, text, timestamptz, smallint, smallint)') IS NULL
     OR to_regclass('public.cmx_dt_env_cf') IS NULL THEN
    RAISE EXCEPTION '0843 needs 0842_cmx_dt_clock_api.sql applied first';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Cut-over columns (D6, D33)
-- ----------------------------------------------------------------------------
ALTER TABLE public.org_branches_mst
  ADD COLUMN IF NOT EXISTS business_day_cutover TIME;  -- Branch business-day cut-over; NULL = organization value
ALTER TABLE public.org_branches_mst
  ADD CONSTRAINT ck_branches_business_day_cutover CHECK (business_day_cutover IS NULL OR business_day_cutover < TIME '12:00');
COMMENT ON COLUMN public.org_branches_mst.business_day_cutover IS
  'Business-day cut-over of this branch (D6): sales between midnight and this wall time count for the previous business day. 00:00-11:59. NULL = use the organization value, then the platform value (fn_cmx_dt_cutover).';

ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS business_day_cutover TIME;  -- Organization business-day cut-over; NULL = platform value
ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT ck_tenants_business_day_cutover CHECK (business_day_cutover IS NULL OR business_day_cutover < TIME '12:00');
COMMENT ON COLUMN public.org_tenants_mst.business_day_cutover IS
  'Organization default business-day cut-over (D6, D33). 00:00-11:59. NULL = use hq_general_config.business_day_cutover. A branch value overrides it.';

ALTER TABLE public.hq_general_config
  ADD COLUMN IF NOT EXISTS business_day_cutover TIME NOT NULL DEFAULT TIME '00:00';  -- Platform cut-over
ALTER TABLE public.hq_general_config
  ADD CONSTRAINT ck_hq_gen_cfg_cutover CHECK (business_day_cutover < TIME '12:00');
COMMENT ON COLUMN public.hq_general_config.business_day_cutover IS
  'Platform business-day cut-over (D33), used when neither the branch nor the organization sets one. 00:00 = the business day is the calendar day.';

-- ----------------------------------------------------------------------------
-- 2. Country clock defaults (D7, D13, D29)
-- ----------------------------------------------------------------------------
ALTER TABLE public.sys_country_cd
  ADD COLUMN IF NOT EXISTS default_hour_cycle    VARCHAR(3),   -- H12 | H23 (CLDR timeData)
  ADD COLUMN IF NOT EXISTS default_week_start    SMALLINT,     -- 0 = Sunday ... 6 = Saturday (CLDR weekData)
  ADD COLUMN IF NOT EXISTS cldr_version          VARCHAR(10),  -- CLDR release of the two values
  ADD COLUMN IF NOT EXISTS clock_defaults_source TEXT;         -- Where the values came from
ALTER TABLE public.sys_country_cd
  ADD CONSTRAINT ck_sys_country_hour_cycle CHECK (default_hour_cycle IS NULL OR default_hour_cycle IN ('H12', 'H23')),
  ADD CONSTRAINT ck_sys_country_week_start CHECK (default_week_start IS NULL OR default_week_start BETWEEN 0 AND 6);
COMMENT ON COLUMN public.sys_country_cd.default_hour_cycle IS
  'Country default 12/24-hour clock (D13, D29): H12 or H23, from CLDR timeData; HQ may edit. Used when the organization time_format is NULL; NULL here = use hq_general_config.time_format.';
COMMENT ON COLUMN public.sys_country_cd.default_week_start IS
  'Country default first day of the week (D7, D29): 0 = Sunday ... 6 = Saturday (5 = Friday allowed), from CLDR weekData firstDay; HQ may edit. NULL = use hq_general_config.first_day_of_week.';
COMMENT ON COLUMN public.sys_country_cd.cldr_version IS 'Unicode CLDR release the clock defaults were seeded from (D29); NULL when HQ entered them by hand.';
COMMENT ON COLUMN public.sys_country_cd.clock_defaults_source IS 'Source of default_hour_cycle / default_week_start, e.g. "CLDR 49 supplemental timeData[OM]+weekData firstDay[OM]" ([001] = world default inherited).';

-- Seed: existing country rows only. Values computed from the CLDR file by the S2 seed script.
UPDATE public.sys_country_cd c
   SET default_hour_cycle    = v.hour_cycle,
       default_week_start    = v.week_start,
       cldr_version          = '49',
       clock_defaults_source = v.source
  FROM (VALUES
('AD', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AD]+weekData firstDay[AD]'),
  ('AE', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[AE]+weekData firstDay[AE]'),
  ('AF', 'H23', 6, 'H', 'sat', 'CLDR 49 supplemental timeData[AF]+weekData firstDay[AF]'),
  ('AG', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[AG]+weekData firstDay[AG]'),
  ('AI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AI]+weekData firstDay[AI]'),
  ('AL', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[AL]+weekData firstDay[AL]'),
  ('AM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AM]+weekData firstDay[AM]'),
  ('AO', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AO]+weekData firstDay[001]'),
  ('AQ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[001]+weekData firstDay[001]'),
  ('AR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AR]+weekData firstDay[AR]'),
  ('AS', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[AS]+weekData firstDay[AS]'),
  ('AT', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AT]+weekData firstDay[AT]'),
  ('AU', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[AU]+weekData firstDay[AU]'),
  ('AW', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AW]+weekData firstDay[001]'),
  ('AX', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AX]+weekData firstDay[AX]'),
  ('AZ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[AZ]+weekData firstDay[AZ]'),
  ('BA', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BA]+weekData firstDay[BA]'),
  ('BB', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[BB]+weekData firstDay[001]'),
  ('BD', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[BD]+weekData firstDay[BD]'),
  ('BE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BE]+weekData firstDay[BE]'),
  ('BF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BF]+weekData firstDay[001]'),
  ('BG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BG]+weekData firstDay[BG]'),
  ('BH', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[BH]+weekData firstDay[BH]'),
  ('BI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BI]+weekData firstDay[001]'),
  ('BJ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BJ]+weekData firstDay[001]'),
  ('BL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BL]+weekData firstDay[001]'),
  ('BM', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[BM]+weekData firstDay[BM]'),
  ('BN', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[BN]+weekData firstDay[BN]'),
  ('BO', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[BO]+weekData firstDay[001]'),
  ('BQ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BQ]+weekData firstDay[001]'),
  ('BR', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[BR]+weekData firstDay[BR]'),
  ('BS', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[BS]+weekData firstDay[BS]'),
  ('BT', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[BT]+weekData firstDay[BT]'),
  ('BV', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[001]+weekData firstDay[001]'),
  ('BW', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[BW]+weekData firstDay[BW]'),
  ('BY', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[BY]+weekData firstDay[BY]'),
  ('BZ', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[BZ]+weekData firstDay[BZ]'),
  ('CA', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[CA]+weekData firstDay[CA]'),
  ('CC', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CC]+weekData firstDay[001]'),
  ('CD', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CD]+weekData firstDay[001]'),
  ('CF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CF]+weekData firstDay[001]'),
  ('CG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CG]+weekData firstDay[001]'),
  ('CH', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CH]+weekData firstDay[CH]'),
  ('CI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CI]+weekData firstDay[001]'),
  ('CK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CK]+weekData firstDay[001]'),
  ('CL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CL]+weekData firstDay[CL]'),
  ('CM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CM]+weekData firstDay[CM]'),
  ('CN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CN]+weekData firstDay[CN]'),
  ('CO', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[CO]+weekData firstDay[CO]'),
  ('CR', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[CR]+weekData firstDay[CR]'),
  ('CU', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[CU]+weekData firstDay[001]'),
  ('CV', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CV]+weekData firstDay[001]'),
  ('CW', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CW]+weekData firstDay[001]'),
  ('CX', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CX]+weekData firstDay[001]'),
  ('CY', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[CY]+weekData firstDay[CY]'),
  ('CZ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[CZ]+weekData firstDay[CZ]'),
  ('DE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[DE]+weekData firstDay[DE]'),
  ('DJ', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[DJ]+weekData firstDay[DJ]'),
  ('DK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[DK]+weekData firstDay[DK]'),
  ('DM', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[DM]+weekData firstDay[DM]'),
  ('DO', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[DO]+weekData firstDay[DO]'),
  ('DZ', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[DZ]+weekData firstDay[DZ]'),
  ('EC', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[EC]+weekData firstDay[EC]'),
  ('EE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[EE]+weekData firstDay[EE]'),
  ('EG', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[EG]+weekData firstDay[EG]'),
  ('EH', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[EH]+weekData firstDay[001]'),
  ('ER', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[ER]+weekData firstDay[001]'),
  ('ES', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[ES]+weekData firstDay[ES]'),
  ('ET', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[ET]+weekData firstDay[ET]'),
  ('FI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[FI]+weekData firstDay[FI]'),
  ('FJ', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[FJ]+weekData firstDay[FJ]'),
  ('FK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[FK]+weekData firstDay[001]'),
  ('FM', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[FM]+weekData firstDay[001]'),
  ('FO', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[FO]+weekData firstDay[FO]'),
  ('FR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[FR]+weekData firstDay[FR]'),
  ('GA', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GA]+weekData firstDay[001]'),
  ('GB', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GB]+weekData firstDay[GB]'),
  ('GD', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[GD]+weekData firstDay[001]'),
  ('GE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GE]+weekData firstDay[GE]'),
  ('GF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GF]+weekData firstDay[GF]'),
  ('GG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GG]+weekData firstDay[001]'),
  ('GH', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[GH]+weekData firstDay[001]'),
  ('GI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GI]+weekData firstDay[001]'),
  ('GL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GL]+weekData firstDay[001]'),
  ('GM', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[GM]+weekData firstDay[001]'),
  ('GN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GN]+weekData firstDay[001]'),
  ('GP', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GP]+weekData firstDay[GP]'),
  ('GQ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GQ]+weekData firstDay[001]'),
  ('GR', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[GR]+weekData firstDay[GR]'),
  ('GS', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GS]+weekData firstDay[001]'),
  ('GT', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[GT]+weekData firstDay[GT]'),
  ('GU', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[GU]+weekData firstDay[GU]'),
  ('GW', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[GW]+weekData firstDay[001]'),
  ('GY', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[GY]+weekData firstDay[001]'),
  ('HK', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[HK]+weekData firstDay[HK]'),
  ('HM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[001]+weekData firstDay[001]'),
  ('HN', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[HN]+weekData firstDay[HN]'),
  ('HR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[HR]+weekData firstDay[HR]'),
  ('HT', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[HT]+weekData firstDay[001]'),
  ('HU', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[HU]+weekData firstDay[HU]'),
  ('ID', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[ID]+weekData firstDay[ID]'),
  ('IE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[IE]+weekData firstDay[IE]'),
  ('IL', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[IL]+weekData firstDay[IL]'),
  ('IM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[IM]+weekData firstDay[001]'),
  ('IN', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[IN]+weekData firstDay[IN]'),
  ('IO', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[IO]+weekData firstDay[001]'),
  ('IQ', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[IQ]+weekData firstDay[IQ]'),
  ('IR', 'H23', 6, 'H', 'sat', 'CLDR 49 supplemental timeData[IR]+weekData firstDay[IR]'),
  ('IS', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[IS]+weekData firstDay[IS]'),
  ('IT', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[IT]+weekData firstDay[IT]'),
  ('JE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[JE]+weekData firstDay[001]'),
  ('JM', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[JM]+weekData firstDay[JM]'),
  ('JO', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[JO]+weekData firstDay[JO]'),
  ('JP', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[JP]+weekData firstDay[JP]'),
  ('KE', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[KE]+weekData firstDay[KE]'),
  ('KG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[KG]+weekData firstDay[KG]'),
  ('KH', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[KH]+weekData firstDay[KH]'),
  ('KI', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[KI]+weekData firstDay[001]'),
  ('KM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[KM]+weekData firstDay[001]'),
  ('KN', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[KN]+weekData firstDay[001]'),
  ('KP', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[KP]+weekData firstDay[001]'),
  ('KR', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[KR]+weekData firstDay[KR]'),
  ('KW', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[KW]+weekData firstDay[KW]'),
  ('KY', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[KY]+weekData firstDay[001]'),
  ('KZ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[KZ]+weekData firstDay[KZ]'),
  ('LA', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[LA]+weekData firstDay[LA]'),
  ('LB', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[LB]+weekData firstDay[LB]'),
  ('LC', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[LC]+weekData firstDay[001]'),
  ('LI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[LI]+weekData firstDay[LI]'),
  ('LK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[LK]+weekData firstDay[LK]'),
  ('LR', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[LR]+weekData firstDay[001]'),
  ('LS', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[LS]+weekData firstDay[001]'),
  ('LT', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[LT]+weekData firstDay[LT]'),
  ('LU', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[LU]+weekData firstDay[LU]'),
  ('LV', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[LV]+weekData firstDay[LV]'),
  ('LY', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[LY]+weekData firstDay[LY]'),
  ('MA', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MA]+weekData firstDay[001]'),
  ('MC', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MC]+weekData firstDay[MC]'),
  ('MD', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MD]+weekData firstDay[MD]'),
  ('ME', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[ME]+weekData firstDay[ME]'),
  ('MF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MF]+weekData firstDay[001]'),
  ('MG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MG]+weekData firstDay[001]'),
  ('MH', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[MH]+weekData firstDay[MH]'),
  ('MK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MK]+weekData firstDay[MK]'),
  ('ML', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[ML]+weekData firstDay[001]'),
  ('MM', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[MM]+weekData firstDay[MM]'),
  ('MN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MN]+weekData firstDay[MN]'),
  ('MO', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[MO]+weekData firstDay[MO]'),
  ('MP', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[MP]+weekData firstDay[001]'),
  ('MQ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MQ]+weekData firstDay[MQ]'),
  ('MR', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[MR]+weekData firstDay[001]'),
  ('MS', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MS]+weekData firstDay[001]'),
  ('MT', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[MT]+weekData firstDay[MT]'),
  ('MU', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[MU]+weekData firstDay[001]'),
  ('MV', 'H23', 5, 'H', 'fri', 'CLDR 49 supplemental timeData[MV]+weekData firstDay[MV]'),
  ('MW', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[MW]+weekData firstDay[001]'),
  ('MX', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[MX]+weekData firstDay[MX]'),
  ('MY', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[MY]+weekData firstDay[MY]'),
  ('MZ', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[MZ]+weekData firstDay[MZ]'),
  ('NA', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[NA]+weekData firstDay[001]'),
  ('NC', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NC]+weekData firstDay[001]'),
  ('NE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NE]+weekData firstDay[001]'),
  ('NF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NF]+weekData firstDay[001]'),
  ('NG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NG]+weekData firstDay[001]'),
  ('NI', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[NI]+weekData firstDay[NI]'),
  ('NL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NL]+weekData firstDay[NL]'),
  ('NO', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NO]+weekData firstDay[NO]'),
  ('NP', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[NP]+weekData firstDay[NP]'),
  ('NR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NR]+weekData firstDay[001]'),
  ('NU', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[NU]+weekData firstDay[001]'),
  ('NZ', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[NZ]+weekData firstDay[NZ]'),
  ('OM', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[OM]+weekData firstDay[OM]'),
  ('PA', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[PA]+weekData firstDay[PA]'),
  ('PE', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[PE]+weekData firstDay[PE]'),
  ('PF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[PF]+weekData firstDay[001]'),
  ('PG', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[PG]+weekData firstDay[001]'),
  ('PH', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[PH]+weekData firstDay[PH]'),
  ('PK', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[PK]+weekData firstDay[PK]'),
  ('PL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[PL]+weekData firstDay[PL]'),
  ('PM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[PM]+weekData firstDay[001]'),
  ('PN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[PN]+weekData firstDay[001]'),
  ('PR', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[PR]+weekData firstDay[PR]'),
  ('PS', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[PS]+weekData firstDay[001]'),
  ('PT', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[PT]+weekData firstDay[PT]'),
  ('PW', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[PW]+weekData firstDay[001]'),
  ('PY', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[PY]+weekData firstDay[PY]'),
  ('QA', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[QA]+weekData firstDay[QA]'),
  ('RE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[RE]+weekData firstDay[RE]'),
  ('RO', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[RO]+weekData firstDay[RO]'),
  ('RS', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[RS]+weekData firstDay[RS]'),
  ('RU', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[RU]+weekData firstDay[RU]'),
  ('RW', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[RW]+weekData firstDay[001]'),
  ('SA', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[SA]+weekData firstDay[SA]'),
  ('SB', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[SB]+weekData firstDay[001]'),
  ('SC', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SC]+weekData firstDay[001]'),
  ('SD', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[SD]+weekData firstDay[SD]'),
  ('SE', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SE]+weekData firstDay[SE]'),
  ('SG', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[SG]+weekData firstDay[SG]'),
  ('SH', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SH]+weekData firstDay[001]'),
  ('SI', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SI]+weekData firstDay[SI]'),
  ('SJ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SJ]+weekData firstDay[001]'),
  ('SK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SK]+weekData firstDay[SK]'),
  ('SL', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[SL]+weekData firstDay[001]'),
  ('SM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SM]+weekData firstDay[SM]'),
  ('SN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SN]+weekData firstDay[001]'),
  ('SO', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[SO]+weekData firstDay[001]'),
  ('SR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SR]+weekData firstDay[001]'),
  ('SS', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[SS]+weekData firstDay[001]'),
  ('ST', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[ST]+weekData firstDay[001]'),
  ('SV', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[SV]+weekData firstDay[SV]'),
  ('SX', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[SX]+weekData firstDay[001]'),
  ('SY', 'H12', 6, 'h', 'sat', 'CLDR 49 supplemental timeData[SY]+weekData firstDay[SY]'),
  ('SZ', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[SZ]+weekData firstDay[001]'),
  ('TC', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[TC]+weekData firstDay[001]'),
  ('TD', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[TD]+weekData firstDay[001]'),
  ('TF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TF]+weekData firstDay[001]'),
  ('TG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TG]+weekData firstDay[001]'),
  ('TH', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[TH]+weekData firstDay[TH]'),
  ('TJ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TJ]+weekData firstDay[TJ]'),
  ('TK', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[001]+weekData firstDay[001]'),
  ('TL', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TL]+weekData firstDay[001]'),
  ('TM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TM]+weekData firstDay[TM]'),
  ('TN', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[TN]+weekData firstDay[001]'),
  ('TO', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[TO]+weekData firstDay[001]'),
  ('TR', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TR]+weekData firstDay[TR]'),
  ('TT', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[TT]+weekData firstDay[TT]'),
  ('TV', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[001]+weekData firstDay[001]'),
  ('TW', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[TW]+weekData firstDay[TW]'),
  ('TZ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[TZ]+weekData firstDay[001]'),
  ('UA', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[UA]+weekData firstDay[UA]'),
  ('UG', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[UG]+weekData firstDay[001]'),
  ('UM', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[UM]+weekData firstDay[UM]'),
  ('US', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[US]+weekData firstDay[US]'),
  ('UY', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[UY]+weekData firstDay[UY]'),
  ('UZ', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[UZ]+weekData firstDay[UZ]'),
  ('VA', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[VA]+weekData firstDay[VA]'),
  ('VC', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[VC]+weekData firstDay[001]'),
  ('VE', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[VE]+weekData firstDay[VE]'),
  ('VG', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[VG]+weekData firstDay[001]'),
  ('VI', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[VI]+weekData firstDay[VI]'),
  ('VN', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[VN]+weekData firstDay[VN]'),
  ('VU', 'H12', 1, 'h', 'mon', 'CLDR 49 supplemental timeData[VU]+weekData firstDay[001]'),
  ('WF', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[WF]+weekData firstDay[001]'),
  ('WS', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[WS]+weekData firstDay[WS]'),
  ('YE', 'H12', 0, 'h', 'sun', 'CLDR 49 supplemental timeData[YE]+weekData firstDay[YE]'),
  ('YT', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[YT]+weekData firstDay[001]'),
  ('ZA', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[ZA]+weekData firstDay[ZA]'),
  ('ZM', 'H23', 1, 'H', 'mon', 'CLDR 49 supplemental timeData[ZM]+weekData firstDay[001]'),
  ('ZW', 'H23', 0, 'H', 'sun', 'CLDR 49 supplemental timeData[ZW]+weekData firstDay[ZW]')
       ) AS v(code, hour_cycle, week_start, cldr_pref, cldr_firstday, source)
 WHERE c.code = v.code;


-- ----------------------------------------------------------------------------
-- 3. Pure resolvers (no table reads; mirror @cmx/clock settings.ts and the settings vectors)
--    fn_cmx_dt__resolve_hour_cycle, fn_cmx_dt__resolve_week_start, fn_cmx_dt__resolve_cutover,
--    fn_cmx_dt__resolve_date_format, fn_cmx_dt__check_cutover
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_cmx_dt__resolve_hour_cycle(p_tenant TEXT, p_country TEXT, p_platform TEXT)
RETURNS TABLE (value TEXT, source TEXT)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_raw TEXT;
BEGIN
  IF nullif(p_tenant, '') IS NOT NULL THEN
    v_raw := p_tenant; source := 'tenant';
  ELSIF nullif(p_country, '') IS NOT NULL THEN
    v_raw := p_country; source := 'country';
  ELSIF nullif(p_platform, '') IS NOT NULL THEN
    v_raw := p_platform; source := 'platform';
  ELSE
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: hourCycle platform value missing' USING ERRCODE = '22023';
  END IF;
  value := CASE WHEN v_raw IN ('24h', 'H23', 'h23') THEN 'h23'
                WHEN v_raw IN ('12h', 'H12', 'h12') THEN 'h12' END;
  IF value IS NULL THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: hourCycle %', v_raw USING ERRCODE = '22023';
  END IF;
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__resolve_hour_cycle(TEXT, TEXT, TEXT) IS
  'Pure hour-cycle resolution (D33): first set value of tenant (24h/12h), country (H23/H12), platform (24h/12h); returns the wire value h23/h12 and its source. Nothing set or a bad value raises CLOCK_SETTING_INVALID. Mirror of resolveHourCycle.';

CREATE FUNCTION public.fn_cmx_dt__resolve_week_start(p_tenant SMALLINT, p_country SMALLINT, p_platform SMALLINT)
RETURNS TABLE (value SMALLINT, source TEXT)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_dow SMALLINT;
BEGIN
  IF p_tenant IS NOT NULL THEN
    v_dow := p_tenant; source := 'tenant';
  ELSIF p_country IS NOT NULL THEN
    v_dow := p_country; source := 'country';
  ELSIF p_platform IS NOT NULL THEN
    v_dow := p_platform; source := 'platform';
  ELSE
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: weekStart platform value missing' USING ERRCODE = '22023';
  END IF;
  IF v_dow NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: weekStart %', v_dow USING ERRCODE = '22023';
  END IF;
  value := CASE WHEN v_dow = 0 THEN 7 ELSE v_dow END;
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__resolve_week_start(SMALLINT, SMALLINT, SMALLINT) IS
  'Pure week-start resolution (D7, D33): first set value of tenant, country, platform in the stored 0..6 encoding (0 = Sunday); returns the ISO weekday 1..7 (Sunday = 7) and its source. Nothing set or a value outside 0..6 raises CLOCK_SETTING_INVALID. Mirror of resolveWeekStart.';

CREATE FUNCTION public.fn_cmx_dt__check_cutover(p_value TEXT)
RETURNS TIME
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_t TIME;
BEGIN
  IF p_value IS NULL OR p_value !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: cutover %', coalesce(p_value, '<null>') USING ERRCODE = '22023';
  END IF;
  v_t := p_value::TIME;
  IF v_t >= TIME '12:00' THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: cutover % (allowed 00:00-11:59)', p_value USING ERRCODE = '22023';
  END IF;
  RETURN v_t;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__check_cutover(TEXT) IS
  'A cut-over must be HH:mm or HH:mm:ss between 00:00 and 11:59 (D6); otherwise CLOCK_SETTING_INVALID. Mirror of assertCutover.';

CREATE FUNCTION public.fn_cmx_dt__resolve_cutover(p_branch TEXT, p_tenant TEXT, p_platform TEXT)
RETURNS TABLE (value TIME, source TEXT)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF nullif(p_branch, '') IS NOT NULL THEN
    value := public.fn_cmx_dt__check_cutover(p_branch); source := 'branch';
  ELSIF nullif(p_tenant, '') IS NOT NULL THEN
    value := public.fn_cmx_dt__check_cutover(p_tenant); source := 'tenant';
  ELSIF nullif(p_platform, '') IS NOT NULL THEN
    value := public.fn_cmx_dt__check_cutover(p_platform); source := 'platform';
  ELSE
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: cutover platform value missing' USING ERRCODE = '22023';
  END IF;
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__resolve_cutover(TEXT, TEXT, TEXT) IS
  'Pure cut-over resolution (D6, D33): first set value of branch, tenant, platform (HH:mm text), checked by fn_cmx_dt__check_cutover; returns the time and its source. Mirror of resolveCutover.';

CREATE FUNCTION public.fn_cmx_dt__resolve_date_format(p_tenant TEXT, p_platform TEXT)
RETURNS TABLE (value TEXT, source TEXT)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF nullif(p_tenant, '') IS NOT NULL THEN
    value := p_tenant; source := 'tenant';
  ELSIF nullif(p_platform, '') IS NOT NULL THEN
    value := p_platform; source := 'platform';
  ELSE
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: dateFormat platform value missing' USING ERRCODE = '22023';
  END IF;
  IF value NOT IN ('YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY') THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: dateFormat %', value USING ERRCODE = '22023';
  END IF;
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__resolve_date_format(TEXT, TEXT) IS
  'Pure date-format resolution (D34): tenant, else platform; YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY, otherwise CLOCK_SETTING_INVALID. Mirror of resolveDateFormat.';


-- ----------------------------------------------------------------------------
-- 4. DEFINER readers (§5.1, D33, D34). The organization row, hq_general_config (service only) and the
--    country row are read here; a signed-in user may ask only about the session organization.
--    fn_cmx_dt__guard_tenant_read, fn_cmx_dt_settings, fn_cmx_dt_hour_cycle, fn_cmx_dt_week_start,
--    fn_cmx_dt_cutover, fn_cmx_dt_date_format
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_cmx_dt__guard_tenant_read(p_tenant UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: organization is required' USING ERRCODE = '22004';
  END IF;
  -- Same rule as fn_ops_zone: a user JWT reads only the session organization; server connections pass.
  IF auth.uid() IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role'
     AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'CLOCK_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt__guard_tenant_read(UUID) IS
  'Internal guard of the clock setting readers: p_tenant is required (22004); a signed-in user may read only the session organization (CLOCK_TENANT_MISMATCH, 42501). Server connections and service_role pass.';

CREATE FUNCTION public.fn_cmx_dt_settings(p_tenant UUID, p_branch UUID DEFAULT NULL)
RETURNS TABLE (hour_cycle TEXT, hour_cycle_source TEXT,
               week_start SMALLINT, week_start_source TEXT,
               cutover TIME, cutover_source TEXT,
               date_format TEXT, date_format_source TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_t_hc TEXT; v_t_ws SMALLINT; v_t_co TIME; v_t_df TEXT; v_country TEXT;
  v_b_co TIME;
  v_c_hc TEXT; v_c_ws SMALLINT;
  v_h_hc TEXT; v_h_ws SMALLINT; v_h_co TIME; v_h_df TEXT;
BEGIN
  PERFORM public.fn_cmx_dt__guard_tenant_read(p_tenant);
  SELECT t.time_format, t.first_day_of_week::SMALLINT, t.business_day_cutover, t.date_format, upper(btrim(t.country))
    INTO v_t_hc, v_t_ws, v_t_co, v_t_df, v_country
    FROM public.org_tenants_mst t WHERE t.id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: organization % not found', p_tenant USING ERRCODE = '22023';
  END IF;
  IF p_branch IS NOT NULL THEN
    SELECT b.business_day_cutover INTO v_b_co
      FROM public.org_branches_mst b WHERE b.id = p_branch AND b.tenant_org_id = p_tenant;
  END IF;
  SELECT c.default_hour_cycle, c.default_week_start INTO v_c_hc, v_c_ws
    FROM public.sys_country_cd c WHERE c.code = v_country;
  SELECT h.time_format, h.first_day_of_week, h.business_day_cutover, h.date_format
    INTO v_h_hc, v_h_ws, v_h_co, v_h_df
    FROM public.hq_general_config h WHERE h.config_id;
  SELECT r.value, r.source INTO hour_cycle, hour_cycle_source FROM public.fn_cmx_dt__resolve_hour_cycle(v_t_hc, v_c_hc, v_h_hc) r;
  SELECT r.value, r.source INTO week_start, week_start_source FROM public.fn_cmx_dt__resolve_week_start(v_t_ws, v_c_ws, v_h_ws) r;
  SELECT r.value, r.source INTO cutover, cutover_source
    FROM public.fn_cmx_dt__resolve_cutover(to_char(v_b_co, 'HH24:MI:SS'), to_char(v_t_co, 'HH24:MI:SS'), to_char(v_h_co, 'HH24:MI:SS')) r;
  SELECT r.value, r.source INTO date_format, date_format_source FROM public.fn_cmx_dt__resolve_date_format(v_t_df, v_h_df) r;
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_settings(UUID, UUID) IS
  'All clock settings of one organization (and branch p_branch for the cut-over) with their source, in one call for the clock block (S6) and ClockProvider (S3). hour_cycle h12/h23 and week_start ISO 1..7: tenant -> country (CLDR, D29) -> hq_general_config; cutover: branch -> tenant -> hq_general_config; date_format: tenant -> hq_general_config (D33, D34). A branch of another organization is ignored. Raises CLOCK_SETTING_INVALID when a platform value is missing or a stored value is bad; CLOCK_TENANT_MISMATCH for another organization.';

CREATE FUNCTION public.fn_cmx_dt_hour_cycle(p_tenant UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT s.hour_cycle FROM public.fn_cmx_dt_settings(p_tenant, NULL) s
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_hour_cycle(UUID) IS
  'Hour cycle of the organization: h12 or h23 (org_tenants_mst.time_format -> sys_country_cd.default_hour_cycle -> hq_general_config.time_format; D13, D33). TS mirror dtHourCycle.';

CREATE FUNCTION public.fn_cmx_dt_week_start(p_tenant UUID)
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT s.week_start FROM public.fn_cmx_dt_settings(p_tenant, NULL) s
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_week_start(UUID) IS
  'First day of the week of the organization as ISO weekday 1 (Monday) .. 7 (Sunday) (first_day_of_week -> sys_country_cd.default_week_start -> hq_general_config; D7, D33). TS mirror dtWeekStart.';

CREATE FUNCTION public.fn_cmx_dt_cutover(p_tenant UUID, p_branch UUID DEFAULT NULL)
RETURNS TIME
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT s.cutover FROM public.fn_cmx_dt_settings(p_tenant, p_branch) s
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_cutover(UUID, UUID) IS
  'Business-day cut-over: org_branches_mst.business_day_cutover (p_branch) -> org_tenants_mst.business_day_cutover -> hq_general_config.business_day_cutover (D6, D33). TS mirror dtCutover.';

CREATE FUNCTION public.fn_cmx_dt_date_format(p_tenant UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT s.date_format FROM public.fn_cmx_dt_settings(p_tenant, NULL) s
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_date_format(UUID) IS
  'Date format of the organization: YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY (org_tenants_mst.date_format -> hq_general_config.date_format; D34; same answer as fn_tenant_general_value(date_format), validated). TS mirror dtDateFormat.';


-- ----------------------------------------------------------------------------
-- 5. Business date (D6, §5.1): fn_cmx_dt_business_date_in, fn_cmx_dt_business_date,
--    fn_cmx_dt_business_day_bounds_in, fn_cmx_dt_business_day_bounds
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_cmx_dt_business_date_in(p_zone TEXT, p_cutover TIME, p_at TIMESTAMPTZ DEFAULT public.fn_cmx_dt_now())
RETURNS DATE
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_cut TIME := public.fn_cmx_dt__check_cutover(to_char(p_cutover, 'HH24:MI:SS'));
BEGIN
  IF nullif(p_zone, '') IS NULL THEN
    RAISE EXCEPTION 'TIMEZONE_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'fn_cmx_dt_business_date_in: empty zone';
  END IF;
  IF p_at IS NULL THEN
    RETURN NULL;
  END IF;
  -- Wall clock minus the cut-over: a DST day needs no special case.
  RETURN (public.fn_cmx_dt_to_local(p_at, p_zone) - (v_cut - TIME '00:00'))::DATE;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_business_date_in(TEXT, TIME, TIMESTAMPTZ) IS
  'Business date of instant p_at (default fn_cmx_dt_now()) in the explicit zone p_zone with cut-over p_cutover (00:00-11:59): ((p_at AT TIME ZONE zone) - cutover)::date. Example: Asia/Muscat, cut-over 04:00, 02:00 local on 27 Nov -> 26 Nov. Raises TIMEZONE_NOT_CONFIGURED / CLOCK_SETTING_INVALID. TS mirror dtBusinessDate.';

CREATE FUNCTION public.fn_cmx_dt_business_date(p_tenant UUID, p_operation TEXT, p_scope UUID DEFAULT NULL,
                                               p_at TIMESTAMPTZ DEFAULT public.fn_cmx_dt_now())
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT public.fn_cmx_dt_business_date_in(public.fn_cmx_dt_zone_required(p_tenant, p_operation, p_scope),
                                           public.fn_cmx_dt_cutover(p_tenant, p_scope), p_at)
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_business_date(UUID, TEXT, UUID, TIMESTAMPTZ) IS
  'Business date at p_at (default fn_cmx_dt_now()) for (p_tenant, p_operation, p_scope): operations zone (fn_cmx_dt_zone_required) and cut-over (fn_cmx_dt_cutover; p_scope is the owning branch). With every cut-over NULL it equals fn_cmx_dt_today. Resolve once per query, not per row. TS mirror dtBusinessDate.';

CREATE FUNCTION public.fn_cmx_dt_business_day_bounds_in(p_zone TEXT, p_cutover TIME, p_from DATE, p_to_exclusive DATE)
RETURNS TABLE (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_cut TIME := public.fn_cmx_dt__check_cutover(to_char(p_cutover, 'HH24:MI:SS'));
BEGIN
  IF p_from IS NULL OR p_to_exclusive IS NULL OR p_to_exclusive < p_from THEN
    RAISE EXCEPTION 'INVALID_CIVIL_DATE: % .. %', p_from, p_to_exclusive
      USING ERRCODE = '22007', DETAIL = 'p_to_exclusive must be on or after p_from';
  END IF;
  -- A cut-over inside a DST gap moves to the later side (compatible), same as dtBusinessDayBounds.
  start_at := public.fn_cmx_dt_instant_at_zone(p_zone, p_from, v_cut, 'compatible');
  end_at   := public.fn_cmx_dt_instant_at_zone(p_zone, p_to_exclusive, v_cut, 'compatible');
  RETURN NEXT;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_business_day_bounds_in(TEXT, TIME, DATE, DATE) IS
  'Half-open instant range [ (p_from, cutover), (p_to_exclusive, cutover) ) of business days in the explicit zone p_zone, each end resolved with compatible. For tables without a stored business_date. TS mirror dtBusinessDayBounds.';

CREATE FUNCTION public.fn_cmx_dt_business_day_bounds(p_tenant UUID, p_operation TEXT, p_scope UUID,
                                                     p_from DATE, p_to_exclusive DATE)
RETURNS TABLE (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT b.start_at, b.end_at
    FROM public.fn_cmx_dt_business_day_bounds_in(public.fn_cmx_dt_zone_required(p_tenant, p_operation, p_scope),
                                                 public.fn_cmx_dt_cutover(p_tenant, p_scope), p_from, p_to_exclusive) b
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_business_day_bounds(UUID, TEXT, UUID, DATE, DATE) IS
  'Business-day instant range for (p_tenant, p_operation, p_scope) from p_from to p_to_exclusive (operations zone and cut-over resolved once). TS mirror dtBusinessDayBounds.';

-- ----------------------------------------------------------------------------
-- 6. fn_cmx_dt_period_key gains WEEK (week start from fn_cmx_dt_week_start). Previous body: ROLLBACK BODY A.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cmx_dt_period_key(p_tenant UUID, p_operation TEXT, p_scope UUID, p_grain TEXT,
                                                       p_at TIMESTAMPTZ DEFAULT public.fn_cmx_dt_now())
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_zone TEXT;
  v_fy   SMALLINT;
  v_ws   SMALLINT;
BEGIN
  IF p_grain IS NULL OR p_grain NOT IN ('DAY', 'WEEK', 'MONTH', 'YEAR', 'FY') THEN
    RAISE EXCEPTION 'CLOCK_SETTING_INVALID: grain %', coalesce(p_grain, '<null>') USING ERRCODE = '22023';
  END IF;
  v_zone := public.fn_cmx_dt_zone_required(p_tenant, p_operation, p_scope);
  IF p_grain = 'FY' THEN
    v_fy := public.fn_tenant_general_value(p_tenant, 'fiscal_year_start_month')::SMALLINT;
  ELSIF p_grain = 'WEEK' THEN
    v_ws := public.fn_cmx_dt_week_start(p_tenant);
  END IF;
  RETURN public.fn_cmx_dt_period_key_in(v_zone, p_grain, p_at, v_ws, v_fy);
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_period_key(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ) IS
  'Period key of p_at (default fn_cmx_dt_now()) in the operations zone of (p_tenant, p_operation, p_scope). p_grain DAY YYYYMMDD, WEEK W + first civil date of the week (week start: fn_cmx_dt_week_start, e.g. W20261121 for a Saturday week), MONTH YYYYMM, YEAR YYYY, FY FY + start year (fiscal start month via fn_tenant_general_value). Raises TIMEZONE_NOT_CONFIGURED / CLOCK_SETTING_INVALID. TS mirror dtPeriodKey.';
-- Grants unchanged from 0842 (CREATE OR REPLACE keeps them); repeated so the file states them.
REVOKE ALL ON FUNCTION public.fn_cmx_dt_period_key(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cmx_dt_period_key(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. Health (§5.3): fn_cmx_dt_chk_country_unknown, fn_cmx_dt_chk_cutover_invalid,
--    fn_cmx_dt_chk_cutover_inconsistent, fn_cmx_dt_chk_setting_unresolved, fn_cmx_dt_chk_defaults_missing.
--    fn_cmx_dt_health (0842) discovers them; no aggregator change.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_cmx_dt_chk_country_unknown(p_tenant UUID DEFAULT NULL)
RETURNS TABLE (check_code TEXT, severity TEXT, tenant_org_id UUID, branch_id UUID, detail JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_cmx_dt__guard_scope(p_tenant);
  RETURN QUERY
  SELECT 'CLOCK_COUNTRY_UNKNOWN'::TEXT, 'warning'::TEXT, t.id, NULL::UUID,
         jsonb_build_object('country', t.country)
    FROM public.org_tenants_mst t
   WHERE ((p_tenant IS NULL AND t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1) OR t.id = p_tenant)
     AND NOT EXISTS (SELECT 1 FROM public.sys_country_cd c WHERE c.code = upper(btrim(t.country)));
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_chk_country_unknown(UUID) IS
  'Health CLOCK_COUNTRY_UNKNOWN (warning): org_tenants_mst.country is empty or not a sys_country_cd code, so the country step of hour-cycle / week-start resolution is skipped (D33).';

CREATE FUNCTION public.fn_cmx_dt_chk_cutover_invalid(p_tenant UUID DEFAULT NULL)
RETURNS TABLE (check_code TEXT, severity TEXT, tenant_org_id UUID, branch_id UUID, detail JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_cmx_dt__guard_scope(p_tenant);
  -- The column CHECKs make this impossible today; the check stays for rows written while a CHECK
  -- is dropped or NOT VALID (and documents the rule for the HQ screens).
  RETURN QUERY
  SELECT 'CLOCK_CUTOVER_INVALID'::TEXT, 'error'::TEXT, t.id, NULL::UUID,
         jsonb_build_object('kind', 'tenant', 'cutover', to_char(t.business_day_cutover, 'HH24:MI'))
    FROM public.org_tenants_mst t
   WHERE ((p_tenant IS NULL AND t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1) OR t.id = p_tenant)
     AND t.business_day_cutover >= TIME '12:00'
  UNION ALL
  SELECT 'CLOCK_CUTOVER_INVALID', 'error', b.tenant_org_id, b.id,
         jsonb_build_object('kind', 'branch', 'cutover', to_char(b.business_day_cutover, 'HH24:MI'))
    FROM public.org_branches_mst b
   WHERE (p_tenant IS NULL OR b.tenant_org_id = p_tenant)
     AND b.is_active IS TRUE AND coalesce(b.rec_status, 1) = 1
     AND b.business_day_cutover >= TIME '12:00'
  UNION ALL
  SELECT 'CLOCK_CUTOVER_INVALID', 'error', NULL::UUID, NULL::UUID,
         jsonb_build_object('kind', 'hq', 'cutover', to_char(h.business_day_cutover, 'HH24:MI'))
    FROM public.hq_general_config h
   WHERE p_tenant IS NULL AND h.config_id AND h.business_day_cutover >= TIME '12:00';
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_chk_cutover_invalid(UUID) IS
  'Health CLOCK_CUTOVER_INVALID (error): an organization, active-branch or (platform view) HQ business-day cut-over outside 00:00-11:59 (D6).';

CREATE FUNCTION public.fn_cmx_dt_chk_cutover_inconsistent(p_tenant UUID DEFAULT NULL)
RETURNS TABLE (check_code TEXT, severity TEXT, tenant_org_id UUID, branch_id UUID, detail JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_cmx_dt__guard_scope(p_tenant);
  RETURN QUERY
  WITH br AS (
    SELECT b.id, b.tenant_org_id, b.business_day_cutover AS cutover
      FROM public.org_branches_mst b
      JOIN public.org_tenants_mst t ON t.id = b.tenant_org_id
     WHERE (p_tenant IS NULL OR b.tenant_org_id = p_tenant)
       AND b.is_active IS TRUE AND coalesce(b.rec_status, 1) = 1
       AND t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1
       AND b.business_day_cutover IS NOT NULL
  )
  -- warning: an override on a branch whose day cannot be computed (no zone).
  SELECT 'CLOCK_CUTOVER_INCONSISTENT'::TEXT, 'warning'::TEXT, br.tenant_org_id, br.id,
         jsonb_build_object('reason', 'branch_without_zone', 'cutover', to_char(br.cutover, 'HH24:MI'))
    FROM br
   WHERE public.fn_cmx_dt_zone(br.tenant_org_id, 'pos_session', br.id) IS NULL
  UNION ALL
  -- info: branches of one organization differ by more than 6 hours.
  SELECT 'CLOCK_CUTOVER_INCONSISTENT', 'info', br.tenant_org_id, NULL::UUID,
         jsonb_build_object('reason', 'branches_differ', 'min', to_char(min(br.cutover), 'HH24:MI'), 'max', to_char(max(br.cutover), 'HH24:MI'))
    FROM br
   GROUP BY br.tenant_org_id
  HAVING max(br.cutover) - min(br.cutover) > INTERVAL '6 hours'
  UNION ALL
  -- info: branch overrides while the organization has no default.
  SELECT 'CLOCK_CUTOVER_INCONSISTENT', 'info', br.tenant_org_id, br.id,
         jsonb_build_object('reason', 'no_organization_default', 'cutover', to_char(br.cutover, 'HH24:MI'))
    FROM br
    JOIN public.org_tenants_mst t ON t.id = br.tenant_org_id
   WHERE t.business_day_cutover IS NULL;
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_chk_cutover_inconsistent(UUID) IS
  'Health CLOCK_CUTOVER_INCONSISTENT: warning when a branch cut-over is set on a branch without a usable zone; info when branches of one organization differ by more than 6 hours, or a branch overrides while the organization has no default (D6). Info rows never fail the setup-health check.';

CREATE FUNCTION public.fn_cmx_dt_chk_setting_unresolved(p_tenant UUID DEFAULT NULL)
RETURNS TABLE (check_code TEXT, severity TEXT, tenant_org_id UUID, branch_id UUID, detail JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_cmx_dt__guard_scope(p_tenant);
  RETURN QUERY
  SELECT 'CLOCK_SETTING_UNRESOLVED'::TEXT, 'warning'::TEXT, t.id, NULL::UUID,
         jsonb_build_object('settings', to_jsonb(array_remove(ARRAY[
           CASE WHEN t.time_format IS NULL AND c.default_hour_cycle IS NULL THEN 'hourCycle' END,
           CASE WHEN t.first_day_of_week IS NULL AND c.default_week_start IS NULL THEN 'weekStart' END], NULL)),
           'country', t.country)
    FROM public.org_tenants_mst t
    LEFT JOIN public.sys_country_cd c ON c.code = upper(btrim(t.country))
   WHERE ((p_tenant IS NULL AND t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1) OR t.id = p_tenant)
     AND ((t.time_format IS NULL AND c.default_hour_cycle IS NULL)
          OR (t.first_day_of_week IS NULL AND c.default_week_start IS NULL));
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_chk_setting_unresolved(UUID) IS
  'Health CLOCK_SETTING_UNRESOLVED (warning): the organization time_format or first_day_of_week is NULL and its country has no default, so the platform value is used (D13, D33). Fix: set the value, or have HQ set the country default.';

CREATE FUNCTION public.fn_cmx_dt_chk_defaults_missing(p_tenant UUID DEFAULT NULL)
RETURNS TABLE (check_code TEXT, severity TEXT, tenant_org_id UUID, branch_id UUID, detail JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_cmx_dt__guard_scope(p_tenant);
  RETURN QUERY
  SELECT 'CLOCK_DEFAULTS_MISSING'::TEXT, 'error'::TEXT, NULL::UUID, NULL::UUID,
         jsonb_build_object('table', 'hq_general_config')
   WHERE NOT EXISTS (SELECT 1 FROM public.hq_general_config h WHERE h.config_id);
END
$fn$;
COMMENT ON FUNCTION public.fn_cmx_dt_chk_defaults_missing(UUID) IS
  'Health CLOCK_DEFAULTS_MISSING (error, platform): the hq_general_config row is missing, so the platform hour cycle, week start, date format and cut-over cannot be read (D33). p_tenant only scopes the guard.';

-- ----------------------------------------------------------------------------
-- 8. Grants (§5 conventions: REVOKE PUBLIC, anon; GRANT authenticated, service_role)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.fn_cmx_dt__resolve_hour_cycle(TEXT, TEXT, TEXT),
  public.fn_cmx_dt__resolve_week_start(SMALLINT, SMALLINT, SMALLINT),
  public.fn_cmx_dt__check_cutover(TEXT),
  public.fn_cmx_dt__resolve_cutover(TEXT, TEXT, TEXT),
  public.fn_cmx_dt__resolve_date_format(TEXT, TEXT),
  public.fn_cmx_dt__guard_tenant_read(UUID),
  public.fn_cmx_dt_settings(UUID, UUID),
  public.fn_cmx_dt_hour_cycle(UUID),
  public.fn_cmx_dt_week_start(UUID),
  public.fn_cmx_dt_cutover(UUID, UUID),
  public.fn_cmx_dt_date_format(UUID),
  public.fn_cmx_dt_business_date_in(TEXT, TIME, TIMESTAMPTZ),
  public.fn_cmx_dt_business_date(UUID, TEXT, UUID, TIMESTAMPTZ),
  public.fn_cmx_dt_business_day_bounds_in(TEXT, TIME, DATE, DATE),
  public.fn_cmx_dt_business_day_bounds(UUID, TEXT, UUID, DATE, DATE),
  public.fn_cmx_dt_chk_country_unknown(UUID),
  public.fn_cmx_dt_chk_cutover_invalid(UUID),
  public.fn_cmx_dt_chk_cutover_inconsistent(UUID),
  public.fn_cmx_dt_chk_setting_unresolved(UUID),
  public.fn_cmx_dt_chk_defaults_missing(UUID)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.fn_cmx_dt__resolve_hour_cycle(TEXT, TEXT, TEXT),
  public.fn_cmx_dt__resolve_week_start(SMALLINT, SMALLINT, SMALLINT),
  public.fn_cmx_dt__check_cutover(TEXT),
  public.fn_cmx_dt__resolve_cutover(TEXT, TEXT, TEXT),
  public.fn_cmx_dt__resolve_date_format(TEXT, TEXT),
  public.fn_cmx_dt__guard_tenant_read(UUID),
  public.fn_cmx_dt_settings(UUID, UUID),
  public.fn_cmx_dt_hour_cycle(UUID),
  public.fn_cmx_dt_week_start(UUID),
  public.fn_cmx_dt_cutover(UUID, UUID),
  public.fn_cmx_dt_date_format(UUID),
  public.fn_cmx_dt_business_date_in(TEXT, TIME, TIMESTAMPTZ),
  public.fn_cmx_dt_business_date(UUID, TEXT, UUID, TIMESTAMPTZ),
  public.fn_cmx_dt_business_day_bounds_in(TEXT, TIME, DATE, DATE),
  public.fn_cmx_dt_business_day_bounds(UUID, TEXT, UUID, DATE, DATE),
  public.fn_cmx_dt_chk_country_unknown(UUID),
  public.fn_cmx_dt_chk_cutover_invalid(UUID),
  public.fn_cmx_dt_chk_cutover_inconsistent(UUID),
  public.fn_cmx_dt_chk_setting_unresolved(UUID),
  public.fn_cmx_dt_chk_defaults_missing(UUID)
TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Setup health: fn_shc_clock_* and registry rows (CLOCK domain from 0842)
-- ----------------------------------------------------------------------------

CREATE FUNCTION public.fn_shc_clock_country_unknown(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  RETURN public.fn_cmx_dt__shc('fn_cmx_dt_chk_country_unknown', p_tenant, p_branch);
END
$fn$;
COMMENT ON FUNCTION public.fn_shc_clock_country_unknown(UUID, UUID) IS
  'Setup health CLOCK_COUNTRY_UNKNOWN (0843): runs fn_cmx_dt_chk_country_unknown for one organization and returns the 0709 JSON.';
REVOKE ALL ON FUNCTION public.fn_shc_clock_country_unknown(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_clock_country_unknown(UUID, UUID) TO authenticated, service_role;

CREATE FUNCTION public.fn_shc_clock_cutover_invalid(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  RETURN public.fn_cmx_dt__shc('fn_cmx_dt_chk_cutover_invalid', p_tenant, p_branch);
END
$fn$;
COMMENT ON FUNCTION public.fn_shc_clock_cutover_invalid(UUID, UUID) IS
  'Setup health CLOCK_CUTOVER_INVALID (0843): runs fn_cmx_dt_chk_cutover_invalid for one organization and returns the 0709 JSON.';
REVOKE ALL ON FUNCTION public.fn_shc_clock_cutover_invalid(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_clock_cutover_invalid(UUID, UUID) TO authenticated, service_role;

CREATE FUNCTION public.fn_shc_clock_cutover_inconsistent(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  RETURN public.fn_cmx_dt__shc('fn_cmx_dt_chk_cutover_inconsistent', p_tenant, p_branch);
END
$fn$;
COMMENT ON FUNCTION public.fn_shc_clock_cutover_inconsistent(UUID, UUID) IS
  'Setup health CLOCK_CUTOVER_INCONSISTENT (0843): runs fn_cmx_dt_chk_cutover_inconsistent for one organization and returns the 0709 JSON.';
REVOKE ALL ON FUNCTION public.fn_shc_clock_cutover_inconsistent(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_clock_cutover_inconsistent(UUID, UUID) TO authenticated, service_role;

CREATE FUNCTION public.fn_shc_clock_setting_unresolved(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  RETURN public.fn_cmx_dt__shc('fn_cmx_dt_chk_setting_unresolved', p_tenant, p_branch);
END
$fn$;
COMMENT ON FUNCTION public.fn_shc_clock_setting_unresolved(UUID, UUID) IS
  'Setup health CLOCK_SETTING_UNRESOLVED (0843): runs fn_cmx_dt_chk_setting_unresolved for one organization and returns the 0709 JSON.';
REVOKE ALL ON FUNCTION public.fn_shc_clock_setting_unresolved(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_clock_setting_unresolved(UUID, UUID) TO authenticated, service_role;

CREATE FUNCTION public.fn_shc_clock_defaults_missing(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  RETURN public.fn_cmx_dt__shc('fn_cmx_dt_chk_defaults_missing', p_tenant, p_branch);
END
$fn$;
COMMENT ON FUNCTION public.fn_shc_clock_defaults_missing(UUID, UUID) IS
  'Setup health CLOCK_DEFAULTS_MISSING (0843): runs fn_cmx_dt_chk_defaults_missing for one organization and returns the 0709 JSON.';
REVOKE ALL ON FUNCTION public.fn_shc_clock_defaults_missing(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_clock_defaults_missing(UUID, UUID) TO authenticated, service_role;

INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, ok_name, ok_name2,
  description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_keys,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('CLOCK_COUNTRY_UNKNOWN', 'CLOCK', 'WARNING',
   'Organization country is not recognized', 'دولة المنشأة غير معروفة',
   'Organization country is recognized', 'دولة المنشأة معروفة',
   'The organization country is empty or not in the platform country list, so the country defaults for the 12/24-hour clock and the first day of the week are skipped and the platform values are used. Set the organization country.',
   'دولة المنشأة فارغة أو غير موجودة في قائمة دول المنصة، لذلك لا تُستخدم القيم الافتراضية للدولة لنظام 12/24 ساعة وأول يوم في الأسبوع وتُستخدم قيم المنصة. حدّد دولة المنشأة.',
   '/dashboard/settings/general', '/tenants/{tenantId}', 'settings:organization', '{}'::text[],
   FALSE, FALSE, 'fn_shc_clock_country_unknown', 70, 'system_admin', '0843 clock settings'),
  ('CLOCK_CUTOVER_INVALID', 'CLOCK', 'BLOCKER',
   'Business day start time is not valid', 'وقت بداية يوم العمل غير صالح',
   'Business day start times are valid', 'أوقات بداية يوم العمل صالحة',
   'The organization or a branch has a business day start time outside 00:00 to 11:59. Sales are counted on the wrong day. Choose a time between 00:00 and 11:59.',
   'للمنشأة أو لأحد الفروع وقت بداية يوم عمل خارج الفترة من 00:00 إلى 11:59. تُحسب المبيعات في يوم خاطئ. اختر وقتاً بين 00:00 و11:59.',
   '/dashboard/settings/general', '/tenants/{tenantId}', 'settings:organization', '{}'::text[],
   FALSE, FALSE, 'fn_shc_clock_cutover_invalid', 80, 'system_admin', '0843 clock settings'),
  ('CLOCK_CUTOVER_INCONSISTENT', 'CLOCK', 'WARNING',
   'Business day start time needs attention', 'وقت بداية يوم العمل يحتاج إلى مراجعة',
   'Business day start times are consistent', 'أوقات بداية يوم العمل متسقة',
   'A branch has its own business day start time but no usable time zone, so its business day cannot be worked out. Set the branch or organization time zone. Notes are also shown when branches differ by more than 6 hours or override while the organization has no default.',
   'لأحد الفروع وقت بداية يوم عمل خاص به دون منطقة زمنية صالحة، لذلك لا يمكن تحديد يوم عمله. حدّد المنطقة الزمنية للفرع أو للمنشأة. تظهر ملاحظات أيضاً عندما تختلف الفروع بأكثر من 6 ساعات أو عندما يحدد فرع وقتاً خاصاً بينما لا يوجد وقت افتراضي للمنشأة.',
   '/dashboard/settings/branches', '/tenants/{tenantId}', 'settings:organization', '{}'::text[],
   FALSE, FALSE, 'fn_shc_clock_cutover_inconsistent', 90, 'system_admin', '0843 clock settings'),
  ('CLOCK_SETTING_UNRESOLVED', 'CLOCK', 'WARNING',
   'Clock format or week start uses the platform default', 'نظام الساعة أو بداية الأسبوع يستخدم القيمة الافتراضية للمنصة',
   'Clock format and week start are set', 'نظام الساعة وبداية الأسبوع محددان',
   'The organization has no 12/24-hour clock or first day of the week, and its country has no default, so the platform value is used. Set them in General settings.',
   'لم تحدد المنشأة نظام 12/24 ساعة أو أول يوم في الأسبوع، ولا توجد قيمة افتراضية لدولتها، لذلك تُستخدم قيمة المنصة. حدّدهما في الإعدادات العامة.',
   '/dashboard/settings/general', '/tenants/{tenantId}', 'settings:organization', '{}'::text[],
   FALSE, FALSE, 'fn_shc_clock_setting_unresolved', 100, 'system_admin', '0843 clock settings'),
  ('CLOCK_DEFAULTS_MISSING', 'CLOCK', 'BLOCKER',
   'Platform date and time defaults are missing', 'القيم الافتراضية للتاريخ والوقت في المنصة مفقودة',
   'Platform date and time defaults exist', 'القيم الافتراضية للتاريخ والوقت في المنصة موجودة',
   'The platform general configuration row is missing, so the default clock format, first day of the week, date format and business day start time cannot be read. Platform team: restore the general configuration.',
   'سجل الإعدادات العامة للمنصة مفقود، لذلك لا يمكن قراءة نظام الساعة وأول يوم في الأسبوع وصيغة التاريخ ووقت بداية يوم العمل الافتراضية. فريق المنصة: استعد الإعدادات العامة.',
   NULL, '/hq-admin-console/hq-general-config', NULL, '{}'::text[],
   FALSE, TRUE, 'fn_shc_clock_defaults_missing', 110, 'system_admin', '0843 clock settings')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    ok_name = EXCLUDED.ok_name, ok_name2 = EXCLUDED.ok_name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_keys = EXCLUDED.feature_flag_keys,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = public.fn_cmx_dt_now(), updated_by = 'system_admin', updated_info = '0843 clock settings';

-- ----------------------------------------------------------------------------
-- 10. Verification (fails the migration, rolling everything back)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_n   INTEGER;
  v_err INTEGER;
  v_t   UUID;
BEGIN
  -- a. Country defaults seeded from CLDR for every existing country row that CLDR knows.
  SELECT count(*) INTO v_n FROM public.sys_country_cd WHERE default_hour_cycle IS NULL OR default_week_start IS NULL;
  IF v_n > 0 THEN
    RAISE WARNING '0843 verification: % country rows have no CLDR clock default (code not in CLDR 49)', v_n;
  END IF;
  -- b. Pure resolvers agree with the settings vectors (spot checks; the full set runs in supabase/tests).
  IF (SELECT value FROM public.fn_cmx_dt__resolve_hour_cycle(NULL, 'H12', '24h')) IS DISTINCT FROM 'h12'
     OR (SELECT value FROM public.fn_cmx_dt__resolve_week_start(0::SMALLINT, 6::SMALLINT, 6::SMALLINT)) IS DISTINCT FROM 7
     OR (SELECT value FROM public.fn_cmx_dt__resolve_cutover(NULL, '03:00', '00:00')) IS DISTINCT FROM TIME '03:00'
     OR public.fn_cmx_dt_business_date_in('Asia/Muscat', TIME '04:00', TIMESTAMPTZ '2026-11-26 22:00:00+00') IS DISTINCT FROM DATE '2026-11-26'
     OR public.fn_cmx_dt_period_key_in('Asia/Muscat', 'FY', TIMESTAMPTZ '2027-02-10 08:00:00+00', NULL, 4::SMALLINT) IS DISTINCT FROM 'FY2026' THEN
    RAISE EXCEPTION '0843 verification: resolver spot checks failed';
  END IF;
  -- c. Every active organization resolves all four settings (platform values exist; a bad stored value raises).
  FOR v_t IN SELECT t.id FROM public.org_tenants_mst t WHERE t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1 LOOP
    PERFORM s.* FROM public.fn_cmx_dt_settings(v_t, NULL) s;
  END LOOP;
  -- d. Setup health: every CLOCK check runs without ERROR.
  SELECT count(*) FILTER (WHERE r.status = 'ERROR'), count(*) INTO v_err, v_n
    FROM public.org_tenants_mst t
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL, 'CLOCK') r
   WHERE t.is_active IS TRUE AND coalesce(t.rec_status, 1) = 1;
  IF v_err > 0 THEN
    RAISE EXCEPTION '0843 verification: % CLOCK setup-health rows returned ERROR', v_err;
  END IF;
  RAISE NOTICE '0843: % country rows with CLDR defaults; % CLOCK setup-health rows checked',
    (SELECT count(*) FROM public.sys_country_cd WHERE cldr_version IS NOT NULL), v_n;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK BODY A: fn_cmx_dt_period_key as created by 0842 (no WEEK)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.fn_cmx_dt_period_key(p_tenant UUID, p_operation TEXT, p_scope UUID, p_grain TEXT,
--                                             p_at TIMESTAMPTZ DEFAULT public.fn_cmx_dt_now())
-- RETURNS TEXT
-- LANGUAGE plpgsql
-- STABLE
-- SECURITY INVOKER
-- SET search_path = pg_catalog, public, pg_temp
-- AS $fn$
-- DECLARE
--   v_zone TEXT;
--   v_fy   SMALLINT;
-- BEGIN
--   IF p_grain IS NULL OR p_grain NOT IN ('DAY', 'MONTH', 'YEAR', 'FY') THEN
--     -- WEEK is added by 0843 (it needs the week-start reader).
--     RAISE EXCEPTION 'CLOCK_SETTING_INVALID: grain %', coalesce(p_grain, '<null>') USING ERRCODE = '22023';
--   END IF;
--   v_zone := public.fn_cmx_dt_zone_required(p_tenant, p_operation, p_scope);
--   IF p_grain = 'FY' THEN
--     v_fy := public.fn_tenant_general_value(p_tenant, 'fiscal_year_start_month')::SMALLINT;
--   END IF;
--   RETURN public.fn_cmx_dt_period_key_in(v_zone, p_grain, p_at, NULL, v_fy);
-- END
-- $fn$;
-- COMMENT ON FUNCTION public.fn_cmx_dt_period_key(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ) IS
--   'Period key of p_at (default fn_cmx_dt_now()) in the operations zone of (p_tenant, p_operation, p_scope). p_grain DAY, MONTH, YEAR, FY (fiscal start month: tenant, else hq_general_config, via fn_tenant_general_value); WEEK from 0843. Raises TIMEZONE_NOT_CONFIGURED / CLOCK_SETTING_INVALID. TS mirror dtPeriodKey.';
