-- =============================================================================
-- Migration 0232: Marketing Tracking Configuration (Master Feature Flags)
-- =============================================================================

CREATE TABLE public.hq_crm_marketing_tracking_config (
  level                    integer      PRIMARY KEY,
  level_name               text         NOT NULL,
  description              text,
  requires_consent         boolean      NOT NULL DEFAULT false,
  is_active                boolean      NOT NULL DEFAULT true,
  is_global_enabled        boolean      NOT NULL DEFAULT true,

  -- Rate & Performance Controls
  sampling_rate            numeric(3,2) NOT NULL DEFAULT 1.0,
  debounce_ms              integer      NOT NULL DEFAULT 1000,

  -- Level 1 & 2: Server-side HTTP fields (no consent required)
  track_ip_address         boolean      NOT NULL DEFAULT true,
  track_forwarded_for      boolean      NOT NULL DEFAULT true,
  track_user_agent         boolean      NOT NULL DEFAULT true,
  track_geo_country        boolean      NOT NULL DEFAULT true,
  track_geo_city           boolean      NOT NULL DEFAULT true,
  track_geo_lat_lon        boolean      NOT NULL DEFAULT false,
  track_device_type        boolean      NOT NULL DEFAULT true,
  track_device_model       boolean      NOT NULL DEFAULT true,
  track_os_name            boolean      NOT NULL DEFAULT true,
  track_os_version         boolean      NOT NULL DEFAULT true,
  track_browser_name       boolean      NOT NULL DEFAULT true,
  track_browser_version    boolean      NOT NULL DEFAULT false,
  track_referrer           boolean      NOT NULL DEFAULT true,
  track_landing_page       boolean      NOT NULL DEFAULT true,
  track_utm_source         boolean      NOT NULL DEFAULT true,
  track_utm_medium         boolean      NOT NULL DEFAULT true,
  track_utm_campaign       boolean      NOT NULL DEFAULT true,
  track_utm_term           boolean      NOT NULL DEFAULT true,
  track_utm_content        boolean      NOT NULL DEFAULT true,
  track_gclid              boolean      NOT NULL DEFAULT true,
  track_fbclid             boolean      NOT NULL DEFAULT true,

  -- Level 1 & 2: Client-sent context (session-scoped, no consent required)
  track_locale             boolean      NOT NULL DEFAULT true,
  track_timezone           boolean      NOT NULL DEFAULT true,
  track_screen_resolution  boolean      NOT NULL DEFAULT true,
  track_viewport           boolean      NOT NULL DEFAULT true,
  track_device_pixel_ratio boolean      NOT NULL DEFAULT false,
  track_max_touch_points   boolean      NOT NULL DEFAULT false,
  track_preferred_languages boolean     NOT NULL DEFAULT true,
  track_cookie_enabled     boolean      NOT NULL DEFAULT false,
  track_network_type       boolean      NOT NULL DEFAULT true,
  track_network_downlink   boolean      NOT NULL DEFAULT false,
  track_network_rtt        boolean      NOT NULL DEFAULT false,
  track_battery_level      boolean      NOT NULL DEFAULT false,

  -- Level 1: Behavioral counters (captured at Save/Submit moment)
  track_total_dwell_ms     boolean      NOT NULL DEFAULT true,
  track_max_scroll_pct     boolean      NOT NULL DEFAULT true,
  track_page_views         boolean      NOT NULL DEFAULT true,

  -- Level 1: Security & compliance
  use_bot_detection        boolean      NOT NULL DEFAULT true,
  track_consent_timestamp  boolean      NOT NULL DEFAULT true,

  -- Level 3: Authorized only (consent required)
  track_visitor_id         boolean      NOT NULL DEFAULT true,
  track_events_jsonb       boolean      NOT NULL DEFAULT true,
  inject_ga4               boolean      NOT NULL DEFAULT true,
  inject_posthog           boolean      NOT NULL DEFAULT true,
  events_jsonb_max_items   integer      NOT NULL DEFAULT 200,

  -- Audit
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               text,
  notes                    text,

  CONSTRAINT chk_trk_cfg_level     CHECK (level BETWEEN 1 AND 3),
  CONSTRAINT chk_trk_cfg_sampling  CHECK (sampling_rate BETWEEN 0.01 AND 1.0),
  CONSTRAINT chk_trk_cfg_debounce  CHECK (debounce_ms BETWEEN 0 AND 60000),
  CONSTRAINT chk_trk_cfg_max_items CHECK (events_jsonb_max_items BETWEEN 1 AND 1000)
);

COMMENT ON TABLE public.hq_crm_marketing_tracking_config
  IS 'Master feature-flag and rate-control table for the 3-tier marketing tracking system. is_global_enabled acts as emergency stop across all levels.';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.is_global_enabled
  IS 'Emergency stop flag. If false for a row, the runtime may treat tracking as disabled globally depending on application policy.';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.description
  IS 'Full developer-facing explanation of this tracking level: when it fires, what it collects, the legal basis, data retention policy, sampling rationale, and implementation notes. Displayed in Platform HQ admin UI.';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.level_name
  IS 'Human-readable name for this tier: Operational (1), Contextual (2), Authorized (3).';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.is_active
  IS 'Enables or disables this specific level. If false, runtime rejects requests for this level only unless all levels are disabled and tracking is fully short-circuited.';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.requires_consent
  IS 'If true, runtime must reject requests for this level unless consent has been granted. Intended for Level 3 only.';

COMMENT ON COLUMN public.hq_crm_marketing_tracking_config.sampling_rate
  IS '1.0 = collect 100% of events. 0.2 = randomly sample 20%. Level 1 lead submissions may still be treated as 100% by application logic.';

INSERT INTO public.hq_crm_marketing_tracking_config
  (level, level_name, description, requires_consent, is_active, is_global_enabled,
   sampling_rate, debounce_ms,
   track_ip_address, track_forwarded_for, track_user_agent,
   track_geo_country, track_geo_city, track_geo_lat_lon,
   track_device_type, track_device_model, track_os_name, track_os_version,
   track_browser_name, track_browser_version,
   track_referrer, track_landing_page,
   track_utm_source, track_utm_medium, track_utm_campaign, track_utm_term, track_utm_content,
   track_gclid, track_fbclid,
   track_locale, track_timezone, track_screen_resolution, track_viewport,
   track_device_pixel_ratio, track_max_touch_points, track_preferred_languages,
   track_cookie_enabled, track_network_type, track_network_downlink, track_network_rtt,
   track_battery_level,
   track_total_dwell_ms, track_max_scroll_pct, track_page_views,
   use_bot_detection, track_consent_timestamp,
   track_visitor_id, track_events_jsonb, inject_ga4, inject_posthog, events_jsonb_max_items,
   notes)
VALUES
  (1, 'Operational',
   'PURPOSE: Captures the lead and the full conversion context when a user clicks the Save/Submit button on a lead form.
TRIGGER: Fires once per form submission (not on every page load).
LEGAL BASIS: Legitimate Interest — collecting this data is necessary to fulfil the user''s own request (submitting a demo or contact form). No consent banner required.
WHAT IT COLLECTS:
  - Lead identity: name, email, phone, business (captured by the lead form, not this table).
  - session_id: links this conversion back to the anonymous session that was created on site arrival.
  - Server-side geo: Country and City resolved from the IP address via Vercel headers. Never stored raw lat/lon by default.
  - Device & OS: Device type (mobile/tablet/desktop), device model (e.g. iPhone 15), OS name — all derived server-side from the User-Agent and Sec-CH-UA-Model HTTP header. No client-side JS fingerprinting.
  - Behavioral context: total_dwell_ms (how long the user spent reading before submitting) and max_scroll_pct (how far down the page they scrolled) — both calculated client-side during the session and sent at submit time as quality signals.
  - Bot detection: is_bot flag set server-side by inspecting headless browser patterns in the User-Agent.
  - Consent timestamp: records the exact moment a user granted Level 3 consent (if they did), as legal proof.
DATA RETENTION: Permanent — tied to the lead record for CRM history and compliance.
SAMPLING RATE: 100% — every lead submission is recorded without exception.
DEVELOPER NOTE: Level 1 and Level 2 data are MERGED in a single API call at submit time. The /api/track endpoint receives level=1 and upserts the existing session row (created by earlier Level 2 page views) with the conversion details and lead_id FK. Do NOT create a new session row — always upsert by session_id.',
   false, true, true,
   1.0, 0,
   true, true, true,
   true, true, false,
   true, true, true, false,
   true, false,
   true, true,
   true, true, true, true, true,
   true, true,
   true, true, true, true,
   false, false, true,
   false, true, false, false,
   false,
   true, true, true,
   true, true,
   false, false, false, false, 200,
   'Lead conversion + server-side geo/device. Always on. 100% sampling.'),

  (2, 'Contextual',
   'PURPOSE: Tracks the marketing journey — how visitors found the site and what pages they visited — without identifying who they are.
TRIGGER: Fires automatically on every page mount and route change (Next.js App Router pathname change). Also fires on site arrival to create the initial session row.
LEGAL BASIS: Anonymous analytics — no persistent identifier, no cross-site tracking, no personal data. Legally justified without a consent banner in most jurisdictions (ePrivacy Directive recital 25; GDPR Article 6(1)(f) — Legitimate Interest for anonymous traffic analysis).
WHAT IT COLLECTS:
  - session_id: A UUID generated in sessionStorage the moment the user lands. Wiped automatically when the tab closes. NOT stored in localStorage — no cross-session persistence without consent.
  - UTM parameters: utm_source, utm_medium, utm_campaign, utm_term, utm_content — captured from the URL on the first page load and stored on the session row. Tells you which ad campaign or channel drove the visit.
  - Referrer: The URL the user came from (e.g. https://instagram.com). Extracted from the HTTP Referer header server-side.
  - Landing page: The first URL the user hit on the site (captured on arrival, not updated on navigation).
  - Click IDs: gclid (Google Ads) and fbclid (Facebook Ads) — captured from URL params, stored for ad attribution.
  - Client context: locale (en/ar), timezone, screen resolution, viewport size, preferred browser languages, and network effective type (4g, wifi, etc.) — all session-scoped and sent in the request body. No persistent storage.
  - Page views counter: incremented on the session row for each route change.
DATA RETENTION: Statistical — kept for marketing analysis. Session row is anonymous and expires naturally when no longer needed.
SAMPLING RATE: 50% by default — randomly samples half of page-view events to avoid database bloat from high casual-traffic volume. Level 1 (lead submissions) always overrides sampling and records 100%.
DEVELOPER NOTE: The session_id MUST be created the instant the user lands (in TrackingProvider useEffect), NOT when they click Save. If you wait until Save, you lose the referrer and UTM data because the browser may have navigated away from the entry URL.',
   false, true, true,
   0.5, 1000,
   true, false, true,
   true, true, false,
   true, false, true, false,
   true, false,
   true, true,
   true, true, true, true, true,
   true, true,
   true, true, true, true,
   false, false, true,
   false, true, false, false,
   false,
   true, false, false,
   false, false,
   false, false, false, false, 200,
   'Marketing attribution on page load. 50% sampling. No heavy fields.'),

  (3, 'Authorized',
   'PURPOSE: Deep UX research, product optimization, and long-term visitor behaviour analysis. Enables persistent cross-session tracking and third-party analytics scripts.
TRIGGER: ONLY activates after a user explicitly clicks "Accept" on the bilingual (EN/AR) consent banner. Never runs automatically. Once accepted, stays active for that visitor across future visits (stored in localStorage) until they clear their cache or revoke consent.
LEGAL BASIS: Explicit Opt-In Consent — required by GDPR Article 6(1)(a) and ePrivacy Directive for persistent identifiers, cross-session tracking, and third-party script injection. The consent_timestamp column records the exact moment of consent as legal proof.
WHAT IT COLLECTS:
  - visitor_id: A persistent UUID stored in localStorage (cmx_vid). Unlike the session_id (which dies when the tab closes), the visitor_id allows you to recognise a returning visitor across multiple sessions. Example: a user who visited 5 times over 3 weeks before submitting a lead — you can see their full journey. NEVER created or read without consent === "granted".
  - events_jsonb: A clickstream array that records every tracked interaction in the current session — e.g. [{ name: "faq_item_expanded", properties: { question: "pricing" }, occurred_at: "..." }, { name: "plan_card_clicked", ... }]. Gives you the exact "path to conversion". The array is capped at events_jsonb_max_items (default 200) server-side to bound storage cost.
  - GA4 (Google Analytics 4): The gtag.js script is injected and activated. GA4 Consent Mode v2 is used — the script is loaded in all cases but data is only sent after consent is granted (via gtag consent update call). Controls page view, event, and conversion reporting in Google Analytics.
  - PostHog: The PostHog script is injected. Starts opted-out by default (opt_out_capturing_by_default: true). After consent, posthog.opt_in_capturing() is called, enabling session recordings, heatmaps, and event funnels.
DATA RETENTION: Persistent — visitor_id and events_jsonb survive across sessions until the user clears storage. Review your privacy policy retention schedule.
SAMPLING RATE: 10% by default — deep behavioural data is expensive to store. Only 10% of consenting users have their full clickstream recorded. Adjust upward if you need higher fidelity for UX research.
DEVELOPER NOTE: Always guard Level 3 fields with isConsentGranted() before reading or writing. If consent is false, visitor_id MUST be null and events_jsonb MUST remain empty ([]). The inject_ga4 and inject_posthog flags control whether the <Script> tags are rendered in the locale layout — set either to false to disable that provider globally without touching code.',
   false, false, true,
   0.1, 500,
   false, false, false,
   true, true, false,
   true, true, false, false,
   false, false,
   false, false,
   false, false, false, false, false,
   false, false,
   true, true, false, false,
   true, true, false,
   true, true, false, false,
   true,
   false, false, false,
   false, true,
   true, true, true, true, 200,
   'Deep UX + persistent visitor profile. Consent required. 10% sampling.');

GRANT SELECT ON TABLE public.hq_crm_marketing_tracking_config TO service_role;
GRANT UPDATE ON TABLE public.hq_crm_marketing_tracking_config TO service_role;
