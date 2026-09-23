-- =============================================================================
-- Migration 0519 — Rename + harden the cash-drawer session number generator
-- (Wave A, package A1 of
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md)
--
-- Numbering note: the plan text calls this "migration 0517", written before
-- 0517 was consumed by the cash-drawer/pos-session/cash-control permissions
-- seed (Wave 0). STATUS.md's wave table is authoritative on the actual
-- sequence; this migration is the real A1-1.
--
-- Renamed public.generate_session_no() -> public.generate_cash_drawer_sess_no()
-- on request, so the name doesn't read as a generic "session" generator next
-- to the unrelated POS-session numbering scheme (`sessionNoForDate` in
-- pos-session.service.ts, format POS-YYYYMMDD-<8 hex>, a different function
-- entirely, not touched here). The literal `generate_cash_drawer_session_no`
-- is 31 characters — 1 over this repo's 30-char object-name limit — so
-- `session` is abbreviated to the already-established `sess` (see
-- `idx_org_cds_*` elsewhere in this table's own indexes).
--
-- Two independent defects found in the function (created in 0270 as
-- generate_session_no, never wired to application code until this package):
--
-- 1. (The defect the plan named) No locking. Two concurrent callers compute
--    the same MAX(...)+1 and race to insert, colliding on
--    uq_org_cash_drawer_sessions_no.
--
-- 2. (Found while fixing #1 — not previously documented) The parser is
--    off by one character. The prefix 'SES-YYYYMMDD-' is 13 characters
--    (SES- = 4, YYYYMMDD = 8, trailing - = 1), so the sequence digits start
--    at character 14, not 13. `SUBSTRING(session_no FROM 13)` therefore
--    includes the trailing dash, e.g. session_no 'SES-20260101-0007' yields
--    the substring '-0007', which Postgres parses as the integer -7 (a
--    leading '-' is a valid sign in an integer literal). Once two or more
--    sessions exist for the same tenant+day, MAX() over a set of negative
--    numbers stops advancing in the way the function's author intended:
--    the THIRD session opened on any given day recomputes the SAME
--    sequence value as the first, colliding again on
--    uq_org_cash_drawer_sessions_no every single day. This is strictly
--    worse than defect #1 (a rare race) — it is a guaranteed collision on
--    ordinary daily use. It never manifested because this function was
--    dead code until this package wires it up.
--    Fix: read from character 14.
--
-- Two application call sites found and fixed to call the renamed, locked
-- function from *inside* their own insert transaction (an advisory xact
-- lock taken outside the transaction that does the insert offers no
-- protection at all — it releases before the row is written):
--   - lib/services/cash-drawer.service.ts openSession()
--   - app/actions/payment-config/cash-drawers-actions.ts openDrawerSession()
--     (found while making this change — a second, independent "open a cash
--     drawer session" implementation with the exact same defect. Not
--     consolidated with openSession() here; that is a separate, larger
--     duplication question, out of scope for A1.)
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would DROP FUNCTION generate_cash_drawer_sess_no RESTRICT
-- and CREATE OR REPLACE the original generate_session_no body. Not
-- meaningfully lossy — reverting reintroduces all defects above, so only do
-- this if both call sites above are reverted in the same migration.
-- =============================================================================

BEGIN;

-- Dead as of this migration: both real callers below are updated to the new
-- name in this same change set. Safe to drop outright (RESTRICT — nothing
-- else references it; confirmed by repo-wide search before this migration
-- was written).
DROP FUNCTION IF EXISTS public.generate_session_no(UUID) RESTRICT;

CREATE FUNCTION public.generate_cash_drawer_sess_no(p_tenant_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Serialize concurrent callers for this (tenant, business date) so two
  -- simultaneous opens can never read the same MAX(...) and compute the
  -- same +1 sequence. This is a transaction-scoped advisory lock: the
  -- caller MUST invoke this function inside the same transaction as the
  -- session INSERT or the lock releases before the insert commits and
  -- offers no protection.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_org_id::text || v_date));

  -- Sequence digits start at character 14 — see header note #2. Was 13.
  SELECT COALESCE(MAX(CAST(SUBSTRING(session_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.org_cash_drawer_sessions_mst
   WHERE tenant_org_id = p_tenant_org_id
     AND session_no LIKE 'SES-' || v_date || '-%';

  RETURN 'SES-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_cash_drawer_sess_no(UUID) IS
  'Cash drawer session number generator: SES-YYYYMMDD-NNNN, sequence reset daily per tenant. Renamed from generate_session_no (migration 0519) so it does not read as a generic session generator next to the unrelated POS-session numbering scheme. Takes a transaction-scoped advisory lock on hashtext(tenant || date) — MUST be called inside the same transaction as the session INSERT. Callers: lib/services/cash-drawer.service.ts openSession(), app/actions/payment-config/cash-drawers-actions.ts openDrawerSession(). Fixed 2026-09-23 (migration 0519): substring parse position (13 -> 14) and missing lock — see migration header for the daily-collision defect this closes.';

COMMIT;
