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
export const maxDuration = 10; // Vercel timeout limit

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check permission
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;
    const { searchParams } = new URL(request.url);

    const supabase = await createClient();
    
    // Get filters
    const currentStatus = searchParams.get('current_status');
    const currentStage = searchParams.get('current_stage');
    const statusFilter = searchParams.get('status_filter');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Optimize query - only select essential fields for list view
    // For list view, we don't need all nested data - just customer info
    const is_show_null_org_customers = searchParams.get('is_show_null_org_customers') !== 'false';
    
    let query = supabase
      .from('org_orders_mst')  
      .select(`
        id,
        order_no,
        current_status,
        current_stage,
        status,
        bag_count,
        received_at,
        created_at,
        updated_at,
        total_items,
        subtotal,
        tax,
        total,
        payment_status,
        priority,
        has_issue,
        is_rejected,
        org_customers_mst(
          id,
          name,
          phone,
          email,
          sys_customers_mst(
            id,
            name,
            phone,
            email
          )
        )
      `, { count: 'exact' })
      .eq('tenant_org_id', tenantId);

    // If we need to exclude null customers, use inner join
    if (!is_show_null_org_customers) {
      query = supabase
        .from('org_orders_mst')  
        .select(`
          id,
          order_no,
          current_status,
          current_stage,
          status,
          bag_count,
          received_at,
          created_at,
          updated_at,
          total_items,
          subtotal,
          tax,
          total,
          payment_status,
          priority,
          has_issue,
          is_rejected,
          org_customers_mst!inner(
            id,
            name,
            phone,
            email,
            sys_customers_mst(
              id,
              name,
              phone,
              email
            )
          )
        `, { count: 'exact' })
        .eq('tenant_org_id', tenantId);
    }

    // Apply status filter - support multiple statuses (comma-separated)
    // Priority: status_filter > current_status > current_stage
    const statusToFilter = statusFilter || currentStatus || currentStage;
    if (statusToFilter) {
      const statuses = statusToFilter.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        // Single status - use .eq() for better performance
        query = query.eq('current_status', statuses[0]);
      } else if (statuses.length > 1) {
        // Multiple statuses - use .in()
        query = query.in('current_status', statuses);
      }
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Sorting
    query = query.order('created_at', { ascending: false });
    
    // Add timeout wrapper to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 8000);
    });

    // Execute query with timeout protection
    const queryPromise = query.then((result: any) => result);
    const result = await Promise.race([
      queryPromise,
      timeoutPromise
    ]);
    
    const { data: orders, error, count } = result;

    if (error) {
      console.error('[Jh] GET /api/v1/orders: Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[API] GET /api/v1/orders - Success (${duration}ms, ${orders?.length || 0} orders)`);
    
    return NextResponse.json({
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (e) {
    const duration = Date.now() - startTime;
    const message = e instanceof Error ? e.message : 'Unknown error';
    
    // Handle timeout specifically
    if (message === 'Request timeout' || message.includes('timeout')) {
      console.error(`[API] GET /api/v1/orders - Timeout after ${duration}ms`);
      return NextResponse.json(
        { success: false, error: 'Request timeout - please try again' },
        { status: 504 }
      );
    }
    
    const status = message.includes('Unauthorized') ? 401 : 500;
    console.error(`[API] GET /api/v1/orders - Error after ${duration}ms:`, message);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

