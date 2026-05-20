import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  CREDIT_APPLICATION_TYPES,
  OUTBOX_EVENT_TYPES,
  PAYMENT_NATURE,
} from '@/lib/constants/order-financial';
import { redeemGiftCardTx } from '@/lib/services/gift-card-service';
import { getLoyaltyConfig, redeemPointsTx } from '@/lib/services/loyalty.service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import {
  getAdvanceBalance,
  getCreditNotes,
  getWalletBalance,
  redeemAdvanceTx,
  redeemCreditNoteTx,
  redeemWalletTx,
} from '@/lib/services/stored-value.service';
import { emitEventTx } from '@/lib/services/outbox.service';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

/**
 * Why:
 * Existing order credit application needs the same atomic guarantees as order
 * settlement. This service keeps stored-value debits, order fact writes, and
 * snapshot recalculation inside one transaction.
 */
export interface ApplyOrderCreditParams {
  orderId: string;
  tenantId: string;
  paymentMethodId: string;
  amount: number;
  appliedBy: string;
  creditReferenceId?: string;
  reference?: string;
  idempotencyKey?: string;
}

export interface ApplyOrderCreditResult {
  orderId: string;
  paymentStatus: string;
  totalPaid: number;
  outstanding: number;
  creditApplicationId: string;
}

async function applyStoredValueDebitTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    customerId: string;
    creditType: string;
    amount: number;
    creditReferenceId?: string;
    paymentMethodId: string;
    appliedBy: string;
    currencyCode: string;
    idempotencyKey?: string;
  }
) {
  const {
    tenantId,
    orderId,
    customerId,
    creditType,
    amount,
    creditReferenceId,
    paymentMethodId,
    appliedBy,
    currencyCode,
    idempotencyKey,
  } = params;

  if (creditType === CREDIT_APPLICATION_TYPES.WALLET) {
    await redeemWalletTx(tx, {
      tenantId,
      customerId,
      amount,
      orderId,
      idempotencyKey,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.ADVANCE) {
    await redeemAdvanceTx(tx, {
      tenantId,
      customerId,
      amount,
      orderId,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.CREDIT_NOTE) {
    if (!creditReferenceId) {
      throw new Error('Credit note applications require creditReferenceId');
    }
    await redeemCreditNoteTx(tx, {
      tenantId,
      customerId,
      creditNoteId: creditReferenceId,
      amount,
      orderId,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.LOYALTY_POINTS) {
    const loyaltyConfig = await getLoyaltyConfig(tenantId);
    const redeemRate = toNumber(loyaltyConfig?.redeem_rate_per_point);
    if (!loyaltyConfig || redeemRate <= 0) {
      throw new Error('Loyalty redemption is not configured for this tenant');
    }
    const pointsToRedeem = Math.ceil(amount / redeemRate);
    await redeemPointsTx(tx, {
      tenantId,
      customerId,
      pointsToRedeem,
      monetaryAmount: amount,
      orderId,
      idempotencyKey: idempotencyKey ?? `loyalty-credit-${orderId}-${Date.now()}`,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.GIFT_CARD) {
    if (!creditReferenceId) {
      throw new Error('Gift card applications require creditReferenceId');
    }
    await redeemGiftCardTx(tx, {
      giftCardId: creditReferenceId,
      amount,
      orderId,
      processedBy: appliedBy,
      tenantOrgId: tenantId,
      idempotencyKey,
      invoiceCurrency: currencyCode,
    });
  } else {
    throw new Error(`Unsupported credit application type: ${creditType}`);
  }

  return tx.org_order_credit_apps_dtl.create({
    data: {
      tenant_org_id: tenantId,
      order_id: orderId,
      credit_type: creditType,
      credit_source_id: creditReferenceId ?? null,
      applied_amount: amount,
      currency_code: currencyCode,
      reference_no: paymentMethodId,
      applied_by: appliedBy,
      idempotency_key: idempotencyKey ?? null,
      is_active: true,
      rec_status: 1,
    },
  });
}

export async function applyOrderCreditApplication(
  params: ApplyOrderCreditParams
): Promise<ApplyOrderCreditResult> {
  const { orderId, tenantId, paymentMethodId, amount, appliedBy, creditReferenceId, reference, idempotencyKey } = params;

  if (amount <= 0) {
    throw new Error('Credit application amount must be greater than zero');
  }

  return prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.org_order_credit_apps_dtl.findFirst({
        where: {
          tenant_org_id: tenantId,
          idempotency_key: idempotencyKey,
        },
        select: { id: true, order_id: true },
      });

      if (existing) {
        const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, existing.order_id);
        return {
          orderId: existing.order_id,
          paymentStatus: snapshot.paymentStatus,
          totalPaid: snapshot.totalPaidAmount + snapshot.totalCreditAppliedAmount,
          outstanding: snapshot.outstandingAmount,
          creditApplicationId: existing.id,
        };
      }
    }

    const order = await tx.org_orders_mst.findFirstOrThrow({
      where: { id: orderId, tenant_org_id: tenantId },
      select: {
        id: true,
        order_no: true,
        customer_id: true,
        currency_code: true,
        outstanding_amount: true,
      },
    });

    const outstandingAmount = toNumber(order.outstanding_amount);
    if (outstandingAmount <= 0) {
      throw new Error('This order has no outstanding balance to offset');
    }
    if (amount > outstandingAmount) {
      throw new Error(`Credit application amount (${amount}) exceeds outstanding balance (${outstandingAmount})`);
    }

    const method = await tx.org_payment_methods_cf.findFirstOrThrow({
      where: {
        tenant_org_id: tenantId,
        id: paymentMethodId,
        is_active: true,
        is_enabled: true,
        is_platform_disabled: false,
      },
      select: {
        id: true,
        payment_method_code: true,
        payment_nature: true,
        credit_application_type: true,
      },
    });

    if (method.payment_nature !== PAYMENT_NATURE.CREDIT_APPLICATION) {
      throw new Error('Selected payment method is not a credit application method');
    }

    if (!order.customer_id) {
      throw new Error('Order has no customer linked for stored-value application');
    }

    const creditType = method.credit_application_type ?? CREDIT_APPLICATION_TYPES.GIFT_CARD;
    const creditApp = await applyStoredValueDebitTx(tx, {
      tenantId,
      orderId,
      customerId: order.customer_id,
      creditType,
      amount,
      creditReferenceId,
      paymentMethodId,
      appliedBy,
      currencyCode: order.currency_code ?? 'OMR',
      idempotencyKey,
    });

    if (reference) {
      await tx.org_order_credit_apps_dtl.update({
        where: { id: creditApp.id },
        data: { reference_no: reference },
      });
    }

    const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

    await emitEventTx(
      tx,
      tenantId,
      OUTBOX_EVENT_TYPES.STORED_VALUE_CHANGED,
      'order',
      orderId,
      {
        stage: 'APPLIED',
        orderId,
        orderNo: order.order_no,
        creditApplicationId: creditApp.id,
        creditType,
        amount,
        paymentStatus: snapshot.paymentStatus,
        outstandingAmount: snapshot.outstandingAmount,
      }
    );

    return {
      orderId,
      paymentStatus: snapshot.paymentStatus,
      totalPaid: snapshot.totalPaidAmount + snapshot.totalCreditAppliedAmount,
      outstanding: snapshot.outstandingAmount,
      creditApplicationId: creditApp.id,
    };
  });
}

export async function getAvailableStoredValueSummary(
  tenantId: string,
  customerId: string
) {
  const [wallet, advance, creditNotes, loyaltyConfig] = await Promise.all([
    getWalletBalance(tenantId, customerId),
    getAdvanceBalance(tenantId, customerId),
    getCreditNotes(tenantId, customerId),
    getLoyaltyConfig(tenantId),
  ]);

  const creditNoteTotal = creditNotes.reduce(
    (sum, creditNote) => sum + toNumber(creditNote.remaining_balance),
    0
  );

  return {
    wallet,
    advance,
    creditNotes,
    creditNoteTotal,
    loyaltyRedeemRatePerPoint: toNumber(loyaltyConfig?.redeem_rate_per_point),
  };
}
