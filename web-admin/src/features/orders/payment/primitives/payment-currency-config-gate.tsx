'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { LOGIN_REASONS } from '@/lib/constants/auth-session';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';

/** The checkout-safe states while tenant currency authority is resolved. */
export type PaymentCurrencyConfigLoadState =
  | { status: 'loading' }
  | { status: 'missing-config' }
  | { status: 'unavailable' };

/** Props for the blocking currency-resolution gate shown before any money controls render. */
export interface PaymentCurrencyConfigGateProps {
  open: boolean;
  state: PaymentCurrencyConfigLoadState;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Blocks checkout until the organization currency is trustworthy, preventing a
 * stale session or failed read from being interpreted as a usable money default.
 *
 * @param props - Gate visibility, resolution state, and recovery handlers.
 * @returns A Cmx dialog containing the appropriate operator recovery path.
 */
export function PaymentCurrencyConfigGate({
  open,
  state,
  onClose,
  onRetry,
}: PaymentCurrencyConfigGateProps) {
  const t = useTranslations('newOrder.payment.currencyConfig');
  const tCommon = useTranslations('common');
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const isLoading = state.status === 'loading';
  const isMissingConfig = state.status === 'missing-config';

  const handleSignOutAndSignIn = async () => {
    setSigningOut(true);
    await signOut('user', {
      loginReason: LOGIN_REASONS.CURRENCY_CONFIGURATION,
      returnTo: '/dashboard/orders/new',
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <CmxDialogContent
        data-testid="payment-currency-config-gate"
        className="max-w-lg"
        scrollBody
      >
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-3" role="status">
              <CmxSpinner />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          ) : (
            <CmxSummaryMessage
              type="error"
              title={
                isMissingConfig ? t('missingTitle') : t('unavailableTitle')
              }
              items={[
                isMissingConfig ? t('missingBody') : t('unavailableBody'),
              ]}
            />
          )}
        </div>
        <CmxDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <CmxButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading || signingOut}
          >
            {tCommon('cancel')}
          </CmxButton>
          {!isMissingConfig ? (
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => void handleSignOutAndSignIn()}
              loading={signingOut}
              disabled={isLoading}
            >
              {t('signOutAndSignIn')}
            </CmxButton>
          ) : null}
          <CmxButton
            type="button"
            onClick={onRetry}
            loading={isLoading}
            disabled={signingOut}
          >
            {t('retry')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
