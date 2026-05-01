/**
 * Preference Catalog Service
 * Fetches service preferences, packing preferences, and preference bundles
 * with tenant-specific overrides.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ServicePreference,
  PackingPreference,
  PreferenceBundle,
  PreferenceKind,
  PreferenceMainType,
} from '@/lib/types/service-preferences';
import { logger } from '@/lib/utils/logger';

export class PreferenceCatalogService {
  /**
   * Get service preferences for tenant: **only** codes present in `org_service_preference_cf`
   * (active rows), merged with `sys_service_preference_cd` for template fields. No org row ⇒ not returned.
   */
  static async getServicePreferences(
    supabase: SupabaseClient,
    tenantId: string,
    _branchId?: string | null
  ): Promise<ServicePreference[]> {
    try {
      const { data: tenantCf, error: cfError } = await supabase
        .from('org_service_preference_cf')
        .select(
          'preference_code, name, name2, extra_price, is_included_in_base, is_active, display_order, preference_category, is_show_in_quick_bar'
        )
        .eq('tenant_org_id', tenantId);

      if (cfError) {
        logger.error('Failed to fetch org_service_preference_cf', new Error(cfError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_service_preferences',
        });
        return [];
      }

      const cfRows = (tenantCf || []).filter((c) => c.is_active !== false);
      if (cfRows.length === 0) {
        return [];
      }

      /** One CF row per code (ignore branch nuances until branch-scoped catalog is modeled in API). */
      const cfByCode = new Map<string, (typeof cfRows)[number]>();
      for (const c of cfRows) {
        if (!cfByCode.has(c.preference_code)) {
          cfByCode.set(c.preference_code, c);
        }
      }
      const codes = [...cfByCode.keys()];
      if (codes.length === 0) {
        return [];
      }

      const { data: sysPrefs, error: sysError } = await supabase
        .from('sys_service_preference_cd')
        .select(
          'code, name, name2, description, description2, preference_category, preference_sys_kind, color_hex, applies_to_fabric_types, is_incompatible_with, default_extra_price, workflow_impact, extra_turnaround_minutes, sustainability_score, icon, display_order, is_active, is_show_in_quick_bar, is_used_by_system, is_allow_to_show_for_user'
        )
        .in('code', codes)
        .eq('is_active', true);

      if (sysError) {
        logger.error('Failed to fetch sys_service_preference_cd', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_service_preferences',
        });
        return [];
      }

      const sysRows = sysPrefs ?? [];
      const sysMap = new Map(sysRows.map((s) => [s.code, s]));
      type SysPrefRow = (typeof sysRows)[number];

      const merged = codes
        .map((code) => {
          const cf = cfByCode.get(code)!;
          const s: SysPrefRow | undefined = sysMap.get(code);
          if (!s) {
            return null;
          }
          return {
            code: s.code,
            name: cf.name ?? s.name,
            name2: cf.name2 ?? s.name2,
            description: s.description,
            description2: s.description2,
            preference_category: (cf.preference_category as string | null | undefined) ?? s.preference_category,
            preference_sys_kind: s.preference_sys_kind ?? null,
            color_hex: s.color_hex ?? null,
            applies_to_fabric_types: s.applies_to_fabric_types,
            is_incompatible_with: s.is_incompatible_with,
            default_extra_price: cf.extra_price != null ? Number(cf.extra_price) : Number(s.default_extra_price),
            workflow_impact: s.workflow_impact,
            extra_turnaround_minutes: s.extra_turnaround_minutes,
            sustainability_score: s.sustainability_score,
            icon: s.icon,
            display_order: cf.display_order ?? s.display_order,
            is_active: true,
            is_show_in_quick_bar:
              (cf.is_show_in_quick_bar ?? s.is_show_in_quick_bar) !== false,
            is_used_by_system: s.is_used_by_system ?? null,
            is_allow_to_show_for_user: s.is_allow_to_show_for_user ?? null,
          } as ServicePreference;
        })
        .filter((row): row is ServicePreference => row !== null);

      merged.sort(
        (a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.code.localeCompare(b.code)
      );
      return merged;
    } catch (err) {
      logger.error('PreferenceCatalogService.getServicePreferences failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Get packing preferences for tenant: **only** codes present in `org_packing_preference_cf`
   * (active rows), merged with `sys_packing_preference_cd` for template fields. No org row ⇒ not returned.
   */
  static async getPackingPreferences(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<PackingPreference[]> {
    try {
      const { data: tenantCf, error: cfError } = await supabase
        .from('org_packing_preference_cf')
        .select('packing_pref_code, name, name2, extra_price, is_active, display_order')
        .eq('tenant_org_id', tenantId);

      if (cfError) {
        logger.error('Failed to fetch org_packing_preference_cf', new Error(cfError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_packing_preferences',
        });
        return [];
      }

      const cfRows = (tenantCf || []).filter((c) => c.is_active !== false);
      if (cfRows.length === 0) {
        return [];
      }

      const cfByCode = new Map<string, (typeof cfRows)[number]>();
      for (const c of cfRows) {
        if (!cfByCode.has(c.packing_pref_code)) {
          cfByCode.set(c.packing_pref_code, c);
        }
      }
      const codes = [...cfByCode.keys()];
      if (codes.length === 0) {
        return [];
      }

      const { data: sysPrefs, error: sysError } = await supabase
        .from('sys_packing_preference_cd')
        .select('code, name, name2, description, description2, maps_to_packaging_type, sustainability_score, display_order, is_active')
        .in('code', codes)
        .eq('is_active', true);

      if (sysError) {
        logger.error('Failed to fetch sys_packing_preference_cd', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_packing_preferences',
        });
        return [];
      }

      const sysRows = sysPrefs ?? [];
      const sysMap = new Map(sysRows.map((s) => [s.code, s]));
      type SysPackingRow = (typeof sysRows)[number];

      const merged = codes
        .map((code) => {
          const cf = cfByCode.get(code)!;
          const s: SysPackingRow | undefined = sysMap.get(code);
          if (!s) {
            return null;
          }
          return {
            code: s.code,
            name: cf.name ?? s.name,
            name2: cf.name2 ?? s.name2,
            description: s.description,
            description2: s.description2,
            maps_to_packaging_type: s.maps_to_packaging_type,
            sustainability_score: s.sustainability_score,
            display_order: cf.display_order ?? s.display_order,
            is_active: true,
          } as PackingPreference;
        })
        .filter((row): row is PackingPreference => row !== null);

      merged.sort(
        (a, b) =>
          (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.code.localeCompare(b.code)
      );
      return merged;
    } catch (err) {
      logger.error('PreferenceCatalogService.getPackingPreferences failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Get preference bundles (Care Packages) for tenant
   * @param includeInactive - When true, return all bundles (for admin config)
   */
  static async getPreferenceBundles(
    supabase: SupabaseClient,
    tenantId: string,
    includeInactive = false
  ): Promise<PreferenceBundle[]> {
    try {
      let query = supabase
        .from('org_preference_bundles_cf')
        .select('id, tenant_org_id, bundle_code, name, name2, preference_codes, discount_percent, discount_amount, is_active, display_order')
        .eq('tenant_org_id', tenantId)
        .order('display_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch org_preference_bundles_cf', new Error(error.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_preference_bundles',
        });
        return [];
      }

      return (data || []) as PreferenceBundle[];
    } catch (err) {
      logger.error('PreferenceCatalogService.getPreferenceBundles failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Create preference bundle (Care Package)
   */
  static async createPreferenceBundle(
    supabase: SupabaseClient,
    tenantId: string,
    input: {
      bundle_code: string;
      name: string;
      name2?: string | null;
      preference_codes?: string[] | null;
      discount_percent?: number;
      discount_amount?: number;
      is_active?: boolean;
      display_order?: number;
    },
    userId: string,
    userName: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('org_preference_bundles_cf')
        .insert({
          tenant_org_id: tenantId,
          bundle_code: input.bundle_code,
          name: input.name,
          name2: input.name2 ?? null,
          preference_codes: input.preference_codes ?? null,
          discount_percent: input.discount_percent ?? 0,
          discount_amount: input.discount_amount ?? 0,
          is_active: input.is_active ?? true,
          display_order: input.display_order ?? 0,
          created_by: userId,
          created_info: userName,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Bundle code already exists' };
        }
        logger.error('Failed to create preference bundle', new Error(error.message), {
          tenantId,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true, id: data?.id };
    } catch (err) {
      logger.error('PreferenceCatalogService.createPreferenceBundle failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to create bundle' };
    }
  }

  /**
   * Update preference bundle
   */
  static async updatePreferenceBundle(
    supabase: SupabaseClient,
    tenantId: string,
    bundleId: string,
    input: Partial<{
      bundle_code: string;
      name: string;
      name2: string | null;
      preference_codes: string[] | null;
      discount_percent: number;
      discount_amount: number;
      is_active: boolean;
      display_order: number;
    }>,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('org_preference_bundles_cf')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
          updated_by: userId,
          updated_info: userName,
        })
        .eq('id', bundleId)
        .eq('tenant_org_id', tenantId);

      if (error) {
        logger.error('Failed to update preference bundle', new Error(error.message), {
          tenantId,
          bundleId,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.updatePreferenceBundle failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        bundleId,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to update bundle' };
    }
  }

  /**
   * Get service preferences for admin (sys + org overrides, includes inactive for edit view)
   */
  static async getServicePreferenceCfForAdmin(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<
    Array<{
      code: string;
      name: string | null;
      name2: string | null;
      preference_category: string | null;
      preference_sys_kind: string | null;
      default_extra_price: number;
      extra_turnaround_minutes: number | null;
      display_order: number;
      sys_is_active: boolean;
      cf_id: string | null;
      cf_name: string | null;
      cf_name2: string | null;
      cf_extra_price: number | null;
      cf_is_included_in_base: boolean | null;
      cf_is_active: boolean | null;
      cf_display_order: number | null;
    }>
  > {
    try {
      const { data: sysPrefs, error: sysError } = await supabase
        .from('sys_service_preference_cd')
        .select('code, name, name2, preference_category, preference_sys_kind, default_extra_price, extra_turnaround_minutes, display_order, is_active')
        .order('display_order', { ascending: true });

      if (sysError) {
        logger.error('Failed to fetch sys_service_preference_cd for admin', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_service_preference_cf_for_admin',
        });
        return [];
      }

      const { data: tenantCf } = await supabase
        .from('org_service_preference_cf')
        .select(
          'id, preference_code, name, name2, extra_price, is_included_in_base, is_active, display_order, preference_category'
        )
        .eq('tenant_org_id', tenantId);

      const cfMap = new Map(
        (tenantCf || []).map((c) => [c.preference_code, c])
      );

      return (sysPrefs || []).map((s) => {
        const cf = cfMap.get(s.code);
        return {
          code: s.code,
          name: s.name,
          name2: s.name2,
          preference_category: (cf?.preference_category as string | null | undefined) ?? s.preference_category,
          preference_sys_kind: s.preference_sys_kind ?? null,
          default_extra_price: Number(s.default_extra_price ?? 0),
          extra_turnaround_minutes: s.extra_turnaround_minutes,
          display_order: s.display_order ?? 0,
          sys_is_active: s.is_active ?? true,
          cf_id: cf?.id ?? null,
          cf_name: cf?.name ?? null,
          cf_name2: cf?.name2 ?? null,
          cf_extra_price: cf ? Number(cf.extra_price) : null,
          cf_is_included_in_base: cf?.is_included_in_base ?? null,
          cf_is_active: cf?.is_active ?? null,
          cf_display_order: cf?.display_order ?? null,
        };
      });
    } catch (err) {
      logger.error('PreferenceCatalogService.getServicePreferenceCfForAdmin failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Get packing preferences for admin (sys + org overrides)
   */
  static async getPackingPreferenceCfForAdmin(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<
    Array<{
      code: string;
      name: string | null;
      name2: string | null;
      maps_to_packaging_type: string | null;
      display_order: number;
      sys_is_active: boolean;
      cf_id: string | null;
      cf_name: string | null;
      cf_name2: string | null;
      cf_extra_price: number | null;
      cf_is_active: boolean | null;
      cf_display_order: number | null;
    }>
  > {
    try {
      const { data: sysPrefs, error: sysError } = await supabase
        .from('sys_packing_preference_cd')
        .select('code, name, name2, maps_to_packaging_type, display_order, is_active')
        .order('display_order', { ascending: true });

      if (sysError) {
        logger.error('Failed to fetch sys_packing_preference_cd for admin', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_packing_preference_cf_for_admin',
        });
        return [];
      }

      const { data: tenantCf } = await supabase
        .from('org_packing_preference_cf')
        .select('id, packing_pref_code, name, name2, extra_price, is_active, display_order')
        .eq('tenant_org_id', tenantId);

      const cfMap = new Map(
        (tenantCf || []).map((c) => [c.packing_pref_code, c])
      );

      return (sysPrefs || []).map((s) => {
        const cf = cfMap.get(s.code);
        return {
          code: s.code,
          name: s.name,
          name2: s.name2,
          maps_to_packaging_type: s.maps_to_packaging_type,
          display_order: s.display_order ?? 0,
          sys_is_active: s.is_active ?? true,
          cf_id: cf?.id ?? null,
          cf_name: cf?.name ?? null,
          cf_name2: cf?.name2 ?? null,
          cf_extra_price: cf ? Number(cf.extra_price) : null,
          cf_is_active: cf?.is_active ?? null,
          cf_display_order: cf?.display_order ?? null,
        };
      });
    } catch (err) {
      logger.error('PreferenceCatalogService.getPackingPreferenceCfForAdmin failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Get extra_turnaround_minutes for preference codes (tenant override or sys fallback).
   * Used when inserting org_order_preferences_dtl to denormalize SLA for ready-by calculation.
   */
  static async getExtraTurnaroundMinutesBatch(
    supabase: SupabaseClient,
    tenantId: string,
    preferenceCodes: string[]
  ): Promise<Map<string, number>> {
    const codes = [...new Set(preferenceCodes)].filter(Boolean);
    if (codes.length === 0) return new Map();

    try {
      const { data: cfRows } = await supabase
        .from('org_service_preference_cf')
        .select('preference_code, extra_turnaround_minutes')
        .eq('tenant_org_id', tenantId)
        .in('preference_code', codes);

      const { data: sysRows } = await supabase
        .from('sys_service_preference_cd')
        .select('code, extra_turnaround_minutes')
        .in('code', codes);

      const cfMap = new Map((cfRows || []).map((r) => [r.preference_code, r.extra_turnaround_minutes]));
      const sysMap = new Map((sysRows || []).map((r) => [r.code, r.extra_turnaround_minutes]));

      const result = new Map<string, number>();
      for (const code of codes) {
        const val = cfMap.get(code) ?? sysMap.get(code) ?? 0;
        result.set(code, Number(val) || 0);
      }
      return result;
    } catch (err) {
      logger.error('PreferenceCatalogService.getExtraTurnaroundMinutesBatch failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return new Map();
    }
  }

  /**
   * Upsert org_service_preference_cf (tenant override)
   */
  static async upsertServicePreferenceCf(
    supabase: SupabaseClient,
    tenantId: string,
    preferenceCode: string,
    input: {
      name?: string | null;
      name2?: string | null;
      extra_price?: number;
      is_included_in_base?: boolean;
      is_active?: boolean;
      display_order?: number;
      extra_turnaround_minutes?: number | null;
      preference_category?: string | null;
    },
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [{ data: sysRow, error: sysLookupError }, { data: existingCf }] = await Promise.all([
        supabase
          .from('sys_service_preference_cd')
          .select('preference_sys_kind, preference_category')
          .eq('code', preferenceCode)
          .single(),
        supabase
          .from('org_service_preference_cf')
          .select(
            'preference_category, name, name2, extra_price, is_included_in_base, is_active, display_order, extra_turnaround_minutes'
          )
          .eq('tenant_org_id', tenantId)
          .eq('preference_code', preferenceCode)
          .maybeSingle(),
      ]);

      if (sysLookupError || !sysRow) {
        return { success: false, error: 'Invalid preference code' };
      }

      const resolvedCategory =
        input.preference_category !== undefined
          ? input.preference_category
          : (existingCf?.preference_category ?? sysRow.preference_category ?? null);

      const now = new Date().toISOString();
      const payload = {
        tenant_org_id: tenantId,
        preference_code: preferenceCode,
        preference_sys_kind: sysRow.preference_sys_kind,
        preference_category: resolvedCategory,
        name: input.name ?? null,
        name2: input.name2 ?? null,
        extra_price: input.extra_price ?? 0,
        is_included_in_base: input.is_included_in_base ?? false,
        is_active: input.is_active ?? true,
        display_order: input.display_order ?? 0,
        extra_turnaround_minutes: input.extra_turnaround_minutes ?? null,
        created_by: userId,
        created_info: userName,
        updated_at: now,
        updated_by: userId,
        updated_info: userName,
      };

      const { error } = await supabase
        .from('org_service_preference_cf')
        .upsert(payload, {
          onConflict: 'tenant_org_id,preference_code',
          ignoreDuplicates: false,
        });

      if (error) {
        if (error.code === '23503') {
          return { success: false, error: 'Invalid preference code' };
        }
        logger.error('Failed to upsert org_service_preference_cf', new Error(error.message), {
          tenantId,
          preferenceCode,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.upsertServicePreferenceCf failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        preferenceCode,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to save service preference' };
    }
  }

  /**
   * Upsert org_packing_preference_cf (tenant override)
   */
  static async upsertPackingPreferenceCf(
    supabase: SupabaseClient,
    tenantId: string,
    packingPrefCode: string,
    input: {
      name?: string | null;
      name2?: string | null;
      extra_price?: number;
      is_active?: boolean;
      display_order?: number;
    },
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const payload = {
        tenant_org_id: tenantId,
        packing_pref_code: packingPrefCode,
        name: input.name ?? null,
        name2: input.name2 ?? null,
        extra_price: input.extra_price ?? 0,
        is_active: input.is_active ?? true,
        display_order: input.display_order ?? 0,
        created_by: userId,
        created_info: userName,
        updated_at: now,
        updated_by: userId,
        updated_info: userName,
      };

      const { error } = await supabase
        .from('org_packing_preference_cf')
        .upsert(payload, {
          onConflict: 'tenant_org_id,packing_pref_code',
          ignoreDuplicates: false,
        });

      if (error) {
        if (error.code === '23503') {
          return { success: false, error: 'Invalid packing preference code' };
        }
        logger.error('Failed to upsert org_packing_preference_cf', new Error(error.message), {
          tenantId,
          packingPrefCode,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.upsertPackingPreferenceCf failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        packingPrefCode,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to save packing preference' };
    }
  }

  /**
   * Delete org_service_preference_cf (reset to system default)
   */
  static async deleteServicePreferenceCf(
    supabase: SupabaseClient,
    tenantId: string,
    preferenceCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('org_service_preference_cf')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('preference_code', preferenceCode);

      if (error) {
        logger.error('Failed to delete org_service_preference_cf', new Error(error.message), {
          tenantId,
          preferenceCode,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.deleteServicePreferenceCf failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        preferenceCode,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to reset service preference' };
    }
  }

  /**
   * Delete org_packing_preference_cf (reset to system default)
   */
  static async deletePackingPreferenceCf(
    supabase: SupabaseClient,
    tenantId: string,
    packingPrefCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('org_packing_preference_cf')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('packing_pref_code', packingPrefCode);

      if (error) {
        logger.error('Failed to delete org_packing_preference_cf', new Error(error.message), {
          tenantId,
          packingPrefCode,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.deletePackingPreferenceCf failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        packingPrefCode,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to reset packing preference' };
    }
  }

  /**
   * Get preference kinds for tenant: **only** rows in `org_preference_kind_cf` for the tenant,
   * merged with `sys_preference_kind_cd`. No org row ⇒ kind not returned.
   * @param quickBarOnly - When true, only return kinds with merged is_show_in_quick_bar=true
   */
  static async getPreferenceKinds(
    supabase: SupabaseClient,
    tenantId: string,
    quickBarOnly = true //true means only return quick bar preferences
  ): Promise<PreferenceKind[]> {
    try {
      const { data: tenantKinds, error: cfError } = await supabase
        .from('org_preference_kind_cf')
        .select('kind_code, name, name2, kind_bg_color, is_show_in_quick_bar, is_show_for_customer, is_active, is_stopped_by_saas, rec_order')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .order('rec_order', { ascending: true });

      if (cfError) {
        logger.error('Failed to fetch org_preference_kind_cf', new Error(cfError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_preference_kinds',
        });
        return [];
      }

      const cfRows = (tenantKinds || []).filter(
        (c) => c.is_active !== false && !c.is_stopped_by_saas
      );
      if (cfRows.length === 0) {
        return [];
      }

      const kindCodes = [...new Set(cfRows.map((c) => c.kind_code))];
      const { data: sysKinds, error: sysError } = await supabase
        .from('sys_preference_kind_cd')
        .select('kind_code, name, name2, kind_bg_color, main_type_code, icon, is_show_in_quick_bar, is_show_for_customer, rec_order, is_active')
        .in('kind_code', kindCodes)
        .eq('is_active', true);

      if (sysError) {
        logger.error('Failed to fetch sys_preference_kind_cd', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_preference_kinds',
        });
        return [];
      }

      const sysMap = new Map((sysKinds || []).map((s) => [s.kind_code, s]));

      const merged = cfRows
        .map((cf) => {
          const s = sysMap.get(cf.kind_code);
          if (!s) {
            return null;
          }
          const showQb = cf.is_show_in_quick_bar ?? s.is_show_in_quick_bar;
          if (quickBarOnly && showQb !== true) {
            return null;
          }
          return {
            kind_code: s.kind_code,
            name: cf.name ?? s.name,
            name2: cf.name2 ?? s.name2,
            kind_bg_color: cf.kind_bg_color ?? s.kind_bg_color,
            main_type_code: s.main_type_code as PreferenceMainType | null,
            icon: s.icon,
            is_show_in_quick_bar: cf.is_show_in_quick_bar ?? s.is_show_in_quick_bar,
            is_show_for_customer: cf.is_show_for_customer ?? s.is_show_for_customer,
            is_active: true,
            rec_order: cf.rec_order ?? s.rec_order,
          } as PreferenceKind;
        })
        .filter((row): row is PreferenceKind => row !== null);

      return merged.sort((a, b) => (a.rec_order ?? 0) - (b.rec_order ?? 0));
    } catch (err) {
      logger.error('PreferenceCatalogService.getPreferenceKinds failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Get preference kinds for admin (sys catalog + org overrides merged, all records)
   */
  static async getPreferenceKindsForAdmin(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<
    Array<{
      kind_code: string;
      name: string | null;
      name2: string | null;
      kind_bg_color: string | null;
      icon: string | null;
      main_type_code: string | null;
      rec_order: number | null;
      sys_is_active: boolean;
      cf_id: string | null;
      cf_name: string | null;
      cf_name2: string | null;
      cf_kind_bg_color: string | null;
      cf_is_show_in_quick_bar: boolean | null;
      cf_is_show_for_customer: boolean | null;
      cf_is_active: boolean | null;
    }>
  > {
    try {
      const { data: sysKinds, error: sysError } = await supabase
        .from('sys_preference_kind_cd')
        .select('kind_code, name, name2, kind_bg_color, icon, main_type_code, rec_order, is_active')
        .order('rec_order', { ascending: true });

      if (sysError) {
        logger.error('Failed to fetch sys_preference_kind_cd for admin', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_preference_kinds_for_admin',
        });
        return [];
      }

      const { data: tenantCf } = await supabase
        .from('org_preference_kind_cf')
        .select('id, kind_code, name, name2, kind_bg_color, is_show_in_quick_bar, is_show_for_customer, is_active')
        .eq('tenant_org_id', tenantId);

      const cfMap = new Map(
        (tenantCf || []).map((c) => [c.kind_code, c])
      );

      return (sysKinds || []).map((s) => {
        const cf = cfMap.get(s.kind_code);
        return {
          kind_code: s.kind_code,
          name: s.name,
          name2: s.name2,
          kind_bg_color: s.kind_bg_color,
          icon: s.icon,
          main_type_code: s.main_type_code,
          rec_order: s.rec_order,
          sys_is_active: s.is_active ?? true,
          cf_id: cf?.id ?? null,
          cf_name: cf?.name ?? null,
          cf_name2: cf?.name2 ?? null,
          cf_kind_bg_color: cf?.kind_bg_color ?? null,
          cf_is_show_in_quick_bar: cf?.is_show_in_quick_bar ?? null,
          cf_is_show_for_customer: cf?.is_show_for_customer ?? null,
          cf_is_active: cf?.is_active ?? null,
        };
      });
    } catch (err) {
      logger.error('PreferenceCatalogService.getPreferenceKindsForAdmin failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }

  /**
   * Upsert org_preference_kind_cf (tenant override for a preference kind)
   */
  static async upsertPreferenceKindCf(
    supabase: SupabaseClient,
    tenantId: string,
    kindCode: string,
    input: {
      name?: string | null;
      name2?: string | null;
      kind_bg_color?: string | null;
      is_show_in_quick_bar?: boolean;
      is_show_for_customer?: boolean;
      is_active?: boolean;
    },
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const payload = {
        tenant_org_id: tenantId,
        kind_code: kindCode,
        name: input.name ?? null,
        name2: input.name2 ?? null,
        kind_bg_color: input.kind_bg_color ?? null,
        is_show_in_quick_bar: input.is_show_in_quick_bar ?? true,
        is_show_for_customer: input.is_show_for_customer ?? true,
        is_active: input.is_active ?? true,
        created_by: userId,
        created_info: userName,
        updated_at: now,
        updated_by: userId,
        updated_info: userName,
      };

      const { error } = await supabase
        .from('org_preference_kind_cf')
        .upsert(payload, {
          onConflict: 'tenant_org_id,kind_code',
          ignoreDuplicates: false,
        });

      if (error) {
        if (error.code === '23503') {
          return { success: false, error: 'Invalid preference kind code' };
        }
        logger.error('Failed to upsert org_preference_kind_cf', new Error(error.message), {
          tenantId,
          kindCode,
          feature: 'preference_catalog',
        });
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.upsertPreferenceKindCf failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        kindCode,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to save preference kind' };
    }
  }

  /**
   * Delete (soft: is_active=false) or hard delete preference bundle
   */
  static async deletePreferenceBundle(
    supabase: SupabaseClient,
    tenantId: string,
    bundleId: string,
    hard = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (hard) {
        const { error } = await supabase
          .from('org_preference_bundles_cf')
          .delete()
          .eq('id', bundleId)
          .eq('tenant_org_id', tenantId);
        if (error) {
          logger.error('Failed to delete preference bundle', new Error(error.message), {
            tenantId,
            bundleId,
            feature: 'preference_catalog',
          });
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await supabase
          .from('org_preference_bundles_cf')
          .update({ is_active: false })
          .eq('id', bundleId)
          .eq('tenant_org_id', tenantId);
        if (error) {
          logger.error('Failed to deactivate preference bundle', new Error(error.message), {
            tenantId,
            bundleId,
            feature: 'preference_catalog',
          });
          return { success: false, error: error.message };
        }
      }
      return { success: true };
    } catch (err) {
      logger.error('PreferenceCatalogService.deletePreferenceBundle failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        bundleId,
        feature: 'preference_catalog',
      });
      return { success: false, error: 'Failed to delete bundle' };
    }
  }
}
