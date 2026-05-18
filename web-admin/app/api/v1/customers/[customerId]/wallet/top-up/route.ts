import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { topUpWalletTx } from '@/lib/services/stored-value.service';

const schema = z.object({
  amount: z.number().positive(),
  notes:  z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('stored_value:top_up_wallet')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { customerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const txn = await prisma.$transaction((tx) =>
      topUpWalletTx(tx, {
        tenantId,
        customerId,
        amount:      parsed.data.amount,
        notes:       parsed.data.notes,
        performedBy: userId,
      })
    );
    return NextResponse.json({ success: true, data: txn }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Top-up failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
