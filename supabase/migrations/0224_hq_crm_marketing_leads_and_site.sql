-- Marketing CRM leads + marketing site content (CleanMateX)
-- Applied via cleanmatex migrations; consumed by marketing-web with DATABASE_URL (server-only).

-- ---------------------------------------------------------------------------
-- Sequences for lead_code
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS hq_crm_marketing_lead_code_seq;

CREATE OR REPLACE FUNCTION public.hq_crm_marketing_lead_code_next()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq bigint;
BEGIN
  seq := nextval('hq_crm_marketing_lead_code_seq');
  RETURN 'CMX-' || to_char(timezone('UTC', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code text NOT NULL UNIQUE,

  request_type text NOT NULL,
  full_name text NOT NULL,
  business_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  normalized_email text NOT NULL,
  normalized_phone text,

  country_code text,
  country_name text,
  preferred_language text,
  locale text,
  direction text,

  message text,

  company_size text,
  branch_count integer,
  business_type text,
  current_tools text,

  pain_points_jsonb jsonb,
  services_needed_jsonb jsonb,

  source_page text,
  landing_page text,
  referrer text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  gclid text,
  fbclid text,

  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to text,
  notes_internal text,

  is_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of_id uuid REFERENCES public.hq_crm_marketing_leads(id) ON DELETE SET NULL,

  submitted_at timestamptz NOT NULL DEFAULT now(),
  first_contacted_at timestamptz,
  qualified_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT hq_crm_marketing_leads_status_check CHECK (
    status = ANY (ARRAY['new','contacted','qualified','disqualified','closed']::text[])
  ),
  CONSTRAINT hq_crm_marketing_leads_priority_check CHECK (
    priority = ANY (ARRAY['low','normal','high','urgent']::text[])
  ),
  CONSTRAINT hq_crm_marketing_leads_branch_count_check CHECK (branch_count IS NULL OR branch_count >= 0)
);

COMMENT ON TABLE public.hq_crm_marketing_leads IS 'Marketing / demo / contact leads captured from CleanMateX marketing site';

CREATE INDEX idx_hq_crm_mkt_leads_norm_email ON public.hq_crm_marketing_leads (normalized_email);
CREATE INDEX idx_hq_crm_mkt_leads_norm_phone ON public.hq_crm_marketing_leads (normalized_phone);
CREATE INDEX idx_hq_crm_mkt_leads_status ON public.hq_crm_marketing_leads (status);
CREATE INDEX idx_hq_crm_mkt_leads_request_type ON public.hq_crm_marketing_leads (request_type);
CREATE INDEX idx_hq_crm_mkt_leads_submitted_at ON public.hq_crm_marketing_leads (submitted_at DESC);
CREATE INDEX idx_hq_crm_mkt_leads_locale ON public.hq_crm_marketing_leads (locale);
CREATE INDEX idx_hq_crm_mkt_leads_utm_source ON public.hq_crm_marketing_leads (utm_source);
CREATE INDEX idx_hq_crm_mkt_leads_utm_campaign ON public.hq_crm_marketing_leads (utm_campaign);
CREATE INDEX idx_hq_crm_mkt_leads_duplicate_of ON public.hq_crm_marketing_leads (duplicate_of_id);

CREATE OR REPLACE FUNCTION public.hq_crm_marketing_leads_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hq_crm_marketing_leads_set_lead_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lead_code IS NULL OR NEW.lead_code = '' THEN
    NEW.lead_code := public.hq_crm_marketing_lead_code_next();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hq_crm_marketing_leads_lead_code
  BEFORE INSERT ON public.hq_crm_marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_lead_code();

CREATE TRIGGER trg_hq_crm_marketing_leads_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_updated_at();

-- ---------------------------------------------------------------------------
-- Lead events
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hq_crm_marketing_leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_label text,
  event_payload_jsonb jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX idx_hq_crm_mkt_lead_events_lead ON public.hq_crm_marketing_lead_events (lead_id);
CREATE INDEX idx_hq_crm_mkt_lead_events_type ON public.hq_crm_marketing_lead_events (event_type);
CREATE INDEX idx_hq_crm_mkt_lead_events_created ON public.hq_crm_marketing_lead_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- Lead notes
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hq_crm_marketing_leads(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX idx_hq_crm_mkt_lead_notes_lead ON public.hq_crm_marketing_lead_notes (lead_id);

-- ---------------------------------------------------------------------------
-- Lead tags
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hq_crm_marketing_leads(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag)
);

CREATE INDEX idx_hq_crm_mkt_lead_tags_lead ON public.hq_crm_marketing_lead_tags (lead_id);
CREATE INDEX idx_hq_crm_mkt_lead_tags_tag ON public.hq_crm_marketing_lead_tags (tag);

-- ---------------------------------------------------------------------------
-- Marketing page content (JSON per page + locale)
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_page (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  locale text NOT NULL,
  content_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, locale)
);

CREATE INDEX idx_hq_crm_mkt_page_published ON public.hq_crm_marketing_page (is_published, page_key);

CREATE TRIGGER trg_hq_crm_marketing_page_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_page
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_updated_at();

COMMENT ON TABLE public.hq_crm_marketing_page IS 'Localized marketing site content blocks (hero, features narrative, segments, etc.)';

-- ---------------------------------------------------------------------------
-- Per-plan marketing overlays (references billing plan master)
-- ---------------------------------------------------------------------------
CREATE TABLE public.hq_crm_marketing_plan_overlay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(50) NOT NULL REFERENCES public.sys_pln_subscription_plans_mst(plan_code) ON DELETE RESTRICT,
  locale text NOT NULL,
  highlights_jsonb jsonb NOT NULL DEFAULT '[]'::jsonb,
  footnote text,
  cta_label text,
  sort_order integer,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, locale)
);

CREATE INDEX idx_hq_crm_mkt_plan_overlay_locale ON public.hq_crm_marketing_plan_overlay (locale);

CREATE TRIGGER trg_hq_crm_marketing_plan_overlay_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_plan_overlay
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_marketing_leads_set_updated_at();

COMMENT ON TABLE public.hq_crm_marketing_plan_overlay IS 'Marketing-only bullets/CTA for subscription plans; commercial truth stays on sys_pln_subscription_plans_mst';

-- ---------------------------------------------------------------------------
-- Grants: allow service role and postgres; marketing app typically uses service URL
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.hq_crm_marketing_leads TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_lead_events TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_lead_notes TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_lead_tags TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_page TO service_role;
GRANT ALL ON TABLE public.hq_crm_marketing_plan_overlay TO service_role;

GRANT USAGE, SELECT ON SEQUENCE hq_crm_marketing_lead_code_seq TO service_role;

-- Read-only marketing content for anon/authenticated if ever needed from RLS client (optional)
GRANT SELECT ON public.hq_crm_marketing_page TO anon, authenticated;
GRANT SELECT ON public.hq_crm_marketing_plan_overlay TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed marketing pages (minimal; expand in app or SQL as needed)
-- ---------------------------------------------------------------------------
INSERT INTO public.hq_crm_marketing_page (page_key, locale, content_jsonb, is_published)
VALUES
  ('home', 'en', '{"hero":{"eyebrow":"CleanMateX","title":"Run laundry operations, customer growth, and delivery from one serious SaaS platform.","subtitle":"Built for single-branch operators scaling to multi-branch chains—digital intake, workflows, receipts, pickup and delivery, and bilingual EN/AR support.","primaryCta":"Book a demo","secondaryCta":"View pricing"},"trust":{"items":[{"label":"Multi-tenant SaaS"},{"label":"GCC-ready"},{"label":"English / Arabic"},{"label":"Pickup & delivery"},{"label":"Growth & marketplace-ready"}]},"problemSolution":{"title":"Operations, revenue, and customer experience in one stack","subtitle":"CleanMateX goes beyond a simple POS: workflow, engagement, and expansion paths for laundry and dry-cleaning businesses.","problems":["Fragmented tools for orders, drivers, and receipts","Hard to scale processes across branches","Limited visibility into performance and retention"],"solutions":["Unified intake to delivery with clear statuses","Branch-ready operations with room to grow","Receipts, invoicing options, and analytics aligned to how laundries sell"]},"segments":{"title":"Built for every laundry size","subtitle":"From neighborhood shops to franchises—same platform, stronger as you grow.","items":[{"title":"Traditional small laundries","description":"Start with mobile-first intake, WhatsApp-friendly receipts, and low-friction customer onboarding.","points":["Simple intake","Guest-friendly customers","Digital receipts"]},{"title":"Small and medium laundries","description":"Layer delivery, loyalty, staff workflows, and reporting as you mature.","points":["Branch operations","Driver workflows","Campaigns and retention"]},{"title":"Large chains and franchises","description":"Scale multi-branch operations with governance and analytics built for expansion.","points":["Central oversight","Corporate-ready billing posture","Operational analytics"]}]},"cta":{"title":"See CleanMateX on your workflows","subtitle":"Tell us about your branches, channels, and goals—we will tailor the walkthrough.","button":"Book a demo"}}'::jsonb, true),
  ('home', 'ar', '{"hero":{"eyebrow":"كلين ميت إكس","title":"شغّل عمليات الغسيل، نمو العملاء، والتوصيل من منصة SaaS واحدة.","subtitle":"للمغاسل من فرع واحد حتى السلاسل—استقبال رقمي، سير عمل، إيصالات، استلام وتوصيل، ودعم كامل بالعربية والإنجليزية.","primaryCta":"احجز عرضاً","secondaryCta":"الأسعار"},"trust":{"items":[{"label":"SaaS متعدد المستأجرين"},{"label":"جاهز لدول الخليج"},{"label":"عربي / إنجليزي"},{"label":"استلام وتوصيل"},{"label":"جاهز للنمو والسوق"}]},"problemSolution":{"title":"التشغيل والإيرادات وتجربة العميل في منصة واحدة","subtitle":"كلين ميت إكس أوسع من نقطة بيع بسيطة: سير عمل، تفاعل مع العملاء، ومسارات توسع لمغاسل الملابس والتنظيف الجاف.","problems":["أدوات مبعثرة للطلبات والسائقين والإيصالات","صعوبة توحيد العمليات بين الفروع","رؤية محدودة للأداء والاحتفاظ بالعملاء"],"solutions":["استقبال موحّد حتى التسليم مع حالات واضحة","تشغيل جاهز للفروع مع مجال للنمو","إيصالات وخيارات فوترة وتحليلات تناسب نموذج عمل المغاسل"]},"segments":{"title":"مصمم لكل حجم مغسلة","subtitle":"من المحل الحيّ إلى الامتياز—نفس المنصة، أقوى مع النمو.","items":[{"title":"مغاسل صغيرة تقليدية","description":"ابدأ باستقبال متوافق مع الجوال، إيصالات مناسبة للواتساب، وتسجيل عملاء بسيط.","points":["استقبال مبسط","عملاء زائرون","إيصالات رقمية"]},{"title":"مغاسل صغيرة ومتوسطة","description":"أضف التوصيل، الولاء، سير عمل الموظفين، والتقارير مع النضج.","points":["تشغيل الفروع","دعم السائقين","حملات واحتفاظ"]},{"title":"سلاسل وامتيازات","description":"وسّع تشغيل فروع متعددة مع حوكمة وتحليلات للتوسع.","points":["إشراف مركزي","جاهزية فوترة للشركات","تحليلات تشغيلية"]}]},"cta":{"title":"شاهد كلين ميت إكس على سير عملك","subtitle":"أخبرنا عن فروعك وقنواتك وأهدافك—سنخصص العرض التوضيحي.","button":"احجز عرضاً"}}'::jsonb, true),
  ('features', 'en', '{"intro":{"title":"Platform capabilities","subtitle":"Serious operations plus customer growth—not just a cash drawer."}}'::jsonb, true),
  ('features', 'ar', '{"intro":{"title":"قدرات المنصة","subtitle":"تشغيل احترافي ونمو العملاء—ليس مجرد صندوق نقود."}}'::jsonb, true),
  ('pricing', 'en', '{"intro":{"title":"Pricing aligned to your plans","subtitle":"Tiers follow your live subscription catalog. Compare and book a demo for a tailored quote."}}'::jsonb, true),
  ('pricing', 'ar', '{"intro":{"title":"أسعار متوافقة مع خططك","subtitle":"المستويات تتبع كتالوج الاشتراك الفعلي. قارن واحجز عرضاً للعرض المناسب."}}'::jsonb, true),
  ('contact', 'en', '{"title":"Contact us","subtitle":"Lower-friction message—our team will follow up."}'::jsonb, true),
  ('contact', 'ar', '{"title":"تواصل معنا","subtitle":"رسالة بسيطة—سيتواصل الفريق معك."}'::jsonb, true),
  ('demo', 'en', '{"title":"Book a demo","subtitle":"High-intent form: branches, tools, and pain points help us prepare."}'::jsonb, true),
  ('demo', 'ar', '{"title":"احجز عرضاً توضيحياً","subtitle":"نموذج مفصّل: الفروع والأدوات ونقاط الألم تساعدنا على التحضير."}'::jsonb, true)
ON CONFLICT (page_key, locale) DO NOTHING;
