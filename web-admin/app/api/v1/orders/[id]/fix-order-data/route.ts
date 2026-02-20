import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + (error?.message ?? ''));
  }
  return { tenantId: tenants[0].tenant_id as string };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { tenantId } = await getAuthContext();
    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const steps: string[] = Array.isArray(body.steps)
      ? body.steps
      : ['complete_order_item_pieces'];

    const { data: fixResult, error: rpcError } = await supabase.rpc('fix_order_data', {
      p_tenant_org_id: tenantId,
      p_steps: steps,
      p_order_id: orderId,
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message ?? 'Fix failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: fixResult ?? { overall: 'success', steps: [] } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
