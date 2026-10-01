import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyPermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { ensureBranchPendingDepositDrawer } from '@/lib/services/pending-deposit-drawer.service';

const schema = z.object({
  branchId: z.string().uuid(),
});

/**
 * POST /api/v1/cash-drawers/pending-deposit/ensure — CLF §4B.2a-B. Idempotent:
 * creates the branch's system PENDING_DEPOSIT drawer only if missing.
 * Permission: `cash_control:manage` or `payment_config:manage` — whichever
 * the calling screen (branches, cash drawers tab, cash-control settings)
 * already uses.
 * @param request JSON body `{ branchId }`
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAnyPermission(['cash_control:manage', 'payment_config:manage'])(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await ensureBranchPendingDepositDrawer(tenantId, parsed.data.branchId, userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ensure the pending-deposit drawer';
    const code = /^[A-Z][A-Z0-9_]+$/.test(message) ? message : undefined;
    return NextResponse.json({ success: false, code, error: message }, { status: code ? 422 : 400 });
  }
}
