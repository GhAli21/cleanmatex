-- Marketing lead_code: per UTC calendar day, suffix starts at 000032 and increments by 1
-- with no skipped numbers in normal operation (gapless while advisory lock is held).
-- Replaces global sequence. Duplicate explicit lead_code is replaced. On hard failure, UUID suffix.

-- ---------------------------------------------------------------------------
-- Fallback when normal allocation cannot complete (must never raise)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hq_crm_marketing_lead_code_fallback_random()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  d date := (timezone('UTC', now()))::date;
  suf text;
BEGIN
  suf := substring(
    md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text)
    FROM 1 FOR 8
  );
  RETURN 'CMX-' || to_char(d, 'YYYYMMDD') || '-R' || upper(suf);
END;
$$;

COMMENT ON FUNCTION public.hq_crm_marketing_lead_code_fallback_random() IS
  'CMX-YYYYMMDD-R + 8 hex chars; used only when gapless counter path fails.';

-- ---------------------------------------------------------------------------
-- Daily counter table (last_n = last issued numeric suffix for that UTC day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hq_crm_marketing_lead_daily_seq (
  day_utc date PRIMARY KEY,
  last_n integer NOT NULL
);

COMMENT ON TABLE public.hq_crm_marketing_lead_daily_seq IS
  'Per-UTC-day last issued numeric suffix for marketing lead_code (gapless under lock; first code of day is 32).';

-- ---------------------------------------------------------------------------
-- Next code: gapless. Caller MUST hold pg_advisory_xact_lock(884201, day_key) for this UTC date.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hq_crm_marketing_lead_code_next()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  d date := (timezone('UTC', now()))::date;
  prev integer;
  n integer;
  candidate text;
  safety int := 0;
  const_max_suffix constant integer := 999999;
BEGIN
  SELECT s.last_n INTO prev
  FROM public.hq_crm_marketing_lead_daily_seq s
  WHERE s.day_utc = d
  FOR UPDATE;

  IF NOT FOUND THEN
    n := 32;
  ELSE
    n := prev + 1;
  END IF;

  LOOP
    IF n > const_max_suffix THEN
      RETURN public.hq_crm_marketing_lead_code_fallback_random();
    END IF;

    candidate := 'CMX-' || to_char(d, 'YYYYMMDD') || '-' || lpad(n::text, 6, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.hq_crm_marketing_leads l WHERE l.lead_code = candidate
    ) THEN
      EXIT;
    END IF;

    n := n + 1;
    safety := safety + 1;
    IF safety > 100000 THEN
      RETURN public.hq_crm_marketing_lead_code_fallback_random();
    END IF;
  END LOOP;

  INSERT INTO public.hq_crm_marketing_lead_daily_seq (day_utc, last_n)
  VALUES (d, n)
  ON CONFLICT (day_utc) DO UPDATE
  SET last_n = excluded.last_n;

  RETURN candidate;
EXCEPTION
  WHEN OTHERS THEN
    RETURN public.hq_crm_marketing_lead_code_fallback_random();
END;
$$;

COMMENT ON FUNCTION public.hq_crm_marketing_lead_code_next() IS
  'Gapless CMX-UTCDate-NNNNNN under per-day advisory lock; first N is 32. Skips N only if that code already exists in hq_crm_marketing_leads.';

-- ---------------------------------------------------------------------------
-- BEFORE INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hq_crm_marketing_leads_set_lead_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  d_utc date;
  candidate text;
  lock_k2 integer;
  p int := 0;
  const_p_max constant int := 24;
BEGIN
  IF NEW.lead_code IS NOT NULL AND btrim(NEW.lead_code) <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.hq_crm_marketing_leads l WHERE l.lead_code = btrim(NEW.lead_code)
    ) THEN
      NEW.lead_code := btrim(NEW.lead_code);
      RETURN NEW;
    END IF;
    NEW.lead_code := NULL;
  END IF;

  d_utc := (timezone('UTC', now()))::date;
  lock_k2 := abs(hashtext('hq_crm_mkt_lead_code:' || d_utc::text));
  IF lock_k2 = 0 THEN
    lock_k2 := 1;
  END IF;

  PERFORM pg_advisory_xact_lock(884201, lock_k2);

  BEGIN
    candidate := public.hq_crm_marketing_lead_code_next();

    WHILE EXISTS (
      SELECT 1 FROM public.hq_crm_marketing_leads l WHERE l.lead_code = candidate
    ) AND p < const_p_max
    LOOP
      p := p + 1;
      candidate := public.hq_crm_marketing_lead_code_fallback_random();
    END LOOP;

    IF EXISTS (SELECT 1 FROM public.hq_crm_marketing_leads l WHERE l.lead_code = candidate) THEN
      candidate := 'CMX-' || to_char(d_utc, 'YYYYMMDD') || '-U'
        || upper(replace(gen_random_uuid()::text, '-', ''));
    END IF;

    NEW.lead_code := candidate;
    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      NEW.lead_code := 'CMX-' || to_char(d_utc, 'YYYYMMDD') || '-U'
        || upper(replace(gen_random_uuid()::text, '-', ''));
      RETURN NEW;
  END;
END;
$$;

GRANT ALL ON TABLE public.hq_crm_marketing_lead_daily_seq TO service_role;

GRANT EXECUTE ON FUNCTION public.hq_crm_marketing_lead_code_fallback_random() TO service_role;
GRANT EXECUTE ON FUNCTION public.hq_crm_marketing_lead_code_next() TO service_role;

DROP SEQUENCE IF EXISTS public.hq_crm_marketing_lead_code_seq;
