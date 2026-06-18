import 'server-only';

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import {
  OVERPAYMENT_RESOLUTIONS,
  OVERPAYMENT_RESOLUTION_ERROR_CODES,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { issueAdvanceTx, issueCreditNoteTx, topUpWalletTx } from '@/lib/services/stored-value.service';
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';

type PrismaTransactionClient = Prisma.TransactionClient;

/**
 *
 */
export interface ExecuteOverpaymentDispositionParams {
  tx: PrismaTransactionClient;
  tenantId: string;
  userId: string;
  orderId: string;
  branchId?: string | null;
  customerId?: string | null;
  currencyCode: string;
  voucherId?: string | null;
  resolution: OverpaymentResolutionInput;
  idempotencyKey: string;
}

/**
 *
 */
export interface OverpaymentDispositionAuditRow {
  id: string;
  resolutionCode: string;
  amount: number;
  targetRef: string | null;
}

/**
 * Executes ADR-047 disposition lines inside the submit-order transaction.
 * Audit rows land in org_fin_overpay_disp_dtl; stored-value ledgers are authoritative balances.
 * @param params
 */
export async function executeOverpaymentDispositionTx(
  params: ExecuteOverpaymentDispositionParams
): Promise<OverpaymentDispositionAuditRow[]> {
  const {
    tx,
    tenantId,
    userId,
    orderId,
    branchId,
    customerId,
    currencyCode,
    voucherId,
    resolution,
    idempotencyKey,
  } = params;

  const results: OverpaymentDispositionAuditRow[] = [];

  for (const [lineIndex, line] of resolution.lines.entries()) {
    const lineIdempotencyKey = `${idempotencyKey}_op_${line.resolutionCode}_${lineIndex}`;

    const existing = await tx.$queryRaw<Array<{ id: string; target_ref: string | null }>>`
      SELECT id, target_ref
      FROM org_fin_overpay_disp_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND idempotency_key = ${lineIdempotencyKey}
        AND resolution_code = ${line.resolutionCode}
        AND is_active = true
      LIMIT 1`;

    if (existing[0]) {
      results.push({
        id: existing[0].id,
        resolutionCode: line.resolutionCode,
        amount: line.amount,
        targetRef: existing[0].target_ref,
      });
      continue;
    }

    let targetRef: string | null = null;

    if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE) {
      if (!customerId) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
      }
      const advanceTxn = await issueAdvanceTx(tx, {
        tenantId,
        customerId,
        amount: line.amount,
        notes: `Checkout overpayment → customer advance (order ${orderId})`,
        performedBy: userId,
        currencyCode,
      });
      targetRef = advanceTxn.id;
    } else if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT) {
      if (!customerId) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
      }
      const noteReason =
        'noteReason' in line && line.noteReason?.trim()
          ? line.noteReason.trim()
          : `Checkout overpayment credit (order ${orderId})`;
      const creditNote = await issueCreditNoteTx(tx, {
        tenantId,
        customerId,
        amount: line.amount,
        reason: noteReason,
        orderId,
        issuedBy: userId,
        currencyCode,
        idempotencyKey: `${lineIdempotencyKey}_cn`,
      });
      targetRef = creditNote.id;
    } else if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET) {
      if (!customerId) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
      }
      const walletTxn = await topUpWalletTx(tx, {
        tenantId,
        customerId,
        amount: line.amount,
        orderId,
        notes: `Checkout overpayment → customer wallet (order ${orderId})`,
        performedBy: userId,
        currencyCode,
      });
      targetRef = walletTxn.id;
    } else if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE) {
      // Cash change is posted on ORDER_PAYMENT voucher lines; audit only.
      targetRef = null;
    } else if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.REDUCE_PAYMENT) {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
    } else {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
    }

    const auditId = randomUUID();
    const cashLegRef =
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE &&
      'legRef' in line
        ? line.legRef
        : null;
    const noteReason =
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT &&
      'noteReason' in line
        ? line.noteReason ?? null
        : null;

    await tx.$executeRaw`
      INSERT INTO org_fin_overpay_disp_dtl (
        id,
        tenant_org_id,
        order_id,
        branch_id,
        voucher_id,
        resolution_code,
        amount,
        currency_code,
        target_ref,
        cash_leg_ref,
        note_reason,
        idempotency_key,
        created_by
      ) VALUES (
        ${auditId}::uuid,
        ${tenantId}::uuid,
        ${orderId}::uuid,
        ${branchId ?? null}::uuid,
        ${voucherId ?? null}::uuid,
        ${line.resolutionCode},
        ${line.amount},
        ${currencyCode},
        ${targetRef},
        ${cashLegRef},
        ${noteReason},
        ${lineIdempotencyKey},
        ${userId}
      )`;

    results.push({
      id: auditId,
      resolutionCode: line.resolutionCode,
      amount: line.amount,
      targetRef,
    });
  }

  const lineSum = resolution.lines.reduce((sum, line) => sum + line.amount, 0);
  if (Math.abs(lineSum - resolution.excessAmount) > SETTLEMENT_MONEY_EPSILON) {
    throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
  }

  return results;
}
