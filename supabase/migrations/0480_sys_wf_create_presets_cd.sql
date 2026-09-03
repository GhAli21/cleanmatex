-- ============================================================
-- Migration: 0480_sys_wf_create_presets_cd.sql
-- Purpose:   HQ-configurable create-time hydration presets.
--            Each Initial rule references create_preset_code; tenant
--            hydrator stamps physical_intake_* / preparation_* from the
--            preset (not hardcoded OrderService if-trees).
-- Affected:  sys_wf_create_presets_cd (new),
--            sys_wf_prof_ver_init_cf.create_preset_code,
--            sys_wf_prof_ver_save_policy, deep-clone init copy
-- Related:   04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md
-- ============================================================
-- Do not edit applied 0470–0479. Agents never apply this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_wf_create_presets_cd (
  create_preset_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name2 TEXT,
  description TEXT NOT NULL,
  description2 TEXT,
  physical_intake_status TEXT NOT NULL,
  stamp_physical_intake BOOLEAN NOT NULL DEFAULT false,
  stamp_received BOOLEAN NOT NULL DEFAULT false,
  preparation_status TEXT NOT NULL,
  stamp_prepared BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  CONSTRAINT chk_wf_create_preset_intake CHECK (
    physical_intake_status IN ('pending_dropoff', 'received', 'not_applicable')
  ),
  CONSTRAINT chk_wf_create_preset_prep CHECK (
    preparation_status IN ('pending', 'in_progress', 'completed')
  )
);

COMMENT ON TABLE public.sys_wf_create_presets_cd IS
  'Create-time hydration presets referenced by profile Initial rules. HQ selects a preset; tenant hydrator stamps order columns.';
COMMENT ON COLUMN public.sys_wf_create_presets_cd.description IS
  'English operator/HQ explanation of when to use this preset and which create columns it stamps.';
COMMENT ON COLUMN public.sys_wf_create_presets_cd.description2 IS
  'Arabic operator/HQ explanation of when to use this preset and which create columns it stamps.';
COMMENT ON COLUMN public.sys_wf_create_presets_cd.stamp_physical_intake IS
  'When true, set physical_intake_at/by/info from the create actor.';
COMMENT ON COLUMN public.sys_wf_create_presets_cd.stamp_received IS
  'When true, set received_at (and keep caller received_info when provided).';
COMMENT ON COLUMN public.sys_wf_create_presets_cd.stamp_prepared IS
  'When true, set prepared_at/by from the create actor.';

INSERT INTO public.sys_wf_create_presets_cd (
  create_preset_code, name, name2, description, description2,
  physical_intake_status, stamp_physical_intake, stamp_received,
  preparation_status, stamp_prepared,
  is_active, created_info, rec_status, rec_order, rec_notes
) VALUES
  (
    'REMOTE_DRAFT',
    'Remote draft intake',
    'مسودة استلام عن بعد',
    'Use for remote booking channels (customer mobile, WhatsApp, API partner, B2B portal) when goods are not yet at the branch. Sets physical_intake_status=pending_dropoff and does not stamp physical_intake_at/by or received_at. Preparation stays pending until staff confirms physical intake. Pair with Initial status draft (or awaiting_collection when home-collection types ship).',
    'يُستخدم لقنوات الحجز عن بعد (تطبيق العميل، واتساب، شريك API، بوابة B2B) عندما تكون البضائع غير موجودة في الفرع بعد. يضبط physical_intake_status=pending_dropoff ولا يختم physical_intake_at/by أو received_at. يبقى التحضير معلقاً حتى يؤكد الموظف الاستلام الفعلي. يُقرن عادة بالحالة الابتدائية draft (أو awaiting_collection عند شحن أنواع الاستلام من المنزل).',
    'pending_dropoff', false, false, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 10,
    'Mobile/bot/API when remote intake confirm is required'
  ),
  (
    'POS_IN_HAND',
    'POS goods in hand',
    'نقطة البيع — بضائع حاضرة',
    'Use for POS counter creates when laundry goods are physically present and the order is not quick-drop and not retail. Stamps physical_intake as received (at/by/info) and received_at from the create actor. Preparation stays pending for plant work. Typical Initial status: processing.',
    'يُستخدم لإنشاء طلبات نقطة البيع عندما تكون بضائع الغسيل حاضرة فعلياً والطلب ليس إسقاطاً سريعاً وليس تجزئة. يختم الاستلام الفعلي كمستلم (at/by/info) وreceived_at من منشئ الطلب. يبقى التحضير معلقاً لعمل المصنع. الحالة الابتدائية المعتادة: processing.',
    'received', true, true, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 20,
    'POS counter create into plant status'
  ),
  (
    'POS_QUICK_DROP',
    'POS quick drop',
    'نقطة البيع — إسقاط سريع',
    'Use for POS quick-drop creates when bags are on the counter but piece detail may be incomplete. Stamps physical intake as received and leaves preparation pending. Typical Initial status: intake; the next staff command moves toward preparing.',
    'يُستخدم لإسقاط نقطة البيع السريع عندما تكون الحقائب على الطاولة وقد تكون تفاصيل القطع غير مكتملة. يختم الاستلام الفعلي كمستلم ويترك التحضير معلقاً. الحالة الابتدائية المعتادة: intake؛ الأمر التالي للموظف ينتقل نحو preparing.',
    'received', true, true, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 30,
    'POS quick drop starts at intake'
  ),
  (
    'RETAIL_SOLD',
    'Retail sold at till',
    'تجزئة مباعة عند الصندوق',
    'Use for retail-only baskets sold at the till (or staff/kiosk retail). Stamps physical intake as received and marks preparation completed (prepared_at/by) because plant flow is skipped. Typical Initial status: delivered (never closed).',
    'يُستخدم لسلال التجزئة فقط المباعة عند الصندوق (أو تجزئة الموظف/الكiosk). يختم الاستلام الفعلي كمستلم ويعلّم التحضير مكتملاً (prepared_at/by) لأن مسار المصنع يُتخطى. الحالة الابتدائية المعتادة: delivered (وليس closed أبداً).',
    'received', true, true, 'completed', true,
    true, '0480_sys_wf_create_presets_cd', 1, 40,
    'Retail-only create skips plant flow'
  ),
  (
    'STAFF_IN_HAND',
    'Staff goods in hand',
    'موظف — بضائع حاضرة',
    'Use for web_admin, staff_mobile_app, or kiosk creates when goods are in hand at the branch (same stamps as POS in-hand). Stamps physical intake received and leaves preparation pending. Typical Initial status: processing (or intake for staff quick-drop rules).',
    'يُستخدم لإنشاء طلبات web_admin أو تطبيق الموظف أو الكiosk عندما تكون البضائع حاضرة في الفرع (نفس أختام نقطة البيع الحاضرة). يختم الاستلام الفعلي كمستلم ويترك التحضير معلقاً. الحالة الابتدائية المعتادة: processing (أو intake لقواعد الإسقاط السريع للموظف).',
    'received', true, true, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 50,
    'web_admin / staff_mobile / kiosk in-hand create'
  ),
  (
    'HOME_COLLECTION_PENDING',
    'Home collection pending',
    'استلام من المنزل معلق',
    'Use when the fulfilment type is HOME_COLLECTION or COLLECTION_AND_DELIVERY and dirty items are still at the customer. Sets physical_intake_status=pending_dropoff without intake/received stamps. Preparation stays pending until the driver confirms home collection. Typical Initial status: awaiting_collection (after that catalog ships).',
    'يُستخدم عندما يكون نوع التنفيذ HOME_COLLECTION أو COLLECTION_AND_DELIVERY والبضائع المتسخة ما زالت عند العميل. يضبط physical_intake_status=pending_dropoff دون أختام استلام/استلام فعلي. يبقى التحضير معلقاً حتى يؤكد السائق الاستلام من المنزل. الحالة الابتدائية المعتادة: awaiting_collection (بعد شحن ذلك الكتالوج).',
    'pending_dropoff', false, false, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 60,
    'Dirty items still at customer (HOME_COLLECTION types)'
  ),
  (
    'BRANCH_DEFAULT',
    'Branch default received',
    'افتراضي فرع — مستلم',
    'Catch-all in-plant start when no more specific source/retail/quick-drop preset applies. Stamps physical intake as received and leaves preparation pending. Typical Initial status: intake (INIT_DEFAULT) or another plant status chosen by the profile rule.',
    'بداية افتراضية داخل المصنع عندما لا ينطبق إعداد أكثر تحديداً حسب المصدر/التجزئة/الإسقاط السريع. يختم الاستلام الفعلي كمستلم ويترك التحضير معلقاً. الحالة الابتدائية المعتادة: intake (INIT_DEFAULT) أو حالة مصنع أخرى يختارها قاعدة الملف.',
    'received', true, true, 'pending', false,
    true, '0480_sys_wf_create_presets_cd', 1, 100,
    'Catch-all in-plant start'
  )
ON CONFLICT (create_preset_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  physical_intake_status = EXCLUDED.physical_intake_status,
  stamp_physical_intake = EXCLUDED.stamp_physical_intake,
  stamp_received = EXCLUDED.stamp_received,
  preparation_status = EXCLUDED.preparation_status,
  stamp_prepared = EXCLUDED.stamp_prepared,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = EXCLUDED.created_info,
  rec_status = 1,
  rec_order = EXCLUDED.rec_order,
  rec_notes = EXCLUDED.rec_notes;

ALTER TABLE public.sys_wf_prof_ver_init_cf
  ADD COLUMN IF NOT EXISTS create_preset_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sys_wf_prof_ver_init_cf_create_preset_code_fkey'
  ) THEN
    ALTER TABLE public.sys_wf_prof_ver_init_cf
      ADD CONSTRAINT sys_wf_prof_ver_init_cf_create_preset_code_fkey
      FOREIGN KEY (create_preset_code)
      REFERENCES public.sys_wf_create_presets_cd (create_preset_code)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN public.sys_wf_prof_ver_init_cf.create_preset_code IS
  'Create-time hydration preset. Required for Pilot/Publish after 0481 seed; tenant create fails closed when null/unknown.';

CREATE INDEX IF NOT EXISTS idx_sys_wf_init_create_preset
  ON public.sys_wf_prof_ver_init_cf (create_preset_code)
  WHERE create_preset_code IS NOT NULL;

-- Backfill existing wildcard/legacy rules with safest presets before NOT NULL enforcement in 0481.
-- cfg_guard blocks Published/Retired edits; same bypass as 0472/0478/0481.
SELECT set_config('cmx.semantic_policy_command', '1', true);

CREATE TEMP TABLE wf_0480_touched (
  version_id UUID PRIMARY KEY
) ON COMMIT DROP;

WITH backfilled AS (
  UPDATE public.sys_wf_prof_ver_init_cf AS init_row
  SET
    create_preset_code = CASE
      WHEN init_row.initial_status = 'draft' THEN 'REMOTE_DRAFT'
      WHEN init_row.initial_status = 'delivered' THEN 'RETAIL_SOLD'
      WHEN init_row.is_quick_drop IS TRUE THEN 'POS_QUICK_DROP'
      ELSE 'BRANCH_DEFAULT'
    END,
    updated_at = CURRENT_TIMESTAMP,
    updated_info = '0480_sys_wf_create_presets_cd_backfill'
  WHERE init_row.create_preset_code IS NULL
  RETURNING init_row.version_id
)
INSERT INTO wf_0480_touched (version_id)
SELECT DISTINCT backfilled.version_id
FROM backfilled
ON CONFLICT (version_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst DISABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

UPDATE public.sys_wf_profile_ver_mst AS version_row
SET
  policy_revision = version_row.policy_revision + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE version_row.version_id IN (
  SELECT touched.version_id FROM wf_0480_touched AS touched
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_wf_prof_ver_immut'
  ) THEN
    EXECUTE 'ALTER TABLE public.sys_wf_profile_ver_mst ENABLE TRIGGER trg_sys_wf_prof_ver_immut';
  END IF;
END $$;

-- Clone + save_policy wiring for create_preset_code is in 0482
-- (preserves 0459/0467 function signatures exactly).

COMMIT;
