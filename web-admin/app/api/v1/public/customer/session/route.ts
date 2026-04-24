import { NextRequest, NextResponse } from 'next/server';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

/**
 * Resolves a customer mobile session from tenant and verification token.
 *
 * @param request Incoming HTTP request body with tenantId and verificationToken.
 * @returns JSON response with resolved customer session payload or an error.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_session_public_api',
    action: 'post_session',
  });

  try {
    logger.info('Customer session request received', baseContext);
    const body = await request.json();
    const tenantId =
      typeof body?.tenantId === 'string' ? body.tenantId.trim() : '';
    const verificationToken =
      typeof body?.verificationToken === 'string'
        ? body.verificationToken.trim()
        : '';
    const requestContext = {
      ...baseContext,
      tenantId,
      hasVerificationToken: Boolean(verificationToken),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    logger.info('Customer session request parameters parsed', requestContext);

    if (!tenantId || !verificationToken) {
      logger.warn('Customer session request rejected due to missing auth inputs', {
        ...requestContext,
        missingTenantId: !tenantId,
        missingVerificationToken: !verificationToken,
      });
      return NextResponse.json(
        { success: false, error: 'tenantId and verificationToken are required' },
        { status: 400 },
      );
    }

    logger.info('Resolving customer mobile session', requestContext);
    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      logger.warn('Customer session request unauthorized: session not resolved', {
        ...requestContext,
      });
      return NextResponse.json(
        { success: false, error: 'Customer session could not be resolved' },
        { status: 401 },
      );
    }

    logger.info('Customer session resolved successfully', {
      ...requestContext,
      customerId: session.customerId,
      sessionTenantOrgId: session.tenantOrgId,
      normalizedPhone: session.phoneNumber,
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
          verificationToken: session.verificationToken,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error('Customer session request failed with unhandled exception', normalizedError, {
      ...baseContext,
    });

    return NextResponse.json(
      {
        success: false,
        error: normalizedError.message,
      },
      { status: 500 },
    );
  }
}
