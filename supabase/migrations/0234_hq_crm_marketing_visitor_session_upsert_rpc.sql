-- =============================================================================
-- Migration 0234: Atomic visitor-session merge RPC for marketing-web tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hq_crm_marketing_upsert_visitor_session(
  p_payload jsonb,
  p_append_events jsonb DEFAULT '[]'::jsonb,
  p_allow_event_append boolean DEFAULT false,
  p_events_max_items integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  session_id text,
  lead_id uuid,
  page_views integer,
  total_dwell_ms bigint,
  max_scroll_pct smallint,
  tracking_level smallint,
  last_seen_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id text;
  v_events jsonb;
BEGIN
  v_session_id := NULLIF(trim(p_payload ->> 'session_id'), '');

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  -- Event capping is intentionally computed ahead of the upsert to keep the
  -- row-lock scope small. That leaves a tiny lost-event window under
  -- near-simultaneous writes, which is acceptable for marketing analytics.
  IF jsonb_typeof(COALESCE(p_append_events, '[]'::jsonb)) = 'array' THEN
    IF p_allow_event_append THEN
      WITH merged AS (
        SELECT COALESCE(existing.events_jsonb, '[]'::jsonb) || COALESCE(p_append_events, '[]'::jsonb) AS events_jsonb
        FROM public.hq_crm_marketing_visitor_sessions existing
        WHERE existing.session_id = v_session_id
      ),
      exploded AS (
        SELECT value, ordinality,
               count(*) OVER () AS total_count
        FROM merged,
             jsonb_array_elements(merged.events_jsonb) WITH ORDINALITY
      )
      SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
      INTO v_events
      FROM exploded
      WHERE ordinality > GREATEST(total_count - GREATEST(p_events_max_items, 1), 0);

      IF v_events IS NULL THEN
        SELECT COALESCE(p_append_events, '[]'::jsonb) INTO v_events;
      END IF;
    ELSE
      v_events := '[]'::jsonb;
    END IF;
  ELSE
    v_events := '[]'::jsonb;
  END IF;

  RETURN QUERY
  INSERT INTO public.hq_crm_marketing_visitor_sessions (
    session_id,
    visitor_id,
    ip_address,
    forwarded_for,
    user_agent,
    geo_country,
    geo_city,
    geo_latitude,
    geo_longitude,
    device_type,
    device_model,
    os_name,
    os_version,
    browser_name,
    browser_version,
    landing_page,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    gclid,
    fbclid,
    locale,
    timezone,
    screen_w,
    screen_h,
    viewport_w,
    viewport_h,
    device_pixel_ratio,
    max_touch_points,
    preferred_languages,
    network_effective_type,
    network_downlink,
    network_rtt,
    cookie_enabled,
    ua_platform,
    ua_platform_version,
    ua_mobile,
    battery_level,
    page_views,
    total_dwell_ms,
    max_scroll_pct,
    is_bot,
    consent_timestamp,
    consent_level,
    events_jsonb,
    lead_id,
    tracking_level,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    v_session_id,
    NULLIF(trim(p_payload ->> 'visitor_id'), ''),
    NULLIF(trim(p_payload ->> 'ip_address'), ''),
    NULLIF(trim(p_payload ->> 'forwarded_for'), ''),
    NULLIF(trim(p_payload ->> 'user_agent'), ''),
    NULLIF(trim(p_payload ->> 'geo_country'), ''),
    NULLIF(trim(p_payload ->> 'geo_city'), ''),
    NULLIF(trim(p_payload ->> 'geo_latitude'), ''),
    NULLIF(trim(p_payload ->> 'geo_longitude'), ''),
    NULLIF(trim(p_payload ->> 'device_type'), ''),
    NULLIF(trim(p_payload ->> 'device_model'), ''),
    NULLIF(trim(p_payload ->> 'os_name'), ''),
    NULLIF(trim(p_payload ->> 'os_version'), ''),
    NULLIF(trim(p_payload ->> 'browser_name'), ''),
    NULLIF(trim(p_payload ->> 'browser_version'), ''),
    NULLIF(trim(p_payload ->> 'landing_page'), ''),
    NULLIF(trim(p_payload ->> 'referrer'), ''),
    NULLIF(trim(p_payload ->> 'utm_source'), ''),
    NULLIF(trim(p_payload ->> 'utm_medium'), ''),
    NULLIF(trim(p_payload ->> 'utm_campaign'), ''),
    NULLIF(trim(p_payload ->> 'utm_term'), ''),
    NULLIF(trim(p_payload ->> 'utm_content'), ''),
    NULLIF(trim(p_payload ->> 'gclid'), ''),
    NULLIF(trim(p_payload ->> 'fbclid'), ''),
    NULLIF(trim(p_payload ->> 'locale'), ''),
    NULLIF(trim(p_payload ->> 'timezone'), ''),
    NULLIF((p_payload ->> 'screen_w')::text, '')::integer,
    NULLIF((p_payload ->> 'screen_h')::text, '')::integer,
    NULLIF((p_payload ->> 'viewport_w')::text, '')::integer,
    NULLIF((p_payload ->> 'viewport_h')::text, '')::integer,
    NULLIF((p_payload ->> 'device_pixel_ratio')::text, '')::numeric,
    NULLIF((p_payload ->> 'max_touch_points')::text, '')::smallint,
    CASE
      WHEN jsonb_typeof(p_payload -> 'preferred_languages') = 'array' THEN p_payload -> 'preferred_languages'
      ELSE NULL
    END,
    NULLIF(trim(p_payload ->> 'network_effective_type'), ''),
    NULLIF((p_payload ->> 'network_downlink')::text, '')::numeric,
    NULLIF((p_payload ->> 'network_rtt')::text, '')::integer,
    CASE WHEN p_payload ? 'cookie_enabled' THEN (p_payload ->> 'cookie_enabled')::boolean ELSE NULL END,
    NULLIF(trim(p_payload ->> 'ua_platform'), ''),
    NULLIF(trim(p_payload ->> 'ua_platform_version'), ''),
    CASE WHEN p_payload ? 'ua_mobile' THEN (p_payload ->> 'ua_mobile')::boolean ELSE NULL END,
    NULLIF((p_payload ->> 'battery_level')::text, '')::numeric,
    COALESCE(NULLIF((p_payload ->> 'page_views')::text, '')::integer, 0),
    COALESCE(NULLIF((p_payload ->> 'total_dwell_ms')::text, '')::bigint, 0),
    COALESCE(NULLIF((p_payload ->> 'max_scroll_pct')::text, '')::smallint, 0),
    CASE WHEN p_payload ? 'is_bot' THEN (p_payload ->> 'is_bot')::boolean ELSE false END,
    NULLIF((p_payload ->> 'consent_timestamp')::text, '')::timestamptz,
    NULLIF((p_payload ->> 'consent_level')::text, '')::smallint,
    CASE WHEN p_allow_event_append THEN COALESCE(v_events, '[]'::jsonb) ELSE '[]'::jsonb END,
    NULLIF((p_payload ->> 'lead_id')::text, '')::uuid,
    COALESCE(NULLIF((p_payload ->> 'tracking_level')::text, '')::smallint, 2),
    COALESCE(NULLIF((p_payload ->> 'first_seen_at')::text, '')::timestamptz, now()),
    COALESCE(NULLIF((p_payload ->> 'last_seen_at')::text, '')::timestamptz, now())
  )
  ON CONFLICT (session_id) DO UPDATE
  SET visitor_id = COALESCE(EXCLUDED.visitor_id, public.hq_crm_marketing_visitor_sessions.visitor_id),
      ip_address = COALESCE(EXCLUDED.ip_address, public.hq_crm_marketing_visitor_sessions.ip_address),
      forwarded_for = COALESCE(EXCLUDED.forwarded_for, public.hq_crm_marketing_visitor_sessions.forwarded_for),
      user_agent = COALESCE(EXCLUDED.user_agent, public.hq_crm_marketing_visitor_sessions.user_agent),
      geo_country = COALESCE(EXCLUDED.geo_country, public.hq_crm_marketing_visitor_sessions.geo_country),
      geo_city = COALESCE(EXCLUDED.geo_city, public.hq_crm_marketing_visitor_sessions.geo_city),
      geo_latitude = COALESCE(EXCLUDED.geo_latitude, public.hq_crm_marketing_visitor_sessions.geo_latitude),
      geo_longitude = COALESCE(EXCLUDED.geo_longitude, public.hq_crm_marketing_visitor_sessions.geo_longitude),
      device_type = COALESCE(EXCLUDED.device_type, public.hq_crm_marketing_visitor_sessions.device_type),
      device_model = COALESCE(EXCLUDED.device_model, public.hq_crm_marketing_visitor_sessions.device_model),
      os_name = COALESCE(EXCLUDED.os_name, public.hq_crm_marketing_visitor_sessions.os_name),
      os_version = COALESCE(EXCLUDED.os_version, public.hq_crm_marketing_visitor_sessions.os_version),
      browser_name = COALESCE(EXCLUDED.browser_name, public.hq_crm_marketing_visitor_sessions.browser_name),
      browser_version = COALESCE(EXCLUDED.browser_version, public.hq_crm_marketing_visitor_sessions.browser_version),
      landing_page = COALESCE(EXCLUDED.landing_page, public.hq_crm_marketing_visitor_sessions.landing_page),
      referrer = COALESCE(EXCLUDED.referrer, public.hq_crm_marketing_visitor_sessions.referrer),
      utm_source = COALESCE(EXCLUDED.utm_source, public.hq_crm_marketing_visitor_sessions.utm_source),
      utm_medium = COALESCE(EXCLUDED.utm_medium, public.hq_crm_marketing_visitor_sessions.utm_medium),
      utm_campaign = COALESCE(EXCLUDED.utm_campaign, public.hq_crm_marketing_visitor_sessions.utm_campaign),
      utm_term = COALESCE(EXCLUDED.utm_term, public.hq_crm_marketing_visitor_sessions.utm_term),
      utm_content = COALESCE(EXCLUDED.utm_content, public.hq_crm_marketing_visitor_sessions.utm_content),
      gclid = COALESCE(EXCLUDED.gclid, public.hq_crm_marketing_visitor_sessions.gclid),
      fbclid = COALESCE(EXCLUDED.fbclid, public.hq_crm_marketing_visitor_sessions.fbclid),
      locale = COALESCE(EXCLUDED.locale, public.hq_crm_marketing_visitor_sessions.locale),
      timezone = COALESCE(EXCLUDED.timezone, public.hq_crm_marketing_visitor_sessions.timezone),
      screen_w = COALESCE(EXCLUDED.screen_w, public.hq_crm_marketing_visitor_sessions.screen_w),
      screen_h = COALESCE(EXCLUDED.screen_h, public.hq_crm_marketing_visitor_sessions.screen_h),
      viewport_w = COALESCE(EXCLUDED.viewport_w, public.hq_crm_marketing_visitor_sessions.viewport_w),
      viewport_h = COALESCE(EXCLUDED.viewport_h, public.hq_crm_marketing_visitor_sessions.viewport_h),
      device_pixel_ratio = COALESCE(EXCLUDED.device_pixel_ratio, public.hq_crm_marketing_visitor_sessions.device_pixel_ratio),
      max_touch_points = COALESCE(EXCLUDED.max_touch_points, public.hq_crm_marketing_visitor_sessions.max_touch_points),
      preferred_languages = COALESCE(EXCLUDED.preferred_languages, public.hq_crm_marketing_visitor_sessions.preferred_languages),
      network_effective_type = COALESCE(EXCLUDED.network_effective_type, public.hq_crm_marketing_visitor_sessions.network_effective_type),
      network_downlink = COALESCE(EXCLUDED.network_downlink, public.hq_crm_marketing_visitor_sessions.network_downlink),
      network_rtt = COALESCE(EXCLUDED.network_rtt, public.hq_crm_marketing_visitor_sessions.network_rtt),
      cookie_enabled = COALESCE(EXCLUDED.cookie_enabled, public.hq_crm_marketing_visitor_sessions.cookie_enabled),
      ua_platform = COALESCE(EXCLUDED.ua_platform, public.hq_crm_marketing_visitor_sessions.ua_platform),
      ua_platform_version = COALESCE(EXCLUDED.ua_platform_version, public.hq_crm_marketing_visitor_sessions.ua_platform_version),
      ua_mobile = COALESCE(EXCLUDED.ua_mobile, public.hq_crm_marketing_visitor_sessions.ua_mobile),
      battery_level = COALESCE(EXCLUDED.battery_level, public.hq_crm_marketing_visitor_sessions.battery_level),
      page_views = public.hq_crm_marketing_visitor_sessions.page_views + COALESCE(EXCLUDED.page_views, 0),
      total_dwell_ms = public.hq_crm_marketing_visitor_sessions.total_dwell_ms + COALESCE(EXCLUDED.total_dwell_ms, 0),
      max_scroll_pct = GREATEST(public.hq_crm_marketing_visitor_sessions.max_scroll_pct, COALESCE(EXCLUDED.max_scroll_pct, 0)),
      is_bot = public.hq_crm_marketing_visitor_sessions.is_bot OR COALESCE(EXCLUDED.is_bot, false),
      consent_timestamp = COALESCE(EXCLUDED.consent_timestamp, public.hq_crm_marketing_visitor_sessions.consent_timestamp),
      consent_level = GREATEST(COALESCE(public.hq_crm_marketing_visitor_sessions.consent_level, 0), COALESCE(EXCLUDED.consent_level, 0)),
      events_jsonb = CASE
        WHEN p_allow_event_append THEN COALESCE(v_events, public.hq_crm_marketing_visitor_sessions.events_jsonb)
        ELSE public.hq_crm_marketing_visitor_sessions.events_jsonb
      END,
      lead_id = COALESCE(EXCLUDED.lead_id, public.hq_crm_marketing_visitor_sessions.lead_id),
      tracking_level = GREATEST(public.hq_crm_marketing_visitor_sessions.tracking_level, COALESCE(EXCLUDED.tracking_level, 0)),
      first_seen_at = LEAST(public.hq_crm_marketing_visitor_sessions.first_seen_at, COALESCE(EXCLUDED.first_seen_at, public.hq_crm_marketing_visitor_sessions.first_seen_at)),
      last_seen_at = GREATEST(public.hq_crm_marketing_visitor_sessions.last_seen_at, COALESCE(EXCLUDED.last_seen_at, public.hq_crm_marketing_visitor_sessions.last_seen_at)),
      updated_at = now()
  RETURNING
    public.hq_crm_marketing_visitor_sessions.id,
    public.hq_crm_marketing_visitor_sessions.session_id,
    public.hq_crm_marketing_visitor_sessions.lead_id,
    public.hq_crm_marketing_visitor_sessions.page_views,
    public.hq_crm_marketing_visitor_sessions.total_dwell_ms,
    public.hq_crm_marketing_visitor_sessions.max_scroll_pct,
    public.hq_crm_marketing_visitor_sessions.tracking_level,
    public.hq_crm_marketing_visitor_sessions.last_seen_at;
END;
$$;

COMMENT ON FUNCTION public.hq_crm_marketing_upsert_visitor_session(jsonb, jsonb, boolean, integer)
  IS 'Atomic marketing visitor-session merge RPC used by marketing-web. Merges by session_id with additive counters, GREATEST scroll/levels, non-null field preference, optional event append/capping, and lead linkage preservation.';

GRANT EXECUTE ON FUNCTION public.hq_crm_marketing_upsert_visitor_session(jsonb, jsonb, boolean, integer) TO service_role;
