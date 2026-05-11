/**
 * Preference Resolution Service
 * Calls DB functions: resolve_item_preferences, get_last_order_preferences, suggest_preferences_from_history
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface LastOrderServicePrefCatalogRow {
  preference_code: string;
  preference_id: string | null;
}

export interface LastOrderPrefItem {
  product_id: string;
  service_category_code: string | null;
  packing_pref_code: string | null;
  service_pref_codes: string[];
  /** From `org_order_preferences_dtl.preference_id` packing row (`org_packing_preference_cf.id`) when present */
  packing_pref_cf_id?: string | null;
  /** One object per distinct service pref code — pairs code with optional `preference_id` (`org_service_preference_cf.id`) */
  service_prefs_catalog?: LastOrderServicePrefCatalogRow[];
}

export interface ResolvedPref {
  preference_code: string;
  source: string;
}

export interface SuggestedPref {
  preference_code: string;
  usage_count: number;
}

export class PreferenceResolutionService {
  static parseServicePrefsCatalog(raw: unknown): LastOrderServicePrefCatalogRow[] {
    if (!raw || !Array.isArray(raw)) return [];
    const out: LastOrderServicePrefCatalogRow[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const code = o.preference_code;
      if (typeof code !== 'string' || code === '') continue;
      const pid = o.preference_id;
      out.push({
        preference_code: code,
        preference_id: pid == null || pid === '' ? null : String(pid),
      });
    }
    return out;
  }

  static mapLastOrderRpcRow(r: Record<string, unknown>): LastOrderPrefItem {
    const packingRaw = r.packing_pref_cf_id;
    return {
      product_id: String(r.product_id ?? ''),
      service_category_code:
        r.service_category_code == null ? null : String(r.service_category_code),
      packing_pref_code:
        r.packing_pref_code == null || r.packing_pref_code === ''
          ? null
          : String(r.packing_pref_code),
      service_pref_codes: Array.isArray(r.service_pref_codes)
        ? (r.service_pref_codes as unknown[]).filter((c): c is string => typeof c === 'string')
        : [],
      packing_pref_cf_id:
        packingRaw == null || packingRaw === '' ? null : String(packingRaw),
      service_prefs_catalog: PreferenceResolutionService.parseServicePrefsCatalog(
        r.service_prefs_catalog
      ),
    };
  }

  /**
   * Resolve preferences for an item (customer standing + product defaults)
   */
  static async resolveItemPreferences(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string,
    productCode?: string,
    serviceCategoryCode?: string
  ): Promise<ResolvedPref[]> {
    try {
      const { data, error } = await supabase.rpc('resolve_item_preferences', {
        p_tenant_org_id: tenantId,
        p_customer_id: customerId,
        p_product_code: productCode ?? null,
        p_service_category_code: serviceCategoryCode ?? null,
      });

      if (error) {
        logger.error('resolve_item_preferences failed', new Error(error.message), {
          tenantId,
          customerId,
          feature: 'preference_resolution',
        });
        return [];
      }

      return (data || []).map((r: { preference_code: string; source: string }) => ({
        preference_code: r.preference_code,
        source: r.source,
      }));
    } catch (err) {
      logger.error('PreferenceResolutionService.resolveItemPreferences failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_resolution',
      });
      return [];
    }
  }

  /**
   * Get last order preferences for customer (for Repeat Last Order)
   */
  static async getLastOrderPreferences(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string
  ): Promise<LastOrderPrefItem[]> {
    try {
      const { data, error } = await supabase.rpc('get_last_order_preferences', {
        p_tenant_org_id: tenantId,
        p_customer_id: customerId,
      });

      if (error) {
        logger.error('get_last_order_preferences failed', new Error(error.message), {
          tenantId,
          customerId,
          feature: 'preference_resolution',
        });
        return [];
      }

      return (data || []).map((r) =>
        PreferenceResolutionService.mapLastOrderRpcRow(r as Record<string, unknown>)
      );
    } catch (err) {
      logger.error('PreferenceResolutionService.getLastOrderPreferences failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_resolution',
      });
      return [];
    }
  }

  /**
   * Suggest preferences from customer order history
   */
  static async suggestPreferencesFromHistory(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string,
    productCode?: string | null,
    serviceCategoryCode?: string | null,
    limit = 5
  ): Promise<SuggestedPref[]> {
    try {
      const { data, error } = await supabase.rpc('suggest_preferences_from_history', {
        p_tenant_org_id: tenantId,
        p_customer_id: customerId,
        p_product_code: productCode ?? null,
        p_service_category_code: serviceCategoryCode ?? null,
        p_limit: limit,
      });

      if (error) {
        logger.error('suggest_preferences_from_history failed', new Error(error.message), {
          tenantId,
          customerId,
          feature: 'preference_resolution',
        });
        return [];
      }

      return (data || []).map((r: { preference_code: string; usage_count: number }) => ({
        preference_code: r.preference_code,
        usage_count: Number(r.usage_count ?? 0),
      }));
    } catch (err) {
      logger.error('PreferenceResolutionService.suggestPreferencesFromHistory failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_resolution',
      });
      return [];
    }
  }
}
