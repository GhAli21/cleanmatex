'use client';

import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';

/**
 *
 */
export type ExtraReceiptHandlingMode =
  | 'adjust_legs'
  | typeof OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE
  | typeof OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE
  | typeof OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET
  | typeof OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT
  | typeof OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES
  | typeof OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES;

/**
 *
 */
export type ExtraReceiptHandlingCardProps = {
  excessAmount: number;
  currencyCode: string;
  formatAmount: (value: number) => string;
  hasLinkedCustomer: boolean;
  selectedMode: ExtraReceiptHandlingMode;
  onModeChange: (mode: ExtraReceiptHandlingMode) => void;
  onOpenAutoAllocate?: () => void;
  onOpenManualAllocate?: () => void;
  allocationConfirmed?: boolean;
  isRTL?: boolean;
  /** When true, omit outer card chrome (used inside PaymentExtraReceiptDialog). */
  embedded?: boolean;
  /** RBAC: hide allocation actions when false */
  canAllocate?: boolean;
  canSaveAdvance?: boolean;
  canSaveCredit?: boolean;
  canSaveWallet?: boolean;
  canReturnCashChange?: boolean;
};

/**
 * Cashier-facing panel for routing checkout excess (ADR-047 Phase 2–3).
 * Labels use "Extra Receipt" / "Unallocated" — not "Change" unless change path applies elsewhere.
 * @param root0
 * @param root0.excessAmount
 * @param root0.currencyCode
 * @param root0.formatAmount
 * @param root0.hasLinkedCustomer
 * @param root0.selectedMode
 * @param root0.onModeChange
 * @param root0.onOpenAutoAllocate
 * @param root0.onOpenManualAllocate
 * @param root0.allocationConfirmed
 * @param root0.isRTL
 * @param root0.embedded
 * @param root0.canAllocate
 * @param root0.canSaveAdvance
 * @param root0.canSaveCredit
 * @param root0.canSaveWallet
 * @param root0.canReturnCashChange
 */
export function ExtraReceiptHandlingCard({
  excessAmount,
  currencyCode,
  formatAmount,
  hasLinkedCustomer,
  selectedMode,
  onModeChange,
  onOpenAutoAllocate,
  onOpenManualAllocate,
  allocationConfirmed = false,
  isRTL = false,
  embedded = false,
  canAllocate = true,
  canSaveAdvance = true,
  canSaveCredit = true,
  canSaveWallet = true,
  canReturnCashChange = false,
}: ExtraReceiptHandlingCardProps) {
  const t = useTranslations('newOrder.payment.extraReceipt');

  if (excessAmount <= 0.001) {
    return null;
  }

  const formattedExcess = `${currencyCode} ${formatAmount(excessAmount)}`;
  const textAlign = isRTL ? 'text-right' : 'text-left';

  const options: Array<{
    mode: ExtraReceiptHandlingMode;
    label: string;
    description: string;
    disabled?: boolean;
  }> = [
    {
      mode: 'adjust_legs',
      label: t('adjustPayments'),
      description: t('adjustPaymentsHelp'),
    },
    ...(canReturnCashChange
      ? [
          {
            mode: OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE as ExtraReceiptHandlingMode,
            label: t('returnCashChange'),
            description: t('returnCashChangeHelp', { amount: formattedExcess }),
          },
        ]
      : []),
    ...(hasLinkedCustomer
      ? [
          ...(canAllocate
            ? [
                {
                  mode: OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES as ExtraReceiptHandlingMode,
                  label: t('autoAllocate'),
                  description: allocationConfirmed ? t('autoAllocateConfirmed') : t('autoAllocateHelp'),
                },
                {
                  mode: OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES as ExtraReceiptHandlingMode,
                  label: t('manualAllocate'),
                  description: allocationConfirmed ? t('manualAllocateConfirmed') : t('manualAllocateHelp'),
                },
              ]
            : []),
          ...(canSaveAdvance
            ? [
                {
                  mode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE as ExtraReceiptHandlingMode,
                  label: t('saveAsAdvance'),
                  description: t('saveAsAdvanceHelp'),
                },
              ]
            : []),
          ...(canSaveWallet
            ? [
                {
                  mode: OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET as ExtraReceiptHandlingMode,
                  label: t('saveToWallet'),
                  description: t('saveToWalletHelp', { amount: formattedExcess }),
                },
              ]
            : []),
          ...(canSaveCredit
            ? [
                {
                  mode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT as ExtraReceiptHandlingMode,
                  label: t('saveAsCredit'),
                  description: t('saveAsCreditHelp'),
                },
              ]
            : []),
        ]
      : []),
  ];

  const body = (
    <>
      {!hasLinkedCustomer ? (
        <p className={`text-xs text-amber-900/70 ${textAlign}`}>{t('walkInHint')}</p>
      ) : null}
      {options.map((option) => {
        const selected = selectedMode === option.mode;
        return (
          <CmxButton
            key={option.mode}
            type="button"
            variant="outline"
            disabled={option.disabled}
            onClick={() => {
              onModeChange(option.mode);
              if (
                option.mode === OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES
              ) {
                onOpenAutoAllocate?.();
              }
              if (option.mode === OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES) {
                onOpenManualAllocate?.();
              }
            }}
            className={`h-auto w-full flex-col items-start gap-1 rounded-xl border px-3 py-3 ${
              selected
                ? 'border-cyan-400 bg-cyan-50'
                : 'border-slate-200 bg-white hover:border-cyan-200'
            } ${isRTL ? 'items-end text-right' : 'text-left'}`}
          >
            <span className="text-sm font-semibold text-slate-900">{option.label}</span>
            <span className="text-xs font-normal text-slate-600">{option.description}</span>
          </CmxButton>
        );
      })}
    </>
  );

  if (embedded) {
    return <div className="space-y-2">{body}</div>;
  }

  return (
    <CmxCard className="border-amber-200 bg-amber-50/60">
      <CmxCardHeader className="pb-2">
        <CmxCardTitle className={`text-base text-amber-950 ${textAlign}`}>
          {t('title')}
        </CmxCardTitle>
        <p className={`text-sm text-amber-900/80 ${textAlign}`}>
          {t('unallocatedAmount', { amount: formattedExcess })}
        </p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-2 pt-0">
        {body}
      </CmxCardContent>
    </CmxCard>
  );
}
