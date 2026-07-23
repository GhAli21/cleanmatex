/**
 * Report issue dialog — ORDER / ITEM / PIECE scope.
 * Issue type + priority from active catalog lookups.
 */

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxTextarea, CmxInput, Label, CmxSpinner } from '@ui/primitives';
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
  DEFAULT_PRIORITY,
  ORDER_ISSUE_CODE,
  ORDER_ISSUE_SCOPE,
  type OrderIssueScope,
} from '@/lib/constants/order-issues';

type CatalogRow = {
  code: string;
  name: string | null;
  name2: string | null;
  is_default?: boolean;
};

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
  const locale = useLocale();
  const { token: csrfToken } = useCSRFToken();

  const [issueCode, setIssueCode] = React.useState<string>(ORDER_ISSUE_CODE.OTHER);
  const [priority, setPriority] = React.useState<string>(DEFAULT_PRIORITY);
  const [issueText, setIssueText] = React.useState('');
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');

  const { data: issueTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['lookups-issue-types'],
    enabled: open,
    queryFn: async () => {
      const res = await fetch('/api/v1/lookups/issue-types');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Failed');
      return ((json as { data?: CatalogRow[] }).data ?? []) as CatalogRow[];
    },
  });

  const { data: priorities = [], isLoading: prioritiesLoading } = useQuery({
    queryKey: ['lookups-priorities'],
    enabled: open,
    queryFn: async () => {
      const res = await fetch('/api/v1/lookups/priorities');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Failed');
      return ((json as { data?: CatalogRow[] }).data ?? []) as CatalogRow[];
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setIssueText('');
    setPhotoUrl('');
    setFieldError('');
    const defaultType =
      issueTypes.find((r) => r.code === ORDER_ISSUE_CODE.OTHER)?.code ||
      issueTypes[0]?.code ||
      ORDER_ISSUE_CODE.OTHER;
    setIssueCode(defaultType);
    const defaultPri =
      priorities.find((r) => r.is_default)?.code ||
      priorities.find((r) => r.code === DEFAULT_PRIORITY)?.code ||
      DEFAULT_PRIORITY;
    setPriority(defaultPri);
  }, [open, issueTypes, priorities]);

  const labelFor = (row: CatalogRow) =>
    locale === 'ar' ? row.name2 || row.name || row.code : row.name || row.code;

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        scopeLevel,
        issueCode,
        issueText: issueText.trim(),
        priority,
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

  const catalogsLoading = typesLoading || prioritiesLoading;

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('reportTitle')}</CmxDialogTitle>
          <CmxDialogDescription>
            {t(`scope.${scopeLevel.toLowerCase()}`)}
          </CmxDialogDescription>
        </CmxDialogHeader>

        {catalogsLoading ? (
          <div className="flex justify-center py-8">
            <CmxSpinner />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
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
                    {issueTypes.map((row) => (
                      <CmxSelectDropdownItem key={row.code} value={row.code}>
                        {labelFor(row)}
                      </CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-priority">{t('priority')}</Label>
                <CmxSelectDropdown value={priority} onValueChange={setPriority}>
                  <CmxSelectDropdownTrigger id="issue-priority">
                    <CmxSelectDropdownValue />
                  </CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {priorities.map((row) => (
                      <CmxSelectDropdownItem key={row.code} value={row.code}>
                        {labelFor(row)}
                      </CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              </div>
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
        )}

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
            disabled={mutation.isPending || catalogsLoading}
          >
            {t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
