/**
 * Batch lookup of tenant packing option surcharges (`org_packing_preference_cf.extra_price`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/** Prisma transaction client (matches order-service transaction typing). */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 *
 * @param supabase
 * @param tenantOrgId
 * @param codes
 */
export async function fetchOrgPackingExtraPriceByCodesSupabase(
  supabase: SupabaseClient,
  tenantOrgId: string,
  codes: Iterable<string>
): Promise<Map<string, number>> {
  const unique = [...new Set([...codes].filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('org_packing_preference_cf')
    .select('packing_pref_code, extra_price')
    .eq('tenant_org_id', tenantOrgId)
    .in('packing_pref_code', unique);

  if (error || !data) return new Map();
  const m = new Map<string, number>();
  for (const row of data) {
    if (typeof row.packing_pref_code !== 'string' || row.packing_pref_code === '') continue;
    m.set(row.packing_pref_code, row.extra_price != null ? Number(row.extra_price) : 0);
  }
  return m;
}

/**
 *
 * @param tx
 * @param tenantOrgId
 * @param codes
 */
export async function fetchOrgPackingExtraPriceByCodesPrismaTx(
  tx: PrismaTx,
  tenantOrgId: string,
  codes: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return new Map();

  // `org_packing_preference_cf` is not on the Prisma client; raw SQL keeps the txn atomic.
  const rows = await tx.$queryRaw<{ packing_pref_code: string; extra_price: unknown }[]>(Prisma.sql`
    SELECT packing_pref_code, extra_price
    FROM org_packing_preference_cf
    WHERE tenant_org_id = ${tenantOrgId}::uuid
      AND packing_pref_code IN (${Prisma.join(unique)})
  `);

  const m = new Map<string, number>();
  for (const row of rows) {
    m.set(row.packing_pref_code, row.extra_price != null ? Number(row.extra_price) : 0);
  }
  return m;
}
