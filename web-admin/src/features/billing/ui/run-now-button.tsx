'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxConfirmDialog } from '@ui/feedback/cmx-confirm-dialog';
import { useMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';
import {
  expireDueCreditNotesAction,
  expireDueGiftCardsAction,
  expireDueLoyaltyPointsAction,
  retryErpSystemErrorsAction,
  type RunNowActionResult,
} from '@/app/actions/finance/run-now-actions';

/** The four "run now" buttons of Background Jobs step 6g; each maps to its action and permission. */
export type RunNowKind = 'giftCards' | 'creditNotes' | 'loyalty' | 'erpRetry';

const RUN_NOW: Record<RunNowKind, { permission: string; action: () => Promise<RunNowActionResult> }> = {
  giftCards: { permission: 'gift_cards:expire', action: expireDueGiftCardsAction },
  creditNotes: { permission: FINANCE_PERMISSIONS.STORED_VALUE_EXPIRE_CREDIT_NOTES, action: expireDueCreditNotesAction },
  loyalty: { permission: FINANCE_PERMISSIONS.LOYALTY_EXPIRE_POINTS, action: expireDueLoyaltyPointsAction },
  erpRetry: { permission: 'erp_lite_exceptions:retry', action: retryErpSystemErrorsAction },
};

/** Props of {@link RunNowButton}. */
export interface RunNowButtonProps {
  kind: RunNowKind;
  /** Reloads a list the screen fetches in the browser (server lists refresh by themselves). */
  onDone?: () => void;
}

/**
 * Button + confirm that runs a nightly finance job now for the signed-in user's Organization only,
 * then reports the counts. Hidden without the permission (the server action checks it again).
 */
export function RunNowButton({ kind, onDone }: RunNowButtonProps) {
  const t = useTranslations('billing.runNow');
  const tCommon = useTranslations('common');
  const message = useMessage();
  const router = useRouter();
  const { permission, action } = RUN_NOW[kind];
  const allowed = useHasPermissionCode(permission);
  if (!allowed) return null;

  const run = async () => {
    const r = await action();
    if (!r.success || !r.data) {
      message.showError(t(r.error === 'FORBIDDEN' ? 'forbidden' : 'failed'));
      return;
    }
    const { done, failed, more } = r.data;
    const text = [t(`${kind}.result`, { count: done }), failed > 0 ? t('failedCount', { count: failed }) : null, more ? t('more') : null]
      .filter(Boolean)
      .join(' ');
    if (failed > 0) message.showWarning(text);
    else message.showSuccess(text);
    // Server lists on the page show the statuses and balances that just changed.
    router.refresh();
    onDone?.();
  };

  return (
    <CmxConfirmDialog
      title={t(`${kind}.confirmTitle`)}
      description={t(`${kind}.confirmDescription`)}
      confirmLabel={t(`${kind}.label`)}
      cancelLabel={tCommon('cancel')}
      onConfirm={run}
      trigger={
        <CmxButton type="button" variant="outline" size="sm">
          {t(`${kind}.label`)}
        </CmxButton>
      }
    />
  );
}
