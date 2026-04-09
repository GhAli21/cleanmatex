-- Backfill hq_crm_marketing_lead_daily_seq from existing lead_code values (requires 0229).
-- For each UTC day that already has leads, set last_n = GREATEST(max_suffix_that_day, 31).
-- Next hq_crm_marketing_lead_code_next() call then returns max(..., 31) + 1
-- (so legacy low suffixes still yield the next code as at least 000032 when max was < 32).

INSERT INTO public.hq_crm_marketing_lead_daily_seq (day_utc, last_n)
SELECT
  day_utc_d,
  GREATEST(COALESCE(max_suf, 0), 31)
FROM (
  SELECT
    (submitted_at AT TIME ZONE 'UTC')::date AS day_utc_d,
    MAX((regexp_match(lead_code, '^CMX-[0-9]{8}-([0-9]+)$'))[1]::integer) AS max_suf
  FROM public.hq_crm_marketing_leads
  WHERE lead_code ~ '^CMX-[0-9]{8}-[0-9]+$'
  GROUP BY 1
) daily
ON CONFLICT (day_utc) DO UPDATE
SET last_n = GREATEST(
  public.hq_crm_marketing_lead_daily_seq.last_n,
  EXCLUDED.last_n
);

COMMENT ON TABLE public.hq_crm_marketing_lead_daily_seq IS
  'Per-UTC-day suffix high-water mark for marketing lead_code; backfilled from hq_crm_marketing_leads. hq_crm_marketing_lead_code_next() issues last_n + 1 (new UTC days start at 000032).';
