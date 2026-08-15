'use client';

/**
 * CollectPaymentButton — the single permission-aware trigger for the
 * {@link OrderCollectPaymentModal}.
 *
 * Extracted because the trigger appears on three surfaces (the Ready detail
 * payment card, the pickup handover card, and the order Financial tab's
 * receivable-collection panel) and had drifted: the Ready one was a raw
 * `<button>` with **no permission check at all**, while the modal itself bails
 * with `if (!canCollect) return null`. The result was a dead control — a user
 * without `orders:collect_payment` clicked and nothing happened, with no
 * feedback. Centralising the gate fixes that once instead of three times.
 *
 * Denial uses the codebase's established soft-lock (same shape as the pay-extra
 * top strip): `aria-disabled` plus muted styling, with the click still firing so
 * the cashier is *told* why rather than left guessing at an inert control. The
 * modal keeps its own `canCollect` guard as defence in depth, and the API
 * re-checks `orders:collect_payment` server-side — frontend gates are UX only.
 *
 * The permission code is written as a string literal on purpose: the platform
 * inventory extractor resolves literals only (see the header of
 * `lib/constants/permissions/orders-perm.ts`).
 */

import { useTranslations } from 'next-intl';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CmxButton, type CmxButtonProps } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';

/** RBAC code required to open the collect-payment flow. */
const COLLECT_PAYMENT_PERMISSION = 'orders:collect_payment';

/**
 * Props for {@link CollectPaymentButton}.
 */
export interface CollectPaymentButtonProps
  extends Omit<CmxButtonProps, 'onClick' | 'children' | 'aria-disabled'> {
  /** Opens the collect-payment modal. Not called when permission is missing. */
  onCollect: () => void;
  /**
   * Overrides the default `orders.collectPayment.collectButton` label — used by
   * the pickup card, whose CTA reads "Collect remaining payment".
   */
  label?: string;
}

/**
 * Renders the Collect Payment trigger, gated on `orders:collect_payment`.
 *
 * @param props - {@link CollectPaymentButtonProps}.
 * @returns A permission-aware button that opens the collect-payment modal.
 */
export function CollectPaymentButton({
  onCollect,
  label,
  variant = 'primary',
  className,
  disabled,
  ...buttonProps
}: CollectPaymentButtonProps) {
  const t = useTranslations('orders.collectPayment');
  const canCollect = useHasPermissionCode(COLLECT_PAYMENT_PERMISSION);

  return (
    <CmxButton
      type="button"
      variant={variant}
      className={
        canCollect ? className : `${className ?? ''} cursor-not-allowed opacity-60`.trim()
      }
      // Hard `disabled` stays reserved for callers' own blocking reasons; the
      // permission denial is a soft-lock so the click can explain itself.
      disabled={disabled}
      aria-disabled={!canCollect || undefined}
      onClick={() => {
        if (!canCollect) {
          cmxMessage.error(
            t('permissionRequired', { permissionCode: COLLECT_PAYMENT_PERMISSION })
          );
          return;
        }
        onCollect();
      }}
      {...buttonProps}
    >
      {label ?? t('collectButton')}
    </CmxButton>
  );
}
