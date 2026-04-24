import { NextRequest, NextResponse } from 'next/server';

import { setCustomerPassword } from '@/lib/services/customer-password.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId =
      typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
    const verificationToken =
      typeof body?.verificationToken === 'string'
        ? body.verificationToken.trim()
        : '';
    const newPassword =
      typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!tenantId || !verificationToken || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'tenantId, verificationToken, and newPassword are required',
        },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 422 },
      );
    }

    await setCustomerPassword({ tenantId, verificationToken, newPassword });

    return NextResponse.json(
      { success: true, message: 'Password set successfully' },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (
      message === 'Invalid or expired verification token' ||
      message === 'Password must be at least 8 characters'
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 422 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
