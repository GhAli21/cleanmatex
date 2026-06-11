/**
 * BVM Wiring Service — Phase 1A
 *
 * postAndWireBizVoucher(): Posts a DRAFT voucher and wires its lines
 * to operational tables in a single atomic DB transaction.
 *
 * Handler registry (order matters — cashDrawer must run after orderPayment
 * so line.order_payment_id is available as a FK when the movement is created):
 *   1. orderPaymentWiringHandler
 *   2. orderCreditApplicationWiringHandler
 *   3. cashDrawerWiringHandler
 */

import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Prisma transaction client type — accepted as optional `tx` so submit-order
 *  can compose voucher posting with stored-value redemptions atomically. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import {
  VOUCHER_STATUS,
  WIRING_STATUS,
  LINE_STATUS,
} from '@/lib/constants/voucher';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { emitEventTx } from './outbox.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { validateStatusTransition, validateVoucherForPosting } from './voucher-validation.service';
import { orderPaymentWiringHandler } from './wiring/order-payment-wiring.handler';
import { orderCreditApplicationWiringHandler } from './wiring/order-credit-application-wiring.handler';
import { cashDrawerWiringHandler } from './wiring/cash-drawer-wiring.handler';
import type {
  VoucherLineForWiring,
  WiringHandler,
  WireLineResult,
  WiringResult,
  PostAndWireResult,
  LinkedEffectsResult,
  LineLinkedEffectResult,
} from '@/lib/types/voucher-wiring';

const WIRING_HANDLERS: WiringHandler[] = [
  orderPaymentWiringHandler,
  orderCreditApplicationWiringHandler,
  cashDrawerWiringHandler,
];

const LINE_SELECT = {
  id:                      true,
  tenant_org_id:           true,
  voucher_id:              true,
  line_no:                 true,
  line_role:               true,
  line_status:             true,
  is_active:               true,
  wiring_status:           true,
  direction:               true,
  payment_method_code:     true,
  payment_status:          true,
  amount:                  true,
  currency_code:           true,
  target_type:             true,
  target_id:               true,
  order_id:                true,
  customer_id:             true,
  cash_drawer_session_id:  true,
  tendered_amount:         true,
  change_returned_amount:  true,
  credit_application_type: true,
  order_payment_id:        true,
  cash_drawer_mvt_id:      true,
  card_brand_code:         true,
  card_last4:              true,
  gateway_code:            true,
  gateway_reference:       true,
  bank_reference:          true,
  check_number:            true,
  org_payment_method_id:   true,
  payment_terminal_id:     true,
  branch_id:               true,
} as const;

/**
 * Internal core. Runs against the supplied tx client; assumes the caller
 * established tenant context.
 */
async function postAndWireBizVoucherInTx(
  tx: PrismaTransactionClient,
  tenantOrgId: string,
  voucherId: string,
  userId: string,
  idempotencyKey?: string,
): Promise<PostAndWireResult> {
  const db = tx as typeof prisma;

      // 1. Idempotency check
      if (idempotencyKey) {
        const existing = await db.org_idempotency_keys.findFirst({
          where: {
            tenant_org_id: tenantOrgId,
            key:           idempotencyKey,
            resource_type: 'voucher_post_wire',
          },
        });
        if (existing?.response_cache) {
          return {
            ...(existing.response_cache as Record<string, unknown>),
            fromCache: true,
          } as PostAndWireResult;
        }
      }

      // 2. Lock voucher header for serialized posting
      const vouchers = await db.$queryRaw<Array<{
        id: string;
        voucher_no: string;
        voucher_status: string;
        total_amount: string;
      }>>`
        SELECT id, voucher_no, voucher_status, total_amount
        FROM org_fin_vouchers_mst
        WHERE id = ${voucherId}::uuid
          AND tenant_org_id = ${tenantOrgId}::uuid
        FOR UPDATE
      `;

      const voucher = vouchers[0];
      if (!voucher) throw new Error(`Voucher ${voucherId} not found`);

      // 3. Assert DRAFT status
      validateStatusTransition(voucher.voucher_status as never, VOUCHER_STATUS.POSTED);

      // 4. Load active DRAFT lines
      const rawLines = await db.org_fin_voucher_trx_lines_dtl.findMany({
        where:  { tenant_org_id: tenantOrgId, voucher_id: voucherId, is_active: true },
        select: LINE_SELECT,
      });

      // 5. Posting validation
      validateVoucherForPosting(Number(voucher.total_amount), rawLines as never[]);

      // 6. Recalculate total from active DRAFT lines
      const recalcTotal = rawLines
        .filter((l) => l.line_status === 'DRAFT')
        .reduce((sum, l) => sum + Number(l.amount), 0);

      const now = new Date();

      // 7. Mark voucher POSTED
      // B8 fix (RESUME doc 2026-05-28): org_fin_vouchers_mst has three columns
      // describing the same concept (legacy `status`, Phase-1A `voucher_status`,
      // wiring `posting_status`). Historically only voucher_status was updated,
      // leaving 30+ rows with mismatched legacy + posting columns. Sync all
      // three on every POSTED transition. Migration 0328 backfilled history.
      await db.org_fin_vouchers_mst.updateMany({
        where: { id: voucherId, tenant_org_id: tenantOrgId },
        data: {
          voucher_status:     VOUCHER_STATUS.POSTED,
          posting_status:     'POSTED',      // wiring lifecycle column
          total_amount:       recalcTotal,
          paid_amount:        recalcTotal,
          outstanding_amount: 0,
          posted_at:          now,
          posted_by:          userId,
          updated_at:         now,
          updated_by:         userId,
        },
      });

      // 8. Mark all active DRAFT lines POSTED; wiring_status stays NOT_WIRED until handler runs
      await db.org_fin_voucher_trx_lines_dtl.updateMany({
        where: {
          tenant_org_id: tenantOrgId,
          voucher_id:    voucherId,
          line_status:   'DRAFT',
          is_active:     true,
        },
        data: { line_status: LINE_STATUS.POSTED, updated_at: now, updated_by: userId },
      });

      // 9. Wire each line via matching handlers
      const lines = rawLines as unknown as VoucherLineForWiring[];
      const effects: WireLineResult[] = [];
      let linesWired = 0;
      let linesSkipped = 0;
      let linesFailed = 0;

      for (const line of lines) {
        const matchingHandlers = WIRING_HANDLERS.filter((h) => h.canHandle(line));

        if (matchingHandlers.length === 0) {
          linesSkipped++;
          effects.push({ lineId: line.id, wired: false, effectIds: [] });
          continue;
        }

        const effectIds: string[] = [];
        let wireFailed = false;

        for (const handler of matchingHandlers) {
          try {
            await handler.validate(line);
            const effectId = await handler.wire(line, voucherId, tenantOrgId, userId, tx);
            effectIds.push(effectId);
          } catch (err) {
            wireFailed = true;
            const errMsg = err instanceof Error ? err.message : String(err);
            effects.push({ lineId: line.id, wired: false, effectIds, error: errMsg });
            // Bubble up to roll back entire transaction
            throw err;
          }
        }

        if (!wireFailed) {
          await db.org_fin_voucher_trx_lines_dtl.updateMany({
            where: { id: line.id, tenant_org_id: tenantOrgId },
            data:  { wiring_status: WIRING_STATUS.WIRED, updated_at: now, updated_by: userId },
          });
          linesWired++;
          effects.push({ lineId: line.id, wired: true, effectIds });
        }
      }

      // 10. Write domain event via the typed helper so the event-type string
      // is validated against OUTBOX_EVENT_TYPES (no drift) and audit columns
      // (`aggregate_type`, processing fields) follow the same shape as every
      // other outbox emit in Order Fin.
      await emitEventTx(
        db,
        tenantOrgId,
        OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
        'fin_voucher',
        voucherId,
        {
          voucher_id:     voucherId,
          voucher_no:     voucher.voucher_no,
          voucher_status: VOUCHER_STATUS.POSTED,
          total_amount:   recalcTotal,
          posted_by:      userId,
          posted_at:      now.toISOString(),
          lines_wired:    linesWired,
          lines_skipped:  linesSkipped,
          lines_failed:   linesFailed,
        }
      );

      // 11. Audit log
      await db.org_fin_voucher_audit_log.create({
        data: {
          voucher_id:         voucherId,
          tenant_org_id:      tenantOrgId,
          action:             'POSTED_AND_WIRED',
          changed_by:         userId,
          changed_at:         now,
          snapshot_or_reason: JSON.stringify({
            voucher_status: VOUCHER_STATUS.POSTED,
            total_amount:   recalcTotal,
            lines_wired:    linesWired,
            lines_skipped:  linesSkipped,
            lines_failed:   linesFailed,
          }),
        },
      });

      const wiringResult: WiringResult = {
        voucherId,
        linesWired,
        linesSkipped,
        linesFailed,
        effects,
      };

      const result: PostAndWireResult = {
        voucherId,
        voucher_no:     voucher.voucher_no,
        voucher_status: VOUCHER_STATUS.POSTED,
        wiring:         wiringResult,
        fromCache:      false,
      };

      // 12. Persist idempotency key
      if (idempotencyKey) {
        await db.org_idempotency_keys.upsert({
          where: {
            tenant_org_id_key_resource_type: {
              tenant_org_id: tenantOrgId,
              key:           idempotencyKey,
              resource_type: 'voucher_post_wire',
            },
          },
          create: {
            tenant_org_id:  tenantOrgId,
            key:            idempotencyKey,
            resource_type:  'voucher_post_wire',
            resource_id:    voucherId,
            response_cache: result as unknown as Prisma.InputJsonValue,
            created_at:     now,
            expires_at:     new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          update: {
            response_cache: result as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return result;
}

/**
 * Post a DRAFT voucher and wire all eligible lines to their operational tables.
 * Posting + wiring happen in one Prisma transaction — full rollback on any failure.
 *
 * When `tx` is supplied, joins the caller's transaction (no nested
 * `$transaction`, no nested `withTenantContext`) so submit-order can cover
 * header create + lines + stored-value debits + post-and-wire atomically.
 * Existing callers can omit `tx` and the function opens its own.
 */
export async function postAndWireBizVoucher(
  tenantOrgId: string,
  voucherId: string,
  userId: string,
  idempotencyKey?: string,
  tx?: PrismaTransactionClient,
): Promise<PostAndWireResult> {
  if (tx) {
    return postAndWireBizVoucherInTx(tx, tenantOrgId, voucherId, userId, idempotencyKey);
  }
  return withTenantContext(tenantOrgId, async () =>
    prisma.$transaction((innerTx) =>
      postAndWireBizVoucherInTx(innerTx, tenantOrgId, voucherId, userId, idempotencyKey),
    ),
  );
}

/**
 * Refresh the linked order's financial snapshot AFTER a voucher post completes.
 *
 * Why this exists as a separate post-commit step (not inside postAndWireBizVoucher):
 * postAndWireBizVoucher serves vouchers from any source_module (ORDERS,
 * CUSTOMER_REFUND, SUPPLIER_PAYMENT, …). Calling the order snapshot recalc
 * inside the voucher tx would couple voucher writes to the orders domain and
 * fail or no-op for non-order vouchers.
 *
 * The orchestrator (submit-order) already recalcs via settleOrder. This helper
 * exists so manual voucher posts from the Finance UI also refresh the linked
 * order — fixing the silent-drift bug (X5) where the order header stayed
 * UNPAID after a manual POST.
 *
 * Reads voucher.source_module + voucher.order_id, and only runs recalc if
 * source_module === 'ORDERS' and order_id is set. Returns the new snapshot or
 * null (non-order voucher → no recalc).
 */
export async function recalcOrderSnapshotIfLinked(
  tenantOrgId: string,
  voucherId: string
): Promise<{
  orderId: string;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
} | null> {
  return withTenantContext(tenantOrgId, async () => {
    const voucher = await prisma.org_fin_vouchers_mst.findFirst({
      where:  { id: voucherId, tenant_org_id: tenantOrgId },
      select: { source_module: true, order_id: true },
    });

    if (!voucher || voucher.source_module !== 'ORDERS' || !voucher.order_id) {
      return null;
    }

    const orderId = voucher.order_id;
    return prisma.$transaction(async (tx) => {
      const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantOrgId, orderId);
      return {
        orderId,
        totalPaidAmount:          snapshot.totalPaidAmount,
        totalCreditAppliedAmount: snapshot.totalCreditAppliedAmount,
        outstandingAmount:        snapshot.outstandingAmount,
        paymentStatus:            snapshot.paymentStatus,
      };
    });
  });
}

/**
 * Fetch all operational effects linked to a voucher (read path for UI).
 * Returns three grouped arrays: orderPayments, cashDrawerMovements, creditApplications.
 */
export async function getVoucherLinkedEffects(
  tenantOrgId: string,
  voucherId: string
): Promise<LinkedEffectsResult> {
  return withTenantContext(tenantOrgId, async () => {
    const [payments, movements, creditApps] = await Promise.all([
      prisma.org_order_payments_dtl.findMany({
        where:  { tenant_org_id: tenantOrgId, fin_voucher_id: voucherId },
        select: {
          id:                  true,
          order_id:            true,
          amount:              true,
          payment_method_code: true,
          fin_voucher_trx_line_id: true,
          payment_status:      true,
        },
      }),
      prisma.org_cash_drawer_movements_dtl.findMany({
        where:  { tenant_org_id: tenantOrgId, fin_voucher_id: voucherId },
        select: {
          id:                      true,
          cash_drawer_session_id:  true,
          amount:                  true,
          movement_type:           true,
          fin_voucher_trx_line_id: true,
        },
      }),
      prisma.org_order_credit_apps_dtl.findMany({
        where:  { tenant_org_id: tenantOrgId, fin_voucher_id: voucherId },
        select: {
          id:                      true,
          order_id:                true,
          applied_amount:          true,
          credit_type:             true,
          fin_voucher_trx_line_id: true,
        },
      }),
    ]);

    return {
      voucherId,
      orderPayments: payments.map((p) => ({
        id:                  p.id,
        order_id:            p.order_id,
        amount:              p.amount,
        payment_method_code: p.payment_method_code,
        line_id:             p.fin_voucher_trx_line_id,
        payment_status:      p.payment_status,
      })),
      cashDrawerMovements: movements.map((m) => ({
        id:            m.id,
        session_id:    m.cash_drawer_session_id,
        amount:        m.amount,
        movement_type: m.movement_type,
        line_id:       m.fin_voucher_trx_line_id,
      })),
      creditApplications: creditApps.map((c) => ({
        id:          c.id,
        order_id:    c.order_id,
        amount:      c.applied_amount,
        credit_type: c.credit_type,
        line_id:     c.fin_voucher_trx_line_id ?? null,
      })),
    };
  });
}

/**
 * Fetch all operational effects linked to a single voucher line.
 */
export async function getLineLinkedEffect(
  tenantOrgId: string,
  lineId: string
): Promise<LineLinkedEffectResult> {
  const line = await prisma.org_fin_voucher_trx_lines_dtl.findFirst({
    where:  { id: lineId, tenant_org_id: tenantOrgId },
    select: { wiring_status: true },
  });

  if (!line) throw new Error(`Voucher line ${lineId} not found`);

  const [payment, movement, creditApp] = await Promise.all([
    prisma.org_order_payments_dtl.findFirst({
      where:  { fin_voucher_trx_line_id: lineId, tenant_org_id: tenantOrgId },
      select: { id: true, amount: true, currency_code: true },
    }),
    prisma.org_cash_drawer_movements_dtl.findFirst({
      where:  { fin_voucher_trx_line_id: lineId, tenant_org_id: tenantOrgId },
      select: { id: true, amount: true, currency_code: true },
    }),
    prisma.org_order_credit_apps_dtl.findFirst({
      where:  { fin_voucher_trx_line_id: lineId, tenant_org_id: tenantOrgId },
      select: { id: true, applied_amount: true, currency_code: true },
    }),
  ]);

  const effects = [];
  if (payment) {
    effects.push({
      effectType:    'ORDER_PAYMENT' as const,
      effectId:      payment.id,
      tableRef:      'org_order_payments_dtl' as const,
      amount:        payment.amount,
      currency_code: payment.currency_code,
    });
  }
  if (movement) {
    effects.push({
      effectType:    'CASH_DRAWER_MOVEMENT' as const,
      effectId:      movement.id,
      tableRef:      'org_cash_drawer_movements_dtl' as const,
      amount:        movement.amount,
      currency_code: movement.currency_code,
    });
  }
  if (creditApp) {
    effects.push({
      effectType:    'CREDIT_APPLICATION' as const,
      effectId:      creditApp.id,
      tableRef:      'org_order_credit_apps_dtl' as const,
      amount:        creditApp.applied_amount,
      currency_code: creditApp.currency_code,
    });
  }

  return {
    lineId,
    wiring_status: line.wiring_status,
    effects,
  };
}
