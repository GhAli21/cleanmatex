/**
 * Report issue dialog — ORDER / ITEM / PIECE scope.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxTextarea, CmxInput, Label } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import {
  ORDER_ISSUE_CODE,
  ORDER_ISSUE_SCOPE,
  type OrderIssueScope,
} from '@/lib/constants/order-issues';

const ISSUE_CODES = Object.values(ORDER_ISSUE_CODE);

export interface OrderIssueReportDialogProps {
  open: boolean;
  orderId: string;
  scopeLevel: OrderIssueScope;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Creates an issue without rejecting the order/item/piece.
 */
export function OrderIssueReportDialog({
  open,
  orderId,
  scopeLevel,
  orderItemId,
  orderItemPieceId,
  onOpenChange,
  onSuccess,
}: OrderIssueReportDialogProps) {
  const t = useTranslations('orders.issues');
  const tCommon = useTranslations('common');
  const { token: csrfToken } = useCSRFToken();

  const [issueCode, setIssueCode] = React.useState<string>(ORDER_ISSUE_CODE.OTHER);
  const [issueText, setIssueText] = React.useState('');
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setIssueCode(ORDER_ISSUE_CODE.OTHER);
      setIssueText('');
      setPhotoUrl('');
      setFieldError('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        scopeLevel,
        issueCode,
        issueText: issueText.trim(),
        priority: 'normal',
      };
      if (scopeLevel !== ORDER_ISSUE_SCOPE.ORDER) {
        body.orderItemId = orderItemId ?? null;
      } else {
        body.orderItemId = null;
      }
      if (scopeLevel === ORDER_ISSUE_SCOPE.PIECE) {
        body.orderItemPieceId = orderItemPieceId ?? null;
      }
      if (photoUrl.trim()) {
        body.photoUrl = photoUrl.trim();
      }

      const response = await fetch(`/api/v1/orders/${orderId}/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || t('submitFailed')
        );
      }
      return data;
    },
    onSuccess: () => {
      cmxMessage.success(t('submitSuccess'));
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      cmxMessage.error(
        error instanceof Error ? error.message : t('submitFailed')
      );
    },
  });

  const handleSubmit = () => {
    if (issueText.trim().length < 3) {
      setFieldError(t('textMin'));
      return;
    }
    setFieldError('');
    mutation.mutate();
  };

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('reportTitle')}</CmxDialogTitle>
          <CmxDialogDescription>
            {t(`scope.${scopeLevel.toLowerCase()}`)}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="issue-code">{t('code')}</Label>
            <CmxSelectDropdown
              value={issueCode}
              onValueChange={setIssueCode}
            >
              <CmxSelectDropdownTrigger id="issue-code">
                <CmxSelectDropdownValue />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {ISSUE_CODES.map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>
                    {t(`codes.${code}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-text">{t('text')}</Label>
            <CmxTextarea
              id="issue-text"
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              placeholder={t('textPlaceholder')}
              rows={4}
              aria-invalid={Boolean(fieldError)}
            />
            {fieldError ? (
              <p className="text-xs text-destructive">{fieldError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-photo">{t('photoUrl')}</Label>
            <CmxInput
              id="issue-photo"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder={t('photoUrlPlaceholder')}
            />
          </div>
        </div>

        <CmxDialogFooter>
          <CmxButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            {t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
