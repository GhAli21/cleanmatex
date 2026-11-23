-- =============================================================================
-- Migration: 0819_ntf_campaign_wa_template.sql
-- Purpose:   Background Jobs STEP5_PLAN item 4c. WhatsApp campaigns to customers
--            send one approved Meta MARKETING template chosen on the campaign,
--            never free text.
--              1. org_ntf_route_assign_cf.template_code: a route for the marketing
--                 send event 'campaign.send' names the logical template it sends,
--                 so an Organization can hold several approved marketing templates
--                 (one route per template and language). Routes of every other
--                 event keep template_code NULL (one template per event, as today).
--              2. The route scope key gains template_code (NULLS NOT DISTINCT, so
--                 event routes stay one per event/channel/language).
--              3. org_ntf_campaigns_mst.template_vars: the values the campaign gives
--                 the template's variables (by variable_key).
--              4. A WhatsApp campaign must name its template.
--            HQ API resolves a campaign send through the ACTIVE route whose
--            template_code is the campaign's template_code, in the customer's
--            language; route activation checks the provider registration is a
--            MARKETING one and belongs to that template.
-- Affected:  org_ntf_route_assign_cf, org_ntf_campaigns_mst
-- Related:   0579 (route assignments), 0818 (campaign audience), 0346 (templates)
-- Safety:    At write time there are no campaigns (local and remote) and the only
--            route (remote) is for 'order.created', so every CHECK validates at once.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. Route: which logical template a campaign route sends
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_ntf_route_assign_cf
  ADD COLUMN template_code TEXT;
COMMENT ON COLUMN public.org_ntf_route_assign_cf.template_code IS
  'Logical template this route sends. Required for the marketing send event campaign.send (a campaign picks the template by this code); NULL for every other event, whose route serves the event''s one template (0819).';

-- RESTRICT: a template a route still sends cannot be removed from the catalog.
ALTER TABLE public.org_ntf_route_assign_cf
  ADD CONSTRAINT fk_ntf_route_tmpl FOREIGN KEY (template_code)
  REFERENCES public.sys_ntf_templates_mst (template_code) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_ntf_route_tmpl ON public.org_ntf_route_assign_cf IS
  'A campaign route names a template that exists in the template catalog (0819).';

-- campaign.send carries many templates (one per marketing message); other events carry one.
ALTER TABLE public.org_ntf_route_assign_cf
  ADD CONSTRAINT ck_ntf_route_tmpl CHECK ((event_code = 'campaign.send') = (template_code IS NOT NULL));
COMMENT ON CONSTRAINT ck_ntf_route_tmpl ON public.org_ntf_route_assign_cf IS
  'template_code is set exactly for campaign.send routes (0819).';

-- The old scope key allowed one route per event/channel/language, which would allow only one
-- marketing template per language. The new key adds template_code; NULLS NOT DISTINCT keeps
-- event routes (template_code NULL) one per event/channel/language exactly as before.
ALTER TABLE public.org_ntf_route_assign_cf
  DROP CONSTRAINT uq_ntf_route_scope;
ALTER TABLE public.org_ntf_route_assign_cf
  ADD CONSTRAINT uq_ntf_route_scope UNIQUE NULLS NOT DISTINCT (tenant_org_id, event_code, channel_code, language_code, template_code);
COMMENT ON CONSTRAINT uq_ntf_route_scope ON public.org_ntf_route_assign_cf IS
  'One route per tenant event/channel/language, and per template for campaign.send (0819).';

-- ---------------------------------------------------------------------------
-- 2. Campaign: template variable values; WhatsApp needs a template
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_ntf_campaigns_mst
  ADD COLUMN template_vars JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.org_ntf_campaigns_mst.template_vars IS
  'Values for the template''s variables, keyed by variable_key (strings). Copied to each outbox row''s metadata; HQ fills the provider template slots from it. The same values go to every recipient (0819).';

ALTER TABLE public.org_ntf_campaigns_mst
  ADD CONSTRAINT ck_ntf_camp_tvars CHECK (jsonb_typeof(template_vars) = 'object');
COMMENT ON CONSTRAINT ck_ntf_camp_tvars ON public.org_ntf_campaigns_mst IS
  'template_vars is a JSON object of variable_key to value (0819).';

-- Meta allows WhatsApp marketing only through an approved template; the template's event
-- (campaign.send) and the active route are checked by the create route and by HQ at send time.
ALTER TABLE public.org_ntf_campaigns_mst
  ADD CONSTRAINT ck_ntf_camp_wa_tmpl CHECK (channel_code <> 'WHATSAPP' OR template_code IS NOT NULL);
COMMENT ON CONSTRAINT ck_ntf_camp_wa_tmpl ON public.org_ntf_campaigns_mst IS
  'A WhatsApp campaign names the approved marketing template it sends (0819).';

COMMIT;
