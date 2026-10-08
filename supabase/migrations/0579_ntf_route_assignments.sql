-- ============================================================================
-- Migration: 0579_ntf_route_assignments.sql
-- Purpose: Tenant-safe event/channel/language route selection for verified
--          provider account, sender and immutable provider-template revision.
-- ============================================================================
BEGIN;
CREATE TABLE org_ntf_route_assign_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  event_code TEXT NOT NULL,
  channel_code TEXT NOT NULL,
  language_code TEXT NOT NULL,
  platform_account_id UUID NOT NULL,
  platform_sender_id UUID,
  provider_revision_id UUID NOT NULL,
  route_state TEXT NOT NULL DEFAULT 'DRAFT',
  assignment_version INTEGER NOT NULL DEFAULT 1,
  fallback_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_ntf_route_tenant FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_route_event FOREIGN KEY (event_code) REFERENCES sys_ntf_events_cd(code) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_route_chan FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_route_acct FOREIGN KEY (platform_account_id) REFERENCES sys_ntf_prov_acct_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_route_send FOREIGN KEY (platform_sender_id) REFERENCES sys_ntf_prov_send_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_route_rev FOREIGN KEY (provider_revision_id) REFERENCES sys_ntf_prov_tmpl_rev_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_route_scope UNIQUE (tenant_org_id, event_code, channel_code, language_code),
  CONSTRAINT ck_ntf_route_state CHECK (route_state IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED')),
  CONSTRAINT ck_ntf_route_ver CHECK (assignment_version > 0),
  CONSTRAINT ck_ntf_route_lang CHECK (btrim(language_code) <> '')
);
COMMENT ON TABLE org_ntf_route_assign_cf IS 'Tenant route selection for one event, channel and language. Activation services validate account, sender, approval and provider-binding compatibility.';
COMMENT ON COLUMN org_ntf_route_assign_cf.id IS 'Stable opaque tenant route identity.';
COMMENT ON COLUMN org_ntf_route_assign_cf.tenant_org_id IS 'Immutable tenant owner for RLS and explicit service predicates.';
COMMENT ON COLUMN org_ntf_route_assign_cf.event_code IS 'Business notification event selected by this route.';
COMMENT ON COLUMN org_ntf_route_assign_cf.channel_code IS 'Notification channel selected by this route.';
COMMENT ON COLUMN org_ntf_route_assign_cf.language_code IS 'Canonical language requested by this route.';
COMMENT ON COLUMN org_ntf_route_assign_cf.platform_account_id IS 'Verified provider account selected for future delivery.';
COMMENT ON COLUMN org_ntf_route_assign_cf.platform_sender_id IS 'Optional compatible provider sender selected for future delivery.';
COMMENT ON COLUMN org_ntf_route_assign_cf.provider_revision_id IS 'Immutable provider-template revision selected for future delivery.';
COMMENT ON COLUMN org_ntf_route_assign_cf.route_state IS 'DRAFT, ACTIVE, SUSPENDED or RETIRED lifecycle; only activation service may set ACTIVE.';
COMMENT ON COLUMN org_ntf_route_assign_cf.assignment_version IS 'Optimistic revision used to reject stale concurrent route changes.';
COMMENT ON COLUMN org_ntf_route_assign_cf.fallback_language IS 'Optional explicitly approved fallback language; silent fallback is forbidden.';
COMMENT ON COLUMN org_ntf_route_assign_cf.created_at IS 'UTC creation time.';
COMMENT ON COLUMN org_ntf_route_assign_cf.created_by IS 'Actor or trusted service that created the route.';
COMMENT ON COLUMN org_ntf_route_assign_cf.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN org_ntf_route_assign_cf.updated_at IS 'UTC time of the last permitted route change.';
COMMENT ON COLUMN org_ntf_route_assign_cf.updated_by IS 'Actor that made the last permitted route change.';
COMMENT ON COLUMN org_ntf_route_assign_cf.updated_info IS 'Non-secret update provenance.';
COMMENT ON COLUMN org_ntf_route_assign_cf.rec_status IS 'Repository record lifecycle marker.';
COMMENT ON COLUMN org_ntf_route_assign_cf.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_route_assign_cf.rec_notes IS 'Optional non-secret route note.';
COMMENT ON COLUMN org_ntf_route_assign_cf.is_active IS 'Eligibility marker retained separately from route lifecycle.';
COMMENT ON CONSTRAINT uq_ntf_route_scope ON org_ntf_route_assign_cf IS 'Prevents competing route definitions for one tenant event/channel/language scope.';
COMMENT ON CONSTRAINT ck_ntf_route_state ON org_ntf_route_assign_cf IS 'Restricts route lifecycle to explicit states.';
COMMENT ON CONSTRAINT ck_ntf_route_ver ON org_ntf_route_assign_cf IS 'Requires a positive optimistic assignment revision.';
COMMENT ON CONSTRAINT ck_ntf_route_lang ON org_ntf_route_assign_cf IS 'Prevents blank language scopes.';
CREATE INDEX ix_ntf_route_active ON org_ntf_route_assign_cf (tenant_org_id, event_code, channel_code, language_code) WHERE route_state = 'ACTIVE' AND is_active = true;
COMMENT ON INDEX ix_ntf_route_active IS 'Supports tenant-scoped active-route resolution at delivery creation.';
ALTER TABLE org_ntf_route_assign_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_route ON org_ntf_route_assign_cf FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_route ON org_ntf_route_assign_cf IS 'Tenant isolation for route administration and reads.';
COMMIT;
