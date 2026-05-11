/**
 * Batch lookup of tenant packing option surcharges (`org_packing_preference_cf.extra_price`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db/prisma';

/** Prisma transaction client (matches order-service transaction typing). */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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

export async function fetchOrgPackingExtraPriceByCodesPrismaTx(
  tx: PrismaTx,
  tenantOrgId: string,
  codes: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await tx.org_packing_preference_cf.findMany({
    where: { tenant_org_id: tenantOrgId, packing_pref_code: { in: unique } },
    select: { packing_pref_code: true, extra_price: true },
  });

  const m = new Map<string, number>();
  for (const row of rows) {
    m.set(row.packing_pref_code, row.extra_price != null ? Number(row.extra_price) : 0);
  }
  return m;
}
