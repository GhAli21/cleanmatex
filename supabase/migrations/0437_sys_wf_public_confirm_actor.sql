-- ==================================================================
-- 0437_sys_wf_public_confirm_actor.sql
-- Purpose: P4 — system actor for unauthenticated public confirm-received
--          + ready→delivered edge for pickup public tracking
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: 0427, 0436
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Well-known system actor (satisfies org_order_history.done_by FK)
-- Constant: web-admin/lib/constants/workflow-system-actor.ts
-- ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users missing — skip workflow system actor seed';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = 'a11ce000-0000-4000-8000-00000000f001'::uuid
  ) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'a11ce000-0000-4000-8000-00000000f001'::uuid,
    'authenticated',
    'authenticated',
    'workflow-system@cleanmatex.internal',
    extensions.crypt('disabled-no-login', extensions.gen_salt('bf')),
    CURRENT_TIMESTAMP,
    '{"provider":"system","providers":["system"]}'::jsonb,
    '{"full_name":"Workflow System","name":"Workflow System","is_system":true}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    false
  );
END $$;

-- ------------------------------------------------------------------
-- 2) Public tracking screen + membership
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_screens_cd (screen_key, name, name2, display_order)
VALUES ('public_tracking', 'Public tracking', 'التتبع العام', 96)
ON CONFLICT (screen_key) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order, is_active)
VALUES
  ('public_tracking', 'ready',            10, true),
  ('public_tracking', 'out_for_delivery', 20, true),
  ('public_tracking', 'delivered',        30, true)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------
-- 3) ready → delivered (pickup confirm via public link)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_READY_DELIV', 'ready', 'delivered', NULL, 'orders:transition',
   'Confirm received from ready', 'تأكيد الاستلام من الجاهز')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key, is_active)
SELECT v.action_code, t.id, 'public_tracking', true
FROM (VALUES
  ('CONFIRM_DELIVERY', 'TR_READY_DELIV'),
  ('CONFIRM_DELIVERY', 'TR_OFD_DELIV')
) AS v(action_code, transition_code)
JOIN public.sys_wf_transitions_cd t ON t.transition_code = v.transition_code
ON CONFLICT (action_code, transition_id, screen_key) DO UPDATE
SET is_active = true;

COMMIT;
