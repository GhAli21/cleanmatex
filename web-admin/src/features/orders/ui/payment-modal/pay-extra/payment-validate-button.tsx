'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingButton } from '@ui/primitives';

/**
 * Props for {@link PaymentValidateButton}.
 */
export type PaymentValidateButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  isRTL?: boolean;
};

/**
 * The "Validate payment" action for the pay-extra flow: routes the extra to a
 * destination before submit is allowed.
 *
 * Styled amber (a gradient — background-image reliably covers the primitive's
 * variant background-color under the repo's plain-clsx `cn`) to match the
 * pay-extra strip's "unresolved" tone: it reads as the REQUIRED next step,
 * visually distinct from the teal final Submit CTA rather than competing with
 * it. The caller hides it once the extra is resolved.
 *
 * @param root0 - Button props.
 * @param root0.onClick - Opens the extra-receipt routing flow / marks ready.
 * @param root0.loading - Async in-flight state.
 * @param root0.disabled - Disabled when the toggle cannot be enabled.
 * @param root0.className - Layout classes from the caller (sizing).
 * @param root0.isRTL - Right-to-left icon/text ordering.
 * @returns The validate action button.
 */
export function PaymentValidateButton({
  onClick,
  loading = false,
  disabled = false,
  className,
  isRTL = false,
}: PaymentValidateButtonProps) {
  const t = useTranslations('newOrder.payment.validatePayment');

  return (
    <LoadingButton
      type="button"
      variant="primary"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      data-testid="payment-validate-button"
      className={cn(
        'gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-sm hover:from-amber-600 hover:to-amber-700',
        isRTL && 'flex-row-reverse',
        className
      )}
    >
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t('button')}
    </LoadingButton>
  );
}
