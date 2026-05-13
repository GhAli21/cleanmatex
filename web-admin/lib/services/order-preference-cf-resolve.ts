/**
 * Resolve `org_service_preference_cf.id` for order preference rows where
 * `preference_code` + `preference_sys_kind` match tenant catalog (e.g. conditions).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Prisma } from '@prisma/client';

export type ServicePrefLookupPair = {
  preference_code: string;
  preference_sys_kind: string;
};

export function servicePrefCfMapKey(preference_code: string, preference_sys_kind: string): string {
  return `${String(preference_code).toUpperCase()}|${preference_sys_kind}`;
}

export async function resolveServicePreferenceCfIdMapSupabase(
  supabase: SupabaseClient,
  tenantId: string,
  pairs: ReadonlyArray<ServicePrefLookupPair>
): Promise<Map<string, string>> {
  if (pairs.length === 0) return new Map();
  const codes = [...new Set(pairs.map((p) => String(p.preference_code).toUpperCase()))];
  const { data, error } = await supabase
    .from('org_service_preference_cf')
    .select('id, preference_code, preference_sys_kind, is_active')
    .eq('tenant_org_id', tenantId)
    .in('preference_code', codes);

  if (error || !data?.length) return new Map();

  const map = new Map<string, string>();
  for (const r of data) {
    if (r.is_active === false) continue;
    const code = String(r.preference_code ?? '').toUpperCase();
    const kind = String(r.preference_sys_kind ?? '');
    if (!code || !kind) continue;
    map.set(servicePrefCfMapKey(code, kind), String(r.id));
  }
  return map;
}

export async function resolveServicePreferenceCfIdMapPrismaTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pairs: ReadonlyArray<ServicePrefLookupPair>
): Promise<Map<string, string>> {
  if (pairs.length === 0) return new Map();
  const codes = [...new Set(pairs.map((p) => String(p.preference_code).toUpperCase()))];
  const rows = await tx.$queryRawUnsafe<
    Array<{ id: string; preference_code: string; preference_sys_kind: string }>
  >(
    `SELECT id, preference_code, preference_sys_kind::text AS preference_sys_kind
     FROM org_service_preference_cf
     WHERE tenant_org_id = $1::uuid
       AND (is_active IS DISTINCT FROM false)
       AND preference_code = ANY($2::text[])`,
    tenantId,
    codes
  );

  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(servicePrefCfMapKey(r.preference_code, r.preference_sys_kind), r.id);
  }
  return map;
}
