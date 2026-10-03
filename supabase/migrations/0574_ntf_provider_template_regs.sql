-- ============================================================================
-- Migration: 0574_ntf_provider_template_regs.sql
-- Purpose:   Add provider-specific approved template registrations, immutable
--            revisions and ordered slot bindings for structured dispatch.
-- ============================================================================
BEGIN;

CREATE TABLE sys_ntf_prov_tmpl_reg_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  CONSTRAINT fk_ntf_ptr_acct FOREIGN KEY (account_id) REFERENCES sys_ntf_prov_acct_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_ptr_sender FOREIGN KEY (sender_id) REFERENCES sys_ntf_prov_send_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_ptr_locale FOREIGN KEY (locale_id) REFERENCES sys_ntf_tpl_locale_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_ptr_key UNIQUE (account_id, registration_key),
  CONSTRAINT uq_ntf_ptr_ext UNIQUE (account_id, external_template_id),
  CONSTRAINT ck_ntf_ptr_state CHECK (observed_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'EXPIRED', 'RETIRED')),
  CONSTRAINT ck_ntf_ptr_observed CHECK (btrim(observed_status_raw) <> '')
);
COMMENT ON TABLE sys_ntf_prov_tmpl_reg_mst IS 'Mutable audited projection of a provider template registration for one platform account, locale and optional sender.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.id IS 'Stable opaque provider registration identity.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.account_id IS 'Platform provider account whose approval and Content SID apply.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.sender_id IS 'Optional compatible sender restriction; NULL means account-level compatibility is evaluated by activation.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.locale_id IS 'Logical template locale represented by this provider registration.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.registration_key IS 'Stable internal key for a provider registration.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.external_name IS 'Actual provider template name or code.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.external_template_id IS 'Provider resource ID such as a Twilio Content SID.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.provider_language_code IS 'Exact provider language spelling, kept separate from canonical locale language.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.content_type_code IS 'Concrete provider content/template type.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.category_code IS 'Optional provider category such as utility or marketing.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.observed_status IS 'Latest authenticated provider approval projection; it is distinct from internal template approval.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.observed_status_raw IS 'Original provider status token retained for diagnosis.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.observed_at IS 'UTC time the status was authenticated or imported.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.approval_fresh_until IS 'Optional UTC expiry after which activation must refresh provider evidence.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.rejection_code IS 'Optional provider rejection code.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.rejection_reason IS 'Redacted provider rejection explanation.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.observation_evidence IS 'Redacted authenticated observation evidence; it never contains credentials.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_reg_mst.current_revision_id IS 'Current immutable provider snapshot selected only after validation.';

CREATE TABLE sys_ntf_prov_tmpl_rev_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  CONSTRAINT fk_ntf_ptrv_reg FOREIGN KEY (registration_id) REFERENCES sys_ntf_prov_tmpl_reg_mst(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_ptrv_rev UNIQUE (registration_id, revision_no),
  CONSTRAINT ck_ntf_ptrv_rev CHECK (revision_no > 0),
  CONSTRAINT ck_ntf_ptrv_count CHECK (unique_var_count >= 0 AND occurrence_count >= 0 AND provider_param_count >= 0)
);
COMMENT ON TABLE sys_ntf_prov_tmpl_rev_dtl IS 'Immutable imported provider-template snapshot. Later provider observations update the registration projection but never rewrite this revision.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.id IS 'Stable opaque provider revision identity.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.registration_id IS 'Provider registration that owns this immutable snapshot.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.revision_no IS 'Monotonic provider registration revision number.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.content_sid IS 'Provider content resource identifier, including Twilio Content SID where applicable.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.provider_content_hash IS 'Canonical provider content fingerprint used to compare imported approval evidence.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.provider_snapshot IS 'Immutable redacted provider definition snapshot.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.approval_evidence IS 'Immutable redacted approval evidence tied to this account and provider content hash.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.unique_var_count IS 'Number of unique logical variable keys used by the revision.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.occurrence_count IS 'Number of placeholder occurrences across provider components.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_rev_dtl.provider_param_count IS 'Number of serialized provider parameters required by the revision.';

CREATE TABLE sys_ntf_prov_tmpl_bind_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  CONSTRAINT fk_ntf_ptb_rev FOREIGN KEY (revision_id) REFERENCES sys_ntf_prov_tmpl_rev_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_ptb_var FOREIGN KEY (variable_id) REFERENCES sys_ntf_tpl_var_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_ptb_pos UNIQUE (revision_id, component_position, parameter_position),
  CONSTRAINT ck_ntf_ptb_pos CHECK (component_position > 0 AND parameter_position > 0),
  CONSTRAINT ck_ntf_ptb_value CHECK ((variable_id IS NOT NULL AND static_value IS NULL) OR (variable_id IS NULL AND static_value IS NOT NULL))
);
COMMENT ON TABLE sys_ntf_prov_tmpl_bind_dtl IS 'Ordered provider component-slot binding to a typed logical variable or explicit static value.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.revision_id IS 'Immutable provider revision that owns this binding.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.component_key IS 'Provider component identity such as body, header or button.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.component_position IS 'Explicit provider component sequence.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.parameter_position IS 'Explicit parameter sequence within the component.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.external_slot IS 'Actual provider parameter or named slot.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.variable_id IS 'Typed logical variable used by this provider slot.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.static_value IS 'Explicit non-secret fixed value when no logical variable is bound.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.format_spec IS 'Provider-specific formatting instruction validated by the connector.';
COMMENT ON COLUMN sys_ntf_prov_tmpl_bind_dtl.is_required IS 'Whether this provider parameter must be materialized.';
COMMENT ON CONSTRAINT fk_ntf_ptb_rev ON sys_ntf_prov_tmpl_bind_dtl IS 'Requires each binding to belong to an immutable provider revision.';
COMMENT ON CONSTRAINT fk_ntf_ptb_var ON sys_ntf_prov_tmpl_bind_dtl IS 'Requires each variable binding to reference a typed logical variable.';
COMMENT ON CONSTRAINT uq_ntf_ptb_pos ON sys_ntf_prov_tmpl_bind_dtl IS 'Prevents ambiguous provider parameter ordering.';
COMMENT ON CONSTRAINT ck_ntf_ptb_pos ON sys_ntf_prov_tmpl_bind_dtl IS 'Requires positive explicit component and parameter positions.';
COMMENT ON CONSTRAINT ck_ntf_ptb_value ON sys_ntf_prov_tmpl_bind_dtl IS 'Requires exactly one variable or static-value source for every provider slot.';

COMMIT;

