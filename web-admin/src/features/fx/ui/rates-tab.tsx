'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, TrendingUp } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { Badge, type BadgeProps } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { CmxConfirmDialog } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import { FX_RATE_STATUS } from '@/lib/constants/currency-fx';
import { approveRateAction, deleteRateAction, rejectRateAction, voidRateAction } from '@/app/actions/fx/rate-actions';
import { RateFormDialog } from './rate-form-dialog';
import { FxReasonDialog } from './fx-reason-dialog';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';
import type { FxRateRow } from '@/lib/types/currency-fx';

interface RatesTabProps {
  rates: FxRateRow[];
  isLoading?: boolean;
  onRefresh: () => void;
}

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  [FX_RATE_STATUS.DRAFT]: 'warning',
  [FX_RATE_STATUS.APPROVED]: 'success',
  [FX_RATE_STATUS.REJECTED]: 'destructive',
  [FX_RATE_STATUS.VOIDED]: 'outline',
};

export function RatesTab({ rates, isLoading, onRefresh }: RatesTabProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<FxRateRow | null>(null);
  const [voidTarget, setVoidTarget] = useState<FxRateRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FxRateRow | null>(null);

  const canManage = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE);
  const canApprove = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE);
  const canManualOverride = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_MANUAL_OVERRIDE);

  const runAction = (action: () => Promise<{ success: boolean; error?: string; errorCode?: string }>, successKey: string) => {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        cmxMessage.success(t(successKey));
        onRefresh();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    const result = await rejectRateAction(rejectTarget.id, reason);
    if (result.success) {
      cmxMessage.success(t('rates.rejected'));
      onRefresh();
    } else {
      cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
    }
  };

  const handleVoid = async (reason: string) => {
    if (!voidTarget) return;
    const result = await voidRateAction(voidTarget.id, reason);
    if (result.success) {
      cmxMessage.success(t('rates.voided'));
      onRefresh();
    } else {
      cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const result = await deleteRateAction(deleteTarget.id);
    if (result.success) {
      cmxMessage.success(t('rates.deleted'));
      onRefresh();
    } else {
      cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
    }
    setDeleteTarget(null);
  };

  if (isLoading) return <CmxSkeletonTable rows={4} columns={6} showHeader />;

  const AddButton = canManage ? (
    <div className="mb-4 flex justify-end">
      <CmxButton onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4 me-2" />
        {t('rates.add')}
      </CmxButton>
    </div>
  ) : null;

  if (!rates.length) {
    return (
      <>
        {AddButton}
        <CmxEmptyState icon={<TrendingUp className="h-8 w-8" />} title={t('rates.empty.title')} description={t('rates.empty.description')} />
        <RateFormDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); onRefresh(); }} />
      </>
    );
  }

  const columns = [
    {
      key: 'pair',
      header: t('rates.pair'),
      render: (r: FxRateRow) => <span className="font-mono">{r.fromCurrencyCode} → {r.toCurrencyCode}</span>,
    },
    { key: 'type', header: t('rates.type'), render: (r: FxRateRow) => r.rateTypeCode },
    { key: 'source', header: t('rates.source'), render: (r: FxRateRow) => r.sourceCode },
    { key: 'rateDate', header: t('rates.rateDate'), render: (r: FxRateRow) => r.rateDate },
    { key: 'rate', header: t('rates.rate'), render: (r: FxRateRow) => <span className="font-mono">{r.rate}</span> },
    {
      key: 'origin',
      header: t('rates.origin'),
      render: (r: FxRateRow) => t(`rates.originValue.${r.originCode}` as Parameters<typeof t>[0]),
    },
    {
      key: 'status',
      header: t('rates.status'),
      render: (r: FxRateRow) => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{t(`rates.statusValue.${r.status}` as Parameters<typeof t>[0])}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r: FxRateRow) => (
        <div className="flex flex-wrap justify-end gap-2">
          {canApprove && r.status === FX_RATE_STATUS.DRAFT && (
            <>
              <CmxButton variant="outline" size="sm" onClick={() => runAction(() => approveRateAction(r.id), 'rates.approved')}>
                {t('common.approve')}
              </CmxButton>
              <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setRejectTarget(r)}>
                {t('common.reject')}
              </CmxButton>
            </>
          )}
          {canManualOverride && r.status === FX_RATE_STATUS.APPROVED && (
            <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setVoidTarget(r)}>
              {t('common.void')}
            </CmxButton>
          )}
          {canManage && r.status === FX_RATE_STATUS.DRAFT && (
            <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(r)}>
              {tCommon('delete')}
            </CmxButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {AddButton}
      <CmxDataTable columns={columns} data={rates} />
      <RateFormDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); onRefresh(); }} />
      <FxReasonDialog
        open={!!rejectTarget}
        title={t('rates.rejectConfirm.title')}
        description={t('rates.rejectConfirm.description')}
        confirmLabel={t('common.reject')}
        destructive
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
      <FxReasonDialog
        open={!!voidTarget}
        title={t('rates.voidConfirm.title')}
        description={t('rates.voidConfirm.description')}
        confirmLabel={t('common.void')}
        destructive
        onClose={() => setVoidTarget(null)}
        onConfirm={handleVoid}
      />
      <CmxConfirmDialog
        open={!!deleteTarget}
        title={t('rates.deleteConfirm.title')}
        description={t('rates.deleteConfirm.description')}
        confirmLabel={tCommon('delete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
