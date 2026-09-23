/**
 * Settings → Cash Control API (POS Session & Cash Drawer Hardening, W0-5)
 *
 *   GET /api/v1/settings/payments/cash-control — resolved tenant-level
 *       cash-control policy (blind close, variance gating, cash-change
 *       rounding, count modes, drawer custody, POS session controls)
 *   PUT /api/v1/settings/payments/cash-control — patch tenant-level overrides
 *
 * v1 manages TENANT scope only — the resolver/service already supports
 * BRANCH/USER/DRAWER overrides (§3.1.3), but the branch/drawer override
 * picker UI is a deliberate follow-up, not built here (STATUS.md D19).
 *
 * Backed by `lib/services/cash-control-settings.service.ts`, which owns the
 * resolution chain, the transactional upsert, and the audit trail
 * (`org_fin_cash_ctrl_audit_dtl`, migration 0516). Do not query
 * `org_fin_cash_ctrl_stng_cf` anywhere else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import {
  getCashControlSettings,
  updateCashControlSettings,
} from '@/lib/services/cash-control-settings.service';
import { updateCashControlSettingsRequestSchema } from '@/lib/validations/cash-control-schemas';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('cash_control:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const settings = await getCashControlSettings({ tenantId });
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    logger.error(
      'GET /settings/payments/cash-control failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load cash-control settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function PUT(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('cash_control:manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;

    const rl = await checkAPIRateLimitTenant(tenantId);
    if (rl) return rl;

    const raw = await request.json();
    const parsed = updateCashControlSettingsRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: flattenZod(parsed.error),
        },
        { status: 400 }
      );
    }

    if (Object.keys(parsed.data.patch).length === 0) {
      const current = await getCashControlSettings({ tenantId });
      return NextResponse.json({ success: true, data: current });
    }

    try {
      const updated = await updateCashControlSettings(
        { tenantId },
        parsed.data.patch,
        { userId, reason: parsed.data.reason }
      );
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
      'PUT /settings/payments/cash-control failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update cash-control settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers (kept local; one file = one responsibility)
// ---------------------------------------------------------------------------

function flattenZod(zodErr: import('zod').ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of zodErr.issues) {
    const path = issue.path.join('.') || '_root';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/**
 * Postgres CHECK-constraint violation (chk_ofccs_thr_order / other CHECKs on
 * org_fin_cash_ctrl_stng_cf). Prisma does not give CHECK violations a
 * dedicated error code the way it does for unique (P2002) or FK (P2003)
 * violations, so this matches on the underlying Postgres error text, which
 * always names the violated constraint.
 */
function isCheckConstraintViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return /chk_ofccs/i.test(String(err.meta?.message ?? err.message));
  }
  return err instanceof Error && /chk_ofccs/i.test(err.message);
}
