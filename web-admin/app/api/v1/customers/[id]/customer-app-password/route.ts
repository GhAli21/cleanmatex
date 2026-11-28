import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import {
  CustomerAppAuthError,
  getCustomerAppCredentialStatus,
  issueCustomerAppTemporaryPassword,
  setCustomerAppPasswordByStaff,
} from '@/lib/services/customer-app-auth.service';

const setPasswordBodySchema = z.object({
  password: z.string().min(8).max(128),
  requirePasswordChange: z.boolean().optional().default(false),
});

/**
 * GET /api/v1/customers/[id]/customer-app-password
 *
 * Returns non-sensitive Customer App password metadata (whether a password is set,
 * last changed timestamp, lockout status) for the tenant-scoped customer.
 *
 * @param request - Authenticated dashboard request.
 * @param context - Dynamic route parameters containing the Organization customer ID.
 * @returns Safe credential status metadata.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyPermission([
    'customers:manage_credentials',
    'customers:update',
    'customers:read',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  const expectedTenantId = request.headers.get('X-Tenant-Id');
  if (expectedTenantId && expectedTenantId !== auth.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Organization changed; reload customer details' },
      { status: 409 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Customer is required' }, { status: 400 });
  }

  try {
    const status = await getCustomerAppCredentialStatus({
      tenantId: auth.tenantId,
      orgCustomerId: id,
    });
    return NextResponse.json({ success: true, data: status }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load customer app password status';
    const httpStatus = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status: httpStatus });
  }
}

/**
 * POST /api/v1/customers/[id]/customer-app-password
 *
 * Issues a new six-digit Customer App temporary password. The value is returned
 * once for the authorized staff member to share through an approved channel.
 * It is never persisted or retrievable after this response.
 *
 * @param request - Authenticated, CSRF-protected dashboard request.
 * @param context - Dynamic route parameters containing the Organization customer ID.
 * @returns One-time temporary password and UTC expiry, or a safe authorization error.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireAnyPermission([
    'customers:manage_credentials',
    'customers:update',
  ])(request);
  if (auth instanceof NextResponse) return auth;
  const expectedTenantId = request.headers.get('X-Tenant-Id');
  if (expectedTenantId && expectedTenantId !== auth.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Organization changed; reload customer details' },
      { status: 409 },
    );
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ success: false, error: 'Customer is required' }, { status: 400 });

  try {
    const result = await issueCustomerAppTemporaryPassword({
      tenantId: auth.tenantId,
      orgCustomerId: id,
      actorId: auth.userId,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue customer app password';
    const status = message.includes('not found') || message.includes('valid mobile') ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * PUT /api/v1/customers/[id]/customer-app-password
 *
 * Allows authorized tenant staff to add or reset a customer's Customer App password
 * directly, invalidating prior mobile sessions and clearing lockouts.
 *
 * @param request - Authenticated, CSRF-protected dashboard request with `{ password, requirePasswordChange? }`.
 * @param context - Dynamic route parameters containing the Organization customer ID.
 * @returns Updated non-sensitive credential status metadata.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireAnyPermission([
    'customers:manage_credentials',
    'customers:update',
  ])(request);
  if (auth instanceof NextResponse) return auth;

  const expectedTenantId = request.headers.get('X-Tenant-Id');
  if (expectedTenantId && expectedTenantId !== auth.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Organization changed; reload customer details' },
      { status: 409 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Customer is required' }, { status: 400 });
  }

  const parsed = setPasswordBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 8 characters' },
      { status: 400 },
    );
  }

  try {
    const status = await setCustomerAppPasswordByStaff({
      tenantId: auth.tenantId,
      orgCustomerId: id,
      actorId: auth.userId,
      newPassword: parsed.data.password,
      requirePasswordChange: parsed.data.requirePasswordChange,
    });
    return NextResponse.json({ success: true, data: status }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'INVALID_PASSWORD') {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unable to save customer app password';
    const httpStatus = message.includes('not found') || message.includes('valid mobile') ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status: httpStatus });
  }
}
