/**
 * Orders API - Main endpoints
 * PRD-010: Advanced Order Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';
import { CreateOrderRequestSchema } from '@/lib/validations/workflow-schema';
import { getAuthContext, requirePermission } from '@/lib/middleware/require-permission';

/**
 * POST /api/v1/orders
 * Create new order
 * Requires: orders:create permission
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission 
    console.log('[Jh] POST (1) /api/v1/orders: Checking permission orders:create')
    const authCheck = await requirePermission('orders:create')(request);
    console.log('[Jh] POST (2) /api/v1/orders: Returned Auth check:', authCheck)
    if (authCheck instanceof NextResponse) {
      console.log('[Jh] POST (3) /api/v1/orders: Permission denied')
      return authCheck; // Permission denied 
    }
    console.log('[Jh] POST (4) /api/v1/orders: Permission granted') 
    const { tenantId, userId, userName } = authCheck;
    console.log('[Jh] POST (5) /api/v1/orders: Tenant ID:', tenantId)
    console.log('[Jh] POST (6) /api/v1/orders: User ID:', userId)
    console.log('[Jh] POST (7) /api/v1/orders: User Name:', userName)

    const body = await request.json();
    console.log('[Jh] POST (8) /api/v1/orders: Request body:', JSON.stringify(body, null, 2));
    
    const parsed = CreateOrderRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      const errorDetails = parsed.error.issues?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })) || [];
      
      console.error('[Jh] POST (9) /api/v1/orders: Validation failed:', JSON.stringify(errorDetails, null, 2));
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body', 
          details: errorDetails
        },
        { status: 400 }
      );
    }

    console.log('[Jh] POST (10) /api/v1/orders: Creating order')
    const result = await OrderService.createOrder({
      tenantId,
      userId,
      userName,
      ...parsed.data,
    });

    console.log('[Jh] POST (11) /api/v1/orders: Order created:', result.order)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    console.log('[Jh] POST (12) /api/v1/orders: Returning response')
    return NextResponse.json({ success: true, data: result.order });
  } catch (e) {
    console.log('[Jh] POST (13) /api/v1/orders: Error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    console.log('[Jh] POST (14) /api/v1/orders: Returning error response', { status, message })
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/v1/orders
 * List orders with filters
 * Requires: orders:read permission
 */
export async function GET(request: NextRequest) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;
    const { searchParams } = new URL(request.url);

    const supabase = await createClient();
    
    console.log('[Jh] GET /api/v1/orders: Supabase client created');
    
    // org_customers_mst!inner(
    let query = null;
    const is_show_null_org_customers = 'true';//searchParams.get('is_show_null_org_customers');
    console.log('[Jh] GET /api/v1/orders: is_show_null_org_customers:', is_show_null_org_customers);
    if (is_show_null_org_customers === 'true'){
    query = supabase
      .from('org_orders_mst')  
      .select(`
        *,
        org_customers_mst(
          *,
          sys_customers_mst(*)
        ),
        org_order_items_dtl(
          *,
          org_product_data_mst(*)
        )
      `)
      .eq('tenant_org_id', tenantId);
      }
    else {
    query = supabase
      .from('org_orders_mst')  
      .select(`
        *,
        org_customers_mst!inner(
          *,
          sys_customers_mst(*)
        ),
        org_order_items_dtl(
          *,
          org_product_data_mst(*)
        )
      `)
      .eq('tenant_org_id', tenantId);
    }
    /* 
    // Apply filters
    const status = searchParams.get('status');
    const currentStatus = searchParams.get('current_status');

    if (status) {
      query = query.eq('status', status);
    }

    if (currentStatus) {
      query = query.eq('current_status', currentStatus);
    }

    const isQuickDrop = searchParams.get('isQuickDrop');
    if (isQuickDrop === 'true') {
      query = query.eq('is_order_quick_drop', true);
    }

    const hasIssue = searchParams.get('hasIssue');
    if (hasIssue === 'true') {
      query = query.eq('has_issue', true);
    }

    const hasSplit = searchParams.get('hasSplit');
    if (hasSplit === 'true') {
      query = query.eq('has_split', true);
    }
    */

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Pagination
    query = query.range((page - 1) * limit, page * limit - 1);

    // Sorting
    query = query.order('created_at', { ascending: false });
    
    const { data: orders, error } = await query;

    if (error) {
      console.error('[Jh] GET /api/v1/orders: Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.log('[Jh] GET /api/v1/orders: Orders Count:', orders?.length);
    //console.log('[Jh] GET /api/v1/orders: Orders:', JSON.stringify(orders, null, 2));
    
    //
    /*console.log('[Jh] GET /api/v1/orders: Response:', JSON.stringify({
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page,
          limit,
          total: orders?.length || 0,
        },
      },
    }, null, 2));
    */
    //
    console.log('[Jh] GET /api/v1/orders: Returning response');
    console.log('[Jh] GET /api/v1/orders: Orders Count:', orders?.length);
    
    return NextResponse.json({
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page,
          limit,
          total: orders?.length || 0,
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    console.error('[Jh] GET /api/v1/orders: Error:', message);
    console.log('[Jh] GET /api/v1/orders: Returning error response', { status, message });
    return NextResponse.json({ error: message }, { status });
  }
}

