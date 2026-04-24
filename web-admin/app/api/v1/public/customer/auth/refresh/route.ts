import { NextRequest, NextResponse } from 'next/server';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { generateVerificationToken } from '@/lib/services/otp.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

/**
 * POST /api/v1/public/customer/auth/refresh
 *
 * Refreshes the mobile customer session payload after an authenticated public API
 * request receives 401. The mobile token is stateless, so this route re-resolves
 * the customer against the requested tenant and returns the canonical session shape.
 */

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim();
}

/**
 * Revalidates a mobile customer verification token and returns session payload.
 *
 * @param request Incoming HTTP request with Bearer token and tenantId body.
 * @returns JSON response containing a customer session payload or a structured error.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_auth_refresh_public_api',
    action: 'post_refresh',
  });

  try {
    logger.info('Customer auth refresh request received', baseContext);

    const verificationToken = extractBearerToken(request);
    const body = await request.json().catch(() => null);
    const tenantId =
      typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
    const requestContext = {
      ...baseContext,
      tenantId,
      hasVerificationToken: Boolean(verificationToken),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    logger.info('Customer auth refresh request parameters parsed', requestContext);

    if (!tenantId || !verificationToken) {
      logger.warn('Customer auth refresh rejected due to missing inputs', {
        ...requestContext,
        missingTenantId: !tenantId,
        missingVerificationToken: !verificationToken,
      });
      return NextResponse.json(
        { success: false, error: 'tenantId and bearer token are required' },
        { status: 400 },
      );
    }

    logger.info('Resolving customer mobile session for auth refresh', requestContext);
    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      logger.warn('Customer auth refresh unauthorized: session not resolved', {
        ...requestContext,
      });
      return NextResponse.json(
        { success: false, error: 'Customer session could not be refreshed' },
        { status: 401 },
      );
    }

    const refreshedToken = generateVerificationToken(session.phoneNumber);

    logger.info('Customer auth refresh resolved successfully', {
      ...requestContext,
      customerId: session.customerId,
      sessionTenantOrgId: session.tenantOrgId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          customerId: session.customerId,
          phoneNumber: session.phoneNumber,
          isGuest: false,
          tenantOrgId: session.tenantOrgId,
          displayName: session.displayName,
          verificationToken: refreshedToken,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error('Customer auth refresh failed with unhandled exception', normalizedError, {
      ...baseContext,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'customer_auth_refresh_failed',
      },
      { status: 500 },
    );
  }
}
