/**
 * PRD-003: Customer Management API
 * Main customer endpoints - Create and List
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  createCustomer,
  searchCustomers,
  searchCustomersProgressive,
  getCustomerStatistics,
  getAllTenantCustomers,
} from '@/lib/services/customers.service';
import { verifyOTP, hasRecentVerifiedOTP } from '@/lib/services/otp.service';
import type {
  CustomerCreateRequest,
  CustomerSearchParams,
} from '@/lib/types/customer';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Get authenticated user and tenant context
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user's tenants using the same function as frontend
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }
  // Use the first tenant (current tenant)
  const tenantId = tenants[0].tenant_id;
  const userRole = tenants[0].user_role;

  return {
    user,
    tenantId,
    userId: user.id,
    userRole,
  };
}

// ==================================================================
// POST /api/v1/customers - Create Customer
// ==================================================================

/**
 * Create a new customer (guest, stub, or full)
 *
 * Request Body:
 * - Guest: { type: 'guest', firstName: string }
 * - Stub: { type: 'stub', firstName: string, phone: string }
 * - Full: { type: 'full', firstName: string, phone: string, email?: string, otpCode: string, preferences?: object, addresses?: array }
 *
 * Response: { success: true, data: Customer }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { tenantId, userId } = await getAuthContext();

    // 2. Parse and validate request body
    const body: CustomerCreateRequest = await request.json();

    // 3. Validate required fields based on type
    if (!body.type || !['guest', 'stub', 'full'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid customer type. Must be: guest, stub, or full' },
        { status: 400 }
      );
    }

    if (!body.firstName || body.firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'firstName is required' },
        { status: 400 }
      );
    }

    // 4. Type-specific validation
    if (body.type === 'stub' || body.type === 'full') {
      if (!('phone' in body) || !body.phone) {
        return NextResponse.json(
          { error: 'phone is required for stub and full profiles' },
          { status: 400 }
        );
      }
    }

    if (body.type === 'full') {
      // Validate OTP was provided
      if (!('otpCode' in body) || !body.otpCode) {
        return NextResponse.json(
          { error: 'otpCode is required for full profile' },
          { status: 400 }
        );
      }

      // Verify OTP
      const otpResult = await verifyOTP({
        phone: body.phone,
        code: body.otpCode,
      });

      if (!otpResult.verified) {
        return NextResponse.json(
          {
            error: 'OTP verification failed',
            details: { message: otpResult.message },
          },
          { status: 400 }
        );
      }
    }

    // 5. Create customer via service
    const customer = await createCustomer(body);

    // 6. Return success response
    return NextResponse.json(
      {
        success: true,
        data: customer,
        message: `${body.type.charAt(0).toUpperCase() + body.type.slice(1)} customer created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      'Error creating customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'create' }
    );

    if (error instanceof Error) {
      // Handle specific error messages from service
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}

// ==================================================================
// GET /api/v1/customers - List Customers
// ==================================================================

/**
 * List customers with search and filters
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - search: string (search by name, phone, email, customer number)
 * - type: 'guest' | 'stub' | 'full' (filter by type)
 * - status: 'active' | 'inactive' (filter by status)
 * - sortBy: 'name' | 'createdAt' | 'lastOrderAt' | 'totalOrders'
 * - sortOrder: 'asc' | 'desc'
 *
 * Response: { success: true, data: CustomerListItem[], pagination: {...} }
 */

/**
 * GET /api/v1/customers
 * Returns all customers for current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const searchAllOptions = searchParams.get('searchAllOptions') === 'true';

    // If all=true, return all customers for the provided tenant_org_id or current session tenant
    if (all) {
      //const tenantOrgId = searchParams.get('tenant_org_id');
      const customers = await getAllTenantCustomers();//tenantOrgId);
      return NextResponse.json({ success: true, data: { customers } }, { status: 200 });
    }

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100', 100);
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Use progressive search
    const result = await searchCustomersProgressive({
      page, 
      limit,
      search,
      searchAllOptions,
      type: undefined, // Don't filter by type when searching
      status: 'active',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });

    return NextResponse.json({ 
      success: true, 
      data: { customers: result.customers || [] } 
    }, { status: 200 });
  } catch (error) {
    logger.error(
      'Failed to fetch customers',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'list' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

/*
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    console.log('Jh In GET(): Before auth context');
    await getAuthContext();
    console.log('Jh In GET(): After auth context');

    // 2. Parse query parameters
    console.log('Jh In GET(): Before parse query parameters');
    const { searchParams } = new URL(request.url);
    console.log('Jh In GET(): After parse query parameters');

    console.log('Jh In GET(): Before parse page');
    const page = parseInt(searchParams.get('page') || '1', 10);
    console.log('Jh In GET(): After parse page');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    console.log('Jh In GET(): After parse limit');
    console.log('Jh In GET(): page', page);
    console.log('Jh In GET(): limit', limit);
    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json(
        { error: 'page must be greater than 0' },
        { status: 400 }
      );
    }
    console.log('Jh In GET(): Before validate limit');
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }
    console.log('Jh In GET(): After validate limit');
    console.log('Jh In GET(): Before parse params');
    console.log('Jh In GET(): search', searchParams.get('search'));
    console.log('Jh In GET(): type', searchParams.get('type'));
    console.log('Jh In GET(): status', searchParams.get('status'));
    console.log('Jh In GET(): sortBy', searchParams.get('sortBy'));
    console.log('Jh In GET(): sortOrder', searchParams.get('sortOrder'));
    console.log('Jh In GET(): Before parse params');

    const params: CustomerSearchParams = {
      page,
      limit,
      search: searchParams.get('search') || undefined,
      type: (searchParams.get('type') as any) || undefined,
      status: (searchParams.get('status') as 'active' | 'inactive') || undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };
    console.log('Jh In GET(): After parse params'
      , JSON.stringify(params, null, 2));
    // 3. Validate type filter
    console.log('Jh In GET(): Before validate type filter');
    console.log('Jh In GET(): params.type', params.type);
    if (params.type && !['guest', 'stub', 'full'].includes(params.type)) {
      console.log('Jh In GET(): Invalid type. Must be: guest, stub, or full');
      return NextResponse.json(
        { error: 'Invalid type. Must be: guest, stub, or full' },
        { status: 400 }
      );
    }
    console.log('Jh In GET(): After validate type filter');
    console.log('Jh In GET(): Before validate status filter');
    // 4. Validate status filter
    console.log('Jh In GET(): params.status', params.status);
    if (params.status && !['active', 'inactive'].includes(params.status)) {
      console.log('Jh In GET(): Invalid status. Must be: active or inactive');
      return NextResponse.json(
        { error: 'Invalid status. Must be: active or inactive' },
        { status: 400 }
      );
    }
    console.log('Jh In GET(): After validate status filter');
    console.log('Jh In GET(): Before search customers');
    console.log('Jh In GET(): params', JSON.stringify(params, null, 2));
    // 5. Search customers
    const { customers, total } = await searchCustomers(params);
    console.log('Jh In GET(): After search customers');
    console.log('Jh In GET(): customers', JSON.stringify(customers, null, 2));
    console.log('Jh In GET(): total', total);
    // 6. Calculate pagination
    const totalPages = Math.ceil(total / limit);
    console.log('Jh In GET(): After calculate pagination');
    console.log('Jh In GET(): totalPages', totalPages);
    // 7. Get statistics if requested
    const includeStats = searchParams.get('includeStats') === 'true';
    console.log('Jh In GET(): includeStats', includeStats);
    let statistics = undefined;
    console.log('Jh In GET(): statistics', JSON.stringify(statistics, null, 2));
    console.log('Jh In GET(): Before get statistics');
    if (!includeStats) {
      statistics = await getCustomerStatistics();
    }
    console.log('Jh In GET(): After get statistics');
    console.log('Jh In GET(): Before return success response');
    console.log('Jh In GET(): customers', customers);
    console.log('Jh In GET(): total', total);
    console.log('Jh In GET(): totalPages', totalPages);
    console.log('Jh In GET(): statistics', JSON.stringify(statistics, null, 2));
    // 8. Return success response
    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      ...(statistics && { statistics }),
    });
  } catch (error) {
    console.error('Error fetching customers:', error);

    if (error instanceof Error) {
      console.error('Error fetching customers:', JSON.stringify(error, null, 2));
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      console.error('Error fetching customers:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error fetching customers:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
*/