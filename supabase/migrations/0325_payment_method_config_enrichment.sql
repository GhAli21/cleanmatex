-- ============================================================
-- Migration: 0321_payment_method_config_enrichment.sql
-- Feature:   BVM Wiring Phase 1B — D9 payment method config columns
-- Purpose:   Adds config columns needed for config-driven payment
--            status resolution (D9 dual-table architecture).
--            sys_payment_method_cd holds global NOT NULL defaults;
--            org_payment_methods_cf holds NULLABLE tenant overrides
--            (NULL = inherit from sys).
--            At query time use COALESCE(org.col, sys.col).
-- ============================================================

-- ── 1. Add D9 config columns to sys_payment_method_cd (global defaults, NOT NULL) ──

ALTER TABLE sys_payment_method_cd
  ADD COLUMN IF NOT EXISTS default_creation_status     TEXT    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS allow_status_override       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_reference          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_cash_drawer        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_user_id_required         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_outside_integration   BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Seed sys_payment_method_cd with per-method defaults ────────────────────────

UPDATE sys_payment_method_cd SET
  default_creation_status = 'COMPLETED',
  requires_cash_drawer    = TRUE,
  allow_outside_integration = TRUE
WHERE payment_method_code = 'CASH';

UPDATE sys_payment_method_cd SET
  default_creation_status   = 'COMPLETED',
  allow_outside_integration = TRUE
WHERE payment_method_code = 'CARD';

UPDATE sys_payment_method_cd SET
  default_creation_status   = 'PENDING',
  requires_reference        = TRUE,
  allow_outside_integration = TRUE
WHERE payment_method_code = 'BANK_TRANSFER';

UPDATE sys_payment_method_cd SET
  default_creation_status = 'PENDING',
  requires_reference      = TRUE,
  is_user_id_required     = TRUE
WHERE payment_method_code = 'CHECK';

-- Gateway methods (any row with gateway_code set): PROCESSING status, API-allowed
UPDATE sys_payment_method_cd SET
  default_creation_status   = 'PROCESSING',
  allow_outside_integration = TRUE
WHERE gateway_code IS NOT NULL;

-- ── 3. Add missing D9 columns to org_payment_methods_cf (NULLABLE = tenant override) ──
-- Note: requires_reference and requires_cash_drawer already exist on this table.
-- Note: allowed_in_pos covers is_show_in_order_pos; allowed_in_customer_app covers
--       is_allow_from_cmx_mobile_apps — no new columns needed for those concepts.

ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS default_creation_status   TEXT,
  ADD COLUMN IF NOT EXISTS allow_status_override     BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_user_id_required       BOOLEAN,
  ADD COLUMN IF NOT EXISTS allow_outside_integration BOOLEAN;

-- ── 4. Populate org_payment_methods_cf from sys defaults (initial seed) ───────────
-- Tenants can override these values after this migration.

UPDATE org_payment_methods_cf o
SET
  default_creation_status   = s.default_creation_status,
  allow_status_override     = s.allow_status_override,
  is_user_id_required       = s.is_user_id_required,
  allow_outside_integration = s.allow_outside_integration,
  -- Sync requires_reference and requires_cash_drawer from sys where not already set
  requires_reference        = COALESCE(o.requires_reference, s.requires_reference),
  requires_cash_drawer      = COALESCE(o.requires_cash_drawer, s.requires_cash_drawer)
FROM sys_payment_method_cd s
WHERE o.payment_method_code = s.payment_method_code;

-- Update Order 

Update sys_payment_method_cd Set rec_order=1 Where payment_method_code='CASH'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=2 Where payment_method_code='CARD'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=3 Where payment_method_code='MOBILE_PAYMENT'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=4 Where payment_method_code='BANK_TRANSFER'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=5 Where payment_method_code='CHECK'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=9 Where payment_method_code='ADVANCE'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=11 Where payment_method_code='GIFT_CARD'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=12 Where payment_method_code='LOYALTY_POINTS'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=13 Where payment_method_code='WALLET'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=21 Where payment_method_code='CREDIT_NOTE'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=101 Where payment_method_code='PAYMENT_GATEWAY' And ( rec_order<100 Or rec_order is null);
Update sys_payment_method_cd Set rec_order=102 Where payment_method_code='HYPERPAY'  And ( rec_order<100 Or rec_order is null);
Update sys_payment_method_cd Set rec_order=103 Where payment_method_code='PAYTABS'  And ( rec_order<100 Or rec_order is null);
Update sys_payment_method_cd Set rec_order=104 Where payment_method_code='STRIPE'  And ( rec_order<100 Or rec_order is null);
Update sys_payment_method_cd Set rec_order=200 Where payment_method_code='PAY_ON_COLLECTION' And rec_order is null;
Update sys_payment_method_cd Set rec_order=201 Where payment_method_code='PAY_ON_DELIVERY'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=202 Where payment_method_code='CREDIT_INVOICE'  And rec_order is null;
Update sys_payment_method_cd Set rec_order=203 Where payment_method_code='INVOICE'  And rec_order is null;
--

UPDATE org_payment_methods_cf SET display_order=1 WHERE payment_method_code='CASH' AND payment_method_code = 'CASH' AND display_order!=1;
UPDATE org_payment_methods_cf SET display_order=2 WHERE payment_method_code='CARD' AND payment_method_code = 'CARD' AND display_order!=2;
UPDATE org_payment_methods_cf SET display_order=3 WHERE payment_method_code='MOBILE_PAYMENT' AND payment_method_code = 'MOBILE_PAYMENT' AND display_order!=3;
UPDATE org_payment_methods_cf SET display_order=4 WHERE payment_method_code='BANK_TRANSFER' AND payment_method_code = 'BANK_TRANSFER' AND display_order!=4;
UPDATE org_payment_methods_cf SET display_order=5 WHERE payment_method_code='CHECK' AND payment_method_code = 'CHECK' AND display_order!=5;
UPDATE org_payment_methods_cf SET display_order=9 WHERE payment_method_code='ADVANCE' AND payment_method_code = 'ADVANCE' AND display_order!=9;
UPDATE org_payment_methods_cf SET display_order=11 WHERE payment_method_code='GIFT_CARD' AND payment_method_code = 'GIFT_CARD' AND display_order!=11;
UPDATE org_payment_methods_cf SET display_order=12 WHERE payment_method_code='LOYALTY_POINTS' AND payment_method_code = 'LOYALTY_POINTS' AND display_order!=12;
UPDATE org_payment_methods_cf SET display_order=13 WHERE payment_method_code='WALLET' AND payment_method_code = 'WALLET' AND display_order!=13;
UPDATE org_payment_methods_cf SET display_order=21 WHERE payment_method_code='CREDIT_NOTE' AND payment_method_code = 'CREDIT_NOTE' AND display_order!=21;
UPDATE org_payment_methods_cf SET display_order=104 WHERE payment_method_code='PAYMENT_GATEWAY' AND gateway_code = 'HYPERPAY' AND display_order!=101;
UPDATE org_payment_methods_cf SET display_order=104 WHERE payment_method_code='PAYMENT_GATEWAY' AND gateway_code = 'PAYTABS' AND display_order!=102;
UPDATE org_payment_methods_cf SET display_order=104 WHERE payment_method_code='PAYMENT_GATEWAY' AND gateway_code = 'STRIPE' AND display_order!=103;
UPDATE org_payment_methods_cf SET display_order=104 WHERE payment_method_code='PAYMENT_GATEWAY' AND gateway_code = 'MANUAL' AND display_order!=104;
UPDATE org_payment_methods_cf SET display_order=200 WHERE payment_method_code='PAY_ON_COLLECTION' AND payment_method_code = 'PAY_ON_COLLECTION' AND display_order!=200;
UPDATE org_payment_methods_cf SET display_order=201 WHERE payment_method_code='PAY_ON_DELIVERY' AND payment_method_code = 'PAY_ON_DELIVERY' AND display_order!=201;
UPDATE org_payment_methods_cf SET display_order=202 WHERE payment_method_code='CREDIT_INVOICE' AND payment_method_code = 'CREDIT_INVOICE' AND display_order!=202;

Commit;
 