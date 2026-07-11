'use client';

import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { ExtraReceiptGuidanceBanner } from './extra-receipt-guidance-banner';
import {
  ExtraReceiptHandlingCard,
  type ExtraReceiptHandlingMode,
} from '../allocation/extra-receipt-handling-card';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';

/**
 *
 */
export type PaymentExtraReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excessAmount: number;
  currencyCode: string;
  formatAmount: (value: number) => string;
  hasLinkedCustomer: boolean;
  selectedMode: ExtraReceiptHandlingMode;
  onModeChange: (mode: ExtraReceiptHandlingMode) => void;
  onOpenAutoAllocate?: () => void;
  onOpenManualAllocate?: () => void;
  allocationConfirmed?: boolean;
  canReturnCashChange?: boolean;
  canAllocate?: boolean;
  canSaveAdvance?: boolean;
  canSaveCredit?: boolean;
  canSaveWallet?: boolean;
  onConfirm: () => void;
  onBack: () => void;
  confirmDisabled?: boolean;
  isRTL?: boolean;
};

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.excessAmount
 * @param root0.currencyCode
 * @param root0.formatAmount
 * @param root0.hasLinkedCustomer
 * @param root0.selectedMode
 * @param root0.onModeChange
 * @param root0.onOpenAutoAllocate
 * @param root0.onOpenManualAllocate
 * @param root0.allocationConfirmed
 * @param root0.canReturnCashChange
 * @param root0.canAllocate
 * @param root0.canSaveAdvance
 * @param root0.canSaveCredit
 * @param root0.canSaveWallet
 * @param root0.onConfirm
 * @param root0.onBack
 * @param root0.confirmDisabled
 * @param root0.isRTL
 */
export function PaymentExtraReceiptDialog({
  open,
  onOpenChange,
  excessAmount,
  currencyCode,
  formatAmount,
  hasLinkedCustomer,
  selectedMode,
  onModeChange,
  onOpenAutoAllocate,
  onOpenManualAllocate,
  allocationConfirmed = false,
  canReturnCashChange = false,
  canAllocate = true,
  canSaveAdvance = true,
  canSaveCredit = true,
  canSaveWallet = true,
  onConfirm,
  onBack,
  confirmDisabled = false,
  isRTL = false,
}: PaymentExtraReceiptDialogProps) {
  const tValidate = useTranslations('newOrder.payment.validatePayment');
  const tCommon = useTranslations('common');

  const formattedExcess = `${currencyCode} ${formatAmount(excessAmount)}`;

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-lg" scrollBody draggable>
        <CmxDialogHeader>
          <CmxDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {tValidate('excessFound', { amount: formattedExcess })}
          </CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4 py-2">
          <ExtraReceiptGuidanceBanner
            excessAmount={excessAmount}
            currencyCode={currencyCode}
            formatAmount={formatAmount}
            hasLinkedCustomer={hasLinkedCustomer}
            isRTL={isRTL}
          />

          <ExtraReceiptHandlingCard
            excessAmount={excessAmount}
            currencyCode={currencyCode}
            formatAmount={formatAmount}
            hasLinkedCustomer={hasLinkedCustomer}
            selectedMode={selectedMode}
            onModeChange={onModeChange}
            onOpenAutoAllocate={onOpenAutoAllocate}
            onOpenManualAllocate={onOpenManualAllocate}
            allocationConfirmed={allocationConfirmed}
            isRTL={isRTL}
            canReturnCashChange={canReturnCashChange}
            canAllocate={canAllocate}
            canSaveAdvance={canSaveAdvance}
            canSaveCredit={canSaveCredit}
            canSaveWallet={canSaveWallet}
            embedded
          />
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
          <CmxButton type="button" variant="outline" onClick={onBack}>
            {tCommon('back')}
          </CmxButton>
          <CmxButton
            type="button"
            disabled={
              confirmDisabled ||
              selectedMode === 'adjust_legs' ||
              (selectedMode === OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES &&
                !allocationConfirmed) ||
              (selectedMode === OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES &&
                !allocationConfirmed)
            }
            onClick={onConfirm}
          >
            {tCommon('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
