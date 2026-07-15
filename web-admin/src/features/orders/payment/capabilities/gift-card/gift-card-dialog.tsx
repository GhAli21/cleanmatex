'use client';

/**
 * Gift-card capability dialog (ADR: former condition #6 — PIN entry is a field
 * INSIDE this dialog, never a mode change).
 *
 * The gift-card workspace is entangled with React-Hook-Form in the legacy view
 * (`use-gift-card-and-promo.ts`). Per the program handoff note (option a) this
 * dialog stays **RHF-free**: the container threads the RHF-bound values and
 * their setters (`giftCardNumber`/`onGiftCardNumberChange`,
 * `giftCardAmount`/`onGiftCardAmountChange`) as props, and the dialog calls the
 * engine's **no-arg** typed actions (`fetchGiftCardDetails` / `applyGiftCard` /
 * `clearGiftCard`), which read those RHF-watched values from engine scope.
 *
 * No money math here — balances, the remaining-due line, and validity all
 * arrive engine-derived; the engine owns application/capping and the server
 * re-validates the redemption on submit.
 */

import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { RefObject } from 'react';
import { useRTL } from '@/lib/hooks/useRTL';
import type { ValidateGiftCardResult } from '@/lib/types/payment';
import type {
  AppliedGiftCard,
  GiftCardDetails,
} from '@features/orders/hooks/use-gift-card-and-promo';
import { CmxButton, CmxInput } from '@ui/primitives';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';
import { SummaryRow } from '@features/orders/ui/payment-modal/summary-row';

/**
 * Typed engine actions the gift-card dialog may call — nothing more. The three
 * PIN setters are the H2 facade extension this capability adds.
 */
export type GiftCardDialogActions = Pick<
  PaymentEngineActions,
  | 'fetchGiftCardDetails'
  | 'applyGiftCard'
  | 'clearGiftCard'
  | 'setGiftCardPin'
  | 'setGiftCardPinVisible'
  | 'setGiftCardPinError'
>;

/**
 * Props for {@link GiftCardDialog}. All money values are engine-derived; the
 * RHF-bound number/amount arrive as value + setter pairs (dialog stays RHF-free).
 */
export interface GiftCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: GiftCardDialogActions;

  // ---- RHF-bound values threaded from the container ----
  /** Watched `giftCardNumber`. */
  giftCardNumber: string;
  /** Writes `giftCardNumber` back to the form (uppercased by the container). */
  onGiftCardNumberChange: (value: string) => void;
  /** Watched `giftCardAmount`. */
  giftCardAmount: number | undefined;
  /** Writes `giftCardAmount` back to the form. */
  onGiftCardAmountChange: (value: number) => void;

  // ---- engine gift-card slice (facts + PIN state) ----
  giftCardValidating: boolean;
  giftCardResult: ValidateGiftCardResult | null;
  giftCardDetails: GiftCardDetails | null;
  appliedGiftCard: AppliedGiftCard | null;
  giftCardPin: string;
  pinRequired: boolean;
  pinVisible: boolean;
  pinFieldError: string | null;
  /** Maps a validation result to a localized message (engine-owned). */
  resolveGiftCardError: (result: ValidateGiftCardResult) => string;

  // ---- engine-derived display facts ----
  /** Remaining balance still due (>epsilon means outstanding). */
  remainingBalance: number;
  /** Engine money-comparison epsilon (display thresholding only). */
  moneyEpsilon: number;
  currencyCode: string;
  formatAmount: (n: number) => string;

  // ---- DOM refs owned by the container, consumed by engine focus logic ----
  pinInputRef: RefObject<HTMLInputElement | null>;
  giftCardAmountInputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Renders the gift-card lookup → PIN → apply workspace inside the shared
 * capability shell. Self-committing (engine owns state — ADR state-survival);
 * the footer is a single "Done" that closes.
 *
 * @param props - {@link GiftCardDialogProps}.
 * @returns The dialog element.
 */
export function GiftCardDialog({
  open,
  onOpenChange,
  actions,
  giftCardNumber,
  onGiftCardNumberChange,
  giftCardAmount,
  onGiftCardAmountChange,
  giftCardValidating,
  giftCardResult,
  giftCardDetails,
  appliedGiftCard,
  giftCardPin,
  pinRequired,
  pinVisible,
  pinFieldError,
  resolveGiftCardError,
  remainingBalance,
  moneyEpsilon,
  currencyCode,
  formatAmount,
  pinInputRef,
  giftCardAmountInputRef,
}: GiftCardDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  // Mirror of the legacy view's `showGiftCardWorkspace` (the kill-flag branch is
  // handled upstream by the capability's availability, so it isn't repeated here).
  const showWorkspace = !appliedGiftCard && (pinRequired || !!giftCardDetails);
  const fetchDisabled =
    !giftCardNumber.trim() ||
    giftCardValidating ||
    (pinRequired && !giftCardPin.trim());

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.GIFT_CARD}
      open={open}
      onOpenChange={onOpenChange}
      title={t('capabilities.GIFT_CARD.title')}
      description={t('capabilities.GIFT_CARD.description')}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
      maxWidthClassName="max-w-lg"
    >
      {appliedGiftCard ? (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 ${
            isRTL ? 'flex-row-reverse' : ''
          }`}
          data-testid="gift-card-applied"
        >
          <span className="text-sm font-medium text-purple-900" dir="ltr">
            {appliedGiftCard.number} · {currencyCode} {formatAmount(appliedGiftCard.amount)}
          </span>
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={actions.clearGiftCard}
            data-testid="gift-card-clear"
          >
            {t('giftCard.remove')}
          </CmxButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
            <CmxInput
              value={giftCardNumber}
              onChange={(event) => onGiftCardNumberChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  void actions.fetchGiftCardDetails();
                }
              }}
              placeholder={t('giftCard.placeholder')}
              aria-label={t('giftCard.label')}
              disabled={giftCardValidating}
              dir="ltr"
              className="min-w-0"
              data-testid="gift-card-number-input"
            />
            <CmxButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void actions.fetchGiftCardDetails()}
              disabled={fetchDisabled}
              className="shrink-0"
              data-testid="gift-card-fetch"
            >
              {giftCardValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('giftCard.fetch')
              )}
            </CmxButton>
          </div>

          {giftCardResult && !giftCardResult.isValid ? (
            <p
              className={`text-xs text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`}
              role="alert"
              data-testid="gift-card-error"
            >
              {resolveGiftCardError(giftCardResult)}
            </p>
          ) : null}

          {showWorkspace ? (
            <div className="flex flex-col gap-3 rounded-xl border border-purple-200 bg-white p-3" data-testid="gift-card-workspace">
              <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2">
                <p className={`text-xs font-semibold uppercase tracking-wide text-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('giftCard.cardCode')}
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900" dir="ltr">
                  {giftCardDetails?.number || giftCardNumber}
                </p>
                {giftCardDetails ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <SummaryRow
                      label={t('giftCard.balance')}
                      value={`${currencyCode} ${formatAmount(giftCardDetails.balance)}`}
                    />
                    <SummaryRow
                      label={t('rightRail.remainingBalance')}
                      value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                      negative={remainingBalance > moneyEpsilon}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">{t('giftCard.pinPendingError')}</p>
                )}
              </div>

              {pinRequired ? (
                <div className={`grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
                  <CmxInput
                    ref={pinInputRef}
                    label={t('giftCard.pinLabel')}
                    value={giftCardPin}
                    type={pinVisible ? 'text' : 'password'}
                    dir="ltr"
                    error={pinFieldError ?? undefined}
                    className={`min-w-0 ${pinRequired && !giftCardPin.trim() ? 'ring-1 ring-rose-400' : ''}`}
                    onChange={(event) => {
                      actions.setGiftCardPin(event.target.value);
                      actions.setGiftCardPinError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                        void actions.fetchGiftCardDetails();
                      }
                    }}
                    data-testid="gift-card-pin-input"
                  />
                  <CmxButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => actions.setGiftCardPinVisible(!pinVisible)}
                    aria-label={pinVisible ? t('giftCard.hidePin') : t('giftCard.showPin')}
                    data-testid="gift-card-pin-toggle"
                  >
                    {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </CmxButton>
                </div>
              ) : null}

              {giftCardDetails ? (
                <div className="flex flex-col gap-2">
                  <CmxInput
                    ref={giftCardAmountInputRef}
                    type="number"
                    label={t('giftCard.applyAmount')}
                    value={giftCardAmount ?? ''}
                    dir="ltr"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    placeholder={t('giftCard.amountPlaceholder')}
                    onChange={(event) =>
                      onGiftCardAmountChange(Number.parseFloat(event.target.value) || 0)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                        actions.applyGiftCard();
                      }
                    }}
                    data-testid="gift-card-amount-input"
                  />
                  <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <CmxButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={actions.applyGiftCard}
                      disabled={!giftCardAmount || giftCardAmount <= 0}
                      className="flex-1"
                      data-testid="gift-card-apply"
                    >
                      {t('giftCard.applyAmount')}
                    </CmxButton>
                    <CmxButton
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={actions.clearGiftCard}
                      className="flex-1"
                      data-testid="gift-card-clear"
                    >
                      {tCommon('clear')}
                    </CmxButton>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </PaymentCapabilityDialog>
  );
}
