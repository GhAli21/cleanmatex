import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  createCustomerAppAddress,
  CustomerAppProfileError,
  listCustomerAppAddresses,
} from '@/lib/services/customer-app-profile.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const createAddressSchema = z.object({
  tenantId: z.string().uuid(),
  addressType: z.enum(['home', 'work', 'other']).optional().default('home'),
  label: z.string().trim().min(1).max(100),
  building: z.string().trim().max(100).nullable().optional(),
  floor: z.string().trim().max(50).nullable().optional(),
  apartment: z.string().trim().max(50).nullable().optional(),
  street: z.string().trim().max(200).nullable().optional(),
  area: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(2).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  deliveryNotes: z.string().trim().max(400).nullable().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /api/v1/public/customer/addresses
 * Lists saved customer addresses from `sys_customer_addresses_dtl` (global) and
 * tenant-scoped `org_customer_addresses`.
 */
export async function GET(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_addresses_public_api',
    action: 'get_addresses',
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
        { success: false, error: 'Unauthorized customer session', errorCode: 'address_unauthorized' },
        { status: 401 },
      );
    }

    const addresses = await listCustomerAppAddresses({
      tenantOrgId: session.tenantOrgId,
      orgCustomerId: session.customerId,
      sysCustomerId: session.sysCustomerId,
    });

    return NextResponse.json({ success: true, data: addresses }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer addresses GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load addresses' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/public/customer/addresses
 * Saves a new customer address into `sys_customer_addresses_dtl` when the
 * customer has a global `sys_customers_mst.id`, otherwise into tenant-scoped
 * `org_customer_addresses`.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_addresses_public_api',
    action: 'post_address',
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    const parsedBody = createAddressSchema.safeParse(await request.json().catch(() => null));

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Address request is invalid',
          errorCode: 'address_validation_failed',
          details: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: 'Bearer token is required', errorCode: 'address_missing_token' },
        { status: 401 },
      );
    }

    const body = parsedBody.data;
    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session', errorCode: 'address_unauthorized' },
        { status: 401 },
      );
    }

    const created = await createCustomerAppAddress({
      tenantOrgId: session.tenantOrgId,
      orgCustomerId: session.customerId,
      sysCustomerId: session.sysCustomerId,
      input: {
        addressType: body.addressType,
        label: body.label,
        building: body.building,
        floor: body.floor,
        apartment: body.apartment,
        street: body.street,
        area: body.area,
        city: body.city,
        country: body.country,
        postalCode: body.postalCode,
        latitude: body.latitude,
        longitude: body.longitude,
        deliveryNotes: body.deliveryNotes,
        isDefault: body.isDefault,
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerAppProfileError) {
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
      'Public customer address create failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to save customer address', errorCode: 'address_create_failed' },
      { status: 500 },
    );
  }
}
