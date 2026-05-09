/**
 * Order Cancel Service for CleanMateX
 *
 * Orchestrates order cancellation: DB transition + payment handling.
 * Cancel = void order before customer receives items (draft through out_for_delivery).
 * When order has paid_amount > 0, cancels linked payments and reverses any
 * promo usage / gift card debits attached to those payments.
 *
 * Plan: cancel_and_return_order_ddb29821.plan.md
 * Plan: promotions_and_gifts_30156abf.plan.md (refund + promo reversal)
 */

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { getPaymentsForOrder, cancelPayment } from './payment-service';
import { reversePromoUsageTx } from './discount-service';
import { refundToGiftCardTx } from './gift-card-service';
import { voidDiscountLinesTx } from '@/lib/db/order-discounts';

export interface CancelOrderInput {
  orderId: string;
  tenantId: string;
  userId: string;
  cancelled_note: string;
  cancellation_reason_code?: string;
}

export interface CancelOrderResult {
  success: boolean;
  error?: string;
  /**
   * Non-fatal warnings produced during cancellation (e.g. partial gift card
   * refunds, missing card numbers). Order is still cancelled when warnings
   * are present.
   */
  warnings?: string[];
}

/**
 * Reverse promo usage and refund any gift card amount associated with a
 * cancelled order. Runs in a single Prisma transaction to keep the ledger
 * consistent across the two reversals.
 *
 * The supabase RPC `cmx_ord_canceling_transition` already handled the order
 * status flip outside Prisma, so this is a follow-up best-effort reversal.
 */
async function reversePromoAndGiftForOrder(input: CancelOrderInput): Promise<{
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Look up payments + their promo / gift card linkage directly from prisma
  // (getPaymentsForOrder does not select those columns).
  const paymentRows = await prisma.org_payments_dtl_tr.findMany({
    where: {
      tenant_org_id: input.tenantId,
      order_id: input.orderId,
    },
    select: {
      id: true,
      status: true,
      promo_code_id: true,
      promo_discount_amount: true,
      gift_card_id: true,
      gift_card_applied_amount: true,
      invoice_id: true,
      metadata: true,
    },
  });

  // Only reverse for payments that were active (completed/cancelled now). The
  // RPC has already moved them to cancelled by this point — we still want to
  // reverse usage for any payment that previously consumed promo/gift.
  const hasPromoUsage = paymentRows.some(
    (p) => p.promo_code_id && Number(p.promo_discount_amount ?? 0) > 0
  );
  const giftPayments = paymentRows.filter(
    (p) => p.gift_card_id && Number(p.gift_card_applied_amount ?? 0) > 0
  );

  if (!hasPromoUsage && giftPayments.length === 0) {
    return { warnings };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Promo reversal — voids usage log rows for this order and
    //    decrements current_uses per affected promo.
    if (hasPromoUsage) {
      const { reversedCount } = await reversePromoUsageTx(tx, {
        orderId: input.orderId,
        tenantOrgId: input.tenantId,
        voidedBy: input.userId,
      });
      logger.info('Promo usage reversed for cancelled order', {
        orderId: input.orderId,
        reversedCount,
      });
    }

    // 2. Gift card refund — restore balance per gift payment, capped at
    //    original_amount inside refundToGiftCardTx.
    for (const payment of giftPayments) {
      if (!payment.gift_card_id) continue;

      // Resolve card_number — payment row stores gift_card_id, not number.
      const card = await tx.org_gift_cards_mst.findUnique({
        where: { id: payment.gift_card_id },
        select: { card_number: true },
      });

      if (!card?.card_number) {
        warnings.push(
          `Gift card ${payment.gift_card_id} not found for refund — skipping`
        );
        continue;
      }

      const requested = Number(payment.gift_card_applied_amount ?? 0);
      try {
        const { actualRefundAmount } = await refundToGiftCardTx(tx, {
          cardNumber: card.card_number,
          amount: requested,
          orderId: input.orderId,
          invoiceId: payment.invoice_id ?? '',
          reason: `Order cancelled: ${input.cancelled_note}`.slice(0, 500),
          processedBy: input.userId,
          tenantOrgId: input.tenantId,
        });

        if (actualRefundAmount < requested) {
          warnings.push(
            `Partial gift card refund: requested ${requested}, refunded ${actualRefundAmount} (capped at original_amount)`
          );
        }
      } catch (err) {
        // Don't fail the entire reversal — surface as warning per plan.
        warnings.push(
          `Gift card refund failed for card ${card.card_number}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    // 3. Void discount audit lines — marks all non-voided lines is_voided=true.
    //    Rows remain in the table for accounting history.
    await voidDiscountLinesTx(tx, {
      orderId:     input.orderId,
      tenantOrgId: input.tenantId,
      voidedBy:    input.userId,
    });
  });

  return { warnings };
}

/**
 * Cancel order and handle linked payments.
 * Call cmx_ord_canceling_transition RPC, then cancel each completed payment,
 * then reverse promo usage + gift card debits in a single Prisma transaction.
 */
export async function cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult> {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc('cmx_ord_canceling_transition', {
    p_tenant_org_id: input.tenantId,
    p_order_id: input.orderId,
    p_user_id: input.userId,
    p_input: {
      cancelled_note: input.cancelled_note,
      cancellation_reason_code: input.cancellation_reason_code,
    },
  });

  if (error || !result?.ok) {
    return {
      success: false,
      error: result?.message || error?.message || 'Cancel failed',
    };
  }

  const warnings: string[] = [];

  // Payment handling: cancel completed payments linked to order
  try {
    const payments = await getPaymentsForOrder(input.orderId);
    const completedPayments = payments.filter(
      (p) => p.status === 'completed' && p.paid_amount > 0
    );
    for (const payment of completedPayments) {
      const cancelResult = await cancelPayment(
        payment.id,
        input.cancelled_note,
        input.userId
      );
      if (!cancelResult.success) {
        logger.warn(`Failed to cancel payment ${payment.id}: ${cancelResult.error ?? ''}`);
        // Continue with other payments; order is already cancelled
      }
    }
  } catch (paymentError) {
    logger.warn(
      `Payment cancel handling failed: ${
        paymentError instanceof Error ? paymentError.message : String(paymentError)
      }`
    );
    // Order is already cancelled; payment cancel is best-effort
  }

  // Reverse promo usage + gift card refund in a single Prisma transaction.
  // Wrapped in withTenantContext so RLS sees the tenant during prisma calls.
  try {
    const reversalResult = await withTenantContext(input.tenantId, async () =>
      reversePromoAndGiftForOrder(input)
    );
    warnings.push(...reversalResult.warnings);
  } catch (reversalError) {
    // Surface as warning rather than failing — order cancellation already happened.
    const message =
      reversalError instanceof Error ? reversalError.message : String(reversalError);
    logger.error('Promo/gift reversal failed for cancelled order', reversalError as Error, {
      orderId: input.orderId,
      tenantId: input.tenantId,
    });
    warnings.push(`Promo/gift reversal failed: ${message}`);
  }

  return warnings.length > 0 ? { success: true, warnings } : { success: true };
}
