-- =============================================================================
-- Migration 0241: Harden Tracking Privacy Defaults (Levels 1 & 2)
-- =============================================================================
-- This migration ensures that Levels 1 and 2 tracking (which do not require 
-- explicit user consent) are strictly limited to non-personally identifiable 
-- and non-fingerprinting data points. This strengthens the legal basis for 
-- "Anonymous Analytics" and "Legitimate Interest" without a consent banner.
-- =============================================================================

UPDATE public.hq_crm_marketing_tracking_config
SET 
  -- Disable high-precision data points for Level 1 & 2 (Fingerprinting risks)
  track_geo_lat_lon = false,
  track_battery_level = false,
  track_network_downlink = false,
  track_network_rtt = false,
  track_device_pixel_ratio = false,
  track_max_touch_points = false,
  track_browser_version = false,
  
  -- Ensure metadata is accurate
  updated_at = now(),
  notes = 'Hardened privacy for Level 1 & 2 by disabling high-precision fingerprinting fields (Lat/Lon, Battery, etc.) to ensure compliance without explicit consent.'
WHERE level IN (1, 2);

-- Fix Level 3 (Authorized) to explicitly require consent
UPDATE public.hq_crm_marketing_tracking_config
SET 
  requires_consent = true,
  is_active = false,
  updated_at = now(),
  notes = 'Explicitly marked Level 3 as requiring opt-in consent per GDPR/ePrivacy standards.'
WHERE level = 3;


COMMIT;
