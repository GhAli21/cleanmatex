import { NextRequest, NextResponse } from 'next/server';

import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { issueCustomerAppTemporaryPassword } from '@/lib/services/customer-app-auth.service';

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

  const auth = await requirePermission('customers:manage_credentials')(request);
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
