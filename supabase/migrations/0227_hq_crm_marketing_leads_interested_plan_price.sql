-- Marketing leads: store displayed plan price label at submit (complements interested_plan_code).
-- marketing-web and platform-api reference this column; 0225 added plan code only.

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN IF NOT EXISTS interested_plan_price text;

COMMENT ON COLUMN public.hq_crm_marketing_leads.interested_plan_price IS
  'Human-readable plan price shown when the lead submitted (e.g. formatted tier price); complements interested_plan_code.';
