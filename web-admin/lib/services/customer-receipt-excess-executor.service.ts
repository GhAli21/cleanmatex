import 'server-only';

import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  OVERPAYMENT_RESOLUTIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';
import { getAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import { allocateB2bStatementPaymentTx } from '@/lib/services/b2b-statement-payment.service';
import { validateAllocationPreview } from '@/lib/services/customer-receipt-allocation-validator.service';
import { issueAdvanceTx, issueCreditNoteTx, topUpWalletTx } from '@/lib/services/stored-value.service';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
  type ReceiptAllocationLine,
} from '@/lib/types/customer-receipt-allocation';
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';

type PrismaTransactionClient = Prisma.TransactionClient;

/**
 *
 */
export interface ExecuteAllocationPreviewParams {
  tx: PrismaTransactionClient;
  tenantId: string;
  userId: string;
  customerId: string;
  sourceOrderId: string;
  currencyCode: string;
  voucherId?: string | null;
  previewId: string;
  idempotencyKey: string;
  paymentMethodCode?: string | null;
}

function findAllocationPreviewId(resolution: OverpaymentResolutionInput): string | null {
  for (const line of resolution.lines) {
    if (
      (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES ||
        line.resolutionCode === OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES) &&
      'allocationPreviewId' in line &&
      typeof line.allocationPreviewId === 'string'
    ) {
      return line.allocationPreviewId;
    }
  }
  if ('allocationPreviewId' in resolution && typeof resolution.allocationPreviewId === 'string') {
    return resolution.allocationPreviewId;
  }
  return null;
}

/**
 *
 * @param resolution
 */
export function extractAllocationPreviewId(
  resolution: OverpaymentResolutionInput
): string | null {
  return findAllocationPreviewId(resolution);
}

async function applyOrderAllocationTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    userId: string;
    targetOrderId: string;
    amount: number;
    currencyCode: string;
    sourceOrderId: string;
    voucherId?: string | null;
    paymentMethodCode?: string | null;
    idempotencyKey: string;
  }
): Promise<void> {
  const order = await tx.org_orders_mst.findFirst({
    where: { id: params.targetOrderId, tenant_org_id: params.tenantId },
    select: { id: true, outstanding_amount: true, total_paid_amount: true },
  });
  if (!order) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  const outstanding = Number(order.outstanding_amount ?? 0);
  if (params.amount - outstanding > SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  const methodCode = params.paymentMethodCode ?? 'CASH';
  const method = await tx.org_payment_methods_cf.findFirst({
    where: {
      tenant_org_id: params.tenantId,
      payment_method_code: methodCode,
      is_active: true,
      is_enabled: true,
    },
    select: { id: true },
  });

  await tx.org_order_payments_dtl.create({
    data: {
      tenant_org_id: params.tenantId,
      order_id: params.targetOrderId,
      org_payment_method_id: method?.id ?? null,
      payment_method_code: methodCode,
      currency_code: params.currencyCode,
      payment_nature_snapshot: 'REAL_PAYMENT',
      amount: params.amount,
      payment_status: 'COMPLETED',
      metadata: {
        overpayment_allocation: true,
        source_order_id: params.sourceOrderId,
        source_voucher_id: params.voucherId,
      },
      created_by: params.userId,
      updated_by: params.userId,
    },
  });

  const newPaid = Number(order.total_paid_amount ?? 0) + params.amount;
  const newOutstanding = Math.max(0, outstanding - params.amount);
  await tx.org_orders_mst.update({
    where: { id: params.targetOrderId },
    data: {
      total_paid_amount: newPaid,
      outstanding_amount: newOutstanding,
      updated_by: params.userId,
    },
  });
}

async function applyAllocationLineTx(
  tx: PrismaTransactionClient,
  line: ReceiptAllocationLine,
  params: ExecuteAllocationPreviewParams
): Promise<string | null> {
  const lineKey = `${params.idempotencyKey}_alloc_${line.lineRole}_${line.targetType}_${line.targetId}`;

  const existing = await tx.$queryRaw<Array<{ id: string; target_ref: string | null }>>`
    SELECT id, target_ref
    FROM org_fin_overpay_disp_dtl
    WHERE tenant_org_id = ${params.tenantId}::uuid
      AND idempotency_key = ${lineKey}
      AND is_active = true
    LIMIT 1
  `;
  if (existing[0]) return existing[0].target_ref;

  let targetRef: string | null = null;

  if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT &&
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE
  ) {
    const allocation = await allocateArPaymentTx(
      tx,
      line.targetId,
      {
        voucher_id: params.voucherId ?? undefined,
        allocated_amount: line.allocationAmount,
        notes: `Overpayment allocation from order ${params.sourceOrderId}`,
        idempotency_key: lineKey,
      },
      { tenantId: params.tenantId, userId: params.userId }
    );
    targetRef = allocation.id;
  } else if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.ORDER_PAYMENT &&
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER
  ) {
    await applyOrderAllocationTx(tx, {
      tenantId: params.tenantId,
      userId: params.userId,
      targetOrderId: line.targetId,
      amount: line.allocationAmount,
      currencyCode: params.currencyCode,
      sourceOrderId: params.sourceOrderId,
      voucherId: params.voucherId,
      paymentMethodCode: params.paymentMethodCode,
      idempotencyKey: lineKey,
    });
    targetRef = line.targetId;
  } else if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.CUSTOMER_ADVANCE_RECEIPT ||
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_ADVANCE
  ) {
    const advance = await issueAdvanceTx(tx, {
      tenantId: params.tenantId,
      customerId: params.customerId,
      amount: line.allocationAmount,
      notes: `Receipt allocation fallback advance (order ${params.sourceOrderId})`,
      performedBy: params.userId,
      currencyCode: params.currencyCode,
    });
    targetRef = advance.id;
  } else if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.CUSTOMER_CREDIT_ISSUE ||
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_CREDIT
  ) {
    const credit = await issueCreditNoteTx(tx, {
      tenantId: params.tenantId,
      customerId: params.customerId,
      amount: line.allocationAmount,
      reason: `Receipt allocation fallback credit (order ${params.sourceOrderId})`,
      orderId: params.sourceOrderId,
      issuedBy: params.userId,
      currencyCode: params.currencyCode,
      idempotencyKey: lineKey,
    });
    targetRef = credit.id;
  } else if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.WALLET_TOPUP ||
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.WALLET_TOPUP
  ) {
    const walletTxn = await topUpWalletTx(params.tx, {
      tenantId: params.tenantId,
      customerId: params.customerId,
      amount: line.allocationAmount,
      orderId: params.sourceOrderId,
      notes: `Receipt allocation wallet top-up (order ${params.sourceOrderId})`,
      performedBy: params.userId,
      currencyCode: params.currencyCode,
    });
    targetRef = walletTxn.id;
  } else if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.STATEMENT_PAYMENT &&
    line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT
  ) {
    const allocation = await allocateB2bStatementPaymentTx(params.tx, line.targetId, {
      tenantId: params.tenantId,
      userId: params.userId,
      amount: line.allocationAmount,
      idempotencyKey: lineKey,
      voucherId: params.voucherId,
      notes: `Overpayment allocation from order ${params.sourceOrderId}`,
    });
    targetRef = allocation.id;
  } else if (line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT) {
    targetRef = line.targetId;
  }

  const auditId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO org_fin_overpay_disp_dtl (
      id,
      tenant_org_id,
      order_id,
      voucher_id,
      resolution_code,
      amount,
      currency_code,
      target_ref,
      idempotency_key,
      created_by
    ) VALUES (
      ${auditId}::uuid,
      ${params.tenantId}::uuid,
      ${params.sourceOrderId}::uuid,
      ${params.voucherId ?? null}::uuid,
      ${OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES},
      ${line.allocationAmount},
      ${params.currencyCode},
      ${targetRef},
      ${lineKey},
      ${params.userId}
    )
  `;

  return targetRef;
}

/**
 * Executes a confirmed allocation preview inside submit-order transaction.
 * @param params
 */
export async function executeAllocationPreviewTx(
  params: ExecuteAllocationPreviewParams
): Promise<void> {
  const preview = await getAllocationPreview(params.tenantId, params.previewId);
  if (!preview) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.POLICY_MISSING);
  }
  if (preview.previewStatus === CUSTOMER_RECEIPT_PREVIEW_STATUSES.POSTED) {
    return;
  }
  if (preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED);
  }

  const { resolveReceiptAllocationPolicy } = await import(
    '@/lib/services/customer-receipt-allocation-policy.service'
  );
  const policy = await resolveReceiptAllocationPolicy({
    tenantId: params.tenantId,
    branchId: null,
  });
  validateAllocationPreview({
    tenantId: params.tenantId,
    customerId: params.customerId,
    currencyCode: params.currencyCode,
    preview,
    policy,
    requireConfirmed: true,
  });

  if (preview.remainingUnallocatedAmount > SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED);
  }

  for (const line of preview.allocations) {
    await applyAllocationLineTx(params.tx, line, params);
  }

  const { markAllocationPreviewPosted } = await import(
    '@/lib/services/customer-receipt-allocation-preview.service'
  );
  await markAllocationPreviewPosted(params.tx, params.tenantId, params.previewId, params.userId);
}

/**
 *
 * @param resolution
 */
export function resolutionIncludesAllocation(resolution: OverpaymentResolutionInput): boolean {
  return resolution.lines.some(
    (line) =>
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES ||
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES
  );
}

/**
 *
 * @param resolution
 */
export function getDispositionLinesExcludingAllocation(
  resolution: OverpaymentResolutionInput
): OverpaymentResolutionInput {
  const lines = resolution.lines.filter(
    (line) =>
      line.resolutionCode !== OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES &&
      line.resolutionCode !== OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES
  );
  return { excessAmount: resolution.excessAmount, lines };
}
