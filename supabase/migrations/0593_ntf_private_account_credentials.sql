-- ============================================================================
-- Migration: 0593_ntf_private_account_credentials.sql
-- Purpose:   Store one account-bound encrypted credential envelope for each
--            tenant-owned provider account, so private provider imports never
--            infer secrets from a tenant/channel/provider-wide configuration.
-- Affected:  org_ntf_prov_cred_mst
-- Related:   0571_ntf_provider_account_sender_foundation.sql,
--            0592_ntf_private_template_import_command.sql
-- ============================================================================
BEGIN;

-- Credentials remain encrypted by the HQ application master key. This table
-- stores only the opaque AES-GCM envelope and rotation metadata; plaintext and
-- provider-secret fragments are never projected to tenant/browser queries.
CREATE TABLE org_ntf_prov_cred_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable opaque credential-set identity.
  tenant_org_id UUID NOT NULL, -- Immutable tenant owner for RLS and composite account ownership.
  provider_account_id UUID NOT NULL, -- Exact tenant provider account that may resolve this envelope.
  credential_kind TEXT NOT NULL, -- Connector-specific non-secret credential contract, for example TWILIO_ACCOUNT_AUTH.
  credential_version TEXT NOT NULL, -- Tenant-controlled rotation label; not a secret value.
  encrypted_config TEXT NOT NULL, -- HQ AES-256-GCM envelope; plaintext credentials are forbidden.
  fingerprint TEXT, -- Optional one-way diagnostic fingerprint; never a secret or reversible value.
  verified_at TIMESTAMPTZ, -- UTC time a trusted connector last verified this credential set.
  expires_at TIMESTAMPTZ, -- Optional provider/vault expiry boundary for fail-closed resolution.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- UTC creation timestamp.
  created_by TEXT, -- Actor or trusted service creating the encrypted envelope.
  created_info TEXT, -- Non-secret provenance for credential enrollment.
  updated_at TIMESTAMPTZ, -- UTC timestamp of a permitted rotation/update.
  updated_by TEXT, -- Actor or trusted service completing the rotation.
  updated_info TEXT, -- Non-secret provenance for the latest update.
  rec_status SMALLINT NOT NULL DEFAULT 1, -- 1=active record, 0=soft-deleted record.
  rec_order INTEGER, -- Optional administrative ordering value.
  rec_notes TEXT, -- Optional non-secret administrative note.
  is_active BOOLEAN NOT NULL DEFAULT true, -- Only active credential sets are eligible for connector resolution.
  CONSTRAINT fk_ntf_ocred_acct FOREIGN KEY (provider_account_id, tenant_org_id) REFERENCES org_ntf_prov_acct_mst(id, tenant_org_id) ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_ocred_acct UNIQUE (provider_account_id, tenant_org_id),
  CONSTRAINT ck_ntf_ocred_kind CHECK (btrim(credential_kind) <> ''),
  CONSTRAINT ck_ntf_ocred_ver CHECK (btrim(credential_version) <> ''),
  CONSTRAINT ck_ntf_ocred_env CHECK (btrim(encrypted_config) <> ''),
  CONSTRAINT ck_ntf_ocred_exp CHECK (expires_at IS NULL OR expires_at > created_at)
);
COMMENT ON TABLE org_ntf_prov_cred_mst IS 'Tenant-owned encrypted credential envelope bound to exactly one provider account; prevents ambiguous tenant-wide BYO secret resolution.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.id IS 'Stable opaque credential-set identity.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.tenant_org_id IS 'Immutable tenant owner used by RLS and composite account ownership.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.provider_account_id IS 'Exact tenant provider account eligible to resolve this credential envelope.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.credential_kind IS 'Non-secret connector contract used to validate decrypted credential fields.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.credential_version IS 'Non-secret tenant rotation label for audited credential replacement.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.encrypted_config IS 'AES-GCM encrypted credential envelope written and decrypted only by HQ server services.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.fingerprint IS 'Optional one-way non-secret fingerprint used to diagnose a rotated credential set.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.verified_at IS 'UTC time a trusted connector last accepted this credential set.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.expires_at IS 'Optional UTC expiry after which connectors fail closed.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.created_at IS 'UTC creation timestamp.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.created_by IS 'Actor or service that enrolled the envelope.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.created_info IS 'Non-secret enrollment provenance.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.updated_at IS 'UTC timestamp of the latest credential rotation.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.updated_by IS 'Actor or service that rotated the envelope.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.updated_info IS 'Non-secret rotation provenance.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.rec_status IS 'Repository lifecycle marker; 1=active record, 0=soft-deleted record.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.rec_order IS 'Optional administrative ordering value.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.rec_notes IS 'Optional non-secret administrative note.';
COMMENT ON COLUMN org_ntf_prov_cred_mst.is_active IS 'Whether this envelope is eligible for future trusted connector resolution.';
COMMENT ON CONSTRAINT fk_ntf_ocred_acct ON org_ntf_prov_cred_mst IS 'Uses parent key order (id, tenant_org_id) so a credential envelope cannot cross tenant account boundaries.';
COMMENT ON CONSTRAINT uq_ntf_ocred_acct ON org_ntf_prov_cred_mst IS 'Allows exactly one current encrypted credential set per tenant provider account; rotation updates the envelope in place.';
COMMENT ON CONSTRAINT ck_ntf_ocred_kind ON org_ntf_prov_cred_mst IS 'Rejects blank connector credential contracts.';
COMMENT ON CONSTRAINT ck_ntf_ocred_ver ON org_ntf_prov_cred_mst IS 'Requires an auditable non-secret rotation label.';
COMMENT ON CONSTRAINT ck_ntf_ocred_env ON org_ntf_prov_cred_mst IS 'Rejects blank encrypted envelopes; plaintext credential columns are intentionally absent.';
COMMENT ON CONSTRAINT ck_ntf_ocred_exp ON org_ntf_prov_cred_mst IS 'Prevents an expiry boundary before credential enrollment.';

-- Tenant-scoped connector lookup reads active credential state by account.
CREATE INDEX ix_ntf_ocred_resolve ON org_ntf_prov_cred_mst (tenant_org_id, provider_account_id, is_active, rec_status);
COMMENT ON INDEX ix_ntf_ocred_resolve IS 'Supports fail-closed tenant-scoped credential resolution for one provider account.';

-- Tenant users may administer their own credential metadata through guarded
-- services, but browser clients never receive encrypted_config projections.
ALTER TABLE org_ntf_prov_cred_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso_ntf_ocred ON org_ntf_prov_cred_mst
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_ocred ON org_ntf_prov_cred_mst IS 'Tenant isolation for account-bound credential envelope metadata; application services additionally suppress the encrypted envelope from responses.';

COMMIT;