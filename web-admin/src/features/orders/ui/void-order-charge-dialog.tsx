'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import { cmxMessage } from '@ui/feedback';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';

interface VoidOrderChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  chargeId: string;
  chargeLabel: string;
}

/** B18 follow-up — reason-gated void action for a single `org_order_charges_dtl` line. */
export function VoidOrderChargeDialog({
  open,
  onOpenChange,
  orderId,
  chargeId,
  chargeLabel,
}: VoidOrderChargeDialogProps) {
  const t = useTranslations('orders.detailFull.financialTab.voidChargeDialog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { token: csrfToken } = useCSRFToken();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setReason('');
    onOpenChange(false);
  };

  const submit = async () => {
    if (submitting || !reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/charges/${chargeId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        cmxMessage.success(t('success'));
        setReason('');
        onOpenChange(false);
        router.refresh();
      } else {
        cmxMessage.error(mapVoidError(json.error, t));
      }
    } catch {
      cmxMessage.error(t('errors.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          <CmxDialogDescription>{t('description')}</CmxDialogDescription>
        </CmxDialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">{chargeLabel}</p>
          <CmxTextarea
            value={reason}
            placeholder={t('reasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
            aria-label={t('reasonPlaceholder')}
          />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={close} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant="destructive"
            disabled={!reason.trim()}
            loading={submitting}
            onClick={submit}
          >
            {t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function mapVoidError(code: string, t: (key: string) => string): string {
  switch (code) {
    case 'VOID_REASON_REQUIRED':
      return t('errors.reasonRequired');
    case 'CHARGE_ALREADY_VOIDED':
      return t('errors.alreadyVoided');
    case 'CHARGE_NOT_FOUND':
      return t('errors.notFound');
    default:
      return t('errors.failed');
  }
}
