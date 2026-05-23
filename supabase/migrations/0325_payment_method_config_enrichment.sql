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
