import { NextRequest, NextResponse } from 'next/server';

import { loginWithPassword } from '@/lib/services/customer-password.service';
import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkLoginRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const tenantId =
      typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
    const phone =
      typeof body?.phone === 'string' ? body.phone.trim() : '';
    const password =
      typeof body?.password === 'string' ? body.password : '';

    if (!tenantId || !phone || !password) {
      return NextResponse.json(
        { success: false, error: 'tenantId, phone, and password are required' },
        { status: 400 },
      );
    }

    const customer = await loginWithPassword({ phone, password, tenantId });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone or password' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          customerId: customer.customerId,
          phoneNumber: customer.phoneNumber,
          isGuest: false,
          tenantOrgId: customer.tenantOrgId,
          displayName: customer.displayName,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
