import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  PAYMENT_NATURE,
  CREDIT_APPLICATION_TYPES,
  ORDER_PAYMENT_STATUS,
  OUTBOX_EVENT_TYPES,
} from '@/lib/constants/order-financial';
import type {
  FinancialBreakdownSnapshot,
  ChargeLineItem,
  TaxLineItem,
  DiscountLineInput,
  ResolvedSettlementLeg,
} from '@/lib/types/order-financial';
import { emitEventTx } from './outbox.service';
import { redeemWalletTx, redeemAdvanceTx, redeemCreditNoteTx } from './stored-value.service';
import { redeemPointsTx, queueEarnPoints } from './loyalty.service';
import { validateGiftCardByIdForCalculation, redeemGiftCardTx } from './gift-card-service';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface SettlementParams {
  orderId:              string;
  tenantId:             string;
  breakdown:            FinancialBreakdownSnapshot;
  chargeLines:          ChargeLineItem[];
  taxLines:             TaxLineItem[];
  discountLines:        DiscountLineInput[];
  settlementLegs:       ResolvedSettlementLeg[];
  cashDrawerSessionId?: string;
  settledBy?:           string;
}

export interface SettlementResult {
  orderId:            string;
  paymentStatus:      string;
  totalPaid:          number;
  outstanding:        number;
  changeReturned:     number;
}

/**
 * Settle an order in a single atomic transaction.
 * Writes all financial fact rows, routes each leg by payment_nature, emits outbox events.
 */
export async function settleOrder(params: SettlementParams): Promise<SettlementResult> {
  const {
    orderId, tenantId, breakdown, chargeLines, taxLines,
    discountLines, settlementLegs, cashDrawerSessionId, settledBy,
  } = params;
  const currencyCode = breakdown.currencyCode;

  return prisma.$transaction(async (tx) => {
    // ── 1. Charges ───────────────────────────────────────────────────────────
    for (const charge of chargeLines) {
      await tx.org_order_charges_dtl.create({
        data: {
          tenant_org_id:   tenantId,
          order_id:        orderId,
          charge_type:     charge.chargeType,
          label:           charge.label,
          label2:          charge.label2 ?? null,
          amount:          charge.amount,
          currency_code:   currencyCode,
          charge_source_id:charge.sourceId ?? null,
          rec_status:      1,
        },
      });
    }

    // ── 2. Taxes ─────────────────────────────────────────────────────────────
    for (const tax of taxLines) {
      await tx.org_order_taxes_dtl.create({
        data: {
          tenant_org_id:  tenantId,
          order_id:       orderId,
          tax_type:       tax.taxType,
          label:          tax.label,
          label2:         tax.label2 ?? null,
          rate:           tax.rate,
          taxable_amount: tax.baseAmount,
          tax_amount:     tax.taxAmount,
          currency_code:  currencyCode,
          rec_status:     1,
        },
      });
    }

    // ── 3. Discounts ─────────────────────────────────────────────────────────
    let discSeq = 1;
    for (const disc of discountLines) {
      await tx.org_order_discounts_dtl.create({
        data: {
          tenant_org_id:   tenantId,
          order_id:        orderId,
          applied_seq:     discSeq++,
          source_type:     disc.sourceType,
          source_id:       disc.sourceId ?? null,
          source_name:     disc.sourceName,
          source_name2:    disc.sourceName2 ?? null,
          discount_type:   disc.discountType,
          discount_rate:   disc.discountRate ?? null,
          discount_amount: disc.discountAmount,
          promotion_id:    disc.promotionId ?? null,
          stacking_group:  disc.stackingGroup ?? null,
          rec_status:      1,
        },
      });
    }

    // ── 4 & 5. Settlement legs ────────────────────────────────────────────────
    let totalRealPayments = 0;
    let changeReturned    = 0;
    let isDeferred        = false;

    for (const leg of settlementLegs) {
      const { settlementOption: opt, amount, terminalId, cashTendered, creditReferenceId } = leg;
      const nature = opt.paymentNature;

      if (nature === PAYMENT_NATURE.REAL_PAYMENT) {
        totalRealPayments += amount;
        const change = cashTendered && cashTendered > amount ? cashTendered - amount : 0;
        changeReturned += change;

        await tx.org_order_payments_dtl.create({
          data: {
            tenant_org_id:           tenantId,
            order_id:                orderId,
            org_payment_method_id:   opt.id,
            payment_method_code:     opt.paymentMethodCode,
            currency_code:           currencyCode,
            payment_nature_snapshot: 'REAL_PAYMENT',
            amount,
            payment_terminal_id:     terminalId ?? null,
            tendered_amount:         cashTendered ?? null,
            change_returned_amount:  change > 0 ? change : null,
            cash_drawer_session_id:  opt.requiresCashDrawer ? (cashDrawerSessionId ?? null) : null,
            payment_status:          'COMPLETED',
            is_active:               true,
            rec_status:              1,
            received_by:             settledBy ?? null,
          },
        });

      } else if (nature === PAYMENT_NATURE.CREDIT_APPLICATION) {
        const creditType = opt.creditApplicationType;
        const order = await tx.org_orders_mst.findFirstOrThrow({
          where: { id: orderId, tenant_org_id: tenantId },
          select: { customer_id: true },
        });
        const customerId = order.customer_id!;

        if (creditType === CREDIT_APPLICATION_TYPES.WALLET) {
          await redeemWalletTx(tx, { tenantId, customerId, amount, orderId });
        } else if (creditType === CREDIT_APPLICATION_TYPES.ADVANCE) {
          await redeemAdvanceTx(tx, { tenantId, customerId, amount, orderId });
        } else if (creditType === CREDIT_APPLICATION_TYPES.CREDIT_NOTE && creditReferenceId) {
          await redeemCreditNoteTx(tx, { tenantId, customerId, creditNoteId: creditReferenceId, amount, orderId });
        } else if (creditType === CREDIT_APPLICATION_TYPES.LOYALTY_POINTS) {
          const idempotencyKey = `loyalty-redeem-${orderId}-${Date.now()}`;
          const pointsToRedeem = Math.ceil(amount / (opt.minAmount ?? 1));
          await redeemPointsTx(tx, { tenantId, customerId, pointsToRedeem, monetaryAmount: amount, orderId, idempotencyKey });
        }

        await tx.org_order_credit_apps_dtl.create({
          data: {
            tenant_org_id:  tenantId,
            order_id:       orderId,
            currency_code:  currencyCode,
            credit_type:    creditType ?? 'GIFT_CARD',
            credit_source_id: creditReferenceId ?? null,
            applied_amount: amount,
            is_active:      true,
            rec_status:     1,
          },
        });

      } else if (nature === PAYMENT_NATURE.DEFERRED_SETTLEMENT) {
        isDeferred = true;
      }
      // AR_ALLOCATION and INTERNAL_ADJUSTMENT: no action in V1
    }

    // ── 6 & 7. Update order snapshot ─────────────────────────────────────────
    const grandTotal    = breakdown.grandTotal;
    const creditsTotal  = breakdown.creditsTotal;
    const netReceivable = breakdown.netReceivable;

    let paymentStatus: string;
    let outstanding:   number;

    if (isDeferred) {
      paymentStatus = ORDER_PAYMENT_STATUS.PENDING_COLLECTION;
      outstanding   = grandTotal;
    } else {
      outstanding   = Math.max(0, netReceivable - totalRealPayments - creditsTotal);
      paymentStatus = outstanding <= 0
        ? (changeReturned > 0 ? ORDER_PAYMENT_STATUS.OVERPAID : ORDER_PAYMENT_STATUS.PAID)
        : ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
    }

    await tx.org_orders_mst.update({
      where: { id: orderId, tenant_org_id: tenantId },
      data:  {
        total_paid_amount:          totalRealPayments + creditsTotal,
        total_discount_amount:      breakdown.discountTotal,
        total_tax_amount:           breakdown.taxTotal,
        outstanding_amount:         outstanding,
        change_returned_amount:     changeReturned > 0 ? changeReturned : null,
        payment_status:             paymentStatus,
        pay_on_collection_amount:   isDeferred ? grandTotal : null,
        updated_at:                 new Date(),
      },
    });

    // ── 8. Outbox events ──────────────────────────────────────────────────────
    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.ORDER_COMPLETED, 'order', orderId, {
      paymentStatus,
      grandTotal,
      settled: !isDeferred,
    });

    // Queue loyalty earn (async via outbox)
    const order = await tx.org_orders_mst.findFirst({
      where: { id: orderId },
      select: { customer_id: true },
    });
    if (order?.customer_id && !isDeferred) {
      await queueEarnPoints(tx, {
        tenantId,
        customerId:  order.customer_id,
        orderId,
        orderAmount: grandTotal,
      });
    }

    return {
      orderId,
      paymentStatus,
      totalPaid:      totalRealPayments + creditsTotal,
      outstanding,
      changeReturned,
    };
  });
}

// ── PAY_ON_COLLECTION — second-step collection ────────────────────────────────

export interface CollectPaymentParams {
  orderId:              string;
  tenantId:             string;
  paymentLegs:          Array<{
    paymentMethodId: string;
    amount:          number;
    reference?:      string;
    cashTendered?:   number;
  }>;
  cashDrawerSessionId?: string;
  collectedBy:          string;
}

/**
 * Collect actual payment on a PAY_ON_COLLECTION order.
 * Verifies order status, writes payment rows, updates snapshot.
 */
export async function collectPaymentTx(params: CollectPaymentParams): Promise<SettlementResult> {
  const { orderId, tenantId, paymentLegs, cashDrawerSessionId, collectedBy } = params;

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE
    const rows = await tx.$queryRaw<{ id: string; outstanding_amount: number; order_no: string; currency_code: string }[]>`
      SELECT id, outstanding_amount::float8, order_no, currency_code
      FROM org_orders_mst
      WHERE id = ${orderId}::uuid AND tenant_org_id = ${tenantId}::uuid
        AND payment_status = 'PENDING_COLLECTION'
      FOR UPDATE`;

    if (!rows[0]) throw new Error('Order not found or not in PENDING_COLLECTION status');

    const outstanding  = rows[0].outstanding_amount;
    const currencyCode = rows[0].currency_code ?? 'OMR';
    const totalCollected = paymentLegs.reduce((s, l) => s + l.amount, 0);
    if (totalCollected < outstanding) {
      throw new Error(`Collected amount (${totalCollected}) is less than outstanding (${outstanding})`);
    }

    let changeReturned = 0;

    for (const leg of paymentLegs) {
      const change = leg.cashTendered && leg.cashTendered > leg.amount ? leg.cashTendered - leg.amount : 0;
      changeReturned += change;

      // Look up payment method code from config
      const method = await tx.org_payment_methods_cf.findFirst({
        where: { id: leg.paymentMethodId, tenant_org_id: tenantId },
        select: { payment_method_code: true },
      });

      await tx.org_order_payments_dtl.create({
        data: {
          tenant_org_id:           tenantId,
          order_id:                orderId,
          org_payment_method_id:   leg.paymentMethodId,
          payment_method_code:     method?.payment_method_code ?? 'CASH',
          currency_code:           currencyCode,
          payment_nature_snapshot: 'REAL_PAYMENT',
          amount:                  leg.amount,
          tendered_amount:         leg.cashTendered ?? null,
          change_returned_amount:  change > 0 ? change : null,
          cash_drawer_session_id:  cashDrawerSessionId ?? null,
          payment_status:          'COMPLETED',
          is_active:               true,
          rec_status:              1,
          received_by:             collectedBy,
        },
      });
    }

    const paymentStatus = changeReturned > 0
      ? ORDER_PAYMENT_STATUS.OVERPAID
      : ORDER_PAYMENT_STATUS.PAID;

    await tx.org_orders_mst.update({
      where: { id: orderId },
      data:  {
        total_paid_amount:        totalCollected,
        outstanding_amount:       0,
        pay_on_collection_amount: 0,
        change_returned_amount:   changeReturned > 0 ? changeReturned : null,
        payment_status:           paymentStatus,
        updated_at:               new Date(),
      },
    });

    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.PAYMENT_RECEIVED, 'order', orderId, {
      collectedBy,
      totalCollected,
      paymentStatus,
    });

    return {
      orderId,
      paymentStatus,
      totalPaid:      totalCollected,
      outstanding:    0,
      changeReturned,
    };
  });
}
