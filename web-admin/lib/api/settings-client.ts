/**
 * Settings API Client for Tenant Application
 * Connects to Platform HQ Settings API
 *
 * Phase 4: Client Frontend Enhancement
 */

const API_BASE = '/api/settings';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface SettingCategory {
  stng_category_code: string;
  stng_category_name: string;
  stng_category_name2?: string;
  stng_category_desc?: string;
  stng_category_desc2?: string;
  stng_category_order?: number;
  stng_category_icon?: string;
  is_active: boolean;
}

export interface SettingDefinition {
  setting_code: string;
  setting_name: string;
  setting_name2?: string;
  setting_description?: string;
  setting_description2?: string;
  stng_category_code?: string;
  stng_scope: 'SYSTEM' | 'TENANT' | 'BRANCH' | 'USER';
  stng_data_type: 'BOOLEAN' | 'TEXT' | 'NUMBER' | 'DATE' | 'JSON' | 'TEXT_ARRAY' | 'NUMBER_ARRAY';
  stng_default_value_jsonb?: any;
  stng_validation_jsonb?: any;
  stng_is_overridable: boolean;
  stng_is_sensitive: boolean;
  stng_requires_restart: boolean;
  stng_depends_on_flags?: string[];
  is_active: boolean;
}

export interface ResolvedSetting {
  stngCode: string;
  stngValue: any;
  stngSourceLayer: 'SYSTEM_DEFAULT' | 'SYSTEM_PROFILE' | 'PLAN_CONSTRAINT' | 'FEATURE_FLAG' | 'TENANT_OVERRIDE' | 'BRANCH_OVERRIDE' | 'USER_OVERRIDE';
  stngSourceId: string;
  computedAt: string;
}

export interface ExplainLayer {
  layer: string;
  value: any;
  sourceId: string;
  applied: boolean;
  reason?: string;
}

export interface ExplainTrace {
  settingCode: string;
  finalValue: any;
  finalSource: string;
  layers: ExplainLayer[];
  inheritanceChain?: string[];
  computedAt: string;
}

export interface TenantProfileInfo {
  stng_profile_code?: string;
  stng_profile_name?: string;
  stng_profile_version_applied?: number;
  stng_profile_locked: boolean;
}

export interface OverrideSettingRequest {
  settingCode: string;
  value: any;
  branchId?: string;
  userId?: string;
  overrideReason?: string;
}

// ============================================================
// API CLIENT
// ============================================================

export const settingsClient = {
  /**
   * Get all setting categories
   */
  async getCategories(): Promise<SettingCategory[]> {
    const response = await apiRequest<{ data: SettingCategory[] }>('/categories');
    return response.data;
  },

  /**
   * Get settings catalog (metadata for all settings)
   */
  async getCatalog(params?: {
    categoryCode?: string;
    scope?: string;
    isOverridable?: boolean;
  }): Promise<SettingDefinition[]> {
    const queryParams = new URLSearchParams();
    if (params?.categoryCode) queryParams.append('categoryCode', params.categoryCode);
    if (params?.scope) queryParams.append('scope', params.scope);
    if (params?.isOverridable !== undefined) {
      queryParams.append('isOverridable', params.isOverridable.toString());
    }

    const url = `/catalog${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await apiRequest<{ data: SettingDefinition[] }>(url);
    return response.data;
  },

  /**
   * Get settings catalog grouped by category
   */
  async getCatalogByCategory(): Promise<Record<string, SettingDefinition[]>> {
    const [categories, settings] = await Promise.all([
      settingsClient.getCategories(),
      settingsClient.getCatalog(),
    ]);

    const grouped: Record<string, SettingDefinition[]> = {};

    categories.forEach(cat => {
      grouped[cat.stng_category_code] = settings.filter(
        s => s.stng_category_code === cat.stng_category_code
      );
    });

    return grouped;
  },

  /**
   * Get effective settings (7-layer resolution)
   */
  async getEffectiveSettings(params?: {
    tenantId?: string;
    branchId?: string;
    userId?: string;
  }): Promise<ResolvedSetting[]> {
    const queryParams = new URLSearchParams();
    if (params?.branchId) queryParams.append('branchId', params.branchId);
    if (params?.userId) queryParams.append('userId', params.userId);

    const tenantId = params?.tenantId || 'me';
    const url = `/tenants/${tenantId}/effective${queryParams.toString() ? `?${queryParams}` : ''}`;

    const response = await apiRequest<{ data: ResolvedSetting[] }>(url);
    return response.data;
  },

  /**
   * Explain setting resolution
   */
  async explainSetting(
    settingCode: string,
    params?: {
      tenantId?: string;
      branchId?: string;
      userId?: string;
    }
  ): Promise<ExplainTrace> {
    const queryParams = new URLSearchParams();
    if (params?.branchId) queryParams.append('branchId', params.branchId);
    if (params?.userId) queryParams.append('userId', params.userId);

    const tenantId = params?.tenantId || 'me';
    const url = `/tenants/${tenantId}/explain/${settingCode}${queryParams.toString() ? `?${queryParams}` : ''}`;

    return apiRequest<ExplainTrace>(url);
  },

  /**
   * Get tenant profile info
   */
  async getTenantProfile(tenantId?: string): Promise<TenantProfileInfo> {
    const id = tenantId || 'me';
    return apiRequest<TenantProfileInfo>(`/tenants/${id}/profile`);
  },

  /**
   * Upsert setting override
   */
  async upsertOverride(
    data: OverrideSettingRequest,
    tenantId?: string
  ): Promise<void> {
    const id = tenantId || 'me';
    await apiRequest(`/tenants/${id}/overrides`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete setting override
   */
  async deleteOverride(
    settingCode: string,
    params?: {
      tenantId?: string;
      branchId?: string;
      userId?: string;
    }
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    if (params?.branchId) queryParams.append('branchId', params.branchId);
    if (params?.userId) queryParams.append('userId', params.userId);

    const tenantId = params?.tenantId || 'me';
    const url = `/tenants/${tenantId}/overrides/${settingCode}${queryParams.toString() ? `?${queryParams}` : ''}`;

    await apiRequest(url, { method: 'DELETE' });
  },

  /**
   * Recompute settings cache
   */
  async recomputeCache(tenantId?: string): Promise<void> {
    const id = tenantId || 'me';
    await apiRequest(`/tenants/${id}/recompute`, { method: 'POST' });
  },
};
