-- ==================================================================
-- Migration: 0378_overpay_disp_resolution_fk.sql
-- Purpose : Fix the SAVE_TO_CUSTOMER_WALLET overpayment-disposition
--           blocker at the ROOT, by removing catalog drift instead of
--           hardcoding another value into the CHECK constraint.
--
--           Replace the hardcoded value CHECK on
--           org_fin_overpay_disp_dtl.resolution_code
--               CONSTRAINT org_fin_overpay_disp_res_chk
--           with a FOREIGN KEY to the catalog
--               sys_fin_overpay_res_cd(resolution_code)
--               CONSTRAINT org_fin_overpay_disp_res_fk (27 chars)
--
--           After this migration, ANY resolution code seeded into the
--           catalog (now or later) is automatically valid for the audit
--           table — no future migration needs to touch a CHECK list, and
--           catalog ↔ audit drift becomes structurally impossible.
--
-- Context : Validation report 2026-06-18
--           docs/features/Order_Fin/Order_Financial_Validation_Report_2026-06-18.md
--           ADR-047 (Overpayment Disposition), ADR-050 (Save-to-Wallet).
--           Catalog row SAVE_TO_CUSTOMER_WALLET was added in 0368 but the
--           CHECK (mig 0354; gated re-create in 0360) never listed it, so
--           overpayment-disposition.service.ts rolled back the whole submit.
--
-- Pre-apply discovery (read-only, run against local DB 2026-06-18):
--   * orphan preview (resolution_code not in catalog) ............ 0 rows
--   * sys_fin_overpay_res_cd has all 9 required codes ............ confirmed
--   * sys_fin_overpay_res_cd PK = (resolution_code) ............... confirmed
--   * live CHECK to drop = org_fin_overpay_disp_res_chk (8 codes) . confirmed
--   * amount CHECK (kept) = org_order_overpay_disp_dtl_amt_chk .... untouched
--
-- Safety  : RESTRICT only (no CASCADE). Idempotent / re-runnable.
--           Guards ABORT with a clear message if catalog rows are missing
--           or any existing audit row has an unknown code — they never
--           auto-update or delete data.
--
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Step 1 — Ensure every required catalog code exists (FK target set).
--   Self-contained safety net: SAVE_TO_CUSTOMER_WALLET normally arrives
--   via 0368; re-seeded here idempotently so 0378 is correct even if
--   applied on a DB where 0368 was skipped. Existing rows are untouched.
-- ------------------------------------------------------------------
INSERT INTO public.sys_fin_overpay_res_cd (
  resolution_code, name, name2, description, description2,
  allowed_for_cash, allowed_for_card, allowed_for_gateway, allowed_for_bank,
  allowed_for_check, allowed_for_mobile, allowed_for_stored_value,
  requires_permission, permission_code, display_order, metadata
) VALUES (
  'SAVE_TO_CUSTOMER_WALLET',
  'Save to Customer Wallet',
  'حفظ في محفظة العميل',
  'Credit checkout excess to customer wallet balance for future payments.',
  'إيداع فائض الدفع في رصيد محفظة العميل للمدفوعات المستقبلية.',
  true, true, true, true, true, true, true,
  true, 'orders:overpayment_to_wallet', 45, '{"creates_wallet_topup": true}'::jsonb
)
ON CONFLICT (resolution_code) DO NOTHING;

-- Guard 1: all 9 codes the disposition/allocation services emit must exist
-- in the catalog before we depend on it via FK. Abort (no mutation) if not.
DO $guard_catalog$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(req.code, ', ' ORDER BY req.code)
    INTO v_missing
  FROM (VALUES
    ('REDUCE_PAYMENT'),
    ('RETURN_CASH_CHANGE'),
    ('VOID_OR_REFUND_EXCESS'),
    ('SAVE_AS_CUSTOMER_ADVANCE'),
    ('SAVE_TO_CUSTOMER_WALLET'),
    ('SAVE_AS_CUSTOMER_CREDIT'),
    ('RESTORE_STORED_VALUE'),
    ('ALLOCATE_TO_CUSTOMER_BALANCES'),
    ('AUTO_ALLOCATE_TO_CUSTOMER_BALANCES')
  ) AS req(code)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sys_fin_overpay_res_cd c
    WHERE c.resolution_code = req.code
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      '0378 aborted: sys_fin_overpay_res_cd is missing required code(s): %. Seed them (see 0357/0368) before re-running.',
      v_missing;
  END IF;
END
$guard_catalog$;

-- ------------------------------------------------------------------
-- Step 2 — Orphan guard (the user's preview, enforced).
--   Pre-apply read-only preview returned 0 rows. This block re-checks at
--   apply time and ABORTS with the offending codes rather than silently
--   updating/deleting them. If it raises, resolve the codes (seed the
--   catalog or correct the rows with approval) and re-run.
-- ------------------------------------------------------------------
DO $guard_orphans$
DECLARE
  v_orphans text;
BEGIN
  SELECT string_agg(DISTINCT d.resolution_code, ', ')
    INTO v_orphans
  FROM public.org_fin_overpay_disp_dtl d
  LEFT JOIN public.sys_fin_overpay_res_cd c
    ON c.resolution_code = d.resolution_code
  WHERE c.resolution_code IS NULL;

  IF v_orphans IS NOT NULL THEN
    RAISE EXCEPTION
      '0378 aborted: org_fin_overpay_disp_dtl has resolution_code value(s) not in catalog: %. Resolve before adding the FK (no auto-update performed).',
      v_orphans;
  END IF;
END
$guard_orphans$;

-- ------------------------------------------------------------------
-- Step 3 — Drop the duplicated hardcoded catalog-value CHECK.
--   Only this constraint is removed. Business/numeric checks (amount > 0,
--   etc.) are intentionally left in place.
-- ------------------------------------------------------------------
ALTER TABLE public.org_fin_overpay_disp_dtl
  DROP CONSTRAINT IF EXISTS org_fin_overpay_disp_res_chk RESTRICT;

-- ------------------------------------------------------------------
-- Step 4 — Add the FK to the catalog (NOT VALID then VALIDATE).
--   ON UPDATE RESTRICT / ON DELETE RESTRICT: catalog codes are stable
--   business identifiers already referenced by financial audit rows —
--   they must not be renamed or deleted out from under those rows.
--   Wrapped in a guard so the migration is re-runnable.
-- ------------------------------------------------------------------
DO $add_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_fin_overpay_disp_res_fk'
      AND conrelid = 'public.org_fin_overpay_disp_dtl'::regclass
  ) THEN
    ALTER TABLE public.org_fin_overpay_disp_dtl
      ADD CONSTRAINT org_fin_overpay_disp_res_fk
      FOREIGN KEY (resolution_code)
      REFERENCES public.sys_fin_overpay_res_cd (resolution_code)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT
      NOT VALID;

    ALTER TABLE public.org_fin_overpay_disp_dtl
      VALIDATE CONSTRAINT org_fin_overpay_disp_res_fk;

    RAISE NOTICE '0378: org_fin_overpay_disp_res_fk added and validated.';
  ELSE
    RAISE NOTICE '0378: org_fin_overpay_disp_res_fk already present — skipped.';
  END IF;
END
$add_fk$;

COMMENT ON CONSTRAINT org_fin_overpay_disp_res_fk ON public.org_fin_overpay_disp_dtl IS
  'resolution_code must exist in sys_fin_overpay_res_cd. Replaced the hardcoded CHECK org_fin_overpay_disp_res_chk (mig 0378) to end catalog/audit drift. ON UPDATE/DELETE RESTRICT.';

COMMIT;

-- ------------------------------------------------------------------
-- Rollback notes (RESTRICT only — no CASCADE):
--   BEGIN;
--     ALTER TABLE public.org_fin_overpay_disp_dtl
--       DROP CONSTRAINT IF EXISTS org_fin_overpay_disp_res_fk RESTRICT;
--     -- (Optional) restore the prior hardcoded CHECK if reverting fully:
--     -- ALTER TABLE public.org_fin_overpay_disp_dtl
--     --   ADD CONSTRAINT org_fin_overpay_disp_res_chk
--     --   CHECK (resolution_code IN (
--     --     'REDUCE_PAYMENT','RETURN_CASH_CHANGE','VOID_OR_REFUND_EXCESS',
--     --     'SAVE_AS_CUSTOMER_ADVANCE','SAVE_AS_CUSTOMER_CREDIT','RESTORE_STORED_VALUE',
--     --     'ALLOCATE_TO_CUSTOMER_BALANCES','AUTO_ALLOCATE_TO_CUSTOMER_BALANCES'));
--   COMMIT;
-- ==================================================================