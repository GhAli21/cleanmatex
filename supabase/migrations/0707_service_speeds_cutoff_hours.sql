-- =============================================================================
-- 0707_service_speeds_cutoff_hours.sql
-- Service Speeds & Ready-By Calendar — S1, part 1 of 2
-- (docs/features/Service_Speeds/PLAN.md §1 D1/D4/D7, §4, §4.1).
--
-- Why:
-- 1. sys_service_speed_cd gets the full platform speed set (D1): ECONOMY,
--    STANDARD, NEXT_DAY, EXPRESS, URGENT, ranked by display_order (D6: the
--    order header speed = fastest line speed by this rank). EXPRESS Arabic
--    name becomes «مستعجل» and URGENT is «طارئ» (D7). Codes never change.
--    New column default_turnaround_unit is guidance only (PLAN §3); the real
--    turnaround is each organization's Speed Pricing rule (D2).
-- 2. org_orders_mst.service_speed: the hardcoded CHECK (STANDARD/EXPRESS) is
--    replaced by a real FK to sys_service_speed_cd, like lines and pieces.
-- 3. org_speed_price_rules_cf gets a turnaround unit (HOURS / WORKING_DAYS),
--    a working-days value and a per-speed cut-off time. Only ECONOMY may
--    carry a negative premium (discount); every other speed stays >= 0.
--    The 96 existing rules are backfilled to unit HOURS (no value change).
-- 4. Organization and branch cut-off time, ready time and weekly business
--    hours (D4). Branch NULL = use the organization's value. No defaults
--    (locale rule); the tenant values are backfilled from the country
--    calendar template in 0708, which creates those templates.
--
-- No general settings (sys_stng_*): all values are typed columns.
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. sys_service_speed_cd — guidance unit + full speed set
-- ------------------------------------------------------------------
ALTER TABLE public.sys_service_speed_cd
  ADD COLUMN IF NOT EXISTS default_turnaround_unit TEXT NULL;

-- Allowed units match org_speed_price_rules_cf.turnaround_unit.
ALTER TABLE public.sys_service_speed_cd
  DROP CONSTRAINT IF EXISTS chk_sys_spd_turnaround_unit;
ALTER TABLE public.sys_service_speed_cd
  ADD CONSTRAINT chk_sys_spd_turnaround_unit
  CHECK (default_turnaround_unit IS NULL
         OR default_turnaround_unit IN ('HOURS', 'WORKING_DAYS'));

COMMENT ON COLUMN public.sys_service_speed_cd.default_turnaround_unit IS
  'Suggested turnaround unit for this speed (HOURS | WORKING_DAYS), shown as guidance in Speed Pricing. Not used in ready-by math; the organization rule decides.';
COMMENT ON CONSTRAINT chk_sys_spd_turnaround_unit ON public.sys_service_speed_cd IS
  'default_turnaround_unit is NULL or one of HOURS, WORKING_DAYS.';
COMMENT ON COLUMN public.sys_service_speed_cd.display_order IS
  'Speed rank, slowest first (ECONOMY 1 … URGENT 5). The order header speed is the line speed with the highest rank (fastest).';

-- Idempotent seed: platform data, names/descriptions always refreshed.
INSERT INTO public.sys_service_speed_cd
  (code, name, name2, description, description2, display_order,
   is_default, is_active, default_turnaround_unit, rec_status)
VALUES
  ('ECONOMY',  'Economy',  'اقتصادي',
   'Lower price for a longer wait, usually 4–7 working days',
   'سعر أقل مقابل انتظار أطول، عادة من 4 إلى 7 أيام عمل',
   1, false, true, 'WORKING_DAYS', 1),
  ('STANDARD', 'Standard', 'عادي',
   'Normal turnaround at the standard price, usually 2–3 working days',
   'مدة تسليم عادية بالسعر العادي، عادة من 2 إلى 3 أيام عمل',
   2, true,  true, 'WORKING_DAYS', 1),
  ('NEXT_DAY', 'Next day', 'اليوم التالي',
   'Ready on the next working day',
   'جاهز في يوم العمل التالي',
   3, false, true, 'WORKING_DAYS', 1),
  ('EXPRESS',  'Express',  'مستعجل',
   'Ready the same day when dropped off before the cut-off time',
   'جاهز في نفس اليوم إذا تم التسليم قبل آخر وقت للاستلام',
   4, false, true, 'WORKING_DAYS', 1),
  ('URGENT',   'Urgent',   'طارئ',
   'Ready within a few working hours',
   'جاهز خلال ساعات عمل قليلة',
   5, false, true, 'HOURS', 1)
ON CONFLICT (code) DO UPDATE SET
  name                    = EXCLUDED.name,
  name2                   = EXCLUDED.name2,
  description             = EXCLUDED.description,
  description2            = EXCLUDED.description2,
  display_order           = EXCLUDED.display_order,
  is_default              = EXCLUDED.is_default,
  is_active               = EXCLUDED.is_active,
  default_turnaround_unit = EXCLUDED.default_turnaround_unit,
  updated_at              = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 2. org_orders_mst.service_speed — CHECK replaced by FK
-- ------------------------------------------------------------------
-- Removed: the CHECK only allowed STANDARD/EXPRESS; the FK below allows every
-- platform speed. All 8 existing rows are STANDARD/EXPRESS (verified), so
-- the FK validates.
ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS oc_order_speed_ck;

ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS fk_oom_service_speed;
ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT fk_oom_service_speed
  FOREIGN KEY (service_speed) REFERENCES public.sys_service_speed_cd(code)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
-- No index: platform speed codes are never deleted or renamed, so the FK
-- never scans org_orders_mst.

COMMENT ON CONSTRAINT fk_oom_service_speed ON public.org_orders_mst IS
  'Header speed is a real platform speed (sys_service_speed_cd). Value = fastest line speed by display_order. NULL allowed for legacy rows.';

-- ------------------------------------------------------------------
-- 3. org_speed_price_rules_cf — turnaround unit, days, speed cut-off
-- ------------------------------------------------------------------
ALTER TABLE public.org_speed_price_rules_cf
  ADD COLUMN IF NOT EXISTS turnaround_unit       TEXT     NULL,
  ADD COLUMN IF NOT EXISTS turnaround_days_speed SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS cutoff_time_speed     TIME     NULL;

COMMENT ON COLUMN public.org_speed_price_rules_cf.turnaround_unit IS
  'HOURS = turnaround_hh_speed working hours inside opening hours; WORKING_DAYS = ready on the Nth working day at the ready time. NULL = rule sets no turnaround.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.turnaround_days_speed IS
  'Working days when turnaround_unit = WORKING_DAYS (0 = same day). NULL otherwise.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.cutoff_time_speed IS
  'Optional cut-off for this speed (local branch time). Drop-off after it counts from the next opening. NULL = branch, then organization cut-off.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.turnaround_hh_speed IS
  'Working hours when turnaround_unit = HOURS. NULL otherwise.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.multiplier_speed IS
  'MULTIPLIER: added fraction over the standard price (0.30 = +30%). Negative (> -1) only for ECONOMY, a discount.';
COMMENT ON COLUMN public.org_speed_price_rules_cf.speed_extra_amount IS
  'FIXED_AMOUNT: flat amount per unit or per line (price_basis). Negative only for ECONOMY, a discount; the engine floors the line net at 0.';

-- Backfill: every rule that has hours becomes unit HOURS (values unchanged).
UPDATE public.org_speed_price_rules_cf
   SET turnaround_unit = 'HOURS'
 WHERE turnaround_hh_speed IS NOT NULL
   AND turnaround_unit IS NULL;

ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_turn_unit;
ALTER TABLE public.org_speed_price_rules_cf
  ADD CONSTRAINT chk_org_spd_price_rules_turn_unit
  CHECK (
    (turnaround_unit IS NULL
       AND turnaround_hh_speed IS NULL AND turnaround_days_speed IS NULL)
    OR (turnaround_unit = 'HOURS'
       AND turnaround_hh_speed IS NOT NULL AND turnaround_days_speed IS NULL)
    OR (turnaround_unit = 'WORKING_DAYS'
       AND turnaround_days_speed IS NOT NULL AND turnaround_hh_speed IS NULL)
  );
COMMENT ON CONSTRAINT chk_org_spd_price_rules_turn_unit ON public.org_speed_price_rules_cf IS
  'Unit and value agree: HOURS ⇔ hours set and days NULL; WORKING_DAYS ⇔ days set and hours NULL; no unit ⇔ both NULL.';

ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_days_nonneg;
ALTER TABLE public.org_speed_price_rules_cf
  ADD CONSTRAINT chk_org_spd_price_rules_days_nonneg
  CHECK (turnaround_days_speed IS NULL OR turnaround_days_speed >= 0);
COMMENT ON CONSTRAINT chk_org_spd_price_rules_days_nonneg ON public.org_speed_price_rules_cf IS
  'Working days are 0 (same day) or more.';

-- Removed: the old non-negative CHECKs; replaced by ECONOMY-aware versions.
ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_multiplier_nonneg;
ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_extra_nonneg;

ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_multiplier;
ALTER TABLE public.org_speed_price_rules_cf
  ADD CONSTRAINT chk_org_spd_price_rules_multiplier
  CHECK (
    multiplier_speed IS NULL
    OR multiplier_speed >= 0
    OR (service_speed = 'ECONOMY' AND multiplier_speed > -1)
  );
COMMENT ON CONSTRAINT chk_org_spd_price_rules_multiplier ON public.org_speed_price_rules_cf IS
  'Multiplier >= 0, except ECONOMY may discount: > -1 (never a free or negative line).';

ALTER TABLE public.org_speed_price_rules_cf
  DROP CONSTRAINT IF EXISTS chk_org_spd_price_rules_extra;
ALTER TABLE public.org_speed_price_rules_cf
  ADD CONSTRAINT chk_org_spd_price_rules_extra
  CHECK (
    speed_extra_amount IS NULL
    OR speed_extra_amount >= 0
    OR service_speed = 'ECONOMY'
  );
COMMENT ON CONSTRAINT chk_org_spd_price_rules_extra ON public.org_speed_price_rules_cf IS
  'Fixed amount >= 0, except ECONOMY may be negative (discount; engine floors line net at 0).';
-- SELL_PRICE keeps chk_org_spd_price_rules_sell_price_nonneg (>= 0): it is an
-- absolute price, so "below standard" depends on the product price and is
-- validated in the app (ECONOMY only), not here.

-- ------------------------------------------------------------------
-- 4. Organization and branch cut-off, ready time, business hours
-- ------------------------------------------------------------------
ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS order_cutoff_time TIME NULL,
  ADD COLUMN IF NOT EXISTS ready_time        TIME NULL;

COMMENT ON COLUMN public.org_tenants_mst.order_cutoff_time IS
  'Organization cut-off (local time). Drop-off after it counts from the next opening. NULL = none. Branch value overrides.';
COMMENT ON COLUMN public.org_tenants_mst.ready_time IS
  'Time of day WORKING_DAYS orders are promised ready (local time, capped at closing). Branch value overrides.';
COMMENT ON COLUMN public.org_tenants_mst.business_hours IS
  'Weekly opening hours: keys mon..sun, value {"open":"HH:MM","close":"HH:MM"} or null (closed). Branch value overrides.';

ALTER TABLE public.org_branches_mst
  ADD COLUMN IF NOT EXISTS order_cutoff_time TIME  NULL,
  ADD COLUMN IF NOT EXISTS ready_time        TIME  NULL,
  ADD COLUMN IF NOT EXISTS business_hours    JSONB NULL;

COMMENT ON COLUMN public.org_branches_mst.order_cutoff_time IS
  'Branch cut-off (local time). NULL = use the organization''s order_cutoff_time.';
COMMENT ON COLUMN public.org_branches_mst.ready_time IS
  'Branch ready time (local time). NULL = use the organization''s ready_time.';
COMMENT ON COLUMN public.org_branches_mst.business_hours IS
  'Branch weekly opening hours, same shape as org_tenants_mst.business_hours. NULL = use the organization''s.';

-- Shape guard: an object whose keys are only weekday codes. Per-day value
-- format (null or {open,close}) is validated by the app schema.
ALTER TABLE public.org_tenants_mst
  DROP CONSTRAINT IF EXISTS chk_org_tnt_business_hours;
ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT chk_org_tnt_business_hours
  CHECK (
    business_hours IS NULL
    OR (jsonb_typeof(business_hours) = 'object'
        AND (business_hours - ARRAY['mon','tue','wed','thu','fri','sat','sun']) = '{}'::jsonb)
  );
COMMENT ON CONSTRAINT chk_org_tnt_business_hours ON public.org_tenants_mst IS
  'business_hours is NULL or a JSON object keyed only by mon..sun.';

ALTER TABLE public.org_branches_mst
  DROP CONSTRAINT IF EXISTS chk_org_brn_business_hours;
ALTER TABLE public.org_branches_mst
  ADD CONSTRAINT chk_org_brn_business_hours
  CHECK (
    business_hours IS NULL
    OR (jsonb_typeof(business_hours) = 'object'
        AND (business_hours - ARRAY['mon','tue','wed','thu','fri','sat','sun']) = '{}'::jsonb)
  );
COMMENT ON CONSTRAINT chk_org_brn_business_hours ON public.org_branches_mst IS
  'business_hours is NULL or a JSON object keyed only by mon..sun.';

COMMIT;
