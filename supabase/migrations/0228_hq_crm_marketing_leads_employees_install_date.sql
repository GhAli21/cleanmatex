-- Marketing leads: columns used by marketing-web lead API and platform-api (detail DTO).
-- Fixes: "Could not find the 'number_of_employees' column ... in the schema cache"

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN IF NOT EXISTS number_of_employees text;

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN IF NOT EXISTS planned_install_date text;

COMMENT ON COLUMN public.hq_crm_marketing_leads.number_of_employees IS
  'Headcount band or value from marketing forms (e.g. select option label); distinct from company_size when both are collected.';

COMMENT ON COLUMN public.hq_crm_marketing_leads.planned_install_date IS
  'Target go-live / install date as submitted (ISO date string or free text from form).';
