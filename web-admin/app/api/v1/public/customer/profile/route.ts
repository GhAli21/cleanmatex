import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  CustomerAppProfileError,
  getCustomerAppProfile,
  listCustomerAppAddresses,
  updateCustomerAppProfile,
} from '@/lib/services/customer-app-profile.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const patchProfileSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(160).nullable().optional(),
  mobile: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  preferredLanguage: z.enum(['en', 'ar']).nullable().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  defaultOrderNote: z.string().max(500).nullable().optional(),
  autoApplyOrderDefaultNote: z.boolean().optional(),
});

/**
 * GET /api/v1/public/customer/profile
 * Returns the authenticated customer's full registered CleanMateX profile
 * (customer code, verified contact details, loyalty points, default care
 * preferences, saved default order note, last branch) plus saved addresses.
 */
export async function GET(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_profile_public_api',
    action: 'get_profile',
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

    const [profile, addresses] = await Promise.all([
      getCustomerAppProfile({
        tenantOrgId: session.tenantOrgId,
        orgCustomerId: session.customerId,
        sysCustomerId: session.sysCustomerId,
      }),
      listCustomerAppAddresses({
        tenantOrgId: session.tenantOrgId,
        orgCustomerId: session.customerId,
        sysCustomerId: session.sysCustomerId,
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...profile,
          addresses,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer profile GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load customer profile' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/public/customer/profile
 * Updates customer name, email, mobile, default care preferences, and saved
 * general order note (`default_order_note` + `auto_apply_order_default_note`),
 * writing to `sys_customers_mst` when a global customer ID exists or falling
 * back to `org_customers_mst`.
 */
export async function PATCH(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_profile_public_api',
    action: 'patch_profile',
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: 'Bearer token is required', errorCode: 'missing_token' },
        { status: 401 },
      );
    }

    const parsed = patchProfileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile update payload is invalid',
          errorCode: 'profile_validation_failed',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId: parsed.data.tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session', errorCode: 'unauthorized' },
        { status: 401 },
      );
    }

    const updated = await updateCustomerAppProfile({
      tenantOrgId: session.tenantOrgId,
      orgCustomerId: session.customerId,
      sysCustomerId: session.sysCustomerId,
      patch: {
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        email: parsed.data.email,
        preferredLanguage: parsed.data.preferredLanguage,
        preferences: parsed.data.preferences,
        defaultOrderNote: parsed.data.defaultOrderNote,
        autoApplyOrderDefaultNote: parsed.data.autoApplyOrderDefaultNote,
      },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppProfileError) {
      const status = error.code === 'CONTACT_ALREADY_IN_USE' ? 409 : 400;
      return NextResponse.json(
        { success: false, errorCode: error.code, error: error.message },
        { status },
      );
    }
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer profile PATCH failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update customer profile' },
      { status: 500 },
    );
  }
}
