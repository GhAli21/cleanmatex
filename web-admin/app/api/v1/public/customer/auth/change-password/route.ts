import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  changeCustomerAppPassword,
  CustomerAppAuthError,
  extractCustomerAppBearerToken,
} from '@/lib/services/customer-app-auth.service';

const bodySchema = z.object({ newPassword: z.string().min(8).max(256) });

/**
 * POST /api/v1/public/customer/auth/change-password
 *
 * Changes a global Customer App password using a short-lived opaque access token.
 * The service permits a forced-change session here while blocking it from Customer App data routes.
 *
 * @param request - HTTPS request with bearer token and replacement password.
 * @returns Fresh opaque token pair or a safe failure response.
 */
export async function POST(request: NextRequest) {
  const accessToken = extractCustomerAppBearerToken(request.headers.get('authorization'));
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!accessToken || !parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid password change request' }, { status: 400 });
  }

  try {
    const tokens = await changeCustomerAppPassword({ accessToken, newPassword: parsed.data.newPassword });
    return NextResponse.json({ success: true, data: { tokens } }, { status: 200 });
  } catch (error) {
    const status = error instanceof CustomerAppAuthError ? 401 : 500;
    return NextResponse.json({ success: false, error: 'Unable to change password' }, { status });
  }
}
