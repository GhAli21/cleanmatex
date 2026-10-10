-- ============================================================
-- Migration: 0600_cash_drawer_session_user.sql
-- Purpose:   Optional cashier a drawer session is opened for. A later POS
--            connect fills it when the opener left it empty.
-- Affected:  org_cash_drawer_sessions_mst.session_user_id,
--            fk_ocds_session_user, idx_ocds_sess_user
-- Related:   org_users_mst UNIQUE (user_id, tenant_org_id)
-- ============================================================

-- NULL means "not chosen at open". Connecting a POS session writes the POS
-- session's user here. opened_by stays the person who pressed Open.
ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD COLUMN IF NOT EXISTS session_user_id UUID;

COMMENT ON COLUMN public.org_cash_drawer_sessions_mst.session_user_id IS
  'Cashier this drawer session is for. NULL until chosen at open or filled when a POS session connects. Distinct from opened_by, who performed the open.';

-- Parent unique is (user_id, tenant_org_id). The child FK uses that same order.
-- RESTRICT keeps the membership row while a drawer session still names that user.
ALTER TABLE public.org_cash_drawer_sessions_mst
  DROP CONSTRAINT IF EXISTS fk_ocds_session_user;

ALTER TABLE public.org_cash_drawer_sessions_mst
  ADD CONSTRAINT fk_ocds_session_user
  FOREIGN KEY (session_user_id, tenant_org_id)
  REFERENCES public.org_users_mst (user_id, tenant_org_id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_ocds_session_user ON public.org_cash_drawer_sessions_mst IS
  'Session user must be a member of the same tenant. RESTRICT blocks deleting that membership while a drawer session still names them.';

-- Lookup of open sessions assigned to one cashier, tenant first.
CREATE INDEX IF NOT EXISTS idx_ocds_sess_user
  ON public.org_cash_drawer_sessions_mst (tenant_org_id, session_user_id)
  WHERE session_user_id IS NOT NULL;

COMMENT ON INDEX public.idx_ocds_sess_user IS
  'Finds drawer sessions assigned to one user. Partial so unassigned sessions are not indexed.';
