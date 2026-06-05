-- =============================================================================
-- 0336_order_fin_tax_base_decomposition.sql
-- =============================================================================
-- Purpose
--   Add the four canonical tax-base decomposition columns to
--   public.org_orders_mst as required by Order Fin v1.1 §8.11:
--
--     non_taxable_amount   — taxed at 0% by policy (e.g. fee not in tax base)
--     exempt_amount        — items legally exempt from tax
--     zero_rated_amount    — taxed at 0% rate but reportable as zero-rated
--     out_of_scope_amount  — supplies outside VAT/GST scope (foreign, B2B etc.)
--
--   These four columns sit alongside the existing taxable_amount column and
--   together describe how the order's commercial base splits across tax
--   treatments for jurisdiction-grade reporting (ZATCA / UAE / Oman VAT).
--
-- Plan reference
--   docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md
--   §Phase 2 — Tax-Base Decomposition Columns
--
-- Why no bucket-sum CHECK constraint yet
--   The current tax engine only emits taxable_amount and never classifies
--   items into the four buckets. Until Phase 5 (TAX_INCLUSIVE / pricing
--   modes) and future tax-engine work populate real bucket values, every
--   existing row will have non_taxable / exempt / zero_rated / out_of_scope
--   all equal to zero. A strict
--     taxable_amount + non_taxable_amount + exempt_amount
--       + zero_rated_amount + out_of_scope_amount
--       = items_base_amount + total_charges_amount - total_discount_amount
--   constraint would either reject every legacy row or require a global
--   backfill we cannot honestly perform today. The reconciliation check
--   RECON_TAX_BASE_BUCKETS_SUM will be added in the same phase to surface
--   drift without blocking writes.
--
-- Rollout
--   - Create-only for review. Do NOT run automatically.
--   - Safe re-run via ADD COLUMN IF NOT EXISTS.
--   - Default 0 means existing rows are populated immediately on apply.
--   - RLS on org_orders_mst is unchanged (table already tenant-isolated).
-- =============================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS non_taxable_amount   DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exempt_amount        DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zero_rated_amount    DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS out_of_scope_amount  DECIMAL(19,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_orders_mst.non_taxable_amount IS
  'Tax-base decomposition: portion of the commercial base that is non-taxable by tenant policy (e.g. tips, certain fees not in tax base). See Order Fin v1.1 §8.11.';
COMMENT ON COLUMN public.org_orders_mst.exempt_amount IS
  'Tax-base decomposition: portion of the commercial base that is legally exempt from tax in the jurisdiction. See Order Fin v1.1 §8.11.';
COMMENT ON COLUMN public.org_orders_mst.zero_rated_amount IS
  'Tax-base decomposition: portion of the commercial base subject to a 0% tax rate that must still be reported as zero-rated (distinct from non-taxable / exempt). See Order Fin v1.1 §8.11.';
COMMENT ON COLUMN public.org_orders_mst.out_of_scope_amount IS
  'Tax-base decomposition: portion of the commercial base outside the scope of the local VAT/GST regime (e.g. foreign supply, certain B2B). See Order Fin v1.1 §8.11.';

COMMIT;

-- -----------------------------------------------------------------------------
-- Rollback notes
-- -----------------------------------------------------------------------------
-- These columns are additive, default-zero, with no CHECK constraints and no
-- FKs pointing at them. Reversal is a single ALTER TABLE per column. RESTRICT
-- only (no CASCADE) per project policy:
--
--   ALTER TABLE public.org_orders_mst
--     DROP COLUMN IF EXISTS non_taxable_amount   RESTRICT,
--     DROP COLUMN IF EXISTS exempt_amount        RESTRICT,
--     DROP COLUMN IF EXISTS zero_rated_amount    RESTRICT,
--     DROP COLUMN IF EXISTS out_of_scope_amount  RESTRICT;
--
-- Before rolling back, ensure no application code reads these columns
-- (search for the four column names in web-admin/lib and web-admin/src).
-- =============================================================================
