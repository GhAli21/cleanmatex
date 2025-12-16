/**
 * POST /api/v1/orders/estimate-ready-by
 * Estimate ready-by date based on items and priority
 * PRD-010: SLA calculation endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await OrderService.estimateReadyBy(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, data: { readyByAt: result.readyByAt } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

