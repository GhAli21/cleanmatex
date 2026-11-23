-- =============================================================================
-- Migration: 0818_ntf_campaign_customers.sql
-- Purpose:   Background Jobs step 5d. Campaigns can target customers (marketing
--            audience) as well as staff users (internal announcements):
--              1. org_ntf_campaigns_mst.audience_code (STAFF | CUSTOMERS) with the
--                 channels each audience may use (customers: EMAIL, SMS, WHATSAPP).
--              2. org_ntf_cust_consent_dtl: a customer's marketing consent per
--                 channel, with when and how it was given or withdrawn.
--              3. org_ntf_camp_targets_dtl.recipient_customer_id: a target is a
--                 staff user or a customer, never both.
--              4. ntf-campaign-scheduler (the old HQ worker that called the tenant
--                 HTTP route) is SUPERSEDED by the pg-boss queue ntf.campaign_start,
--                 so it can never run next to the new queues and double-send.
-- Affected:  org_customers_mst (new unique key), org_ntf_campaigns_mst,
--            org_ntf_camp_targets_dtl, new org_ntf_cust_consent_dtl,
--            sys_ops_job_cf row ntf-campaign-scheduler
-- Related:   0798 (worker retarget), 0810 (ntf queues), 0779 (SUPERSEDED lifecycle)
-- Safety:    No campaign rows exist on remote or local at write time; the CHECKs
--            are validated immediately. No cron.job change (0798 already removed it).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. Customer key for tenant-safe composite foreign keys
-- ---------------------------------------------------------------------------

-- Lets child tables reference a customer together with its Organization, so a row can
-- never point at another Organization's customer. id is already unique; this adds no new rule.
ALTER TABLE public.org_customers_mst
  ADD CONSTRAINT uq_org_cust_id_tenant UNIQUE (id, tenant_org_id);
COMMENT ON CONSTRAINT uq_org_cust_id_tenant ON public.org_customers_mst IS
  'Parent key for composite (customer_id, tenant_org_id) foreign keys (0818).';

-- ---------------------------------------------------------------------------
-- 2. Campaign audience
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_ntf_campaigns_mst
  ADD COLUMN audience_code TEXT NOT NULL DEFAULT 'STAFF';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.audience_code IS
  'Who the campaign reaches. STAFF: users in target_segment.user_ids (IN_APP, PUSH, EMAIL). CUSTOMERS: customers in target_segment.customer_ids, or every customer with marketing consent on the channel when target_segment.all_consented is true (EMAIL, SMS, WHATSAPP).';

-- Each audience only gets the channels it has an address for: staff have no phone on record,
-- customers have no in-app inbox or registered push device in web-admin. WhatsApp to customers
-- sends an approved Meta marketing template, never free text.
ALTER TABLE public.org_ntf_campaigns_mst
  ADD CONSTRAINT ck_ntf_camp_audience CHECK (
    (audience_code = 'STAFF' AND channel_code IN ('IN_APP', 'PUSH', 'EMAIL'))
    OR (audience_code = 'CUSTOMERS' AND channel_code IN ('EMAIL', 'SMS', 'WHATSAPP'))
  );
COMMENT ON CONSTRAINT ck_ntf_camp_audience ON public.org_ntf_campaigns_mst IS
  'Allowed audience codes and the channels each audience may use (0818).';

-- ---------------------------------------------------------------------------
-- 3. Customer marketing consent per channel
-- ---------------------------------------------------------------------------

CREATE TABLE public.org_ntf_cust_consent_dtl (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid(), -- Row id
  tenant_org_id        UUID        NOT NULL,                 -- Organization
  customer_id          UUID        NOT NULL,                 -- Customer the consent belongs to
  channel_code         TEXT        NOT NULL,                 -- EMAIL, SMS or WHATSAPP
  marketing_consent    BOOLEAN     NOT NULL DEFAULT false,   -- true = the customer agreed to receive marketing on this channel
  consent_given_at     TIMESTAMPTZ NULL,                     -- When consent was last given
  consent_withdrawn_at TIMESTAMPTZ NULL,                     -- When consent was last withdrawn
  consent_source       TEXT        NOT NULL,                 -- How it was recorded: STAFF (staff on the customer's behalf), CUSTOMER (the customer), IMPORT
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT        NULL,
  created_info         TEXT        NULL,
  updated_at           TIMESTAMPTZ NULL,
  updated_by           TEXT        NULL,
  updated_info         TEXT        NULL,
  updated_count        INTEGER     NOT NULL DEFAULT 0,
  deleted_at           TIMESTAMPTZ NULL,
  deleted_by           TEXT        NULL,
  deleted_info         TEXT        NULL,
  rec_status           SMALLINT    NOT NULL DEFAULT 1,
  rec_order            INTEGER     NULL,
  rec_notes            TEXT        NULL,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_org_ntf_cust_consent_dtl PRIMARY KEY (id),
  CONSTRAINT fk_ntf_ccons_tenant FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  CONSTRAINT fk_ntf_ccons_customer FOREIGN KEY (customer_id, tenant_org_id)
    REFERENCES public.org_customers_mst (id, tenant_org_id) ON DELETE CASCADE,
  CONSTRAINT uq_ntf_ccons_cust_channel UNIQUE (tenant_org_id, customer_id, channel_code),
  CONSTRAINT ck_ntf_ccons_channel CHECK (channel_code IN ('EMAIL', 'SMS', 'WHATSAPP')),
  CONSTRAINT ck_ntf_ccons_source CHECK (consent_source IN ('STAFF', 'CUSTOMER', 'IMPORT')),
  CONSTRAINT ck_ntf_ccons_given CHECK (NOT marketing_consent OR consent_given_at IS NOT NULL),
  CONSTRAINT ck_ntf_ccons_rec_status CHECK (rec_status IN (0, 1, 2)),
  CONSTRAINT ck_ntf_ccons_deleted_inactive CHECK (rec_status = 1 OR NOT is_active)
);

COMMENT ON TABLE public.org_ntf_cust_consent_dtl IS
  'A customer''s marketing consent per channel. Campaigns to customers send only where marketing_consent is true; HQ re-reads it just before sending. No row means no consent (0818).';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.id IS 'Row id.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.tenant_org_id IS 'Organization that owns the customer.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.customer_id IS 'Customer the consent belongs to (same Organization, composite FK).';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.channel_code IS 'Channel the consent covers: EMAIL, SMS or WHATSAPP. WhatsApp marketing consent is separate from the order-update opt-in in org_customers_mst.preferences.notifications.whatsapp.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.marketing_consent IS 'true = agreed to receive marketing on this channel; false = withdrawn or never given.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.consent_given_at IS 'When consent was last given. Required while marketing_consent is true.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.consent_withdrawn_at IS 'When consent was last withdrawn; NULL if never withdrawn.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.consent_source IS 'How the latest change was recorded: STAFF (by staff for the customer), CUSTOMER (by the customer), IMPORT.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.created_by IS 'User or process that created the row.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.created_info IS 'Free-text creation context.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.updated_at IS 'Last update time (fn_audit_touch_row).';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.updated_by IS 'User or process that last updated the row.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.updated_info IS 'Free-text update context.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.updated_count IS 'Number of updates (fn_audit_touch_row).';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.deleted_at IS 'Soft-delete time.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.deleted_by IS 'User or process that soft-deleted the row.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.deleted_info IS 'Free-text soft-delete context.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.rec_status IS '1 active, 0 deleted, 2 archived.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.rec_order IS 'Optional display order.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.rec_notes IS 'Optional notes.';
COMMENT ON COLUMN public.org_ntf_cust_consent_dtl.is_active IS 'false when soft-deleted.';
COMMENT ON CONSTRAINT fk_ntf_ccons_tenant ON public.org_ntf_cust_consent_dtl IS 'Organization; rows go with it.';
COMMENT ON CONSTRAINT fk_ntf_ccons_customer ON public.org_ntf_cust_consent_dtl IS 'Customer of the same Organization; consent is erased with the customer.';
COMMENT ON CONSTRAINT uq_ntf_ccons_cust_channel ON public.org_ntf_cust_consent_dtl IS 'One consent row per customer and channel; changes update it.';
COMMENT ON CONSTRAINT ck_ntf_ccons_channel ON public.org_ntf_cust_consent_dtl IS 'Channels customer campaigns use.';
COMMENT ON CONSTRAINT ck_ntf_ccons_source ON public.org_ntf_cust_consent_dtl IS 'Allowed consent sources.';
COMMENT ON CONSTRAINT ck_ntf_ccons_given ON public.org_ntf_cust_consent_dtl IS 'Consent on record must say when it was given.';
COMMENT ON CONSTRAINT ck_ntf_ccons_rec_status ON public.org_ntf_cust_consent_dtl IS 'Allowed record states.';
COMMENT ON CONSTRAINT ck_ntf_ccons_deleted_inactive ON public.org_ntf_cust_consent_dtl IS 'A deleted or archived row is inactive.';

-- Campaign audience: "every customer with consent on this channel".
CREATE INDEX idx_ntf_ccons_channel_yes ON public.org_ntf_cust_consent_dtl (tenant_org_id, channel_code, customer_id)
  WHERE marketing_consent AND is_active AND rec_status = 1;
COMMENT ON INDEX public.idx_ntf_ccons_channel_yes IS 'Finds the consenting customers of an Organization on one channel.';

CREATE TRIGGER trg_audit_touch BEFORE UPDATE ON public.org_ntf_cust_consent_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_audit_touch ON public.org_ntf_cust_consent_dtl IS 'Keeps updated_at and updated_count current.';

-- Read and written by the server only (service_role); the policy is defence in depth.
ALTER TABLE public.org_ntf_cust_consent_dtl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_ntf_cust_consent_dtl FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_ntf_cust_consent_dtl TO service_role;
CREATE POLICY tenant_isolation_ntf_ccons ON public.org_ntf_cust_consent_dtl
  FOR ALL
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));
COMMENT ON POLICY tenant_isolation_ntf_ccons ON public.org_ntf_cust_consent_dtl IS
  'Rows of the current Organization only.';

-- ---------------------------------------------------------------------------
-- 4. Campaign targets: staff user or customer
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD COLUMN recipient_customer_id UUID NULL;
COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.recipient_customer_id IS
  'Customer this target sends to (CUSTOMERS audience). NULL for a staff target, which uses recipient_user_id (0818).';

ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD CONSTRAINT fk_ntf_camp_tgt_customer FOREIGN KEY (recipient_customer_id, tenant_org_id)
    REFERENCES public.org_customers_mst (id, tenant_org_id);
COMMENT ON CONSTRAINT fk_ntf_camp_tgt_customer ON public.org_ntf_camp_targets_dtl IS
  'Customer of the same Organization. A customer with campaign history is kept (no cascade), like one with orders.';

ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD CONSTRAINT ck_ntf_camp_tgt_one_recipient CHECK (num_nonnulls(recipient_user_id, recipient_customer_id) = 1);
COMMENT ON CONSTRAINT ck_ntf_camp_tgt_one_recipient ON public.org_ntf_camp_targets_dtl IS
  'A target is exactly one staff user or one customer.';

ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD CONSTRAINT uq_ntf_camp_tgt_camp_cust UNIQUE (campaign_id, recipient_customer_id);
COMMENT ON CONSTRAINT uq_ntf_camp_tgt_camp_cust ON public.org_ntf_camp_targets_dtl IS
  'A customer is targeted once per campaign; re-running the start adds no row.';

CREATE INDEX idx_ntf_camp_tgt_customer ON public.org_ntf_camp_targets_dtl (tenant_org_id, recipient_customer_id)
  WHERE recipient_customer_id IS NOT NULL;
COMMENT ON INDEX public.idx_ntf_camp_tgt_customer IS 'Campaign history of a customer.';

-- HQ re-checks customer consent just before sending: outbox row -> its campaign target.
CREATE INDEX idx_ntf_camp_tgt_outbox ON public.org_ntf_camp_targets_dtl (tenant_org_id, outbox_id)
  WHERE outbox_id IS NOT NULL;
COMMENT ON INDEX public.idx_ntf_camp_tgt_outbox IS 'Finds the campaign target of an outbox row (HQ consent re-check).';

-- ---------------------------------------------------------------------------
-- 5. Retire the old campaign worker job
-- ---------------------------------------------------------------------------

-- ntf.campaign_start / ntf.campaign_chunk (pg-boss, cmx-workers) replace it. SUPERSEDED rows
-- cannot be enabled, restored or run (ck_sys_ops_job_cf_life_ops and fn_ops_job_*_v2, 0779).
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    superseded_by    = 'ntf.campaign_start',
    desired_enabled  = false,
    run_now_allowed  = false,
    operator_actions = ARRAY['OBSERVE']::TEXT[],
    notes = '0818 SUPERSEDED by the pg-boss queues ntf.campaign_start and ntf.campaign_chunk (cmx-workers). Observe only.',
    updated_at   = now(),
    updated_info = '0818 campaign queues replace the HQ worker'
WHERE job_code = 'ntf-campaign-scheduler'
  AND rec_status = 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = 'ntf-campaign-scheduler'
      AND (lifecycle_status <> 'SUPERSEDED' OR desired_enabled)
  ) THEN
    RAISE EXCEPTION '0818: ntf-campaign-scheduler was not superseded';
  END IF;
  IF has_table_privilege('authenticated', 'public.org_ntf_cust_consent_dtl', 'SELECT')
     OR has_table_privilege('anon', 'public.org_ntf_cust_consent_dtl', 'SELECT') THEN
    RAISE EXCEPTION '0818: public-key roles must not read org_ntf_cust_consent_dtl';
  END IF;
END $$;

COMMIT;
