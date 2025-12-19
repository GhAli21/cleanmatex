/**
 * PRD-003: Customer Management API
 * Customer Profile Upgrade - Stub to Full
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  findCustomerById,
  upgradeCustomerProfile,
} from '@/lib/services/customers.service';
import { verifyOTP } from '@/lib/services/otp.service';
import { createAddress } from '@/lib/services/customer-addresses.service';
import type { CustomerUpgradeRequest } from '@/lib/types/customer';

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
// POST /api/v1/customers/:id/upgrade - Upgrade Customer Profile
// ==================================================================

/**
 * Upgrade stub customer to full profile
 *
 * Request Body: {
 *   email?: string,
 *   otpCode: string,
 *   preferences?: {
 *     folding?: 'hang' | 'fold',
 *     fragrance?: string,
 *     ecoFriendly?: boolean,
 *     notifications?: { whatsapp?: boolean, sms?: boolean, email?: boolean }
 *   },
 *   addresses?: [
 *     {
 *       addressType: 'home' | 'work' | 'other',
 *       label?: string,
 *       building?: string,
 *       ...
 *     }
 *   ]
 * }
 *
 * Response: {
 *   success: true,
 *   data: Customer,
 *   message: 'Customer profile upgraded to full successfully'
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
    const body: CustomerUpgradeRequest = await request.json();

    // 4. Validate OTP code is provided
    if (!body.otpCode) {
      return NextResponse.json(
        { error: 'otpCode is required for profile upgrade' },
        { status: 400 }
      );
    }

    // 5. Validate email format if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // 6. Get current customer to retrieve phone number
    const currentCustomer = await findCustomerById(customerId);

    if (!currentCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // 7. Check if customer is already full profile
    if (currentCustomer.profileStatus === 2) { // 2 = full profile
      return NextResponse.json(
        { error: 'Customer already has a full profile' },
        { status: 409 }
      );
    }

    // 8. Check if customer is guest (guests can't upgrade directly)
    if (currentCustomer.profileStatus === 0) { // 0 = guest
      return NextResponse.json(
        {
          error: 'Guest customers cannot upgrade directly. Please add phone number first.',
        },
        { status: 400 }
      );
    }

    // 9. Verify customer has phone number
    if (!currentCustomer.phone) {
      return NextResponse.json(
        { error: 'Customer must have a phone number to upgrade' },
        { status: 400 }
      );
    }

    // 10. Verify OTP
    const otpResult = await verifyOTP({
      phone: currentCustomer.phone,
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

    // 11. Upgrade customer profile
    const upgradedCustomer = await upgradeCustomerProfile(
      customerId,
      body.email,
      body.preferences
    );

    // 12. Add addresses if provided
    if (body.addresses && body.addresses.length > 0) {
      for (const addressData of body.addresses) {
        try {
          await createAddress(customerId, addressData);
        } catch (error) {
          console.error('Error creating address during upgrade:', error);
          // Continue with other addresses even if one fails
        }
      }
    }

    // 13. Return success response
    return NextResponse.json({
      success: true,
      data: upgradedCustomer,
      message: 'Customer profile upgraded to full successfully',
    });
  } catch (error) {
    console.error('Error upgrading customer profile:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.message.includes('already')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to upgrade customer profile' },
      { status: 500 }
    );
  }
}
