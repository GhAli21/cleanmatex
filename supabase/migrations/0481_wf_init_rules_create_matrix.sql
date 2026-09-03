-- ============================================================
-- Migration: 0481_wf_init_rules_create_matrix.sql
-- Purpose:   Replace wildcard INIT_ONLINE_DRAFT (all-null matchers → draft)
--            with source/retail/QD matrix + create presets. Fixes POS
--            creates landing in draft.
-- Affected:  sys_wf_initial_rules_cd, sys_wf_prof_ver_init_cf,
--            sys_wf_profile_ver_mst.policy_revision (touched versions)
-- Related:   0480, 04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md
-- ============================================================
-- Do not edit applied 0470–0480. Agents never apply this migration.

BEGIN;

-- Global catalog codes used by profile init rows (FK).
INSERT INTO public.sys_wf_initial_rules_cd (
  rule_code, order_source_code, order_type_id, is_retail, initial_status,
  priority, name, name2, is_active
) VALUES
  ('INIT_POS_RETAIL', 'pos', NULL, true, 'delivered', 10,
   'POS retail → delivered', 'نقطة البيع تجزئة → مسلم', true),
  ('INIT_POS_QUICK_DROP', 'pos', NULL, false, 'intake', 20,
   'POS quick drop → intake', 'نقطة البيع إسقاط سريع → استلام', true),
  ('INIT_POS_PROCESSING', 'pos', NULL, false, 'processing', 30,
   'POS normal → processing', 'نقطة البيع عادي → تشغيل', true),
  ('INIT_MOBILE_DRAFT', 'customer_mobile_app', NULL, false, 'draft', 50,
   'Customer mobile → draft', 'تطبيق العميل → مسودة', true),
  ('INIT_WHATSAPP_DRAFT', 'whatsapp_bot', NULL, false, 'draft', 55,
   'WhatsApp → draft', 'واتساب → مسودة', true),
  ('INIT_API_PARTNER_DRAFT', 'api_partner', NULL, false, 'draft', 56,
   'API partner → draft', 'شريك API → مسودة', true),
  ('INIT_B2B_DRAFT', 'b2b_portal', NULL, false, 'draft', 57,
   'B2B portal → draft', 'بوابة B2B → مسودة', true),
  ('INIT_STAFF_RETAIL', 'web_admin', NULL, true, 'delivered', 60,
   'Staff retail → delivered', 'موظف تجزئة → مسلم', true),
  ('INIT_STAFF_MOBILE_RETAIL', 'staff_mobile_app', NULL, true, 'delivered', 61,
   'Staff mobile retail → delivered', 'موظف جوال تجزئة → مسلم', true),
  ('INIT_KIOSK_RETAIL', 'kiosk', NULL, true, 'delivered', 62,
   'Kiosk retail → delivered', 'كiosk تجزئة → مسلم', true),
  ('INIT_STAFF_QUICK_DROP', 'web_admin', NULL, false, 'intake', 70,
   'Staff quick drop → intake', 'موظف إسقاط سريع → استلام', true),
  ('INIT_STAFF_MOBILE_QD', 'staff_mobile_app', NULL, false, 'intake', 71,
   'Staff mobile QD → intake', 'موظف جوال إسقاط → استلام', true),
  ('INIT_KIOSK_QUICK_DROP', 'kiosk', NULL, false, 'intake', 72,
   'Kiosk quick drop → intake', 'كiosk إسقاط سريع → استلام', true),
  ('INIT_STAFF_PROCESSING', 'web_admin', NULL, false, 'processing', 80,
   'Staff normal → processing', 'موظف عادي → تشغيل', true),
  ('INIT_STAFF_MOBILE_PROC', 'staff_mobile_app', NULL, false, 'processing', 81,
   'Staff mobile → processing', 'موظف جوال → تشغيل', true),
  ('INIT_KIOSK_PROCESSING', 'kiosk', NULL, false, 'processing', 82,
   'Kiosk normal → processing', 'كiosk عادي → تشغيل', true)
ON CONFLICT (rule_code) DO UPDATE SET
  order_source_code = EXCLUDED.order_source_code,
  order_type_id = EXCLUDED.order_type_id,
  is_retail = EXCLUDED.is_retail,
  initial_status = EXCLUDED.initial_status,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  is_active = EXCLUDED.is_active;

-- Retarget legacy ONLINE/PHONE catalog rows so they are not mistaken for
-- wildcard profile matchers (profile rows carry the real matchers).
UPDATE public.sys_wf_initial_rules_cd
SET
  order_source_code = 'customer_mobile_app',
  name = 'Legacy online catalog (prefer INIT_MOBILE_DRAFT)',
  is_active = false
WHERE rule_code = 'INIT_ONLINE_DRAFT';

UPDATE public.sys_wf_initial_rules_cd
SET
  order_source_code = 'pos',
  name = 'Legacy phone catalog (prefer INIT_POS_*)',
  is_active = false
WHERE rule_code = 'INIT_PHONE_INTAKE';

-- Replace init rules on every version that currently has live policy.
CREATE TEMP TABLE tmp_wf_init_matrix_versions ON COMMIT DROP AS
SELECT DISTINCT version_id
FROM public.sys_wf_prof_ver_init_cf
WHERE is_active = true
  AND rec_status = 1;

-- Published versions need the 0472-style immutability bypass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst DISABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

SELECT set_config('cmx.semantic_policy_command', '1', true);

DELETE FROM public.sys_wf_prof_ver_init_cf AS init_row
WHERE init_row.version_id IN (SELECT version_id FROM tmp_wf_init_matrix_versions);

INSERT INTO public.sys_wf_prof_ver_init_cf (
  version_id, rule_code, order_source_code, order_type_id,
  is_retail, is_quick_drop, initial_status, priority,
  create_preset_code, is_active, rec_status, created_info
)
SELECT
  v.version_id,
  m.rule_code,
  m.order_source_code,
  NULL,
  m.is_retail,
  m.is_quick_drop,
  m.initial_status,
  m.priority,
  m.create_preset_code,
  true,
  1,
  '0481_wf_init_rules_create_matrix'
FROM tmp_wf_init_matrix_versions AS v
CROSS JOIN (
  VALUES
    ('INIT_POS_RETAIL', 'pos', true, NULL::BOOLEAN, 'delivered', 10, 'RETAIL_SOLD'),
    ('INIT_POS_QUICK_DROP', 'pos', false, true, 'intake', 20, 'POS_QUICK_DROP'),
    ('INIT_POS_PROCESSING', 'pos', false, false, 'processing', 30, 'POS_IN_HAND'),
    ('INIT_MOBILE_DRAFT', 'customer_mobile_app', false, NULL, 'draft', 50, 'REMOTE_DRAFT'),
    ('INIT_WHATSAPP_DRAFT', 'whatsapp_bot', false, NULL, 'draft', 55, 'REMOTE_DRAFT'),
    ('INIT_API_PARTNER_DRAFT', 'api_partner', false, NULL, 'draft', 56, 'REMOTE_DRAFT'),
    ('INIT_B2B_DRAFT', 'b2b_portal', false, NULL, 'draft', 57, 'REMOTE_DRAFT'),
    ('INIT_STAFF_RETAIL', 'web_admin', true, NULL, 'delivered', 60, 'RETAIL_SOLD'),
    ('INIT_STAFF_MOBILE_RETAIL', 'staff_mobile_app', true, NULL, 'delivered', 61, 'RETAIL_SOLD'),
    ('INIT_KIOSK_RETAIL', 'kiosk', true, NULL, 'delivered', 62, 'RETAIL_SOLD'),
    ('INIT_STAFF_QUICK_DROP', 'web_admin', false, true, 'intake', 70, 'STAFF_IN_HAND'),
    ('INIT_STAFF_MOBILE_QD', 'staff_mobile_app', false, true, 'intake', 71, 'STAFF_IN_HAND'),
    ('INIT_KIOSK_QUICK_DROP', 'kiosk', false, true, 'intake', 72, 'STAFF_IN_HAND'),
    ('INIT_STAFF_PROCESSING', 'web_admin', false, false, 'processing', 80, 'STAFF_IN_HAND'),
    ('INIT_STAFF_MOBILE_PROC', 'staff_mobile_app', false, false, 'processing', 81, 'STAFF_IN_HAND'),
    ('INIT_KIOSK_PROCESSING', 'kiosk', false, false, 'processing', 82, 'STAFF_IN_HAND'),
    ('INIT_DEFAULT', NULL, NULL, NULL, 'intake', 900, 'BRANCH_DEFAULT')
) AS m(
  rule_code, order_source_code, is_retail, is_quick_drop,
  initial_status, priority, create_preset_code
);

UPDATE public.sys_wf_profile_ver_mst AS version_row
SET
  policy_revision = version_row.policy_revision + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE version_row.version_id IN (SELECT version_id FROM tmp_wf_init_matrix_versions);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst ENABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

-- Fail closed if any active init rule lost its preset.
DO $$
DECLARE
  v_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM public.sys_wf_prof_ver_init_cf
  WHERE is_active = true
    AND rec_status = 1
    AND create_preset_code IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      '0481: % active init rules missing create_preset_code',
      v_missing;
  END IF;
END $$;

COMMIT;
