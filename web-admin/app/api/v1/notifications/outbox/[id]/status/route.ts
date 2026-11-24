/**
 * GET /api/v1/notifications/outbox/[id]/status — where an immediate send stands (staff session).
 *
 * Screens poll this after a 202 from a send (verification code, receipt). Returns the outbox status
 * and skip reason of the caller's own tenant only; provider error text is never returned.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let tenantId: string;
  try {
    ({ tenantId } = await getAuthContext());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const row = await withTenantContext(tenantId, () => prisma.org_ntf_outbox_dtl.findFirst({
    where: { id, tenant_org_id: tenantId },
    select: { status: true, skip_reason: true },
  }));
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data: { status: row.status, skipReason: row.skip_reason } });
}
