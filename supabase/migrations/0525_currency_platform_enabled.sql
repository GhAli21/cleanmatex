-- =============================================================================
-- 0525_currency_platform_enabled.sql
-- (originally authored as 0524; shifted to 0525 when 0523_currency_fk_phase_a
-- was renumbered to 0524 after a filename collision — see
-- cleanmatex/docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/
-- STATUS.md. This file never ran — safe to apply normally.
-- Currency Setup Phase 3, task 3.5 (plan 02 decision 1, open decisions D4/D8).
--
-- Adds a third, independent flag to sys_currency_cd: is_platform_enabled.
-- Distinct from is_system (ISO row, seeded once, never deletable) and
-- is_active (soft-delete / row lifecycle). Today every one of the 181 seeded
-- rows is is_active = TRUE and is_system = TRUE — a boolean that's true for
-- every row carries no information (progress_status.md finding A1), which is
-- why the tenant-facing "active currencies" endpoint currently returns all
-- 181 regardless of whether a currency is actually ready to be handed to a
-- tenant (real rounding rules + denominations seeded, per migrations
-- 0520-0522) or just present because it's part of the base ISO 4217 catalog.
--
-- Seeded TRUE only for the 7 currencies with complete Phase-2 rounding-rule +
-- denomination data (OMR, KWD, BHD, AED, QAR, SAR, USD) — the platform's own
-- genuinely-ready set, not a blanket default. This is exactly the lever the
-- owner's "add EUR when we get a European customer" scenario describes: EUR
-- (and every other of the 174 remaining ISO currencies) stays
-- is_platform_enabled = FALSE until /manage-currency-setup-hq completes its
-- rounding + denomination data and this flag is explicitly flipped — via the
-- currency-setup admin UI (PUT /currency-setup/:code), not a new migration.
--
-- Reversal (forward-only): a future migration would
-- ALTER TABLE sys_currency_cd DROP COLUMN is_platform_enabled RESTRICT.
-- Lossy only for whatever the admin UI has since toggled beyond this seed.
-- =============================================================================

BEGIN;

ALTER TABLE public.sys_currency_cd
  ADD COLUMN IF NOT EXISTS is_platform_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.sys_currency_cd.is_platform_enabled IS
  'Whether this currency is offered to tenants (dropdowns, new-tenant setup) — independent of is_system (ISO row, never deletable) and is_active (soft-delete). FALSE by default; flip explicitly once a currency''s rounding rules + denominations are complete (see /manage-currency-setup-hq).';

UPDATE public.sys_currency_cd
   SET is_platform_enabled = TRUE
 WHERE code IN ('OMR', 'KWD', 'BHD', 'AED', 'QAR', 'SAR', 'USD');

COMMIT;
