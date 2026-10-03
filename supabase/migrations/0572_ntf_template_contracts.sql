-- ============================================================================
-- Migration: 0572_ntf_template_contracts.sql
-- Purpose: Add localized template content and typed, ordered variable contracts.
--          Provider registrations are added separately after this contract exists.
-- ============================================================================
BEGIN;

CREATE TABLE sys_ntf_tpl_locale_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  language_code TEXT NOT NULL,
  subject TEXT,
  content_format TEXT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  missing_policy TEXT NOT NULL DEFAULT 'REJECT',
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
  CONSTRAINT fk_ntf_tloc_ver FOREIGN KEY (template_version_id) REFERENCES sys_ntf_template_ver_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_tloc_chan FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_tloc_lang UNIQUE (template_version_id, channel_code, language_code),
  CONSTRAINT ck_ntf_tloc_lang CHECK (btrim(language_code) <> ''),
  CONSTRAINT ck_ntf_tloc_format CHECK (content_format IN ('PLAIN_TEXT', 'RICH_TEXT', 'STRUCTURED_COMPONENTS')),
  CONSTRAINT ck_ntf_tloc_missing CHECK (missing_policy IN ('REJECT', 'FALLBACK_LANGUAGE'))
);
COMMENT ON TABLE sys_ntf_tpl_locale_dtl IS 'Explicit language-specific content for a logical template version and channel. It replaces hidden bilingual authority in one channel row.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.id IS 'Stable opaque locale-content identity.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.template_version_id IS 'Immutable logical template version owning this localized content.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.channel_code IS 'Channel for which this localization is rendered.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.language_code IS 'Explicit canonical language tag; it is never inferred from JSON key order.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.subject IS 'Optional localized subject or title.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.content_format IS 'Validated rendering representation selected for this channel and locale.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.content IS 'Structured or text content without credentials or runtime recipient data.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.content_hash IS 'Protected canonical content fingerprint used to bind provider approval snapshots.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.missing_policy IS 'Required-variable behavior; fallback must be explicitly configured, never silently guessed.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.created_at IS 'UTC creation time.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.created_by IS 'Actor or trusted service that created the record.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.updated_at IS 'UTC time of the last permitted administrative update.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.updated_by IS 'Actor that made the last permitted update.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.updated_info IS 'Non-secret update provenance.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.rec_status IS 'Repository record lifecycle marker.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN sys_ntf_tpl_locale_dtl.is_active IS 'Eligibility for future assignment; retirement preserves historical rendering evidence.';
COMMENT ON CONSTRAINT fk_ntf_tloc_ver ON sys_ntf_tpl_locale_dtl IS 'Requires localized content to belong to an existing logical template version.';
COMMENT ON CONSTRAINT fk_ntf_tloc_chan ON sys_ntf_tpl_locale_dtl IS 'Requires localized content to declare a known notification channel.';
COMMENT ON CONSTRAINT uq_ntf_tloc_lang ON sys_ntf_tpl_locale_dtl IS 'Prevents competing content rows for one version/channel/language combination.';
COMMENT ON CONSTRAINT ck_ntf_tloc_lang ON sys_ntf_tpl_locale_dtl IS 'Prevents blank language identities.';
COMMENT ON CONSTRAINT ck_ntf_tloc_format ON sys_ntf_tpl_locale_dtl IS 'Limits content to explicitly supported rendering formats.';
COMMENT ON CONSTRAINT ck_ntf_tloc_missing ON sys_ntf_tpl_locale_dtl IS 'Restricts missing-variable behavior to explicit safe policies.';

CREATE TABLE sys_ntf_tpl_var_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL,
  variable_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_name2 TEXT,
  value_type TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  format_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  example_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_collection BOOLEAN NOT NULL DEFAULT false,
  ordinal INTEGER NOT NULL,
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
  CONSTRAINT fk_ntf_tvar_ver FOREIGN KEY (template_version_id) REFERENCES sys_ntf_template_ver_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_tvar_key UNIQUE (template_version_id, variable_key),
  CONSTRAINT uq_ntf_tvar_ord UNIQUE (template_version_id, ordinal),
  CONSTRAINT ck_ntf_tvar_key CHECK (variable_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT ck_ntf_tvar_type CHECK (value_type IN ('STRING', 'NUMBER', 'MONEY', 'DATE', 'DATETIME', 'BOOLEAN', 'COLLECTION')),
  CONSTRAINT ck_ntf_tvar_source CHECK (source_kind IN ('EVENT', 'FIXED', 'DERIVED', 'COLLECTION')),
  CONSTRAINT ck_ntf_tvar_ord CHECK (ordinal > 0),
  CONSTRAINT ck_ntf_tvar_coll CHECK ((is_collection AND value_type = 'COLLECTION' AND source_kind = 'COLLECTION') OR NOT is_collection)
);
COMMENT ON TABLE sys_ntf_tpl_var_dtl IS 'Ordered typed variable contract for one logical template version. It defines valid sources without allowing SQL or executable expressions.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.id IS 'Stable opaque variable-contract identity.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.template_version_id IS 'Logical template version owning the variable contract.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.variable_key IS 'Stable machine key referenced by content and provider bindings.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.display_name IS 'English UI label for the variable.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.display_name2 IS 'Arabic UI label for the variable.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.value_type IS 'Validated logical value type.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.source_kind IS 'EVENT, FIXED, DERIVED or COLLECTION source category.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.source_definition IS 'Validated declarative source model; executable SQL and JavaScript are forbidden.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.format_spec IS 'Validated channel-neutral formatting instructions.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.example_value IS 'Non-sensitive example used only for preview and validation.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.is_required IS 'Whether materialization must reject a missing value.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.is_collection IS 'Whether this variable represents repeated structured rows.';
COMMENT ON COLUMN sys_ntf_tpl_var_dtl.ordinal IS 'Stable explicit variable sequence; JSON object-key order is never sequence authority.';
COMMENT ON CONSTRAINT fk_ntf_tvar_ver ON sys_ntf_tpl_var_dtl IS 'Requires a variable contract to belong to an existing template version.';
COMMENT ON CONSTRAINT uq_ntf_tvar_key ON sys_ntf_tpl_var_dtl IS 'Prevents duplicate variable keys within one template version.';
COMMENT ON CONSTRAINT uq_ntf_tvar_ord ON sys_ntf_tpl_var_dtl IS 'Prevents ambiguous variable sequence within one template version.';
COMMENT ON CONSTRAINT ck_ntf_tvar_key ON sys_ntf_tpl_var_dtl IS 'Restricts variable keys to safe stable identifiers.';
COMMENT ON CONSTRAINT ck_ntf_tvar_type ON sys_ntf_tpl_var_dtl IS 'Restricts variable value types to the supported contract vocabulary.';
COMMENT ON CONSTRAINT ck_ntf_tvar_source ON sys_ntf_tpl_var_dtl IS 'Restricts source kinds to declarative supported models.';
COMMENT ON CONSTRAINT ck_ntf_tvar_ord ON sys_ntf_tpl_var_dtl IS 'Requires positive explicit variable sequence values.';
COMMENT ON CONSTRAINT ck_ntf_tvar_coll ON sys_ntf_tpl_var_dtl IS 'Requires collection variables to use the collection type and source model.';

CREATE TABLE sys_ntf_tpl_var_field_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_name2 TEXT,
  value_type TEXT NOT NULL,
  source_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  format_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordinal INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
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
  CONSTRAINT fk_ntf_tvfield_var FOREIGN KEY (variable_id) REFERENCES sys_ntf_tpl_var_dtl(id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_tvfield_key UNIQUE (variable_id, field_key),
  CONSTRAINT uq_ntf_tvfield_ord UNIQUE (variable_id, ordinal),
  CONSTRAINT ck_ntf_tvfield_key CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT ck_ntf_tvfield_type CHECK (value_type IN ('STRING', 'NUMBER', 'MONEY', 'DATE', 'DATETIME', 'BOOLEAN')),
  CONSTRAINT ck_ntf_tvfield_ord CHECK (ordinal > 0)
);
COMMENT ON TABLE sys_ntf_tpl_var_field_dtl IS 'Typed ordered fields for a collection variable, such as order item, quantity, price and total.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.id IS 'Stable opaque collection-field identity.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.variable_id IS 'Collection variable that owns this row field.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.field_key IS 'Stable field key within the collection row.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.display_name IS 'English UI label for the collection field.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.display_name2 IS 'Arabic UI label for the collection field.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.value_type IS 'Validated logical value type for this repeated-row field.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.source_definition IS 'Validated declarative field source; executable expressions are forbidden.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.format_spec IS 'Validated formatting instruction for this repeated-row field.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.ordinal IS 'Stable explicit field sequence within the collection row.';
COMMENT ON COLUMN sys_ntf_tpl_var_field_dtl.is_required IS 'Whether each materialized collection row requires this field.';
COMMENT ON CONSTRAINT fk_ntf_tvfield_var ON sys_ntf_tpl_var_field_dtl IS 'Requires each repeated-row field to belong to a defined variable contract.';
COMMENT ON CONSTRAINT uq_ntf_tvfield_key ON sys_ntf_tpl_var_field_dtl IS 'Prevents duplicate collection field keys.';
COMMENT ON CONSTRAINT uq_ntf_tvfield_ord ON sys_ntf_tpl_var_field_dtl IS 'Prevents ambiguous field sequence inside a collection variable.';
COMMENT ON CONSTRAINT ck_ntf_tvfield_key ON sys_ntf_tpl_var_field_dtl IS 'Restricts field keys to safe stable identifiers.';
COMMENT ON CONSTRAINT ck_ntf_tvfield_type ON sys_ntf_tpl_var_field_dtl IS 'Restricts collection field types to supported scalar types.';
COMMENT ON CONSTRAINT ck_ntf_tvfield_ord ON sys_ntf_tpl_var_field_dtl IS 'Requires positive explicit field sequence values.';

COMMIT;
