'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import { CmxSummaryMessage, useMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { HomeCollectionApiError } from '@features/home-collection/api/home-collection-api';
import { useHomeCollectionHandover } from '@features/home-collection/hooks/use-home-collection-handover';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';

export interface HomeCollectionHandoverCardProps {
  orderId: string;
  orderNo: string;
  customerName: string;
  onCompleted: () => void;
}

/**
 * Reusable confirm-home-collection surface for floor detail pages.
 * ASSIGN / FAIL stay on WorkflowActionBar; this card owns CONFIRM only.
 */
export function HomeCollectionHandoverCard({
  orderId,
  orderNo,
  customerName,
  onCompleted,
}: HomeCollectionHandoverCardProps) {
  const t = useTranslations('workflow.homeCollection');
  const tCommon = useTranslations('common');
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const locale = useLocale();
  const { showError, showSuccess } = useMessage();
  const { confirmAction, currentStatus, loading, submitting, confirm } = useHomeCollectionHandover(orderId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collectionNotes, setCollectionNotes] = useState('');

  const isRtl = locale.startsWith('ar');
  const blockedReason = confirmAction?.blockedReasons
    .map((reason) => (isRtl && reason.message2 ? reason.message2 : reason.message))
    .join(' · ');

  if (currentStatus !== 'out_for_collection') {
    return null;
  }

  if (!confirmAction) {
    if (loading) return null;
    return (
      <CmxSummaryMessage
        type="info"
        title={t('confirmTitle')}
        items={[t('notConfigured')]}
      />
    );
  }

  const handleConfirm = async () => {
    if (confirmAction.disabled) {
      if (blockedReason) showError(blockedReason);
      return;
    }
    try {
      await confirm({ collectionNotes });
      showSuccess(t('success'));
      setDialogOpen(false);
      setCollectionNotes('');
      onCompleted();
    } catch (error) {
      if (error instanceof HomeCollectionApiError) {
        showError(profileStaffMessage(error.code, error.message));
        return;
      }
      showError(t('failed'));
    }
  };

  return (
    <>
      <CmxSummaryMessage
        type="info"
        title={t('confirmTitle')}
        items={[t('confirmDescription')]}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <CmxButton
          type="button"
          disabled={confirmAction.disabled || submitting}
          onClick={() => setDialogOpen(true)}
        >
          {t('confirmAction')}
        </CmxButton>
      </div>

      <CmxDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('dialogTitle')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t('dialogDescription', { customerName, orderNo })}
            </CmxDialogDescription>
          </CmxDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="home-collection-notes">{t('notesLabel')}</Label>
            <CmxTextarea
              id="home-collection-notes"
              value={collectionNotes}
              onChange={(event) => setCollectionNotes(event.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
            />
          </div>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" disabled={submitting} onClick={() => void handleConfirm()}>
              {t('confirmAction')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}
