-- =============================================================================
-- 0407_b16_drawer_variance_approval.sql
-- =============================================================================
-- B16 — Cash Drawer Filtering and Variance Approval.
--
-- Additive, non-destructive schema for the variance-approval close flow. The
-- expected-cash FILTER fix (active + COMPLETED-set + cash-family) is code-only
-- and needs no migration; this migration only adds the columns the approval
-- workflow persists, plus a per-drawer variance threshold.
--
-- Behaviour is inert until the tenant flag `order_fin_drawer_close_v2` is on and
-- the (B27-owned) `cash_drawer:approve_variance` permission is seeded/granted;
-- until then these columns stay NULL and nothing reads them.
--
-- Authoritative report: M2 / §40 / §50-B16 · Decision: D001 (status sets).
-- Rules: additive-only, TEXT not VARCHAR, money DECIMAL(19,4), all names <= 30
-- chars, no data backfill, no destructive change.
-- =============================================================================

-- ── org_cash_drawer_sessions_mst: variance-approval audit columns ────────────
-- Populated only when a close exceeds the configured variance threshold and a
-- second actor (approver) authorises it with a mandatory reason. The threshold
-- snapshot records the value in effect at close time so historical closes stay
-- explainable if the drawer's threshold later changes.
ALTER TABLE org_cash_drawer_sessions_mst
  ADD COLUMN IF NOT EXISTS variance_approved_by        uuid,
  ADD COLUMN IF NOT EXISTS variance_approved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS variance_approval_reason    text,
  ADD COLUMN IF NOT EXISTS variance_threshold_snapshot numeric(19,4);

COMMENT ON COLUMN org_cash_drawer_sessions_mst.variance_approved_by IS
  'B16: actor (user id) who approved an over-threshold close variance; must differ from closed_by (maker != checker). NULL when no approval was required.';
COMMENT ON COLUMN org_cash_drawer_sessions_mst.variance_approved_at IS
  'B16: timestamp the variance approval was recorded. NULL when no approval was required.';
COMMENT ON COLUMN org_cash_drawer_sessions_mst.variance_approval_reason IS
  'B16: mandatory free-text reason captured with an over-threshold variance approval. NULL when no approval was required.';
COMMENT ON COLUMN org_cash_drawer_sessions_mst.variance_threshold_snapshot IS
  'B16: absolute variance threshold (DECIMAL 19,4) in effect at close time, snapshotted for audit; drives whether approval was required.';

-- ── org_cash_drawers_mst: per-drawer variance threshold ──────────────────────
-- Optional per-drawer override of the tenant/default absolute variance
-- threshold. NULL means "inherit the tenant default" (resolved in code); a
-- value means |counted - expected| above it requires approval to close.
ALTER TABLE org_cash_drawers_mst
  ADD COLUMN IF NOT EXISTS variance_approval_threshold numeric(19,4);

COMMENT ON COLUMN org_cash_drawers_mst.variance_approval_threshold IS
  'B16: absolute cash variance threshold (DECIMAL 19,4) above which drawer close requires approval. NULL = inherit tenant default.';
