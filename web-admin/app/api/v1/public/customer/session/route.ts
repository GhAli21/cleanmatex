import { NextRequest, NextResponse } from 'next/server';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId =
      typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
    const verificationToken =
      typeof body?.verificationToken === 'string'
        ? body.verificationToken.trim()
        : '';

    if (!tenantId || !verificationToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and verificationToken are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Customer session could not be resolved' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          customerId: session.customerId,
          phoneNumber: session.phoneNumber,
          isGuest: false,
          tenantOrgId: session.tenantOrgId,
          displayName: session.displayName,
          verificationToken: session.verificationToken,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
