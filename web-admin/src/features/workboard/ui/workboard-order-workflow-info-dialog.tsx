'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';

import type { WorkboardOrderRow } from '@features/workboard/model/workboard-types';

/** Props for the Workboard dialog that reveals an order's immutable workflow snapshot. */
export interface WorkboardOrderWorkflowInfoDialogProps {
  /** Queue projection scoped to the authenticated tenant by the Workboard service. */
  order: WorkboardOrderRow;
}

/**
 * Presents the pinned workflow and order-classification values without requiring
 * staff to leave the supervisor queue or triggering another per-row request.
 */
export function WorkboardOrderWorkflowInfoDialog({ order }: WorkboardOrderWorkflowInfoDialogProps) {
  const t = useTranslations('workboard.orderWorkflowInfo');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const profileName = locale === 'ar' && order.workflowProfileName2
    ? order.workflowProfileName2
    : order.workflowProfileName;
  const fields = [
    { key: 'stateVersion', value: order.stateVersion },
    { key: 'workflowProfile', value: profileName },
    { key: 'workflowProfileId', value: order.workflowProfileId },
    { key: 'workflowVersionNo', value: order.workflowVersionNo },
    { key: 'workflowProfileRevision', value: order.workflowProfileRevision },
    { key: 'workflowProfileVersionId', value: order.workflowProfileVersionId },
    { key: 'orderSourceCode', value: order.orderSourceCode },
    { key: 'orderTypeId', value: order.orderTypeId },
    { key: 'orderSubtype', value: order.orderSubtype },
  ] as const;

  return (
    <>
      <CmxButton
        type="button"
        variant="ghost"
        size="xs"
        className="h-7 w-7 shrink-0 px-0"
        aria-label={t('open', { orderNo: order.orderNo })}
        title={t('open', { orderNo: order.orderNo })}
        onClick={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </CmxButton>
      <CmxDialog open={open} onOpenChange={setOpen}>
        <CmxDialogContent className="max-w-2xl" scrollBody>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('title', { orderNo: order.orderNo })}</CmxDialogTitle>
            <CmxDialogDescription>{t('description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="min-w-0 space-y-1">
                <dt className="text-xs text-muted-foreground">{t(`fields.${field.key}`)}</dt>
                <dd className="break-words text-sm font-medium">
                  {field.value === null || field.value === undefined || field.value === ''
                    ? t('notAvailable')
                    : String(field.value)}
                </dd>
              </div>
            ))}
          </dl>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}
