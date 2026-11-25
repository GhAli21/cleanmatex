import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogReadClient } from '@/lib/supabase/catalog-read';

/**
 * Catalog names of the given speed codes (`sys_service_speed_cd`), for the line qualifier ("Express").
 * A `sys_*` read, so it goes through the catalog client, never the user session.
 * @param codes speed codes found on the order lines (duplicates and blanks are ignored)
 * @param sessionClient only for Jest, which passes its mock through (see `catalogReadClient`)
 * @returns name and Arabic name by code; a code the catalog does not know is simply absent
 */
export async function loadSpeedNames(
  codes: ReadonlyArray<string | null | undefined>,
  sessionClient?: SupabaseClient,
): Promise<Map<string, { name: string; name2: string | null }>> {
  const unique = [...new Set(codes.filter((c): c is string => !!c))];
  const names = new Map<string, { name: string; name2: string | null }>();
  if (unique.length === 0) return names;
  const { data } = await catalogReadClient(sessionClient).from('sys_service_speed_cd').select('code, name, name2').in('code', unique);
  for (const row of (data ?? []) as Array<{ code: string; name: string; name2: string | null }>) names.set(row.code, { name: row.name, name2: row.name2 });
  return names;
}
