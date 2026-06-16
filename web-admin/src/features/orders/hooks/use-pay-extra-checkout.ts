'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeCheckoutExcessMetrics,
  type CheckoutExcessLegInput,
} from '@/lib/payments/checkout-excess-metrics';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { buildOverpaymentResolutionPayload } from '@features/orders/ui/payment-modal/allocation/build-overpayment-resolution';
import {
  useOverpaymentAllocation,
  type UseOverpaymentAllocationParams,
} from './use-overpayment-allocation';

export type PayExtraValidationPhase = 'editing' | 'ready';

export interface UsePayExtraCheckoutParams extends UseOverpaymentAllocationParams {
  saleTotal: number;
  immediateSettlementAmount: number;
  legs: CheckoutExcessLegInput[];
  /** First cash leg legRef for RETURN_CASH_CHANGE resolution lines. */
  primaryCashLegRef?: string | null;
  /** Legacy unresolved excess when payExtraIntent is OFF. */
  legacyUnresolvedExcess: number;
  resetDeps?: unknown[];
}

/**
 * Shared pay-extra checkout state for Payment Modal V4 and Collect Payment.
 * Wraps allocation drawers and owns validate → extra-receipt dialog flow (ADR-050).
 */
export function usePayExtraCheckout({
  saleTotal,
  immediateSettlementAmount,
  legs,
  primaryCashLegRef,
  legacyUnresolvedExcess,
  resetDeps = [],
  excessAmount: _allocationExcess,
  moneyEpsilon = 0.001,
  ...allocationParams
}: UsePayExtraCheckoutParams) {
  const allocation = useOverpaymentAllocation({
    ...allocationParams,
    excessAmount: _allocationExcess,
    moneyEpsilon,
  });

  const [payExtraIntent, setPayExtraIntent] = useState(false);
  const [validationPhase, setValidationPhase] = useState<PayExtraValidationPhase>('editing');
  const [extraReceiptDialogOpen, setExtraReceiptDialogOpen] = useState(false);

  const checkoutMetrics = useMemo(() => {
    const draftResolution = buildOverpaymentResolutionPayload(
      allocation.extraReceiptMode,
      legacyUnresolvedExcess,
      {
        allocationPreviewId: allocation.allocationPreviewId,
        cashLegRef: primaryCashLegRef,
      }
    );
    const explicitChangeResolved =
      draftResolution?.lines
        .filter((line) => line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE)
        .reduce((sum, line) => sum + line.amount, 0) ?? 0;

    return computeCheckoutExcessMetrics({
      saleTotal,
      immediateSettlementAmount,
      legs,
      payExtraIntent,
      explicitChangeResolved: payExtraIntent ? explicitChangeResolved : 0,
      epsilon: moneyEpsilon,
    });
  }, [
    allocation.allocationPreviewId,
    allocation.extraReceiptMode,
    immediateSettlementAmount,
    legacyUnresolvedExcess,
    legs,
    moneyEpsilon,
    payExtraIntent,
    primaryCashLegRef,
    saleTotal,
  ]);

  const unresolvedExcessAmount = payExtraIntent
    ? checkoutMetrics.unresolvedExcessAmount
    : legacyUnresolvedExcess;

  useEffect(() => {
    setValidationPhase('editing');
    setExtraReceiptDialogOpen(false);
    allocation.resetAllocationState();
    allocation.setExtraReceiptMode('adjust_legs');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetDeps is caller-controlled fingerprint
  }, [payExtraIntent, ...resetDeps]);

  const overpaymentResolutionPayload = useMemo(
    () =>
      buildOverpaymentResolutionPayload(allocation.extraReceiptMode, unresolvedExcessAmount, {
        allocationPreviewId: allocation.allocationPreviewId,
        cashLegRef: primaryCashLegRef,
      }),
    [
      allocation.allocationPreviewId,
      allocation.extraReceiptMode,
      primaryCashLegRef,
      unresolvedExcessAmount,
    ]
  );

  const overpaymentNeedsResolution = unresolvedExcessAmount > moneyEpsilon;

  const overpaymentBlocksSubmit = useMemo(() => {
    if (!overpaymentNeedsResolution) return false;
    if (!payExtraIntent) {
      return !overpaymentResolutionPayload;
    }
    if (validationPhase !== 'ready') return true;
    return !overpaymentResolutionPayload;
  }, [
    overpaymentNeedsResolution,
    overpaymentResolutionPayload,
    payExtraIntent,
    validationPhase,
  ]);

  const runValidatePayment = useCallback(() => {
    if (!payExtraIntent) return;
    if (checkoutMetrics.unresolvedExcessAmount <= moneyEpsilon) {
      setValidationPhase('ready');
      setExtraReceiptDialogOpen(false);
      return;
    }
    setExtraReceiptDialogOpen(true);
  }, [checkoutMetrics.unresolvedExcessAmount, moneyEpsilon, payExtraIntent]);

  const confirmExtraReceiptSelection = useCallback(() => {
    if (overpaymentResolutionPayload) {
      setValidationPhase('ready');
      setExtraReceiptDialogOpen(false);
      return true;
    }
    return false;
  }, [overpaymentResolutionPayload]);

  const resetPayExtraState = useCallback(() => {
    setPayExtraIntent(false);
    setValidationPhase('editing');
    setExtraReceiptDialogOpen(false);
    allocation.resetAllocationState();
    allocation.setExtraReceiptMode('adjust_legs');
  }, [allocation]);

  return {
    payExtraIntent,
    setPayExtraIntent,
    validationPhase,
    extraReceiptDialogOpen,
    setExtraReceiptDialogOpen,
    checkoutMetrics,
    unresolvedExcessAmount,
    overpaymentNeedsResolution,
    overpaymentResolutionPayload,
    overpaymentBlocksSubmit,
    runValidatePayment,
    confirmExtraReceiptSelection,
    resetPayExtraState,
    ...allocation,
  };
}
