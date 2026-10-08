-- ============================================================================
-- Migration: 0583_ntf_route_private_account_nullable.sql
-- Purpose:   Allow the explicit PRIVATE route-owner branch introduced by 0580
--            and completed by 0582 to leave platform_account_id unset.
-- Affected:  org_ntf_route_assign_cf.platform_account_id
-- Related:   0579_ntf_route_assignments.sql,
--            0580_ntf_route_private_resources.sql,
--            0582_ntf_private_template_regs.sql
-- ============================================================================
BEGIN;

-- PRIVATE routes are required by ck_ntf_route_resource to have no platform
-- account. The 0579 NOT NULL column invariant would otherwise make every valid
-- PRIVATE route impossible to insert, despite its tenant-safe private account
-- and private revision references.
ALTER TABLE org_ntf_route_assign_cf
  ALTER COLUMN platform_account_id DROP NOT NULL;
COMMENT ON COLUMN org_ntf_route_assign_cf.platform_account_id IS 'Verified platform provider account for PLATFORM routes; NULL is required for PRIVATE routes that select tenant-owned account and revision resources.';

COMMIT;
