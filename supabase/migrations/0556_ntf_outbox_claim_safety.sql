-- ============================================================================
-- Migration: 0556_ntf_outbox_claim_safety.sql
-- Purpose:   Add durable ownership and reconciliation metadata to the existing
--            notification outbox so competing workers cannot finalize the same
--            delivery and uncertain provider acceptance is never auto-retried.
-- Affected:  org_ntf_outbox_dtl
-- Related:   0348_ntf_runtime_tables.sql, 0350_ntf_outbox_cron.sql
-- ============================================================================

BEGIN;

-- Keep the existing outbox as the single delivery identity. These nullable
-- fields are additive so historic rows and the deployed legacy worker remain
-- readable while the claim-aware worker is rolled out after operator review.
ALTER TABLE org_ntf_outbox_dtl
  ADD COLUMN claim_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN claimed_by TEXT,
  ADD COLUMN reconcile_state TEXT,
  ADD COLUMN finalized_at TIMESTAMPTZ,
  ADD COLUMN recipient_hash TEXT,
  ADD COLUMN payload_hash TEXT;

COMMENT ON COLUMN org_ntf_outbox_dtl.claim_token IS
  'Opaque UUID generated for each worker claim; finalization compares it to prevent a stale worker from changing a newer claim.';
COMMENT ON COLUMN org_ntf_outbox_dtl.lease_expires_at IS
  'UTC expiry for a worker claim. Expiry permits recovery only when provider acceptance is known not to be uncertain.';
COMMENT ON COLUMN org_ntf_outbox_dtl.claimed_by IS
  'Non-secret worker identity retained to diagnose ownership and recovery decisions.';
COMMENT ON COLUMN org_ntf_outbox_dtl.reconcile_state IS
  'NULL for ordinary processing. ACCEPTANCE_UNCERTAIN blocks automatic retry until provider acceptance is reconciled.';
COMMENT ON COLUMN org_ntf_outbox_dtl.finalized_at IS
  'UTC time a claim-aware worker reached a terminal delivery result; NULL preserves legacy-row compatibility.';
COMMENT ON COLUMN org_ntf_outbox_dtl.recipient_hash IS
  'Optional tenant-scoped keyed recipient correlation value. It must never contain a raw destination or an unkeyed digest.';
COMMENT ON COLUMN org_ntf_outbox_dtl.payload_hash IS
  'Optional versioned fingerprint of the protected delivery payload, used to diagnose duplicate commands without storing rendered content again.';

-- PostgreSQL needs this exact composite key for future tenant-safe child
-- references, even though id is already globally unique. The column order is
-- intentionally (id, tenant_org_id) so children can use the Prisma-safe order.
ALTER TABLE org_ntf_outbox_dtl
  ADD CONSTRAINT uq_ntf_outbox_id_tenant UNIQUE (id, tenant_org_id);

COMMENT ON CONSTRAINT uq_ntf_outbox_id_tenant ON org_ntf_outbox_dtl IS
  'Supports tenant-safe composite foreign keys from append-only attempts and verified receipts using the parent key order required by Prisma.';

-- A claim is complete only when every ownership field is present. A worker may
-- retain its claim while provider acceptance is uncertain, but no terminal row
-- may retain a lease that could later be recovered and resent.
ALTER TABLE org_ntf_outbox_dtl
  ADD CONSTRAINT ck_ntf_outbox_lease CHECK (
    (
      claim_token IS NULL
      AND claimed_by IS NULL
      AND lease_expires_at IS NULL
    )
    OR (
      claim_token IS NOT NULL
      AND claimed_by IS NOT NULL
      AND btrim(claimed_by) <> ''
      AND lease_expires_at IS NOT NULL
      AND status NOT IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED')
    )
  );

COMMENT ON CONSTRAINT ck_ntf_outbox_lease ON org_ntf_outbox_dtl IS
  'Prevents partial claims and prevents terminal deliveries from being reclaimed by an expired worker lease.';

-- Keep uncertainty separate from the established delivery-status vocabulary.
-- It is valid only while the selected worker still owns the PROCESSING row.
ALTER TABLE org_ntf_outbox_dtl
  ADD CONSTRAINT ck_ntf_outbox_recon CHECK (
    reconcile_state IS NULL
    OR (
      reconcile_state = 'ACCEPTANCE_UNCERTAIN'
      AND status = 'PROCESSING'
      AND claim_token IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT ck_ntf_outbox_recon ON org_ntf_outbox_dtl IS
  'Forces submission uncertainty to remain an owned processing state instead of becoming an unsafe automatic retry or an undeclared delivery status.';

-- finalized_at adds trustworthy claim-aware timing without rewriting historical
-- terminal rows, whose legacy status timestamps have different semantics.
ALTER TABLE org_ntf_outbox_dtl
  ADD CONSTRAINT ck_ntf_outbox_final CHECK (
    finalized_at IS NULL
    OR status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_TEMPORARY', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED')
  );

COMMENT ON CONSTRAINT ck_ntf_outbox_final ON org_ntf_outbox_dtl IS
  'Allows finalized timing only for an established non-processing outcome while leaving historic rows unchanged.';

-- Supports fair, tenant-scoped selection of newly due work without scanning
-- completed rows or retry rows that are governed by next_retry_at instead.
CREATE INDEX ix_ntf_outbox_due_v2
  ON org_ntf_outbox_dtl (tenant_org_id, scheduled_at, id)
  WHERE status = 'QUEUED';

COMMENT ON INDEX ix_ntf_outbox_due_v2 IS
  'Supports ordered tenant-scoped claims of scheduled queued deliveries.';

-- Separates retry scheduling from initial dispatch so a worker never mistakes a
-- NULL retry timestamp for eligible retry work.
CREATE INDEX ix_ntf_outbox_retry_v2
  ON org_ntf_outbox_dtl (tenant_org_id, next_retry_at, id)
  WHERE status = 'FAILED_TEMPORARY' AND next_retry_at IS NOT NULL;

COMMENT ON INDEX ix_ntf_outbox_retry_v2 IS
  'Supports tenant-scoped recovery of explicitly scheduled transient failures.';

-- Makes expired claims observable and recoverable while preserving a direct
-- tenant predicate in every worker query that uses this index.
CREATE INDEX ix_ntf_outbox_lease
  ON org_ntf_outbox_dtl (tenant_org_id, lease_expires_at, id)
  WHERE claim_token IS NOT NULL;

COMMENT ON INDEX ix_ntf_outbox_lease IS
  'Supports tenant-scoped expiry scans for owned work without reading unclaimed deliveries.';

COMMENT ON TABLE org_ntf_outbox_dtl IS
  'Multi-channel dispatch queue and authoritative delivery identity. Claim metadata prevents competing workers from finalizing the same send; acceptance uncertainty requires reconciliation before replay.';

-- RLS and existing grants are intentionally unchanged: the new fields remain
-- protected by the established tenant policy, while workers must still include
-- tenant_org_id directly in every query and update.

COMMIT;
