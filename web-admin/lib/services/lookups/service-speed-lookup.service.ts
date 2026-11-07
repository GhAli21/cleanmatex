/**
 * Service speed catalog lookup — sys_service_speed_cd (Line-Level P5-03b, PLAN §5.4;
 * Service Speeds PLAN §5, D5).
 *
 * READ-ONLY in cleanmatex. Speeds are an HQ catalog (cleanmatexsaas). Every
 * active speed is listed (so labels resolve for speeds on older orders); with a
 * tenant, each row says whether this organization offers it: STANDARD always,
 * EXPRESS until S6 (its legacy category hours), any other speed only with an
 * active, effective Speed Pricing rule. The order loader enforces the same
 * (`SPEED_NOT_OFFERED`). Do not add write methods to this service.
 */

import { createClient } from '@/lib/supabase/server';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import type { LookupServiceResult, LookupSupabaseClient } from './types';

/** One active speed, in display order (rank: higher = faster). */
export interface ServiceSpeedLookupRow {
  code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  display_order: number;
  /** The speed new orders start with (STANDARD today). */
  is_default: boolean;
  /** Guidance for the Speed Pricing editor: HOURS | WORKING_DAYS. */
  default_turnaround_unit: string | null;
  /** This organization can sell it now (always true without a tenant). */
  is_offered: boolean;
}

/** Speeds offered with no rule: STANDARD by definition, EXPRESS until S6 retires its legacy hours. */
const ALWAYS_OFFERED = new Set<string>([SERVICE_SPEEDS.STANDARD, SERVICE_SPEEDS.EXPRESS]);

/**
 * Lists the active speeds for the speed menus and the Speed Pricing editor.
 * @param supabase - Optional session client (tests / callers that hold one).
 * @param tenantOrgId - The session tenant; null skips the offered check (all offered).
 * @returns active rows ordered by `display_order`, each with `is_offered`
 * @example const { data } = await listActiveServiceSpeeds(client, tenantId); data.filter((s) => s.is_offered);
 */
export async function listActiveServiceSpeeds(
  supabase?: LookupSupabaseClient,
  tenantOrgId: string | null = null,
): Promise<LookupServiceResult<ServiceSpeedLookupRow[]>> {
  try {
    const client = supabase ?? (await createClient());
    const [speeds, rules, tenant] = await Promise.all([
      client
        .from('sys_service_speed_cd')
        .select('code, name, name2, description, description2, display_order, is_default, default_turnaround_unit')
        .eq('is_active', true)
        .eq('rec_status', 1)
        .order('display_order', { ascending: true }),
      tenantOrgId
        ? client
          .from('org_speed_price_rules_cf')
          .select('service_speed, effective_from, effective_to')
          .eq('tenant_org_id', tenantOrgId)
          .eq('is_active', true)
          .eq('rec_status', 1)
        : null,
      tenantOrgId
        ? client.from('org_tenants_mst').select('timezone').eq('id', tenantOrgId).maybeSingle()
        : null,
    ]);
    if (speeds.error) return { success: false, error: speeds.error.message };
    if (rules?.error) return { success: false, error: rules.error.message };
    if (tenant?.error) return { success: false, error: tenant.error.message };

    const tz = tenant?.data?.timezone;
    // The rule dates are business dates in the organization's zone (as the order loader reads them).
    const today = businessDateForTimezone(isValidTimeZone(tz) ? tz : 'UTC');
    const ruled = new Set((rules?.data ?? [])
      .filter((r) => r.effective_from <= today && (r.effective_to == null || r.effective_to >= today))
      .map((r) => r.service_speed as string));
    const rows = (speeds.data ?? []) as Omit<ServiceSpeedLookupRow, 'is_offered'>[];
    return {
      success: true,
      data: rows.map((s) => ({ ...s, is_offered: !tenantOrgId || ALWAYS_OFFERED.has(s.code) || ruled.has(s.code) })),
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
