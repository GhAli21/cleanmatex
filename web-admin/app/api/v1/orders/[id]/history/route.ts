import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found' + error?.message);
  return { tenantId: tenants[0].tenant_id as string };
}

/**
 * GET /api/v1/orders/[id]/history
 * PRD-010: Get comprehensive order history timeline
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = await getAuthContext();
    const history = await OrderService.getOrderHistory(params.id, tenantId);
    return NextResponse.json({ success: true, data: history });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}


