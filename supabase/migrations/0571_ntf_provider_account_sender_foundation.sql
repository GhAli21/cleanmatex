-- ============================================================================
-- Migration: 0571_ntf_provider_account_sender_foundation.sql
-- Purpose:   Establish typed provider-account and sender identities for the
--            notification hub. This replaces embedded sender/account JSON only
--            after later assignment APIs are deployed; no existing path changes.
-- ============================================================================
BEGIN;

CREATE TABLE sys_ntf_prov_acct_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code TEXT NOT NULL,
  channel_code TEXT NOT NULL,
  account_key TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  environment_code TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  credential_version TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL,
  name2 TEXT,
  description TEXT,
  description2 TEXT,
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
  CONSTRAINT fk_ntf_pacct_provider FOREIGN KEY (provider_code) REFERENCES sys_ntf_providers_cd(code) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_pacct_channel FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_pacct_key UNIQUE (provider_code, channel_code, environment_code, account_key),
  CONSTRAINT uq_ntf_pacct_ext UNIQUE (provider_code, channel_code, environment_code, external_account_id),
  CONSTRAINT ck_ntf_pacct_env CHECK (environment_code IN ('TEST', 'PRODUCTION')),
  CONSTRAINT ck_ntf_pacct_state CHECK (verification_state IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT ck_ntf_pacct_verified CHECK ((verification_state <> 'VERIFIED') OR verified_at IS NOT NULL)
);
COMMENT ON TABLE sys_ntf_prov_acct_mst IS 'Platform-owned provider account identity. Credential references are opaque vault handles, never secret values.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.id IS 'Stable opaque identity for a shared provider account.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.provider_code IS 'Catalog provider that owns the account.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.channel_code IS 'Notification channel available through the account.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.account_key IS 'Stable administrative account key.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.external_account_id IS 'Provider account identifier scoped by provider, channel and environment.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.environment_code IS 'TEST and PRODUCTION boundary; credentials and approvals are never interchangeable.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.credential_ref IS 'Opaque approved vault reference; secret material is forbidden.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.credential_version IS 'Expected vault credential revision for auditable rotation.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.verification_state IS 'Account verification lifecycle; only VERIFIED resources may later be assigned.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.verified_at IS 'UTC time the verification evidence was accepted.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.config IS 'Non-secret connector configuration only.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.name IS 'English administrative account name.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.name2 IS 'Arabic administrative account name.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.description IS 'English non-secret account description.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.description2 IS 'Arabic non-secret account description.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.created_at IS 'UTC creation time.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.created_by IS 'Actor or trusted service that created the record.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.updated_at IS 'UTC time of the last permitted administrative update.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.updated_by IS 'Actor that made the last permitted update.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.updated_info IS 'Non-secret update provenance.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.rec_status IS 'Repository record lifecycle marker.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN sys_ntf_prov_acct_mst.is_active IS 'Eligibility for future assignment; retirement preserves audit history.';

CREATE TABLE org_ntf_prov_acct_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  channel_code TEXT NOT NULL,
  account_key TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  environment_code TEXT NOT NULL,
  credential_ref TEXT,
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL,
  name2 TEXT,
  description TEXT,
  description2 TEXT,
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
  CONSTRAINT fk_ntf_oacct_tenant FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_oacct_provider FOREIGN KEY (provider_code) REFERENCES sys_ntf_providers_cd(code) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_oacct_channel FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_oacct_tnt UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_ntf_oacct_key UNIQUE (tenant_org_id, provider_code, channel_code, environment_code, account_key),
  CONSTRAINT uq_ntf_oacct_ext UNIQUE (tenant_org_id, provider_code, channel_code, environment_code, external_account_id),
  CONSTRAINT ck_ntf_oacct_env CHECK (environment_code IN ('TEST', 'PRODUCTION')),
  CONSTRAINT ck_ntf_oacct_state CHECK (verification_state IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT ck_ntf_oacct_verified CHECK ((verification_state <> 'VERIFIED') OR verified_at IS NOT NULL)
);
COMMENT ON TABLE org_ntf_prov_acct_mst IS 'Tenant-owned provider account metadata. Credential references are opaque; existing encrypted configuration remains the secret boundary until cutover.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.id IS 'Stable opaque identity for a tenant provider account.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.tenant_org_id IS 'Immutable tenant owner for RLS and composite foreign keys.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.provider_code IS 'Catalog provider that owns the tenant account.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.channel_code IS 'Notification channel available through the account.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.account_key IS 'Stable tenant-managed account key.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.external_account_id IS 'Provider account identifier scoped to tenant/provider/channel/environment.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.environment_code IS 'TEST and PRODUCTION boundary for tenant provider resources.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.credential_ref IS 'Optional opaque credential-location reference; secret material is forbidden.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.verification_state IS 'Account verification lifecycle required before future assignment.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.verified_at IS 'UTC time verification evidence was accepted.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.config IS 'Non-secret tenant connector configuration only.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.name IS 'English administrative account name.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.name2 IS 'Arabic administrative account name.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.description IS 'English non-secret account description.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.description2 IS 'Arabic non-secret account description.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.created_at IS 'UTC creation time.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.created_by IS 'Actor or trusted service that created the record.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.created_info IS 'Non-secret creation provenance.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.updated_at IS 'UTC time of the last permitted administrative update.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.updated_by IS 'Actor that made the last permitted update.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.updated_info IS 'Non-secret update provenance.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.rec_status IS 'Repository record lifecycle marker.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN org_ntf_prov_acct_mst.is_active IS 'Eligibility for future assignment; retirement preserves audit history.';
CREATE INDEX ix_ntf_oacct_active ON org_ntf_prov_acct_mst (tenant_org_id, channel_code, is_active);
COMMENT ON INDEX ix_ntf_oacct_active IS 'Supports tenant-scoped active account selection by channel.';
ALTER TABLE org_ntf_prov_acct_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_oacct ON org_ntf_prov_acct_mst FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_oacct ON org_ntf_prov_acct_mst IS 'Tenant isolation for provider-account administration.';

CREATE TABLE sys_ntf_prov_send_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  sender_key TEXT NOT NULL,
  external_sender_id TEXT NOT NULL,
  sender_address TEXT,
  sender_kind TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL,
  name2 TEXT,
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
  CONSTRAINT fk_ntf_psend_acct FOREIGN KEY (account_id) REFERENCES sys_ntf_prov_acct_mst(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_psend_chan FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_psend_key UNIQUE (account_id, sender_key),
  CONSTRAINT uq_ntf_psend_ext UNIQUE (account_id, external_sender_id),
  CONSTRAINT ck_ntf_psend_state CHECK (verification_state IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT ck_ntf_psend_verified CHECK ((verification_state <> 'VERIFIED') OR verified_at IS NOT NULL)
);
COMMENT ON TABLE sys_ntf_prov_send_mst IS 'Platform-owned provider sender identity, kept distinct from an account because accounts may own multiple senders.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.id IS 'Stable opaque sender identity.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.account_id IS 'Platform provider account that owns this sender.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.channel_code IS 'Channel for which this sender is compatible.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.sender_key IS 'Stable administrative key within the provider account.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.external_sender_id IS 'Provider sender identity, such as a phone-number or messaging sender identifier.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.sender_address IS 'Human-readable sender address or number when exposed by the channel.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.sender_kind IS 'Provider-specific sender category used for compatibility validation.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.verification_state IS 'Sender verification lifecycle required before future assignment.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.verified_at IS 'UTC time sender verification evidence was accepted.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.capabilities IS 'Non-secret sender capabilities used for later activation validation.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.name IS 'English administrative sender name.';
COMMENT ON COLUMN sys_ntf_prov_send_mst.name2 IS 'Arabic administrative sender name.';

CREATE TABLE org_ntf_prov_send_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  account_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  sender_key TEXT NOT NULL,
  external_sender_id TEXT NOT NULL,
  sender_address TEXT,
  sender_kind TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL,
  name2 TEXT,
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
  CONSTRAINT fk_ntf_osend_chan FOREIGN KEY (channel_code) REFERENCES sys_ntf_channel_cd(code) ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_osend_acct FOREIGN KEY (account_id, tenant_org_id) REFERENCES org_ntf_prov_acct_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_osend_tnt UNIQUE (id, tenant_org_id),
  CONSTRAINT uq_ntf_osend_key UNIQUE (tenant_org_id, account_id, sender_key),
  CONSTRAINT uq_ntf_osend_ext UNIQUE (tenant_org_id, account_id, external_sender_id),
  CONSTRAINT ck_ntf_osend_state CHECK (verification_state IN ('PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT ck_ntf_osend_verified CHECK ((verification_state <> 'VERIFIED') OR verified_at IS NOT NULL)
);
COMMENT ON TABLE org_ntf_prov_send_mst IS 'Tenant-owned sender identity with a tenant-safe composite provider-account reference.';
COMMENT ON COLUMN org_ntf_prov_send_mst.id IS 'Stable opaque tenant sender identity.';
COMMENT ON COLUMN org_ntf_prov_send_mst.tenant_org_id IS 'Immutable tenant owner for RLS and composite foreign keys.';
COMMENT ON COLUMN org_ntf_prov_send_mst.account_id IS 'Tenant provider account that owns this sender.';
COMMENT ON COLUMN org_ntf_prov_send_mst.channel_code IS 'Channel for which this sender is compatible.';
COMMENT ON COLUMN org_ntf_prov_send_mst.sender_key IS 'Stable administrative key within the tenant account.';
COMMENT ON COLUMN org_ntf_prov_send_mst.external_sender_id IS 'Provider sender identity scoped to the tenant account.';
COMMENT ON COLUMN org_ntf_prov_send_mst.sender_address IS 'Human-readable sender address or number when exposed by the channel.';
COMMENT ON COLUMN org_ntf_prov_send_mst.sender_kind IS 'Provider-specific sender category used for compatibility validation.';
COMMENT ON COLUMN org_ntf_prov_send_mst.verification_state IS 'Sender verification lifecycle required before future assignment.';
COMMENT ON COLUMN org_ntf_prov_send_mst.verified_at IS 'UTC time sender verification evidence was accepted.';
COMMENT ON COLUMN org_ntf_prov_send_mst.capabilities IS 'Non-secret sender capabilities used for later activation validation.';
COMMENT ON COLUMN org_ntf_prov_send_mst.name IS 'English administrative sender name.';
COMMENT ON COLUMN org_ntf_prov_send_mst.name2 IS 'Arabic administrative sender name.';
CREATE INDEX ix_ntf_osend_active ON org_ntf_prov_send_mst (tenant_org_id, channel_code, is_active);
COMMENT ON INDEX ix_ntf_osend_active IS 'Supports tenant-scoped active sender selection by channel.';
ALTER TABLE org_ntf_prov_send_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_osend ON org_ntf_prov_send_mst FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_osend ON org_ntf_prov_send_mst IS 'Tenant isolation for provider-sender administration.';

COMMIT;


