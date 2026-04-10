-- =============================================================================
-- Migration 0233: Visitor Sessions + session_id FK on leads
-- =============================================================================

CREATE TABLE public.hq_crm_marketing_visitor_sessions (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client-assigned IDs
  session_id             text         NOT NULL UNIQUE,
  visitor_id             text,

  -- Level 1 & 2: Server-side HTTP (no consent required)
  ip_address             text,
  forwarded_for          text,
  user_agent             text,
  geo_country            text,
  geo_city               text,
  geo_latitude           text,
  geo_longitude          text,

  -- Level 1 & 2: UA-parsed (derived server-side, no consent)
  device_type            text,
  device_model           text,
  os_name                text,
  os_version             text,
  browser_name           text,
  browser_version        text,

  -- Level 2: Attribution (URL params + referrer header, no consent)
  landing_page           text,
  referrer               text,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_term               text,
  utm_content            text,
  gclid                  text,
  fbclid                 text,

  -- Level 2: Client context (session-scoped, sent in body, no consent)
  locale                 text,
  timezone               text,
  screen_w               integer,
  screen_h               integer,
  viewport_w             integer,
  viewport_h             integer,
  device_pixel_ratio     numeric(5,2),
  max_touch_points       smallint,
  preferred_languages    jsonb,
  network_effective_type text,
  network_downlink       numeric(8,2),
  network_rtt            integer,
  cookie_enabled         boolean,

  -- UA-CH extras (client-sent, session-scoped)
  ua_platform            text,
  ua_platform_version    text,
  ua_mobile              boolean,

  -- Battery (anonymized)
  battery_level          numeric(4,3),

  -- Level 1: Behavioral counters (updated at Save moment)
  page_views             integer        NOT NULL DEFAULT 0,
  total_dwell_ms         bigint         NOT NULL DEFAULT 0,
  max_scroll_pct         smallint       NOT NULL DEFAULT 0,

  -- Level 1: Security & compliance
  is_bot                 boolean        NOT NULL DEFAULT false,
  consent_timestamp      timestamptz,
  consent_level          smallint,

  -- Level 3: Authorized only (null unless consent granted)
  events_jsonb           jsonb          NOT NULL DEFAULT '[]'::jsonb,

  -- Conversion link
  lead_id                uuid           REFERENCES public.hq_crm_marketing_leads(id) ON DELETE SET NULL,

  -- Tracking level used
  tracking_level         smallint       NOT NULL DEFAULT 2,

  -- Lifecycle
  first_seen_at          timestamptz    NOT NULL DEFAULT now(),
  last_seen_at           timestamptz    NOT NULL DEFAULT now(),
  created_at             timestamptz    NOT NULL DEFAULT now(),
  updated_at             timestamptz    NOT NULL DEFAULT now()

  --CONSTRAINT chk_mkt_vis_page_views CHECK (page_views >= 0),
  --CONSTRAINT chk_mkt_vis_dwell      CHECK (total_dwell_ms >= 0),
  --CONSTRAINT chk_mkt_vis_scroll     CHECK (max_scroll_pct BETWEEN 0 AND 100),
  --CONSTRAINT chk_mkt_vis_battery    CHECK (battery_level IS NULL OR battery_level BETWEEN 0 AND 1),
  --CONSTRAINT chk_mkt_vis_level      CHECK (tracking_level BETWEEN 1 AND 3)
);

COMMENT ON TABLE public.hq_crm_marketing_visitor_sessions
  IS 'First-party visitor sessions for the CleanMateX marketing site. session_id is created on site arrival (sessionStorage). visitor_id is Level 3 consent-gated (localStorage).';

COMMENT ON COLUMN public.hq_crm_marketing_visitor_sessions.session_id
  IS 'UUID generated the moment user lands on the site, stored in sessionStorage (cmx_sid). Wiped when tab closes.';

COMMENT ON COLUMN public.hq_crm_marketing_visitor_sessions.visitor_id
  IS 'UUID stored in localStorage (cmx_vid). Only populated after Level 3 consent is granted. Persists across sessions.';

COMMENT ON COLUMN public.hq_crm_marketing_visitor_sessions.events_jsonb
  IS 'Level 3 clickstream array. Empty unless consent granted. Capped by events_jsonb_max_items from tracking config.';

CREATE UNIQUE INDEX idx_hq_crm_mkt_vis_session_id ON public.hq_crm_marketing_visitor_sessions (session_id);
CREATE INDEX idx_hq_crm_mkt_vis_visitor_id ON public.hq_crm_marketing_visitor_sessions (visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_hq_crm_mkt_vis_lead_id ON public.hq_crm_marketing_visitor_sessions (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_hq_crm_mkt_vis_last_seen ON public.hq_crm_marketing_visitor_sessions (last_seen_at DESC);
CREATE INDEX idx_hq_crm_mkt_vis_utm_source ON public.hq_crm_marketing_visitor_sessions (utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX idx_hq_crm_mkt_vis_geo_country ON public.hq_crm_marketing_visitor_sessions (geo_country) WHERE geo_country IS NOT NULL;
CREATE INDEX idx_hq_crm_mkt_vis_device_type ON public.hq_crm_marketing_visitor_sessions (device_type);
CREATE INDEX idx_hq_crm_mkt_vis_is_bot ON public.hq_crm_marketing_visitor_sessions (is_bot) WHERE is_bot = true;

CREATE OR REPLACE FUNCTION public.hq_crm_mkt_vis_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hq_crm_mkt_vis_updated_at
  BEFORE UPDATE ON public.hq_crm_marketing_visitor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.hq_crm_mkt_vis_set_updated_at();

GRANT ALL ON TABLE public.hq_crm_marketing_visitor_sessions TO service_role;

ALTER TABLE public.hq_crm_marketing_leads
  ADD COLUMN IF NOT EXISTS session_id text
    REFERENCES public.hq_crm_marketing_visitor_sessions(session_id) ON DELETE SET NULL;

CREATE INDEX idx_hq_crm_mkt_leads_session
  ON public.hq_crm_marketing_leads (session_id)
  WHERE session_id IS NOT NULL;
