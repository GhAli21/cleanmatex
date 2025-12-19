/**
 * Tenant Settings Service
 *
 * Provides methods to fetch and check tenant-specific settings stored in the database.
 * Uses Supabase RPC functions to retrieve settings with proper tenant isolation.
 */

import { createClient } from '@/lib/supabase/client';

export interface TenantProcessingSettings {
  splitOrderEnabled: boolean;      // USING_SPLIT_ORDER
  rejectEnabled: boolean;           // USE_REJECT_TO_SOLVE
  trackByPiece: boolean;            // USE_TRACK_BY_PIECE
  rejectColor: string;              // REJECT_ROW_COLOR
}

export class TenantSettingsService {
  private supabase = createClient();

  /**
   * Check if a specific setting is allowed/enabled for the tenant
   * @param tenantId - The tenant organization ID
   * @param settingCode - The setting code to check (e.g., 'USING_SPLIT_ORDER')
   * @returns Promise<boolean> - true if setting is enabled, false otherwise
   */
  async checkIfSettingAllowed(
    tenantId: string,
    settingCode: string
  ): Promise<boolean> {
    try {
      // @ts-expect-error - RPC function exists but types not regenerated
      const { data, error } = await this.supabase.rpc('fn_is_setting_allowed', {
        p_tenant_org_id: tenantId,
        p_setting_code: settingCode,
      });

      if (error) {
        console.error(`[TenantSettingsService] Error checking setting ${settingCode}:`, error);
        return false;
      }

      console.log(`[TenantSettingsService] Setting ${settingCode}:`, data);
      return data === true;
    } catch (error) {
      console.error(`[TenantSettingsService] Exception checking setting ${settingCode}:`, error);
      return false;
    }
  }

  /**
   * Get the value of a specific setting for the tenant
   * @param tenantId - The tenant organization ID
   * @param settingCode - The setting code to retrieve (e.g., 'REJECT_ROW_COLOR')
   * @returns Promise<any> - The setting value or null
   */
  async getSettingValue(
    tenantId: string,
    settingCode: string
  ): Promise<any> {
    try {
      // @ts-expect-error - RPC function exists but types not regenerated
      const { data, error } = await this.supabase.rpc('fn_get_setting_value', {
        p_tenant_org_id: tenantId,
        p_setting_code: settingCode,
      });

      if (error) {
        console.error(`[TenantSettingsService] Error getting setting value for ${settingCode}:`, error);
        return null;
      }

      // @ts-expect-error - data structure from database
      return data?.value ?? null;
    } catch (error) {
      console.error(`[TenantSettingsService] Exception getting setting value for ${settingCode}:`, error);
      return null;
    }
  }

  /**
   * Get all processing-related settings for the tenant
   * This is optimized to fetch multiple settings in parallel
   * @param tenantId - The tenant organization ID
   * @returns Promise<TenantProcessingSettings> - Object containing all processing settings
   */
  async getProcessingSettings(tenantId: string): Promise<TenantProcessingSettings> {
    try {
      console.log('[TenantSettingsService] Fetching settings for tenant:', tenantId);

      // Fetch all settings in parallel for better performance
      const [
        splitOrderEnabled,
        rejectEnabled,
        trackByPiece,
        rejectColor,
      ] = await Promise.all([
        this.checkIfSettingAllowed(tenantId, 'USING_SPLIT_ORDER'),
        this.checkIfSettingAllowed(tenantId, 'USE_REJECT_TO_SOLVE'),
        this.checkIfSettingAllowed(tenantId, 'USE_TRACK_BY_PIECE'),
        this.getSettingValue(tenantId, 'REJECT_ROW_COLOR'),
      ]);

      const settings = {
        splitOrderEnabled,
        rejectEnabled,
        trackByPiece,
        rejectColor: rejectColor || '#10B981', // Default green color
      };

      console.log('[TenantSettingsService] Settings fetched:', settings);
      return settings;
    } catch (error) {
      console.error('[TenantSettingsService] Error fetching processing settings:', error);

      // Return safe defaults if error occurs
      return {
        splitOrderEnabled: false,
        rejectEnabled: false,
        trackByPiece: false,
        rejectColor: '#10B981',
      };
    }
  }

  /**
   * Get multiple boolean settings at once
   * @param tenantId - The tenant organization ID
   * @param settingCodes - Array of setting codes to check
   * @returns Promise<Record<string, boolean>> - Map of setting code to boolean value
   */
  async getMultipleSettings(
    tenantId: string,
    settingCodes: string[]
  ): Promise<Record<string, boolean>> {
    try {
      const results = await Promise.all(
        settingCodes.map(async (code) => ({
          code,
          value: await this.checkIfSettingAllowed(tenantId, code),
        }))
      );

      return results.reduce((acc, { code, value }) => {
        acc[code] = value;
        return acc;
      }, {} as Record<string, boolean>);
    } catch (error) {
      console.error('Error fetching multiple settings:', error);
      return {};
    }
  }
}

// Export singleton instance
export const tenantSettingsService = new TenantSettingsService();
