/**
 * GET /api/v1/orders/issues
 * Tenant-wide issues queue (auth-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ORDER_ISSUE_STATUS } from '@/lib/constants/order-issues';
import { OrderService } from '@/lib/services/order-service';

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
    const scope = searchParams.get('scope') ?? 'all';
    const priority = searchParams.get('priority');
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      100
    );

    const supabase = await createClient();
    let query = supabase
      .from('org_order_issues')
      .select(
        'id, order_id, scope_level, order_item_id, order_item_piece_id, issue_code, issue_text, priority, status, created_at, created_by, solved_at, solved_by, solved_notes'
      )
      .eq('tenant_org_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status === 'open') {
      query = query.eq('status', ORDER_ISSUE_STATUS.OPEN);
    } else if (status === 'solved') {
      query = query.eq('status', ORDER_ISSUE_STATUS.SOLVED);
    }

    if (scope === 'ORDER' || scope === 'ITEM' || scope === 'PIECE') {
      query = query.eq('scope_level', scope);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
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

    const enriched = await OrderService.enrichIssueRows(
      tenantId,
      issues as Record<string, unknown>[]
    );

    const rows = enriched.map((row) => ({
      ...row,
      order_no:
        typeof row.order_id === 'string'
          ? orderNoById[row.order_id] ?? null
          : null,
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
