import { NextRequest, NextResponse } from 'next/server';

import {
  extractCustomerAppBearerToken,
  signOutCustomerApp,
} from '@/lib/services/customer-app-auth.service';

/**
 * POST /api/v1/public/customer/auth/logout
 *
 * Revokes only the presenting Customer App session, so a lost device can be signed out without disrupting another device.
 *
 * @param request - HTTPS request carrying the presenting opaque bearer token.
 * @returns Success response or a non-specific unauthorized response.
 */
export async function POST(request: NextRequest) {
  const accessToken = extractCustomerAppBearerToken(request.headers.get('authorization'));
  if (!accessToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await signOutCustomerApp(accessToken);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
}
