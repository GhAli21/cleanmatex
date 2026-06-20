-- ==================================================================
-- 0383_einvoice_tenant_enablement.sql
-- Purpose: F-05 (ADR-052 / D-02) — E-invoicing foundation: tenant
--          enablement flags. Adds is_e_invoice_enabled +
--          e_invoice_enabled_start_date to org_tenants_mst with a guard
--          CHECK (start date required when enabled). Runtime activation
--          rule (evaluated in cleanmatex order path):
--              is_e_invoice_enabled = true
--              AND order_date >= e_invoice_enabled_start_date
-- ADR: docs/features/Order_Fin/ADR/ADR-052-E-Invoicing-Launch-Scope.md
-- Placement decision: dedicated typed columns on org_tenants_mst
--   (Approved_By_Jh) — only option that can DB-enforce "start date set
--   when enabled"; compliance/tax-authoritative master data.
-- ==================================================================
-- WHY this migration is safe:
--   • Purely additive; no data rewrite.
--   • is_e_invoice_enabled DEFAULT false → every existing tenant keeps
--     the current flat-VAT behavior unchanged (no behavior change).
--   • The CHECK holds immediately for all existing rows (enabled=false →
--     "NOT false OR ..." = true), so no NOT VALID/VALIDATE step is needed.
--   • Column WRITES are owned by cleanmatexsaas HQ tenant management;
--     cleanmatex READS them for the activation rule. Migration is defined
--     here per the migration-ownership contract (cleanmatex owns all
--     migrations; org_tenants_mst columns are tenant master data, NOT a
--     sys_stng_*/sys_feature_flags_* API-consumed setting).
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — Tenant e-invoice enablement columns
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS is_e_invoice_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS e_invoice_enabled_start_date date;

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Guard constraint: start date required when enabled
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.org_tenants_mst
  DROP CONSTRAINT IF EXISTS chk_org_tnt_einv_start RESTRICT;

ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT chk_org_tnt_einv_start
    CHECK (NOT is_e_invoice_enabled OR e_invoice_enabled_start_date IS NOT NULL);

COMMENT ON COLUMN public.org_tenants_mst.is_e_invoice_enabled IS
  'F-05/ADR-052: master toggle for the e-invoicing flow. Default false = current flat-VAT behavior. Written by HQ tenant management; read by cleanmatex for the per-order activation rule.';

COMMENT ON COLUMN public.org_tenants_mst.e_invoice_enabled_start_date IS
  'F-05/ADR-052: date from which e-invoicing is active for this tenant. Activation = is_e_invoice_enabled AND order_date >= this date. Required (CHECK) when enabled.';

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Verify the columns + constraint landed
-- ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols INTEGER;
  v_con  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'org_tenants_mst'
    AND column_name IN ('is_e_invoice_enabled', 'e_invoice_enabled_start_date');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION '❌ 0383: expected 2 e-invoice columns on org_tenants_mst, found %', v_cols;
  END IF;

  SELECT COUNT(*) INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.org_tenants_mst'::regclass
    AND conname = 'chk_org_tnt_einv_start';
  IF v_con <> 1 THEN
    RAISE EXCEPTION '❌ 0383: CHECK chk_org_tnt_einv_start is missing';
  END IF;

  RAISE NOTICE '✅ 0383: e-invoice tenant enablement columns + CHECK verified';
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK (run manually if needed)
-- ================================================================
-- ALTER TABLE public.org_tenants_mst DROP CONSTRAINT IF EXISTS chk_org_tnt_einv_start RESTRICT;
-- ALTER TABLE public.org_tenants_mst DROP COLUMN IF EXISTS e_invoice_enabled_start_date;
-- ALTER TABLE public.org_tenants_mst DROP COLUMN IF EXISTS is_e_invoice_enabled;