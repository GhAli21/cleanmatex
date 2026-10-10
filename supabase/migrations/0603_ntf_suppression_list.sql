-- Notification Hub — provider-reported suppression list for EMAIL/SMS.
--
-- Confirmed gap (STATUS.md 2026-10-09/10 entries): there is no suppression-
-- *list* table anywhere under supabase/migrations as of migration 0602 —
-- only the per-customer `org_customers_mst.preferences.notifications.<channel>`
-- opt-out flag exists, already enforced by
-- web-admin/lib/notifications/customer-dispatch-consent.ts. That flag is a
-- customer-controlled toggle; this table is a different, additive concept —
-- an address/number a PROVIDER told us is undeliverable or complained about
-- (hard bounce, repeated soft bounce, spam complaint) or a carrier-level
-- opt-out (SMS STOP) — and must block sends regardless of the customer's own
-- toggle, because continuing to send to a bounced/complained address risks
-- the platform's own sender reputation and, for SMS, may violate carrier
-- rules. This is intentionally separate from org_customers_mst so it can be
-- populated by trusted provider-webhook ingestion without ever touching a
-- customer's own editable preferences.
BEGIN;

-- Tenant-scoped, provider-reported suppression entries for EMAIL/SMS.
-- One row per (tenant, channel, normalized address/number); re-suppression
-- is idempotent via ON CONFLICT DO UPDATE on the unique triple below, so a
-- repeated provider event (duplicate webhook delivery, repeated soft bounce)
-- only refreshes reason/source/timestamp rather than erroring or duplicating.
CREATE TABLE IF NOT EXISTS org_ntf_suppression_lst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  address_or_number TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  source TEXT NOT NULL,
  detail TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  CONSTRAINT fk_ntf_suppr_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst (id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_ntf_suppr_addr
    UNIQUE (tenant_org_id, channel_code, address_or_number),
  CONSTRAINT ck_ntf_suppr_channel
    CHECK (channel_code IN ('EMAIL', 'SMS')),
  CONSTRAINT ck_ntf_suppr_reason
    CHECK (reason_code IN ('BOUNCE_HARD', 'BOUNCE_SOFT_REPEATED', 'COMPLAINT', 'CARRIER_OPT_OUT')),
  CONSTRAINT ck_ntf_suppr_nonempty
    CHECK (btrim(address_or_number) <> '' AND btrim(source) <> '')
);

COMMENT ON TABLE org_ntf_suppression_lst IS
  'Tenant-owned provider-reported suppression entries (email bounce/complaint, SMS carrier opt-out) that block EMAIL/SMS dispatch to a specific address/number regardless of the customer own preference toggle. Populated only by trusted provider-webhook ingestion or reconciliation, never by a customer-facing action.';
COMMENT ON COLUMN org_ntf_suppression_lst.id IS
  'Surrogate identity for one suppression entry.';
COMMENT ON COLUMN org_ntf_suppression_lst.tenant_org_id IS
  'Tenant owner required for RLS and explicit service-layer predicates on every read/write.';
COMMENT ON COLUMN org_ntf_suppression_lst.channel_code IS
  'Channel this suppression applies to. EMAIL or SMS only — WhatsApp uses its own opt-in eligibility model; PUSH targets device subscriptions, not customer addresses.';
COMMENT ON COLUMN org_ntf_suppression_lst.address_or_number IS
  'Normalized recipient identity: lowercase email address for EMAIL, E.164 phone number for SMS. Normalization happens at write time so later lookups use the same comparable form the dispatch path reads.';
COMMENT ON COLUMN org_ntf_suppression_lst.reason_code IS
  'Why the address/number was suppressed: BOUNCE_HARD (permanent delivery failure), BOUNCE_SOFT_REPEATED (repeated transient failures treated as permanent), COMPLAINT (recipient marked as spam/abuse), CARRIER_OPT_OUT (SMS STOP/UNSUBSCRIBE reported by the carrier/provider).';
COMMENT ON COLUMN org_ntf_suppression_lst.source IS
  'Which provider or webhook reported this suppression (e.g. RESEND_WEBHOOK, TWILIO_INBOUND_SMS, MANUAL_OPERATOR), for audit and operator triage.';
COMMENT ON COLUMN org_ntf_suppression_lst.detail IS
  'Optional non-sensitive diagnostic detail (e.g. provider bounce sub-type); never raw provider payload or credentials.';
COMMENT ON COLUMN org_ntf_suppression_lst.suppressed_at IS
  'When the suppression took effect per the provider-reported event; distinct from created_at, which is this row insertion time (relevant when reconciliation backfills an older event).';
COMMENT ON COLUMN org_ntf_suppression_lst.created_at IS
  'UTC insertion time of this suppression entry.';
COMMENT ON COLUMN org_ntf_suppression_lst.created_by IS
  'Trusted webhook/service identity that persisted the suppression; never a tenant end-user.';
COMMENT ON COLUMN org_ntf_suppression_lst.created_info IS
  'Non-secret creation context for operational diagnosis.';
COMMENT ON COLUMN org_ntf_suppression_lst.updated_at IS
  'Last time this suppression entry was refreshed (e.g. a repeated bounce updating reason/detail via ON CONFLICT DO UPDATE).';
COMMENT ON COLUMN org_ntf_suppression_lst.updated_by IS
  'Trusted webhook/service identity that last refreshed this entry.';
COMMENT ON COLUMN org_ntf_suppression_lst.updated_info IS
  'Non-secret update context for operational diagnosis.';
COMMENT ON COLUMN org_ntf_suppression_lst.rec_status IS
  'Record lifecycle marker. 1=active (enforced at dispatch); an operator may set 0 to lift a suppression without deleting the audit trail.';
COMMENT ON COLUMN org_ntf_suppression_lst.rec_order IS
  'Reserved compatibility ordering field; not used for suppression semantics today.';
COMMENT ON COLUMN org_ntf_suppression_lst.rec_notes IS
  'Optional operator note (e.g. manual override rationale); must not contain raw provider payload or credentials.';
COMMENT ON COLUMN org_ntf_suppression_lst.is_active IS
  'Soft-activity marker mirroring rec_status for consistent tenant reporting conventions.';
COMMENT ON CONSTRAINT fk_ntf_suppr_tenant ON org_ntf_suppression_lst IS
  'Protects suppression ownership by requiring an existing tenant; RESTRICT preserves audit evidence.';
COMMENT ON CONSTRAINT uq_ntf_suppr_addr ON org_ntf_suppression_lst IS
  'Makes suppression idempotent per tenant/channel/address — a repeated provider event for the same address refreshes this one row via ON CONFLICT DO UPDATE instead of erroring or duplicating.';
COMMENT ON CONSTRAINT ck_ntf_suppr_channel ON org_ntf_suppression_lst IS
  'Restricts suppression to the two channels with a customer-address-based opt-out model (EMAIL, SMS).';
COMMENT ON CONSTRAINT ck_ntf_suppr_reason ON org_ntf_suppression_lst IS
  'Restricts reason_code to the known, dispatch-path-distinguishable suppression causes.';
COMMENT ON CONSTRAINT ck_ntf_suppr_nonempty ON org_ntf_suppression_lst IS
  'Prevents a blank address or blank source from ever being recorded as a suppression fact.';

-- Dispatch-path lookup is always (tenant_org_id, channel_code, address_or_number)
-- restricted to active entries — this index covers that exact predicate shape.
CREATE INDEX ix_ntf_suppr_lookup
  ON org_ntf_suppression_lst (tenant_org_id, channel_code, address_or_number)
  WHERE rec_status = 1;
COMMENT ON INDEX ix_ntf_suppr_lookup IS
  'Supports the dispatch-time suppression check (tenant + channel + normalized address, active entries only) with no table scan.';

ALTER TABLE org_ntf_suppression_lst ENABLE ROW LEVEL SECURITY;

-- Tenant users may read their own suppression entries (operator visibility);
-- writes happen only through trusted service-role webhook/reconciliation code,
-- which the admin Supabase client already bypasses RLS for. No tenant-client
-- INSERT/UPDATE/DELETE policy is created — a tenant end-user must never be
-- able to add or remove a provider-reported suppression entry directly.
CREATE POLICY tenant_iso_ntf_suppr_read
  ON org_ntf_suppression_lst
  FOR SELECT
  USING (tenant_org_id = current_tenant_id());
COMMENT ON POLICY tenant_iso_ntf_suppr_read ON org_ntf_suppression_lst IS
  'Tenant isolation for suppression-list reads; a tenant can never see another tenant suppression entries. No write policy exists for tenant-client roles by design — only trusted service-role code may write.';

COMMIT;
