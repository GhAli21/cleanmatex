import { NextRequest, NextResponse } from 'next/server';

import { customerHasPassword } from '@/lib/services/customer-password.service';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? '';

    if (!tenantId || !phone) {
      return NextResponse.json(
        { success: false, error: 'tenantId and phone are required' },
        { status: 400 },
      );
    }

    const hasPassword = await customerHasPassword({ phone, tenantId });

    return NextResponse.json({ success: true, data: { hasPassword } }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
