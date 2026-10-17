'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Edit } from 'lucide-react';
import { cmxMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  clearOrderEditTabSession,
  currentOrderEditReturnPath,
  postOrderEditSession,
  readAnyOrderEditTabSession,
  safeOrderEditReturnPath,
  writeOrderEditTabSession,
} from './edit-page-session';

interface StartOrderEditButtonProps {
  orderId: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

/**
 * Starts an edit session, then opens the editor.
 * The session token stays in this tab. The address itself is not enough to enter.
 * @param root0 - Button props.
 * @param root0.orderId - Order to edit.
 * @param root0.label - Already translated button label.
 * @param root0.variant - Cmx button variant.
 * @param root0.size - Cmx button size.
 * @param root0.className - Caller layout classes.
 * @param root0.disabled - Extra disabled state from the caller.
 */
export function StartOrderEditButton({
  orderId,
  label,
  variant = 'outline',
  size = 'sm',
  className,
  disabled = false,
}: StartOrderEditButtonProps) {
  const t = useTranslations('orders.edit');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const start = async () => {
    if (pending || disabled) return;
    setPending(true);
    try {
      const previous = readAnyOrderEditTabSession();
      const token = previous?.orderId === orderId ? previous.token : crypto.randomUUID();
      if (previous && previous.orderId !== orderId) {
        await postOrderEditSession(previous.orderId, {
          action: 'end',
          token: previous.token,
          reason: 'navigate_away',
        });
        clearOrderEditTabSession(previous.orderId);
      }
      const result = await postOrderEditSession(orderId, { action: 'start', token });
      if (!result.ok || !result.expiresAt) {
        const message = result.code === 'ALREADY_OPEN' || result.code === 'MISMATCH'
          ? t('lifecycle.deniedInUseBody')
          : result.code === 'HELD_BY_OTHER'
            ? t('lifecycle.deniedHeldBody')
            : result.code === 'ORDER_NOT_FOUND'
              ? t('workspace.loadFailed')
              : t('lifecycle.startFailed');
        cmxMessage.error(message);
        return;
      }
      writeOrderEditTabSession({
        orderId,
        token,
        returnTo: safeOrderEditReturnPath(orderId, currentOrderEditReturnPath()),
        expiresAt: result.expiresAt,
      });
      router.push(`/dashboard/orders/${orderId}/edit`);
    } finally {
      setPending(false);
    }
  };

  return (
    <CmxButton
      type="button"
      variant={variant}
      size={size}
      className={className ? `gap-2 ${className}` : 'gap-2'}
      loading={pending}
      disabled={disabled || pending}
      onClick={() => { void start(); }}
    >
      <Edit className="h-4 w-4" aria-hidden="true" />
      {label}
    </CmxButton>
  );
}
