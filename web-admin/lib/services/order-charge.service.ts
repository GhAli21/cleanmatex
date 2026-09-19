/**
 * B18 follow-up — Order charge void.
 *
 * `org_order_charges_dtl` rows are an immutable ledger (migration 0280
 * comment: "use is_voided flag instead of soft-delete columns"). Voiding
 * flags the row rather than deleting it, then keeps every downstream
 * consumer consistent:
 *
 *  - `recalculateOrderFinancialSnapshotTx` already sums charges with
 *    `is_voided: false` (order-financial-write.service.ts), so it picks up
 *    the void automatically and rewrites `total_charges_amount`,
 *    `total_amount`, and `outstanding_amount` in the same transaction.
 *  - `order-snapshot-checks.ts`'s ORDER_PIECES_MATCH_CHARGES /
 *    ORDER_PREFERENCES_MATCH_CHARGES / PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE
 *    checks compare the active PREFERENCE-charge sum against the raw
 *    `org_order_preferences_dtl.extra_price` / piece `service_pref_charge`
 *    sums (B18 Design decision #3: one charge row per preference row, by
 *    construction). Voiding a PREFERENCE-type charge without also retiring
 *    its source preference would leave those BLOCKER checks permanently
 *    failing for this order (the source amount stays counted with nothing
 *    left to offset it). So voiding a PREFERENCE charge also soft-deletes
 *    its source preference row (`rec_status = 0`, the same convention
 *    `recalculateOrderFinancialSnapshotTx`'s own preference/piece aggregates
 *    already filter on) and, for a PIECE-level preference, decrements that
 *    piece's denormalized `service_pref_charge` by the exact voided amount.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * System void of leftover PREFERENCE charges during item replace / totals rewrite.
 * Does not require `orders:manual_charge` and does not snapshot (caller snapshots).
 */
export async function voidPreferenceChargesForOrderRewriteTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    userId: string;
    reason: string;
  },
): Promise<number> {
  const now = new Date();
  const flipped = await tx.org_order_charges_dtl.updateMany({
    where: {
      tenant_org_id: params.tenantId,
      order_id: params.orderId,
      is_voided: false,
      charge_type: CHARGE_TYPES.PREFERENCE,
    },
    data: {
      is_voided: true,
      voided_at: now,
      voided_by: params.userId,
      void_reason: params.reason,
      updated_at: now,
      updated_by: params.userId,
    },
  });
  return flipped.count;
}

export class OrderChargeVoidError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OrderChargeVoidError';
    this.code = code;
  }
}

export interface VoidOrderChargeParams {
  tenantId: string;
  orderId: string;
  chargeId: string;
  voidedBy: string;
  reason: string;
}

export interface VoidOrderChargeResult {
  chargeId: string;
  voidedAmount: number;
  outstandingAmount: number;
}

/**
 * Void one `org_order_charges_dtl` row and keep the order's financial
 * snapshot + reconciliation invariants consistent.
 * @param params
 */
export async function voidOrderCharge(
  params: VoidOrderChargeParams,
): Promise<VoidOrderChargeResult> {
  const { tenantId, orderId, chargeId, voidedBy, reason } = params;
  const trimmedReason = reason?.trim() ?? '';
  if (!trimmedReason) {
    throw new OrderChargeVoidError('VOID_REASON_REQUIRED', 'A void reason is required');
  }

  return prisma.$transaction(async (tx) => {
      const charge = await tx.org_order_charges_dtl.findFirst({
        where: { id: chargeId, order_id: orderId, tenant_org_id: tenantId },
        select: {
          id: true,
          charge_type: true,
          charge_source_id: true,
          amount: true,
          is_voided: true,
        },
      });
      if (!charge) {
        throw new OrderChargeVoidError('CHARGE_NOT_FOUND', 'Charge not found');
      }
      if (charge.is_voided) {
        throw new OrderChargeVoidError('CHARGE_ALREADY_VOIDED', 'Charge is already voided');
      }

      const now = new Date();

      // Conditional guard on is_voided:false — protects against a concurrent
      // double-void racing this same charge row.
      const flipped = await tx.org_order_charges_dtl.updateMany({
        where: { id: chargeId, order_id: orderId, tenant_org_id: tenantId, is_voided: false },
        data: {
          is_voided: true,
          voided_at: now,
          voided_by: voidedBy,
          void_reason: trimmedReason,
          updated_at: now,
          updated_by: voidedBy,
        },
      });
      if (flipped.count === 0) {
        throw new OrderChargeVoidError('CHARGE_ALREADY_VOIDED', 'Charge is already voided');
      }

      if (charge.charge_type === CHARGE_TYPES.PREFERENCE && charge.charge_source_id) {
        const preference = await tx.org_order_preferences_dtl.findFirst({
          where: { id: charge.charge_source_id, order_id: orderId, tenant_org_id: tenantId },
          select: { id: true, order_item_piece_id: true, extra_price: true, rec_status: true },
        });

        if (preference && preference.rec_status !== 0) {
          await tx.org_order_preferences_dtl.update({
            where: { id: preference.id },
            data: { rec_status: 0, updated_at: now, updated_by: voidedBy },
          });

          const extraPrice = Number(preference.extra_price ?? 0);
          if (preference.order_item_piece_id && extraPrice > 0) {
            const piece = await tx.org_order_item_pieces_dtl.findFirst({
              where: {
                id: preference.order_item_piece_id,
                order_id: orderId,
                tenant_org_id: tenantId,
              },
              select: { id: true, service_pref_charge: true },
            });
            if (piece) {
              const nextPieceCharge = Math.max(0, Number(piece.service_pref_charge ?? 0) - extraPrice);
              await tx.org_order_item_pieces_dtl.update({
                where: { id: piece.id },
                data: { service_pref_charge: nextPieceCharge, updated_at: now },
              });
            }
          }
        }
      }

      const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

      return {
        chargeId,
        voidedAmount: Number(charge.amount),
        outstandingAmount: snapshot.outstandingAmount,
      };
  });
}
