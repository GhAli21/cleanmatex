-- ============================================================================
-- Migration: 0773_org_tenants_logo_dark_url.sql
-- Purpose:   Add the published URL of the Organization's dark-mode logo
--            (UI Design System PR-07 task 6, ruling 6 = A).
-- Safety:    Adds one nullable column; no data is changed. File Util writes the
--            column in the same transaction as every change to the
--            TENANT_LOGO/DARK slot, exactly as it writes logo_url for MAIN.
--            No backfill: a dark logo uploaded before this migration is
--            published the next time that slot changes (pre-launch, demo data).
-- ============================================================================

BEGIN;

-- Public URL of the current READY file in File Util slot TENANT_LOGO/DARK.
-- NULL means no dark logo: the app shows logo_url in dark mode as well.
-- Written only by File Util (syncPublishedUrl); no screen or API writes it.
ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS logo_dark_url TEXT NULL;

COMMENT ON COLUMN org_tenants_mst.logo_dark_url IS
  'Public URL of the dark-mode logo (File Util slot TENANT_LOGO/DARK). Written only by File Util in the same transaction as the slot change; NULL = use logo_url in dark mode too.';

COMMIT;
