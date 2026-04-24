-- =============================================================================
-- Migration: 0244_org_tenants_slug.sql
-- Purpose:   Add a URL/QR-safe slug to org_tenants_mst for runtime tenant
--            discovery in the customer mobile app. Customers scan a QR code
--            or type a short code (e.g. "cleanwave") to find their laundry
--            without needing a tenant ID baked into the app build.
-- =============================================================================

ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS slug VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_tenants_mst_slug
  ON org_tenants_mst (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN org_tenants_mst.slug
  IS 'Short URL/QR-safe identifier for customer-facing tenant discovery (e.g. "cleanwave"). Used by mobile app QR scan and manual code entry. Must be lowercase, alphanumeric with hyphens only.';
