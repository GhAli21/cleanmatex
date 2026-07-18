import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { issueAdvanceTx } from '@/lib/services/stored-value.service';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';

const schema = z.object({
  amount: z.number().positive(),
  notes:  z.string().optional(),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('stored_value:issue_advance')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: customerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    // B15: resolve the tenant currency for first-advance creation — the
    // service requires an explicit currency and never defaults.
    const supabase = await createClient();
    const currencyCode = await createTenantSettingsService(supabase).getTenantCurrency(tenantId);
    const txn = await prisma.$transaction((tx) =>
      issueAdvanceTx(tx, {
        tenantId,
        customerId,
        amount:      parsed.data.amount,
        notes:       parsed.data.notes,
        performedBy: userId,
        currencyCode,
      })
    );
    return NextResponse.json({ success: true, data: txn }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Advance issuance failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
