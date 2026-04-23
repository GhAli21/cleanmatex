import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const verificationToken = extractBearerToken(request);

    if (!tenantId || !verificationToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and bearer token are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from('org_orders_mst')
      .select(
        `
        id,
        order_no,
        current_status,
        status,
        received_at,
        ready_by,
        ready_by_at_new,
        total_items,
        bag_count,
        org_customers_mst!inner(phone)
      `,
      )
      .eq('tenant_org_id', tenantId)
      .eq('org_customers_mst.phone', session.phoneNumber)
      .order('received_at', { ascending: false })
      .limit(25);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          orders: (orders ?? []).map((order: any) => ({
            id: order.id,
            orderNo: order.order_no,
            status: order.current_status || order.status,
            receivedAt: order.received_at,
            readyBy: order.ready_by_at_new || order.ready_by || null,
            totalItems: order.total_items ? Number(order.total_items) : null,
            bagCount: order.bag_count ? Number(order.bag_count) : null,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
