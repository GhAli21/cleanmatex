/**
 * PRD-003: Customer Management API
 * Individual customer endpoints - Get, Update, Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  findCustomerById,
  updateCustomer,
  deactivateCustomer,
} from '@/lib/services/customers.service';
import { getCustomerAddresses } from '@/lib/services/customer-addresses.service';
import type { CustomerUpdateRequest } from '@/lib/types/customer';

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
// GET /api/v1/customers/:id - Get Customer Details
// ==================================================================

/**
 * Get customer details with tenant data, addresses, and order history
 *
 * Response: {
 *   success: true,
 *   data: {
 *     ...customer,
 *     tenantData: { loyaltyPoints, totalOrders, totalSpent, ... },
 *     addresses: [...],
 *   }
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

    // 3. Find customer by ID (with tenant data)
    const customer = await findCustomerById(customerId);

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // 4. Get customer addresses using the sys_customers_mst.id (customer.id)
    // Note: customer.id is the sys_customers_mst.id, which is what getCustomerAddresses expects
    const addresses = await getCustomerAddresses(customer.id);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        addresses,
      },
    });
  } catch (error) {
    console.error('Error fetching customer:', error);

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
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

// ==================================================================
// PATCH /api/v1/customers/:id - Update Customer Profile
// ==================================================================

/**
 * Update customer profile
 *
 * Request Body: {
 *   firstName?: string,
 *   lastName?: string,
 *   name?: string,
 *   name2?: string,
 *   email?: string,
 *   address?: string,
 *   area?: string,
 *   building?: string,
 *   floor?: string,
 *   preferences?: object
 * }
 *
 * Response: { success: true, data: Customer }
 */
export async function PATCH(
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
    const updates: CustomerUpdateRequest = await request.json();

    // 4. Validate at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // 5. Validate email format if provided
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // 6. Validate name fields if provided
    if (updates.firstName !== undefined && updates.firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'firstName cannot be empty' },
        { status: 400 }
      );
    }

    // 7. Update customer
    const customer = await updateCustomer(customerId, updates);

    // 8. Return success response
    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating customer:', error);

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
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// ==================================================================
// DELETE /api/v1/customers/:id - Deactivate Customer
// ==================================================================

/**
 * Deactivate customer (soft delete)
 *
 * Response: { success: true, message: 'Customer deactivated successfully' }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify authentication
    const { userRole } = await getAuthContext();

    // 2. Check permission (only admin can deactivate customers)
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins can deactivate customers.' },
        { status: 403 }
      );
    }

    // 3. Get customer ID from route params
    const { id: customerId } = await params;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // 4. Verify customer exists before deactivating
    const customer = await findCustomerById(customerId);

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // 5. Check if customer has pending orders (optional business rule)
    // TODO: Add check for pending orders if required
    // const hasPendingOrders = await checkPendingOrders(customerId);
    // if (hasPendingOrders) {
    //   return NextResponse.json(
    //     { error: 'Cannot deactivate customer with pending orders' },
    //     { status: 409 }
    //   );
    // }

    // 6. Deactivate customer
    await deactivateCustomer(customerId);

    // 7. Return success response
    return NextResponse.json({
      success: true,
      message: 'Customer deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating customer:', error);

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
      { error: 'Failed to deactivate customer' },
      { status: 500 }
    );
  }
}
