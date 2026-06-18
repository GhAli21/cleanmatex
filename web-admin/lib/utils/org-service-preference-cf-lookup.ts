/**
 * Batch resolve `org_service_preference_cf.id` by tenant + `preference_code`.
 * Codes are globally unique in `sys_service_preference_cd`; tenant CF rows are keyed by
 * `(tenant_org_id, preference_code)` — sufficient for condition / service / color rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/** Prisma transaction client (matches order-service / order-piece-service). */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 *
 * @param supabase
 * @param tenantOrgId
 * @param codes
 */
export async function fetchOrgServicePreferenceCfIdsByCodesSupabase(
  supabase: SupabaseClient,
  tenantOrgId: string,
  codes: Iterable<string>
): Promise<Map<string, string>> {
  const unique = [...new Set([...codes].filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('org_service_preference_cf')
    .select('id, preference_code')
    .eq('tenant_org_id', tenantOrgId)
    .in('preference_code', unique);

  if (error || !data) return new Map();
  const m = new Map<string, string>();
  for (const row of data) {
    if (typeof row.preference_code === 'string' && row.preference_code !== '' && row.id) {
      m.set(row.preference_code, row.id);
    }
  }
  return m;
}

/**
 * `org_service_preference_cf` is not on the Prisma client; raw SQL keeps the txn atomic.
 * @param tx
 * @param tenantOrgId
 * @param codes
 */
export async function fetchOrgServicePreferenceCfIdsByCodesPrismaTx(
  tx: PrismaTx,
  tenantOrgId: string,
  codes: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await tx.$queryRaw<{ id: string; preference_code: string }[]>(Prisma.sql`
    SELECT id, preference_code
    FROM org_service_preference_cf
    WHERE tenant_org_id = ${tenantOrgId}::uuid
      AND preference_code IN (${Prisma.join(unique)})
  `);

  const m = new Map<string, string>();
  for (const row of rows) {
    if (row.preference_code && row.id) m.set(row.preference_code, row.id);
  }
  return m;
}
