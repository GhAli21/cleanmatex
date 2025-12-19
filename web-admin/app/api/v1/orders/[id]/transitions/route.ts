import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from '@/lib/services/workflow-service';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found' + error?.message);
  return { tenantId: tenants[0].tenant_id as string };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tenantId } = await getAuthContext();
    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('org_orders_mst')
      .select('status, service_category_code')
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Fetch tenant workflow settings to compute allowed transitions
    const result = await WorkflowService.isTransitionAllowed({
      tenantId,
      fromStatus: order.status as any,
      toStatus: order.status as any,
      serviceCategoryCode: order.service_category_code || undefined,
    });

    // Get full list using settings or fallback matrix
    const { data: settings } = await supabase
      .from('org_workflow_settings_cf')
      .select('status_transitions')
      .eq('tenant_org_id', tenantId)
      .eq('service_category_code', (order.service_category_code || null) as any)
      .eq('is_active', true)
      .single();

    let allowed: string[] = [];
    if (settings?.status_transitions) {
      allowed = (settings.status_transitions as Record<string, string[]>)[(order.status as any)] || [];
    } else {
      const { WORKFLOW_TRANSITIONS } = await import('@/lib/services/workflow-constants');
      allowed = WORKFLOW_TRANSITIONS[(order.status as any)] || [];
    }

    return NextResponse.json({ success: true, data: allowed, meta: { check: result } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}


