-- =============================================================================
-- 0711_business_calendar.sql
-- Service Speeds & Ready-By Calendar — S1, part 2 of 2
-- (docs/features/Service_Speeds/PLAN.md §1 D10, "Country calendars", §4, §4.1).
--
-- Why:
-- Ready-by needs working days and hours. HQ keeps one default calendar per
-- country (sys_calendar_templates_mst) and a public-holiday list per country
-- (sys_public_holidays_cf). Each organization points at its template
-- (org_tenants_mst.calendar_template_code) and keeps its own closures and
-- open days (org_holidays_cf). Typed columns only, no sys_stng_* settings.
--
-- Objects:
--   sys_calendar_templates_mst  one row per country + GENERIC fallback
--   sys_public_holidays_cf      one row per country per holiday date
--   org_holidays_cf             organization / branch holiday overrides (RLS)
--   org_tenants_mst.calendar_template_code  FK to the template
--   sys_components_cd           Settings › Business Calendar menu row
--                               (dual-write with web-admin/config/navigation.ts)
--
-- Seeds (PLAN §4.1):
--   * Templates: every country in sys_country_cd + GENERIC. Weekend = the
--     country's official weekend; open 08:00–20:00 on other days, closed on
--     weekend days; cut-off 11:00, ready 18:00. These are starter values the
--     organization edits; they are not facts about any business.
--   * Public holidays 2026 + 2027 for OM, SA, AE, BH, QA, KW. Fixed-date
--     holidays set by law are is_estimated = false. Every Islamic holiday is
--     is_estimated = true: the sources below are secondary and disagree by a
--     day or two, and real dates follow moon sighting / official decree.
--     HQ confirms them (Setup Health CAL_HOLIDAYS_ESTIMATED).
--     Islamic dates use the Umm al-Qura calendar:
--       2026: 27 Rajab 1447 = Jan 16; 1 Shawwal = Mar 20; 9 Dhu al-Hijjah =
--             May 26; 1 Muharram 1448 = Jun 16; 9–10 Muharram = Jun 24–25;
--             12 Rabi I 1448 ≈ Aug 26.
--       2027: 27 Rajab 1448 = Jan 5; 1 Shawwal = Mar 9; 9 Dhu al-Hijjah =
--             May 15; 1 Muharram 1449 = Jun 6; 9–10 Muharram = Jun 14–15;
--             12 Rabi I 1449 = Aug 14.
--       https://www.al-habib.info/islamic-calendar/ummulqura/islamic-calendar-ummulqura-2027-ce.htm
--       https://ummalquracalendar.org/umm-al-qura-calendar-2027/
--     Each row stores its own source in source_ref.
--   * Every existing organization: calendar_template_code from its country
--     (else GENERIC); order_cutoff_time / ready_time / business_hours copied
--     from the template only where still NULL (existing hours are kept).
--   * Demo organizations (all current organizations; pre-launch, no real
--     tenants): NEXT_DAY and URGENT rules at every scope that has an active
--     EXPRESS rule; one organization-wide ECONOMY −10% rule; two sample
--     holidays (one closure, one "we open that day").
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 0. Prerequisites
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'org_speed_price_rules_cf'
                   AND column_name = 'turnaround_unit') THEN
    RAISE EXCEPTION 'BUSINESS_CALENDAR_PRECHECK: apply 0707_service_speeds_cutoff_hours.sql first';
  END IF;
  IF to_regprocedure('public.current_tenant_id()') IS NULL
     OR to_regprocedure('public.trg_set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'BUSINESS_CALENDAR_PRECHECK: current_tenant_id() / trg_set_updated_at() missing';
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 1. sys_calendar_templates_mst — default calendar per country
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_calendar_templates_mst (
  calendar_code     TEXT        NOT NULL,
  country_code      TEXT        NULL,
  name              TEXT        NOT NULL,
  name2             TEXT        NULL,
  business_hours    JSONB       NOT NULL,
  weekend_days      TEXT[]      NOT NULL,
  order_cutoff_time TIME        NOT NULL,
  ready_time        TIME        NOT NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  rec_status        SMALLINT    NOT NULL DEFAULT 1,
  rec_order         INTEGER     NULL,
  rec_notes         TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT        NULL,
  created_info      TEXT        NULL,
  updated_at        TIMESTAMPTZ NULL,
  updated_by        TEXT        NULL,
  updated_info      TEXT        NULL,
  CONSTRAINT pk_sys_cal_tpl PRIMARY KEY (calendar_code),
  CONSTRAINT fk_sys_cal_tpl_country FOREIGN KEY (country_code)
    REFERENCES public.sys_country_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_sys_cal_tpl_country UNIQUE (country_code),
  CONSTRAINT chk_sys_cal_tpl_hours CHECK (
    jsonb_typeof(business_hours) = 'object'
    AND (business_hours - ARRAY['mon','tue','wed','thu','fri','sat','sun']) = '{}'::jsonb),
  CONSTRAINT chk_sys_cal_tpl_weekend CHECK (
    weekend_days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']),
  CONSTRAINT chk_sys_cal_tpl_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_calendar_templates_mst IS
  'HQ default business calendar per country (+ GENERIC). Onboarding copies hours / cut-off / ready time into the organization; holidays are read live from sys_public_holidays_cf, not copied.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.calendar_code IS 'Template code: ISO country code (OM, SA, …) or GENERIC.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.country_code IS 'Country this template is the default for (FK sys_country_cd). NULL only for GENERIC. One template per country.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.name IS 'Display name (EN).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.name2 IS 'Display name (AR).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.business_hours IS 'Starter weekly hours, same shape as org_tenants_mst.business_hours: keys mon..sun, {"open":"HH:MM","close":"HH:MM"} or null (closed).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.weekend_days IS 'Official weekend days of the country (mon..sun). Kept equal to the null days of business_hours by the seed; informational.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.order_cutoff_time IS 'Starter organization cut-off (local time).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.ready_time IS 'Starter ready time for WORKING_DAYS orders (local time).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.is_active IS 'Inactive templates are not offered at onboarding.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.rec_status IS '1 = active record, 0 = deleted, 2 = archived.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.rec_order IS 'Display order.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.created_at IS 'Created timestamp.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.created_by IS 'Created by (user id or system).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.updated_at IS 'Last update timestamp (trigger).';
COMMENT ON COLUMN public.sys_calendar_templates_mst.updated_by IS 'Updated by.';
COMMENT ON COLUMN public.sys_calendar_templates_mst.updated_info IS 'Update context.';
COMMENT ON CONSTRAINT fk_sys_cal_tpl_country ON public.sys_calendar_templates_mst IS 'Template country must exist in sys_country_cd.';
COMMENT ON CONSTRAINT uq_sys_cal_tpl_country ON public.sys_calendar_templates_mst IS 'At most one default template per country.';
COMMENT ON CONSTRAINT chk_sys_cal_tpl_hours ON public.sys_calendar_templates_mst IS 'business_hours is a JSON object keyed only by mon..sun.';
COMMENT ON CONSTRAINT chk_sys_cal_tpl_weekend ON public.sys_calendar_templates_mst IS 'weekend_days only contains mon..sun.';
COMMENT ON CONSTRAINT chk_sys_cal_tpl_rec_status ON public.sys_calendar_templates_mst IS 'rec_status is 0, 1 or 2.';

DROP TRIGGER IF EXISTS trg_sys_cal_tpl_updated_at ON public.sys_calendar_templates_mst;
CREATE TRIGGER trg_sys_cal_tpl_updated_at
  BEFORE UPDATE ON public.sys_calendar_templates_mst
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_sys_cal_tpl_updated_at ON public.sys_calendar_templates_mst IS 'Sets updated_at on every update.';

-- Platform reference data: read by every signed-in user, written by HQ (service_role).
ALTER TABLE public.sys_calendar_templates_mst ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_sys_cal_tpl_read ON public.sys_calendar_templates_mst;
CREATE POLICY pol_sys_cal_tpl_read ON public.sys_calendar_templates_mst
  FOR SELECT TO authenticated USING (true);
COMMENT ON POLICY pol_sys_cal_tpl_read ON public.sys_calendar_templates_mst IS 'Any signed-in user may read templates (platform reference data).';
REVOKE ALL ON public.sys_calendar_templates_mst FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sys_calendar_templates_mst FROM authenticated;
GRANT SELECT ON public.sys_calendar_templates_mst TO authenticated;
GRANT ALL ON public.sys_calendar_templates_mst TO service_role;

-- Seed: weekend per country (official weekend). Sources:
--   GCC + EG Fri–Sat; AE Sat–Sun since 2022-01-01 (UAE federal 4.5-day week,
--   https://u.ae/en/about-the-uae/the-uae-government/government-work-week);
--   US/GB/FR/DE/CN/JP Sat–Sun; IN and PK Sunday (commercial week).
WITH wk(code, weekend, ord) AS (
  VALUES
    ('OM', ARRAY['fri','sat'], 1), ('SA', ARRAY['fri','sat'], 2),
    ('AE', ARRAY['sat','sun'], 3), ('BH', ARRAY['fri','sat'], 4),
    ('QA', ARRAY['fri','sat'], 5), ('KW', ARRAY['fri','sat'], 6),
    ('EG', ARRAY['fri','sat'], 7), ('US', ARRAY['sat','sun'], 8),
    ('GB', ARRAY['sat','sun'], 9), ('FR', ARRAY['sat','sun'], 10),
    ('DE', ARRAY['sat','sun'], 11), ('CN', ARRAY['sat','sun'], 12),
    ('JP', ARRAY['sat','sun'], 13), ('IN', ARRAY['sun'], 14),
    ('PK', ARRAY['sun'], 15)
),
src AS (
  SELECT c.code::text AS calendar_code, c.code::text AS country_code,
         c.name::text || ' calendar' AS name,
         'تقويم ' || COALESCE(c.name2, c.name)::text AS name2,
         wk.weekend, wk.ord
  FROM wk JOIN public.sys_country_cd c ON c.code = wk.code
  UNION ALL
  SELECT 'GENERIC', NULL, 'Generic calendar', 'تقويم عام', ARRAY['sat','sun'], 99
)
INSERT INTO public.sys_calendar_templates_mst
  (calendar_code, country_code, name, name2, business_hours, weekend_days,
   order_cutoff_time, ready_time, rec_order, created_by, created_info)
SELECT s.calendar_code, s.country_code, s.name, s.name2,
       (SELECT jsonb_object_agg(d,
                 CASE WHEN d = ANY (s.weekend) THEN 'null'::jsonb
                      ELSE '{"open":"08:00","close":"20:00"}'::jsonb END)
          FROM unnest(ARRAY['mon','tue','wed','thu','fri','sat','sun']) d),
       s.weekend, TIME '11:00', TIME '18:00', s.ord,
       'system_admin', 'migration 0711'
FROM src s
ON CONFLICT (calendar_code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  weekend_days = EXCLUDED.weekend_days,
  rec_order    = EXCLUDED.rec_order;
-- Hours / cut-off / ready time are not overwritten on re-run (HQ may edit them).

-- ------------------------------------------------------------------
-- 2. sys_public_holidays_cf — public holidays per country
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_public_holidays_cf (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  country_code  TEXT        NOT NULL,
  holiday_date  DATE        NOT NULL,
  holiday_year  SMALLINT    GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)::smallint) STORED,
  holiday_code  TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  name2         TEXT        NULL,
  is_estimated  BOOLEAN     NOT NULL DEFAULT true,
  source_ref    TEXT        NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_notes     TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  CONSTRAINT pk_sys_pub_hol PRIMARY KEY (id),
  CONSTRAINT fk_sys_pub_hol_country FOREIGN KEY (country_code)
    REFERENCES public.sys_country_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_sys_pub_hol_country_date UNIQUE (country_code, holiday_date),
  CONSTRAINT chk_sys_pub_hol_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.sys_public_holidays_cf IS
  'HQ-maintained public holidays, one row per country per closed date. Ready-by skips these for the branch country unless the organization has an org_holidays_cf row with is_closed = false on that date.';
COMMENT ON COLUMN public.sys_public_holidays_cf.id IS 'Primary key.';
COMMENT ON COLUMN public.sys_public_holidays_cf.country_code IS 'Country (FK sys_country_cd).';
COMMENT ON COLUMN public.sys_public_holidays_cf.holiday_date IS 'The holiday date (one row per day of a multi-day holiday).';
COMMENT ON COLUMN public.sys_public_holidays_cf.holiday_year IS 'Gregorian year of holiday_date (generated), for the per-year HQ screen.';
COMMENT ON COLUMN public.sys_public_holidays_cf.holiday_code IS 'Occasion code, e.g. EID_AL_FITR, NATIONAL_DAY. Groups the days of one holiday.';
COMMENT ON COLUMN public.sys_public_holidays_cf.name IS 'Holiday name (EN).';
COMMENT ON COLUMN public.sys_public_holidays_cf.name2 IS 'Holiday name (AR).';
COMMENT ON COLUMN public.sys_public_holidays_cf.is_estimated IS 'true = date not yet officially announced (Islamic holidays follow moon sighting). HQ sets false after the official announcement.';
COMMENT ON COLUMN public.sys_public_holidays_cf.source_ref IS 'Where the date comes from (URL or decree reference).';
COMMENT ON COLUMN public.sys_public_holidays_cf.is_active IS 'Inactive rows are ignored by ready-by.';
COMMENT ON COLUMN public.sys_public_holidays_cf.rec_status IS '1 = active record, 0 = deleted, 2 = archived.';
COMMENT ON COLUMN public.sys_public_holidays_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.sys_public_holidays_cf.created_at IS 'Created timestamp.';
COMMENT ON COLUMN public.sys_public_holidays_cf.created_by IS 'Created by (user id or system).';
COMMENT ON COLUMN public.sys_public_holidays_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN public.sys_public_holidays_cf.updated_at IS 'Last update timestamp (trigger).';
COMMENT ON COLUMN public.sys_public_holidays_cf.updated_by IS 'Updated by.';
COMMENT ON COLUMN public.sys_public_holidays_cf.updated_info IS 'Update context.';
COMMENT ON CONSTRAINT fk_sys_pub_hol_country ON public.sys_public_holidays_cf IS 'Holiday country must exist in sys_country_cd.';
COMMENT ON CONSTRAINT uq_sys_pub_hol_country_date ON public.sys_public_holidays_cf IS 'One row per country per date; also serves the (country, date range) lookup.';
COMMENT ON CONSTRAINT chk_sys_pub_hol_rec_status ON public.sys_public_holidays_cf IS 'rec_status is 0, 1 or 2.';

DROP TRIGGER IF EXISTS trg_sys_pub_hol_updated_at ON public.sys_public_holidays_cf;
CREATE TRIGGER trg_sys_pub_hol_updated_at
  BEFORE UPDATE ON public.sys_public_holidays_cf
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_sys_pub_hol_updated_at ON public.sys_public_holidays_cf IS 'Sets updated_at on every update.';

ALTER TABLE public.sys_public_holidays_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_sys_pub_hol_read ON public.sys_public_holidays_cf;
CREATE POLICY pol_sys_pub_hol_read ON public.sys_public_holidays_cf
  FOR SELECT TO authenticated USING (true);
COMMENT ON POLICY pol_sys_pub_hol_read ON public.sys_public_holidays_cf IS 'Any signed-in user may read public holidays (platform reference data).';
REVOKE ALL ON public.sys_public_holidays_cf FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sys_public_holidays_cf FROM authenticated;
GRANT SELECT ON public.sys_public_holidays_cf TO authenticated;
GRANT ALL ON public.sys_public_holidays_cf TO service_role;

-- Seed. Columns: country, code, first date, number of days, estimated?, source.
-- Sources:
--   [SA] Saudi Gazette, MHRSD Eid al-Fitr 2026 (4 days from end of 29 Ramadan = Mar 18):
--        https://saudigazette.com.sa/article/659444 ; Founding Day Feb 22 (Royal
--        Order A/371, 2022); National Day Sep 23 (fixed). Eid al-Adha: 4 days
--        from Arafat (labour law implementing regulations).
--   [AE] Cabinet Resolution 27/2024 holiday list; 2026 moves (Hijri New Year
--        Jun 15, Prophet's Birthday Aug 28) and National Day Dec 2–3:
--        https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining
--   [KW] https://www.gulftalent.com/kuwait/resources/public-holidays/2026
--   [QA] https://briteconsult.com/qatar-public-holidays-2026/ (Sport Day =
--        2nd Tuesday of February; National Day Dec 18)
--   [BH] https://connectingtravel.com/features/gcc-public-holidays-in-2026-plan-ahead-to-make-more-bookings
--   [OM] https://www.gulftalent.com/oman/resources/public-holidays/2026 ;
--        National Day: sources disagree (Nov 18 / Nov 20 / Nov 25); seeded as
--        Nov 20–21 and flagged estimated until HQ confirms.
--   [UQ] Umm al-Qura dates (see header).
WITH h(cc, code, d0, n, est, src) AS (
  VALUES
  -- ===== 2026 =====
  ('SA','FOUNDING_DAY',  DATE '2026-02-22',1,false,'SA Royal Order A/371 (2022)'),
  ('SA','EID_AL_FITR',   DATE '2026-03-19',4,true, 'https://saudigazette.com.sa/article/659444'),
  ('SA','ARAFAT_DAY',    DATE '2026-05-26',1,true, 'UQ + SA labour regulations'),
  ('SA','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'UQ + SA labour regulations'),
  ('SA','NATIONAL_DAY',  DATE '2026-09-23',1,false,'SA fixed national day'),
  ('AE','NEW_YEAR',      DATE '2026-01-01',1,false,'AE Cabinet Resolution 27/2024'),
  ('AE','EID_AL_FITR',   DATE '2026-03-20',3,true, 'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('AE','ARAFAT_DAY',    DATE '2026-05-26',1,true, 'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('AE','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('AE','HIJRI_NEW_YEAR',DATE '2026-06-15',1,true, 'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('AE','MAWLID',        DATE '2026-08-28',1,true, 'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('AE','NATIONAL_DAY',  DATE '2026-12-02',2,false,'https://www.arabianbusiness.com/life/uae-public-holidays-2026-remaining'),
  ('KW','NEW_YEAR',      DATE '2026-01-01',1,false,'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','ISRA_MIRAJ',    DATE '2026-01-16',1,true, 'UQ'),
  ('KW','NATIONAL_DAY',  DATE '2026-02-25',1,false,'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','LIBERATION_DAY',DATE '2026-02-26',1,false,'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','EID_AL_FITR',   DATE '2026-03-20',3,true, 'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','ARAFAT_DAY',    DATE '2026-05-26',1,true, 'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'https://www.gulftalent.com/kuwait/resources/public-holidays/2026'),
  ('KW','HIJRI_NEW_YEAR',DATE '2026-06-16',1,true, 'UQ'),
  ('KW','MAWLID',        DATE '2026-08-26',1,true, 'UQ (sources list Aug 25–27)'),
  ('QA','SPORT_DAY',     DATE '2026-02-10',1,false,'https://briteconsult.com/qatar-public-holidays-2026/'),
  ('QA','EID_AL_FITR',   DATE '2026-03-20',3,true, 'https://briteconsult.com/qatar-public-holidays-2026/'),
  ('QA','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'https://briteconsult.com/qatar-public-holidays-2026/'),
  ('QA','NATIONAL_DAY',  DATE '2026-12-18',1,false,'https://briteconsult.com/qatar-public-holidays-2026/'),
  ('BH','NEW_YEAR',      DATE '2026-01-01',1,false,'BH official holiday list'),
  ('BH','EID_AL_FITR',   DATE '2026-03-20',3,true, 'https://connectingtravel.com/features/gcc-public-holidays-in-2026-plan-ahead-to-make-more-bookings'),
  ('BH','LABOUR_DAY',    DATE '2026-05-01',1,false,'BH official holiday list'),
  ('BH','ARAFAT_DAY',    DATE '2026-05-26',1,true, 'UQ'),
  ('BH','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'UQ'),
  ('BH','HIJRI_NEW_YEAR',DATE '2026-06-16',1,true, 'UQ'),
  ('BH','ASHURA',        DATE '2026-06-24',2,true, 'UQ'),
  ('BH','MAWLID',        DATE '2026-08-26',1,true, 'UQ'),
  ('BH','NATIONAL_DAY',  DATE '2026-12-16',2,false,'https://connectingtravel.com/features/gcc-public-holidays-in-2026-plan-ahead-to-make-more-bookings'),
  ('OM','ISRA_MIRAJ',    DATE '2026-01-16',1,true, 'UQ'),
  ('OM','EID_AL_FITR',   DATE '2026-03-20',3,true, 'https://www.gulftalent.com/oman/resources/public-holidays/2026'),
  ('OM','ARAFAT_DAY',    DATE '2026-05-26',1,true, 'https://www.gulftalent.com/oman/resources/public-holidays/2026'),
  ('OM','EID_AL_ADHA',   DATE '2026-05-27',3,true, 'https://www.gulftalent.com/oman/resources/public-holidays/2026'),
  ('OM','HIJRI_NEW_YEAR',DATE '2026-06-16',1,true, 'UQ'),
  ('OM','MAWLID',        DATE '2026-08-26',1,true, 'UQ'),
  ('OM','NATIONAL_DAY',  DATE '2026-11-20',2,true, 'Sources disagree (Nov 18/20/25); HQ to confirm'),
  -- ===== 2027 =====
  ('SA','FOUNDING_DAY',  DATE '2027-02-22',1,false,'SA Royal Order A/371 (2022)'),
  ('SA','EID_AL_FITR',   DATE '2027-03-09',4,true, 'UQ + SA labour regulations'),
  ('SA','ARAFAT_DAY',    DATE '2027-05-15',1,true, 'UQ + SA labour regulations'),
  ('SA','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ + SA labour regulations'),
  ('SA','NATIONAL_DAY',  DATE '2027-09-23',1,false,'SA fixed national day'),
  ('AE','NEW_YEAR',      DATE '2027-01-01',1,false,'AE Cabinet Resolution 27/2024'),
  ('AE','EID_AL_FITR',   DATE '2027-03-09',3,true, 'UQ + AE Cabinet Resolution 27/2024'),
  ('AE','ARAFAT_DAY',    DATE '2027-05-15',1,true, 'UQ + AE Cabinet Resolution 27/2024'),
  ('AE','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ + AE Cabinet Resolution 27/2024'),
  ('AE','HIJRI_NEW_YEAR',DATE '2027-06-06',1,true, 'UQ'),
  ('AE','MAWLID',        DATE '2027-08-14',1,true, 'UQ'),
  ('AE','NATIONAL_DAY',  DATE '2027-12-02',2,false,'AE Cabinet Resolution 27/2024'),
  ('KW','NEW_YEAR',      DATE '2027-01-01',1,false,'KW official holiday list'),
  ('KW','ISRA_MIRAJ',    DATE '2027-01-05',1,true, 'UQ'),
  ('KW','NATIONAL_DAY',  DATE '2027-02-25',1,false,'KW fixed national day'),
  ('KW','LIBERATION_DAY',DATE '2027-02-26',1,false,'KW fixed liberation day'),
  ('KW','EID_AL_FITR',   DATE '2027-03-09',3,true, 'UQ'),
  ('KW','ARAFAT_DAY',    DATE '2027-05-15',1,true, 'UQ'),
  ('KW','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ'),
  ('KW','HIJRI_NEW_YEAR',DATE '2027-06-06',1,true, 'UQ'),
  ('KW','MAWLID',        DATE '2027-08-14',1,true, 'UQ'),
  ('QA','SPORT_DAY',     DATE '2027-02-09',1,false,'QA rule: 2nd Tuesday of February'),
  ('QA','EID_AL_FITR',   DATE '2027-03-09',3,true, 'UQ'),
  ('QA','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ'),
  ('QA','NATIONAL_DAY',  DATE '2027-12-18',1,false,'QA fixed national day'),
  ('BH','NEW_YEAR',      DATE '2027-01-01',1,false,'BH official holiday list'),
  ('BH','EID_AL_FITR',   DATE '2027-03-09',3,true, 'UQ'),
  ('BH','LABOUR_DAY',    DATE '2027-05-01',1,false,'BH official holiday list'),
  ('BH','ARAFAT_DAY',    DATE '2027-05-15',1,true, 'UQ'),
  ('BH','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ'),
  ('BH','HIJRI_NEW_YEAR',DATE '2027-06-06',1,true, 'UQ'),
  ('BH','ASHURA',        DATE '2027-06-14',2,true, 'UQ'),
  ('BH','MAWLID',        DATE '2027-08-14',1,true, 'UQ'),
  ('BH','NATIONAL_DAY',  DATE '2027-12-16',2,false,'BH fixed national day'),
  ('OM','ISRA_MIRAJ',    DATE '2027-01-05',1,true, 'UQ'),
  ('OM','EID_AL_FITR',   DATE '2027-03-09',3,true, 'UQ'),
  ('OM','ARAFAT_DAY',    DATE '2027-05-15',1,true, 'UQ'),
  ('OM','EID_AL_ADHA',   DATE '2027-05-16',3,true, 'UQ'),
  ('OM','HIJRI_NEW_YEAR',DATE '2027-06-06',1,true, 'UQ'),
  ('OM','MAWLID',        DATE '2027-08-14',1,true, 'UQ'),
  ('OM','NATIONAL_DAY',  DATE '2027-11-20',2,true, 'Sources disagree (Nov 18/20/25); HQ to confirm')
),
nm(code, name, name2) AS (
  VALUES
  ('NEW_YEAR',       'New Year''s Day',    'رأس السنة الميلادية'),
  ('EID_AL_FITR',    'Eid al-Fitr',        'عيد الفطر'),
  ('ARAFAT_DAY',     'Arafat Day',         'يوم عرفة'),
  ('EID_AL_ADHA',    'Eid al-Adha',        'عيد الأضحى'),
  ('HIJRI_NEW_YEAR', 'Islamic New Year',   'رأس السنة الهجرية'),
  ('MAWLID',         'Prophet''s Birthday','المولد النبوي الشريف'),
  ('ISRA_MIRAJ',     'Isra and Mi''raj',   'الإسراء والمعراج'),
  ('ASHURA',         'Ashura',             'عاشوراء'),
  ('NATIONAL_DAY',   'National Day',       'اليوم الوطني'),
  ('FOUNDING_DAY',   'Founding Day',       'يوم التأسيس'),
  ('LIBERATION_DAY', 'Liberation Day',     'يوم التحرير'),
  ('SPORT_DAY',      'National Sport Day', 'اليوم الرياضي للدولة'),
  ('LABOUR_DAY',     'Labour Day',         'عيد العمال')
)
INSERT INTO public.sys_public_holidays_cf
  (country_code, holiday_date, holiday_code, name, name2, is_estimated,
   source_ref, created_by, created_info)
SELECT h.cc, (h.d0 + g.i)::date, h.code,
       nm.name || CASE WHEN h.n > 1 THEN ' (day ' || (g.i + 1) || ')' ELSE '' END,
       nm.name2 || CASE WHEN h.n > 1 THEN ' (اليوم ' || (g.i + 1) || ')' ELSE '' END,
       h.est, h.src, 'system_admin', 'migration 0711'
FROM h
JOIN nm ON nm.code = h.code
CROSS JOIN LATERAL generate_series(0, h.n - 1) AS g(i)
ON CONFLICT (country_code, holiday_date) DO UPDATE SET
  name  = EXCLUDED.name,
  name2 = EXCLUDED.name2;
-- Dates and is_estimated are not overwritten on re-run (HQ confirms them).

-- ------------------------------------------------------------------
-- 3. org_tenants_mst.calendar_template_code
-- ------------------------------------------------------------------
ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS calendar_template_code TEXT NULL;

ALTER TABLE public.org_tenants_mst
  DROP CONSTRAINT IF EXISTS fk_org_tnt_cal_template;
ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT fk_org_tnt_cal_template
  FOREIGN KEY (calendar_template_code)
  REFERENCES public.sys_calendar_templates_mst(calendar_code)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMENT ON COLUMN public.org_tenants_mst.calendar_template_code IS
  'Country calendar template the organization started from (set at onboarding from its country). Hours / cut-off / ready time were copied from it; public holidays are read live by country.';
COMMENT ON CONSTRAINT fk_org_tnt_cal_template ON public.org_tenants_mst IS
  'Organization calendar template must exist in sys_calendar_templates_mst.';

-- Backfill every organization (template by country, else GENERIC). Only NULL
-- values are filled: existing business_hours and times are kept.
UPDATE public.org_tenants_mst t
   SET calendar_template_code = COALESCE(t.calendar_template_code, tpl.calendar_code),
       order_cutoff_time      = COALESCE(t.order_cutoff_time, tpl.order_cutoff_time),
       ready_time             = COALESCE(t.ready_time, tpl.ready_time),
       business_hours         = COALESCE(t.business_hours, tpl.business_hours)
  FROM public.sys_calendar_templates_mst tpl
 WHERE tpl.calendar_code = COALESCE(
         (SELECT c.calendar_code FROM public.sys_calendar_templates_mst c
           WHERE c.country_code = upper(t.country)),
         'GENERIC')
   AND (t.calendar_template_code IS NULL OR t.order_cutoff_time IS NULL
        OR t.ready_time IS NULL OR t.business_hours IS NULL);

-- ------------------------------------------------------------------
-- 4. org_holidays_cf — organization / branch holidays
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_holidays_cf (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID        NOT NULL,
  branch_id     UUID        NULL,
  holiday_date  DATE        NOT NULL,
  name          TEXT        NOT NULL,
  name2         TEXT        NULL,
  is_closed     BOOLEAN     NOT NULL DEFAULT true,
  open_time     TIME        NULL,
  close_time    TIME        NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_notes     TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT        NULL,
  created_info  TEXT        NULL,
  updated_at    TIMESTAMPTZ NULL,
  updated_by    TEXT        NULL,
  updated_info  TEXT        NULL,
  CONSTRAINT pk_org_holidays_cf PRIMARY KEY (id),
  CONSTRAINT fk_org_hol_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  -- Parent key is (id, tenant_org_id): same order here (Prisma-safe).
  -- CASCADE, not SET NULL: a detached row would turn into an organization-wide holiday.
  CONSTRAINT fk_org_hol_branch FOREIGN KEY (branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT uq_org_hol_scope_date UNIQUE NULLS NOT DISTINCT (tenant_org_id, branch_id, holiday_date),
  CONSTRAINT chk_org_hol_times CHECK (
    (is_closed AND open_time IS NULL AND close_time IS NULL)
    OR (NOT is_closed AND open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time)),
  CONSTRAINT chk_org_hol_rec_status CHECK (rec_status IN (0, 1, 2))
);

COMMENT ON TABLE public.org_holidays_cf IS
  'Organization holiday overrides. is_closed = true: closed that day. is_closed = false: open that day with open_time–close_time (a short day, or open on a public holiday). branch_id NULL = all branches; a branch row wins over the organization row.';
COMMENT ON COLUMN public.org_holidays_cf.id IS 'Primary key.';
COMMENT ON COLUMN public.org_holidays_cf.tenant_org_id IS 'Owning organization (RLS key).';
COMMENT ON COLUMN public.org_holidays_cf.branch_id IS 'NULL = all branches; set = this branch only.';
COMMENT ON COLUMN public.org_holidays_cf.holiday_date IS 'The date this row applies to.';
COMMENT ON COLUMN public.org_holidays_cf.name IS 'Reason / name (EN).';
COMMENT ON COLUMN public.org_holidays_cf.name2 IS 'Reason / name (AR).';
COMMENT ON COLUMN public.org_holidays_cf.is_closed IS 'true = closed all day; false = open with open_time–close_time.';
COMMENT ON COLUMN public.org_holidays_cf.open_time IS 'Opening time when is_closed = false (local branch time).';
COMMENT ON COLUMN public.org_holidays_cf.close_time IS 'Closing time when is_closed = false (local branch time).';
COMMENT ON COLUMN public.org_holidays_cf.is_active IS 'Inactive rows are ignored by ready-by.';
COMMENT ON COLUMN public.org_holidays_cf.rec_status IS '1 = active record, 0 = deleted, 2 = archived.';
COMMENT ON COLUMN public.org_holidays_cf.rec_notes IS 'Free-text notes.';
COMMENT ON COLUMN public.org_holidays_cf.created_at IS 'Created timestamp.';
COMMENT ON COLUMN public.org_holidays_cf.created_by IS 'Created by (user id).';
COMMENT ON COLUMN public.org_holidays_cf.created_info IS 'Creation context.';
COMMENT ON COLUMN public.org_holidays_cf.updated_at IS 'Last update timestamp (trigger).';
COMMENT ON COLUMN public.org_holidays_cf.updated_by IS 'Updated by (user id).';
COMMENT ON COLUMN public.org_holidays_cf.updated_info IS 'Update context.';
COMMENT ON CONSTRAINT fk_org_hol_tenant ON public.org_holidays_cf IS 'Rows are removed with their organization.';
COMMENT ON CONSTRAINT fk_org_hol_branch ON public.org_holidays_cf IS 'Branch must belong to the same organization; branch rows are removed with the branch.';
COMMENT ON CONSTRAINT uq_org_hol_scope_date ON public.org_holidays_cf IS 'One row per organization, branch (NULL = all) and date. Also serves the tenant + date-range lookup.';
COMMENT ON CONSTRAINT chk_org_hol_times ON public.org_holidays_cf IS 'Closed day has no times; open day has open_time < close_time.';
COMMENT ON CONSTRAINT chk_org_hol_rec_status ON public.org_holidays_cf IS 'rec_status is 0, 1 or 2.';

-- FK support for branch deletes (uq index leads with tenant_org_id, not branch_id).
CREATE INDEX IF NOT EXISTS idx_org_hol_branch
  ON public.org_holidays_cf (branch_id, tenant_org_id) WHERE branch_id IS NOT NULL;
COMMENT ON INDEX public.idx_org_hol_branch IS 'Supports fk_org_hol_branch cascade on branch delete.';

DROP TRIGGER IF EXISTS trg_org_hol_updated_at ON public.org_holidays_cf;
CREATE TRIGGER trg_org_hol_updated_at
  BEFORE UPDATE ON public.org_holidays_cf
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
COMMENT ON TRIGGER trg_org_hol_updated_at ON public.org_holidays_cf IS 'Sets updated_at on every update.';

ALTER TABLE public.org_holidays_cf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pol_org_holidays_cf_tenant ON public.org_holidays_cf;
CREATE POLICY pol_org_holidays_cf_tenant ON public.org_holidays_cf
  FOR ALL TO authenticated
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));
COMMENT ON POLICY pol_org_holidays_cf_tenant ON public.org_holidays_cf IS 'Tenant isolation: rows of the current organization only.';
REVOKE ALL ON public.org_holidays_cf FROM PUBLIC, anon;
REVOKE TRUNCATE ON public.org_holidays_cf FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_holidays_cf TO authenticated;
GRANT ALL ON public.org_holidays_cf TO service_role;

-- ------------------------------------------------------------------
-- 5. Demo data (all current organizations are demo; pre-launch)
-- ------------------------------------------------------------------
-- 5a. NEXT_DAY (+25%, next working day) and URGENT (+100%, 3 working hours)
--     at every scope that has an active EXPRESS rule. ECONOMY is not mirrored.
INSERT INTO public.org_speed_price_rules_cf
  (tenant_org_id, service_speed, branch_id, service_category_code, product_id,
   speed_price_type, multiplier_speed, turnaround_unit, turnaround_hh_speed,
   turnaround_days_speed, created_by, created_info)
SELECT e.tenant_org_id, s.speed, e.branch_id, e.service_category_code, e.product_id,
       'MULTIPLIER', s.mult, s.unit, s.hh, s.dd, 'system_admin', 'migration 0711 demo'
FROM public.org_speed_price_rules_cf e
CROSS JOIN (VALUES
  ('NEXT_DAY', 0.25::numeric, 'WORKING_DAYS', NULL::numeric, 1::smallint),
  ('URGENT',   1.00::numeric, 'HOURS',        3::numeric,    NULL::smallint)
) AS s(speed, mult, unit, hh, dd)
WHERE e.service_speed = 'EXPRESS' AND e.is_active AND e.rec_status = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.org_speed_price_rules_cf x
    WHERE x.tenant_org_id = e.tenant_org_id
      AND x.service_speed = s.speed
      AND x.branch_id IS NOT DISTINCT FROM e.branch_id
      AND x.service_category_code IS NOT DISTINCT FROM e.service_category_code
      AND x.product_id IS NOT DISTINCT FROM e.product_id);

-- 5b. One organization-wide ECONOMY rule: −10%, 5 working days (exercises the
--     negative-premium path).
INSERT INTO public.org_speed_price_rules_cf
  (tenant_org_id, service_speed, speed_price_type, multiplier_speed,
   turnaround_unit, turnaround_days_speed, created_by, created_info)
SELECT t.id, 'ECONOMY', 'MULTIPLIER', -0.10, 'WORKING_DAYS', 5,
       'system_admin', 'migration 0711 demo'
FROM public.org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_speed_price_rules_cf x
  WHERE x.tenant_org_id = t.id AND x.service_speed = 'ECONOMY'
    AND x.branch_id IS NULL AND x.service_category_code IS NULL AND x.product_id IS NULL);

-- 5c. Two sample holidays per organization (all branches):
--     a closure on 2027-01-02, and "we open that day" 10:00–14:00 on the first
--     2027 National Day date of its country (skipped if the country has none).
INSERT INTO public.org_holidays_cf
  (tenant_org_id, branch_id, holiday_date, name, name2, is_closed, created_by, created_info)
SELECT t.id, NULL, DATE '2027-01-02', 'Annual stock-take', 'الجرد السنوي', true,
       'system_admin', 'migration 0711 demo'
FROM public.org_tenants_mst t
WHERE NOT EXISTS (SELECT 1 FROM public.org_holidays_cf x
                  WHERE x.tenant_org_id = t.id AND x.branch_id IS NULL
                    AND x.holiday_date = DATE '2027-01-02');

INSERT INTO public.org_holidays_cf
  (tenant_org_id, branch_id, holiday_date, name, name2, is_closed,
   open_time, close_time, created_by, created_info)
SELECT t.id, NULL, nd.d, 'Open on National Day (short hours)',
       'مفتوح في اليوم الوطني (دوام قصير)', false, TIME '10:00', TIME '14:00',
       'system_admin', 'migration 0711 demo'
FROM public.org_tenants_mst t
JOIN LATERAL (
  SELECT min(p.holiday_date) AS d FROM public.sys_public_holidays_cf p
  WHERE p.country_code = upper(t.country) AND p.holiday_code = 'NATIONAL_DAY'
    AND p.holiday_year = 2027
) nd ON nd.d IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM public.org_holidays_cf x
                  WHERE x.tenant_org_id = t.id AND x.branch_id IS NULL
                    AND x.holiday_date = nd.d);

-- ------------------------------------------------------------------
-- 6. Navigation: Settings › Business Calendar (CLAUDE.md rule 10;
--    dual-write with web-admin/config/navigation.ts key settings_calendar).
--    View: settings:read; save: settings:organization / branches:settings.
-- ------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2, comp_path, comp_icon,
  main_permission_code, display_order, comp_level, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions, feature_flag,
  badge, rec_status, created_info
) VALUES (
  'settings_calendar',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings', 'Business Calendar', 'تقويم العمل',
  '/dashboard/settings/calendar', 'CalendarDays',
  'settings:read', 17, 1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin"]'::jsonb, '["settings:read"]'::jsonb, '[]'::jsonb,
  NULL, 1,
  'Migration 0711 - business hours, cut-off, ready time and holidays (Service Speeds S1). Read: settings:read; save: settings:organization / branches:settings. No feature flag.'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  comp_level           = EXCLUDED.comp_level,
  is_leaf              = TRUE,
  is_navigable         = TRUE,
  is_active            = TRUE,
  roles                = EXCLUDED.roles,
  permissions          = EXCLUDED.permissions,
  feature_flag         = EXCLUDED.feature_flag,
  updated_at           = CURRENT_TIMESTAMP;

COMMIT;
