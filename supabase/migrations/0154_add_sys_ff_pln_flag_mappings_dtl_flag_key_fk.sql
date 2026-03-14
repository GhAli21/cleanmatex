-- =====================================================
-- Migration: Add FK from sys_ff_pln_flag_mappings_dtl.flag_key to hq_ff_feature_flags_mst.flag_key
-- Date: 2026-03-14
-- Description: Enforce referential integrity for plan-flag mappings
-- =====================================================

BEGIN
-- Ensure no orphaned rows before adding FK (flag_key must exist in hq_ff_feature_flags_mst)
DELETE FROM sys_ff_pln_flag_mappings_dtl
WHERE flag_key NOT IN (SELECT flag_key FROM hq_ff_feature_flags_mst);

-- Add foreign key constraint
ALTER TABLE sys_ff_pln_flag_mappings_dtl
  ADD CONSTRAINT fk_sys_ff_pln_flag_mappings_flag_key
  FOREIGN KEY (flag_key)
  REFERENCES hq_ff_feature_flags_mst(flag_key)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_sys_ff_pln_flag_mappings_flag_key ON sys_ff_pln_flag_mappings_dtl
  IS 'References global feature flag definition; RESTRICT prevents deleting flags with active plan mappings';

-- Bump display_order for siblings after delivery (customers, catalog, billing, reports, inventory, settings, help, jhtestui)
UPDATE sys_components_cd SET display_order = 6, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'customers';
UPDATE sys_components_cd SET display_order = 7, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'catalog';
UPDATE sys_components_cd SET display_order = 8, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'billing';
UPDATE sys_components_cd SET display_order = 9, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'reports';
UPDATE sys_components_cd SET display_order = 10, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'inventory';
UPDATE sys_components_cd SET display_order = 11, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'settings';
UPDATE sys_components_cd SET display_order = 12, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'help';
UPDATE sys_components_cd SET display_order = 13, updated_at = CURRENT_TIMESTAMP WHERE comp_code = 'jhtestui';

COMMIT;
