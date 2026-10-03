import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { listEffectiveDenominations, saveDenominationOverrides } from '@/lib/services/cash-denomination-control.service';
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';

const currencySchema = z.string().trim().length(3).transform((value) => value.toUpperCase());

const putSchema = z.object({
  currencyCode: currencySchema,
  items: z
    .array(
      z.object({
        denominationCode: z.string().trim().min(1).max(60),
        isEnabled: z.boolean(),
        displayOrder: z.number().int().min(0).max(100000).nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * GET /api/v1/cash-drawers/denominations?currency=OMR
 *
 * C1-1b — every in-circulation HQ denomination of a currency with this tenant's overrides applied
 * (switched-off ones included, flagged) for the denomination admin. Needs `cash_control:view`.
 * @param request authenticated request with a `currency` query param
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('cash_control:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = currencySchema.safeParse(request.nextUrl.searchParams.get('currency') ?? '');
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request: currency is required' }, { status: 400 });
  }

  try {
    const rows = await listEffectiveDenominations(auth.tenantId, parsed.data);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to load the denominations');
  }
}

/**
 * PUT /api/v1/cash-drawers/denominations
 *
 * C1-1b — saves this tenant's overrides for one currency: switch a denomination off (it leaves the
 * counting grid and a count using it is refused) and/or reorder the grid. Sparse: an enabled item
 * with no order of its own is the HQ default and stores nothing. Needs `cash_control:manage`.
 * @param request JSON body `{ currencyCode, items: [{ denominationCode, isEnabled, displayOrder? }] }`
 */
export async function PUT(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('cash_control:manage')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    await saveDenominationOverrides(auth.tenantId, auth.userId, parsed.data.currencyCode, parsed.data.items);
    const rows = await listEffectiveDenominations(auth.tenantId, parsed.data.currencyCode);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return mapCashDrawerError(error, 'Failed to save the denominations');
  }
}
