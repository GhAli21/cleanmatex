/**
 * Platform HQ API Client Helper
 * 
 * Server-side client for calling Platform HQ API (cleanmatexsaas/platform-api)
 * Used by Next.js API routes to proxy requests to HQ API.
 * 
 * Handles:
 * - Authentication (service token or forwarded client token)
 * - Response transformation (HQ API format → cleanmatex format)
 * - Error handling
 */

const HQ_API_BASE = process.env.HQ_API_URL || 'http://localhost:3002/api/hq/v1';

/**
 * HQ API Response Types (from platform-api)
 */
interface HqResolvedSetting {
  code: string;
  value: any;
  sourceLayer: 'SYSTEM_DEFAULT' | 'SYSTEM_PROFILE' | 'PLAN_CONSTRAINT' | 'FEATURE_FLAG' | 'TENANT_OVERRIDE' | 'BRANCH_OVERRIDE' | 'USER_OVERRIDE';
  sourceId: string;
  explainTrace?: any[];
  computedAt: string | Date;
}

interface HqExplainTrace {
  settingCode: string;
  finalValue: any;
  finalSource: string;
  layers: Array<{
    layer: string;
    value: any;
    sourceId: string;
    applied: boolean;
    reason?: string;
  }>;
  inheritanceChain?: string[];
  computedAt: string | Date;
}

/**
 * Cleanmatex Response Types (expected by frontend)
 */
export interface CleanmatexResolvedSetting {
  stngCode: string;
  stngValue: any;
  stngSourceLayer: 'SYSTEM_DEFAULT' | 'SYSTEM_PROFILE' | 'PLAN_CONSTRAINT' | 'FEATURE_FLAG' | 'TENANT_OVERRIDE' | 'BRANCH_OVERRIDE' | 'USER_OVERRIDE';
  stngSourceId: string;
  computedAt: string;
}

export interface CleanmatexExplainTrace {
  settingCode: string;
  finalValue: any;
  finalSource: string;
  layers: Array<{
    layer: string;
    value: any;
    sourceId: string;
    applied: boolean;
    reason?: string;
  }>;
  inheritanceChain?: string[];
  computedAt: string;
}

/**
 * Transform HQ API response to cleanmatex format
 */
function transformResolvedSetting(hqSetting: HqResolvedSetting): CleanmatexResolvedSetting {
  return {
    stngCode: hqSetting.code,
    stngValue: hqSetting.value,
    stngSourceLayer: hqSetting.sourceLayer,
    stngSourceId: hqSetting.sourceId,
    computedAt: hqSetting.computedAt instanceof Date 
      ? hqSetting.computedAt.toISOString() 
      : hqSetting.computedAt,
  };
}

function transformExplainTrace(hqTrace: HqExplainTrace): CleanmatexExplainTrace {
  return {
    settingCode: hqTrace.settingCode,
    finalValue: hqTrace.finalValue,
    finalSource: hqTrace.finalSource,
    layers: hqTrace.layers,
    inheritanceChain: hqTrace.inheritanceChain,
    computedAt: hqTrace.computedAt instanceof Date 
      ? hqTrace.computedAt.toISOString() 
      : hqTrace.computedAt,
  };
}

/**
 * Get authentication token
 * Priority: Forwarded client token > Service token
 */
function getAuthToken(clientAuthHeader?: string | null): string {
  // Try forwarded client token first
  if (clientAuthHeader) {
    return clientAuthHeader;
  }

  // Fall back to service token
  const serviceToken = process.env.HQ_SERVICE_TOKEN;
  if (!serviceToken) {
    throw new Error('No authentication token available. Set HQ_SERVICE_TOKEN or forward Authorization header.');
  }

  return `Bearer ${serviceToken}`;
}

/**
 * Make request to HQ API
 */
async function callHqApi<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    queryParams?: Record<string, string | undefined>;
    body?: any;
    authHeader?: string | null;
  }
): Promise<T> {
  const url = new URL(`${HQ_API_BASE}${endpoint}`);
  
  // Add query parameters
  if (options?.queryParams) {
    Object.entries(options.queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }

  const authToken = getAuthToken(options?.authHeader);

  const response = await fetch(url.toString(), {
    method: options?.method || 'GET',
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      // Handle different error response formats
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : errorData.error?.message || JSON.stringify(errorData.error);
      } else if (errorData?.details) {
        errorMessage = errorData.details;
      } else {
        // Try to extract meaningful error from object
        errorMessage = JSON.stringify(errorData);
      }
    } catch (e) {
      // If JSON parsing fails, try to get text
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch (textError) {
        // Keep default error message
      }
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * HQ API Client
 */
export const hqApiClient = {
  /**
   * Get all effective settings for a tenant (7-layer resolution)
   */
  async getEffectiveSettings(
    tenantId: string,
    options?: {
      branchId?: string;
      userId?: string;
      authHeader?: string | null;
    }
  ): Promise<CleanmatexResolvedSetting[]> {
    const raw = await callHqApi<HqResolvedSetting[] | { data: HqResolvedSetting[] }>(
      `/settings/tenants/${tenantId}/effective`,
      {
        queryParams: {
          branchId: options?.branchId,
          userId: options?.userId,
        },
        authHeader: options?.authHeader,
      }
    );
    const hqSettings = Array.isArray(raw) ? raw : (raw?.data ?? []);
    return hqSettings.map(transformResolvedSetting);
  },

  /**
   * Explain setting resolution (full trace)
   */
  async explainSetting(
    tenantId: string,
    settingCode: string,
    options?: {
      branchId?: string;
      userId?: string;
      authHeader?: string | null;
    }
  ): Promise<CleanmatexExplainTrace> {
    const hqTrace = await callHqApi<HqExplainTrace>(
      `/settings/tenants/${tenantId}/explain/${settingCode}`,
      {
        queryParams: {
          branchId: options?.branchId,
          userId: options?.userId,
        },
        authHeader: options?.authHeader,
      }
    );

    return transformExplainTrace(hqTrace);
  },

  /**
   * Recompute settings cache
   */
  async recomputeCache(
    tenantId: string,
    options?: {
      authHeader?: string | null;
    }
  ): Promise<void> {
    await callHqApi<void>(
      `/settings/tenants/${tenantId}/recompute`,
      {
        method: 'POST',
        authHeader: options?.authHeader,
      }
    );
  },

  /**
   * Upsert setting override (tenant/branch/user level)
   */
  async upsertOverride(
    tenantId: string,
    data: {
      settingCode: string;
      value: any;
      branchId?: string;
      userId?: string;
      overrideReason?: string;
    },
    options?: {
      authHeader?: string | null;
    }
  ): Promise<void> {
    await callHqApi<void>(
      `/settings/tenants/${tenantId}/overrides`,
      {
        method: 'PATCH',
        body: {
          settingCode: data.settingCode,
          value: data.value,
          branchId: data.branchId,
          userId: data.userId,
          overrideReason: data.overrideReason,
        },
        authHeader: options?.authHeader,
      }
    );
  },

  /**
   * Delete setting override
   */
  async deleteOverride(
    tenantId: string,
    settingCode: string,
    options?: {
      branchId?: string;
      userId?: string;
      authHeader?: string | null;
    }
  ): Promise<void> {
    await callHqApi<void>(
      `/settings/tenants/${tenantId}/overrides/${settingCode}`,
      {
        method: 'DELETE',
        queryParams: {
          branchId: options?.branchId,
          userId: options?.userId,
        },
        authHeader: options?.authHeader,
      }
    );
  },
};

