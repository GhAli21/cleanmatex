import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  CustomerAppAuthError,
  extractCustomerAppBearerToken,
  refreshCustomerAppSession,
} from '@/lib/services/customer-app-auth.service';
import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { generateVerificationToken } from '@/lib/services/otp.service';

const bodySchema = z.object({ refreshToken: z.string().min(32).max(512) });

/**
 * POST /api/v1/public/customer/auth/refresh
 *
 * Rotates an opaque global Customer App refresh token. A rotated hash can be
 * consumed once, preventing two concurrent refreshes from extending a session.
 * Released legacy clients keep a short-lived tenant-token branch until the
 * mobile global-session migration is complete.
 *
 * @param request - HTTPS request containing the secure-storage refresh token.
 * @returns Fresh opaque token pair or a non-specific unauthorized response.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (parsed.success) {
    try {
      const tokens = await refreshCustomerAppSession(parsed.data.refreshToken);
      return NextResponse.json({ success: true, data: { tokens } }, { status: 200 });
    } catch (error) {
      const status = error instanceof CustomerAppAuthError ? 401 : 500;
      return NextResponse.json({ success: false, error: 'Unable to refresh session' }, { status });
    }
  }

  // Transitional compatibility only: currently released mobile builds refresh
  // their tenant-scoped verification token here. The global-app client never
  // uses this branch and its callers are removed in the mobile migration.
  const tenantId = typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
  const verificationToken = extractCustomerAppBearerToken(request.headers.get('authorization'));
  if (!tenantId || !verificationToken) {
    return NextResponse.json({ success: false, error: 'Invalid refresh request' }, { status: 400 });
  }

  try {
    const legacySession = await resolveCustomerMobileSession({ tenantId, verificationToken });
    if (!legacySession) {
      return NextResponse.json({ success: false, error: 'Unable to refresh session' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        customerId: legacySession.customerId,
        phoneNumber: legacySession.phoneNumber,
        isGuest: false,
        tenantOrgId: legacySession.tenantOrgId,
        displayName: legacySession.displayName,
        verificationToken: generateVerificationToken(legacySession.phoneNumber),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to refresh session' }, { status: 401 });
  }
}
