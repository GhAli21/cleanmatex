import 'server-only';

import {
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { loadCustomerOpenBalanceTargets } from '@/lib/services/customer-open-balance-query.service';
import {
  buildFallbackAllocationLine,
  type ReceiptAllocationPolicyRow,
  resolveReceiptAllocationPolicy,
} from '@/lib/services/customer-receipt-allocation-policy.service';
import type {
  OpenBalanceTarget,
  ReceiptAllocationLine,
  ReceiptAllocationPreviewResult,
} from '@/lib/types/customer-receipt-allocation';
import {
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
  RECEIPT_ALLOCATION_WARNING_CODES,
} from '@/lib/types/customer-receipt-allocation';
import type { ManualAllocationLineInput } from '@/lib/validations/customer-receipt-allocation-schema';

export interface AutoAllocateParams {
  tenantId: string;
  customerId: string;
  branchId?: string | null;
  currencyCode: string;
  excessAmount: number;
  receiptAmount: number;
  currentOrderAllocationAmount: number;
  sourceOrderId?: string | null;
  policyCode?: string | null;
}

function sortTargets(targets: OpenBalanceTarget[], mode: string): OpenBalanceTarget[] {
  const sorted = [...targets];
  sorted.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aDue = a.dueDate ?? '9999-12-31';
    const bDue = b.dueDate ?? '9999-12-31';
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    const aDoc = a.documentDate ?? '9999-12-31';
    const bDoc = b.documentDate ?? '9999-12-31';
    if (aDoc !== bDoc) return aDoc.localeCompare(bDoc);
    if (a.documentNo !== b.documentNo) return a.documentNo.localeCompare(b.documentNo);
    return a.targetId.localeCompare(b.targetId);
  });

  if (mode === 'AUTO_OLDEST_DOCUMENT') {
    sorted.sort((a, b) => {
      const aDoc = a.documentDate ?? '9999-12-31';
      const bDoc = b.documentDate ?? '9999-12-31';
      if (aDoc !== bDoc) return aDoc.localeCompare(bDoc);
      return a.documentNo.localeCompare(b.documentNo);
    });
  }

  return sorted;
}

function targetToAllocationLine(
  target: OpenBalanceTarget,
  allocationAmount: number
): ReceiptAllocationLine {
  return {
    lineRole: target.lineRole,
    targetType: target.targetType,
    targetId: target.targetId,
    documentNo: target.documentNo,
    dueDate: target.dueDate,
    outstandingAmount: target.outstandingAmount,
    allocationAmount,
    isPartial: allocationAmount < target.outstandingAmount - SETTLEMENT_MONEY_EPSILON,
  };
}

export function runAutoAllocationAlgorithm(
  excessAmount: number,
  targets: OpenBalanceTarget[],
  policy: ReceiptAllocationPolicyRow,
  customerId: string
): {
  allocations: ReceiptAllocationLine[];
  fallbackAllocation: ReceiptAllocationLine | null;
  remainingUnallocatedAmount: number;
  warnings: Array<{ code: string; message?: string }>;
  blocked: boolean;
} {
  let remaining = excessAmount;
  const allocations: ReceiptAllocationLine[] = [];
  const warnings: Array<{ code: string; message?: string }> = [];
  const sorted = sortTargets(targets, policy.allocation_mode).slice(
    0,
    policy.max_targets_per_allocation
  );

  for (const target of sorted) {
    if (remaining <= SETTLEMENT_MONEY_EPSILON) break;
    const allocAmount = Math.min(remaining, target.outstandingAmount);
    if (allocAmount <= SETTLEMENT_MONEY_EPSILON) continue;

    const isLastWithRemainder =
      sorted.indexOf(target) === sorted.length - 1 && allocAmount < target.outstandingAmount;
    if (isLastWithRemainder && !policy.allow_partial_last_target && remaining > target.outstandingAmount) {
      warnings.push({
        code: RECEIPT_ALLOCATION_WARNING_CODES.FALLBACK_REQUIRED,
        message: 'Partial last target not allowed by policy',
      });
      break;
    }

    allocations.push(targetToAllocationLine(target, allocAmount));
    remaining -= allocAmount;
  }

  let fallbackAllocation: ReceiptAllocationLine | null = null;
  if (remaining > SETTLEMENT_MONEY_EPSILON) {
    const fallback = buildFallbackAllocationLine(
      policy.fallback_destination,
      remaining,
      customerId
    );

    if (!fallback) {
      if (
        policy.fallback_destination ===
        CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.BLOCK_AND_REQUIRE_MANUAL_ACTION
      ) {
        warnings.push({
          code: RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED,
          message: 'Manual allocation required — policy blocks automatic fallback',
        });
        return {
          allocations,
          fallbackAllocation: null,
          remainingUnallocatedAmount: remaining,
          warnings,
          blocked: true,
        };
      }
      warnings.push({
        code: RECEIPT_ALLOCATION_WARNING_CODES.FALLBACK_REQUIRED,
      });
      return {
        allocations,
        fallbackAllocation: null,
        remainingUnallocatedAmount: remaining,
        warnings,
        blocked: false,
      };
    }

    fallbackAllocation = {
      lineRole: fallback.lineRole as ReceiptAllocationLine['lineRole'],
      targetType: fallback.targetType as ReceiptAllocationLine['targetType'],
      targetId: fallback.targetId,
      allocationAmount: fallback.allocationAmount,
      isPartial: false,
    };
    allocations.push(fallbackAllocation);
    remaining = 0;
  }

  return {
    allocations,
    fallbackAllocation,
    remainingUnallocatedAmount: Math.max(0, remaining),
    warnings,
    blocked: false,
  };
}

export async function autoAllocateCustomerReceipt(
  params: AutoAllocateParams
): Promise<Omit<ReceiptAllocationPreviewResult, 'previewId' | 'previewStatus'>> {
  const policy = await resolveReceiptAllocationPolicy({
    tenantId: params.tenantId,
    branchId: params.branchId,
    policyCode: params.policyCode,
  });

  const targets = await loadCustomerOpenBalanceTargets({
    tenantId: params.tenantId,
    customerId: params.customerId,
    currencyCode: params.currencyCode,
    policy,
    excludeOrderId: params.sourceOrderId,
    branchId: params.branchId,
  });

  const result = runAutoAllocationAlgorithm(
    params.excessAmount,
    targets,
    policy,
    params.customerId
  );

  return {
    policy: {
      policyId: policy.id,
      policyCode: policy.policy_code,
      allocationMode: policy.allocation_mode as ReceiptAllocationPreviewResult['policy']['allocationMode'],
      fallbackDestination:
        policy.fallback_destination as ReceiptAllocationPreviewResult['policy']['fallbackDestination'],
      requireConfirmationBeforePosting: policy.require_confirmation_before_posting,
      allowPartialLastTarget: policy.allow_partial_last_target,
      requireSameCurrency: policy.require_same_currency,
    },
    receiptAmount: params.receiptAmount,
    currentOrderAllocationAmount: params.currentOrderAllocationAmount,
    excessAmount: params.excessAmount,
    allocations: result.allocations,
    fallbackAllocation: result.fallbackAllocation,
    remainingUnallocatedAmount: result.remainingUnallocatedAmount,
    warnings: result.warnings.map((w) => ({
      code: w.code as ReceiptAllocationPreviewResult['warnings'][number]['code'],
      message: w.message,
    })),
  };
}

export async function manualAllocateCustomerReceipt(params: {
  tenantId: string;
  customerId: string;
  branchId?: string | null;
  currencyCode: string;
  excessAmount: number;
  receiptAmount: number;
  allocations: ManualAllocationLineInput[];
  sourceOrderId?: string | null;
}): Promise<Omit<ReceiptAllocationPreviewResult, 'previewId' | 'previewStatus'>> {
  const policy = await resolveReceiptAllocationPolicy({
    tenantId: params.tenantId,
    branchId: params.branchId,
  });

  const targets = await loadCustomerOpenBalanceTargets({
    tenantId: params.tenantId,
    customerId: params.customerId,
    currencyCode: params.currencyCode,
    policy,
    excludeOrderId: params.sourceOrderId,
    branchId: params.branchId,
  });

  const targetMap = new Map(targets.map((t) => [`${t.targetType}:${t.targetId}`, t]));
  const warnings: ReceiptAllocationPreviewResult['warnings'] = [];
  const allocations: ReceiptAllocationLine[] = [];
  let sum = 0;

  for (const line of params.allocations) {
    sum += line.amount;
    const key = `${line.targetType}:${line.targetId}`;
    const target = targetMap.get(key);

    if (
      line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER ||
      line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE ||
      line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT
    ) {
      if (!target) {
        warnings.push({ code: RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID });
        continue;
      }
      if (line.amount - target.outstandingAmount > SETTLEMENT_MONEY_EPSILON) {
        warnings.push({ code: RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID });
      }
      allocations.push({
        lineRole: line.lineRole as ReceiptAllocationLine['lineRole'],
        targetType: line.targetType as ReceiptAllocationLine['targetType'],
        targetId: line.targetId,
        documentNo: target.documentNo,
        dueDate: target.dueDate,
        outstandingAmount: target.outstandingAmount,
        allocationAmount: line.amount,
        isPartial: line.amount < target.outstandingAmount - SETTLEMENT_MONEY_EPSILON,
      });
    } else {
      allocations.push({
        lineRole: line.lineRole as ReceiptAllocationLine['lineRole'],
        targetType: line.targetType as ReceiptAllocationLine['targetType'],
        targetId: line.targetId,
        allocationAmount: line.amount,
        isPartial: false,
      });
    }
  }

  const remainingUnallocatedAmount = Math.max(0, params.excessAmount - sum);
  if (remainingUnallocatedAmount > SETTLEMENT_MONEY_EPSILON) {
    warnings.push({ code: RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED });
  }

  return {
    policy: {
      policyId: policy.id,
      policyCode: policy.policy_code,
      allocationMode: policy.allocation_mode as ReceiptAllocationPreviewResult['policy']['allocationMode'],
      fallbackDestination:
        policy.fallback_destination as ReceiptAllocationPreviewResult['policy']['fallbackDestination'],
      requireConfirmationBeforePosting: policy.require_confirmation_before_posting,
      allowPartialLastTarget: policy.allow_partial_last_target,
      requireSameCurrency: policy.require_same_currency,
    },
    receiptAmount: params.receiptAmount,
    currentOrderAllocationAmount: params.receiptAmount - params.excessAmount,
    excessAmount: params.excessAmount,
    allocations,
    fallbackAllocation: null,
    remainingUnallocatedAmount,
    warnings,
  };
}
