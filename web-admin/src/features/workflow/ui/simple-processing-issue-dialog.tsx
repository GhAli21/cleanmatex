/**
 * Compact Report Issue dialog for Simple Processing.
 * Posts to POST /api/v1/orders/[id]/issue (order-level).
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
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';

const ISSUE_CODES = ['damage', 'stain', 'complaint', 'other'] as const;
type IssueCode = (typeof ISSUE_CODES)[number];

export interface SimpleProcessingIssueDialogProps {
  open: boolean;
  orderId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Nested issue form for Simple Processing header action.
 */
export function SimpleProcessingIssueDialog({
  open,
  orderId,
  onOpenChange,
  onSuccess,
}: SimpleProcessingIssueDialogProps) {
  const t = useTranslations('processing.simpleModal.issue');
  const tCommon = useTranslations('common');
  const { token: csrfToken } = useCSRFToken();

  const [issueCode, setIssueCode] = React.useState<IssueCode>('other');
  const [issueText, setIssueText] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setIssueCode('other');
      setIssueText('');
      setFieldError('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify({
          orderItemId: null,
          issueCode,
          issueText: issueText.trim(),
          priority: 'normal',
        }),
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
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          <CmxDialogDescription>{t('description')}</CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="simple-issue-code">{t('code')}</Label>
            <CmxSelectDropdown
              value={issueCode}
              onValueChange={(v) => setIssueCode(v as IssueCode)}
            >
              <CmxSelectDropdownTrigger id="simple-issue-code">
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
            <Label htmlFor="simple-issue-text">{t('text')}</Label>
            <CmxTextarea
              id="simple-issue-text"
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
