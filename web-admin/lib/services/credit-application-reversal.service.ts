import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  CREDIT_APPLICATION_STATUSES,
  CREDIT_APPLICATION_TYPES,
  LOYALTY_TXN_TYPES,
} from '@/lib/constants/order-financial';
import { refundGiftCardTx } from '@/lib/services/gift-card-service';
import {
  topUpWalletTx,
  issueAdvanceTx,
  issueCreditNoteTx,
} from '@/lib/services/stored-value.service';
import { adjustPointsTx } from '@/lib/services/loyalty.service';

/** Prisma interactive-transaction client used by every financial unwind. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const MONEY_EPSILON = 0.001;

/**
 * Trigger-agnostic credit-application reverse (D006).
 * Callers (voucher unwind, leftover cancel helper, future refund/amendment)
 * supply lineage via idempotencyPrefix — never hard-code cancel.
 */
export interface ReverseCreditApplicationInput {
  tenantId: string;
  orderId: string;
  userId: string;
  reason: string;
  /** Distinguishes cancel vs voucher unwind vs refund restore in ledger keys. */
  idempotencyPrefix: string;
  updatedInfo: string;
}

export interface ReverseCreditApplicationResult {
  restoredAmount: number;
  status: string;
}

/**
 * Reverse one APPLIED credit application back to its source ledger.
 * Compare-and-set on application_status so retries never double-restore.
 * Loyalty restore is automatic; if it cannot complete the row becomes
 * LOYALTY_RESTORE_PENDING instead of a silent warning.
 */
export async function reverseCreditApplicationTx(
  tx: PrismaTransactionClient,
  input: ReverseCreditApplicationInput,
  app: {
    id: string;
    credit_type: string;
    credit_source_id: string | null;
    applied_amount: unknown;
    currency_code: string;
    fin_voucher_trx_line_id?: string | null;
  },
  customerId: string | null,
  warnings: string[],
): Promise<ReverseCreditApplicationResult> {
  const amount = Number(app.applied_amount ?? 0);
  const restoreKey = `${input.idempotencyPrefix}-ca-${app.id}`;
  const restoreNote = `${input.reason} — restored from credit application ${app.id}`.slice(0, 500);

  if (app.credit_type === CREDIT_APPLICATION_TYPES.LOYALTY_POINTS) {
    return restoreLoyaltyOrPend(tx, input, app, customerId, amount, restoreKey, restoreNote, warnings);
  }

  const flipped = await casApplicationStatus(
    tx,
    input,
    app.id,
    CREDIT_APPLICATION_STATUSES.APPLIED,
    CREDIT_APPLICATION_STATUSES.REVERSED,
  );
  if (flipped === 0) {
    return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
  }

  switch (app.credit_type) {
    case CREDIT_APPLICATION_TYPES.GIFT_CARD: {
      if (!app.credit_source_id) {
        warnings.push(`Gift-card credit application ${app.id} has no source card — restore manually.`);
        return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
      }
      const { actualRefundAmount } = await refundGiftCardTx(tx, {
        giftCardId: app.credit_source_id,
        amount,
        orderId: input.orderId,
        invoiceId: '',
        reason: restoreNote,
        processedBy: input.userId,
        tenantOrgId: input.tenantId,
        idempotencyKey: restoreKey,
      });
      if (actualRefundAmount < amount - MONEY_EPSILON) {
        warnings.push(
          `Gift card ${app.credit_source_id}: restored ${actualRefundAmount} of ${amount} (capped at original amount).`,
        );
      }
      return { restoredAmount: actualRefundAmount, status: CREDIT_APPLICATION_STATUSES.REVERSED };
    }
    case CREDIT_APPLICATION_TYPES.WALLET: {
      if (!customerId) {
        warnings.push(`Wallet credit application ${app.id}: order has no customer — restore manually.`);
        return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
      }
      await topUpWalletTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        orderId: input.orderId,
        notes: restoreNote,
        performedBy: input.userId,
        currencyCode: app.currency_code,
        idempotencyKey: restoreKey,
      });
      return { restoredAmount: amount, status: CREDIT_APPLICATION_STATUSES.REVERSED };
    }
    case CREDIT_APPLICATION_TYPES.ADVANCE: {
      if (!customerId) {
        warnings.push(`Advance credit application ${app.id}: order has no customer — restore manually.`);
        return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
      }
      await issueAdvanceTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        notes: restoreNote,
        performedBy: input.userId,
        currencyCode: app.currency_code,
        idempotencyKey: restoreKey,
      });
      return { restoredAmount: amount, status: CREDIT_APPLICATION_STATUSES.REVERSED };
    }
    case CREDIT_APPLICATION_TYPES.CREDIT_NOTE: {
      if (!customerId) {
        warnings.push(`Credit-note application ${app.id}: order has no customer — restore manually.`);
        return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
      }
      await issueCreditNoteTx(tx, {
        tenantId: input.tenantId,
        customerId,
        amount,
        reason: restoreNote,
        orderId: input.orderId,
        issuedBy: input.userId,
        currencyCode: app.currency_code,
        idempotencyKey: restoreKey,
      });
      return { restoredAmount: amount, status: CREDIT_APPLICATION_STATUSES.REVERSED };
    }
    default: {
      warnings.push(
        `Credit application ${app.id} (${app.credit_type}, ${amount}) marked REVERSED but requires manual restore.`,
      );
      return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.REVERSED };
    }
  }
}

async function restoreLoyaltyOrPend(
  tx: PrismaTransactionClient,
  input: ReverseCreditApplicationInput,
  app: { id: string; fin_voucher_trx_line_id?: string | null },
  customerId: string | null,
  amount: number,
  restoreKey: string,
  restoreNote: string,
  warnings: string[],
): Promise<ReverseCreditApplicationResult> {
  const points = await resolveLoyaltyPointsToRestore(tx, input, app);
  if (!customerId || points == null || points <= 0) {
    await casApplicationStatus(
      tx,
      input,
      app.id,
      CREDIT_APPLICATION_STATUSES.APPLIED,
      CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING,
    );
    warnings.push(
      `Credit application ${app.id} (LOYALTY_POINTS, ${amount}) is LOYALTY_RESTORE_PENDING — points could not be restored automatically.`,
    );
    return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING };
  }

  try {
    await adjustPointsTx(tx, {
      tenantId: input.tenantId,
      customerId,
      delta: points,
      notes: restoreNote,
      adjustedBy: input.userId,
      idempotencyKey: restoreKey,
    });
  } catch {
    await casApplicationStatus(
      tx,
      input,
      app.id,
      CREDIT_APPLICATION_STATUSES.APPLIED,
      CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING,
    );
    warnings.push(
      `Credit application ${app.id} (LOYALTY_POINTS, ${amount}) is LOYALTY_RESTORE_PENDING — loyalty restore failed.`,
    );
    return { restoredAmount: 0, status: CREDIT_APPLICATION_STATUSES.LOYALTY_RESTORE_PENDING };
  }

  await casApplicationStatus(
    tx,
    input,
    app.id,
    CREDIT_APPLICATION_STATUSES.APPLIED,
    CREDIT_APPLICATION_STATUSES.REVERSED,
  );
  return { restoredAmount: amount, status: CREDIT_APPLICATION_STATUSES.REVERSED };
}

async function resolveLoyaltyPointsToRestore(
  tx: PrismaTransactionClient,
  input: ReverseCreditApplicationInput,
  app: { id: string; fin_voucher_trx_line_id?: string | null },
): Promise<number | null> {
  const byLine = app.fin_voucher_trx_line_id
    ? await tx.org_loyalty_txn_dtl.findFirst({
        where: {
          tenant_org_id: input.tenantId,
          fin_voucher_trx_line_id: app.fin_voucher_trx_line_id,
          txn_type: LOYALTY_TXN_TYPES.REDEEM,
        },
        select: { points: true },
      })
    : null;
  if (byLine) return Math.abs(Number(byLine.points ?? 0));

  const byOrder = await tx.org_loyalty_txn_dtl.findFirst({
    where: {
      tenant_org_id: input.tenantId,
      order_id: input.orderId,
      txn_type: LOYALTY_TXN_TYPES.REDEEM,
    },
    orderBy: { created_at: 'desc' },
    select: { points: true },
  });
  if (!byOrder) return null;
  return Math.abs(Number(byOrder.points ?? 0));
}

async function casApplicationStatus(
  tx: PrismaTransactionClient,
  input: ReverseCreditApplicationInput,
  applicationId: string,
  fromStatus: string,
  toStatus: string,
): Promise<number> {
  const flipped = await tx.org_order_credit_apps_dtl.updateMany({
    where: {
      id: applicationId,
      tenant_org_id: input.tenantId,
      application_status: fromStatus,
    },
    data: {
      application_status: toStatus,
      updated_at: new Date(),
      updated_by: input.userId,
      updated_info: input.updatedInfo.slice(0, 500),
    },
  });
  return flipped.count;
}
