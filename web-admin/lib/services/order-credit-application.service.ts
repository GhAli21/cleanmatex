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
import { requireCurrencyCode } from '@/lib/money/currency-resolution';

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

/**
 * Result returned after a successful order credit application write.
 */
export interface ApplyOrderCreditResult {
  orderId: string;
  paymentStatus: string;
  totalPaid: number;
  outstanding: number;
  creditApplicationId: string;
}

/**
 * Debit the originating stored-value ledger and persist the order credit fact.
 *
 * Why:
 * The stored-value source of truth must move in the same transaction as the
 * order-level credit application row to avoid balance drift.
 *
 * @param tx active Prisma transaction client
 * @param params stored-value debit payload scoped to one order mutation
 * @param params.tenantId tenant owning the order and stored-value source
 * @param params.orderId order receiving the credit application
 * @param params.customerId customer whose stored value is being debited
 * @param params.creditType stored-value source type being applied
 * @param params.amount applied monetary amount
 * @param params.creditReferenceId optional source document or card identifier
 * @param params.appliedBy user performing the debit
 * @param params.currencyCode currency used for the order mutation
 * @param params.idempotencyKey optional idempotency guard
 * @param params.referenceNo optional human-readable reference to persist
 * @returns created order credit application row
 */
/**
 * Per-type dispatcher for stored-value debits.
 *
 * Phase 2 (BVM Wiring): the orchestrator calls this for each credit-application
 * leg of submit-order, passing the just-created voucher line so the ledger row
 * stores fin_voucher_id + fin_voucher_trx_line_id (back-link FK from migration
 * 0329). Existing callers (post-order credit application) can omit
 * voucherId/voucherLineId and behavior is unchanged.
 * @param tx
 * @param params
 * @param params.tenantId
 * @param params.orderId
 * @param params.customerId
 * @param params.creditType
 * @param params.amount
 * @param params.creditReferenceId
 * @param params.appliedBy
 * @param params.currencyCode
 * @param params.idempotencyKey
 * @param params.referenceNo
 * @param params.voucherId
 * @param params.voucherLineId
 * @param params.skipCreditAppRow
 */
export async function applyStoredValueDebitTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    customerId: string;
    creditType: string;
    amount: number;
    creditReferenceId?: string;
    appliedBy: string;
    currencyCode: string;
    idempotencyKey?: string;
    referenceNo?: string;
    /** Phase 2: voucher header id to record on the ledger row. */
    voucherId?: string;
    /** Phase 2: voucher line id to record on the ledger row. */
    voucherLineId?: string;
    /**
     * submit-order + BVM wiring: debit stored value only; the wiring handler
     * persists `org_order_credit_apps_dtl` during postAndWire (avoids duplicate
     * rows on the same `fin_voucher_trx_line_id` unique index).
     */
    skipCreditAppRow?: boolean;
  }
) {
  const {
    tenantId,
    orderId,
    customerId,
    creditType,
    amount,
    creditReferenceId,
    appliedBy,
    currencyCode,
    idempotencyKey,
    referenceNo,
    voucherId,
    voucherLineId,
    skipCreditAppRow,
  } = params;

  if (creditType === CREDIT_APPLICATION_TYPES.WALLET) {
    await redeemWalletTx(tx, {
      tenantId,
      customerId,
      amount,
      orderId,
      idempotencyKey,
      voucherId,
      voucherLineId,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE) {
    await redeemAdvanceTx(tx, {
      tenantId,
      customerId,
      amount,
      orderId,
      idempotencyKey,
      voucherId,
      voucherLineId,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT) {
    if (!creditReferenceId) {
      throw new Error('Credit note applications require creditReferenceId');
    }
    await redeemCreditNoteTx(tx, {
      tenantId,
      customerId,
      creditNoteId: creditReferenceId,
      amount,
      orderId,
      idempotencyKey,
      voucherId,
      voucherLineId,
    });
  } else if (creditType === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT) {
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
      // Phase 2 (Fix A pattern): when caller supplies a deterministic key (e.g.
      // orchestrator's `${orderId}_sv_lp_${legIndex}`) reuse it so replays
      // collapse onto the existing ledger row. Date.now() fallback is kept for
      // legacy callers that don't pass a key.
      idempotencyKey: idempotencyKey ?? `loyalty-credit-${orderId}-${Date.now()}`,
      voucherId,
      voucherLineId,
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
      voucherId,
      voucherLineId,
    });
  } else {
    throw new Error(`Unsupported credit application type: ${creditType}`);
  }

  if (skipCreditAppRow) {
    return undefined;
  }

  return tx.org_order_credit_apps_dtl.create({
    data: {
      tenant_org_id:           tenantId,
      order_id:                orderId,
      credit_type:             creditType,
      application_status:      'APPLIED',
      credit_source_id:        creditReferenceId ?? null,
      applied_amount:          amount,
      currency_code:           currencyCode,
      reference_no:            referenceNo ?? null,
      applied_by:              appliedBy,
      idempotency_key:         idempotencyKey ?? null,
      // Phase 2: voucher backlink on the order_credit_apps_dtl row too
      // (col + FK already existed before migration 0329; this fills it).
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      is_active:               true,
      rec_status:              1,
    },
  });
}

/**
 * Apply stored value to an existing order under tenant scope.
 *
 * @param params tenant-scoped credit application payload
 * @returns normalized snapshot outcome after the credit application
 * @example
 * await applyOrderCreditApplication({
 *   orderId: 'order-123',
 *   tenantId: 'org-123',
 *   paymentMethodId: 'method-123',
 *   amount: 10,
 *   appliedBy: 'user-123',
 * });
 */
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
      appliedBy,
      currencyCode: requireCurrencyCode(order.currency_code, `credit application on order ${orderId}`),
      idempotencyKey,
      referenceNo: reference,
    });

    if (!creditApp) {
      throw new Error('Credit application row was not created');
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

/**
 * Read the customer's currently available stored value for Order Fin use.
 *
 * @param tenantId tenant owning the stored-value records
 * @param customerId customer whose balances should be summarized
 * @returns wallet, advance, credit-note, and loyalty availability snapshot
 * @example
 * await getAvailableStoredValueSummary('org-123', 'customer-123');
 */
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
