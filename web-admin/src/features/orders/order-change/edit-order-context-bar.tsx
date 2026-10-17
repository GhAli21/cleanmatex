'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import type { OrderWorkspaceSessionValue } from './order-workspace-session';

/**
 * Edit chrome around the shared New Order workspace.
 * Review and Discard are the only actions. There is no second Save.
 */
export function EditOrderContextBar({ session }: { session: OrderWorkspaceSessionValue }) {
  const t = useTranslations('orders.edit');
  return (
    <div className="flex flex-col gap-2 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white px-4 py-3 text-start">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{t('pageTitle', { orderNo: session.orderNo })}</p>
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('workspace.revision', { version: session.revision })}
            {' · '}
            {t('workspace.workflowStatus')}: {session.workflowStatus ?? t('workspace.lockedField')}
            {' · '}
            {t('workspace.dirtyCount', { count: session.dirtyCount })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CmxButton
            type="button"
            variant="ghost"
            onClick={session.onExit}
            className="gap-2"
            disabled={session.exiting || session.reviewing || session.sealed}
            loading={session.exiting}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('lifecycle.exit')}
          </CmxButton>
          <CmxButton type="button" variant="outline" onClick={session.onDiscard} disabled={session.accessBlocked || session.dirtyCount === 0 || session.sealed || session.exiting}>
            {t('workspace.discardChanges')}
          </CmxButton>
          <CmxButton type="button" onClick={session.onReview} disabled={session.accessBlocked || session.reviewing || session.sealed || session.exiting} loading={session.reviewing}>
            {session.reviewing ? t('workspace.reviewing') : t('workspace.review')}
          </CmxButton>
        </div>
      </div>
      {session.accessBlocked ? (
        <CmxSummaryMessage type="warning" title={session.accessReason || t('cannotEdit')} items={[]} />
      ) : null}
      {session.reviewStatus ? (
        <CmxSummaryMessage
          type={session.reviewStatus === 'READY' ? 'success' : 'warning'}
          title={t('workspace.reviewStatus', { status: session.reviewStatus })}
          items={[
            `${t('workspace.currentTotal')}: ${session.currentTotal}`,
            `${t('workspace.estimatedTotal')}: ${session.estimatedTotal ?? session.currentTotal}`,
          ]}
        />
      ) : null}
    </div>
  );
}
