-- ==================================================================
-- 0446_pickup_handover_workflow.sql
-- Purpose: Add the staff-owned pickup handover action and auditable
--          fulfilment fields without changing the existing release semantics.
-- Dependencies: 0427_sys_wf_catalogs_and_state_version.sql,
--               0428_org_wf_release_records.sql,
--               0437_sys_wf_public_confirm_actor.sql
--
-- `RELEASE_FOR_PICKUP` means an order is available at the counter and
-- deliberately remains ready. `CONFIRM_PICKUP` records the actual physical
-- handover and moves ready -> delivered through the workflow engine.
-- ==================================================================

BEGIN;

-- Keep the availability action distinct from the final customer handover.
UPDATE public.sys_wf_actions_cd
SET
  name = 'Make available for pickup',
  name2 = 'إتاحة للاستلام',
  updated_at = CURRENT_TIMESTAMP
WHERE action_code = 'RELEASE_FOR_PICKUP';

INSERT INTO public.sys_wf_screens_cd (screen_key, name, name2, display_order, is_active)
VALUES (
  'pickup_handover',
  'Pickup handover',
  'تسليم الطلب الجاهز',
  97,
  true
)
ON CONFLICT (screen_key) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order, is_active)
VALUES ('pickup_handover', 'ready', 10, true)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO public.sys_wf_actions_cd (
  action_code,
  name,
  name2,
  permission_code,
  display_order,
  is_active
) VALUES (
  'CONFIRM_PICKUP',
  'Confirm customer pickup',
  'تأكيد استلام العميل',
  'orders:transition',
  115,
  true
)
ON CONFLICT (action_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  permission_code = EXCLUDED.permission_code,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

DO $$
DECLARE
  v_transition_id UUID;
BEGIN
  SELECT id
  INTO v_transition_id
  FROM public.sys_wf_transitions_cd
  WHERE transition_code = 'TR_READY_DELIV'
    AND is_active = true;

  IF v_transition_id IS NULL THEN
    RAISE EXCEPTION 'Required workflow transition TR_READY_DELIV is missing or inactive';
  END IF;

  INSERT INTO public.sys_wf_action_trans_cd (
    action_code,
    transition_id,
    screen_key,
    is_active
  ) VALUES (
    'CONFIRM_PICKUP',
    v_transition_id,
    'pickup_handover',
    true
  )
  ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE SET
    is_active = true;
END $$;

-- `updated_at` alone cannot distinguish staging from a completed handover.
ALTER TABLE public.org_wf_release_mst
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_by UUID,
  ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;

ALTER TABLE public.org_wf_release_mst
  DROP CONSTRAINT IF EXISTS chk_org_wf_rel_fulfilled,
  ADD CONSTRAINT chk_org_wf_rel_fulfilled CHECK (
    release_status <> 'fulfilled'
    OR (fulfilled_at IS NOT NULL AND fulfilled_by IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_org_wf_rel_tenant_state
  ON public.org_wf_release_mst (
    tenant_org_id,
    order_id,
    release_type,
    release_status
  );

COMMENT ON COLUMN public.org_wf_release_mst.fulfilled_at IS
  'Timestamp of the actual customer handover, distinct from release availability.';

COMMENT ON COLUMN public.org_wf_release_mst.fulfilled_by IS
  'Authenticated staff actor who confirmed the physical customer handover.';

COMMENT ON COLUMN public.org_wf_release_mst.fulfillment_notes IS
  'Optional staff handover note retained with the pickup fulfilment audit.';

COMMIT;
