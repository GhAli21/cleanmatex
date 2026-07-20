/**
 * GET /api/v1/orders/issues
 * Tenant-wide issues queue (auth-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  return {
    tenantId: tenants[0].tenant_id as string,
  };
}

/**
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await getAuthContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'open';
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      100
    );

    const supabase = await createClient();
    let query = supabase
      .from('org_order_issues')
      .select(
        'id, order_id, scope_level, order_item_id, order_item_piece_id, issue_code, issue_text, priority, created_at, solved_at, solved_notes'
      )
      .eq('tenant_org_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status === 'open') {
      query = query.is('solved_at', null);
    } else if (status === 'solved') {
      query = query.not('solved_at', 'is', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('GET /api/v1/orders/issues error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const issues = data ?? [];
    const orderIds = [...new Set(issues.map((i) => i.order_id).filter(Boolean))];
    let orderNoById: Record<string, string> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('org_orders_mst')
        .select('id, order_no')
        .eq('tenant_org_id', tenantId)
        .in('id', orderIds);
      orderNoById = Object.fromEntries(
        (orders ?? []).map((o) => [o.id, o.order_no as string])
      );
    }

    const rows = issues.map((row) => ({
      ...row,
      order_no: orderNoById[row.order_id] ?? null,
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
