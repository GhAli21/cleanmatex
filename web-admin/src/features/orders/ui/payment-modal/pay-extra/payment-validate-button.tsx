'use client';

import { useTranslations } from 'next-intl';
import { LoadingButton } from '@ui/primitives';

/**
 *
 */
export type PaymentValidateButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 *
 * @param root0
 * @param root0.onClick
 * @param root0.loading
 * @param root0.disabled
 * @param root0.className
 */
export function PaymentValidateButton({
  onClick,
  loading = false,
  disabled = false,
  className,
}: PaymentValidateButtonProps) {
  const t = useTranslations('newOrder.payment.validatePayment');

  return (
    <LoadingButton
      type="button"
      variant="default"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      className={className ?? 'w-full rounded-xl'}
    >
      {t('button')}
    </LoadingButton>
  );
}
