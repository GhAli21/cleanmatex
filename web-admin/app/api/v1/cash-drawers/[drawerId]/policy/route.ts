import { guardDrawerBranch } from '@/lib/api/branch-access-guard';
/**
 * Cash-drawer policy API (CLF §4B.7) — the drawer Policy tab (CLF-8-7).
 *
 *   GET  /api/v1/cash-drawers/[drawerId]/policy — resolved policy with the
 *        source of every value (Inherited from Tenant / Branch / Type default
 *        / Overridden here)
 *   PUT  /api/v1/cash-drawers/[drawerId]/policy — patch DRAWER-scope
 *        overrides; `null` on a field resets it to inherit
 *
 * Mirrors `/api/v1/settings/payments/cash-control/route.ts` exactly, scoped
 * to `{ tenantId, drawerId }` instead of tenant-only. Backed by the same
 * `cash-control-settings.service.ts` — do not query
 * `org_fin_cash_ctrl_stng_cf` anywhere else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import {
  getCashControlSettingsWithSource,
  updateCashControlSettings,
} from '@/lib/services/cash-control-settings.service';
import { updateCashControlSettingsRequestSchema } from '@/lib/validations/cash-control-schemas';

/**
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> }
) {
  try {
    const authCheck = await requirePermission('cash_control:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { drawerId } = await params;
    const branchDenied = await guardDrawerBranch(authCheck, drawerId);
    if (branchDenied) return branchDenied;
    const settings = await getCashControlSettingsWithSource({ tenantId, drawerId });
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    logger.error(
      'GET /cash-drawers/[drawerId]/policy failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load the drawer policy' },
      { status: 500 }
    );
  }
}

/**
 * @param request authenticated request
 * @param root0 route params
 * @param root0.params drawer id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ drawerId: string }> }
) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('cash_control:manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;

    const { drawerId } = await params;
    const branchDenied = await guardDrawerBranch(authCheck, drawerId);
    if (branchDenied) return branchDenied;
    const raw = await request.json();
    const parsed = updateCashControlSettingsRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', fieldErrors: flattenZod(parsed.error) },
        { status: 400 }
      );
    }

    if (Object.keys(parsed.data.patch).length === 0) {
      const current = await getCashControlSettingsWithSource({ tenantId, drawerId });
      return NextResponse.json({ success: true, data: current });
    }

    try {
      await updateCashControlSettings({ tenantId, drawerId }, parsed.data.patch, { userId, reason: parsed.data.reason });
      const updated = await getCashControlSettingsWithSource({ tenantId, drawerId });
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      if (isCheckConstraintViolation(err)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid combination of variance thresholds — tolerance must be at or below the reason band, which must be at or below the approval band.',
            code: 'VARIANCE_THRESHOLD_ORDER_INVALID',
          },
          { status: 422 }
        );
      }
      throw err;
    }
  } catch (err) {
    logger.error(
      'PUT /cash-drawers/[drawerId]/policy failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update the drawer policy' },
      { status: 500 }
    );
  }
}

function flattenZod(zodErr: import('zod').ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of zodErr.issues) {
    const path = issue.path.join('.') || '_root';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/** Postgres CHECK-constraint violation (chk_ofccs_thr_order and friends on org_fin_cash_ctrl_stng_cf). */
function isCheckConstraintViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return /chk_ofccs/i.test(String(err.meta?.message ?? err.message));
  }
  return err instanceof Error && /chk_ofccs/i.test(err.message);
}
