/**
 * GET /api/v1/orders/[id]/discounts
 * Returns non-voided discount audit lines for the order.
 * Used by print/receipt pages to display per-source discount breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

/**
 *
 * @param _request
 * @param root0
 * @param root0.params
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getAuthContext();
    const { id } = await params;
    const lines = await getDiscountLinesForOrder(tenantId, id);
    return NextResponse.json({ discountLines: lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch discount lines';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
