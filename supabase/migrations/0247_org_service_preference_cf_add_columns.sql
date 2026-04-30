-- ==================================================================
-- Migration: 0247_org_service_preference_cf_add_columns.sql
-- Purpose: Add missing columns to org_service_preference_cf that exist
--          in sys_service_preference_cd but were never propagated to
--          the tenant config table.
-- Columns added:
--   preference_category, applies_to_fabric_types, is_incompatible_with,
--   workflow_impact, sustainability_score, keywords, icon,
--   is_color_prefs, color_hex, is_note_prefs, is_used_by_system,
--   is_allow_to_show_for_user
-- Note: preference_sys_kind, is_show_in_quick_bar, is_show_in_all_stages
--       were already added in migration 0165.
-- ==================================================================

BEGIN;

ALTER TABLE org_service_preference_cf
  ADD COLUMN IF NOT EXISTS preference_category    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS applies_to_fabric_types TEXT[],
  ADD COLUMN IF NOT EXISTS is_incompatible_with    TEXT[],
  ADD COLUMN IF NOT EXISTS workflow_impact         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sustainability_score    INTEGER,
  ADD COLUMN IF NOT EXISTS keywords                TEXT[],
  ADD COLUMN IF NOT EXISTS icon                    VARCHAR(120),
  ADD COLUMN IF NOT EXISTS is_color_prefs          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS color_hex               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_note_prefs           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_used_by_system       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_allow_to_show_for_user BOOLEAN DEFAULT true,
  
  ADD COLUMN IF NOT EXISTS preference_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS applies_to_fabric_types text[] null,
  ADD COLUMN IF NOT EXISTS is_incompatible_with text[] null,
  ADD COLUMN IF NOT EXISTS workflow_impact text null,
  ADD COLUMN IF NOT EXISTS sustainability_score integer null default 0,
  ADD COLUMN IF NOT EXISTS keywords text[] null,
  ADD COLUMN IF NOT EXISTS icon character varying(100) null,
  ADD COLUMN IF NOT EXISTS is_color_prefs boolean null default false,
  ADD COLUMN IF NOT EXISTS color_hex character varying(20) null,
  ADD COLUMN IF NOT EXISTS is_note_prefs boolean null default false,
  ADD COLUMN IF NOT EXISTS is_used_by_system boolean null default true,
  ADD COLUMN IF NOT EXISTS is_allow_to_show_for_user boolean null default true,
  ADD COLUMN IF NOT EXISTS system_type_code character varying(50) null,
  ADD COLUMN IF NOT EXISTS is_show_in_quick_bar boolean null default true,
  ADD COLUMN IF NOT EXISTS is_show_in_all_stages boolean null default true
  ;

COMMENT ON COLUMN org_service_preference_cf.preference_category      IS 'Denormalized from sys_service_preference_cd (stain, damage, color, special, etc.)';
COMMENT ON COLUMN org_service_preference_cf.applies_to_fabric_types  IS 'Denormalized from sys_service_preference_cd; tenant cannot override';
COMMENT ON COLUMN org_service_preference_cf.is_incompatible_with     IS 'Denormalized list of codes that conflict with this preference';
COMMENT ON COLUMN org_service_preference_cf.workflow_impact           IS 'Denormalized from sys_service_preference_cd';
COMMENT ON COLUMN org_service_preference_cf.sustainability_score      IS 'Denormalized from sys_service_preference_cd';
COMMENT ON COLUMN org_service_preference_cf.keywords                  IS 'Denormalized from sys_service_preference_cd for search';
COMMENT ON COLUMN org_service_preference_cf.icon                      IS 'Tenant can override icon; falls back to sys catalog icon';
COMMENT ON COLUMN org_service_preference_cf.is_color_prefs            IS 'Denormalized from sys_service_preference_cd';
COMMENT ON COLUMN org_service_preference_cf.color_hex                 IS 'Tenant can override hex; falls back to sys catalog color_hex';
COMMENT ON COLUMN org_service_preference_cf.is_note_prefs             IS 'Denormalized from sys_service_preference_cd';
COMMENT ON COLUMN org_service_preference_cf.is_used_by_system         IS 'If HQ sets false, tenant cannot use this preference';
COMMENT ON COLUMN org_service_preference_cf.is_allow_to_show_for_user IS 'If HQ sets false, tenant cannot expose this preference to end-users';

-- Backfill from sys catalog for existing rows
UPDATE org_service_preference_cf cf
SET
  preference_category       = cd.preference_category,
  applies_to_fabric_types   = cd.applies_to_fabric_types,
  is_incompatible_with      = cd.is_incompatible_with,
  workflow_impact           = cd.workflow_impact,
  sustainability_score      = cd.sustainability_score,
  keywords                  = cd.keywords,
  icon                      = COALESCE(cf.icon, cd.icon),
  is_color_prefs            = cd.is_color_prefs,
  color_hex                 = COALESCE(cf.color_hex, cd.color_hex),
  is_note_prefs             = cd.is_note_prefs,
  is_used_by_system         = cd.is_used_by_system,
  is_allow_to_show_for_user = cd.is_allow_to_show_for_user
FROM sys_service_preference_cd cd
WHERE cf.preference_code = cd.code;

COMMIT;
