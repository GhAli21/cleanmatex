-- ==================================================================
-- Migration 0678_tenant_hard_delete_guard.sql
-- Human-Friendly Codes, P2.1 (risk 2: tenant hard delete), migration 2 of 2.
--
-- Purpose (user decision 2026-10-31: "hard delete of tenants should be blocked unless it is in creating stage only";
--          the stage itself is decision A-31, expert, flagged for review):
--   1. New tenant status value 'creating' (org_tenants_mst.status, VARCHAR(20), no CHECK list today). It marks a
--      tenant row that is still being provisioned by the self-signup flow (web-admin registerTenant), which flips it
--      to 'trial' when the subscription and the owner user exist.
--   2. trg_tenant_hard_delete_guard (BEFORE DELETE, per row): a tenant row can be hard-deleted only while
--      status = 'creating'. Anything else, NULL included, fails closed with TENANT_HARD_DELETE_BLOCKED
--      (SQLSTATE 55000). Use suspend / archive (soft) instead. When the delete is allowed, the tenant's
--      document counters (org_doc_seq_mst, FK RESTRICT) are removed first, so signup rollback works.
--   3. trg_tenant_truncate_guard (BEFORE TRUNCATE): TRUNCATE of org_tenants_mst is always refused.
--   4. trg_tenant_status_creating_guard (BEFORE UPDATE OF status): status can never be set TO 'creating' by an
--      UPDATE (TENANT_STATUS_CREATING_INSERT_ONLY), so an existing tenant cannot be re-flagged to unlock a delete.
--      Leaving 'creating' is free.
--
-- Escape hatch (data repair only, superuser / table owner, inside a reviewed script):
--   ALTER TABLE public.org_tenants_mst DISABLE TRIGGER trg_tenant_hard_delete_guard; ... ; ENABLE TRIGGER ...
-- Not covered (unchanged, business data with their own ON DELETE RESTRICT FKs): 0462, 0548, 0571, 0579, 0597, 0613.
--   They hold order-change, workflow-gate, edit-policy and notification rows that a tenant still in signup does not
--   normally have; if one exists the delete still fails on that FK (unchanged behaviour, fail closed).
--
-- Affected: org_tenants_mst (3 triggers, new status value, column comment), 3 new trigger functions.
--           No column change: Prisma model unchanged. HQ platform-api/platform-web know the new status value.
-- Related:  0669_doc_seq_counters (fk_org_doc_seq_tenant RESTRICT), web-admin lib/services/tenants.service.ts
--           (registerTenant), HQ platform-api modules/tenants (status changes, 409 mapping).
-- Plan:     IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.8.1; decision A-31.
-- APPLY ORDER: 2 of 2 in P2.1, independent of 0677. Deploy the P2.1 web-admin registerTenant with or after this
--              migration (the old code deletes counters itself and inserts 'trial': its rollback would now be
--              refused, so signup failures would leave the half-made tenant row; nothing else changes).
--              Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 16.
-- ROLLBACK PLAN (forward-only repo; write a new migration). No data changes, safe at any time:
--   DROP TRIGGER trg_tenant_hard_delete_guard ON public.org_tenants_mst;
--   DROP TRIGGER trg_tenant_truncate_guard ON public.org_tenants_mst;
--   DROP TRIGGER trg_tenant_status_creating_guard ON public.org_tenants_mst;
--   DROP FUNCTION public.fn_tenant_hard_delete_guard(); DROP FUNCTION public.fn_tenant_truncate_guard();
--   DROP FUNCTION public.fn_tenant_status_creating_guard();
--   UPDATE public.org_tenants_mst SET status = 'trial' WHERE status = 'creating';   (only if the code is rolled back)
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '10s';

COMMENT ON COLUMN public.org_tenants_mst.status IS
  'Tenant status: creating (being provisioned by self-signup; the only state in which the row may be hard-deleted, set only on INSERT), trial, active, suspended, cancelled, expired, archived. Hard delete is guarded by trg_tenant_hard_delete_guard; use suspend/archive for live tenants.';

-- ------------------------------------------------------------------
-- 1. BEFORE DELETE: only a 'creating' tenant; remove its counters first
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tenant_hard_delete_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF OLD.status IS DISTINCT FROM 'creating' THEN
    RAISE EXCEPTION 'TENANT_HARD_DELETE_BLOCKED: tenant % has status %; only a tenant in status creating can be hard-deleted',
      OLD.id, COALESCE(OLD.status, '<null>')
      USING ERRCODE = '55000',
            HINT = 'Suspend or archive the tenant instead (soft). Data repair: see migration 0678 escape hatch.';
  END IF;
  -- Counters are created lazily by fn_doc_seq_next; FK RESTRICT would refuse the delete otherwise.
  DELETE FROM public.org_doc_seq_mst WHERE tenant_org_id = OLD.id;
  RETURN OLD;
END
$fn$;
COMMENT ON FUNCTION public.fn_tenant_hard_delete_guard() IS
  'BEFORE DELETE on org_tenants_mst (trg_tenant_hard_delete_guard). Fails closed: a row is deleted only when status = creating (NULL or any other status raises TENANT_HARD_DELETE_BLOCKED, SQLSTATE 55000). When allowed, deletes the tenant org_doc_seq_mst counters first (FK RESTRICT). Migration tenant_hard_delete_guard, decision A-31.';
REVOKE ALL ON FUNCTION public.fn_tenant_hard_delete_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_tenant_hard_delete_guard ON public.org_tenants_mst;
CREATE TRIGGER trg_tenant_hard_delete_guard
  BEFORE DELETE ON public.org_tenants_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_hard_delete_guard();
COMMENT ON TRIGGER trg_tenant_hard_delete_guard ON public.org_tenants_mst IS
  'Tenant hard delete only in status creating; removes counters first. See fn_tenant_hard_delete_guard.';

-- ------------------------------------------------------------------
-- 2. BEFORE TRUNCATE: never
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tenant_truncate_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'TENANT_HARD_DELETE_BLOCKED: TRUNCATE of org_tenants_mst is not allowed' USING ERRCODE = '55000';
END
$fn$;
COMMENT ON FUNCTION public.fn_tenant_truncate_guard() IS
  'BEFORE TRUNCATE on org_tenants_mst (trg_tenant_truncate_guard): always raises TENANT_HARD_DELETE_BLOCKED. Migration tenant_hard_delete_guard.';
REVOKE ALL ON FUNCTION public.fn_tenant_truncate_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_tenant_truncate_guard ON public.org_tenants_mst;
CREATE TRIGGER trg_tenant_truncate_guard
  BEFORE TRUNCATE ON public.org_tenants_mst
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_tenant_truncate_guard();
COMMENT ON TRIGGER trg_tenant_truncate_guard ON public.org_tenants_mst IS
  'Refuses TRUNCATE of the tenant table. See fn_tenant_truncate_guard.';

-- ------------------------------------------------------------------
-- 3. BEFORE UPDATE OF status: 'creating' is insert-only
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tenant_status_creating_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
  IF NEW.status = 'creating' AND OLD.status IS DISTINCT FROM 'creating' THEN
    RAISE EXCEPTION 'TENANT_STATUS_CREATING_INSERT_ONLY: tenant % cannot move back to status creating', OLD.id
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.fn_tenant_status_creating_guard() IS
  'BEFORE UPDATE OF status on org_tenants_mst (trg_tenant_status_creating_guard): status creating can only be set by INSERT; moving an existing tenant to creating raises TENANT_STATUS_CREATING_INSERT_ONLY (SQLSTATE 55000), so nobody can re-flag a live tenant to unlock a hard delete. Migration tenant_hard_delete_guard.';
REVOKE ALL ON FUNCTION public.fn_tenant_status_creating_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_tenant_status_creating_guard ON public.org_tenants_mst;
CREATE TRIGGER trg_tenant_status_creating_guard
  BEFORE UPDATE OF status ON public.org_tenants_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_status_creating_guard();
COMMENT ON TRIGGER trg_tenant_status_creating_guard ON public.org_tenants_mst IS
  'Status creating is insert-only. See fn_tenant_status_creating_guard.';

COMMIT;
