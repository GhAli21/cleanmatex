'use client';

/**
 * Promo-code capability dialog.
 *
 * A focused code → validate → applied workspace, ported from the legacy
 * `payment-full-view` promo block. Sibling to (but separate from) the gift-card
 * dialog: the registry treats `PROMO_CODE` and `GIFT_CARD` as distinct
 * capabilities even though the legacy view bundled both in one "credits" panel.
 *
 * RHF-free per the program handoff convention: the container threads the watched
 * `promoCode` + its setter, and the dialog calls the engine's **no-arg** typed
 * actions (`validatePromoCode` / `clearPromoCode` / `clearPromoCodeError`), which
 * read the RHF-watched code from engine scope. No money math or i18n mapping
 * here — the error line arrives precomputed (`promoErrorMessage`, threshold
 * amounts already formatted by the container); the engine owns discount math and
 * the server re-validates on submit.
 */

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import type { ValidatePromoCodeResult } from '@/lib/types/payment';
import type { AppliedPromoCode } from '@features/orders/hooks/use-gift-card-and-promo';
import { CmxButton, CmxInput } from '@ui/primitives';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';

/**
 * Typed engine actions the promo dialog may call — nothing more.
 */
export type PromoCodeDialogActions = Pick<
  PaymentEngineActions,
  'validatePromoCode' | 'clearPromoCode' | 'clearPromoCodeError'
>;

/**
 * Props for {@link PromoCodeDialog}. The RHF-bound code arrives as a value +
 * setter pair (dialog stays RHF-free); the error line arrives precomputed.
 */
export interface PromoCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PromoCodeDialogActions;

  /** Watched `promoCode`. */
  promoCode: string;
  /** Writes `promoCode` back to the form (uppercased by the container). */
  onPromoCodeChange: (value: string) => void;

  promoCodeValidating: boolean;
  /** Latest validation result — used only to clear a stale error on edit. */
  promoCodeResult: ValidatePromoCodeResult | null;
  appliedPromoCode: AppliedPromoCode | null;
  /** Localized, money-formatted error line (container-computed) or null. */
  promoErrorMessage: string | null;

  currencyCode: string;
  formatAmount: (n: number) => string;
}

/**
 * Renders the promo-code lookup / applied workspace inside the shared capability
 * shell. Self-committing (engine owns state — ADR state-survival); the footer is
 * a single "Done" that closes.
 *
 * @param props - {@link PromoCodeDialogProps}.
 * @returns The dialog element.
 */
export function PromoCodeDialog({
  open,
  onOpenChange,
  actions,
  promoCode,
  onPromoCodeChange,
  promoCodeValidating,
  promoCodeResult,
  appliedPromoCode,
  promoErrorMessage,
  currencyCode,
  formatAmount,
}: PromoCodeDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.PROMO_CODE}
      open={open}
      onOpenChange={onOpenChange}
      title={t('capabilities.PROMO_CODE.title')}
      description={t('capabilities.PROMO_CODE.description')}
      cancelLabel={tCommon('cancel')}
      onCancel={() => onOpenChange(false)}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
    >
      {appliedPromoCode ? (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 ${
            isRTL ? 'flex-row-reverse' : ''
          }`}
          data-testid="promo-code-applied"
        >
          <span className="text-sm font-medium text-green-900" dir="ltr">
            {appliedPromoCode.code} · -{currencyCode} {formatAmount(appliedPromoCode.discount)}
          </span>
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={actions.clearPromoCode}
            data-testid="promo-code-remove"
          >
            {t('promoCode.remove')}
          </CmxButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxInput
              value={promoCode}
              onChange={(event) => {
                onPromoCodeChange(event.target.value.toUpperCase());
                if (promoCodeResult && !promoCodeResult.isValid) {
                  actions.clearPromoCodeError();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  void actions.validatePromoCode();
                }
              }}
              placeholder={t('promoCode.placeholder')}
              aria-label={t('promoCode.label')}
              disabled={promoCodeValidating}
              dir="ltr"
              className="min-w-0"
              data-testid="promo-code-input"
            />
            <CmxButton
              type="button"
              size="sm"
              onClick={() => void actions.validatePromoCode()}
              disabled={!promoCode.trim() || promoCodeValidating}
              className="shrink-0"
              data-testid="promo-code-apply"
            >
              {promoCodeValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('promoCode.apply')
              )}
            </CmxButton>
          </div>

          {promoErrorMessage ? (
            <p
              className={`text-xs text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`}
              role="alert"
              data-testid="promo-code-error"
            >
              {promoErrorMessage}
            </p>
          ) : null}
        </div>
      )}
    </PaymentCapabilityDialog>
  );
}
