-- ============================================================================
-- Migration: 0580_ntf_route_private_resources.sql
-- Purpose: Add tenant-owned account/sender route targets alongside platform
--          resources, preserving explicit ownership and composite tenant FKs.
-- ============================================================================
BEGIN;
ALTER TABLE org_ntf_route_assign_cf
  ADD COLUMN private_account_id UUID,
  ADD COLUMN private_sender_id UUID,
  ADD COLUMN route_owner TEXT NOT NULL DEFAULT 'PLATFORM';
ALTER TABLE org_ntf_route_assign_cf
  ADD CONSTRAINT fk_ntf_route_pacct FOREIGN KEY (private_account_id, tenant_org_id) REFERENCES org_ntf_prov_acct_mst(id, tenant_org_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ntf_route_psend FOREIGN KEY (private_sender_id, tenant_org_id) REFERENCES org_ntf_prov_send_mst(id, tenant_org_id) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_ntf_route_owner CHECK (route_owner IN ('PLATFORM', 'PRIVATE')),
  ADD CONSTRAINT ck_ntf_route_resource CHECK (
    (route_owner = 'PLATFORM' AND platform_account_id IS NOT NULL AND private_account_id IS NULL AND private_sender_id IS NULL)
    OR (route_owner = 'PRIVATE' AND private_account_id IS NOT NULL AND platform_account_id IS NULL AND platform_sender_id IS NULL)
  );
COMMENT ON COLUMN org_ntf_route_assign_cf.private_account_id IS 'Tenant-owned provider account selected when route_owner is PRIVATE.';
COMMENT ON COLUMN org_ntf_route_assign_cf.private_sender_id IS 'Optional tenant-owned compatible sender selected when route_owner is PRIVATE.';
COMMENT ON COLUMN org_ntf_route_assign_cf.route_owner IS 'PLATFORM selects sys-owned resources; PRIVATE selects tenant-owned resources with composite tenant FKs.';
COMMENT ON CONSTRAINT fk_ntf_route_pacct ON org_ntf_route_assign_cf IS 'Prevents a private route from referencing a provider account owned by another tenant.';
COMMENT ON CONSTRAINT fk_ntf_route_psend ON org_ntf_route_assign_cf IS 'Prevents a private route from referencing a sender owned by another tenant.';
COMMENT ON CONSTRAINT ck_ntf_route_owner ON org_ntf_route_assign_cf IS 'Restricts route resource ownership to explicit platform or tenant-private modes.';
COMMENT ON CONSTRAINT ck_ntf_route_resource ON org_ntf_route_assign_cf IS 'Prevents mixed platform/private resource selection and requires the account matching route ownership.';
COMMIT;
