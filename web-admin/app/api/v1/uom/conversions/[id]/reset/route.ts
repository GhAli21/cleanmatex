/** POST /api/v1/uom/conversions/[id]/reset — "Reset to system" for a customized seeded pair. */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { resetConversion } from '@/lib/services/uom.service';
import { uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resets one conversion. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  try {
    await resetConversion(auth.tenantId, auth.userId, id.data);
    return NextResponse.json({ success: true });
  } catch (e) { return uomErrorResponse(e, 'reset-conversion'); }
}
