-- Early-access funnel: plan interest, submission telemetry, acquisition channel (CleanMateX)
-- Applied via cleanmatex migrations; marketing-web consumes with service role.

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN interested_plan_code varchar(50)
  REFERENCES public.sys_pln_subscription_plans_mst(plan_code)
  ON DELETE SET NULL;

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN submission_context_jsonb jsonb;

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN acquisition_source text;

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN acquisition_source_detail text;

COMMENT ON COLUMN public.hq_crm_marketing_leads.interested_plan_code IS
  'Public subscription plan code the lead expressed interest in (marketing funnel).';

COMMENT ON COLUMN public.hq_crm_marketing_leads.submission_context_jsonb IS
  'Server + client capture at submit: IP, headers/geo, UA-derived device/OS/browser, viewport, tz, attribution audit, etc.';

COMMENT ON COLUMN public.hq_crm_marketing_leads.acquisition_source IS
  'Normalized marketing channel slug (e.g. instagram, facebook, whatsapp); complements raw utm_* columns.';

COMMENT ON COLUMN public.hq_crm_marketing_leads.acquisition_source_detail IS
  'Optional detail when source is other or campaign-specific note; keep short.';

CREATE INDEX idx_hq_crm_mkt_leads_interested_plan
  ON public.hq_crm_marketing_leads (interested_plan_code)
  WHERE interested_plan_code IS NOT NULL;

CREATE INDEX idx_hq_crm_mkt_leads_acquisition_source
  ON public.hq_crm_marketing_leads (acquisition_source)
  WHERE acquisition_source IS NOT NULL;

INSERT INTO public.hq_crm_marketing_page (page_key, locale, content_jsonb, is_published)
VALUES
  (
    'early-access',
    'en',
    '{"title":"Test the market with CleanMateX","subtitle":"See plans, pick what fits, and tell us how you operate—we will follow up with a tailored walkthrough.","intro":{"title":"Plans built for laundry operators","subtitle":"Compare tiers from your live catalog, then request a demo in a few taps."}}'::jsonb,
    true
  ),
  (
    'early-access',
    'ar',
    '{"title":"اختبر السوق مع كلين ميت إكس","subtitle":"اطلع على الخطط، اختر ما يناسبك، وأخبرنا كيف تعمل—سنتابع معك بعرض مخصص.","intro":{"title":"خطط لمشغلي المغاسل","subtitle":"قارن المستويات من كتالوجك الفعلي، ثم اطلب عرضاً في خطوات قليلة."}}'::jsonb,
    true
  )
ON CONFLICT (page_key, locale) DO NOTHING;
