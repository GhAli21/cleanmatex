-- ============================================================================
-- Migration: 0564_ntf_attempt_receipt_safety.sql
-- Purpose:   Extend the existing notification attempt ledger with immutable
--            claim/acceptance evidence and add verified tenant receipt facts.
--            This keeps provider acceptance distinct from delivered/read state.
-- Affected:  org_ntf_delivery_log_dtl, org_ntf_receipts_tr
-- Related:   0348_ntf_runtime_tables.sql, 0556_ntf_outbox_claim_safety.sql
-- ============================================================================

BEGIN;

-- Existing delivery-log rows receive a stable attempt identity before the new
-- uniqueness and receipt foreign keys are enabled. The explicit tenant filter
-- preserves the tenant boundary during this one-time compatibility backfill.
ALTER TABLE org_ntf_delivery_log_dtl
  ADD COLUMN attempt_id UUID,
  ADD COLUMN claim_token UUID,
  ADD COLUMN request_hash TEXT,
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN finished_at TIMESTAMPTZ,
  ADD COLUMN acceptance_state TEXT,
  ADD COLUMN retryable BOOLEAN,
  ADD COLUMN receipt_deadline TIMESTAMPTZ;

COMMENT ON COLUMN org_ntf_delivery_log_dtl.attempt_id IS
  'Stable identity for one provider submission attempt. Historic rows are backfilled from their immutable log ID.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.claim_token IS
  'Outbox claim token that owned this attempt, allowing stale-worker evidence to be rejected during reconciliation.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.request_hash IS
  'Optional versioned fingerprint of the protected provider request; never raw rendered content or credentials.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.started_at IS
  'UTC time immediately before the provider submission boundary; NULL only for historic attempts without this evidence.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.finished_at IS
  'UTC time the provider call returned or failed locally; NULL means the attempt needs reconciliation or is historic.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.acceptance_state IS
  'Provider submission evidence: ACCEPTED, REJECTED or UNCERTAIN. It never claims recipient delivery or read state.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.retryable IS
  'Whether retry policy may schedule another attempt after proven non-acceptance. NULL preserves historic evidence.';
COMMENT ON COLUMN org_ntf_delivery_log_dtl.receipt_deadline IS
  'UTC deadline for expected provider receipt correlation; NULL when the selected provider has no receipt contract.';

UPDATE org_ntf_delivery_log_dtl
SET attempt_id = id
WHERE tenant_org_id IS NOT NULL
  AND attempt_id IS NULL;

ALTER TABLE org_ntf_delivery_log_dtl
  ALTER COLUMN attempt_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN attempt_id SET NOT NULL;

COMMENT ON COLUMN org_ntf_delivery_log_dtl.attempt_id IS
  'Stable identity for one provider submission attempt. Historic rows use their immutable log ID; new records receive a generated identity, so every attempt can be receipt-correlated.';

-- One stable attempt identity per tenant prevents duplicate audit rows while preserving
-- historic append-only evidence that may share a legacy retry ordinal.
ALTER TABLE org_ntf_delivery_log_dtl
  ADD CONSTRAINT uq_ntf_dlog_attempt UNIQUE (tenant_org_id, attempt_id),
  ADD CONSTRAINT ck_ntf_dlog_time CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  ),
  ADD CONSTRAINT ck_ntf_dlog_accept CHECK (
    acceptance_state IS NULL
    OR acceptance_state IN ('ACCEPTED', 'REJECTED', 'UNCERTAIN')
  );

COMMENT ON CONSTRAINT uq_ntf_dlog_attempt ON org_ntf_delivery_log_dtl IS
  'Prevents a provider attempt identity from being recorded twice inside one tenant.';
COMMENT ON CONSTRAINT ck_ntf_dlog_time ON org_ntf_delivery_log_dtl IS
  'Rejects impossible attempt durations while allowing historic rows that lack new timing evidence.';
COMMENT ON CONSTRAINT ck_ntf_dlog_accept ON org_ntf_delivery_log_dtl IS
  'Keeps submission acceptance evidence separate from recipient delivery-status vocabulary.';

-- Replace the former global-ID FK with a tenant-safe composite key. The order
-- exactly matches 0556 parent key (id, tenant_org_id), which keeps db pull safe
-- for Prisma while leaving existing delivery-log history in place.
ALTER TABLE org_ntf_delivery_log_dtl
  DROP CONSTRAINT org_ntf_delivery_log_dtl_outbox_id_fkey;

ALTER TABLE org_ntf_delivery_log_dtl
  ADD CONSTRAINT fk_ntf_dlog_outbox_tnt
  FOREIGN KEY (outbox_id, tenant_org_id)
  REFERENCES org_ntf_outbox_dtl (id, tenant_org_id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_ntf_dlog_outbox_tnt ON org_ntf_delivery_log_dtl IS
  'Prevents an attempt from referencing an outbox delivery owned by a different tenant; RESTRICT preserves audit evidence.';



COMMENT ON TABLE org_ntf_delivery_log_dtl IS
  'Append-only per-attempt delivery audit ledger. Claim and acceptance evidence establish submission history without claiming recipient delivery.';



CREATE INDEX ix_ntf_dlog_provider_msg
  ON org_ntf_delivery_log_dtl (tenant_org_id, provider_code, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
COMMENT ON INDEX ix_ntf_dlog_provider_msg IS
  'Supports tenant-scoped correlation of verified provider callbacks to the append-only submission attempt ledger.';
-- The original broad policy allowed tenant-side updates and deletes despite this
-- table being an immutable ledger. Preserve tenant reads and legacy inserts,
-- while preventing tenant clients from changing or erasing attempt evidence.
DROP POLICY tenant_isolation_org_ntf_delivery_log ON org_ntf_delivery_log_dtl;

CREATE POLICY tenant_iso_ntf_dlog_read
  ON org_ntf_delivery_log_dtl
  FOR SELECT
  USING (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_dlog_read ON org_ntf_delivery_log_dtl IS
  'Tenant isolation for immutable attempt-ledger reads; a tenant cannot inspect another tenant submission evidence.';

CREATE POLICY tenant_iso_ntf_dlog_add
  ON org_ntf_delivery_log_dtl
  FOR INSERT
  WITH CHECK (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_dlog_add ON org_ntf_delivery_log_dtl IS
  'Tenant isolation for legacy attempt insertion; tenant clients cannot update or delete immutable attempt evidence.';

-- Stores only signature-verified, tenant-correlated receipt facts. Raw ingress
-- stays in the HQ quarantine boundary; this table intentionally holds only a
-- redacted diagnostic projection and protected payload correlation value.
CREATE TABLE org_ntf_receipts_tr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  delivery_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  provider_code TEXT NOT NULL,
  provider_event_key TEXT NOT NULL,
  provider_message_id TEXT,
  receipt_kind TEXT NOT NULL,
  provider_status_raw TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT,
  redacted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
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
  CONSTRAINT fk_ntf_rcpt_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_rcpt_outbox_tnt
    FOREIGN KEY (delivery_id, tenant_org_id)
    REFERENCES org_ntf_outbox_dtl (id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ntf_rcpt_attempt_tnt
    FOREIGN KEY (attempt_id, tenant_org_id)
    REFERENCES org_ntf_delivery_log_dtl (attempt_id, tenant_org_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_rcpt_event
    UNIQUE (tenant_org_id, provider_code, provider_event_key),
  CONSTRAINT ck_ntf_rcpt_verified
    CHECK (verified_at IS NOT NULL AND btrim(provider_event_key) <> ''),
  CONSTRAINT ck_ntf_rcpt_kind
    CHECK (receipt_kind IN ('ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'UNDELIVERABLE'))
);

COMMENT ON TABLE org_ntf_receipts_tr IS
  'Immutable tenant-owned facts from verified provider callbacks. It never stores raw ingress bodies or mutates delivery content.';
COMMENT ON COLUMN org_ntf_receipts_tr.id IS
  'Surrogate identity for one normalized receipt fact.';
COMMENT ON COLUMN org_ntf_receipts_tr.tenant_org_id IS
  'Tenant owner required for RLS, composite correlations and explicit service predicates.';
COMMENT ON COLUMN org_ntf_receipts_tr.delivery_id IS
  'Existing outbox delivery identity to which the verified provider event belongs.';
COMMENT ON COLUMN org_ntf_receipts_tr.attempt_id IS
  'Immutable provider attempt identity that submitted the correlated delivery.';
COMMENT ON COLUMN org_ntf_receipts_tr.provider_code IS
  'Catalog provider code that received the callback; it scopes external identifier interpretation.';
COMMENT ON COLUMN org_ntf_receipts_tr.provider_event_key IS
  'Provider event identity used for tenant-scoped replay protection; it must not be a mutable status label alone.';
COMMENT ON COLUMN org_ntf_receipts_tr.provider_message_id IS
  'Provider submission identifier retained for correlation; NULL only when the provider supplied no message identifier.';
COMMENT ON COLUMN org_ntf_receipts_tr.receipt_kind IS
  'Normalized provider fact. ACCEPTED is submission evidence; DELIVERED and READ require an actual verified receipt.';
COMMENT ON COLUMN org_ntf_receipts_tr.provider_status_raw IS
  'Original provider status token retained for diagnostics without replacing normalized receipt semantics.';
COMMENT ON COLUMN org_ntf_receipts_tr.received_at IS
  'UTC time the callback reached trusted ingress.';
COMMENT ON COLUMN org_ntf_receipts_tr.verified_at IS
  'UTC time signature and provider-account verification succeeded before the fact was stored.';
COMMENT ON COLUMN org_ntf_receipts_tr.payload_hash IS
  'Optional protected callback payload fingerprint for replay diagnostics; never a raw payload or guessable recipient hash.';
COMMENT ON COLUMN org_ntf_receipts_tr.redacted_payload IS
  'Redacted structured diagnostic fields only; provider credentials, raw callback content and full recipient data are forbidden.';
COMMENT ON COLUMN org_ntf_receipts_tr.created_at IS
  'UTC insertion time for this immutable receipt fact.';
COMMENT ON COLUMN org_ntf_receipts_tr.created_by IS
  'Trusted worker or service identity that persisted the verified projection.';
COMMENT ON COLUMN org_ntf_receipts_tr.created_info IS
  'Non-secret creation context used for operational diagnosis.';
COMMENT ON COLUMN org_ntf_receipts_tr.updated_at IS
  'Reserved compatibility audit field; immutable receipt facts are not updated after insertion.';
COMMENT ON COLUMN org_ntf_receipts_tr.updated_by IS
  'Reserved compatibility audit field; immutable receipt facts are not updated after insertion.';
COMMENT ON COLUMN org_ntf_receipts_tr.updated_info IS
  'Reserved compatibility audit field; immutable receipt facts are not updated after insertion.';
COMMENT ON COLUMN org_ntf_receipts_tr.rec_status IS
  'Record lifecycle marker. 1=active; receipt history is retained rather than hard-deleted.';
COMMENT ON COLUMN org_ntf_receipts_tr.rec_order IS
  'Optional deterministic display order for operational receipt timelines.';
COMMENT ON COLUMN org_ntf_receipts_tr.rec_notes IS
  'Optional non-sensitive operational note; it must not contain raw provider payload or credentials.';
COMMENT ON COLUMN org_ntf_receipts_tr.is_active IS
  'Soft-activity marker retained for consistent tenant reporting; receipt facts remain auditable when inactive.';
COMMENT ON CONSTRAINT fk_ntf_rcpt_tenant ON org_ntf_receipts_tr IS
  'Protects receipt ownership by requiring every fact to reference an existing tenant; RESTRICT preserves audit evidence.';
COMMENT ON CONSTRAINT fk_ntf_rcpt_outbox_tnt ON org_ntf_receipts_tr IS
  'Enforces that a receipt can reference only a delivery from the same tenant; RESTRICT preserves evidence.';
COMMENT ON CONSTRAINT fk_ntf_rcpt_attempt_tnt ON org_ntf_receipts_tr IS
  'Enforces that a receipt is tied to a provider attempt from the same tenant; RESTRICT preserves evidence.';
COMMENT ON CONSTRAINT uq_ntf_rcpt_event ON org_ntf_receipts_tr IS
  'Deduplicates replayed provider events inside their tenant and provider namespace.';
COMMENT ON CONSTRAINT ck_ntf_rcpt_verified ON org_ntf_receipts_tr IS
  'Prevents unsigned, unverified or anonymous callback data from becoming a tenant delivery fact.';
COMMENT ON CONSTRAINT ck_ntf_rcpt_kind ON org_ntf_receipts_tr IS
  'Limits normalized facts to provider receipt semantics that remain distinct from legacy outbox status tokens.';

-- Supports receipt lookup from provider ingress and chronological delivery views
-- without broad cross-tenant scans.
CREATE INDEX ix_ntf_rcpt_tenant_time
  ON org_ntf_receipts_tr (tenant_org_id, received_at DESC);
COMMENT ON INDEX ix_ntf_rcpt_tenant_time IS
  'Supports tenant-scoped receipt timelines and operational investigation ordered by trusted ingress time.';

CREATE INDEX ix_ntf_rcpt_del_time
  ON org_ntf_receipts_tr (tenant_org_id, delivery_id, received_at);
COMMENT ON INDEX ix_ntf_rcpt_del_time IS
  'Supports loading immutable receipt history for one tenant-owned outbox delivery.';

CREATE INDEX ix_ntf_rcpt_provider_msg
  ON org_ntf_receipts_tr (tenant_org_id, provider_code, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
COMMENT ON INDEX ix_ntf_rcpt_provider_msg IS
  'Supports tenant-scoped correlation from a verified provider message identifier without indexing null values.';

ALTER TABLE org_ntf_receipts_tr ENABLE ROW LEVEL SECURITY;

-- Tenant users may read only their receipt facts. Trusted runtime services write
-- through server credentials; client roles cannot update or delete immutable evidence.
CREATE POLICY tenant_iso_ntf_receipts_read
  ON org_ntf_receipts_tr
  FOR SELECT
  USING (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_receipts_read ON org_ntf_receipts_tr IS
  'Tenant isolation for receipt-history reads; a tenant can never inspect another tenant provider evidence.';

COMMIT;
