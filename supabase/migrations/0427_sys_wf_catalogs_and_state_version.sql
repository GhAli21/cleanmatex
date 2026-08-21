-- ==================================================================
-- 0427_sys_wf_catalogs_and_state_version.sql
-- Purpose: Workflow Order Advance V1.0 — additive sys_wf_* catalogs,
--          org profile assignment, order state_version + snapshot cols,
--          V1.0 seed graph (no sorting writes).
-- Author: CleanMateX Development Team
-- Created: 2026-07-24
-- Dependencies: org_orders_mst, org_domain_events_outbox (reuse)
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1) Order header concurrency + profile snapshot (additive)
-- ------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS state_version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS wf_profile_id UUID;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS wf_version_no INTEGER;

COMMENT ON COLUMN public.org_orders_mst.state_version IS
  'Optimistic concurrency for WorkflowEngine executeAction (V1.0).';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_id IS
  'HQ workflow profile snapshot at order create (nullable until assigned).';
COMMENT ON COLUMN public.org_orders_mst.wf_version_no IS
  'Published profile version number snapshot at order create.';

CREATE INDEX IF NOT EXISTS idx_org_ord_state_ver
  ON public.org_orders_mst (tenant_org_id, state_version);

-- ------------------------------------------------------------------
-- 2) Catalog: statuses
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_statuses_cd (
  status_code   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_terminal   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ,
  rec_status    SMALLINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.sys_wf_statuses_cd IS
  'Workflow operational status catalog (V1.0 worklist codes).';

-- ------------------------------------------------------------------
-- 3) Catalog: screens
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_screens_cd (
  screen_key    TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ,
  rec_status    SMALLINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.sys_wf_screens_cd IS
  'Workflow UI screen keys (mirror WORKFLOW_SCREEN_KEYS).';

-- ------------------------------------------------------------------
-- 4) Screen ↔ status membership
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_screen_status_cd (
  screen_key   TEXT NOT NULL REFERENCES public.sys_wf_screens_cd (screen_key),
  status_code  TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (screen_key, status_code)
);

CREATE INDEX IF NOT EXISTS idx_sys_wf_scr_st_status
  ON public.sys_wf_screen_status_cd (status_code);

-- ------------------------------------------------------------------
-- 5) Transitions (edges)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_transitions_cd (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_code  TEXT NOT NULL UNIQUE,
  from_status      TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code),
  to_status        TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code),
  gate_set_code    TEXT,
  permission_code  TEXT,
  name             TEXT,
  name2            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_system        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ,
  rec_status       SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_sys_wf_tr_from_to CHECK (from_status IS DISTINCT FROM to_status OR transition_code LIKE 'REL_%')
);

CREATE INDEX IF NOT EXISTS idx_sys_wf_tr_from
  ON public.sys_wf_transitions_cd (from_status)
  WHERE COALESCE(is_active, true) = true;

-- ------------------------------------------------------------------
-- 6) Actions
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_actions_cd (
  action_code      TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  name2            TEXT,
  description      TEXT,
  description2     TEXT,
  permission_code  TEXT,
  display_order    INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_system        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ,
  rec_status       SMALLINT NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------------
-- 7) Action → transition (per screen)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_action_trans_cd (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code    TEXT NOT NULL REFERENCES public.sys_wf_actions_cd (action_code),
  transition_id  UUID NOT NULL REFERENCES public.sys_wf_transitions_cd (id),
  screen_key     TEXT NOT NULL REFERENCES public.sys_wf_screens_cd (screen_key),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_sys_wf_act_tr UNIQUE (action_code, transition_id, screen_key)
);

CREATE INDEX IF NOT EXISTS idx_sys_wf_act_tr_screen
  ON public.sys_wf_action_trans_cd (screen_key, action_code)
  WHERE COALESCE(is_active, true) = true;

-- ------------------------------------------------------------------
-- 8) Initial status rules
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_initial_rules_cd (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code          TEXT NOT NULL UNIQUE,
  order_source_code  TEXT,
  order_type_id      TEXT,
  is_retail          BOOLEAN,
  initial_status     TEXT NOT NULL REFERENCES public.sys_wf_statuses_cd (status_code),
  priority           INTEGER NOT NULL DEFAULT 100,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  name               TEXT,
  name2              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ,
  rec_status         SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sys_wf_init_pri
  ON public.sys_wf_initial_rules_cd (priority)
  WHERE COALESCE(is_active, true) = true;

-- ------------------------------------------------------------------
-- 9) Gate definitions (catalog only; evaluators in app engine)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_wf_gate_defs_cd (
  gate_code     TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name2         TEXT,
  description   TEXT,
  description2  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ,
  rec_status    SMALLINT NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------------
-- 10) Tenant profile assignment (HQ assigns; tenant read/pick later)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_wf_profile_assign_cf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  wf_profile_id   UUID NOT NULL,
  wf_version_no   INTEGER,
  branch_id       UUID,
  service_code    TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      UUID,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID,
  rec_status      SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_org_wf_prof_asg_tenant
  ON public.org_wf_profile_assign_cf (tenant_org_id)
  WHERE COALESCE(is_active, true) = true;

ALTER TABLE public.org_wf_profile_assign_cf ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_wf_profile_assign_cf'
      AND policyname = 'tenant_isolation_org_wf_profile_assign_cf'
  ) THEN
    CREATE POLICY tenant_isolation_org_wf_profile_assign_cf
      ON public.org_wf_profile_assign_cf
      FOR ALL
      USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 11) Seeds — statuses
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_statuses_cd (status_code, name, name2, display_order, is_terminal) VALUES
  ('draft',             'Draft',              'مسودة',              10,  false),
  ('intake',            'Intake',             'استلام',             20,  false),
  ('preparing',         'Preparing',          'تحضير',              30,  false),
  ('processing',        'Processing',         'معالجة',             40,  false),
  ('assembly',          'Assembly',           'تجميع',              50,  false),
  ('qa',                'QA',                 'فحص الجودة',         60,  false),
  ('packing',           'Packing',            'تغليف',              70,  false),
  ('ready',             'Ready',              'جاهز',               80,  false),
  ('out_for_delivery',  'Out for delivery',   'خارج للتوصيل',       90,  false),
  ('delivered',         'Delivered',          'تم التسليم',         100, true),
  ('cancelled',         'Cancelled',          'ملغى',               110, true),
  ('returned',          'Returned',           'مرتجع',              120, true),
  ('on_hold',           'On hold',            'معلق',               130, false)
ON CONFLICT (status_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 12) Seeds — screens
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_screens_cd (screen_key, name, name2, display_order) VALUES
  ('new_order',       'New order',       'طلب جديد',        10),
  ('preparation',     'Preparation',     'التحضير',         20),
  ('processing',      'Processing',      'المعالجة',        30),
  ('assembly',        'Assembly',        'التجميع',         40),
  ('qa',              'QA',              'فحص الجودة',      50),
  ('packing',         'Packing',         'التغليف',         60),
  ('ready_release',   'Ready / release', 'الجاهز / الإفراج', 70),
  ('driver_delivery', 'Driver delivery', 'توصيل السائق',    80),
  ('canceling',       'Canceling',       'الإلغاء',         90),
  ('returning',       'Returning',       'الإرجاع',         100),
  ('workboard',       'Workboard',       'لوحة العمل',      110)
ON CONFLICT (screen_key) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 13) Seeds — screen membership (primary status per screen)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_screen_status_cd (screen_key, status_code, display_order) VALUES
  ('new_order',       'draft',            10),
  ('new_order',       'intake',           20),
  ('preparation',     'intake',           10),
  ('preparation',     'preparing',        20),
  ('processing',      'processing',       10),
  ('assembly',        'assembly',         10),
  ('qa',              'qa',               10),
  ('packing',         'packing',          10),
  ('ready_release',   'ready',            10),
  ('driver_delivery', 'out_for_delivery', 10),
  ('canceling',       'intake',           10),
  ('canceling',       'preparing',        20),
  ('canceling',       'processing',       30),
  ('canceling',       'assembly',         40),
  ('canceling',       'qa',               50),
  ('canceling',       'packing',          60),
  ('canceling',       'ready',            70),
  ('canceling',       'on_hold',          80),
  ('returning',       'delivered',        10),
  ('workboard',       'preparing',        10),
  ('workboard',       'processing',       20),
  ('workboard',       'assembly',         30),
  ('workboard',       'qa',               40),
  ('workboard',       'packing',          50),
  ('workboard',       'ready',            60)
ON CONFLICT (screen_key, status_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = true;

-- ------------------------------------------------------------------
-- 14) Seeds — gates
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_gate_defs_cd (gate_code, name, name2, description) VALUES
  ('rack_required',        'Rack required',        'موقع الرف مطلوب',
   'Order must have rack_location before release/pickup actions.'),
  ('prep_stage_complete',  'Preparation complete', 'التحضير مكتمل',
   'preparation_status must be completed (bridge until stage executions).'),
  ('fin_release_eligible', 'Fin release eligible', 'مؤهل للإفراج المالي',
   'Order Fin release eligibility (stubbed true in engine until Fin wiring).')
ON CONFLICT (gate_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 15) Seeds — actions
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_actions_cd (action_code, name, name2, permission_code, display_order) VALUES
  ('CONFIRM_PHYSICAL_INTAKE', 'Confirm physical intake', 'تأكيد الاستلام الفعلي', 'orders:transition', 10),
  ('SEND_TO_PREPARATION',     'Send to preparation',     'إرسال للتحضير',         'orders:transition', 20),
  ('COMPLETE_PREPARATION',    'Complete preparation',    'إكمال التحضير',         'orders:update',     30),
  ('COMPLETE_PROCESSING',     'Complete processing',     'إكمال المعالجة',        'orders:transition', 40),
  ('COMPLETE_ASSEMBLY',       'Complete assembly',       'إكمال التجميع',         'orders:transition', 50),
  ('PASS_QA',                 'Pass QA',                 'اجتياز فحص الجودة',     'orders:transition', 60),
  ('FAIL_QA',                 'Fail QA',                 'فشل فحص الجودة',        'orders:transition', 70),
  ('COMPLETE_PACKING',        'Complete packing',        'إكمال التغليف',         'orders:transition', 80),
  ('MARK_READY',              'Mark ready',              'تعليم كجاهز',            'orders:transition', 90),
  ('RELEASE_FOR_PICKUP',      'Release for pickup',      'إفراج للاستلام',        'orders:transition', 100),
  ('RELEASE_FOR_DELIVERY',    'Release for delivery',    'إفراج للتوصيل',         'orders:transition', 110),
  ('CONFIRM_DELIVERY',        'Confirm delivery',        'تأكيد التسليم',         'orders:transition', 120),
  ('CANCEL_ORDER',            'Cancel order',            'إلغاء الطلب',           'orders:transition', 130),
  ('RETURN_ORDER',            'Return order',            'إرجاع الطلب',           'orders:transition', 140)
ON CONFLICT (action_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  permission_code = EXCLUDED.permission_code,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 16) Seeds — transitions (stable transition_code for upsert)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('TR_DRAFT_INTAKE',      'draft',            'intake',           NULL, 'orders:transition', 'Draft → Intake', 'مسودة → استلام'),
  ('TR_INTAKE_PREP',       'intake',           'preparing',        NULL, 'orders:transition', 'Intake → Preparing', 'استلام → تحضير'),
  ('TR_PREP_PROC',         'preparing',        'processing',       NULL, 'orders:update',     'Preparing → Processing', 'تحضير → معالجة'),
  ('TR_INTAKE_PROC',       'intake',           'processing',       NULL, 'orders:update',     'Intake → Processing (prep complete bridge)', 'استلام → معالجة (جسر إكمال التحضير)'),
  ('TR_PROC_ASM',          'processing',       'assembly',         'prep_stage_complete', 'orders:transition', 'Processing → Assembly', 'معالجة → تجميع'),
  ('TR_ASM_QA',            'assembly',         'qa',               NULL, 'orders:transition', 'Assembly → QA', 'تجميع → فحص'),
  ('TR_QA_PACK',           'qa',               'packing',          NULL, 'orders:transition', 'QA pass → Packing', 'اجتياز → تغليف'),
  ('TR_QA_PROC',           'qa',               'processing',       NULL, 'orders:transition', 'QA fail → Processing', 'فشل → معالجة'),
  ('TR_PACK_READY',        'packing',          'ready',            NULL, 'orders:transition', 'Packing → Ready', 'تغليف → جاهز'),
  ('TR_READY_OFD',         'ready',            'out_for_delivery', 'fin_release_eligible,rack_required', 'orders:transition', 'Ready → Out for delivery', 'جاهز → توصيل'),
  ('TR_OFD_DELIV',         'out_for_delivery', 'delivered',        NULL, 'orders:transition', 'Confirm delivery', 'تأكيد التسليم'),
  ('TR_INTAKE_CANCEL',     'intake',           'cancelled',        NULL, 'orders:transition', 'Cancel from intake', 'إلغاء من الاستلام'),
  ('TR_PREP_CANCEL',       'preparing',        'cancelled',        NULL, 'orders:transition', 'Cancel from preparing', 'إلغاء من التحضير'),
  ('TR_PROC_CANCEL',       'processing',       'cancelled',        NULL, 'orders:transition', 'Cancel from processing', 'إلغاء من المعالجة'),
  ('TR_ASM_CANCEL',        'assembly',         'cancelled',        NULL, 'orders:transition', 'Cancel from assembly', 'إلغاء من التجميع'),
  ('TR_QA_CANCEL',         'qa',               'cancelled',        NULL, 'orders:transition', 'Cancel from QA', 'إلغاء من الفحص'),
  ('TR_PACK_CANCEL',       'packing',          'cancelled',        NULL, 'orders:transition', 'Cancel from packing', 'إلغاء من التغليف'),
  ('TR_READY_CANCEL',      'ready',            'cancelled',        NULL, 'orders:transition', 'Cancel from ready', 'إلغاء من الجاهز'),
  ('TR_HOLD_CANCEL',       'on_hold',          'cancelled',        NULL, 'orders:transition', 'Cancel from hold', 'إلغاء من التعليق'),
  ('TR_DELIV_RETURN',      'delivered',        'returned',         NULL, 'orders:transition', 'Return order', 'إرجاع الطلب')
ON CONFLICT (transition_code) DO UPDATE SET
  from_status = EXCLUDED.from_status,
  to_status = EXCLUDED.to_status,
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- Pickup release keeps operational ready (Ready ≠ release); use same-status edge via dedicated code
-- Engine CHECK allows same-status only for REL_* codes
INSERT INTO public.sys_wf_transitions_cd (
  transition_code, from_status, to_status, gate_set_code, permission_code, name, name2
) VALUES
  ('REL_READY_PICKUP', 'ready', 'ready', 'fin_release_eligible,rack_required', 'orders:transition',
   'Release for pickup (status unchanged)', 'إفراج للاستلام (بدون تغيير الحالة)')
ON CONFLICT (transition_code) DO UPDATE SET
  gate_set_code = EXCLUDED.gate_set_code,
  permission_code = EXCLUDED.permission_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------
-- 17) Seeds — action ↔ transition ↔ screen
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'CONFIRM_PHYSICAL_INTAKE', t.id, 'new_order'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_DRAFT_INTAKE'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'SEND_TO_PREPARATION', t.id, 'new_order'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_INTAKE_PREP'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'SEND_TO_PREPARATION', t.id, 'preparation'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_INTAKE_PREP'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'COMPLETE_PREPARATION', t.id, 'preparation'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_PREP_PROC'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'COMPLETE_PREPARATION', t.id, 'preparation'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_INTAKE_PROC'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'COMPLETE_PROCESSING', t.id, 'processing'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_PROC_ASM'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'COMPLETE_ASSEMBLY', t.id, 'assembly'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_ASM_QA'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'PASS_QA', t.id, 'qa'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_QA_PACK'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'FAIL_QA', t.id, 'qa'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_QA_PROC'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'COMPLETE_PACKING', t.id, 'packing'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_PACK_READY'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'MARK_READY', t.id, 'ready_release'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_PACK_READY'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'RELEASE_FOR_PICKUP', t.id, 'ready_release'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'REL_READY_PICKUP'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'RELEASE_FOR_DELIVERY', t.id, 'ready_release'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_READY_OFD'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'CONFIRM_DELIVERY', t.id, 'driver_delivery'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_OFD_DELIV'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT 'RETURN_ORDER', t.id, 'returning'
FROM public.sys_wf_transitions_cd t WHERE t.transition_code = 'TR_DELIV_RETURN'
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

-- Cancel mappings
INSERT INTO public.sys_wf_action_trans_cd (action_code, transition_id, screen_key)
SELECT v.action_code, t.id, 'canceling'
FROM (VALUES
  ('CANCEL_ORDER', 'TR_INTAKE_CANCEL'),
  ('CANCEL_ORDER', 'TR_PREP_CANCEL'),
  ('CANCEL_ORDER', 'TR_PROC_CANCEL'),
  ('CANCEL_ORDER', 'TR_ASM_CANCEL'),
  ('CANCEL_ORDER', 'TR_QA_CANCEL'),
  ('CANCEL_ORDER', 'TR_PACK_CANCEL'),
  ('CANCEL_ORDER', 'TR_READY_CANCEL'),
  ('CANCEL_ORDER', 'TR_HOLD_CANCEL')
) AS v(action_code, transition_code)
JOIN public.sys_wf_transitions_cd t ON t.transition_code = v.transition_code
ON CONFLICT (action_code, transition_id, screen_key) DO NOTHING;

-- ------------------------------------------------------------------
-- 18) Seeds — initial status rules (priority: lower wins)
-- ------------------------------------------------------------------
INSERT INTO public.sys_wf_initial_rules_cd (
  rule_code, order_source_code, order_type_id, is_retail, initial_status, priority, name, name2, is_active
) VALUES
  ('INIT_DEFAULT',           NULL,   NULL, NULL,  'intake',  900, 'Default intake', 'الاستلام الافتراضي', true),
  ('INIT_RETAIL_DELIVERED',      NULL,   NULL, true,  'delivered',   100, 'Retail → delivered (closed)', 'تجزئة →(مغلق)', true),
  ('INIT_RETAIL_READY',      NULL,   NULL, true,  'ready',   100, 'Retail → ready (not closed)', 'تجزئة → جاهز (ليس مغلق)', false),
  ('INIT_ONLINE_DRAFT',      'ONLINE', NULL, NULL, 'draft',   200, 'Online → draft', 'أونلاين → مسودة', true),
  ('INIT_PHONE_INTAKE',      'PHONE',  NULL, NULL, 'intake',  200, 'Phone → intake', 'هاتف → استلام', true)
ON CONFLICT (rule_code) DO UPDATE SET
  order_source_code = EXCLUDED.order_source_code,
  order_type_id = EXCLUDED.order_type_id,
  is_retail = EXCLUDED.is_retail,
  initial_status = EXCLUDED.initial_status,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = EXCLUDED.is_active,
  created_at = CURRENT_TIMESTAMP
  --,updated_at = CURRENT_TIMESTAMP
  ;

-- ------------------------------------------------------------------
-- 19) Backfill state_version for existing rows (idempotent)
-- ------------------------------------------------------------------
UPDATE public.org_orders_mst
SET state_version = 1
WHERE state_version IS NULL OR state_version < 1;

COMMIT;
