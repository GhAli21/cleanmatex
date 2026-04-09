BEGIN;

CREATE TABLE public.hq_crm_marketing_page_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  locale text NOT NULL,
  revision_number integer NOT NULL,
  revision_status text NOT NULL DEFAULT 'draft' CHECK (revision_status IN ('draft', 'published')),
  content_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (page_key, locale, revision_number)
);

CREATE INDEX idx_hq_crm_mkt_page_revision_lookup
  ON public.hq_crm_marketing_page_revision (page_key, locale, revision_number DESC);

CREATE INDEX idx_hq_crm_mkt_page_revision_status
  ON public.hq_crm_marketing_page_revision (revision_status, page_key, locale);

CREATE TRIGGER trg_hq_crm_marketing_page_revision_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_page_revision
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_updated_at();

COMMENT ON TABLE public.hq_crm_marketing_page_revision IS 'Draft and published revisions for localized marketing page content edited from HQ.';

CREATE TABLE public.hq_crm_marketing_plan_overlay_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(50) NOT NULL REFERENCES public.sys_pln_subscription_plans_mst(plan_code) ON DELETE RESTRICT,
  locale text NOT NULL,
  revision_number integer NOT NULL,
  revision_status text NOT NULL DEFAULT 'draft' CHECK (revision_status IN ('draft', 'published')),
  highlights_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  footnote text,
  cta_label text,
  sort_order integer,
  created_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (plan_code, locale, revision_number)
);

CREATE INDEX idx_hq_crm_mkt_plan_overlay_revision_lookup
  ON public.hq_crm_marketing_plan_overlay_revision (plan_code, locale, revision_number DESC);

CREATE INDEX idx_hq_crm_mkt_plan_overlay_revision_status
  ON public.hq_crm_marketing_plan_overlay_revision (revision_status, plan_code, locale);

CREATE TRIGGER trg_hq_crm_marketing_plan_overlay_revision_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_plan_overlay_revision
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_updated_at();

COMMENT ON TABLE public.hq_crm_marketing_plan_overlay_revision IS 'Draft and published revisions for marketing-only plan overlay content edited from HQ.';

GRANT ALL ON TABLE public.hq_crm_marketing_page_revision TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_plan_overlay_revision TO service_role;

COMMIT;
