-- Tie an order edit lock to the login that opened it.
-- Sign-out deletes that auth.sessions row. The lock must leave with it,
-- including when another device of the same user is still signed in.
-- Rows opened before this column stay null and are released when that user
-- has no remaining active login in the organization.

BEGIN;

ALTER TABLE public.org_order_edit_locks
  ADD COLUMN auth_session_id UUID;

COMMENT ON COLUMN public.org_order_edit_locks.auth_session_id IS
  'Supabase auth.sessions id of the login that holds this edit lock. Null on rows opened before the column existed. Sign-out deletes that session and this lock follows.';

ALTER TABLE public.org_order_edit_locks
  ADD CONSTRAINT fk_ord_edit_lk_auth_sess
  FOREIGN KEY (auth_session_id)
  REFERENCES auth.sessions (id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_ord_edit_lk_auth_sess ON public.org_order_edit_locks IS
  'Deletes the edit lock when its login session is destroyed. Other devices keep their own sessions and locks.';

CREATE INDEX idx_ord_edit_lk_auth_sess
  ON public.org_order_edit_locks (tenant_org_id, locked_by, auth_session_id);

COMMENT ON INDEX public.idx_ord_edit_lk_auth_sess IS
  'Finds one user''s locks for the login that is ending, inside one organization.';

COMMIT;
