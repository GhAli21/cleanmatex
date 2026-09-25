-- =============================================================================
-- Migration 0528 — CLF M5: drawer policy settings in the cash-control table
-- Package CLF (Cash Ledger Foundation), release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.3.7
--
-- What this migration does
--   1. Adds three nullable policy columns to org_fin_cash_ctrl_stng_cf
--      (NULL = inherit): requires_session, opening_count_required,
--      closing_count_required. Resolution becomes DRAWER → USER → BRANCH →
--      TENANT → drawer-type default (sys_cash_drawer_type_cd.*_default) →
--      constant default.
--   2. Carries over deliberately-configured drawer values from the old drawer
--      columns into DRAWER-scope setting rows, with audit rows.
--   3. Marks the old drawer columns and cash_drop_requires_dest as deprecated.
--      They are DROPPED later in CLF M10 (retirement), after the application
--      has stopped reading them — dropping them here would break the running app.
--
-- Carry-over rule. The old drawer flags were stored but never enforced, and most
-- rows hold the old column default (TRUE). A value is carried over only when it
-- was deliberately changed (differs from the old default TRUE) AND differs from
-- the new type default. Everywhere else the owner-approved type defaults apply
-- (counts optional; driver bags need no session). opening_float_required maps to
-- opening_count_required (same intent under the ledger model: the opening must
-- be counted). Remote data on 2026-09-25: 2 COUNTER drawers with
-- requires_session = FALSE → 2 DRAWER rows; nothing else qualifies.
--
-- Reversal (forward migration):
--   DELETE FROM org_fin_cash_ctrl_audit_dtl WHERE created_by = 'migration_0528';
--   DELETE FROM org_fin_cash_ctrl_stng_cf WHERE created_by = 'migration_0528';
--     (only rows this migration created; a row that later received other
--      overrides must be cleared column-by-column instead)
--   ALTER TABLE org_fin_cash_ctrl_stng_cf DROP COLUMN requires_session,
--     DROP COLUMN opening_count_required, DROP COLUMN closing_count_required;
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. New policy columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_fin_cash_ctrl_stng_cf
  ADD COLUMN IF NOT EXISTS requires_session        BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS opening_count_required  BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS closing_count_required  BOOLEAN NULL;

COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.requires_session IS
  'CLF: interactive cash on the drawer needs an open session. NULL = inherit (chain, then sys_cash_drawer_type_cd.requires_session_default). Replaces org_cash_drawers_mst.requires_session.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.opening_count_required IS
  'CLF: a count is required when a session opens. NULL = inherit (then type default; owner default: optional). Replaces org_cash_drawers_mst.opening_float_required.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.closing_count_required IS
  'CLF: a count is required at the close count step. NULL = inherit (then type default; owner default: optional). An uncounted close is flagged.';
COMMENT ON COLUMN public.org_fin_cash_ctrl_stng_cf.cash_drop_requires_dest IS
  'DEPRECATED by CLF (P11): every drawer transaction is two-legged by construction, so a destination is always required. No longer read; dropped in CLF M10.';

COMMENT ON COLUMN public.org_cash_drawers_mst.requires_session IS
  'DEPRECATED by CLF: moved to org_fin_cash_ctrl_stng_cf.requires_session (DRAWER scope). No longer authoritative; dropped in CLF M10.';
COMMENT ON COLUMN public.org_cash_drawers_mst.opening_float_required IS
  'DEPRECATED by CLF: moved to org_fin_cash_ctrl_stng_cf.opening_count_required (DRAWER scope). No longer authoritative; dropped in CLF M10.';

-- -----------------------------------------------------------------------------
-- 2. Carry deliberately-configured drawer values into DRAWER-scope settings
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE clf_0528_carry ON COMMIT DROP AS
SELECT d.tenant_org_id,
       d.id AS drawer_id,
       CASE WHEN d.requires_session IS DISTINCT FROM TRUE
             AND d.requires_session IS DISTINCT FROM t.requires_session_default
            THEN d.requires_session END AS requires_session,
       CASE WHEN d.opening_float_required IS DISTINCT FROM TRUE
             AND d.opening_float_required IS DISTINCT FROM t.opening_count_required_default
            THEN d.opening_float_required END AS opening_count_required
  FROM public.org_cash_drawers_mst d
  JOIN public.sys_cash_drawer_type_cd t ON t.code = d.drawer_type;

DELETE FROM clf_0528_carry WHERE requires_session IS NULL AND opening_count_required IS NULL;

INSERT INTO public.org_fin_cash_ctrl_stng_cf (
  tenant_org_id, scope_level, scope_id,
  requires_session, opening_count_required,
  created_by, created_info, rec_status, is_active
)
SELECT c.tenant_org_id, 'DRAWER', c.drawer_id,
       c.requires_session, c.opening_count_required,
       'migration_0528', 'CLF M5 carry-over from org_cash_drawers_mst', 1, TRUE
  FROM clf_0528_carry c
ON CONFLICT (tenant_org_id, scope_level, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::UUID))
DO UPDATE SET
  requires_session       = COALESCE(EXCLUDED.requires_session, org_fin_cash_ctrl_stng_cf.requires_session),
  opening_count_required = COALESCE(EXCLUDED.opening_count_required, org_fin_cash_ctrl_stng_cf.opening_count_required),
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'migration_0528';

INSERT INTO public.org_fin_cash_ctrl_audit_dtl (
  tenant_org_id, scope_level, scope_id, setting_column, audit_action,
  before_value_jsonb, after_value_jsonb, change_reason, created_by, rec_status, is_active
)
SELECT c.tenant_org_id, 'DRAWER', c.drawer_id, x.col, 'CREATE',
       NULL, to_jsonb(x.val),
       'CLF M5: carried over from the retired drawer column (deliberately configured value)',
       'migration_0528', 1, TRUE
  FROM clf_0528_carry c
  CROSS JOIN LATERAL (VALUES
    ('requires_session',       c.requires_session),
    ('opening_count_required', c.opening_count_required)
  ) AS x(col, val)
 WHERE x.val IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'org_fin_cash_ctrl_stng_cf'
         AND column_name IN ('requires_session', 'opening_count_required', 'closing_count_required')) <> 3 THEN
    RAISE EXCEPTION 'policy columns missing';
  END IF;

  -- Every carried value must now resolve at DRAWER scope.
  IF EXISTS (
    SELECT 1
      FROM public.org_cash_drawers_mst d
      JOIN public.sys_cash_drawer_type_cd t ON t.code = d.drawer_type
     WHERE d.requires_session IS DISTINCT FROM TRUE
       AND d.requires_session IS DISTINCT FROM t.requires_session_default
       AND NOT EXISTS (
         SELECT 1 FROM public.org_fin_cash_ctrl_stng_cf s
          WHERE s.tenant_org_id = d.tenant_org_id AND s.scope_level = 'DRAWER'
            AND s.scope_id = d.id AND s.requires_session = d.requires_session)
  ) THEN
    RAISE EXCEPTION 'requires_session carry-over incomplete';
  END IF;
END $$;

COMMIT;
