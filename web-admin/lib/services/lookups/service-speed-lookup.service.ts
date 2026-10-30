/**
 * Service speed catalog lookup — sys_service_speed_cd (Line-Level P5-03b, PLAN §5.4).
 *
 * READ-ONLY in cleanmatex. Speeds are an HQ catalog (cleanmatexsaas); the
 * New Order and Edit Order speed menus list the active rows, never a
 * hard-coded list. Do not add write methods to this service.
 */

import { createClient } from '@/lib/supabase/server';
import type { LookupServiceResult, LookupSupabaseClient } from './types';

/** One active speed, in display order. */
export interface ServiceSpeedLookupRow {
  code: string;
  name: string;
  name2: string | null;
  display_order: number;
  /** The speed new orders start with (STANDARD today). */
  is_default: boolean;
}

/**
 * Lists the active speeds for the speed menus.
 * @param supabase - Optional session client (tests / callers that hold one).
 * @returns active rows ordered by `display_order`
 * @example const { data } = await listActiveServiceSpeeds(); // [{ code: 'STANDARD', … }, { code: 'EXPRESS', … }]
 */
export async function listActiveServiceSpeeds(
  supabase?: LookupSupabaseClient
): Promise<LookupServiceResult<ServiceSpeedLookupRow[]>> {
  try {
    const client = supabase ?? (await createClient());
    const { data, error } = await client
      .from('sys_service_speed_cd')
      .select('code, name, name2, display_order, is_default')
      .eq('is_active', true)
      .eq('rec_status', 1)
      .order('display_order', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ServiceSpeedLookupRow[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
