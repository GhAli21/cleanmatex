-- ============================================================
-- Migration: 0590_order_created_pos_session.sql
-- Purpose:   Record which open POS session created an order, so a shift
--            can count the orders opened in it. Payment and refund
--            sessions stay on their own rows.
-- Affected:  org_orders_mst, fn_ord_crt_pos_freeze, trg_ord_crt_pos_freeze
-- Related:   0397 (POS session identity), 0398 (finance-line session links)
-- ============================================================

-- Nullable on purpose: phone, portal, and back-office orders have no POS session.
-- Set once at insert. Later payments must not move the order to another session.
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS created_pos_session_id UUID;

COMMENT ON COLUMN public.org_orders_mst.created_pos_session_id IS
  'POS session that was open for this user and branch when the order row was created. NULL when the order was not created inside an open POS session. Immutable once set; payments and refunds keep their own pos_session_id.';

-- Parent unique is (tenant_org_id, id) on org_pos_sessions_mst (uq_ops_tenant_id).
-- The child FK uses that same column order. RESTRICT keeps a session that still
-- explains created orders; the session row is not deleted to detach history.
ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS fk_ord_crt_pos_ses;

ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT fk_ord_crt_pos_ses
  FOREIGN KEY (tenant_org_id, created_pos_session_id)
  REFERENCES public.org_pos_sessions_mst (tenant_org_id, id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_ord_crt_pos_ses ON public.org_orders_mst IS
  'Created-in session must be a POS session of the same tenant. RESTRICT blocks deleting that session while orders still point at it.';

-- Session statistics: orders opened in one session, tenant-scoped.
CREATE INDEX IF NOT EXISTS idx_ord_crt_pos_ses
  ON public.org_orders_mst (tenant_org_id, created_pos_session_id)
  WHERE created_pos_session_id IS NOT NULL;

COMMENT ON INDEX public.idx_ord_crt_pos_ses IS
  'Counts and sums orders created in one POS session. Partial so orders with no creating session are not indexed.';

-- Freezes the column after the first non-null value. A later edit, split, or
-- payment must not retarget the order at a different shift.
CREATE OR REPLACE FUNCTION public.fn_ord_crt_pos_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.created_pos_session_id IS NOT NULL
     AND NEW.created_pos_session_id IS DISTINCT FROM OLD.created_pos_session_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'created_pos_session_id is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_ord_crt_pos_freeze() IS
  'BEFORE UPDATE guard. Allows the one-time NULL to session assignment and rejects any later change of org_orders_mst.created_pos_session_id.';

-- Trigger-only. Not an RPC.
REVOKE ALL ON FUNCTION public.fn_ord_crt_pos_freeze()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_ord_crt_pos_freeze ON public.org_orders_mst;
CREATE TRIGGER trg_ord_crt_pos_freeze
  BEFORE UPDATE OF created_pos_session_id ON public.org_orders_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ord_crt_pos_freeze();

COMMENT ON TRIGGER trg_ord_crt_pos_freeze ON public.org_orders_mst IS
  'Keeps the creating POS session fixed after it is first stored.';
