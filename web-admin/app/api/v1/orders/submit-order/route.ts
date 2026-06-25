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
import {
  hashPayload,
  findIdempotencyHash,
  storeIdempotencyHash,
  deleteIdempotencyHash,
  stakeIdempotencyHash,
} from '@/lib/utils/idempotency';
import { emitNotificationEvent } from '@lib/notifications/event-emitter';
import { buildOrderCreatedNotificationVariables } from '@lib/notifications/order-event-variables';

const IDEMPOTENCY_RESOURCE = 'submit_order';

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

  // ─── Idempotency fast-path + payload-hash conflict detection (D11 + S2) ───
  // Route owns idempotency; orchestrator is deliberately unaware.
  //
  // P3 (B6 RESUME doc 2026-05-28): the hash row is now stored BEFORE the
  // orchestrator runs (with resource_id=null as a placeholder). The placeholder
  // is updated to the real order id on success, and left as-is on failure.
  // Why: a previous failure with no row let attempt 2 fall through and create
  // a NEW orderId. Combined with stale voucher sub-keys (now fixed via Fix A),
  // that produced the orphan voucher data-integrity bug. Pre-storing the
  // claim makes failed attempts visible to the next retry instead of silently
  // producing a fresh order.
  const currentHash = hashPayload(input);
  const idempotencyRecord = await findIdempotencyHash(
    tenantId,
    input.idempotencyKey,
    IDEMPOTENCY_RESOURCE
  );

  if (idempotencyRecord) {
    if (idempotencyRecord.hash && idempotencyRecord.hash !== currentHash) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'IDEMPOTENCY_CONFLICT',
          error: 'Same idempotency key used with a different payload. Use a new key or restore the original payload.',
        },
        { status: 409 }
      );
    }
    // Hash match (or legacy row without hash) → safe to return cached order.
    if (idempotencyRecord.resourceId) {
      const cached = await prisma.org_orders_mst.findFirst({
        where:  { id: idempotencyRecord.resourceId, tenant_org_id: tenantId },
        select: { id: true, order_no: true, current_status: true },
      });
      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            order: {
              id:            cached.id,
              orderNo:       cached.order_no,
              currentStatus: cached.current_status,
            },
            fromCache: true,
          },
        });
      }
    }

    // P3: hash row exists but resource_id is null → the prior attempt EITHER
    // (a) succeeded and the post-success update of resource_id failed (partial
    //     success — recoverable via the legacy match-by-key fallback below), or
    // (b) failed before completing. We can't distinguish without checking the
    // order table for a row carrying this idempotency_key.
    const recoveredOrder = await prisma.$queryRaw<{ id: string; order_no: string; current_status: string }[]>`
      SELECT id, order_no, current_status
      FROM org_orders_mst
      WHERE tenant_org_id   = ${tenantId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (recoveredOrder.length > 0) {
      // Heal the orphaned hash row by attaching the real resource_id.
      await storeIdempotencyHash(
        tenantId, input.idempotencyKey, IDEMPOTENCY_RESOURCE, currentHash, recoveredOrder[0].id
      ).catch(() => { /* non-fatal */ });
      return NextResponse.json({
        success: true,
        data: {
          order: {
            id:            recoveredOrder[0].id,
            orderNo:       recoveredOrder[0].order_no,
            currentStatus: recoveredOrder[0].current_status,
          },
          fromCache: true,
        },
      });
    }

    // True failed-prior-attempt. Refuse the retry so the caller surfaces the
    // failure to the user — they must issue a new idempotency key to retry.
    return NextResponse.json(
      {
        success: false,
        errorCode: 'PRIOR_ATTEMPT_FAILED',
        error: 'A previous submission with this idempotency key did not complete. Refresh and retry with a new key.',
      },
      { status: 409 }
    );
  }

  // Legacy path: prior submits may have written only org_orders_mst.idempotency_key
  // (before S2 introduced the hash record). Honor those rows as match-by-key only.
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

  // ─── Pre-orchestrator placeholder ───
  // Stake a claim on this idempotency key BEFORE running the orchestrator.
  // If the orchestrator fails, this row remains with resource_id=null and the
  // next retry hits the PRIOR_ATTEMPT_FAILED branch above. If storing this
  // claim itself fails, the request must abort — proceeding without the claim
  // is what allowed the B6 orphan voucher to be created.
  try {
    const stakedRecord = await stakeIdempotencyHash(
      tenantId,
      input.idempotencyKey,
      IDEMPOTENCY_RESOURCE,
      currentHash,
    );
    if (stakedRecord.conflict) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'IDEMPOTENCY_CONFLICT',
          error: 'Same idempotency key used with a different payload. Use a new key or restore the original payload.',
        },
        { status: 409 },
      );
    }
    // conflict is already handled above. Narrow via the `in` operator: boolean
    // discriminant narrowing does not engage under this project's non-strict
    // tsconfig, but property-presence narrowing does.
    const stakedResourceId = 'resourceId' in stakedRecord ? stakedRecord.resourceId : null;
    if (stakedResourceId) {
      const stakedOrder = await prisma.org_orders_mst.findFirst({
        where:  { id: stakedResourceId, tenant_org_id: tenantId },
        select: { id: true, order_no: true, current_status: true },
      });
      if (stakedOrder) {
        return NextResponse.json({
          success: true,
          data: {
            order: {
              id:            stakedOrder.id,
              orderNo:       stakedOrder.order_no,
              currentStatus: stakedOrder.current_status,
            },
            fromCache: true,
          },
        });
      }
    }
  } catch (err) {
    logger.error('[submit-order] failed to stake idempotency claim — aborting before orchestrator',
      err instanceof Error ? err : new Error(String(err)),
      { feature: 'orders', action: 'submit-order' });
    return NextResponse.json(
      { success: false, errorCode: 'IDEMPOTENCY_CLAIM_FAILED', error: 'Could not reserve idempotency key. Please retry.' },
      { status: 500 }
    );
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

    // P3: update the pre-orchestrator placeholder hash row with the real
    // resource_id. Failure is non-fatal — the order succeeded, and the
    // recovery branch above (hash row exists + resource_id null + order
    // exists by key) will heal the row on the next retry.
    await storeIdempotencyHash(
      tenantId,
      input.idempotencyKey,
      IDEMPOTENCY_RESOURCE,
      currentHash,
      result.order.id
    ).catch((err: unknown) => {
      logger.warn?.('[submit-order] failed to update idempotency hash with resource_id', {
        feature: 'orders', action: 'submit-order',
        error: err instanceof Error ? err.message : String(err),
      });
    });

    void emitNotificationEvent({
      code: 'order.created',
      tenantOrgId: tenantId,
      recipientUserIds: [userId],
      sourceEntityType: 'order',
      sourceEntityId: result.order.id,
      variables: buildOrderCreatedNotificationVariables({
        orderNo:   result.order.orderNo,
        readyByAt: input.readyByAt,
      }),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const committedOrder = await prisma.org_orders_mst.findFirst({
      where: {
        tenant_org_id:    tenantId,
        idempotency_key:  input.idempotencyKey,
      },
      select: { id: true, order_no: true, current_status: true },
    }).catch(() => null);

    if (committedOrder) {
      await storeIdempotencyHash(
        tenantId,
        input.idempotencyKey,
        IDEMPOTENCY_RESOURCE,
        currentHash,
        committedOrder.id,
      ).catch(() => { /* non-fatal recovery cache write */ });

      return NextResponse.json({
        success: true,
        data: {
          order: {
            id:            committedOrder.id,
            orderNo:       committedOrder.order_no,
            currentStatus: committedOrder.current_status,
          },
          fromCache: true,
        },
      });
    }

    // submitOrder is atomic: if no committed order carries this idempotency key,
    // the transaction rolled back and the placeholder can be safely unstaked.
    const errorCode = message.startsWith('Product not found:') ? 'PRODUCT_NOT_FOUND' : message;
    await deleteIdempotencyHash(tenantId, input.idempotencyKey, IDEMPOTENCY_RESOURCE)
      .catch((err: unknown) => {
        logger.warn?.('[submit-order] failed to unstake idempotency placeholder after rolled-back error', {
          feature: 'orders', action: 'submit-order',
          errorCode, error: err instanceof Error ? err.message : String(err),
        });
      });

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

    if (message === 'OUTSTANDING_POLICY_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'OUTSTANDING_POLICY_REQUIRED',
          error: 'Choose how the remaining balance should be handled.',
        },
        { status: 400 }
      );
    }

    if (message === 'CHECK_NUMBER_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'CHECK_NUMBER_REQUIRED', error: 'Check number is required for check payments.' },
        { status: 400 }
      );
    }

    if (message === 'INVALID_TAX_PROFILE_SELECTION') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'INVALID_TAX_PROFILE_SELECTION',
          error: 'One or more selected tax profiles are invalid or no longer active.',
        },
        { status: 400 }
      );
    }

    if (['CASH_DRAWER_SESSION_REQUIRED', 'CASH_DRAWER_SESSION_SELECTION_REQUIRED', 'CASH_DRAWER_SESSION_CLOSED',
         'CASH_TENDERED_REQUIRED', 'CASH_TENDERED_LESS_THAN_AMOUNT', 'CASH_CHANGE_NOT_ALLOWED',
         'METHOD_OVERPAYMENT_NOT_ALLOWED', 'CASH_TENDERED_ONLY_FOR_CASH', 'GATEWAY_NOT_CONFIGURED',
         'PAYMENT_REFERENCE_REQUIRED', 'PAYMENT_TERMINAL_REQUIRED',
         'OVERPAYMENT_RESOLUTION_REQUIRED', 'OVERPAYMENT_RESOLUTION_MISMATCH',
         'OVERPAYMENT_RESOLUTION_NOT_ALLOWED', 'RETURN_CHANGE_EXCEEDS_CAPACITY',
         'RETURN_CHANGE_LEG_INVALID', 'RECEIPT_ALLOCATION_EXCESS_UNRESOLVED'].includes(message)) {
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
