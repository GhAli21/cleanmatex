-- Migration 0256: Harden finance voucher lifecycle constraints
-- Uses existing finance voucher catalog tables for category/subtype integrity.
-- Existing rows are not backfilled here; NOT VALID avoids deployment failure
-- if legacy rows contain unexpected values while still documenting the target contract.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_fin_voucher_status'
      AND conrelid = 'public.org_fin_vouchers_mst'::regclass
  ) THEN
    ALTER TABLE public.org_fin_vouchers_mst
      ADD CONSTRAINT chk_fin_voucher_status
      CHECK (status IN ('draft', 'issued', 'voided')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.org_fin_vouchers_mst
  DROP CONSTRAINT IF EXISTS chk_fin_voucher_category;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_fin_vsub_code_cat'
      AND conrelid = 'public.sys_fin_voucher_subtype_cd'::regclass
  ) THEN
    ALTER TABLE public.sys_fin_voucher_subtype_cd
      ADD CONSTRAINT uq_fin_vsub_code_cat
      UNIQUE (code, voucher_category_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fin_vch_cat'
      AND conrelid = 'public.org_fin_vouchers_mst'::regclass
  ) THEN
    ALTER TABLE public.org_fin_vouchers_mst
      ADD CONSTRAINT fk_fin_vch_cat
      FOREIGN KEY (voucher_category)
      REFERENCES public.sys_fin_voucher_category_cd(code)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fin_vch_sub_cat'
      AND conrelid = 'public.org_fin_vouchers_mst'::regclass
  ) THEN
    ALTER TABLE public.org_fin_vouchers_mst
      ADD CONSTRAINT fk_fin_vch_sub_cat
      FOREIGN KEY (voucher_subtype, voucher_category)
      REFERENCES public.sys_fin_voucher_subtype_cd(code, voucher_category_code)
      ON UPDATE NO ACTION
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

COMMENT ON CONSTRAINT chk_fin_voucher_status ON public.org_fin_vouchers_mst IS
  'Voucher lifecycle status guard for draft/issued/voided states.';
COMMENT ON CONSTRAINT fk_fin_vch_cat ON public.org_fin_vouchers_mst IS
  'Ensures voucher_category exists in sys_fin_voucher_category_cd.';
COMMENT ON CONSTRAINT fk_fin_vch_sub_cat ON public.org_fin_vouchers_mst IS
  'Ensures voucher_subtype exists and belongs to voucher_category.';
