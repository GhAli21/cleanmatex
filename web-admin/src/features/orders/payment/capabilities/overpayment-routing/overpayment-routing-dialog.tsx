'use client';

/**
 * Overpayment-routing capability adapter (ADR condition #5 — an unresolved
 * overpayment is a REQUIRED dialog, never a mode change).
 *
 * This capability deliberately **reuses the existing, battle-tested
 * `PaymentExtraReceiptDialog`** rather than rebuilding it (program handoff:
 * "wrap existing payment-extra-receipt-dialog"). The wrapper's job is to give
 * that dialog a capability identity: it routes open/confirm/back through the
 * typed `PaymentEngineActions` facade (so the capability depends on the facade,
 * not loose handlers), adds capability open-observability (safe metadata only —
 * hardening #12), and forwards the view-composed callbacks/facts unchanged.
 *
 * The `onModeChange` closure and the auto/manual allocation drawers stay
 * container-owned (they touch refs, scroll, and section navigation — view
 * concerns), so they arrive as already-composed props. No money math here.
 */

import { useEffect, useRef } from 'react';
import { logger } from '@/lib/utils/logger';
import { PaymentExtraReceiptDialog } from '@features/orders/ui/payment-modal/pay-extra/payment-extra-receipt-dialog';
import type { ExtraReceiptHandlingMode } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';

/**
 * Typed engine actions the overpayment dialog may call — nothing more.
 */
export type OverpaymentRoutingDialogActions = Pick<
  PaymentEngineActions,
  'setExtraReceiptDialogOpen' | 'confirmExtraReceiptSelection'
>;

/**
 * Props for {@link OverpaymentRoutingDialog}. Money values + allocation facts
 * are engine/view-derived; the mode-change closure stays container-owned.
 */
export interface OverpaymentRoutingDialogProps {
  open: boolean;
  actions: OverpaymentRoutingDialogActions;
  /** Engine-derived excess amount to resolve. */
  excessAmount: number;
  currencyCode: string;
  formatAmount: (value: number) => string;
  hasLinkedCustomer: boolean;
  selectedMode: ExtraReceiptHandlingMode;
  /** View-composed handler (touches refs/scroll/section nav — stays in container). */
  onModeChange: (mode: ExtraReceiptHandlingMode) => void;
  onOpenAutoAllocate?: () => void;
  onOpenManualAllocate?: () => void;
  allocationConfirmed?: boolean;
  canReturnCashChange?: boolean;
  canAllocate?: boolean;
  canSaveAdvance?: boolean;
  canSaveCredit?: boolean;
  canSaveWallet?: boolean;
  /** Confirm is disabled until a resolution payload is ready (engine-derived). */
  confirmDisabled?: boolean;
  /** Invoked when {@link OverpaymentRoutingDialogActions.confirmExtraReceiptSelection}
   * returns false (nothing resolved) — the container surfaces the toast. */
  onConfirmFailed?: () => void;
  isRTL?: boolean;
}

/**
 * Presents the overpayment-routing capability by adapting engine actions/facts
 * onto the existing {@link PaymentExtraReceiptDialog}.
 *
 * @param props - {@link OverpaymentRoutingDialogProps}.
 * @returns The dialog element.
 */
export function OverpaymentRoutingDialog({
  open,
  actions,
  excessAmount,
  currencyCode,
  formatAmount,
  hasLinkedCustomer,
  selectedMode,
  onModeChange,
  onOpenAutoAllocate,
  onOpenManualAllocate,
  allocationConfirmed,
  canReturnCashChange,
  canAllocate,
  canSaveAdvance,
  canSaveCredit,
  canSaveWallet,
  confirmDisabled,
  onConfirmFailed,
  isRTL,
}: OverpaymentRoutingDialogProps) {
  // Observability (hardening #12): capability key + event only.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      logger.info('[payment] capability dialog opened', {
        feature: 'payment-modal',
        action: 'capability-dialog-open',
        capability: PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
      });
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <PaymentExtraReceiptDialog
      open={open}
      onOpenChange={actions.setExtraReceiptDialogOpen}
      excessAmount={excessAmount}
      currencyCode={currencyCode}
      formatAmount={formatAmount}
      hasLinkedCustomer={hasLinkedCustomer}
      selectedMode={selectedMode}
      onModeChange={onModeChange}
      onOpenAutoAllocate={onOpenAutoAllocate}
      onOpenManualAllocate={onOpenManualAllocate}
      allocationConfirmed={allocationConfirmed}
      canReturnCashChange={canReturnCashChange}
      canAllocate={canAllocate}
      canSaveAdvance={canSaveAdvance}
      canSaveCredit={canSaveCredit}
      canSaveWallet={canSaveWallet}
      onConfirm={() => {
        if (!actions.confirmExtraReceiptSelection()) {
          onConfirmFailed?.();
        }
      }}
      onBack={() => actions.setExtraReceiptDialogOpen(false)}
      confirmDisabled={confirmDisabled}
      isRTL={isRTL}
    />
  );
}
