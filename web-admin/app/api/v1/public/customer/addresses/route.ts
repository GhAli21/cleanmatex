import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const createAddressSchema = z.object({
  tenantId: z.string().uuid(),
  label: z.string().trim().min(1).max(100),
  street: z.string().trim().min(1).max(200),
  area: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
});

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim();
}

function buildAddressDescription(address: {
  street: string | null;
  area: string | null;
  city: string | null;
}): string {
  return [address.street, address.area, address.city]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

/**
 * Creates a customer-owned address for the mobile booking flow.
 *
 * @param request Incoming HTTP request with Bearer token and address payload.
 * @returns JSON response containing the address option shape used by mobile.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_addresses_public_api',
    action: 'post_address',
  });

  try {
    logger.info('Customer address create request received', baseContext);
    const verificationToken = extractBearerToken(request);
    const parsedBody = createAddressSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsedBody.success) {
      logger.warn('Customer address create rejected by validation', {
        ...baseContext,
        issues: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      });
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

    const body = parsedBody.data;
    const requestContext = {
      ...baseContext,
      tenantId: body.tenantId,
      hasVerificationToken: Boolean(verificationToken),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    if (!verificationToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bearer token is required',
          errorCode: 'address_missing_token',
        },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken,
    });

    if (!session) {
      logger.warn('Customer address create unauthorized', requestContext);
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized customer session',
          errorCode: 'address_unauthorized',
        },
        { status: 401 },
      );
    }

    const supabase = await createAdminSupabaseClient();
    const { count: existingAddressCount, error: countError } = await supabase
      .from('org_customer_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_org_id', body.tenantId)
      .eq('customer_id', session.customerId)
      .eq('is_active', true);

    if (countError) {
      throw countError;
    }

    if ((existingAddressCount ?? 0) >= 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'Address limit reached',
          errorCode: 'address_limit_reached',
        },
        { status: 400 },
      );
    }

    const { data: duplicateAddress } = await supabase
      .from('org_customer_addresses')
      .select('id, label, street, area, city, is_default')
      .eq('tenant_org_id', body.tenantId)
      .eq('customer_id', session.customerId)
      .eq('is_active', true)
      .eq('street', body.street)
      .eq('area', body.area)
      .eq('city', body.city)
      .maybeSingle();

    if (duplicateAddress) {
      return NextResponse.json(
        {
          success: true,
          data: {
            id: duplicateAddress.id,
            label: duplicateAddress.label ?? body.label,
            description: buildAddressDescription(duplicateAddress),
            isDefault: duplicateAddress.is_default === true,
            street: duplicateAddress.street,
            area: duplicateAddress.area,
            city: duplicateAddress.city,
          },
        },
        { status: 200 },
      );
    }

    const isDefault = (existingAddressCount ?? 0) === 0;
    const { data: address, error } = await supabase
      .from('org_customer_addresses')
      .insert({
        tenant_org_id: body.tenantId,
        customer_id: session.customerId,
        label: body.label,
        street: body.street,
        area: body.area,
        city: body.city,
        address_type: 'home',
        country: 'OM',
        is_default: isDefault,
        is_active: true,
        rec_status: 1,
        created_by: session.customerId,
        created_info: 'customer_mobile_app',
      })
      .select('id, label, street, area, city, is_default')
      .single();

    if (error || !address) {
      throw error ?? new Error('Address was not created');
    }

    logger.info('Customer address created successfully', {
      ...requestContext,
      customerId: session.customerId,
      addressId: address.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: address.id,
          label: address.label ?? body.label,
          description: buildAddressDescription(address),
          isDefault: address.is_default === true,
          street: address.street,
          area: address.area,
          city: address.city,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error('Customer address create failed', normalizedError, baseContext);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'address_create_failed',
      },
      { status: 500 },
    );
  }
}
