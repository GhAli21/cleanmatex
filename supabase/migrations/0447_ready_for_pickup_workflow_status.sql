-- ==================================================================
-- 0447_ready_for_pickup_workflow_status.sql
-- Purpose: Promote counter-pickup availability to a canonical workflow status.
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql,
--               0428_org_wf_release_records.sql,
--               0437_sys_wf_public_confirm_actor.sql,
--               0446_pickup_handover_workflow.sql
--
-- WHY: `ready` means work is complete but not released. A customer collection
-- must be visible to every staff, mobile, and integration consumer as its own
-- audited state: ready -> ready_for_pickup -> delivered.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Canonical status and screen membership
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_statuses_cd (
  status_code, name, name2, display_order, is_terminal, is_active
) VALUES (
  'ready_for_pickup', 'Ready for pickup', 'جاهز للاستلام', 85, false, true
)
ON CONFLICT (status_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_screen_status_cd (
  screen_key, status_code, display_order, is_active
) VALUES
  ('ready_release', 'ready_for_pickup', 20, true),
  ('pickup_handover', 'ready_for_pickup', 10, true),
  ('public_tracking', 'ready_for_pickup', 20, true)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = true;

-- The handover screen supports both staged collection (`ready_for_pickup`) and
-- an explicit direct counter handover from `ready` when the customer is present.
UPDATE public.sys_wf_screen_status_cd
SET is_active = true
WHERE screen_key = 'pickup_handover'
  AND status_code = 'ready';

-- ------------------------------------------------------------------
-- 2) Replace the legacy same-status release edge with a real transition
-- ------------------------------------------------------------------
UPDATE public.sys_wf_action_trans_cd AS action_transition
SET is_active = false
FROM public.sys_wf_transitions_cd AS transition
WHERE action_transition.transition_id = transition.id
  AND action_transition.action_code = 'RELEASE_FOR_PICKUP'
  AND action_transition.screen_key = 'ready_release'
  AND transition.transition_code = 'REL_READY_PICKUP';

UPDATE public.sys_wf_transitions_cd
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE transition_code = 'REL_READY_PICKUP';

INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES (
  'TR_READY_PICKUP',
  'ready',
  'ready_for_pickup',
  'fin_release_eligible,rack_required',
  'orders:transition',
  'Make available for pickup',
  'إتاحة للاستلام'
)
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_action_trans_cd (
  action_code, transition_id, screen_key, is_active
)
SELECT 'RELEASE_FOR_PICKUP', transition.id, 'ready_release', true
FROM public.sys_wf_transitions_cd AS transition
WHERE transition.transition_code = 'TR_READY_PICKUP'
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE SET
  is_active = true;

UPDATE public.sys_wf_action_trans_cd AS action_transition
SET is_active = true
FROM public.sys_wf_transitions_cd AS transition
WHERE action_transition.transition_id = transition.id
  AND action_transition.action_code = 'CONFIRM_PICKUP'
  AND action_transition.screen_key = 'pickup_handover'
  AND transition.transition_code = 'TR_READY_DELIV';

-- Public tracking delegates pickup confirmation to the pickup-handover service.
-- Removing this obsolete map prevents any generic engine caller from skipping
-- the release and collection safeguards through the public screen contract.
UPDATE public.sys_wf_action_trans_cd AS action_transition
SET is_active = false
FROM public.sys_wf_transitions_cd AS transition
WHERE action_transition.transition_id = transition.id
  AND action_transition.action_code = 'CONFIRM_DELIVERY'
  AND action_transition.screen_key = 'public_tracking'
  AND transition.transition_code = 'TR_READY_DELIV';

INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES (
  'TR_PICKUP_DELIV',
  'ready_for_pickup',
  'delivered',
  NULL,
  'orders:transition',
  'Confirm customer pickup',
  'تأكيد استلام العميل'
)
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_action_trans_cd (
  action_code, transition_id, screen_key, is_active
)
SELECT 'CONFIRM_PICKUP', transition.id, 'pickup_handover', true
FROM public.sys_wf_transitions_cd AS transition
WHERE transition.transition_code = 'TR_PICKUP_DELIV'
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE SET
  is_active = true;

-- ------------------------------------------------------------------
-- 3) Keep Ready worklists and public tracking contracts in sync
-- ------------------------------------------------------------------
UPDATE public.org_ord_screen_contracts_cf
SET
  pre_conditions = jsonb_set(
    COALESCE(pre_conditions, '{}'::jsonb),
    '{statuses}',
    (
      SELECT jsonb_agg(status_code ORDER BY sort_order)
      FROM (
        SELECT value AS status_code, ordinality AS sort_order
        FROM jsonb_array_elements_text(
          COALESCE(pre_conditions -> 'statuses', '[]'::jsonb)
        ) WITH ORDINALITY
        UNION ALL
        SELECT 'ready_for_pickup', 2147483647
        WHERE NOT (
          COALESCE(pre_conditions -> 'statuses', '[]'::jsonb)
          @> '["ready_for_pickup"]'::jsonb
        )
      ) AS statuses
    ),
    true
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE screen_key = 'ready'
  AND COALESCE(is_active, true) = true
  AND COALESCE(pre_conditions -> 'statuses', '[]'::jsonb) @> '["ready"]'::jsonb;

-- ------------------------------------------------------------------
-- 4) Backfill active legacy pickup releases without losing their audit time.
-- Existing release records are the historical proof that the order was made
-- available. Their preserved release timestamp/actor become the status audit.
-- ------------------------------------------------------------------
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
), migrated_orders AS (
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
  migrated.tenant_org_id,
  migrated.id,
  'STATUS_CHANGE',
  'ready',
  'ready_for_pickup',
  migrated.released_by,
  COALESCE(migrated.released_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'actionCode', 'RELEASE_FOR_PICKUP',
    'stateVersion', migrated.state_version,
    'releaseId', migrated.release_id,
    'migration', '0447_ready_for_pickup_workflow_status',
    'reason', 'Backfilled active pickup release as canonical workflow status'
  )
FROM migrated_orders AS migrated
WHERE NOT EXISTS (
  SELECT 1
  FROM public.org_order_history AS history
  WHERE history.tenant_org_id = migrated.tenant_org_id
    AND history.order_id = migrated.id
    AND history.action_type = 'STATUS_CHANGE'
    AND history.from_value = 'ready'
    AND history.to_value = 'ready_for_pickup'
    AND history.payload ->> 'releaseId' = migrated.release_id::text
);

COMMIT;
