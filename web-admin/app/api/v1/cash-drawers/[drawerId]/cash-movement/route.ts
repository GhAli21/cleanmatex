import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { recordMovement } from '@/lib/services/cash-drawer.service';

const schema = z.object({
  movementType: z.enum(['CASH_IN', 'CASH_OUT', 'PETTY_CASH']),
  amount:       z.number().positive(),
  reason:       z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_drawer:record_movement')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { drawerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const movement = await recordMovement(tenantId, drawerId, {
      ...parsed.data,
      performedBy: userId,
    });
    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record movement';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
