'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCheckbox } from '@ui/primitives/cmx-checkbox';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import { cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import type { EditReviewView } from './edit-review-view';
import { EditReviewChanges } from './edit-review-changes';
import type { ApplyFailureNotice } from './apply-failure';

/** Compact applied-history facts shown without changing the review's navigation flow. */
export interface EditHistoryRow {
  changeNo: number;
  revision: number;
  legacy: boolean;
  reason: string | null;
  financialOutcome: string;
  operations: string[];
}

/**
 * Review dialog. Apply is enabled only for a ready preview.
 * This component does not call Preview or Apply itself.
 */
export function EditReviewDialog({
  open,
  review,
  history,
  applying,
  conflict,
  applyFailure,
  onOpenChange,
  onAcknowledge,
  onReason,
  onReviewAgain,
  onApply,
  onReload,
}: {
  open: boolean;
  review: EditReviewView | null;
  history: EditHistoryRow[];
  applying: boolean;
  conflict: boolean;
  applyFailure: ApplyFailureNotice | null;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: (seq: number, gateCode: string) => void;
  onReason: (reason: string) => void;
  onReviewAgain: () => void;
  onApply: () => void;
  onReload: () => void;
}) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const [reasonText, setReasonText] = useState('');
  // Acknowledgements and reasons must produce a fresh READY Preview before Apply is offered.
  const ready = review?.status === 'READY' && review.operations.length > 0 && !conflict;
  const awaitingReason = review?.status === 'REASON_REQUIRED';
  const warningTitle = (decision: string, reasonCode: string) => {
    if (decision === 'DENY') return t('workspace.deniedReason', { reason: reasonCode });
    if (decision === 'REQUIRE_OVERRIDE') return t('policyInfo.legend.override');
    if (decision === 'ALLOW_WITH_WARNING') return t('policyInfo.legend.warning');
    return decision;
  };
  const copyFailure = () => {
    if (!applyFailure) return;
    void navigator.clipboard.writeText(applyFailure.copyText).then(
      () => { cmxMessage.success(tCommon('copied')); },
      () => { cmxMessage.error(t('policyInfo.facts.copyFailed')); },
    );
  };
  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg p-0 text-start sm:max-w-2xl">
        <CmxDialogHeader className="border-b border-gray-100 px-4 py-3">
          <CmxDialogTitle>{t('workspace.review')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto px-4 py-4">
          {applyFailure ? (
            <div className="space-y-2">
              <CmxSummaryMessage type="error" title={applyFailure.title} items={applyFailure.lines} />
              <CmxButton type="button" variant="outline" onClick={copyFailure}>{t('policyInfo.facts.copy')}</CmxButton>
            </div>
          ) : conflict ? (
            <CmxSummaryMessage type="warning" title={t('workspace.conflict')} items={[]} />
          ) : null}
          {review ? (
            <>
              <CmxSummaryMessage
                type={ready ? 'success' : review.status === 'DENIED' ? 'error' : 'warning'}
                title={awaitingReason ? t('policyInfo.how.reasonRequired') : t('workspace.reviewStatus', { status: review.status })}
                items={[
                  `${t('workspace.currentTotal')}: ${review.currentTotal}`,
                  `${t('workspace.estimatedTotal')}: ${review.estimatedTotal ?? review.currentTotal}`,
                  ...(review.financialOutcome ? [`${t('workspace.outcome')}: ${review.financialOutcome}`] : []),
                ]}
              />
              <EditReviewChanges
                operations={review.operations}
                currencyCode={review.currencyCode}
                timezone={review.timezone}
                renderWarning={(seq) => review.warnings.filter((warning) => warning.seq === seq).map((warning) => (
                  <div key={`${warning.seq}-${warning.gateCode}`} className="space-y-2">
                    <CmxSummaryMessage type={warning.decision === 'DENY' ? 'error' : 'warning'} title={warningTitle(warning.decision, warning.reasonCode)} items={[warning.decision === 'DENY' ? warning.decision : warning.reasonCode]} />
                    {warning.requiresAcknowledgement ? (
                      <CmxCheckbox label={t('workspace.acknowledge')} onChange={() => onAcknowledge(warning.seq, warning.gateCode)} />
                    ) : null}
                  </div>
                ))}
              />
              {awaitingReason ? (
                <CmxTextarea
                  aria-label={t('workspace.reason')}
                  placeholder={t('workspace.reason')}
                  value={reasonText}
                  onChange={(event) => {
                    setReasonText(event.target.value);
                    onReason(event.target.value);
                  }}
                />
              ) : null}
            </>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium">{t('workspace.history')}</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-500">{t('workspace.emptyHistory')}</p>
            ) : (
              <ul className="space-y-2">
                {history.map((row) => (
                  <li key={row.changeNo} className="text-xs text-gray-600">
                    {row.legacy ? t('workspace.legacyHistory') : t('workspace.changeNumber', { number: row.changeNo })}
                    {' · '}
                    {t('workspace.revision', { version: row.revision })}
                    {row.operations.length > 0 ? ` · ${row.operations.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <CmxDialogFooter className="border-t border-gray-100 px-4 py-3">
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</CmxButton>
          {conflict ? (
            <CmxButton type="button" onClick={onReload}>{t('workspace.reload')}</CmxButton>
          ) : ready ? (
            <CmxButton type="button" loading={applying} disabled={applying} onClick={onApply}>
              {applying ? t('workspace.applying') : t('workspace.apply')}
            </CmxButton>
          ) : (
            <CmxButton type="button" loading={applying} disabled={applying || review?.status === 'DENIED'} onClick={onReviewAgain}>
              {t('workspace.reviewAgain')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
