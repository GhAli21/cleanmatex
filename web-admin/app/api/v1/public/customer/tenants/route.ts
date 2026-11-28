import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  CustomerAppProfileError,
  listAuthenticatedCustomerTenants,
  updateCustomerTenantPreference,
} from '@/lib/services/customer-app-profile.service';
import {
  extractMobileBearerToken,
  resolveCustomerGlobalIdentity,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { listCustomerTenantsByPhone } from '@/lib/services/customer-mobile-tenant.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const patchTenantPrefSchema = z.object({
  tenantId: z.string().uuid(),
  isHiddenByCustomer: z.boolean().optional(),
  lastBranchId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/v1/public/customer/tenants
 * When a Bearer token is supplied, returns authenticated linked Organizations
 * split into `activeTenants` and `hiddenTenants` (so customers can always unhide
 * hidden laundries) along with each Organization's validated `lastBranchId` and
 * customer-app-enabled branches. Preserves legacy `?phone=` fallback when no
 * Bearer token is supplied.
 */
export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_tenants_public_api',
    action: 'get_tenants',
    traceId,
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));

    if (bearerToken) {
      const globalIdentity = await resolveCustomerGlobalIdentity(bearerToken);
      if (!globalIdentity) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized customer session', traceId },
          { status: 401 },
        );
      }

      const { activeTenants, hiddenTenants } = await listAuthenticatedCustomerTenants({
        sysCustomerId: globalIdentity.sysCustomerId,
        phoneFallback: globalIdentity.phoneNumber,
      });

      return NextResponse.json(
        {
          success: true,
          traceId,
          // Keep `data` populated with activeTenants for backward compatibility with older clients.
          data: activeTenants,
          activeTenants,
          hiddenTenants,
        },
        { status: 200 },
      );
    }

    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? '';
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Authorization Bearer token or phone is required', traceId },
        { status: 400 },
      );
    }

    const tenants = await listCustomerTenantsByPhone(phone, traceId);
    return NextResponse.json(
      {
        success: true,
        traceId,
        data: tenants.map((tenant) => ({
          tenantOrgId: tenant.tenantOrgId,
          name: tenant.name,
          name2: tenant.name2,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          isHiddenByCustomer: false,
          lastBranchId: tenant.branches?.[0]?.id ?? null,
          lastBranchName: tenant.branches?.[0]?.name ?? null,
          lastBranchName2: tenant.branches?.[0]?.name2 ?? null,
          branches: tenant.branches ?? [],
        })),
        hiddenTenants: [],
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required', traceId },
        { status: 403 },
      );
    }
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    logger.error('Public customer tenant lookup route failed', normalizedError, baseContext);
    return NextResponse.json(
      { success: false, traceId, error: 'Failed to load linked organizations' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/public/customer/tenants
 * Updates customer-controlled Organization visibility (`is_hidden_by_customer`)
 * — supporting both hiding and unhiding at any time — and/or active `last_branch_id`.
 */
export async function PATCH(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_tenants_public_api',
    action: 'patch_tenant_pref',
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: 'Bearer token is required', errorCode: 'missing_token' },
        { status: 401 },
      );
    }

    const parsed = patchTenantPrefSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenant preference payload', errorCode: 'validation_failed' },
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

    const updated = await updateCustomerTenantPreference({
      tenantOrgId: session.tenantOrgId,
      orgCustomerId: session.customerId,
      isHiddenByCustomer: parsed.data.isHiddenByCustomer,
      lastBranchId: parsed.data.lastBranchId,
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
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
      'Public customer tenant preference update failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update organization preference' },
      { status: 500 },
    );
  }
}
