/**
 * Priority catalog lookup — sys_lkp_priority_cd
 *
 * READ-ONLY in cleanmatex. Create / edit / delete of priorities is HQ-only
 * (cleanmatexsaas). Do not add write methods to this service.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  LookupCatalogBase,
  LookupServiceResult,
  LookupSupabaseClient,
} from './types';

export interface PriorityLookupRow extends LookupCatalogBase {
  is_default: boolean | null;
}

export type PriorityLookupMap = Record<
  string,
  {
    name: string | null;
    name2: string | null;
    color: string | null;
    display_order: number | null;
  }
>;

async function resolveClient(
  supabase?: LookupSupabaseClient
): Promise<LookupSupabaseClient> {
  return supabase ?? (await createClient());
}

/**
 * List active priorities ordered for pickers / filters.
 */
export async function listActivePriorities(
  supabase?: LookupSupabaseClient
): Promise<LookupServiceResult<PriorityLookupRow[]>> {
  try {
    const client = await resolveClient(supabase);
    const { data, error } = await client
      .from('sys_lkp_priority_cd')
      .select(
        'code, name, name2, display_order, color, icon, is_default'
      )
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []) as PriorityLookupRow[],
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Load priority metadata for a set of codes (enrichment). Includes inactive
 * so historical issue rows still resolve labels/colors.
 */
export async function getPrioritiesByCodes(
  codes: string[],
  supabase?: LookupSupabaseClient
): Promise<LookupServiceResult<PriorityLookupMap>> {
  const unique = [
    ...new Set(codes.map((c) => c.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) {
    return { success: true, data: {} };
  }

  try {
    const client = await resolveClient(supabase);
    const { data, error } = await client
      .from('sys_lkp_priority_cd')
      .select('code, name, name2, color, display_order')
      .in('code', unique);

    if (error) {
      return { success: false, error: error.message };
    }

    const map: PriorityLookupMap = {};
    for (const row of data ?? []) {
      map[row.code] = {
        name: row.name ?? null,
        name2: row.name2 ?? null,
        color: row.color ?? null,
        display_order: row.display_order ?? null,
      };
    }
    return { success: true, data: map };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * True when code exists and is_active.
 */
export async function isActivePriority(
  code: string,
  supabase?: LookupSupabaseClient
): Promise<boolean> {
  const normalized = code.trim();
  if (!normalized) return false;

  try {
    const client = await resolveClient(supabase);
    const { data } = await client
      .from('sys_lkp_priority_cd')
      .select('code')
      .eq('code', normalized)
      .eq('is_active', true)
      .maybeSingle();
    return Boolean(data?.code);
  } catch {
    return false;
  }
}
