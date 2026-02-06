/**
 * PRD-003: Customer Management API
 * Individual customer endpoints - Get, Update, Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  findCustomerById,
  updateCustomer,
  deactivateCustomer,
} from '@/lib/services/customers.service';
import { getCustomerAddresses } from '@/lib/services/customer-addresses.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';
import type { CustomerUpdateRequest } from '@/lib/types/customer';

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
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const { id: customerId } = await params;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customer = await findCustomerById(customerId);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const addresses = await getCustomerAddresses(customer.id);
    return NextResponse.json({
      success: true,
      data: { ...customer, addresses },
    });
  } catch (error) {
    logger.error(
      'Error fetching customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'getById' }
    );
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
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
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const { id: customerId } = await params;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const updates: CustomerUpdateRequest = await request.json();
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    if (updates.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    if (updates.firstName !== undefined && updates.firstName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'firstName cannot be empty' },
        { status: 400 }
      );
    }

    const customer = await updateCustomer(customerId, updates);
    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer profile updated successfully',
    });
  } catch (error) {
    logger.error(
      'Error updating customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'update' }
    );
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
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
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('customers:delete')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) return rateLimitResponse;

    const { id: customerId } = await params;
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customer = await findCustomerById(customerId);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    await deactivateCustomer(customerId);
    return NextResponse.json({
      success: true,
      message: 'Customer deactivated successfully',
    });
  } catch (error) {
    logger.error(
      'Error deactivating customer',
      error instanceof Error ? error : new Error('Unknown error'),
      { feature: 'customers', action: 'delete' }
    );
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate customer' },
      { status: 500 }
    );
  }
}
