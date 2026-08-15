-- ==================================================================
-- 0448_pickup_cutover_integrity.sql
-- Purpose: Harden the 0447 ready-for-pickup rollout with a final
--          reconciliation, release invariant validation, and DB uniqueness.
-- Dependencies: 0428_org_wf_release_records.sql,
--               0446_pickup_handover_workflow.sql,
--               0447_ready_for_pickup_workflow_status.sql
--
-- Deployment: Pause pickup/release workflow writes while 0447 and this
-- migration run. The reconciliation handles work committed during the 0447
-- cutover window; pausing writes prevents an already-running legacy request
-- from committing after this final integrity assertion.
-- ==================================================================

BEGIN;

-- Backfill the workflow version on historical direct counter handovers. The
-- workflow history is authoritative because it records the committed version.
WITH handover_history AS (
  SELECT DISTINCT ON (history.tenant_org_id, history.order_id)
    history.tenant_org_id,
    history.order_id,
    (history.payload ->> 'stateVersion')::bigint AS state_version
  FROM public.org_order_history AS history
  WHERE history.action_type = 'STATUS_CHANGE'
    AND history.to_value = 'delivered'
    AND history.payload ->> 'actionCode' = 'CONFIRM_PICKUP'
    AND COALESCE(history.payload ->> 'stateVersion', '') ~ '^[0-9]+$'
  ORDER BY history.tenant_org_id, history.order_id, history.done_at DESC
)
UPDATE public.org_wf_release_mst AS release
SET state_version_at = handover_history.state_version,
    updated_at = CURRENT_TIMESTAMP
FROM handover_history
WHERE release.tenant_org_id = handover_history.tenant_org_id
  AND release.order_id = handover_history.order_id
  AND release.release_type = 'pickup'
  AND release.release_status = 'fulfilled'
  AND release.state_version_at IS NULL
  AND COALESCE(release.rec_status, 1) = 1;

-- A request that read the old same-status mapping immediately before 0447 can
-- commit a released pickup record after 0447's first backfill. Reconcile it
-- again here before the final invariant check.
WITH open_pickup_release AS (
  SELECT DISTINCT ON (release.tenant_org_id, release.order_id)
    release.tenant_org_id,
    release.order_id,
    release.released_at,
    release.released_by,
    release.id
  FROM public.org_wf_release_mst AS release
  WHERE release.release_type = 'pickup'
    AND release.release_status = 'released'
    AND COALESCE(release.rec_status, 1) = 1
  ORDER BY
    release.tenant_org_id,
    release.order_id,
    release.released_at DESC NULLS LAST,
    release.id DESC
), reconciled_orders AS (
  UPDATE public.org_orders_mst AS orders
  SET
    current_status = 'ready_for_pickup',
    status = 'ready_for_pickup',
    state_version = COALESCE(orders.state_version, 0) + 1,
    last_transition_at = COALESCE(open_pickup_release.released_at, CURRENT_TIMESTAMP),
    last_transition_by = open_pickup_release.released_by,
    updated_at = CURRENT_TIMESTAMP
  FROM open_pickup_release
  WHERE orders.id = open_pickup_release.order_id
    AND orders.tenant_org_id = open_pickup_release.tenant_org_id
    AND COALESCE(orders.current_status, orders.status) = 'ready'
  RETURNING
    orders.id,
    orders.tenant_org_id,
    open_pickup_release.released_at,
    open_pickup_release.released_by,
    open_pickup_release.id AS release_id,
    orders.state_version
)
INSERT INTO public.org_order_history (
  tenant_org_id,
  order_id,
  action_type,
  from_value,
  to_value,
  done_by,
  done_at,
  payload
)
SELECT
  reconciled.tenant_org_id,
  reconciled.id,
  'STATUS_CHANGE',
  'ready',
  'ready_for_pickup',
  reconciled.released_by,
  COALESCE(reconciled.released_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'actionCode', 'RELEASE_FOR_PICKUP',
    'stateVersion', reconciled.state_version,
    'releaseId', reconciled.release_id,
    'migration', '0448_pickup_cutover_integrity',
    'reason', 'Reconciled legacy pickup release during ready-for-pickup cutover'
  )
FROM reconciled_orders AS reconciled
WHERE NOT EXISTS (
  SELECT 1
  FROM public.org_order_history AS history
  WHERE history.tenant_org_id = reconciled.tenant_org_id
    AND history.order_id = reconciled.id
    AND history.action_type = 'STATUS_CHANGE'
    AND history.from_value = 'ready'
    AND history.to_value = 'ready_for_pickup'
    AND history.payload ->> 'releaseId' = reconciled.release_id::text
);

-- A full pickup release is singleton per order while it remains open. This is
-- defense in depth for every client, not only the workflow-engine pre-check.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wf_rel_open_pickup
  ON public.org_wf_release_mst (tenant_org_id, order_id)
  WHERE release_type = 'pickup'
    AND release_status = 'released'
    AND COALESCE(rec_status, 1) = 1;

-- Do not proceed with a split-brain workflow state. These errors identify the
-- exact records that require operator remediation before production cutover.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.org_orders_mst AS orders
    INNER JOIN public.org_wf_release_mst AS release
      ON release.tenant_org_id = orders.tenant_org_id
      AND release.order_id = orders.id
      AND release.release_type = 'pickup'
      AND release.release_status = 'released'
      AND COALESCE(release.rec_status, 1) = 1
    WHERE COALESCE(orders.current_status, orders.status) = 'ready'
  ) THEN
    RAISE EXCEPTION
      'Pickup cutover failed: a ready order still has an active pickup release.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.org_orders_mst AS orders
    WHERE COALESCE(orders.current_status, orders.status) = 'ready_for_pickup'
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_wf_release_mst AS release
        WHERE release.tenant_org_id = orders.tenant_org_id
          AND release.order_id = orders.id
          AND release.release_type = 'pickup'
          AND release.release_status = 'released'
          AND COALESCE(release.rec_status, 1) = 1
      )
  ) THEN
    RAISE EXCEPTION
      'Pickup cutover failed: a ready_for_pickup order has no active pickup release.';
  END IF;
END;
$$;

COMMIT;
