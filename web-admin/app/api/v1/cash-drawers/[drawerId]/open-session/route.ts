import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { openSession } from '@/lib/services/cash-drawer.service';

const schema = z.object({
  openingBalance: z.number().min(0),
  notes:          z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:open_session')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const session = await openSession(tenantId, drawerId, {
      openingBalance: parsed.data.openingBalance,
      openedBy:       userId,
      notes:          parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to open session';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
