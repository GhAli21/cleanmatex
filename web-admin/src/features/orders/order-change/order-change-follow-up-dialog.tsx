'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getCSRFToken } from '@/lib/utils/csrf-token';
import { orderEditSessionHeaders } from './edit-page-session';
import type { OrderChangeFollowUpPlan } from '@/lib/services/order-change/order-change-follow-up';

/**
 * Shows the balance left after a committed Change.
 * Collection stays on the existing collection screen.
 * Stored-value actions call the resolution route for the exact cap shown.
 */
export function OrderChangeFollowUpDialog({
  open,
  orderId,
  plan,
  sessionToken,
  onOpenChange,
}: {
  open: boolean;
  orderId: string;
  plan: OrderChangeFollowUpPlan | null;
  sessionToken: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('orders.edit');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const resolve = async (code: string, amount: string) => {
    setPendingCode(code);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/financial-resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...getCSRFHeader(await getCSRFToken()),
          ...orderEditSessionHeaders(sessionToken),
        },
        body: JSON.stringify({ resolutionCode: code, amount }),
      });
      if (!response.ok) {
        cmxMessage.error(t('followUp.resolveFailed'));
        return;
      }
      cmxMessage.success(t('followUp.resolved'));
      onOpenChange(false);
    } catch {
      cmxMessage.error(t('followUp.resolveFailed'));
    } finally {
      setPendingCode(null);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('followUp.title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="flex flex-col gap-3">
          {plan?.actions.map((action) => (
            action.executesHere ? (
              <CmxButton
                key={action.code}
                type="button"
                variant="outline"
                disabled={pendingCode != null}
                onClick={() => { void resolve(action.code, action.amountCap); }}
              >
                {t('followUp.resolve', {
                  amount: action.amountCap,
                  currency: action.currencyCode,
                  destination: t(`followUp.destinations.${action.code}`),
                })}
              </CmxButton>
            ) : (
              <CmxSummaryMessage
                key={action.code}
                type="info"
                title={t('followUp.collectExisting', { amount: action.amountCap, currency: action.currencyCode })}
                items={[]}
              />
            )
          ))}
          {(plan?.unavailable.length ?? 0) > 0 ? (
            <CmxSummaryMessage
              type="warning"
              title={t('followUp.title')}
              items={plan?.unavailable.map((item) => t(`followUp.unavailable.${item.reason}`)) ?? []}
            />
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('lifecycle.backToOrder')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
