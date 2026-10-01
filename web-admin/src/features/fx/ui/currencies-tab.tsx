'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Coins } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { CmxConfirmDialog } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import {
  deactivateCurrencyAction,
  reactivateCurrencyAction,
  setBaseCurrencyAction,
  setReportingCurrencyAction,
} from '@/app/actions/fx/currency-actions';
import { CurrencyFormDialog } from './currency-form-dialog';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';
import type { CurrencyPortfolioRow } from '@/lib/types/currency-fx';

interface CurrenciesTabProps {
  currencies: CurrencyPortfolioRow[];
  isLoading?: boolean;
  onRefresh: () => void;
}

export function CurrenciesTab({ currencies, isLoading, onRefresh }: CurrenciesTabProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<CurrencyPortfolioRow | null>(null);
  const [setBaseTarget, setSetBaseTarget] = useState<CurrencyPortfolioRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CurrencyPortfolioRow | null>(null);

  const canManage = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE);
  const canSetBase = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.CURRENCIES_SET_BASE);

  const handleSetBaseConfirm = async () => {
    if (!setBaseTarget) return;
    const result = await setBaseCurrencyAction(setBaseTarget.currencyCode);
    if (result.success) {
      cmxMessage.success(t('currencies.saved'));
      onRefresh();
    } else {
      cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
    }
    setSetBaseTarget(null);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    const result = await deactivateCurrencyAction(deactivateTarget.currencyCode);
    if (result.success) {
      cmxMessage.success(t('currencies.saved'));
      onRefresh();
    } else {
      cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
    }
    setDeactivateTarget(null);
  };

  const handleReactivate = (currency: CurrencyPortfolioRow) => {
    startTransition(async () => {
      const result = await reactivateCurrencyAction(currency.currencyCode);
      if (result.success) {
        cmxMessage.success(t('currencies.saved'));
        onRefresh();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const handleToggleReporting = (currency: CurrencyPortfolioRow) => {
    startTransition(async () => {
      const result = await setReportingCurrencyAction(currency.isReportingCurrency ? null : currency.currencyCode);
      if (result.success) {
        cmxMessage.success(t('currencies.saved'));
        onRefresh();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  if (isLoading) return <CmxSkeletonTable rows={3} columns={5} showHeader />;

  const AddButton = canManage ? (
    <div className="mb-4 flex justify-end">
      <CmxButton onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4 me-2" />
        {t('currencies.add')}
      </CmxButton>
    </div>
  ) : null;

  if (!currencies.length) {
    return (
      <>
        {AddButton}
        <CmxEmptyState icon={<Coins className="h-8 w-8" />} title={t('currencies.empty.title')} description={t('currencies.empty.description')} />
        <CurrencyFormDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); onRefresh(); }} />
      </>
    );
  }

  const columns = [
    {
      key: 'code',
      header: t('currencies.code'),
      render: (c: CurrencyPortfolioRow) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{c.currencyCode}</span>
          {!c.isActive && <Badge variant="outline">{tCommon('inactive')}</Badge>}
        </div>
      ),
    },
    {
      key: 'role',
      header: t('currencies.role'),
      render: (c: CurrencyPortfolioRow) => (
        <div className="flex gap-1">
          {c.isBaseCurrency && <Badge variant="success">{t('currencies.baseChip')}</Badge>}
          {c.isReportingCurrency && <Badge variant="info">{t('currencies.reportingChip')}</Badge>}
        </div>
      ),
    },
    {
      key: 'contexts',
      header: t('currencies.contexts'),
      render: (c: CurrencyPortfolioRow) => (
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            ['allowSales', c.allowSales] as const,
            ['allowPayments', c.allowPayments] as const,
            ['allowCash', c.allowCash] as const,
            ['allowAr', c.allowAr] as const,
          ].map(([key, enabled]) => (
            <Badge key={key} variant={enabled ? 'secondary' : 'outline'} className={enabled ? '' : 'opacity-50'}>
              {t(`currencies.context.${key}`)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c: CurrencyPortfolioRow) => (
        <div className="flex flex-wrap justify-end gap-2">
          {canManage && (
            <CmxButton variant="outline" size="sm" onClick={() => setEditTarget(c)}>
              {tCommon('edit')}
            </CmxButton>
          )}
          {canSetBase && !c.isBaseCurrency && c.isActive && (
            <CmxButton variant="outline" size="sm" onClick={() => setSetBaseTarget(c)}>
              {t('currencies.setBase')}
            </CmxButton>
          )}
          {canManage && !c.isBaseCurrency && c.isActive && (
            <CmxButton variant="ghost" size="sm" onClick={() => handleToggleReporting(c)}>
              {c.isReportingCurrency ? t('currencies.clearReporting') : t('currencies.setReporting')}
            </CmxButton>
          )}
          {canManage && !c.isBaseCurrency && (
            c.isActive ? (
              <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivateTarget(c)}>
                {t('common.deactivate')}
              </CmxButton>
            ) : (
              <CmxButton variant="ghost" size="sm" onClick={() => handleReactivate(c)}>
                {t('common.reactivate')}
              </CmxButton>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {AddButton}
      <CmxDataTable columns={columns} data={currencies} />
      <CurrencyFormDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); onRefresh(); }} />
      {editTarget && (
        <CurrencyFormDialog
          currency={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); onRefresh(); }}
        />
      )}
      <CmxConfirmDialog
        open={!!setBaseTarget}
        title={t('currencies.setBaseConfirm.title')}
        description={t('currencies.setBaseConfirm.description')}
        confirmLabel={t('currencies.setBase')}
        onConfirm={handleSetBaseConfirm}
        onCancel={() => setSetBaseTarget(null)}
      />
      <CmxConfirmDialog
        open={!!deactivateTarget}
        title={t('currencies.deactivateConfirm.title')}
        description={t('currencies.deactivateConfirm.description')}
        confirmLabel={t('common.deactivate')}
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  );
}
