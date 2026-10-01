import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { DRAWER_CASH_IN_OUT_ROLES } from '@/lib/constants/cash-drawer';

const ALLOWED_ROLES = [
  ...DRAWER_CASH_IN_OUT_ROLES.OUT,
  ...DRAWER_CASH_IN_OUT_ROLES.IN,
] as [string, ...string[]];

const schema = z.object({
  lineRole:             z.enum(ALLOWED_ROLES),
  amount:               z.number().positive(),
  reason:               z.string().min(1),
  cashDrawerSessionId:  z.string().uuid(),
  partyName:            z.string().trim().min(1).optional(),
  expenseCategoryCode:  z.string().trim().min(1).optional(),
  employeeId:           z.string().trim().min(1).optional(),
  idempotencyKey:       z.string().min(1),
});

/**
 * POST /api/v1/cash-drawers/[drawerId]/cash-in-out — CLF W11, §4B.2a-A.
 * Posts a manual drawer "Cash in / Cash out" movement as a finance voucher
 * (replaces the deleted `POST .../cash-movement`). Errors return
 * `{ success: false, error, code? }`: cash-drawer ledger refusals and the
 * service's stable codes come back as `code` with HTTP 422.
 * @param request JSON body matching `schema`
 * @param root0
 * @param root0.params
 */
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
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await postDrawerCashMovement(tenantId, userId, {
      drawerId,
      cashDrawerSessionId: parsed.data.cashDrawerSessionId,
      lineRole: parsed.data.lineRole as never,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      partyName: parsed.data.partyName,
      expenseCategoryCode: parsed.data.expenseCategoryCode,
      employeeId: parsed.data.employeeId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof CashDrawerLedgerError) {
      return NextResponse.json({ success: false, code: error.code, error: error.code }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : 'Failed to post cash movement';
    const code = /^[A-Z][A-Z0-9_]+$/.test(message) ? message : undefined;
    return NextResponse.json({ success: false, code, error: message }, { status: code ? 422 : 400 });
  }
}
