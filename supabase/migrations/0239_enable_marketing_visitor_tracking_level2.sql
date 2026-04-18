-- =============================================================================
-- Migration 0239: Enable All Anonymous Visitor Tracking (Level 2)
-- =============================================================================
-- The business requested tracking ALL visitors (100% sampling) and collecting
-- all contextual info that doesn't require explicit permissions (GDPR/ePrivacy
-- consent), including exact page views, dwell times, referrers, geo info, etc.
-- =============================================================================


UPDATE public.hq_crm_marketing_tracking_config
SET 
  -- 1. Track ALL visitors (no sampling)
  sampling_rate = 1.0,
  
  -- 2. Enable all Server-side HTTP fields (no consent required)
  track_ip_address = true,
  track_forwarded_for = true,
  track_user_agent = true,
  track_geo_country = true,
  track_geo_city = true,
  track_geo_lat_lon = true,
  track_device_type = true,
  track_device_model = true,
  track_os_name = true,
  track_os_version = true,
  track_browser_name = true,
  track_browser_version = true,
  track_referrer = true,
  track_landing_page = true,
  track_utm_source = true,
  track_utm_medium = true,
  track_utm_campaign = true,
  track_utm_term = true,
  track_utm_content = true,
  track_gclid = true,
  track_fbclid = true,
  
  -- 3. Enable all Client-sent context (session-scoped, no consent required)
  track_locale = true,
  track_timezone = true,
  track_screen_resolution = true,
  track_viewport = true,
  track_device_pixel_ratio = true,
  track_max_touch_points = true,
  track_preferred_languages = true,
  track_cookie_enabled = true,
  track_network_type = true,
  track_network_downlink = true,
  track_network_rtt = true,
  track_battery_level = true,
  
  -- 4. Enable Behavioral counters
  track_total_dwell_ms = true,
  track_max_scroll_pct = true,
  track_page_views = true,
  use_bot_detection = true,
  
  -- 5. Enable events to track exact pages visited and exit events (session scoped)
  track_events_jsonb = true,
  
  -- Update metadata
  updated_at = now(),
  is_global_enabled=true,
  notes = 'Enabled 100% sampling and all anonymous data points per business request. Includes event tracking for page flows without needing cross-session cookies.'
  
WHERE level = 2;

-- for tracing in marketing-web
create table public.crm_track_test (
  test_text text null,
  created_at timestamp with time zone not null default now(),
  id uuid not null default gen_random_uuid (),
  constraint crm_track_test_pkey primary key (id)
);

Update hq_crm_marketing_tracking_config
set is_global_enabled=true
WHERE level in(1, 2);
;
Update hq_crm_marketing_tracking_config
set is_global_enabled=false
WHERE level=3;
;
Commit;



