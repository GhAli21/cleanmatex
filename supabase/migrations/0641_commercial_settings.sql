-- =============================================================================
-- 0641_commercial_settings.sql
-- Line-Level Money Snapshot — Phase 2, M3 (PLAN.md §5.3, §6.6, §12, §12.1,
-- owner decisions L10, L17, L21).
--
-- Why:
-- Adds the three remaining commercial settings columns to org_tenants_mst, so
-- every setting ADR-060 snapshots onto an order at creation (§5.3) already
-- exists: commercial_level, tax_pricing_mode and extra_price_pricing_mode
-- (both already columns here), disc_alloc_mode and disc_alloc_basis.
--
-- Columns:
--   commercial_level   ITEM (default) | PIECE (L11: available to every
--                       tenant, no flag, no plan gate). Tenant-only (L10):
--                       no branch override, snapshotted on the order and
--                       never changed by Edit (L12).
--   disc_alloc_mode     How an ORDER-level discount is spread across lines:
--                       ALLOCATE_TO_LINES (proportional split, exact line
--                       tax, §8.4) or DOCUMENT_LEVEL (seeded; today's
--                       behaviour: a document allowance split by tax
--                       category only, §8.4). Tenant-only (L21).
--   disc_alloc_basis    Only meaningful under ALLOCATE_TO_LINES: the amount
--                       each line's share is proportional to.
--                       PROPORTIONAL_NET (default; proportional to each
--                       line's net amount after its own line discounts, the
--                       basis §8.4 already describes for ALLOCATE_TO_LINES)
--                       or PROPORTIONAL_GROSS (proportional to each line's
--                       gross amount before line discounts). Tenant-only,
--                       same as disc_alloc_mode -- not one of the "two
--                       existing modes" (tax_pricing_mode /
--                       extra_price_pricing_mode) that keep a branch
--                       override under L18 / ADR-060 §8.
--
-- tax_pricing_mode and extra_price_pricing_mode already exist on
-- org_tenants_mst (and org_branches_mst for the branch override) from an
-- earlier feature; this migration does not touch them. HQ becoming their
-- single writer (L18, §10.3) is an application-layer change (P7-05), not a
-- schema change, so it is not part of this migration either.
--
-- Seed (L17): ITEM / DOCUMENT_LEVEL / PROPORTIONAL_NET on every existing
-- tenant, added as the column default so new tenants get it too. This
-- reproduces today's behaviour exactly: every tenant prices at item level,
-- and an order discount today is a document-level allowance, never split to
-- lines.
--
-- Rollback (forward-only): ALTER TABLE org_tenants_mst DROP COLUMN
-- commercial_level, disc_alloc_mode, disc_alloc_basis RESTRICT (no
-- dependents yet; org_orders_mst does not snapshot them until M6).
--
-- NOT APPLIED BY THE ASSISTANT — for owner review and apply (CLAUDE.md rule 3).
-- =============================================================================

BEGIN;

ALTER TABLE public.org_tenants_mst
  ADD COLUMN IF NOT EXISTS commercial_level TEXT NOT NULL DEFAULT 'ITEM',
  ADD COLUMN IF NOT EXISTS disc_alloc_mode   TEXT NOT NULL DEFAULT 'DOCUMENT_LEVEL',
  ADD COLUMN IF NOT EXISTS disc_alloc_basis  TEXT NOT NULL DEFAULT 'PROPORTIONAL_NET';

ALTER TABLE public.org_tenants_mst
  ADD CONSTRAINT chk_org_tnt_commercial_level
    CHECK (commercial_level IN ('ITEM', 'PIECE')),
  ADD CONSTRAINT chk_org_tnt_disc_alloc_mode
    CHECK (disc_alloc_mode IN ('ALLOCATE_TO_LINES', 'DOCUMENT_LEVEL')),
  ADD CONSTRAINT chk_org_tnt_disc_alloc_basis
    CHECK (disc_alloc_basis IN ('PROPORTIONAL_NET', 'PROPORTIONAL_GROSS'));

COMMENT ON COLUMN public.org_tenants_mst.commercial_level IS
  'Line-Level Money Snapshot (ADR-060, L10/L11/L12): ITEM or PIECE. Decides which of an item''s and its pieces'' money rows is PRICED vs ALLOCATED/ROLLUP (PLAN.md §5.1). Tenant-only (no branch override). Snapshotted on org_orders_mst.commercial_level at order creation (M6) and never changed by Edit.';
COMMENT ON COLUMN public.org_tenants_mst.disc_alloc_mode IS
  'Line-Level Money Snapshot (PLAN.md §8.4, L21): how an ORDER-level discount is spread across lines. ALLOCATE_TO_LINES = proportional split with exact line tax. DOCUMENT_LEVEL (seeded default, today''s behaviour) = a document allowance split by tax category only. Tenant-only. Snapshotted on org_orders_mst.disc_alloc_mode at order creation (M6).';
COMMENT ON COLUMN public.org_tenants_mst.disc_alloc_basis IS
  'Line-Level Money Snapshot (PLAN.md §6.6): under ALLOCATE_TO_LINES, the amount each line''s discount share is proportional to -- PROPORTIONAL_NET (seeded default: each line''s net after its own line discounts) or PROPORTIONAL_GROSS (each line''s gross before line discounts). Ignored under DOCUMENT_LEVEL. Tenant-only.';

COMMIT;
