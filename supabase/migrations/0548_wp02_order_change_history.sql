-- ============================================================
-- Migration: 0548_wp02_order_change_history.sql
-- Purpose:   Preserve immutable commercial Change facts and removal
--            identity without depending on mutable Split parent tuples.
-- Affected:  org_order_changes_mst, org_order_change_ops_dtl,
--            org_order_items_dtl, org_order_item_pieces_dtl,
--            org_order_preferences_dtl, oc_deny_history_mutation,
--            oc_guard_removed_fact
-- Related:   0547 (foundation), 0127 (auth.users actor convention)
-- Review only: NOT APPLIED. No historical rows/backfill are inserted.
-- Lock impact: existing-table ALTER/UNIQUE takes ACCESS EXCLUSIVE;
-- identity indexes scan pieces/preferences. Regular CREATE INDEX
-- blocks writes on its target. Use a reviewed maintenance window.
-- Global live-parent FKs/shape CHECKs deliberately await Split/data
-- compatibility; NOT VALID would still enforce legacy future DML.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Existing order/item identity UNIQUE tuples are reused. UUID PKs
-- already prove uniqueness, so these add tenant-qualified FK targets
-- without inventing parent tuples that Split can subsequently change.
ALTER TABLE public.org_order_item_pieces_dtl
  ADD CONSTRAINT oc_piece_identity_uq UNIQUE (id, tenant_org_id);
ALTER TABLE public.org_order_preferences_dtl
  ADD CONSTRAINT oc_pref_identity_uq UNIQUE (id, tenant_org_id);

-- One complete applied Change is inserted exactly once. No pending
-- shell or mutable post-commit audit completion is permitted.
CREATE TABLE public.org_order_changes_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable persisted audit UUID; identity survives parent movement.
  tenant_org_id UUID NOT NULL, -- Tenant ownership for composite references and explicit server predicates.
  order_id UUID NOT NULL, -- Original commercial order reference within the tenant.
  change_no INTEGER NOT NULL, -- Positive per-order Change sequence for audit ordering.
  edit_state_version_before INTEGER NOT NULL, -- Committed commercial revision consumed by this Change.
  edit_state_version_after INTEGER NOT NULL, -- Commercial revision produced; exactly one increment.
  wf_state_version_expected INTEGER NOT NULL, -- Observed workflow counter; not another physical workflow version.
  source_context TEXT NOT NULL, -- Command origin retained for audit and support.
  actor_user_id UUID NOT NULL, -- Server-derived authenticated auth.users actor identity.
  actor_name TEXT NULL, -- Optional actor display snapshot preserves historic attribution.
  change_reason TEXT NULL, -- Optional explanation; later operation policy governs required reasons.
  currency_code TEXT NOT NULL, -- Explicit sys_currency_cd currency; no locale default.
  financial_before JSONB NOT NULL, -- Authoritative pre-Change snapshot; money uses currency_code.
  financial_after JSONB NOT NULL, -- Authoritative post-Change snapshot; settlement history remains separate.
  commercial_delta DECIMAL(19,4) NOT NULL, -- Signed obligation difference in currency_code, not a settlement movement.
  financial_outcome TEXT NOT NULL, -- Follow-up classification without executing settlement.
  idempotency_key TEXT NOT NULL, -- Tenant-unique durable Apply/replay identity.
  request_hash TEXT NOT NULL, -- Canonical request fingerprint for later same-key payload validation.
  apply_response JSONB NOT NULL, -- Final nonempty authoritative response for lost-response replay.
  applied_at TIMESTAMPTZ NOT NULL, -- Business application time, not inferred order creation time.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Immutable object-shaped extension context.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- Insertion audit time, distinct from business application time.
  created_by TEXT NOT NULL, -- Standard TEXT insertion actor audit; server authority remains required.
  created_info TEXT NULL, -- Optional insertion provenance.
  updated_at TIMESTAMPTZ NULL, -- Compatibility audit field must remain NULL for immutable facts.
  updated_by TEXT NULL, -- Compatibility audit field must remain NULL for immutable facts.
  updated_info TEXT NULL, -- Compatibility audit field must remain NULL for immutable facts.
  rec_status SMALLINT NOT NULL DEFAULT 1, -- 1=active, 0=soft-deleted; applied facts forbid the 0 state.
  rec_order INTEGER NULL, -- Optional ordering recorded once; never reorders applied history.
  rec_notes TEXT NULL, -- Optional audit notes recorded once.
  is_active BOOLEAN NOT NULL DEFAULT true, -- Compatibility visibility flag must stay true for applied history.
  CONSTRAINT oc_change_identity_uq UNIQUE (id, tenant_org_id),
  CONSTRAINT oc_change_aggregate_uq UNIQUE (id, order_id, tenant_org_id),
  CONSTRAINT oc_change_number_uq UNIQUE (tenant_org_id, order_id, change_no),
  CONSTRAINT oc_change_revision_uq UNIQUE (tenant_org_id, order_id, edit_state_version_after),
  CONSTRAINT oc_change_idempotency_uq UNIQUE (tenant_org_id, idempotency_key),
  CONSTRAINT oc_change_revision_ck CHECK (change_no > 0
    AND edit_state_version_before >= 1
    AND edit_state_version_after::bigint = edit_state_version_before::bigint + 1
    AND wf_state_version_expected >= 1),
  CONSTRAINT oc_change_outcome_ck CHECK (financial_outcome IN
    ('NONE', 'OUTSTANDING_OPTIONAL', 'OUTSTANDING_REQUIRED', 'OVERPAYMENT')),
  CONSTRAINT oc_change_facts_ck CHECK (
    NULLIF(btrim(source_context), '') IS NOT NULL
    AND NULLIF(btrim(idempotency_key), '') IS NOT NULL
    AND NULLIF(btrim(request_hash), '') IS NOT NULL
    AND NULLIF(btrim(created_by), '') IS NOT NULL
    AND commercial_delta <> 'NaN'::numeric
    AND jsonb_typeof(financial_before) = 'object' AND financial_before <> '{}'::jsonb
    AND jsonb_typeof(financial_after) = 'object' AND financial_after <> '{}'::jsonb
    AND jsonb_typeof(apply_response) = 'object' AND apply_response <> '{}'::jsonb
    AND jsonb_typeof(metadata) = 'object'),
  CONSTRAINT oc_change_lifecycle_ck CHECK (rec_status = 1 AND is_active
    AND updated_at IS NULL AND updated_by IS NULL AND updated_info IS NULL),
  CONSTRAINT oc_change_tenant_fk FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_change_order_fk FOREIGN KEY (order_id, tenant_org_id)
    REFERENCES public.org_orders_mst(id, tenant_org_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_change_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_change_currency_fk FOREIGN KEY (currency_code)
    REFERENCES public.sys_currency_cd(code) ON UPDATE RESTRICT ON DELETE RESTRICT
);
-- Match the observed configured Prisma owner; immutable triggers still
-- protect ordinary owner DML, while DBA schema maintenance remains separate.
ALTER TABLE public.org_order_changes_mst OWNER TO postgres;
COMMENT ON TABLE public.org_order_changes_mst IS
  'Immutable applied commercial Change; final snapshots/replay response inserted once in the commercial transaction. No settlement ledger.';

-- Operations preserve immutable UUID+tenant identity. Current parent
-- hierarchy must be checked under command locks, not encoded into a
-- historical FK that later Split/reparent would invalidate.
CREATE TABLE public.org_order_change_ops_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable persisted audit UUID; identity survives parent movement.
  tenant_org_id UUID NOT NULL, -- Tenant ownership for composite references and explicit server predicates.
  order_id UUID NOT NULL, -- Original commercial order reference within the tenant.
  order_change_id UUID NOT NULL, -- Immutable aggregate identity qualified by original order and tenant.
  operation_seq INTEGER NOT NULL, -- Positive sequence preserves deterministic per-Change audit order.
  operation_code TEXT NOT NULL, -- Frozen V1 operation token from the thirteen-operation catalog.
  target_type TEXT NOT NULL, -- Affected persisted fact category, independent of command parent scope.
  order_item_id UUID NULL, -- Historical item identity; current order tuple is deliberately excluded.
  order_item_piece_id UUID NULL, -- Historical piece identity; current parent tuple is excluded.
  order_preference_id UUID NULL, -- Historical preference identity; current scope tuple is excluded.
  client_ref UUID NULL, -- Correlates a new fact to its client command without replacing persisted UUID identity.
  before_values JSONB NOT NULL DEFAULT '{}'::jsonb, -- Authoritative prior values and original parent context.
  after_values JSONB NOT NULL DEFAULT '{}'::jsonb, -- Authoritative resulting values and original parent context.
  audit_summary TEXT NULL, -- Optional insertion-time explanation; never recomputed from current rows.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Immutable object-shaped extension context.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- Insertion audit time, distinct from business application time.
  created_by TEXT NOT NULL, -- Standard TEXT insertion actor audit; server authority remains required.
  created_info TEXT NULL, -- Optional insertion provenance.
  updated_at TIMESTAMPTZ NULL, -- Compatibility audit field must remain NULL for immutable facts.
  updated_by TEXT NULL, -- Compatibility audit field must remain NULL for immutable facts.
  updated_info TEXT NULL, -- Compatibility audit field must remain NULL for immutable facts.
  rec_status SMALLINT NOT NULL DEFAULT 1, -- 1=active, 0=soft-deleted; applied operation facts forbid the 0 state.
  rec_order INTEGER NULL, -- Optional ordering recorded once; never reorders applied history.
  rec_notes TEXT NULL, -- Optional audit notes recorded once.
  is_active BOOLEAN NOT NULL DEFAULT true, -- Compatibility visibility flag must stay true for applied history.
  CONSTRAINT oc_op_sequence_uq UNIQUE (tenant_org_id, order_change_id, operation_seq),
  CONSTRAINT oc_op_sequence_ck CHECK (operation_seq > 0),
  CONSTRAINT oc_op_catalog_ck CHECK (operation_code IN (
    'ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE',
    'ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE', 'CHANGE_PRIORITY',
    'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY', 'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT')
    AND target_type IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE')),
  -- Audit target is the affected persisted fact, not the command's
  -- parent scope. Creation operations must retain the preallocated UUID.
  CONSTRAINT oc_op_target_ck CHECK (
    (operation_code IN ('ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY')
      AND target_type = 'ITEM' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PIECE', 'REMOVE_PIECE')
      AND target_type = 'PIECE' AND order_item_id IS NOT NULL
      AND order_item_piece_id IS NOT NULL AND order_preference_id IS NULL)
    OR (operation_code IN ('ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE')
      AND target_type = 'PREFERENCE' AND order_preference_id IS NOT NULL
      AND (order_item_piece_id IS NULL OR order_item_id IS NOT NULL))
    OR (operation_code IN ('CHANGE_PRIORITY', 'CHANGE_SERVICE_SPEED', 'CHANGE_READY_BY',
        'CHANGE_ORDER_NOTES', 'CHANGE_CUSTOMER_SNAPSHOT')
      AND target_type = 'ORDER' AND order_item_id IS NULL
      AND order_item_piece_id IS NULL AND order_preference_id IS NULL)
  ),
  CONSTRAINT oc_op_json_ck CHECK (jsonb_typeof(before_values) = 'object'
    AND jsonb_typeof(after_values) = 'object' AND jsonb_typeof(metadata) = 'object'
    AND NULLIF(btrim(created_by), '') IS NOT NULL),
  CONSTRAINT oc_op_lifecycle_ck CHECK (rec_status = 1 AND is_active
    AND updated_at IS NULL AND updated_by IS NULL AND updated_info IS NULL),
  CONSTRAINT oc_op_change_fk FOREIGN KEY (order_change_id, order_id, tenant_org_id)
    REFERENCES public.org_order_changes_mst(id, order_id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_op_item_fk FOREIGN KEY (order_item_id, tenant_org_id)
    REFERENCES public.org_order_items_dtl(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_op_piece_fk FOREIGN KEY (order_item_piece_id, tenant_org_id)
    REFERENCES public.org_order_item_pieces_dtl(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT oc_op_pref_fk FOREIGN KEY (order_preference_id, tenant_org_id)
    REFERENCES public.org_order_preferences_dtl(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);
-- Match the observed configured Prisma owner; immutable triggers still
-- protect ordinary owner DML, while DBA schema maintenance remains separate.
ALTER TABLE public.org_order_change_ops_dtl OWNER TO postgres;
COMMENT ON TABLE public.org_order_change_ops_dtl IS
  'Immutable affected-fact identities; audit target differs from creation command parent scope. Original parent snapshots and locked hierarchy validation are required.';

-- Order history pages seek the newest applied Change within a tenant.
CREATE INDEX oc_change_order_time_ix ON public.org_order_changes_mst
  (tenant_org_id, order_id, applied_at DESC);
-- Tenant support pages seek recent Changes independently of order.
CREATE INDEX oc_change_created_ix ON public.org_order_changes_mst
  (tenant_org_id, created_at DESC);
-- Standard lifecycle support filtering; existing UNIQUEs cover tenant alone.
CREATE INDEX oc_change_status_ix ON public.org_order_changes_mst (tenant_org_id, rec_status);
-- Retains the standard tenant-active access shape for support tooling.
CREATE INDEX oc_change_active_ix ON public.org_order_changes_mst (tenant_org_id, is_active);
-- Order-scoped operation loading supplements sequence UNIQUE's Change prefix.
CREATE INDEX oc_op_order_change_ix ON public.org_order_change_ops_dtl
  (tenant_org_id, order_id, order_change_id);
-- Entity history/support lookups retain identity after parent movement.
CREATE INDEX oc_op_item_ix ON public.org_order_change_ops_dtl (tenant_org_id, order_item_id);
-- Piece identity lookups remain stable when a surviving piece changes parent.
CREATE INDEX oc_op_piece_ix ON public.org_order_change_ops_dtl (tenant_org_id, order_item_piece_id);
-- Preference identity lookups do not depend on the preference's current scope.
CREATE INDEX oc_op_pref_ix ON public.org_order_change_ops_dtl (tenant_org_id, order_preference_id);
-- Standard tenant lifecycle/creation support lookups; no duplicate tenant-only index.
CREATE INDEX oc_op_created_ix ON public.org_order_change_ops_dtl (tenant_org_id, created_at DESC);
-- Retains the standard tenant-status access shape for support tooling.
CREATE INDEX oc_op_status_ix ON public.org_order_change_ops_dtl (tenant_org_id, rec_status);
-- Retains the standard tenant-active access shape for support tooling.
CREATE INDEX oc_op_active_ix ON public.org_order_change_ops_dtl (tenant_org_id, is_active);

-- These fields do not classify or rewrite legacy inactive/NULL rows.
-- Only referencing-row existence checks for removal lineage are deferred:
-- facts may reference a preallocated Change UUID before its one final INSERT.
-- They must resolve by COMMIT (or earlier SET CONSTRAINTS ... IMMEDIATE).
-- RESTRICT still prevents deleting/updating referenced identities immediately;
-- all non-lineage FKs retain their default immediate constraint timing.
ALTER TABLE public.org_order_items_dtl
  ADD COLUMN deleted_at TIMESTAMPTZ NULL, -- Governed removal time; no fabricated legacy lineage.
  ADD COLUMN deleted_by UUID NULL, -- auth.users actor required for governed removal.
  ADD COLUMN deleted_order_change_id UUID NULL, -- Preallocated Change identity; deferred existence resolves by COMMIT.
  ADD CONSTRAINT oc_item_removal_ck CHECK (
    (deleted_order_change_id IS NULL AND deleted_at IS NULL AND deleted_by IS NULL)
    OR (deleted_order_change_id IS NOT NULL AND rec_status IS NOT NULL
      AND rec_status = 0 AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT oc_item_removal_actor_fk FOREIGN KEY (deleted_by)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT oc_item_removal_change_fk FOREIGN KEY (deleted_order_change_id, tenant_org_id)
    REFERENCES public.org_order_changes_mst(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE public.org_order_item_pieces_dtl
  ADD COLUMN deleted_at TIMESTAMPTZ NULL, -- Governed removal time; no fabricated legacy lineage.
  ADD COLUMN deleted_by UUID NULL, -- auth.users actor required for governed removal.
  ADD COLUMN deleted_order_change_id UUID NULL, -- Preallocated Change identity; deferred existence resolves by COMMIT.
  ADD CONSTRAINT oc_piece_removal_ck CHECK (
    (deleted_order_change_id IS NULL AND deleted_at IS NULL AND deleted_by IS NULL)
    OR (deleted_order_change_id IS NOT NULL AND rec_status IS NOT NULL
      AND rec_status = 0 AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT oc_piece_removal_actor_fk FOREIGN KEY (deleted_by)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT oc_piece_removal_change_fk FOREIGN KEY (deleted_order_change_id, tenant_org_id)
    REFERENCES public.org_order_changes_mst(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE public.org_order_preferences_dtl
  ADD COLUMN deleted_at TIMESTAMPTZ NULL, -- Governed removal time; no fabricated legacy lineage.
  ADD COLUMN deleted_by UUID NULL, -- auth.users actor required for governed removal.
  ADD COLUMN deleted_order_change_id UUID NULL, -- Preallocated Change identity; deferred existence resolves by COMMIT.
  ADD CONSTRAINT oc_pref_removal_ck CHECK (
    (deleted_order_change_id IS NULL AND deleted_at IS NULL AND deleted_by IS NULL)
    OR (deleted_order_change_id IS NOT NULL AND rec_status IS NOT NULL
      AND rec_status = 0 AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT oc_pref_removal_actor_fk FOREIGN KEY (deleted_by)
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT oc_pref_removal_change_fk FOREIGN KEY (deleted_order_change_id, tenant_org_id)
    REFERENCES public.org_order_changes_mst(id, tenant_org_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

-- Sparse lineage indexes support removal-history and FK-reference checks
-- without indexing the entire unresolved historical population.
CREATE INDEX oc_item_removal_ix ON public.org_order_items_dtl
  (tenant_org_id, deleted_order_change_id) WHERE deleted_order_change_id IS NOT NULL;
-- Supports tenant-scoped piece-removal evidence without indexing legacy NULLs.
CREATE INDEX oc_piece_removal_ix ON public.org_order_item_pieces_dtl
  (tenant_org_id, deleted_order_change_id) WHERE deleted_order_change_id IS NOT NULL;
-- Supports tenant-scoped preference-removal evidence without indexing legacy NULLs.
CREATE INDEX oc_pref_removal_ix ON public.org_order_preferences_dtl
  (tenant_org_id, deleted_order_change_id) WHERE deleted_order_change_id IS NOT NULL;

-- Revokes alone cannot constrain the owner/BYPASSRLS connection. A
-- normal runtime command (including postgres/service_role) must never
-- alter or truncate applied history. DBA trigger/schema maintenance is
-- a separate audited administrative boundary, not an application bypass.
CREATE FUNCTION public.oc_deny_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $function$
BEGIN
  RAISE EXCEPTION 'Applied Change history is immutable' USING ERRCODE = '23514';
END;
$function$;
-- Remove default direct EXECUTE from browser/service roles; these helpers
-- serve owner-installed triggers rather than a callable maintenance RPC.
REVOKE ALL ON FUNCTION public.oc_deny_history_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER oc_change_immutable
  BEFORE UPDATE OR DELETE ON public.org_order_changes_mst
  FOR EACH ROW EXECUTE FUNCTION public.oc_deny_history_mutation();
CREATE TRIGGER oc_change_no_truncate
  BEFORE TRUNCATE ON public.org_order_changes_mst
  FOR EACH STATEMENT EXECUTE FUNCTION public.oc_deny_history_mutation();
CREATE TRIGGER oc_op_immutable
  BEFORE UPDATE OR DELETE ON public.org_order_change_ops_dtl
  FOR EACH ROW EXECUTE FUNCTION public.oc_deny_history_mutation();
CREATE TRIGGER oc_op_no_truncate
  BEFORE TRUNCATE ON public.org_order_change_ops_dtl
  FOR EACH STATEMENT EXECUTE FUNCTION public.oc_deny_history_mutation();

-- Governed removed rows keep their facts and origin; legacy rows with
-- no V2 lineage remain untouched. Do not reactivate or reparent them.
CREATE FUNCTION public.oc_guard_removed_fact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $function$
BEGIN
  IF OLD.deleted_order_change_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Governed removed fact cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Governed removed fact is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
-- Remove default direct EXECUTE from browser/service roles; these helpers
-- serve owner-installed triggers rather than a callable maintenance RPC.
REVOKE ALL ON FUNCTION public.oc_guard_removed_fact()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER oc_item_removed_guard BEFORE UPDATE OR DELETE ON public.org_order_items_dtl
  FOR EACH ROW EXECUTE FUNCTION public.oc_guard_removed_fact();
CREATE TRIGGER oc_piece_removed_guard BEFORE UPDATE OR DELETE ON public.org_order_item_pieces_dtl
  FOR EACH ROW EXECUTE FUNCTION public.oc_guard_removed_fact();
CREATE TRIGGER oc_pref_removed_guard BEFORE UPDATE OR DELETE ON public.org_order_preferences_dtl
  FOR EACH ROW EXECUTE FUNCTION public.oc_guard_removed_fact();

-- Membership authority is currently writable through permissive policies.
-- RLS enabled does NOT prove membership safety. No ordinary SELECT/write
-- policy is installed: default-deny until the platform dependency closes.
-- Explicit ACLs cancel broad public-schema default privileges, including
-- TRUNCATE/REFERENCES/TRIGGER rights that row-level policies cannot remove.
ALTER TABLE public.org_order_changes_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_order_change_ops_dtl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_order_changes_mst, public.org_order_change_ops_dtl
  FROM PUBLIC, anon, authenticated, service_role;
-- Server service_role receives only history read/append privileges; its
-- BYPASSRLS requires server-derived tenant/actor checks in later services.
GRANT SELECT, INSERT ON TABLE public.org_order_changes_mst, public.org_order_change_ops_dtl
  TO service_role;
-- The owner postgres is the observed configured Prisma identity, not
-- proof of deployment identity. Later services must authenticate and
-- derive tenant/actor server-side and explicitly filter every org query.
-- No RPC or browser history endpoint is created in this foundation.
-- Persisted object documentation keeps reviewed identity, security and audit
-- intent visible in the database catalog after operator-approved deployment.
COMMENT ON CONSTRAINT oc_piece_identity_uq ON public.org_order_item_pieces_dtl IS
  'Tenant-qualified stable piece identity FK target; reuses the UUID identity without freezing mutable parents.';
COMMENT ON INDEX public.oc_piece_identity_uq IS
  'Constraint-backed identity/uniqueness index: Tenant-qualified stable piece identity FK target; reuses the UUID identity without freezing mutable parents.';
COMMENT ON CONSTRAINT oc_pref_identity_uq ON public.org_order_preferences_dtl IS
  'Tenant-qualified stable preference identity FK target; keeps historical references independent of live hierarchy.';
COMMENT ON INDEX public.oc_pref_identity_uq IS
  'Constraint-backed identity/uniqueness index: Tenant-qualified stable preference identity FK target; keeps historical references independent of live hierarchy.';
COMMENT ON COLUMN public.org_order_changes_mst.id IS
  'Stable persisted UUID identity; retained independently of mutable parent relationships.';
COMMENT ON CONSTRAINT org_order_changes_mst_pkey ON public.org_order_changes_mst IS
  'Global stable Change UUID identity; preallocated before commercial facts so deferred removal lineage can resolve at commit.';
COMMENT ON INDEX public.org_order_changes_mst_pkey IS
  'Constraint-backed identity/uniqueness index: Global stable Change UUID identity; preallocated before commercial facts so deferred removal lineage can resolve at commit.';
COMMENT ON COLUMN public.org_order_changes_mst.tenant_org_id IS
  'Tenant ownership used in composite references and mandatory server query predicates; RLS alone does not prove membership safety.';
COMMENT ON COLUMN public.org_order_changes_mst.order_id IS
  'Order whose commercial history this fact records; paired with tenant ownership to prevent cross-tenant references.';
COMMENT ON COLUMN public.org_order_changes_mst.change_no IS
  'Positive per-order Change sequence; unique within the tenant and order.';
COMMENT ON COLUMN public.org_order_changes_mst.edit_state_version_before IS
  'Committed commercial revision consumed by this Change; distinct from the workflow counter.';
COMMENT ON COLUMN public.org_order_changes_mst.edit_state_version_after IS
  'Commercial revision produced by this Change; exactly one greater than the consumed revision.';
COMMENT ON COLUMN public.org_order_changes_mst.wf_state_version_expected IS
  'Observed workflow revision expected by the command; preserves concurrency evidence without creating another workflow counter.';
COMMENT ON COLUMN public.org_order_changes_mst.source_context IS
  'Nonblank command origin retained for support and audit; producer authority is enforced by later server code.';
COMMENT ON COLUMN public.org_order_changes_mst.actor_user_id IS
  'Authenticated auth.users identity responsible for the applied Change; later runtime must derive it server-side.';
COMMENT ON COLUMN public.org_order_changes_mst.actor_name IS
  'Optional actor display snapshot retained without depending on future profile changes.';
COMMENT ON COLUMN public.org_order_changes_mst.change_reason IS
  'Optional order-level explanation; later operation policy determines when a reason is required.';
COMMENT ON COLUMN public.org_order_changes_mst.currency_code IS
  'Explicit commercial currency referencing sys_currency_cd; no locale-derived default is supplied.';
COMMENT ON COLUMN public.org_order_changes_mst.financial_before IS
  'Authoritative nonempty pre-Change financial snapshot in currency_code; not a separate settlement ledger.';
COMMENT ON COLUMN public.org_order_changes_mst.financial_after IS
  'Authoritative nonempty post-Change financial snapshot in currency_code; historical settlement facts are not rewritten.';
COMMENT ON COLUMN public.org_order_changes_mst.commercial_delta IS
  'Signed difference in commercial obligation, denominated in currency_code and stored at decimal precision 19,4.';
COMMENT ON COLUMN public.org_order_changes_mst.financial_outcome IS
  'Follow-up classification NONE, OUTSTANDING_OPTIONAL, OUTSTANDING_REQUIRED or OVERPAYMENT; does not execute settlement.';
COMMENT ON COLUMN public.org_order_changes_mst.idempotency_key IS
  'Tenant-unique durable Apply identity; retained with the final response for replay and duplicate detection.';
COMMENT ON COLUMN public.org_order_changes_mst.request_hash IS
  'Nonblank canonical request fingerprint; later command code rejects reuse of a key with different content.';
COMMENT ON COLUMN public.org_order_changes_mst.apply_response IS
  'Nonempty final authoritative response recorded with the applied Change for lost-response replay; never a pending shell.';
COMMENT ON COLUMN public.org_order_changes_mst.applied_at IS
  'Authoritative application timestamp supplied by the commercial transaction, rather than inferred from order creation.';
COMMENT ON COLUMN public.org_order_changes_mst.metadata IS
  'Object-shaped extension context retained immutably with the applied fact; not another state authority.';
COMMENT ON COLUMN public.org_order_changes_mst.created_at IS
  'Insertion audit timestamp for this immutable fact; distinct from business application time where applicable.';
COMMENT ON COLUMN public.org_order_changes_mst.created_by IS
  'Nonblank insertion audit identity in the standard TEXT field; later runtime derives actor authority server-side.';
COMMENT ON COLUMN public.org_order_changes_mst.created_info IS
  'Optional insertion provenance retained under the standard audit convention.';
COMMENT ON COLUMN public.org_order_changes_mst.updated_at IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_changes_mst.updated_by IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_changes_mst.updated_info IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_changes_mst.rec_status IS
  'Standard lifecycle vocabulary 1=active, 0=soft-deleted; immutable applied facts require 1 and prohibit soft erasure.';
COMMENT ON COLUMN public.org_order_changes_mst.rec_order IS
  'Optional display ordering recorded at insertion; never updated to reorder applied business history.';
COMMENT ON COLUMN public.org_order_changes_mst.rec_notes IS
  'Optional audit notes recorded at insertion; later corrections require separate governed facts.';
COMMENT ON COLUMN public.org_order_changes_mst.is_active IS
  'Standard lifecycle compatibility flag constrained to true; cannot hide applied history.';
COMMENT ON CONSTRAINT oc_change_identity_uq ON public.org_order_changes_mst IS
  'Tenant-qualified Change identity target for removal lineage references.';
COMMENT ON INDEX public.oc_change_identity_uq IS
  'Constraint-backed identity/uniqueness index: Tenant-qualified Change identity target for removal lineage references.';
COMMENT ON CONSTRAINT oc_change_aggregate_uq ON public.org_order_changes_mst IS
  'Original order and tenant qualified Change target prevents operations from crossing applied aggregates.';
COMMENT ON INDEX public.oc_change_aggregate_uq IS
  'Constraint-backed identity/uniqueness index: Original order and tenant qualified Change target prevents operations from crossing applied aggregates.';
COMMENT ON CONSTRAINT oc_change_number_uq ON public.org_order_changes_mst IS
  'Prevents duplicate Change numbering within a tenant and order.';
COMMENT ON INDEX public.oc_change_number_uq IS
  'Constraint-backed identity/uniqueness index: Prevents duplicate Change numbering within a tenant and order.';
COMMENT ON CONSTRAINT oc_change_revision_uq ON public.org_order_changes_mst IS
  'Prevents two Changes from claiming the same resulting commercial revision within an order.';
COMMENT ON INDEX public.oc_change_revision_uq IS
  'Constraint-backed identity/uniqueness index: Prevents two Changes from claiming the same resulting commercial revision within an order.';
COMMENT ON CONSTRAINT oc_change_idempotency_uq ON public.org_order_changes_mst IS
  'Prevents duplicate durable Apply keys across orders in the same tenant; payload equivalence remains a server check.';
COMMENT ON INDEX public.oc_change_idempotency_uq IS
  'Constraint-backed identity/uniqueness index: Prevents duplicate durable Apply keys across orders in the same tenant; payload equivalence remains a server check.';
COMMENT ON CONSTRAINT oc_change_revision_ck ON public.org_order_changes_mst IS
  'Requires positive numbering and workflow expectation with exactly one commercial revision increment, using bigint arithmetic to avoid integer addition overflow.';
COMMENT ON CONSTRAINT oc_change_outcome_ck ON public.org_order_changes_mst IS
  'Freezes the supported financial follow-up classifications without creating settlement behavior.';
COMMENT ON CONSTRAINT oc_change_facts_ck ON public.org_order_changes_mst IS
  'Rejects blank command identities, NaN money and empty or non-object final snapshots/replay response so a pending audit shell cannot be inserted.';
COMMENT ON CONSTRAINT oc_change_lifecycle_ck ON public.org_order_changes_mst IS
  'Keeps applied history visible and excludes update audit facts; history cannot be soft-erased.';
COMMENT ON CONSTRAINT oc_change_tenant_fk ON public.org_order_changes_mst IS
  'Retains tenant identity for committed business history; tenant deletion or identity rewrite is restricted.';
COMMENT ON CONSTRAINT oc_change_order_fk ON public.org_order_changes_mst IS
  'Enforces order-plus-tenant ownership of applied history and restricts destruction or identity rewrite of the committed order reference.';
COMMENT ON CONSTRAINT oc_change_actor_fk ON public.org_order_changes_mst IS
  'Retains the authenticated auth.users actor identity with restricted deletion and identity rewrite.';
COMMENT ON CONSTRAINT oc_change_currency_fk ON public.org_order_changes_mst IS
  'Retains the commercial currency code without a locale default; referenced currency deletion and identity rewrite are restricted.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.id IS
  'Stable persisted UUID identity; retained independently of mutable parent relationships.';
COMMENT ON CONSTRAINT org_order_change_ops_dtl_pkey ON public.org_order_change_ops_dtl IS
  'Global stable operation UUID identity for immutable audit facts.';
COMMENT ON INDEX public.org_order_change_ops_dtl_pkey IS
  'Constraint-backed identity/uniqueness index: Global stable operation UUID identity for immutable audit facts.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.tenant_org_id IS
  'Tenant ownership used in composite references and mandatory server query predicates; RLS alone does not prove membership safety.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.order_id IS
  'Order whose commercial history this fact records; paired with tenant ownership to prevent cross-tenant references.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.order_change_id IS
  'Applied Change aggregate identity; paired with original order and tenant to prevent operations crossing aggregates.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.operation_seq IS
  'Positive operation sequence unique within the tenant and Change, preserving deterministic audit order.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.operation_code IS
  'Frozen V1 operation token; checked against the supported thirteen-operation catalog.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.target_type IS
  'Affected persisted fact category ORDER, ITEM, PIECE or PREFERENCE; creation command parent scope is not the audit target.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.order_item_id IS
  'Optional historical item UUID; tenant-qualified FK preserves identity without depending on current order parent.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.order_item_piece_id IS
  'Optional historical piece UUID; tenant-qualified FK permits future parent movement without rewriting history.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.order_preference_id IS
  'Optional historical preference UUID; tenant-qualified FK preserves identity separately from mutable parent scope.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.client_ref IS
  'Optional client UUID correlating a creation command with its preallocated persisted target; not a substitute for target identity.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.before_values IS
  'Object-shaped authoritative prior values and original parent context retained for audit.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.after_values IS
  'Object-shaped authoritative resulting values and original parent context retained for audit.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.audit_summary IS
  'Optional human-readable operation explanation captured at insertion; never recomputed from mutable current rows.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.metadata IS
  'Object-shaped extension context retained immutably with the applied fact; not another state authority.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.created_at IS
  'Insertion audit timestamp for this immutable fact; distinct from business application time where applicable.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.created_by IS
  'Nonblank insertion audit identity in the standard TEXT field; later runtime derives actor authority server-side.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.created_info IS
  'Optional insertion provenance retained under the standard audit convention.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.updated_at IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.updated_by IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.updated_info IS
  'Standard audit compatibility field constrained to NULL because applied facts cannot be updated.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.rec_status IS
  'Standard lifecycle vocabulary 1=active, 0=soft-deleted; immutable applied facts require 1 and prohibit soft erasure.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.rec_order IS
  'Optional display ordering recorded at insertion; never updated to reorder applied business history.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.rec_notes IS
  'Optional audit notes recorded at insertion; later corrections require separate governed facts.';
COMMENT ON COLUMN public.org_order_change_ops_dtl.is_active IS
  'Standard lifecycle compatibility flag constrained to true; cannot hide applied history.';
COMMENT ON CONSTRAINT oc_op_sequence_uq ON public.org_order_change_ops_dtl IS
  'Prevents repeated operation sequence values in a tenant-qualified Change and supports ordered aggregate loading.';
COMMENT ON INDEX public.oc_op_sequence_uq IS
  'Constraint-backed identity/uniqueness index: Prevents repeated operation sequence values in a tenant-qualified Change and supports ordered aggregate loading.';
COMMENT ON CONSTRAINT oc_op_sequence_ck ON public.org_order_change_ops_dtl IS
  'Requires positive operation numbering for deterministic audit sequencing.';
COMMENT ON CONSTRAINT oc_op_catalog_ck ON public.org_order_change_ops_dtl IS
  'Limits applied operations and affected-fact categories to the frozen V1 catalog.';
COMMENT ON CONSTRAINT oc_op_target_ck ON public.org_order_change_ops_dtl IS
  'Requires typed persisted target identities appropriate to each operation, including newly preallocated creation identities.';
COMMENT ON CONSTRAINT oc_op_json_ck ON public.org_order_change_ops_dtl IS
  'Keeps operation snapshots and metadata object-shaped and retains a nonblank standard insertion actor audit field.';
COMMENT ON CONSTRAINT oc_op_lifecycle_ck ON public.org_order_change_ops_dtl IS
  'Keeps applied operations visible and excludes update audit facts; operation history cannot be soft-erased.';
COMMENT ON CONSTRAINT oc_op_change_fk ON public.org_order_change_ops_dtl IS
  'Binds every operation to its applied aggregate original order and tenant; aggregate history cannot be deleted or retargeted.';
COMMENT ON CONSTRAINT oc_op_item_fk ON public.org_order_change_ops_dtl IS
  'Retains tenant-qualified historical item identity with RESTRICT while allowing current parent order movement.';
COMMENT ON CONSTRAINT oc_op_piece_fk ON public.org_order_change_ops_dtl IS
  'Retains tenant-qualified historical piece identity with RESTRICT without binding history to current item/order tuples.';
COMMENT ON CONSTRAINT oc_op_pref_fk ON public.org_order_change_ops_dtl IS
  'Retains tenant-qualified historical preference identity with RESTRICT without binding history to current parent tuples.';
COMMENT ON INDEX public.oc_change_order_time_ix IS
  'Supports newest-first applied Change history within a tenant and order.';
COMMENT ON INDEX public.oc_change_created_ix IS
  'Supports tenant-wide recent Change support queries independently of an order.';
COMMENT ON INDEX public.oc_change_status_ix IS
  'Retains the standard tenant-status support access shape; applied status is invariant, so no selective filtering benefit is assumed.';
COMMENT ON INDEX public.oc_change_active_ix IS
  'Retains the standard tenant-active support access shape; applied active state is invariant, so no selective filtering benefit is assumed.';
COMMENT ON INDEX public.oc_op_order_change_ix IS
  'Supports tenant-and-order operation loading alongside the Change-sequence UNIQUE access path.';
COMMENT ON INDEX public.oc_op_item_ix IS
  'Supports tenant-qualified item audit identity lookups after current parent movement.';
COMMENT ON INDEX public.oc_op_piece_ix IS
  'Supports tenant-qualified piece audit identity lookups without relying on current parents.';
COMMENT ON INDEX public.oc_op_pref_ix IS
  'Supports tenant-qualified preference audit identity lookups without relying on current scope.';
COMMENT ON INDEX public.oc_op_created_ix IS
  'Supports newest-first tenant operation audit/support queries.';
COMMENT ON INDEX public.oc_op_status_ix IS
  'Retains the standard tenant-status support shape; immutable applied status is not assumed to be selective.';
COMMENT ON INDEX public.oc_op_active_ix IS
  'Retains the standard tenant-active support shape; immutable active state is not assumed to be selective.';
COMMENT ON COLUMN public.org_order_items_dtl.deleted_at IS
  'Governed removal timestamp; legacy inactive rows may remain NULL without fabricated V2 lineage.';
COMMENT ON COLUMN public.org_order_items_dtl.deleted_by IS
  'auth.users actor required for governed removal; legacy unknown attribution is not backfilled by this migration.';
COMMENT ON COLUMN public.org_order_items_dtl.deleted_order_change_id IS
  'Preallocated applied Change identity establishing removal lineage; tenant-qualified deferred FK must resolve by COMMIT.';
COMMENT ON CONSTRAINT oc_item_removal_ck ON public.org_order_items_dtl IS
  'Requires complete V2 removal lineage with explicit non-NULL rec_status=0; historical inactive or NULL rows without lineage remain unclassified.';
COMMENT ON CONSTRAINT oc_item_removal_actor_fk ON public.org_order_items_dtl IS
  'Validates governed removal attribution against auth.users and restricts actor deletion; historical NULL actors are not fabricated.';
COMMENT ON CONSTRAINT oc_item_removal_change_fk ON public.org_order_items_dtl IS
  'Tenant-qualified removal lineage existence is deferred until COMMIT to permit one final Change INSERT; referenced identity UPDATE/DELETE RESTRICT remains immediate.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.deleted_at IS
  'Governed removal timestamp; legacy inactive rows may remain NULL without fabricated V2 lineage.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.deleted_by IS
  'auth.users actor required for governed removal; legacy unknown attribution is not backfilled by this migration.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.deleted_order_change_id IS
  'Preallocated applied Change identity establishing removal lineage; tenant-qualified deferred FK must resolve by COMMIT.';
COMMENT ON CONSTRAINT oc_piece_removal_ck ON public.org_order_item_pieces_dtl IS
  'Requires complete V2 removal lineage with explicit non-NULL rec_status=0; historical inactive or NULL rows without lineage remain unclassified.';
COMMENT ON CONSTRAINT oc_piece_removal_actor_fk ON public.org_order_item_pieces_dtl IS
  'Validates governed removal attribution against auth.users and restricts actor deletion; historical NULL actors are not fabricated.';
COMMENT ON CONSTRAINT oc_piece_removal_change_fk ON public.org_order_item_pieces_dtl IS
  'Tenant-qualified removal lineage existence is deferred until COMMIT to permit one final Change INSERT; referenced identity UPDATE/DELETE RESTRICT remains immediate.';
COMMENT ON COLUMN public.org_order_preferences_dtl.deleted_at IS
  'Governed removal timestamp; legacy inactive rows may remain NULL without fabricated V2 lineage.';
COMMENT ON COLUMN public.org_order_preferences_dtl.deleted_by IS
  'auth.users actor required for governed removal; legacy unknown attribution is not backfilled by this migration.';
COMMENT ON COLUMN public.org_order_preferences_dtl.deleted_order_change_id IS
  'Preallocated applied Change identity establishing removal lineage; tenant-qualified deferred FK must resolve by COMMIT.';
COMMENT ON CONSTRAINT oc_pref_removal_ck ON public.org_order_preferences_dtl IS
  'Requires complete V2 removal lineage with explicit non-NULL rec_status=0; historical inactive or NULL rows without lineage remain unclassified.';
COMMENT ON CONSTRAINT oc_pref_removal_actor_fk ON public.org_order_preferences_dtl IS
  'Validates governed removal attribution against auth.users and restricts actor deletion; historical NULL actors are not fabricated.';
COMMENT ON CONSTRAINT oc_pref_removal_change_fk ON public.org_order_preferences_dtl IS
  'Tenant-qualified removal lineage existence is deferred until COMMIT to permit one final Change INSERT; referenced identity UPDATE/DELETE RESTRICT remains immediate.';
COMMENT ON INDEX public.oc_item_removal_ix IS
  'Supports sparse tenant-qualified item removal evidence and Change reference checks without indexing unresolved legacy NULL lineage.';
COMMENT ON INDEX public.oc_piece_removal_ix IS
  'Supports sparse tenant-qualified piece removal evidence and Change reference checks without indexing unresolved legacy NULL lineage.';
COMMENT ON INDEX public.oc_pref_removal_ix IS
  'Supports sparse tenant-qualified preference removal evidence and Change reference checks without indexing unresolved legacy NULL lineage.';
COMMENT ON FUNCTION public.oc_deny_history_mutation() IS
  'SECURITY INVOKER trigger with fixed pg_catalog search_path; rejects applied history UPDATE, DELETE and TRUNCATE even through ordinary owner or BYPASSRLS runtime DML.';
COMMENT ON TRIGGER oc_change_immutable ON public.org_order_changes_mst IS
  'Rejects row UPDATE/DELETE so the one complete applied Change INSERT remains the immutable commercial fact.';
COMMENT ON TRIGGER oc_change_no_truncate ON public.org_order_changes_mst IS
  'Rejects statement TRUNCATE, which row mutation triggers and RLS cannot prevent.';
COMMENT ON TRIGGER oc_op_immutable ON public.org_order_change_ops_dtl IS
  'Rejects operation row UPDATE/DELETE so target identities and snapshots cannot be rewritten.';
COMMENT ON TRIGGER oc_op_no_truncate ON public.org_order_change_ops_dtl IS
  'Rejects statement TRUNCATE to preserve immutable operation history beyond row-level protections.';
COMMENT ON FUNCTION public.oc_guard_removed_fact() IS
  'SECURITY INVOKER trigger with fixed pg_catalog search_path; freezes governed removed facts while leaving legacy rows without V2 lineage unchanged.';
COMMENT ON TRIGGER oc_item_removed_guard ON public.org_order_items_dtl IS
  'Prevents deletion, reactivation, reparenting or value mutation of items carrying governed V2 removal lineage.';
COMMENT ON TRIGGER oc_piece_removed_guard ON public.org_order_item_pieces_dtl IS
  'Prevents deletion, reactivation, reparenting or value mutation of pieces carrying governed V2 removal lineage.';
COMMENT ON TRIGGER oc_pref_removed_guard ON public.org_order_preferences_dtl IS
  'Prevents deletion, reactivation, reparenting or value mutation of preferences carrying governed V2 removal lineage.';
COMMENT ON TABLE public.org_order_item_pieces_dtl IS
  'Items Pieces, Optional table if in settings USE_TRACK_BY_PIECE is true. WP02 adds stable tenant-qualified historical identity and governed removal lineage; live parent enforcement remains separately gated.';
COMMENT ON TABLE public.org_order_items_dtl IS
  'Order line items (detail). WP02 adds governed removal lineage without reclassifying legacy rec_status or changing commercial precision.';
COMMENT ON TABLE public.org_order_preferences_dtl IS
  'Unified order preferences at ORDER/ITEM/PIECE level (replaces org_order_item_service_prefs and org_order_item_pc_prefs). WP02 adds stable tenant-qualified historical identity and governed removal lineage; live parent enforcement remains separately gated.';

COMMIT;
