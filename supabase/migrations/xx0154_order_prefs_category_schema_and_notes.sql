-- ==================================================================
-- Migration: 0154_order_prefs_category_schema_and_notes.sql
-- Purpose: Category-based preference model + item notes (Phase B)
--          From Suggested_Services_Preferences_and_Note_Tables.sql
--          with fixes: PKs, branch_id nullable, unique constraints, RLS
-- Created: 2026-03-14
-- Do NOT apply - user runs migrations manually
-- ==================================================================
-- Fixes applied vs original suggested SQL:
-- 1. sys_item_notes_cd: valid PK (item_note_ctg_code, item_note_code)
-- 2. sys_prefs_ctg_stages_cd: valid PK + create sys_service_stages_cd
-- 3. org_prefs_option_sctg_items_cf: unique includes tenant_org_id, product_id
-- 4. org_order_prefs_dtl: branch_id nullable (per suggesstion_decisions)
-- 5. Add FKs for order_item_id, piece_id
-- 6. Add RLS on all org_* tables
-- 7. Add indexes for resolution and joins
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: sys_service_stages_cd (required by sys_prefs_ctg_stages_cf)
-- ==================================================================
CREATE TABLE IF NOT EXISTS sys_service_stages_cd (
  code                TEXT                 NOT NULL,
  name                TEXT                 NULL,
  name2               TEXT                 NULL,
  description         TEXT                 NULL,
  display_order       INTEGER              NULL DEFAULT 0,
  is_active           BOOLEAN             NULL DEFAULT true,
  created_at          TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT                 NULL,
  updated_at          TIMESTAMPTZ          NULL,
  updated_by          TEXT                 NULL,
  CONSTRAINT pk_sys_service_stages_cd PRIMARY KEY (code)
);

COMMENT ON TABLE sys_service_stages_cd IS 'Order stages: CREATE_ORDER, PROCESSING, PACKING, ASSEMBLY, DELIVERY';

INSERT INTO sys_service_stages_cd (code, name, name2, display_order)
VALUES
  ('CREATE_ORDER', 'Create Order', 'إنشاء الطلب', 1),
  ('PROCESSING', 'Processing', 'المعالجة', 2),
  ('PACKING', 'Packing', 'التغليف', 3),
  ('ASSEMBLY', 'Assembly', 'التجميع', 4),
  ('DELIVERY', 'Delivery', 'التوصيل', 5)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- SECTION 2: System Preference Catalogs (Category-Based)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_preference_ctg_cd (
  prefs_ctg_code       TEXT                 NOT NULL,
  prefs_ctg_name       TEXT                 NOT NULL,
  prefs_ctg_name2      TEXT                 NULL,
  prefs_ctg_desc       TEXT                 NULL,
  prefs_usage_level    TEXT                 NOT NULL DEFAULT 'ANYWHERE',
  is_color_prefs       BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT false,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_built_in          BOOLEAN              NOT NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_preference_ctg_cd PRIMARY KEY (prefs_ctg_code)
);

COMMENT ON TABLE sys_preference_ctg_cd IS 'Preference categories: pressing_method, packaging, starch_level, fragrance, special_care, garment_color, delivery_pref, wash_temp';

-- Seed sys_preference_ctg_cd (minimal for FK and tenant init)
INSERT INTO sys_preference_ctg_cd (prefs_ctg_code, prefs_ctg_name, prefs_ctg_name2, prefs_usage_level, rec_order)
VALUES
  ('pressing_method', 'Pressing Method', 'طريقة الكي', 'PER_ITEM', 1),
  ('packaging', 'Packaging', 'التغليف', 'PER_ITEM', 2),
  ('starch_level', 'Starch Level', 'مستوى النشا', 'PER_ITEM', 3),
  ('fragrance', 'Fragrance', 'العطر', 'ANYWHERE', 4),
  ('special_care', 'Special Care', 'العناية الخاصة', 'PER_ITEM', 5),
  ('wash_temp', 'Wash Temperature', 'درجة حرارة الغسيل', 'PER_ITEM', 6)
ON CONFLICT (prefs_ctg_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS sys_preference_options_cd (
  prefs_option_code    TEXT                 NOT NULL,
  prefs_ctg_code       TEXT                 NULL,
  prefs_option_name    TEXT                 NULL,
  prefs_option_name2   TEXT                 NULL,
  prefs_option_desc    TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color             BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  option_color_rgb     TEXT                 NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NOT NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_preference_options_cd PRIMARY KEY (prefs_option_code),
  CONSTRAINT ak_sys_pref_opt_ctg UNIQUE (prefs_option_code, prefs_ctg_code)
);

COMMENT ON TABLE sys_preference_options_cd IS 'Preference options per category';

-- FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_pref_opt_ctg' AND table_name = 'sys_preference_options_cd') THEN
    ALTER TABLE sys_preference_options_cd
      ADD CONSTRAINT fk_sys_pref_opt_ctg
      FOREIGN KEY (prefs_ctg_code) REFERENCES sys_preference_ctg_cd(prefs_ctg_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- sys_prefs_ctg_service_ctg_cf
CREATE TABLE IF NOT EXISTS sys_prefs_ctg_service_ctg_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  prefs_ctg_code       TEXT                 NOT NULL,
  service_category_code VARCHAR(120)        NOT NULL,
  pctg_sctg_title      TEXT                 NULL,
  pctg_sctg_desc       TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color             BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NULL DEFAULT true,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_prefs_ctg_svc_ctg PRIMARY KEY (id),
  CONSTRAINT ak_sys_prefs_ctg_svc UNIQUE (prefs_ctg_code, service_category_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_ctg_svc_pref' AND table_name = 'sys_prefs_ctg_service_ctg_cf') THEN
    ALTER TABLE sys_prefs_ctg_service_ctg_cf
      ADD CONSTRAINT fk_sys_prefs_ctg_svc_pref
      FOREIGN KEY (prefs_ctg_code) REFERENCES sys_preference_ctg_cd(prefs_ctg_code) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_ctg_svc_cat' AND table_name = 'sys_prefs_ctg_service_ctg_cf') THEN
    ALTER TABLE sys_prefs_ctg_service_ctg_cf
      ADD CONSTRAINT fk_sys_prefs_ctg_svc_cat
      FOREIGN KEY (service_category_code) REFERENCES sys_service_category_cd(service_category_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- sys_prefs_ctg_stages_cd (FIXED: valid PK)
CREATE TABLE IF NOT EXISTS sys_prefs_ctg_stages_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  stage_code           TEXT                 NOT NULL,
  prefs_ctg_code       TEXT                 NOT NULL,
  prefs_ctg_stage_title TEXT                NULL,
  prefs_ctg_stage_desc TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color             BOOLEAN              NULL DEFAULT false,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_prefs_ctg_stages PRIMARY KEY (id),
  CONSTRAINT ak_sys_prefs_ctg_stage UNIQUE (prefs_ctg_code, stage_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_stage_code' AND table_name = 'sys_prefs_ctg_stages_cf') THEN
    ALTER TABLE sys_prefs_ctg_stages_cf
      ADD CONSTRAINT fk_sys_prefs_stage_code
      FOREIGN KEY (stage_code) REFERENCES sys_service_stages_cd(code) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_stage_pref' AND table_name = 'sys_prefs_ctg_stages_cf') THEN
    ALTER TABLE sys_prefs_ctg_stages_cf
      ADD CONSTRAINT fk_sys_prefs_stage_pref
      FOREIGN KEY (prefs_ctg_code) REFERENCES sys_preference_ctg_cd(prefs_ctg_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- sys_prefs_option_service_ctg_cf
CREATE TABLE IF NOT EXISTS sys_prefs_option_service_ctg_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  prefs_ctg_code       TEXT                 NOT NULL,
  service_category_code VARCHAR(120)        NOT NULL,
  prefs_option_code    TEXT                 NOT NULL,
  pctg_sctg_title      TEXT                 NULL,
  pctg_sctg_desc       TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color             BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NULL DEFAULT true,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_prefs_opt_svc_ctg PRIMARY KEY (id),
  CONSTRAINT ak_sys_prefs_opt_svc UNIQUE (prefs_ctg_code, service_category_code, prefs_option_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_opt_svc_pref' AND table_name = 'sys_prefs_option_service_ctg_cf') THEN
    ALTER TABLE sys_prefs_option_service_ctg_cf
      ADD CONSTRAINT fk_sys_prefs_opt_svc_pref
      FOREIGN KEY (prefs_ctg_code, service_category_code)
      REFERENCES sys_prefs_ctg_service_ctg_cf(prefs_ctg_code, service_category_code) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_prefs_opt_svc_opt' AND table_name = 'sys_prefs_option_service_ctg_cf') THEN
    ALTER TABLE sys_prefs_option_service_ctg_cf
      ADD CONSTRAINT fk_sys_prefs_opt_svc_opt
      FOREIGN KEY (prefs_option_code, prefs_ctg_code)
      REFERENCES sys_preference_options_cd(prefs_option_code, prefs_ctg_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- ==================================================================
-- SECTION 3: System Item Notes Catalogs (FIXED: valid PK for sys_item_notes_cd)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_item_notes_ctg_cd (
  item_note_ctg_code   TEXT                 NOT NULL,
  item_note_ctg_name   TEXT                 NULL,
  item_note_ctg_name2  TEXT                 NULL,
  item_note_ctg_desc   TEXT                 NULL,
  is_color_note        BOOLEAN              NULL DEFAULT false,
  note_usage_level     TEXT                 NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_item_notes_ctg_cd PRIMARY KEY (item_note_ctg_code)
);

CREATE TABLE IF NOT EXISTS sys_item_notes_cd (
  item_note_ctg_code   TEXT                 NOT NULL,
  item_note_code       TEXT                 NOT NULL,
  item_note_name       TEXT                 NULL,
  item_note_name2      TEXT                 NULL,
  item_note_desc       TEXT                 NULL,
  note_usage_level     TEXT                 NULL,
  is_color_note        BOOLEAN              NULL DEFAULT false,
  color_note_rgb       TEXT                 NULL,
  show_in_order_quick_bar BOOLEAN           NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            VARCHAR(1000)       NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           VARCHAR(120)         NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           VARCHAR(120)         NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_sys_item_notes_cd PRIMARY KEY (item_note_ctg_code, item_note_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_item_notes_ctg' AND table_name = 'sys_item_notes_cd') THEN
    ALTER TABLE sys_item_notes_cd
      ADD CONSTRAINT fk_sys_item_notes_ctg
      FOREIGN KEY (item_note_ctg_code) REFERENCES sys_item_notes_ctg_cd(item_note_ctg_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- ==================================================================
-- SECTION 4: Tenant Preference Tables
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_preference_ctg_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID                 NOT NULL,
  org_prefs_ctg_code   TEXT                 NOT NULL,
  prefs_ctg_code       TEXT                 NULL,
  prefs_ctg_name       TEXT                 NULL,
  prefs_ctg_name2      TEXT                 NULL,
  prefs_ctg_desc       TEXT                 NULL,
  prefs_usage_level    TEXT                 NOT NULL DEFAULT 'ANYWHERE',
  is_color_prefs       BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NOT NULL DEFAULT false,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT false,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT false,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_preference_ctg_cf PRIMARY KEY (id),
  CONSTRAINT ak_org_pref_ctg UNIQUE (tenant_org_id, org_prefs_ctg_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_pref_ctg_tenant' AND table_name = 'org_preference_ctg_cf') THEN
    ALTER TABLE org_preference_ctg_cf
      ADD CONSTRAINT fk_org_pref_ctg_tenant
      FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_pref_ctg_sys' AND table_name = 'org_preference_ctg_cf') THEN
    ALTER TABLE org_preference_ctg_cf
      ADD CONSTRAINT fk_org_pref_ctg_sys
      FOREIGN KEY (prefs_ctg_code) REFERENCES sys_preference_ctg_cd(prefs_ctg_code) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS org_preference_options_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID                 NOT NULL,
  org_prefs_ctg_id     UUID                 NOT NULL,
  prefs_option_code    TEXT                 NULL,
  org_prefs_ctg_code   TEXT                 NOT NULL,
  org_prefs_option_code TEXT                NOT NULL,
  prefs_option_name    TEXT                 NOT NULL,
  prefs_option_name2   TEXT                 NULL,
  prefs_option_desc    TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color_prefs       BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)       NULL,
  option_color_rgb     TEXT                 NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NOT NULL DEFAULT false,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT false,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT false,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_preference_options_cf PRIMARY KEY (id),
  CONSTRAINT ak_org_pref_opt UNIQUE (tenant_org_id, org_prefs_ctg_code, org_prefs_option_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_pref_opt_ctg' AND table_name = 'org_preference_options_cf') THEN
    ALTER TABLE org_preference_options_cf
      ADD CONSTRAINT fk_org_pref_opt_ctg
      FOREIGN KEY (org_prefs_ctg_id) REFERENCES org_preference_ctg_cf(id) ON DELETE CASCADE;
  END IF;
END $$;

-- org_prefs_option_service_ctg_cf
CREATE TABLE IF NOT EXISTS org_prefs_option_service_ctg_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID                 NOT NULL,
  service_category_code VARCHAR(120)        NOT NULL,
  org_prefs_ctg_code   TEXT                 NOT NULL,
  org_prefs_option_code TEXT                NOT NULL,
  p_title              TEXT                 NULL,
  p_desc               TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color_prefs       BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NOT NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT true,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_prefs_opt_svc_ctg PRIMARY KEY (id),
  CONSTRAINT ak_org_prefs_opt_svc UNIQUE (tenant_org_id, service_category_code, org_prefs_ctg_code, org_prefs_option_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_prefs_opt_svc_tenant' AND table_name = 'org_prefs_option_service_ctg_cf') THEN
    ALTER TABLE org_prefs_option_service_ctg_cf
      ADD CONSTRAINT fk_org_prefs_opt_svc_tenant
      FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;
  END IF;
END $$;

-- org_prefs_option_sctg_items_cf (FIXED: unique includes tenant_org_id, product_id)
CREATE TABLE IF NOT EXISTS org_prefs_option_sctg_items_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID                 NOT NULL,
  product_id           UUID                 NOT NULL,
  org_prefs_ctg_code   TEXT                 NOT NULL,
  service_category_code VARCHAR(120)        NOT NULL,
  org_prefs_option_code TEXT                NOT NULL,
  pctg_sctg_title      TEXT                 NULL,
  pctg_sctg_desc       TEXT                 NULL,
  prefs_usage_level    TEXT                 NULL,
  is_color_prefs       BOOLEAN              NULL DEFAULT false,
  is_had_charge        BOOLEAN              NULL DEFAULT false,
  charge_effect_type   TEXT                 NULL,
  charge_value_type    TEXT                 NULL,
  charge_percentage    DECIMAL(5,4)         NULL,
  charge_amount        DECIMAL(19,4)        NULL,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_built_in          BOOLEAN              NOT NULL DEFAULT true,
  is_managed_by_saas   BOOLEAN              NOT NULL DEFAULT true,
  is_saas_featured     BOOLEAN              NOT NULL DEFAULT true,
  prefs_color1         TEXT                 NULL,
  prefs_color2         TEXT                 NULL,
  prefs_color3         TEXT                 NULL,
  prefs_icon           TEXT                 NULL,
  prefs_image          TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_prefs_opt_sctg_items PRIMARY KEY (id),
  CONSTRAINT ak_org_prefs_opt_sctg_items UNIQUE (tenant_org_id, product_id, service_category_code, org_prefs_ctg_code, org_prefs_option_code)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_prefs_sctg_product' AND table_name = 'org_prefs_option_sctg_items_cf') THEN
    ALTER TABLE org_prefs_option_sctg_items_cf
      ADD CONSTRAINT fk_org_prefs_sctg_product
      FOREIGN KEY (product_id, tenant_org_id) REFERENCES org_product_data_mst(id, tenant_org_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_prefs_sctg_svc' AND table_name = 'org_prefs_option_sctg_items_cf') THEN
    ALTER TABLE org_prefs_option_sctg_items_cf
      ADD CONSTRAINT fk_org_prefs_sctg_svc
      FOREIGN KEY (tenant_org_id, service_category_code, org_prefs_ctg_code, org_prefs_option_code)
      REFERENCES org_prefs_option_service_ctg_cf(tenant_org_id, service_category_code, org_prefs_ctg_code, org_prefs_option_code) ON DELETE CASCADE;
  END IF;
END $$;

-- ==================================================================
-- SECTION 5: org_order_prefs_dtl (FIXED: branch_id nullable)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_order_prefs_dtl (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  branch_id            UUID                 NULL,
  order_id             UUID                 NOT NULL,
  tenant_org_id        UUID                 NOT NULL,
  record_source        TEXT                 NOT NULL,
  order_item_id        UUID                 NULL,
  piece_id             UUID                 NULL,
  prefs_owner_type     TEXT                 NULL,
  prefs_source         TEXT                 NULL,
  prefs_level          TEXT                 NULL,
  org_prefs_ctg_code   TEXT                 NOT NULL,
  org_prefs_option_code TEXT                NOT NULL,
  processing_confirmed BOOLEAN              NULL DEFAULT false,
  confirmed_by         TEXT                 NULL,
  confirmed_at         TIMESTAMPTZ          NULL,
  option_price         DECIMAL(19,4)        NULL,
  option_desc          TEXT                 NULL,
  option_customer_notes TEXT                NULL,
  option_internal_notes TEXT                NULL,
  is_done              BOOLEAN              NOT NULL DEFAULT false,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            TEXT                 NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           TEXT                 NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           TEXT                 NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_order_prefs_dtl PRIMARY KEY (id)
);

COMMENT ON TABLE org_order_prefs_dtl IS 'Unified order preferences (ORDER/ITEM/PIECE level)';
COMMENT ON COLUMN org_order_prefs_dtl.record_source IS 'ORDER or ITEM or PIECE; if ITEM order_item_id required, if PIECE piece_id required';
COMMENT ON COLUMN org_order_prefs_dtl.prefs_owner_type IS 'CUSTOMER, USER, SYSTEM, AUTO';
COMMENT ON COLUMN org_order_prefs_dtl.prefs_source IS 'ORDER_CREATE, LAST_ORDER, CUSTOMER_SAVED, SYSTEM, bundle, repeat_order, etc.';
COMMENT ON COLUMN org_order_prefs_dtl.prefs_level IS 'ORDER, ITEM, PIECE';

-- Unique: one pref option per (order, item, piece, category) - use sentinel UUID for nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_order_prefs_dtl_unique
  ON org_order_prefs_dtl (order_id, COALESCE(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(piece_id, '00000000-0000-0000-0000-000000000000'::uuid), org_prefs_ctg_code, org_prefs_option_code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_prefs_order' AND table_name = 'org_order_prefs_dtl') THEN
    ALTER TABLE org_order_prefs_dtl
      ADD CONSTRAINT fk_org_order_prefs_order
      FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_prefs_branch' AND table_name = 'org_order_prefs_dtl') THEN
    ALTER TABLE org_order_prefs_dtl
      ADD CONSTRAINT fk_org_order_prefs_branch
      FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_prefs_item' AND table_name = 'org_order_prefs_dtl') THEN
    ALTER TABLE org_order_prefs_dtl
      ADD CONSTRAINT fk_org_order_prefs_item
      FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_prefs_piece' AND table_name = 'org_order_prefs_dtl') THEN
    ALTER TABLE org_order_prefs_dtl
      ADD CONSTRAINT fk_org_order_prefs_piece
      FOREIGN KEY (piece_id) REFERENCES org_order_item_pieces_dtl(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==================================================================
-- SECTION 6: Tenant Item Notes Tables
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_item_notes_ctg_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id        UUID                 NOT NULL,
  item_note_ctg_code   TEXT                 NOT NULL,
  item_note_ctg_name   TEXT                 NOT NULL,
  item_note_ctg_name2  TEXT                 NULL,
  item_note_ctg_desc   TEXT                 NULL,
  is_color_note        BOOLEAN              NULL DEFAULT false,
  is_per_item_or_order SMALLINT             NULL DEFAULT 1,
  show_in_quick_bar    BOOLEAN              NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            VARCHAR(1000)        NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           VARCHAR(120)         NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           VARCHAR(120)         NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_item_notes_ctg_cf PRIMARY KEY (id),
  CONSTRAINT ak_org_item_notes_ctg UNIQUE (tenant_org_id, item_note_ctg_code)
);

CREATE TABLE IF NOT EXISTS org_item_notes_cf (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  item_note_ctg_id     UUID                 NOT NULL,
  tenant_org_id        UUID                 NOT NULL,
  item_note_ctg_code   TEXT                 NOT NULL,
  item_note_code       TEXT                 NOT NULL,
  item_note_name       TEXT                 NOT NULL,
  item_note_name2      TEXT                 NULL,
  is_color_note        BOOLEAN              NULL DEFAULT false,
  item_note_desc       TEXT                 NULL,
  note_usage_level     TEXT                 NULL,
  color_note_rgb       TEXT                 NULL,
  show_in_order_quick_bar BOOLEAN           NULL DEFAULT true,
  show_in_all_stages   BOOLEAN              NULL DEFAULT true,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            VARCHAR(1000)        NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           VARCHAR(120)         NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           VARCHAR(120)         NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_item_notes_cf PRIMARY KEY (id),
  CONSTRAINT ak_org_item_notes UNIQUE (item_note_ctg_code, item_note_code, tenant_org_id)
);

CREATE TABLE IF NOT EXISTS org_order_notes_dtl (
  id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
  order_id             UUID                 NOT NULL,
  tenant_org_id        UUID                 NOT NULL,
  order_item_id        UUID                 NULL,
  piece_id             UUID                 NULL,
  note_owner_type      TEXT                 NULL,
  note_source          TEXT                 NULL,
  note_level           TEXT                 NULL,
  item_note_ctg_code   TEXT                 NOT NULL,
  item_note_code       TEXT                 NOT NULL,
  item_note_desc       TEXT                 NULL,
  is_active            BOOLEAN              NULL DEFAULT true,
  rec_order            INTEGER              NULL,
  rec_notes            VARCHAR(1000)        NULL,
  rec_status           SMALLINT             NULL DEFAULT 1,
  created_at           TIMESTAMPTZ          NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           VARCHAR(120)         NULL,
  created_info         TEXT                 NULL,
  updated_at           TIMESTAMPTZ          NULL,
  updated_by           VARCHAR(120)         NULL,
  updated_info         TEXT                 NULL,
  CONSTRAINT pk_org_order_notes_dtl PRIMARY KEY (id)
);

COMMENT ON COLUMN org_order_notes_dtl.note_owner_type IS 'CUSTOMER, USER, SYSTEM';
COMMENT ON COLUMN org_order_notes_dtl.note_source IS 'ORDER_CREATE, LAST_ORDER, CUSTOMER_SAVED, SYSTEM';
COMMENT ON COLUMN org_order_notes_dtl.note_level IS 'ORDER, ITEM, PIECE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_item_notes_ctg_tenant' AND table_name = 'org_item_notes_ctg_cf') THEN
    ALTER TABLE org_item_notes_ctg_cf
      ADD CONSTRAINT fk_org_item_notes_ctg_tenant
      FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_item_notes_ctg' AND table_name = 'org_item_notes_cf') THEN
    ALTER TABLE org_item_notes_cf
      ADD CONSTRAINT fk_org_item_notes_ctg
      FOREIGN KEY (tenant_org_id, item_note_ctg_code)
      REFERENCES org_item_notes_ctg_cf(tenant_org_id, item_note_ctg_code) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_notes_order' AND table_name = 'org_order_notes_dtl') THEN
    ALTER TABLE org_order_notes_dtl
      ADD CONSTRAINT fk_org_order_notes_order
      FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_order_notes_item' AND table_name = 'org_order_notes_dtl') THEN
    ALTER TABLE org_order_notes_dtl
      ADD CONSTRAINT fk_org_order_notes_item
      FOREIGN KEY (order_item_id) REFERENCES org_order_items_dtl(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN foreign_key_violation THEN NULL;
END $$;

-- ==================================================================
-- SECTION 7: Indexes for Performance
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_org_order_prefs_order ON org_order_prefs_dtl(tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_org_order_prefs_item ON org_order_prefs_dtl(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_order_prefs_piece ON org_order_prefs_dtl(piece_id) WHERE piece_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_order_prefs_record_source ON org_order_prefs_dtl(record_source);
CREATE INDEX IF NOT EXISTS idx_org_order_notes_order ON org_order_notes_dtl(tenant_org_id, order_id);
CREATE INDEX IF NOT EXISTS idx_org_prefs_opt_svc_cat ON org_prefs_option_service_ctg_cf(tenant_org_id, service_category_code);
CREATE INDEX IF NOT EXISTS idx_org_prefs_opt_sctg_product ON org_prefs_option_sctg_items_cf(tenant_org_id, product_id);

-- ==================================================================
-- SECTION 8: RLS on org_* Tables
-- ==================================================================

ALTER TABLE org_preference_ctg_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_preference_options_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_prefs_option_service_ctg_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_prefs_option_sctg_items_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_prefs_dtl ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_item_notes_ctg_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_item_notes_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_notes_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_preference_ctg_cf ON org_preference_ctg_cf;
CREATE POLICY tenant_isolation_org_preference_ctg_cf ON org_preference_ctg_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_preference_options_cf ON org_preference_options_cf;
CREATE POLICY tenant_isolation_org_preference_options_cf ON org_preference_options_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_prefs_option_service_ctg_cf ON org_prefs_option_service_ctg_cf;
CREATE POLICY tenant_isolation_org_prefs_option_service_ctg_cf ON org_prefs_option_service_ctg_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_prefs_option_sctg_items_cf ON org_prefs_option_sctg_items_cf;
CREATE POLICY tenant_isolation_org_prefs_option_sctg_items_cf ON org_prefs_option_sctg_items_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_order_prefs_dtl ON org_order_prefs_dtl;
CREATE POLICY tenant_isolation_org_order_prefs_dtl ON org_order_prefs_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_item_notes_ctg_cf ON org_item_notes_ctg_cf;
CREATE POLICY tenant_isolation_org_item_notes_ctg_cf ON org_item_notes_ctg_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_item_notes_cf ON org_item_notes_cf;
CREATE POLICY tenant_isolation_org_item_notes_cf ON org_item_notes_cf
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_order_notes_dtl ON org_order_notes_dtl;
CREATE POLICY tenant_isolation_org_order_notes_dtl ON org_order_notes_dtl
  FOR ALL USING (tenant_org_id = current_tenant_id()) WITH CHECK (tenant_org_id = current_tenant_id());

COMMIT;
