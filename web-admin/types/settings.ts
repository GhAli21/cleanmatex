/**
 * Settings Types
 *
 * TypeScript types for tenant settings and configurations.
 */

/**
 * Tenant Processing Settings
 * Settings specific to the processing/cleaning workflow
 */
export interface TenantProcessingSettings {
  splitOrderEnabled: boolean;      // USING_SPLIT_ORDER - Allow splitting orders into sub-orders
  rejectEnabled: boolean;           // USE_REJECT_TO_SOLVE - Enable reject/resolve workflow
  trackByPiece: boolean;            // Always true; pieces are always used (legacy key kept for API compatibility)
  rejectColor: string;              // REJECT_ROW_COLOR - Background color for rejected items (hex)
}

/**
 * Response from legacy fn_get_setting_value RPC.
 * @deprecated Use TenantSettingsService.getSettingValue() and fn_stng_resolve_all_settings instead.
 */
export interface SettingValueResponse {
  value: any;
  type: string; // 'BOOLEAN', 'TEXT', 'NUMBER', etc.
  is_active: boolean;
  source: 'system' | 'tenant' | 'user';
}
