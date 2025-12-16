/**
 * PRD-003: Customer Management API
 * Customer Address Management - List and Create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCustomerAddresses,
  createAddress,
  validateCoordinates,
} from '@/lib/services/customer-addresses.service';
import type { CreateAddressRequest } from '@/lib/types/customer';

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

  const tenantId = user.user_metadata?.tenant_org_id;
  if (!tenantId) {
    throw new Error('No tenant context');
  }

  return {
    user,
    tenantId,
    userId: user.id,
    userRole: user.user_metadata?.role || 'user',
  };
}

// ==================================================================
// GET /api/v1/customers/:id/addresses - List Customer Addresses
// ==================================================================

/**
 * Get all addresses for a customer
 *
 * Response: {
 *   success: true,
 *   data: CustomerAddress[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify authentication
    await getAuthContext();

    // 2. Get customer ID from route params
    const { id: customerId } = await params;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // 3. Get customer addresses
    const addresses = await getCustomerAddresses(customerId);

    // 4. Return success response
    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error('Error fetching customer addresses:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch customer addresses' },
      { status: 500 }
    );
  }
}

// ==================================================================
// POST /api/v1/customers/:id/addresses - Create Address
// ==================================================================

/**
 * Create a new address for a customer
 *
 * Request Body: {
 *   addressType: 'home' | 'work' | 'other',
 *   label?: string,
 *   building?: string,
 *   floor?: string,
 *   apartment?: string,
 *   street?: string,
 *   area?: string,
 *   city?: string,
 *   country?: string (default: 'OM'),
 *   postalCode?: string,
 *   latitude?: number,
 *   longitude?: number,
 *   isDefault?: boolean,
 *   deliveryNotes?: string
 * }
 *
 * Response: {
 *   success: true,
 *   data: CustomerAddress,
 *   message: 'Address created successfully'
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify authentication
    await getAuthContext();

    // 2. Get customer ID from route params
    const { id: customerId } = await params;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body: CreateAddressRequest = await request.json();

    // 4. Validate required fields
    if (!body.addressType) {
      return NextResponse.json(
        { error: 'addressType is required' },
        { status: 400 }
      );
    }

    // 5. Validate address type
    const validTypes = ['home', 'work', 'other'];
    if (!validTypes.includes(body.addressType)) {
      return NextResponse.json(
        { error: 'addressType must be: home, work, or other' },
        { status: 400 }
      );
    }

    // 6. Validate GPS coordinates if provided
    if (body.latitude !== undefined || body.longitude !== undefined) {
      const coordValidation = validateCoordinates(body.latitude, body.longitude);
      if (!coordValidation.valid) {
        return NextResponse.json(
          { error: coordValidation.error },
          { status: 400 }
        );
      }
    }

    // 7. Validate at least one address field is provided
    const hasAddressInfo =
      body.building ||
      body.street ||
      body.area ||
      body.city ||
      body.label;

    if (!hasAddressInfo) {
      return NextResponse.json(
        { error: 'At least one address field (building, street, area, city, or label) must be provided' },
        { status: 400 }
      );
    }

    // 8. Create address
    const address = await createAddress(customerId, body);

    // 9. Return success response
    return NextResponse.json(
      {
        success: true,
        data: address,
        message: 'Address created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating address:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create address' },
      { status: 500 }
    );
  }
}
