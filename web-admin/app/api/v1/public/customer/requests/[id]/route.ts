import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  cancelCustomerQuickDropRequest,
  CustomerQuickDropError,
  listCustomerQuickDropRequests,
} from '@/lib/services/customer-app-requests.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const cancelSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.literal('cancel'),
  reason: z.string().trim().max(300).nullable().optional(),
});

/**
 * GET /api/v1/public/customer/requests/[id]
 * Returns one customer-owned Fast Quick Drop request detail.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_requests_public_api',
    action: 'get_request_detail',
  });

  try {
    const { id } = await context.params;
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!tenantId || !bearerToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and Bearer token are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const list = await listCustomerQuickDropRequests(session.tenantOrgId, session.customerId);
    const found = list.find((r) => r.id === id);
    if (!found) {
      return NextResponse.json(
        { success: false, errorCode: 'REQUEST_NOT_FOUND', error: 'Request not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: found }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer request detail GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json({ success: false, error: 'Failed to load request' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/public/customer/requests/[id]
 * Allows the owning customer to cancel an unconverted Fast Quick Drop request.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_requests_public_api',
    action: 'patch_request',
  });

  try {
    const { id } = await context.params;
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!bearerToken) {
      return NextResponse.json({ success: false, error: 'Bearer token is required' }, { status: 401 });
    }

    const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request payload' }, { status: 400 });
    }

    const session = await resolveCustomerMobileSession({
      tenantId: parsed.data.tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await cancelCustomerQuickDropRequest(
      session.tenantOrgId,
      session.customerId,
      id,
      parsed.data.reason,
    );
    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerQuickDropError) {
      const status = error.code === 'REQUEST_NOT_FOUND' ? 404 : 400;
      return NextResponse.json(
        { success: false, errorCode: error.code, error: error.message },
        { status },
      );
    }
    logger.error(
      'Public customer request PATCH failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 });
  }
}
