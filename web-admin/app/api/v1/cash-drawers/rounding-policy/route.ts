import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { resolveCashChangeRoundingPolicy } from '@/lib/services/cash-change-rounding.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

const roundingPolicyQuerySchema = z.object({
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  branchId: z.string().uuid().optional(),
});

/**
 * GET /api/v1/cash-drawers/rounding-policy?currency=OMR&branchId=…
 *
 * A6-1b — the cash change rounding policy (cash increment in minor units, rounding
 * mode, currency decimals) the checkout uses to show the rounded change inline. The
 * server applies the same policy when it records the payment, so this is display-only
 * and never trusted for money. Same permission as the drawer list the checkout reads.
 * @param request authenticated request with `currency` and optional `branchId`
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_drawer:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const parsed = roundingPolicyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const policy = await resolveCashChangeRoundingPolicy(
      { tenantId, branchId: parsed.data.branchId ?? null, userId },
      parsed.data.currency.toUpperCase(),
    );
    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the cash rounding policy');
  }
}
