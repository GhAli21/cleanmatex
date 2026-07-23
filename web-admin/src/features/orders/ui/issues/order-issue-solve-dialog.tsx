/**
 * Nested dialog to capture solved_notes for an issue.
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
import { cmxMessage } from '@ui/feedback';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';

export interface OrderIssueSolveDialogProps {
  open: boolean;
  orderId: string;
  issueId: string;
  /** Optional issue description shown above notes. */
  issueSnippet?: string | null;
  /** Optional catalog type label shown with the snippet. */
  issueTypeLabel?: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Solve issue — PATCH solvedNotes; server sets status=SOLVED + solved_*.
 */
export function OrderIssueSolveDialog({
  open,
  orderId,
  issueId,
  issueSnippet,
  issueTypeLabel,
  onOpenChange,
  onSuccess,
}: OrderIssueSolveDialogProps) {
  const t = useTranslations('orders.issues');
  const tCommon = useTranslations('common');
  const { token: csrfToken } = useCSRFToken();
  const [notes, setNotes] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setNotes('');
      setFieldError('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/v1/orders/${orderId}/issue/${issueId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getCSRFHeader(csrfToken),
          },
          body: JSON.stringify({ solvedNotes: notes.trim() }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || t('solveFailed')
        );
      }
      return data;
    },
    onSuccess: () => {
      cmxMessage.success(t('solveSuccess'));
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      cmxMessage.error(
        error instanceof Error ? error.message : t('solveFailed')
      );
    },
  });

  const handleSubmit = () => {
    if (notes.trim().length < 3) {
      setFieldError(t('notesMin'));
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
          <CmxDialogTitle>{t('solveTitle')}</CmxDialogTitle>
          <CmxDialogDescription>{t('solveDescription')}</CmxDialogDescription>
        </CmxDialogHeader>

        {issueSnippet?.trim() || issueTypeLabel ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {issueTypeLabel ? (
              <p className="font-medium text-foreground">{issueTypeLabel}</p>
            ) : null}
            {issueSnippet?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {issueSnippet.trim()}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 py-2">
          <Label htmlFor="issue-solved-notes">{t('notes')}</Label>
          <CmxTextarea
            id="issue-solved-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={4}
            aria-invalid={Boolean(fieldError)}
          />
          {fieldError ? (
            <p className="text-xs text-destructive">{fieldError}</p>
          ) : null}
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
            {t('solveSubmit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
