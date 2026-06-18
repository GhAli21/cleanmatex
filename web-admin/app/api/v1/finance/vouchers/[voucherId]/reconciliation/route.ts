import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { reconcileVoucher } from '@/lib/services/voucher-reconciliation.service';

/**
 * GET /api/v1/finance/vouchers/[voucherId]/reconciliation
 *
 * Voucher-scoped on-demand reconciliation (PRD §23.1 + §24.3). Returns the
 * voucher header summary plus every PRD §22.1 voucher-integrity issue
 * (`VOUCHER_TOTAL_EQUALS_LINES`, `NO_DUPLICATE_OPERATIONAL_EFFECT`,
 * `GATEWAY_STATE_VALID`) for the requested voucher.
 *
 * Permission: `reconciliation:view` (mig 0294 — seeded for super_admin /
 * tenant_admin / admin / branch_manager).
 *
 * No CSRF: read-only operator action; mirrors the `runs` GET endpoint.
 *
 * @see app/api/v1/finance/reconciliation/runs/route.ts — tenant-window run
 * @see lib/services/voucher-reconciliation.service.ts — service entry
 */
const paramsSchema = z.object({
  voucherId: z.string().uuid(),
});

/**
 *
 * @param request
 * @param context
 * @param context.params
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ voucherId: string }> },
) {
  const auth = await requirePermission('reconciliation:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const params = await context.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid voucherId', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await reconcileVoucher(tenantId, parsed.data.voucherId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    // Prisma `findFirstOrThrow` throws on missing voucher (or wrong tenant) —
    // map to 404 so the caller can distinguish from genuine 5xx errors.
    const message = err instanceof Error ? err.message : 'Voucher reconciliation failed';
    const status = message.includes('not found') || message.includes('No') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
