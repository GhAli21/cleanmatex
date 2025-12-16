/**
 * POST /api/v1/customers/link
 * Link customer from sys_global or other tenant to current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { linkCustomerToTenant } from '@/lib/services/customers.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, sourceType, originalTenantId } = body;

    // Validate input
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'customerId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!sourceType || !['sys', 'org_other_tenant'].includes(sourceType)) {
      return NextResponse.json(
        { success: false, error: 'sourceType must be "sys" or "org_other_tenant"' },
        { status: 400 }
      );
    }

    if (sourceType === 'org_other_tenant' && !originalTenantId) {
      return NextResponse.json(
        { success: false, error: 'originalTenantId is required when sourceType is "org_other_tenant"' },
        { status: 400 }
      );
    }

    // Link customer to tenant
    const result = await linkCustomerToTenant(
      customerId,
      sourceType,
      originalTenantId
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          orgCustomerId: result.orgCustomerId,
          customerId: result.customerId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error linking customer:', error);

    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes('already linked') || error.message.includes('already exists')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to link customer' },
      { status: 500 }
    );
  }
}
