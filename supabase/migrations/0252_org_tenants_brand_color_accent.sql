-- =============================================================================
-- Migration: 0252_org_tenants_brand_color_accent
-- Purpose : Add brand_color_accent column to org_tenants_mst so the Branding
--           settings page can persist the third brand color alongside the
--           existing brand_color_primary / brand_color_secondary columns
--           (added in 0006_tenant_enhancements). Without this column the
--           Branding page's accentColor field has nowhere to live.
-- Scope   : Additive only. No data backfill required; default mirrors the
--           UI default ('#F59E0B' amber) used by branding/page.tsx.
-- Safety  : Uses IF NOT EXISTS so re-running is a no-op.
-- =============================================================================

ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS brand_color_accent TEXT DEFAULT '#F59E0B';

COMMENT ON COLUMN org_tenants_mst.brand_color_accent IS
  'Accent brand color in hex format (#RRGGBB). Paired with brand_color_primary and brand_color_secondary to drive the tenant''s visual identity.';
