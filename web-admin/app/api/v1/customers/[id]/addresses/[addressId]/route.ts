/**
 * PRD-003: Customer Management API
 * Individual Address Management - Update and Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAddressById,
  updateAddress,
  deleteAddress,
  validateCoordinates,
} from '@/lib/services/customer-addresses.service';
import type { UpdateAddressRequest } from '@/lib/types/customer';

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
// PATCH /api/v1/customers/:id/addresses/:addressId - Update Address
// ==================================================================

/**
 * Update an existing address
 *
 * Request Body: {
 *   addressType?: 'home' | 'work' | 'other',
 *   label?: string,
 *   building?: string,
 *   floor?: string,
 *   apartment?: string,
 *   street?: string,
 *   area?: string,
 *   city?: string,
 *   country?: string,
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
 *   message: 'Address updated successfully'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    // 1. Verify authentication
    await getAuthContext();

    // 2. Get IDs from route params
    const { id: customerId, addressId } = await params;

    if (!customerId || !addressId) {
      return NextResponse.json(
        { error: 'Customer ID and Address ID are required' },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const updates: UpdateAddressRequest = await request.json();

    // 4. Validate at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // 5. Validate address type if provided
    if (updates.addressType) {
      const validTypes = ['home', 'work', 'other'];
      if (!validTypes.includes(updates.addressType)) {
        return NextResponse.json(
          { error: 'addressType must be: home, work, or other' },
          { status: 400 }
        );
      }
    }

    // 6. Validate GPS coordinates if provided
    if (updates.latitude !== undefined || updates.longitude !== undefined) {
      const coordValidation = validateCoordinates(updates.latitude, updates.longitude);
      if (!coordValidation.valid) {
        return NextResponse.json(
          { error: coordValidation.error },
          { status: 400 }
        );
      }
    }

    // 7. Update address
    const address = await updateAddress(customerId, addressId, updates);

    // 8. Return success response
    return NextResponse.json({
      success: true,
      data: address,
      message: 'Address updated successfully',
    });
  } catch (error) {
    console.error('Error updating address:', error);

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
      { error: 'Failed to update address' },
      { status: 500 }
    );
  }
}

// ==================================================================
// DELETE /api/v1/customers/:id/addresses/:addressId - Delete Address
// ==================================================================

/**
 * Delete an address (soft delete)
 *
 * Response: {
 *   success: true,
 *   message: 'Address deleted successfully'
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    // 1. Verify authentication
    await getAuthContext();

    // 2. Get IDs from route params
    const { id: customerId, addressId } = await params;

    if (!customerId || !addressId) {
      return NextResponse.json(
        { error: 'Customer ID and Address ID are required' },
        { status: 400 }
      );
    }

    // 3. Verify address exists before deleting
    const address = await getAddressById(customerId, addressId);

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // 4. Delete address (soft delete)
    await deleteAddress(customerId, addressId);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting address:', error);

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
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}
