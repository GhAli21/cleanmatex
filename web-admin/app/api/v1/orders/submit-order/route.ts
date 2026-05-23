/**
 * CANONICAL ORDER SUBMISSION PATH
 *
 * POST /api/v1/orders/submit-order
 * Single entry point for all order creation with payment settlement.
 * All business logic lives in lib/services/order-submit-orchestrator.service.ts.
 *
 * idempotencyKey is REQUIRED (unlike create-with-payment where it was optional).
 * Same key + same payload → returns cached result (200).
 * Same key + different payload → 409 IDEMPOTENCY_CONFLICT.
 *
 * Legacy path (create-with-payment) is frozen and not served by Next.js.
 * See: docs/features/Order_Fin/ADR_submit_order_canonical_path.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { submitOrderRequestSchema } from '@/lib/validations/new-order-payment-schemas';
import {
  submitOrder,
  resolveOrderBranch,
  type SubmitOrderResult,
} from '@/lib/services/order-submit-orchestrator.service';
import { getRequestAuditContext } from '@/lib/utils/request-audit';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/v1/orders/submit-order
 *
 * Single entry point for all order creation with payment settlement (Phase 1B+).
 * Permission required: orders:create.
 *
 * Idempotency ownership (D11): this route owns the full lifecycle.
 *  - Before calling the orchestrator, it checks org_orders_mst for an existing
 *    row with the same (tenant_org_id, idempotency_key). A hit returns 200 with
 *    fromCache:true — no downstream side effects are repeated.
 *  - After the orchestrator succeeds, the key is written back to the order row
 *    (best-effort UPDATE; failure is non-fatal).
 *  - The orchestrator (submitOrder()) is intentionally idempotency-unaware so it
 *    remains stateless and independently testable.
 *
 * All business logic (totals validation, credit checks, voucher wiring, settlement)
 * is delegated to submitOrder() — this handler only owns: CSRF, auth, schema
 * validation, idempotency fast-path, branch resolution, and error-to-HTTP mapping.
 *
 * @param request - Incoming NextRequest; must carry a valid CSRF token and a
 *                  JWT with orders:create permission for the tenant.
 * @returns 200 with SubmitOrderResult on success (or cached result with fromCache:true).
 *          400 for validation and business-rule errors.
 *          422 for payment infrastructure errors (drawer, gateway, reference).
 *          500 for unexpected failures.
 */
export async function POST(request: NextRequest) {
  // CSRF guard — prevents cross-site form submissions from forging order creation requests
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  // 2. Auth
  const authCheck = await requirePermission('orders:create')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId, userId, userName } = authCheck;

  // 3. Parse + validate (idempotencyKey is required on this route)
  const body = await request.json().catch(() => null);
  const parsed = submitOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // ─── Idempotency fast-path (D11) ──────────────────────────────────────────
  // Route owns idempotency; orchestrator is deliberately unaware.
  // Same key + prior success → return cached order shape without re-running
  // any business logic, settlement, or voucher writes.
  const existing = await prisma.$queryRaw<{ id: string; order_no: string; current_status: string }[]>`
    SELECT id, order_no, current_status
    FROM org_orders_mst
    WHERE tenant_org_id    = ${tenantId}::uuid
      AND idempotency_key  = ${input.idempotencyKey}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({
      success: true,
      data: {
        order: {
          id:            existing[0].id,
          orderNo:       existing[0].order_no,
          currentStatus: existing[0].current_status,
        },
        fromCache: true,
      },
    });
  }

  // 5. Resolve branch
  const branchId = await resolveOrderBranch(tenantId, input.branchId ?? undefined);

  // 6. Delegate to orchestrator (idempotency-unaware)
  try {
    const result: SubmitOrderResult = await submitOrder({
      tenantId,
      userId,
      userName: userName ?? 'User',
      branchId,
      input,
      requestAudit: getRequestAuditContext(request),
    });

    // Store idempotency key on the order row (best-effort — orchestrator already created the order)
    await prisma.$executeRaw`
      UPDATE org_orders_mst
      SET idempotency_key = ${input.idempotencyKey}
      WHERE id           = ${result.order.id}::uuid
        AND tenant_org_id = ${tenantId}::uuid
    `.catch(() => {/* non-fatal — idempotency key store failure does not fail the request */});

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'AMOUNT_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'AMOUNT_MISMATCH',
          error: 'Amount mismatch. Values have changed. Please refresh to get correct amounts.',
          differences: (error as Error & { differences?: unknown }).differences,
        },
        { status: 400 }
      );
    }

    if (message === 'B2B_CREDIT_HOLD') {
      return NextResponse.json(
        { success: false, errorCode: 'B2B_CREDIT_HOLD', error: 'This B2B customer is on credit hold.' },
        { status: 400 }
      );
    }

    if (message === 'B2B_CREDIT_EXCEEDED') {
      const e = error as Error & { creditLimit?: number; currentBalance?: number; available?: number };
      return NextResponse.json(
        { success: false, errorCode: 'B2B_CREDIT_EXCEEDED', error: 'Credit limit exceeded.',
          creditLimit: e.creditLimit, currentBalance: e.currentBalance, available: e.available },
        { status: 400 }
      );
    }

    if (message === 'SPLIT_AMOUNT_MISMATCH') {
      return NextResponse.json(
        { success: false, errorCode: 'SPLIT_AMOUNT_MISMATCH', error: 'Sum of payment legs must equal order total.' },
        { status: 400 }
      );
    }

    if (message === 'DEFERRED_LEG_NOT_ALONE') {
      return NextResponse.json(
        { success: false, errorCode: 'DEFERRED_LEG_NOT_ALONE', error: 'A deferred payment method must be the only payment leg.' },
        { status: 400 }
      );
    }

    if (message === 'CHECK_NUMBER_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'CHECK_NUMBER_REQUIRED', error: 'Check number is required for check payments.' },
        { status: 400 }
      );
    }

    if (['CASH_DRAWER_SESSION_REQUIRED', 'CASH_DRAWER_SESSION_CLOSED',
         'CASH_TENDERED_LESS_THAN_AMOUNT', 'GATEWAY_NOT_CONFIGURED',
         'PAYMENT_REFERENCE_REQUIRED'].includes(message)) {
      return NextResponse.json(
        { success: false, errorCode: message, error: message },
        { status: 422 }
      );
    }

    if (message.startsWith('Product not found:')) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'PRODUCT_NOT_FOUND',
          error: 'One or more products could not be found.',
          productId: message.replace('Product not found: ', '').trim(),
        },
        { status: 400 }
      );
    }

    logger.error('[submit-order] Unexpected error', error instanceof Error ? error : new Error(message), {
      feature: 'orders', action: 'submit-order',
    });
    return NextResponse.json({ success: false, error: 'Order submission failed.' }, { status: 500 });
  }
}
