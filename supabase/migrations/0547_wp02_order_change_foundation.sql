-- ============================================================
-- Migration: 0547_wp02_order_change_foundation.sql
-- Purpose:   Prepare commitment and edit-access storage without
--            activating a producer, backfill, or Order Change.
-- Affected:  org_orders_mst, oc_guard_order_foundation
-- Related:   0439 (workflow version), 0546 (verified baseline)
-- Review only: NOT APPLIED. See WP02_Foundation_Preparation_v3.0.md.
-- Lock impact: ALTER TABLE takes ACCESS EXCLUSIVE; NOT VALID avoids
-- historical CHECK/FK scans. No existing money/status is rewritten.
-- Existing application creates remain uncommitted with revision 0.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- NULL commitment preserves unknown historical provenance rather than
-- treating created_at or operational status as commercial evidence.
ALTER TABLE public.org_orders_mst
  ADD COLUMN committed_at TIMESTAMPTZ NULL, -- NULL preserves unresolved provenance and V2 ineligibility.
  ADD COLUMN committed_by UUID NULL, -- Known auth.users commitment actor; unknown historical actor stays NULL.
  ADD COLUMN edit_state_version INTEGER NOT NULL DEFAULT 0, -- Zero keeps unresolved legacy rows outside governed editing.
  ADD COLUMN edit_access_status TEXT NOT NULL DEFAULT 'OPEN', -- Stored access state; OPEN has no block metadata.
  ADD COLUMN edit_block_reason_code TEXT NULL, -- Optional controlled reason; blocked state needs code or explanation.
  ADD COLUMN edit_block_reason_text TEXT NULL, -- Optional explanation; blocked state needs code or explanation.
  ADD COLUMN edit_blocked_at TIMESTAMPTZ NULL, -- Stored block timestamp anchors coherent temporary expiry.
  ADD COLUMN edit_blocked_by UUID NULL, -- Known auth.users block actor; unknown historical actor stays NULL.
  ADD COLUMN edit_block_until TIMESTAMPTZ NULL, -- Optional temporary expiry; permanent block expiry is prohibited.
  ADD COLUMN service_speed TEXT NULL; -- NULL avoids conflating operational priority with commercial speed.

-- These constraints govern future DML immediately; operator validation
-- remains separate. NULL actors are legitimate for proven legacy commits.
-- A temporary block may have no expiry; expiry does not itself clear stored
-- block metadata. Later policy evaluation owns effective access at that time.
ALTER TABLE public.org_orders_mst
  ADD CONSTRAINT oc_order_commit_ck CHECK (
    (committed_at IS NULL AND edit_state_version = 0 AND committed_by IS NULL)
    OR (committed_at IS NOT NULL AND edit_state_version >= 1)
  ) NOT VALID,
  ADD CONSTRAINT oc_order_access_ck CHECK (
    (edit_access_status = 'OPEN'
      AND edit_block_reason_code IS NULL AND edit_block_reason_text IS NULL
      AND edit_blocked_at IS NULL AND edit_blocked_by IS NULL
      AND edit_block_until IS NULL)
    OR (edit_access_status IN ('TEMPORARILY_BLOCKED', 'PERMANENTLY_BLOCKED')
      AND edit_blocked_at IS NOT NULL
      AND (NULLIF(btrim(edit_block_reason_code), '') IS NOT NULL
        OR NULLIF(btrim(edit_block_reason_text), '') IS NOT NULL)
      AND (edit_access_status <> 'PERMANENTLY_BLOCKED' OR edit_block_until IS NULL)
      AND (edit_block_until IS NULL OR edit_block_until > edit_blocked_at))
  ) NOT VALID,
  ADD CONSTRAINT oc_order_speed_ck CHECK (
    service_speed IS NULL OR service_speed IN ('STANDARD', 'EXPRESS')
  ) NOT VALID,
  ADD CONSTRAINT oc_order_commit_actor_fk FOREIGN KEY (committed_by)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT oc_order_block_actor_fk FOREIGN KEY (edit_blocked_by)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;

COMMENT ON COLUMN public.org_orders_mst.committed_at IS
  'Commercial commitment evidence; NULL remains V2-ineligible; immutable once recorded.';
COMMENT ON COLUMN public.org_orders_mst.edit_state_version IS
  'Commercial revision only: uncommitted 0, initial commitment 1, applied Change +1; state_version remains workflow-owned.';
COMMENT ON COLUMN public.org_orders_mst.service_speed IS
  'Future STANDARD/EXPRESS commercial speed; NULL is unresolved. Never infer from priority or activate SAME_DAY here.';

-- A CHECK cannot compare OLD and NEW. No session setting or privileged
-- runtime exemption can clear commitment or reopen a permanent block.
-- This does not authorize initial commitment; WP03 owns producers.
CREATE FUNCTION public.oc_guard_order_foundation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.committed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Committed order cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.committed_at IS NOT NULL AND
    (NEW.committed_at IS DISTINCT FROM OLD.committed_at
      OR NEW.committed_by IS DISTINCT FROM OLD.committed_by) THEN
    RAISE EXCEPTION 'Commitment evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.edit_access_status = 'PERMANENTLY_BLOCKED'
    AND NEW.edit_access_status IS DISTINCT FROM OLD.edit_access_status THEN
    RAISE EXCEPTION 'Permanent edit block cannot be reopened' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
-- Remove default direct EXECUTE from browser/service roles; these helpers
-- serve owner-installed triggers rather than a callable maintenance RPC.
REVOKE ALL ON FUNCTION public.oc_guard_order_foundation()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER oc_order_foundation_guard
  BEFORE UPDATE OR DELETE ON public.org_orders_mst
  FOR EACH ROW EXECUTE FUNCTION public.oc_guard_order_foundation();

-- No producer/backfill DML, capability implementation, permission seed,
-- workflow rename/counter, or historical money conversion belongs here.
-- Persisted object documentation keeps reviewed identity, security and audit
-- intent visible in the database catalog after operator-approved deployment.
COMMENT ON COLUMN public.org_orders_mst.committed_by IS
  'Optional auth.users commitment actor; NULL preserves unknown proven historical attribution without fabrication.';
COMMENT ON COLUMN public.org_orders_mst.edit_access_status IS
  'Stored OPEN, TEMPORARILY_BLOCKED or PERMANENTLY_BLOCKED access state; permanent blocks cannot be reopened by ordinary DML.';
COMMENT ON COLUMN public.org_orders_mst.edit_block_reason_code IS
  'Optional controlled block reason token; a blocked state requires a nonblank code or explanation.';
COMMENT ON COLUMN public.org_orders_mst.edit_block_reason_text IS
  'Optional block explanation; a blocked state requires a nonblank code or explanation.';
COMMENT ON COLUMN public.org_orders_mst.edit_blocked_at IS
  'Required timestamp when a block is stored; anchors coherent optional temporary expiry.';
COMMENT ON COLUMN public.org_orders_mst.edit_blocked_by IS
  'Optional auth.users block actor; later runtime supplies authenticated attribution without inventing unknown historical actors.';
COMMENT ON COLUMN public.org_orders_mst.edit_block_until IS
  'Optional temporary-block expiry later than blocked_at; permanent blocks prohibit expiry and policy owns effective-time evaluation.';
COMMENT ON CONSTRAINT oc_order_commit_ck ON public.org_orders_mst IS
  'Keeps unresolved commitment at revision zero and committed facts at revision one or greater; no inferred commitment backfill.';
COMMENT ON CONSTRAINT oc_order_access_ck ON public.org_orders_mst IS
  'Requires coherent block evidence, excludes expiry on permanent blocks and keeps OPEN metadata clear; future DML enforced before historical validation.';
COMMENT ON CONSTRAINT oc_order_speed_ck ON public.org_orders_mst IS
  'Admits unresolved NULL or candidate STANDARD/EXPRESS values without activating pricing or SAME_DAY behavior.';
COMMENT ON CONSTRAINT oc_order_commit_actor_fk ON public.org_orders_mst IS
  'Validates known commitment actors against auth.users and restricts identity deletion; legacy NULL attribution remains legal.';
COMMENT ON CONSTRAINT oc_order_block_actor_fk ON public.org_orders_mst IS
  'Validates known block actors against auth.users and restricts identity deletion; no historical actor is fabricated.';
COMMENT ON FUNCTION public.oc_guard_order_foundation() IS
  'SECURITY INVOKER trigger with fixed pg_catalog search_path; prevents commitment evidence deletion/rewrite and permanent-block reopening without authorizing initial commitment.';
COMMENT ON TRIGGER oc_order_foundation_guard ON public.org_orders_mst IS
  'Preserves irreversible commercial commitment and permanent edit blocks during ordinary UPDATE/DELETE; initial producer behavior remains WP03.';
COMMENT ON TABLE public.org_orders_mst IS
  'Tenant orders (master). WP02 adds unresolved commitment and edit-access storage without producer activation or historical backfill.';

COMMIT;
