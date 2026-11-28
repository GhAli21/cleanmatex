import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  createCustomerQuickDropRequest,
  CustomerQuickDropError,
  listCustomerQuickDropRequests,
} from '@/lib/services/customer-app-requests.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const declaredLineSchema = z.object({
  serviceCategoryCode: z.string().trim().max(80).nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(999),
  customerNotes: z.string().trim().max(400).nullable().optional(),
});

const createQuickDropSchema = z.object({
  tenantId: z.string().uuid(),
  requestedBranchId: z.string().uuid().nullable().optional(),
  pickupMode: z.enum(['collect_address', 'store_dropoff']),
  deliveryMode: z.enum(['deliver_address', 'store_pickup']),
  pickupAddressId: z.string().uuid().nullable().optional(),
  deliveryAddressId: z.string().uuid().nullable().optional(),
  serviceSpeedCode: z.string().trim().max(40).nullable().optional(),
  estimatedTotalBags: z.coerce.number().int().min(0).max(99).default(1),
  estimatedTotalPieces: z.coerce.number().int().min(0).max(999).default(0),
  customerNotes: z.string().trim().max(600).nullable().optional(),
  declaredLines: z.array(declaredLineSchema).max(50).optional().default([]),
});

/**
 * GET /api/v1/public/customer/requests
 * Returns the authenticated customer's Fast Quick Drop requests inside the
 * selected Organization, including linked order numbers when converted.
 */
export async function GET(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_requests_public_api',
    action: 'list_requests',
  });

  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!tenantId || !bearerToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and Bearer token are required', errorCode: 'missing_auth' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session', errorCode: 'unauthorized' },
        { status: 401 },
      );
    }

    const requests = await listCustomerQuickDropRequests(session.tenantOrgId, session.customerId);
    return NextResponse.json({ success: true, data: requests }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer requests GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load requests' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/public/customer/requests
 * Submits an unpriced Fast Quick Drop request (`org_ord_requests_mst` +
 * optional catalog-linked or free-text `org_ord_request_lines_dtl`) with
 * `Idempotency-Key` support.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_requests_public_api',
    action: 'create_request',
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: 'Bearer token is required', errorCode: 'missing_token' },
        { status: 401 },
      );
    }

    const parsed = createQuickDropSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Quick drop request payload is invalid',
          errorCode: 'request_validation_failed',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session', errorCode: 'unauthorized' },
        { status: 401 },
      );
    }

    const idempotencyKey = request.headers.get('idempotency-key');
    const created = await createCustomerQuickDropRequest({
      tenantOrgId: session.tenantOrgId,
      orgCustomerId: session.customerId,
      sysCustomerId: session.sysCustomerId,
      requestedBranchId: body.requestedBranchId,
      pickupMode: body.pickupMode,
      deliveryMode: body.deliveryMode,
      pickupAddressId: body.pickupAddressId,
      deliveryAddressId: body.deliveryAddressId,
      serviceSpeedCode: body.serviceSpeedCode,
      estimatedTotalBags: body.estimatedTotalBags,
      estimatedTotalPieces: body.estimatedTotalPieces,
      customerNotes: body.customerNotes,
      declaredLines: body.declaredLines,
      idempotencyKey,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerQuickDropError) {
      return NextResponse.json(
        { success: false, errorCode: error.code, error: error.message },
        { status: 400 },
      );
    }
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer quick drop POST failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to submit quick drop request' },
      { status: 500 },
    );
  }
}
