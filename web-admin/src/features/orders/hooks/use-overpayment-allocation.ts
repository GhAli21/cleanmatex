'use client';

import { useCallback, useState } from 'react';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { showErrorToast, showSuccessToast } from '@ui/components/cmx-toast';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type {
  OpenBalanceTarget,
  ReceiptAllocationPreviewResult,
} from '@/lib/types/customer-receipt-allocation';
import type { ExtraReceiptHandlingMode } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';

export type OverpaymentAllocationSourceType =
  | 'ORDER_PAYMENT_MODAL'
  | 'LATER_COLLECTION'
  | 'CUSTOMER_RECEIPT';

export interface UseOverpaymentAllocationParams {
  customerId?: string | null;
  branchId?: string | null;
  currencyCode: string;
  excessAmount: number;
  receiptAmount: number;
  currentOrderAllocationAmount: number;
  sourceType: OverpaymentAllocationSourceType;
  sourceOrderId?: string | null;
  paymentMethodCode?: string;
  moneyEpsilon?: number;
  confirmedToastMessage?: string;
  remainingUnallocatedErrorMessage?: string;
}

export function useOverpaymentAllocation({
  customerId,
  branchId,
  currencyCode,
  excessAmount,
  receiptAmount,
  currentOrderAllocationAmount,
  sourceType,
  sourceOrderId,
  paymentMethodCode = 'CASH',
  moneyEpsilon = 0.001,
  confirmedToastMessage = 'Allocation confirmed',
  remainingUnallocatedErrorMessage = 'Remaining unallocated amount must be zero',
}: UseOverpaymentAllocationParams) {
  const { token: csrfToken } = useCSRFToken();
  const [extraReceiptMode, setExtraReceiptMode] = useState<ExtraReceiptHandlingMode>('adjust_legs');
  const [allocationPreviewId, setAllocationPreviewId] = useState<string | null>(null);
  const [allocationPreview, setAllocationPreview] = useState<ReceiptAllocationPreviewResult | null>(null);
  const [openBalanceTargets, setOpenBalanceTargets] = useState<OpenBalanceTarget[]>([]);
  const [autoDrawerOpen, setAutoDrawerOpen] = useState(false);
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [openBalancesLoading, setOpenBalancesLoading] = useState(false);

  const resetAllocationState = useCallback(() => {
    setAllocationPreviewId(null);
    setAllocationPreview(null);
  }, []);

  const handleOpenAutoAllocate = useCallback(async () => {
    if (!customerId?.trim()) return;
    setAutoDrawerOpen(true);
    setPreviewLoading(true);
    resetAllocationState();
    try {
      const res = await fetch('/api/v1/customer-receipts/allocation/preview-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({
          customerId,
          branchId: branchId || undefined,
          sourceType,
          sourceOrderId: sourceOrderId || undefined,
          receiptAmount,
          currentOrderAllocationAmount,
          excessAmount,
          currencyCode,
          paymentMethodCode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to preview allocation');
      }
      setAllocationPreview(json.data as ReceiptAllocationPreviewResult);
    } catch (error) {
      setAllocationPreview(null);
      showErrorToast(error instanceof Error ? error.message : 'Failed to preview allocation');
      setAutoDrawerOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [
    branchId,
    csrfToken,
    currencyCode,
    currentOrderAllocationAmount,
    customerId,
    excessAmount,
    paymentMethodCode,
    receiptAmount,
    resetAllocationState,
    sourceOrderId,
    sourceType,
  ]);

  const confirmPreview = useCallback(
    async (previewId: string) => {
      if (!customerId?.trim()) return;
      setConfirmLoading(true);
      try {
        const res = await fetch('/api/v1/customer-receipts/allocation/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
          body: JSON.stringify({ confirmOnly: true, previewId, customerId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to confirm allocation');
        }
        setAllocationPreviewId(previewId);
        showSuccessToast(confirmedToastMessage);
      } finally {
        setConfirmLoading(false);
      }
    },
    [confirmedToastMessage, csrfToken, customerId]
  );

  const handleConfirmAutoAllocation = useCallback(async () => {
    if (!allocationPreview?.previewId) return;
    await confirmPreview(allocationPreview.previewId);
    setExtraReceiptMode(OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES);
    setAutoDrawerOpen(false);
  }, [allocationPreview, confirmPreview]);

  const handleOpenManualAllocate = useCallback(async () => {
    if (!customerId?.trim()) return;
    setManualDrawerOpen(true);
    setOpenBalancesLoading(true);
    resetAllocationState();
    try {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      params.set('currencyCode', currencyCode);
      if (sourceOrderId) params.set('excludeOrderId', sourceOrderId);
      const res = await fetch(`/api/v1/customers/${customerId}/open-balances?${params.toString()}`, {
        headers: { ...getCSRFHeader(csrfToken) },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to load open balances');
      }
      setOpenBalanceTargets((json.data?.targets ?? []) as OpenBalanceTarget[]);
    } catch (error) {
      setOpenBalanceTargets([]);
      showErrorToast(error instanceof Error ? error.message : 'Failed to load open balances');
      setManualDrawerOpen(false);
    } finally {
      setOpenBalancesLoading(false);
    }
  }, [branchId, csrfToken, currencyCode, customerId, resetAllocationState, sourceOrderId]);

  const handleSubmitManualAllocation = useCallback(
    async (allocations: Array<{ targetType: string; targetId: string; lineRole: string; amount: number }>) => {
      if (!customerId?.trim()) return;
      setConfirmLoading(true);
      try {
        const res = await fetch('/api/v1/customer-receipts/allocation/preview-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
          body: JSON.stringify({
            customerId,
            branchId: branchId || undefined,
            sourceOrderId: sourceOrderId || undefined,
            receiptAmount,
            excessAmount,
            currencyCode,
            allocations: allocations.map((line) => ({
              lineRole: line.lineRole,
              targetType: line.targetType,
              targetId: line.targetId,
              amount: line.amount,
            })),
          }),
        });
        const previewJson = await res.json();
        if (!previewJson.success) {
          throw new Error(previewJson.error ?? 'Failed to preview manual allocation');
        }
        const preview = previewJson.data as ReceiptAllocationPreviewResult;
        if (preview.remainingUnallocatedAmount > moneyEpsilon) {
          throw new Error(remainingUnallocatedErrorMessage);
        }
        await confirmPreview(preview.previewId);
        setExtraReceiptMode(OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES);
        setManualDrawerOpen(false);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to save manual allocation');
      } finally {
        setConfirmLoading(false);
      }
    },
    [
      branchId,
      confirmPreview,
      csrfToken,
      currencyCode,
      customerId,
      excessAmount,
      moneyEpsilon,
      receiptAmount,
      remainingUnallocatedErrorMessage,
      sourceOrderId,
    ]
  );

  return {
    extraReceiptMode,
    setExtraReceiptMode,
    allocationPreviewId,
    allocationPreview,
    openBalanceTargets,
    autoDrawerOpen,
    setAutoDrawerOpen,
    manualDrawerOpen,
    setManualDrawerOpen,
    previewLoading,
    confirmLoading,
    openBalancesLoading,
    resetAllocationState,
    handleOpenAutoAllocate,
    handleConfirmAutoAllocation,
    handleOpenManualAllocate,
    handleSubmitManualAllocation,
  };
}
