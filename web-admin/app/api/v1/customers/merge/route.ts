/**
 * PRD-003: Customer Management API
 * Customer Merge - Admin Only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mergeCustomers } from '@/lib/services/customers.service';
import type { MergeCustomersRequest } from '@/lib/types/customer';

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
// POST /api/v1/customers/merge - Merge Duplicate Customers (Admin Only)
// ==================================================================

/**
 * Merge two customer profiles
 * - All orders from source customer are moved to target customer
 * - Loyalty points are combined
 * - Source customer is deactivated
 * - Merge operation is logged in audit trail
 *
 * **ADMIN ONLY**
 *
 * Request Body: {
 *   sourceCustomerId: string,  // Customer to merge from (will be deactivated)
 *   targetCustomerId: string,  // Customer to merge into (receives all data)
 *   reason?: string            // Reason for merge (optional)
 * }
 *
 * Response: {
 *   success: true,
 *   data: {
 *     targetCustomer: Customer,
 *     ordersMoved: number,
 *     loyaltyPointsMerged: number
 *   },
 *   message: 'Customers merged successfully'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userRole, userId } = await getAuthContext();

    // 2. Check admin permission
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        {
          error: 'Insufficient permissions. Only admins can merge customers.',
        },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body: MergeCustomersRequest = await request.json();

    // 4. Validate required fields
    if (!body.sourceCustomerId) {
      return NextResponse.json(
        { error: 'sourceCustomerId is required' },
        { status: 400 }
      );
    }

    if (!body.targetCustomerId) {
      return NextResponse.json(
        { error: 'targetCustomerId is required' },
        { status: 400 }
      );
    }

    // 5. Validate source and target are different
    if (body.sourceCustomerId === body.targetCustomerId) {
      return NextResponse.json(
        { error: 'Source and target customers cannot be the same' },
        { status: 400 }
      );
    }

    // 6. Perform merge operation
    const result = await mergeCustomers(body);

    // 7. Return success response
    return NextResponse.json({
      success: true,
      data: {
        targetCustomer: result.targetCustomer,
        ordersMoved: result.ordersMoved,
        loyaltyPointsMerged: result.loyaltyPointsMerged,
      },
      message: `Customers merged successfully. ${result.ordersMoved} order(s) and ${result.loyaltyPointsMerged} loyalty points transferred.`,
    });
  } catch (error) {
    console.error('Error merging customers:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'One or both customer IDs may be invalid or not accessible in your tenant',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to merge customers' },
      { status: 500 }
    );
  }
}
