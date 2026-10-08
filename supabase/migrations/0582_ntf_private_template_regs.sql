-- ============================================================================
-- Migration: 0582_ntf_private_template_regs.sql
-- Purpose:   Add tenant-owned provider-template registrations, immutable
--            revisions and ordered bindings so private routes can prove that an
--            approved external template belongs to their own verified account.
-- Affected:  org_ntf_ptreg_mst, org_ntf_ptrev_dtl, org_ntf_ptbind_dtl,
--            org_ntf_route_assign_cf
-- Related:   0571_ntf_provider_account_sender_foundation.sql,
--            0572_ntf_template_contracts.sql,
--            0574_ntf_provider_template_regs.sql,
--            0579_ntf_route_assignments.sql,
--            0580_ntf_route_private_resources.sql
-- ============================================================================
BEGIN;

-- Tenant-owned registration projection. External credentials are intentionally
-- absent: provider access remains an opaque vault reference on the account.
CREATE TABLE org_ntf_ptreg_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  account_id UUID NOT NULL,
  sender_id UUID,
  locale_id UUID NOT NULL,
  registration_key TEXT NOT NULL,
  external_name TEXT NOT NULL,
  external_template_id TEXT,
  provider_language_code TEXT NOT NULL,
  content_type_code TEXT NOT NULL,
  category_code TEXT,
  observed_status TEXT NOT NULL DEFAULT 'PENDING',
  observed_status_raw TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_fresh_until TIMESTAMPTZ,
  rejection_code TEXT,
  rejection_reason TEXT,
  observation_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_revision_id UUID,
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
  CONSTRAINT fk_ntf_optr_acct FOREIGN KEY (account_id, tenant_org_id) REFERENCES org_ntf_prov_acct_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_optr_send FOREIGN KEY (sender_id, tenant_org_id) REFERENCES org_ntf_prov_send_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_optr_loc FOREIGN KEY (locale_id) REFERENCES sys_ntf_tpl_locale_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_optr_tid UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_ntf_optr_key UNIQUE (tenant_org_id, account_id, registration_key),
  CONSTRAINT uq_ntf_optr_ext UNIQUE (tenant_org_id, account_id, external_template_id),
  CONSTRAINT ck_ntf_optr_state CHECK (observed_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'EXPIRED', 'RETIRED')),
  CONSTRAINT ck_ntf_optr_raw CHECK (btrim(observed_status_raw) <> '')
);
COMMENT ON TABLE org_ntf_ptreg_mst IS 'Tenant-owned audited provider-template registration projection. It binds approval evidence to exactly one tenant provider account and optional sender.';
COMMENT ON COLUMN org_ntf_ptreg_mst.id IS 'Stable opaque registration identity.';
COMMENT ON COLUMN org_ntf_ptreg_mst.tenant_org_id IS 'Immutable tenant owner used by RLS and every composite provider-resource foreign key.';
COMMENT ON COLUMN org_ntf_ptreg_mst.account_id IS 'Tenant-owned provider account whose approved external template may be selected by a private route.';
COMMENT ON COLUMN org_ntf_ptreg_mst.sender_id IS 'Optional tenant-owned sender restriction; NULL permits account-level sender compatibility evaluation.';
COMMENT ON COLUMN org_ntf_ptreg_mst.locale_id IS 'Canonical logical-template locale represented by this provider registration.';
COMMENT ON COLUMN org_ntf_ptreg_mst.registration_key IS 'Stable tenant administrative key for this provider registration.';
COMMENT ON COLUMN org_ntf_ptreg_mst.external_name IS 'Actual provider template name or code.';
COMMENT ON COLUMN org_ntf_ptreg_mst.external_template_id IS 'Provider resource identity such as a Twilio Content SID; NULL only when the provider has no separate identifier.';
COMMENT ON COLUMN org_ntf_ptreg_mst.provider_language_code IS 'Exact provider language spelling retained separately from canonical locale language.';
COMMENT ON COLUMN org_ntf_ptreg_mst.content_type_code IS 'Concrete provider content or template type.';
COMMENT ON COLUMN org_ntf_ptreg_mst.category_code IS 'Optional provider category such as utility or marketing.';
COMMENT ON COLUMN org_ntf_ptreg_mst.observed_status IS 'Latest authenticated provider approval projection, distinct from internal logical-template approval.';
COMMENT ON COLUMN org_ntf_ptreg_mst.observed_status_raw IS 'Original provider status token retained for diagnosis.';
COMMENT ON COLUMN org_ntf_ptreg_mst.observed_at IS 'UTC timestamp of the authenticated provider observation or import.';
COMMENT ON COLUMN org_ntf_ptreg_mst.approval_fresh_until IS 'Optional UTC expiry after which future activation requires refreshed provider evidence.';
COMMENT ON COLUMN org_ntf_ptreg_mst.rejection_code IS 'Optional provider rejection code.';
COMMENT ON COLUMN org_ntf_ptreg_mst.rejection_reason IS 'Redacted provider rejection explanation that excludes credentials and message recipients.';
COMMENT ON COLUMN org_ntf_ptreg_mst.observation_evidence IS 'Redacted authenticated provider observation evidence; secrets are prohibited.';
COMMENT ON COLUMN org_ntf_ptreg_mst.current_revision_id IS 'Current immutable tenant revision after it passes account-bound approval validation.';
COMMENT ON COLUMN org_ntf_ptreg_mst.created_at IS 'UTC creation timestamp.';
COMMENT ON COLUMN org_ntf_ptreg_mst.created_by IS 'Actor or trusted service that created this registration.';
COMMENT ON COLUMN org_ntf_ptreg_mst.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN org_ntf_ptreg_mst.updated_at IS 'UTC timestamp of the last permitted administrative update.';
COMMENT ON COLUMN org_ntf_ptreg_mst.updated_by IS 'Actor that made the last permitted administrative update.';
COMMENT ON COLUMN org_ntf_ptreg_mst.updated_info IS 'Non-secret update provenance.';
COMMENT ON COLUMN org_ntf_ptreg_mst.rec_status IS 'Repository lifecycle marker; 1=active record, 0=soft-deleted record.';
COMMENT ON COLUMN org_ntf_ptreg_mst.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_ptreg_mst.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN org_ntf_ptreg_mst.is_active IS 'Eligibility for future selection; retirement preserves delivery and approval audit history.';
COMMENT ON CONSTRAINT fk_ntf_optr_acct ON org_ntf_ptreg_mst IS 'Uses parent key order (id, tenant_org_id) so a registration cannot reference another tenant account and Prisma can model the composite FK.';
COMMENT ON CONSTRAINT fk_ntf_optr_send ON org_ntf_ptreg_mst IS 'Uses parent key order (id, tenant_org_id) so an optional sender remains tenant-owned.';
COMMENT ON CONSTRAINT fk_ntf_optr_loc ON org_ntf_ptreg_mst IS 'Requires each provider registration to target a defined canonical template locale.';
COMMENT ON CONSTRAINT uq_ntf_optr_tid ON org_ntf_ptreg_mst IS 'Supports Prisma-safe child foreign keys with tenant second, matching account and sender parent key order.';
COMMENT ON CONSTRAINT uq_ntf_optr_key ON org_ntf_ptreg_mst IS 'Prevents competing tenant registrations for one account-local administrative key.';
COMMENT ON CONSTRAINT uq_ntf_optr_ext ON org_ntf_ptreg_mst IS 'Prevents duplicate external provider template identities within one tenant account; PostgreSQL permits multiple NULL identifiers.';
COMMENT ON CONSTRAINT ck_ntf_optr_state ON org_ntf_ptreg_mst IS 'Limits observed provider approval state to explicit import lifecycle values.';
COMMENT ON CONSTRAINT ck_ntf_optr_raw ON org_ntf_ptreg_mst IS 'Retains a nonblank raw provider status for operational diagnosis.';

-- Immutable evidence snapshot. A provider re-import creates a new revision;
-- it never overwrites content that may have been used for a delivery.
CREATE TABLE org_ntf_ptrev_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  registration_id UUID NOT NULL,
  revision_no INTEGER NOT NULL,
  provider_status_at_import TEXT NOT NULL,
  provider_status_raw TEXT NOT NULL,
  external_revision_id TEXT,
  content_sid TEXT,
  provider_content_hash TEXT NOT NULL,
  provider_snapshot JSONB NOT NULL,
  approval_evidence JSONB NOT NULL,
  rejection_evidence JSONB,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  valid_until_at_import TIMESTAMPTZ,
  unique_var_count INTEGER NOT NULL,
  occurrence_count INTEGER NOT NULL,
  provider_param_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_ntf_optrv_reg FOREIGN KEY (registration_id, tenant_org_id) REFERENCES org_ntf_ptreg_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_optrv_tid UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_ntf_optrv_rev UNIQUE (tenant_org_id, registration_id, revision_no),
  CONSTRAINT ck_ntf_optrv_no CHECK (revision_no > 0),
  CONSTRAINT ck_ntf_optrv_cnt CHECK (unique_var_count >= 0 AND occurrence_count >= 0 AND provider_param_count >= 0)
);
COMMENT ON TABLE org_ntf_ptrev_dtl IS 'Immutable tenant-owned imported provider-template snapshot. Later observations create a new revision instead of rewriting delivery evidence.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.id IS 'Stable opaque tenant provider-revision identity.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.tenant_org_id IS 'Immutable tenant owner used by RLS and composite foreign keys.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.registration_id IS 'Tenant registration that owns this immutable provider-definition snapshot.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.revision_no IS 'Monotonic revision number within one tenant registration.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.provider_status_at_import IS 'Normalized provider approval state observed when this immutable revision was imported.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.provider_status_raw IS 'Original provider status token recorded with the snapshot.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.external_revision_id IS 'Optional provider revision identifier.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.content_sid IS 'Provider content resource identifier, including Twilio Content SID where applicable.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.provider_content_hash IS 'Canonical imported-provider-content fingerprint used to compare approval evidence.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.provider_snapshot IS 'Immutable redacted provider definition snapshot; credentials and recipients are forbidden.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.approval_evidence IS 'Immutable redacted account-bound approval evidence for this revision.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.rejection_evidence IS 'Optional immutable redacted rejection evidence.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.submitted_at IS 'Optional UTC timestamp reported by the provider for submission.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.verified_at IS 'UTC timestamp when a trusted connector verified imported content and approval evidence.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.valid_until_at_import IS 'Optional provider validity boundary observed during import.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.unique_var_count IS 'Number of distinct logical variable keys consumed by the imported provider content.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.occurrence_count IS 'Number of placeholder occurrences across imported provider components.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.provider_param_count IS 'Number of serialized provider parameters required by the imported provider content.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.created_at IS 'UTC creation timestamp.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.created_by IS 'Actor or trusted service that created this immutable snapshot.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.created_info IS 'Non-secret import provenance.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.rec_status IS 'Repository lifecycle marker; 1=active record, 0=soft-deleted record.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN org_ntf_ptrev_dtl.is_active IS 'Eligibility for future route selection; retired evidence remains auditable.';
COMMENT ON CONSTRAINT fk_ntf_optrv_reg ON org_ntf_ptrev_dtl IS 'Uses parent key order (id, tenant_org_id) so a revision cannot cross tenant registration boundaries.';
COMMENT ON CONSTRAINT uq_ntf_optrv_tid ON org_ntf_ptrev_dtl IS 'Supports Prisma-safe route and binding foreign keys with tenant second.';
COMMENT ON CONSTRAINT uq_ntf_optrv_rev ON org_ntf_ptrev_dtl IS 'Prevents duplicate immutable revision numbers within one tenant registration.';
COMMENT ON CONSTRAINT ck_ntf_optrv_no ON org_ntf_ptrev_dtl IS 'Requires positive monotonic revision numbering.';
COMMENT ON CONSTRAINT ck_ntf_optrv_cnt ON org_ntf_ptrev_dtl IS 'Rejects negative distinct-variable, occurrence, or provider-parameter counts.';

-- Explicit provider parameter order. One slot is sourced by one typed logical
-- variable or a deliberate static value, never by arbitrary executable data.
CREATE TABLE org_ntf_ptbind_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  revision_id UUID NOT NULL,
  component_key TEXT NOT NULL,
  component_position INTEGER NOT NULL,
  parameter_position INTEGER NOT NULL,
  external_slot TEXT NOT NULL,
  variable_id UUID,
  static_value TEXT,
  format_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_ntf_optb_rev FOREIGN KEY (revision_id, tenant_org_id) REFERENCES org_ntf_ptrev_dtl(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_optb_var FOREIGN KEY (variable_id) REFERENCES sys_ntf_tpl_var_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_optb_pos UNIQUE (tenant_org_id, revision_id, component_position, parameter_position),
  CONSTRAINT ck_ntf_optb_pos CHECK (component_position > 0 AND parameter_position > 0),
  CONSTRAINT ck_ntf_optb_val CHECK ((variable_id IS NOT NULL AND static_value IS NULL) OR (variable_id IS NULL AND static_value IS NOT NULL))
);
COMMENT ON TABLE org_ntf_ptbind_dtl IS 'Tenant-owned ordered provider component-slot binding to a typed logical variable or explicit static value.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.id IS 'Stable opaque tenant provider-binding identity.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.tenant_org_id IS 'Immutable tenant owner used by RLS and the composite revision foreign key.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.revision_id IS 'Tenant provider revision that owns this ordered external parameter binding.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.component_key IS 'Provider component identity such as body, header, button, or card.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.component_position IS 'Positive explicit provider component sequence.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.parameter_position IS 'Positive explicit parameter sequence within the provider component.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.external_slot IS 'Actual provider parameter name or positional slot.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.variable_id IS 'Typed logical variable used by this provider slot; NULL only when a static value is deliberately used.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.static_value IS 'Explicit non-secret fixed value when no logical variable is bound.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.format_spec IS 'Provider-specific rendering instruction validated by the connector; executable expressions are prohibited.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.is_required IS 'Whether this provider parameter must be materialized before provider submission.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.created_at IS 'UTC creation timestamp.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.created_by IS 'Actor or trusted service that created this binding.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.rec_status IS 'Repository lifecycle marker; 1=active record, 0=soft-deleted record.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN org_ntf_ptbind_dtl.is_active IS 'Eligibility for future selection; historical bindings remain traceable.';
COMMENT ON CONSTRAINT fk_ntf_optb_rev ON org_ntf_ptbind_dtl IS 'Uses parent key order (id, tenant_org_id) so a binding cannot point at a revision from another tenant.';
COMMENT ON CONSTRAINT fk_ntf_optb_var ON org_ntf_ptbind_dtl IS 'Requires a variable binding to use the shared typed logical-variable catalog.';
COMMENT ON CONSTRAINT uq_ntf_optb_pos ON org_ntf_ptbind_dtl IS 'Prevents ambiguous provider parameter ordering within one tenant revision.';
COMMENT ON CONSTRAINT ck_ntf_optb_pos ON org_ntf_ptbind_dtl IS 'Requires positive provider component and parameter sequence values.';
COMMENT ON CONSTRAINT ck_ntf_optb_val ON org_ntf_ptbind_dtl IS 'Requires exactly one safe source: a typed logical variable or a static value.';

-- The current revision FK is added after the revision table exists. The service
-- also verifies the revision registration identity before route activation.
ALTER TABLE org_ntf_ptreg_mst
  ADD CONSTRAINT fk_ntf_optr_cur FOREIGN KEY (current_revision_id, tenant_org_id) REFERENCES org_ntf_ptrev_dtl(id, tenant_org_id) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_ntf_optr_cur ON org_ntf_ptreg_mst IS 'Uses revision key order (id, tenant_org_id) so a current revision cannot cross tenant boundaries.';

-- All tenant-owned provider-template records receive standard tenant RLS.
ALTER TABLE org_ntf_ptreg_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_optr ON org_ntf_ptreg_mst FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_optr ON org_ntf_ptreg_mst IS 'Tenant isolation for private provider-template registration administration.';
ALTER TABLE org_ntf_ptrev_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_optrv ON org_ntf_ptrev_dtl FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_optrv ON org_ntf_ptrev_dtl IS 'Tenant isolation for private immutable provider-template revision evidence.';
ALTER TABLE org_ntf_ptbind_dtl ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_optb ON org_ntf_ptbind_dtl FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_optb ON org_ntf_ptbind_dtl IS 'Tenant isolation for private provider-template binding administration.';

-- Supports tenant-scoped import, lookup, and ordered binding resolution without
-- widening visibility beyond the mandatory tenant predicate.
CREATE INDEX ix_ntf_optr_state ON org_ntf_ptreg_mst (tenant_org_id, account_id, observed_status, is_active);
COMMENT ON INDEX ix_ntf_optr_state IS 'Supports tenant account-scoped approval lookup before private route activation.';
CREATE INDEX ix_ntf_optrv_reg ON org_ntf_ptrev_dtl (tenant_org_id, registration_id, revision_no DESC);
COMMENT ON INDEX ix_ntf_optrv_reg IS 'Supports tenant registration-scoped immutable revision lookup and current-revision validation.';
CREATE INDEX ix_ntf_optb_rev ON org_ntf_ptbind_dtl (tenant_org_id, revision_id, component_position, parameter_position);
COMMENT ON INDEX ix_ntf_optb_rev IS 'Supports tenant-scoped ordered provider-parameter materialization at dispatch time.';

-- A private route uses a tenant-owned revision; a platform route keeps the
-- existing sys-owned revision. The replacement check prevents mixed ownership.
ALTER TABLE org_ntf_route_assign_cf
  ALTER COLUMN provider_revision_id DROP NOT NULL,
  ADD COLUMN private_revision_id UUID,
  ADD CONSTRAINT fk_ntf_route_prev FOREIGN KEY (private_revision_id, tenant_org_id) REFERENCES org_ntf_ptrev_dtl(id, tenant_org_id) ON DELETE RESTRICT;
COMMENT ON COLUMN org_ntf_route_assign_cf.provider_revision_id IS 'Immutable platform provider-template revision for PLATFORM routes; NULL for PRIVATE routes.';
COMMENT ON COLUMN org_ntf_route_assign_cf.private_revision_id IS 'Immutable tenant-owned provider-template revision for PRIVATE routes; NULL for PLATFORM routes.';
COMMENT ON CONSTRAINT fk_ntf_route_prev ON org_ntf_route_assign_cf IS 'Uses private revision key order (id, tenant_org_id) to prevent cross-tenant route selection.';

-- Replace the preliminary ownership check from 0580 with the complete account,
-- sender and revision invariant. DROP is constraint-only and has no cascade.
ALTER TABLE org_ntf_route_assign_cf DROP CONSTRAINT ck_ntf_route_resource;
ALTER TABLE org_ntf_route_assign_cf
  ADD CONSTRAINT ck_ntf_route_resource CHECK (
    (route_owner = 'PLATFORM'
      AND platform_account_id IS NOT NULL
      AND provider_revision_id IS NOT NULL
      AND private_account_id IS NULL
      AND private_sender_id IS NULL
      AND private_revision_id IS NULL)
    OR
    (route_owner = 'PRIVATE'
      AND private_account_id IS NOT NULL
      AND private_revision_id IS NOT NULL
      AND platform_account_id IS NULL
      AND platform_sender_id IS NULL
      AND provider_revision_id IS NULL)
  );
COMMENT ON CONSTRAINT ck_ntf_route_resource ON org_ntf_route_assign_cf IS 'Requires each route to select one complete platform or tenant-private account and immutable revision chain without mixed ownership.';

COMMIT;
