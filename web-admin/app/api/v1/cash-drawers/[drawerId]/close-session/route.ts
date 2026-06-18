import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { closeSession } from '@/lib/services/cash-drawer.service';

const schema = z.object({
  sessionId:     z.string().uuid(),
  physicalCount: z.number().min(0),
  notes:         z.string().optional(),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:close_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId: _drawerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const result = await closeSession(tenantId, parsed.data.sessionId, {
      physicalCount: parsed.data.physicalCount,
      closedBy:      userId,
      notes:         parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to close session';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
