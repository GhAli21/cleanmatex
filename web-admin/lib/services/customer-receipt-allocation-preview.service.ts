import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
  type ReceiptAllocationPreviewResult,
} from '@/lib/types/customer-receipt-allocation';
import {
  autoAllocateCustomerReceipt,
  manualAllocateCustomerReceipt,
} from '@/lib/services/customer-receipt-allocation.service';
import type {
  PreviewAutoAllocationRequest,
  PreviewManualAllocationRequest,
} from '@/lib/validations/customer-receipt-allocation-schema';
import { requireCurrencyCode } from '@/lib/money/currency-resolution';

const PREVIEW_TTL_HOURS = 2;

function mapPreviewRow(row: {
  id: string;
  preview_status: string;
  receipt_amount: unknown;
  current_order_allocation_amount: unknown;
  excess_amount: unknown;
  amount_allocated: unknown;
  remaining_unallocated_amount: unknown;
  preview_payload: unknown;
  warning_payload: unknown;
  policy_id: string | null;
  currency_code?: string | null;
}): ReceiptAllocationPreviewResult {
  const payload = (row.preview_payload ?? {}) as Record<string, unknown>;
  return {
    previewId: row.id,
    currencyCode: row.currency_code?.trim() || undefined,
    previewStatus: row.preview_status as ReceiptAllocationPreviewResult['previewStatus'],
    policy: payload.policy as ReceiptAllocationPreviewResult['policy'],
    receiptAmount: Number(row.receipt_amount),
    currentOrderAllocationAmount: Number(row.current_order_allocation_amount),
    excessAmount: Number(row.excess_amount),
    allocations: (payload.allocations ?? []) as ReceiptAllocationPreviewResult['allocations'],
    fallbackAllocation: (payload.fallbackAllocation ?? null) as ReceiptAllocationPreviewResult['fallbackAllocation'],
    remainingUnallocatedAmount: Number(row.remaining_unallocated_amount),
    warnings: (row.warning_payload ?? []) as ReceiptAllocationPreviewResult['warnings'],
  };
}

/**
 *
 * @param tenantId
 * @param userId
 * @param input
 */
export async function createAutoAllocationPreview(
  tenantId: string,
  userId: string | null,
  input: PreviewAutoAllocationRequest
): Promise<ReceiptAllocationPreviewResult> {
  if (input.idempotencyKey) {
    const existing = await prisma.$queryRaw<
      Array<{ id: string; preview_status: string; receipt_amount: unknown; current_order_allocation_amount: unknown; excess_amount: unknown; amount_allocated: unknown; remaining_unallocated_amount: unknown; preview_payload: unknown; warning_payload: unknown; policy_id: string | null }>
    >`
      SELECT id, preview_status, receipt_amount, current_order_allocation_amount, excess_amount,
             amount_allocated, remaining_unallocated_amount, preview_payload, warning_payload, policy_id
      FROM org_fin_rcpt_alloc_preview_tr
      WHERE tenant_org_id = ${tenantId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existing[0]) return mapPreviewRow(existing[0]);
  }

  const computed = await autoAllocateCustomerReceipt({
    tenantId,
    customerId: input.customerId,
    branchId: input.branchId,
    currencyCode: input.currencyCode,
    excessAmount: input.excessAmount,
    receiptAmount: input.receiptAmount,
    currentOrderAllocationAmount: input.currentOrderAllocationAmount,
    sourceOrderId: input.sourceOrderId,
    policyCode: input.policyCode,
  });

  const amountAllocated = computed.allocations.reduce((s, a) => s + a.allocationAmount, 0);
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_HOURS * 60 * 60 * 1000);
  const previewPayload = {
    policy: computed.policy,
    allocations: computed.allocations,
    fallbackAllocation: computed.fallbackAllocation,
    sourceType: input.sourceType,
    paymentMethodCode: input.paymentMethodCode ?? null,
  };

  const inserted = await prisma.$queryRaw<
    Array<{ id: string; preview_status: string; receipt_amount: unknown; current_order_allocation_amount: unknown; excess_amount: unknown; amount_allocated: unknown; remaining_unallocated_amount: unknown; preview_payload: unknown; warning_payload: unknown; policy_id: string | null }>
  >`
    INSERT INTO org_fin_rcpt_alloc_preview_tr (
      tenant_org_id, branch_id, customer_id, source_type, source_order_id,
      policy_id, receipt_amount, current_order_allocation_amount, excess_amount,
      amount_allocated, remaining_unallocated_amount, currency_code,
      allocation_mode, fallback_destination, preview_status, preview_payload,
      warning_payload, idempotency_key, expires_at, created_by
    ) VALUES (
      ${tenantId}::uuid,
      ${input.branchId ?? null}::uuid,
      ${input.customerId}::uuid,
      ${input.sourceType},
      ${input.sourceOrderId ?? null}::uuid,
      ${computed.policy.policyId}::uuid,
      ${input.receiptAmount},
      ${input.currentOrderAllocationAmount},
      ${input.excessAmount},
      ${amountAllocated},
      ${computed.remainingUnallocatedAmount},
      ${input.currencyCode},
      ${computed.policy.allocationMode},
      ${computed.policy.fallbackDestination},
      ${CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT},
      ${JSON.stringify(previewPayload)}::jsonb,
      ${JSON.stringify(computed.warnings)}::jsonb,
      ${input.idempotencyKey ?? null},
      ${expiresAt},
      ${userId}
    )
    RETURNING id, preview_status, receipt_amount, current_order_allocation_amount, excess_amount,
              amount_allocated, remaining_unallocated_amount, preview_payload, warning_payload, policy_id
  `;

  return mapPreviewRow(inserted[0]);
}

/**
 *
 * @param tenantId
 * @param userId
 * @param input
 */
export async function createManualAllocationPreview(
  tenantId: string,
  userId: string | null,
  input: PreviewManualAllocationRequest
): Promise<ReceiptAllocationPreviewResult> {
  const computed = await manualAllocateCustomerReceipt({
    tenantId,
    customerId: input.customerId,
    branchId: input.branchId,
    currencyCode: input.currencyCode,
    excessAmount: input.excessAmount,
    receiptAmount: input.receiptAmount,
    allocations: input.allocations,
    sourceOrderId: input.sourceOrderId,
  });

  const amountAllocated = computed.allocations.reduce((s, a) => s + a.allocationAmount, 0);
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_HOURS * 60 * 60 * 1000);
  const previewPayload = {
    policy: computed.policy,
    allocations: computed.allocations,
    fallbackAllocation: computed.fallbackAllocation,
  };

  const inserted = await prisma.$queryRaw<
    Array<{ id: string; preview_status: string; receipt_amount: unknown; current_order_allocation_amount: unknown; excess_amount: unknown; amount_allocated: unknown; remaining_unallocated_amount: unknown; preview_payload: unknown; warning_payload: unknown; policy_id: string | null }>
  >`
    INSERT INTO org_fin_rcpt_alloc_preview_tr (
      tenant_org_id, branch_id, customer_id, source_type, source_order_id,
      policy_id, receipt_amount, current_order_allocation_amount, excess_amount,
      amount_allocated, remaining_unallocated_amount, currency_code,
      allocation_mode, fallback_destination, preview_status, preview_payload,
      warning_payload, idempotency_key, expires_at, created_by
    ) VALUES (
      ${tenantId}::uuid,
      ${input.branchId ?? null}::uuid,
      ${input.customerId}::uuid,
      'ORDER_PAYMENT_MODAL',
      ${input.sourceOrderId ?? null}::uuid,
      ${computed.policy.policyId}::uuid,
      ${input.receiptAmount},
      ${input.receiptAmount - input.excessAmount},
      ${input.excessAmount},
      ${amountAllocated},
      ${computed.remainingUnallocatedAmount},
      ${input.currencyCode},
      ${computed.policy.allocationMode},
      ${computed.policy.fallbackDestination},
      ${CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT},
      ${JSON.stringify(previewPayload)}::jsonb,
      ${JSON.stringify(computed.warnings)}::jsonb,
      ${input.idempotencyKey ?? null},
      ${expiresAt},
      ${userId}
    )
    RETURNING id, preview_status, receipt_amount, current_order_allocation_amount, excess_amount,
              amount_allocated, remaining_unallocated_amount, preview_payload, warning_payload, policy_id
  `;

  return mapPreviewRow(inserted[0]);
}

/**
 *
 * @param tenantId
 * @param previewId
 * @param customerId
 * @param userId
 */
export async function confirmAllocationPreview(
  tenantId: string,
  previewId: string,
  customerId: string,
  userId: string | null
): Promise<ReceiptAllocationPreviewResult> {
  const preview = await getAllocationPreview(tenantId, previewId);
  if (!preview) {
    throw new Error('Preview not found');
  }
  if (preview.excessAmount && preview.remainingUnallocatedAmount > 0.001) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED);
  }

  const { resolveReceiptAllocationPolicy } = await import(
    '@/lib/services/customer-receipt-allocation-policy.service'
  );
  const { validateAllocationPreview } = await import(
    '@/lib/services/customer-receipt-allocation-validator.service'
  );
  const policy = await resolveReceiptAllocationPolicy({ tenantId, branchId: null });
  validateAllocationPreview({
    tenantId,
    customerId,
    // B15: the preview row's persisted currency governs — never a default.
    currencyCode: requireCurrencyCode(preview.currencyCode, `receipt allocation preview ${previewId}`),
    preview,
    policy,
    requireConfirmed: false,
  });

  await prisma.$executeRaw`
    UPDATE org_fin_rcpt_alloc_preview_tr
    SET preview_status = ${CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED},
        updated_at = NOW(),
        updated_by = ${userId}
    WHERE id = ${previewId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
      AND customer_id = ${customerId}::uuid
      AND preview_status IN (${CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT}, ${CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED})
  `;

  return (await getAllocationPreview(tenantId, previewId))!;
}

/**
 *
 * @param tenantId
 * @param previewId
 */
export async function getAllocationPreview(
  tenantId: string,
  previewId: string
): Promise<ReceiptAllocationPreviewResult | null> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; customer_id: string; preview_status: string; receipt_amount: unknown; current_order_allocation_amount: unknown; excess_amount: unknown; amount_allocated: unknown; remaining_unallocated_amount: unknown; preview_payload: unknown; warning_payload: unknown; policy_id: string | null; currency_code: string | null }>
  >`
    SELECT id, customer_id, preview_status, receipt_amount, current_order_allocation_amount, excess_amount,
           amount_allocated, remaining_unallocated_amount, preview_payload, warning_payload, policy_id, currency_code
    FROM org_fin_rcpt_alloc_preview_tr
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id = ${previewId}::uuid
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return mapPreviewRow(rows[0]);
}

/**
 *
 * @param tx
 * @param tx.$executeRaw
 * @param tenantId
 * @param previewId
 * @param userId
 */
export async function markAllocationPreviewPosted(
  tx: { $executeRaw: typeof prisma.$executeRaw },
  tenantId: string,
  previewId: string,
  userId: string | null
): Promise<void> {
  await tx.$executeRaw`
    UPDATE org_fin_rcpt_alloc_preview_tr
    SET preview_status = ${CUSTOMER_RECEIPT_PREVIEW_STATUSES.POSTED},
        updated_at = NOW(),
        updated_by = ${userId}
    WHERE id = ${previewId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
  `;
}
