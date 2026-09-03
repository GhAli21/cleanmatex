-- ============================================================
-- Migration: 0483_wf_home_collection_catalog.sql
-- Purpose:   T2 global catalogs for home collection fulfilment:
--            order types, workflow statuses, screen, transitions,
--            actions, action bindings, initial-rule catalog codes.
--            Widen evidence fulfilment_channel for home_collection.
-- Related:   04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md §3.3–3.4
-- ============================================================
-- Do not edit applied 0470–0482. Agents never apply this migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Fulfilment order types (distinct from PICKUP = branch collect)
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_order_type_cd (
  order_type_id,
  order_type_name,
  order_type_name2,
  is_active,
  order_type_icon,
  order_type_color1,
  order_type_color2,
  order_type_color3,
  rec_order,
  rec_status,
  rec_notes,
  created_at,
  updated_at,
  created_info,
  updated_info
) VALUES
  (
    'HOME_COLLECTION',
    'Home collection',
    'استلام من المنزل',
    true,
    'Home',
    '#0D9488',
    '#0F766E',
    '#CCFBF1',
    35,
    1,
    'Driver collects dirty items from customer; plant flow after confirm',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '0483_wf_home_collection_catalog',
    '0483_wf_home_collection_catalog'
  ),
  (
    'COLLECTION_AND_DELIVERY',
    'Collection & delivery',
    'جمع وتوصيل',
    true,
    'Route',
    '#2563EB',
    '#1D4ED8',
    '#DBEAFE',
    36,
    1,
    'Inbound home collection plus outbound clean delivery',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '0483_wf_home_collection_catalog',
    '0483_wf_home_collection_catalog'
  )
ON CONFLICT (order_type_id) DO UPDATE SET
  order_type_name = EXCLUDED.order_type_name,
  order_type_name2 = EXCLUDED.order_type_name2,
  is_active = EXCLUDED.is_active,
  order_type_icon = EXCLUDED.order_type_icon,
  order_type_color1 = EXCLUDED.order_type_color1,
  order_type_color2 = EXCLUDED.order_type_color2,
  order_type_color3 = EXCLUDED.order_type_color3,
  rec_order = EXCLUDED.rec_order,
  rec_status = EXCLUDED.rec_status,
  rec_notes = EXCLUDED.rec_notes,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.updated_info;

-- ---------------------------------------------------------------------------
-- 2) Workflow statuses (inbound driver leg — distinct from out_for_delivery)
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_statuses_cd (
  status_code, name, name2, display_order, is_terminal
) VALUES
  (
    'awaiting_collection',
    'Awaiting collection',
    'في انتظار الاستلام',
    15,
    false
  ),
  (
    'out_for_collection',
    'Out for collection',
    'خارج للاستلام',
    85,
    false
  )
ON CONFLICT (status_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 3) Screen + platform screen↔status membership
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_screens_cd (screen_key, name, name2, display_order)
VALUES (
  'home_collection',
  'Home collection',
  'استلام من المنزل',
  15
)
ON CONFLICT (screen_key) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order)
VALUES
  ('home_collection', 'awaiting_collection', 10),
  ('home_collection', 'out_for_collection', 20)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 4) Transitions (stable transition_code for upsert)
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  (
    'TR_HC_AWAIT_OFC',
    'awaiting_collection',
    'out_for_collection',
    NULL,
    'orders:transition',
    'Assign home collection',
    'تعيين استلام من المنزل'
  ),
  (
    'TR_HC_OFC_INTAKE',
    'out_for_collection',
    'intake',
    NULL,
    'orders:transition',
    'Confirm home collection → intake',
    'تأكيد الاستلام → استلام المصنع'
  ),
  (
    'TR_HC_OFC_FAIL',
    'out_for_collection',
    'awaiting_collection',
    NULL,
    'orders:transition',
    'Fail home collection (retry)',
    'فشل الاستلام (إعادة المحاولة)'
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

-- ---------------------------------------------------------------------------
-- 5) Actions
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_actions_cd (
  action_code, name, name2, permission_code, display_order
) VALUES
  (
    'ASSIGN_HOME_COLLECTION',
    'Assign home collection',
    'تعيين استلام من المنزل',
    'orders:transition',
    115
  ),
  (
    'CONFIRM_HOME_COLLECTION',
    'Confirm home collection',
    'تأكيد الاستلام من المنزل',
    'orders:transition',
    116
  ),
  (
    'FAIL_HOME_COLLECTION',
    'Fail home collection',
    'فشل الاستلام من المنزل',
    'orders:transition',
    117
  )
ON CONFLICT (action_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  permission_code = EXCLUDED.permission_code,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 6) Action ↔ transition ↔ screen bindings
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'ASSIGN_HOME_COLLECTION', transition_row.id, 'home_collection'
FROM public.sys_wf_transitions_cd AS transition_row
WHERE transition_row.transition_code = 'TR_HC_AWAIT_OFC'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'CONFIRM_HOME_COLLECTION', transition_row.id, 'home_collection'
FROM public.sys_wf_transitions_cd AS transition_row
WHERE transition_row.transition_code = 'TR_HC_OFC_INTAKE'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'FAIL_HOME_COLLECTION', transition_row.id, 'home_collection'
FROM public.sys_wf_transitions_cd AS transition_row
WHERE transition_row.transition_code = 'TR_HC_OFC_FAIL'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) Initial-rule catalog codes (profile init_cf references rule_code FK)
-- ---------------------------------------------------------------------------
INSERT INTO public.sys_wf_initial_rules_cd (
  rule_code, order_source_code, order_type_id, is_retail, initial_status,
  priority, name, name2, is_active
) VALUES
  (
    'INIT_MOBILE_HOME_COLLECTION',
    'customer_mobile_app',
    'HOME_COLLECTION',
    false,
    'awaiting_collection',
    40,
    'Mobile home collection → awaiting_collection',
    'تطبيق العميل استلام منزل → انتظار الاستلام',
    true
  ),
  (
    'INIT_MOBILE_CND',
    'customer_mobile_app',
    'COLLECTION_AND_DELIVERY',
    false,
    'awaiting_collection',
    45,
    'Mobile collect & deliver → awaiting_collection',
    'تطبيق العميل جمع وتوصيل → انتظار الاستلام',
    true
  )
ON CONFLICT (rule_code) DO UPDATE SET
  order_source_code = EXCLUDED.order_source_code,
  order_type_id = EXCLUDED.order_type_id,
  is_retail = EXCLUDED.is_retail,
  initial_status = EXCLUDED.initial_status,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 8) Evidence policy channel widen (profile rows seeded in 0484)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sys_wf_prof_ver_evidence_cf
  DROP CONSTRAINT IF EXISTS chk_wf_prof_ev_channel;

ALTER TABLE public.sys_wf_prof_ver_evidence_cf
  ADD CONSTRAINT chk_wf_prof_ev_channel CHECK (
    fulfilment_channel IN ('pickup', 'delivery', 'home_collection')
  );

COMMENT ON CONSTRAINT chk_wf_prof_ev_channel ON public.sys_wf_prof_ver_evidence_cf IS
  'Fulfilment paths for evidence policy: branch pickup, outbound delivery, inbound home collection.';

COMMIT;
